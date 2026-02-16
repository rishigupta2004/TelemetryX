from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import pandas as pd
import os
import duckdb
import logging
from ..utils import resolve_dir, read_parquet_df, read_parquet_records, normalize_session_code, display_session_code
from ..config import FEATURES_DIR
from ..catalog import calendar_order
from ..utils import normalize_key

router = APIRouter()
logger = logging.getLogger(__name__)

FEATURE_DATASETS: Dict[str, str] = {
    "lap": "lap_features.parquet",
    "tyre": "tyre_features.parquet",
    "telemetry": "telemetry_features.parquet",
    "race_context": "race_context_features.parquet",
    "comparison": "comparison_features.parquet",
    "position": "position_features.parquet",
    "overtakes": "overtakes_features.parquet",
    "traffic": "traffic_features.parquet",
    "points": "points_features.parquet",
}


def find_features_path(year: int, race_name: str, session: str) -> Optional[str]:
    """Find path to feature files for a race session."""
    year_path = os.path.join(FEATURES_DIR, str(year))
    if not os.path.exists(year_path):
        return None
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return None
    path = os.path.join(year_path, race_dir, normalize_session_code(session))
    if os.path.exists(path):
        return path
    return None


DEFAULT_FEATURE_LIMIT = 2000
MAX_FEATURE_LIMIT = 20000


def load_feature_records(session_path: Optional[str], filename: str, limit: int = DEFAULT_FEATURE_LIMIT) -> List[Dict[str, Any]]:
    if not session_path:
        logger.warning("features_missing_session_path filename=%s", str(filename))
        return []
    feature_file = os.path.join(session_path, filename)
    if not os.path.exists(feature_file):
        logger.warning("features_missing_file path=%s", feature_file)
        return []
    try:
        use_limit = max(1, min(int(limit), MAX_FEATURE_LIMIT))
        return read_parquet_records(feature_file, limit=use_limit)
    except Exception as e:
        logger.warning("features_read_failed path=%s error=%s", feature_file, str(e))
        return []


def _load_named_feature(
    year: int,
    race: str,
    session: str,
    feature_name: str,
    limit: int = DEFAULT_FEATURE_LIMIT,
) -> List[Dict[str, Any]]:
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    filename = FEATURE_DATASETS.get(feature_name)
    if not filename:
        return []
    return load_feature_records(session_path, filename, limit=limit)


def _filter_driver(df: pd.DataFrame, driver: str) -> pd.DataFrame:
    if df is None or df.empty or not driver:
        return pd.DataFrame()
    d = str(driver).strip()
    if "driver_name" in df.columns:
        mask = df["driver_name"].astype(str).str.upper() == d.upper()
        if mask.any():
            return df[mask]
    if "driver_number" in df.columns and d.isdigit():
        mask = df["driver_number"].astype(str) == str(d)
        if mask.any():
            return df[mask]
    return pd.DataFrame()


def _latest_row(df: pd.DataFrame, col: str) -> Dict[str, Any]:
    if df is None or df.empty:
        return {}
    if col in df.columns:
        df2 = df.sort_values(col, ascending=True)
        if not df2.empty:
            return df2.iloc[-1].to_dict()
    return df.iloc[-1].to_dict()


def _mean(df: pd.DataFrame, col: str) -> Optional[float]:
    if df is None or df.empty or col not in df.columns:
        return None
    try:
        return float(pd.to_numeric(df[col], errors="coerce").dropna().mean())
    except Exception:
        return None


def _max(df: pd.DataFrame, col: str) -> Optional[float]:
    if df is None or df.empty or col not in df.columns:
        return None
    try:
        return float(pd.to_numeric(df[col], errors="coerce").dropna().max())
    except Exception:
        return None


def _min(df: pd.DataFrame, col: str) -> Optional[float]:
    if df is None or df.empty or col not in df.columns:
        return None
    try:
        return float(pd.to_numeric(df[col], errors="coerce").dropna().min())
    except Exception:
        return None


def get_available_races(year: int) -> List[str]:
    """Get list of available races for a year."""
    year_path = os.path.join(FEATURES_DIR, str(year))
    if not os.path.exists(year_path):
        return []
    races = [d for d in os.listdir(year_path) if os.path.isdir(os.path.join(year_path, d))]
    order = calendar_order(year)
    order_map = {normalize_key(name): idx for idx, name in enumerate(order)}
    def _sort_key(name: str):
        key = normalize_key(name)
        return (0, order_map[key]) if key in order_map else (1, name)
    return sorted(races, key=_sort_key)


def get_available_sessions(year: int, race_name: str) -> List[str]:
    """Get available sessions for a race."""
    race_path = os.path.join(FEATURES_DIR, str(year), race_name)
    if not os.path.exists(race_path):
        return []
    sessions = [d for d in os.listdir(race_path) if os.path.isdir(os.path.join(race_path, d))]
    return sorted([display_session_code(s) for s in sessions])


@router.get("/features/summary")
async def get_features_summary() -> Dict[str, Any]:
    """Get summary of all available features."""
    try:
        total_features = 0
        by_year = {}
        
        for year_dir in os.listdir(FEATURES_DIR):
            if not year_dir.isdigit():
                continue
            year = int(year_dir)
            year_path = os.path.join(FEATURES_DIR, year_dir)
            
            n_races = 0
            n_sessions = 0
            n_files = 0
            
            for race_dir in os.listdir(year_path):
                race_path = os.path.join(year_path, race_dir)
                if not os.path.isdir(race_path):
                    continue
                n_races += 1
                
                for session_dir in os.listdir(race_path):
                    session_path = os.path.join(race_path, session_dir)
                    if not os.path.isdir(session_path):
                        continue
                    n_sessions += 1
                    n_files += len([f for f in os.listdir(session_path) if f.endswith(".parquet")])
            
            by_year[year] = {
                "n_races": n_races,
                "n_sessions": n_sessions,
                "n_feature_files": n_files,
            }
            total_features += n_files
        
        return {
            "total_feature_files": total_features,
            "by_year": by_year,
            "feature_types": list(FEATURE_DATASETS.keys()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}")
async def list_races(year: int) -> Dict[str, Any]:
    """List all available races for a year."""
    races = get_available_races(year)
    return {
        "year": year,
        "n_races": len(races),
        "races": races,
    }


@router.get("/features/{year}/{race}")
async def list_sessions(year: int, race: str) -> Dict[str, Any]:
    """List all available sessions for a race."""
    race_name = race.replace("-", " ")
    sessions = get_available_sessions(year, race_name)
    return {
        "year": year,
        "race": race_name,
        "n_sessions": len(sessions),
        "sessions": sessions,
    }


@router.get("/features/{year}/{race}/{session}")
async def get_session_features(
    year: int,
    race: str,
    session: str,
    feature_type: Optional[str] = None,
    sample_limit: int = Query(default=2, ge=1, le=20),
) -> Dict[str, Any]:
    """Get feature data for a race session."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")
    
    try:
        feature_files = [f for f in os.listdir(session_path) if f.endswith(".parquet")]
        
        if feature_type:
            feature_files = [f for f in feature_files if feature_type.lower() in f.lower()]
        
        features = {}
        for fname in feature_files:
            fpath = os.path.join(session_path, fname)
            conn = duckdb.connect()
            try:
                n_rows = int(conn.execute("SELECT COUNT(*) FROM read_parquet(?)", [fpath]).fetchone()[0] or 0)
                sample_df = conn.execute("SELECT * FROM read_parquet(?) LIMIT ?", [fpath, int(sample_limit)]).df()
            finally:
                conn.close()
            fname_key = fname.replace("_features.parquet", "")
            features[fname_key] = {
                "n_rows": n_rows,
                "columns": list(sample_df.columns),
                "sample": sample_df.to_dict(orient="records") if len(sample_df) > 0 else [],
            }
        
        return {
            "year": year,
            "race": race_name,
            "session": session,
            "n_features": len(features),
            "features": features,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}/{race}/{session}/lap")
async def get_lap_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get lap features for a race session."""
    return _load_named_feature(year, race, session, "lap")


@router.get("/features/{year}/{race}/{session}/tyre")
async def get_tyre_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get tyre features for a race session."""
    return _load_named_feature(year, race, session, "tyre")


@router.get("/features/{year}/{race}/{session}/comparison")
async def get_comparison_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get comparison features (head-to-head) for a race session."""
    return _load_named_feature(year, race, session, "comparison")


@router.get("/features/{year}/{race}/{session}/telemetry")
async def get_telemetry_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get telemetry features for a race session."""
    return _load_named_feature(year, race, session, "telemetry")


@router.get("/features/{year}/{race}/{session}/traffic")
async def get_traffic_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    return _load_named_feature(year, race, session, "traffic")


@router.get("/features/{year}/{race}/{session}/overtakes")
async def get_overtakes_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    return _load_named_feature(year, race, session, "overtakes")


@router.get("/features/{year}/{race}/{session}/position")
async def get_position_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    return _load_named_feature(year, race, session, "position")


@router.get("/features/{year}/{race}/{session}/points")
async def get_points_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    return _load_named_feature(year, race, session, "points")


@router.get("/features/{year}/{race}/{session}/race-context")
async def get_race_context_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    return _load_named_feature(year, race, session, "race_context")


@router.get("/features/{year}/{race}/{session}/catalog")
async def get_session_feature_catalog(
    year: int,
    race: str,
    session: str,
    sample_limit: int = Query(default=1, ge=1, le=10),
) -> Dict[str, Any]:
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")

    catalog: Dict[str, Any] = {}
    for feature_type, filename in FEATURE_DATASETS.items():
        fpath = os.path.join(session_path, filename)
        if not os.path.exists(fpath):
            continue
        conn = duckdb.connect()
        try:
            n_rows = int(conn.execute("SELECT COUNT(*) FROM read_parquet(?)", [fpath]).fetchone()[0] or 0)
            sample_df = conn.execute("SELECT * FROM read_parquet(?) LIMIT ?", [fpath, int(sample_limit)]).df()
        finally:
            conn.close()
        catalog[feature_type] = {
            "n_rows": n_rows,
            "columns": list(sample_df.columns),
            "sample": sample_df.to_dict(orient="records") if len(sample_df) > 0 else [],
        }

    return {
        "year": year,
        "race": race_name,
        "session": session,
        "features": catalog,
    }


@router.get("/features/{year}/{race}/{session}/driver-summary")
async def get_driver_summary(
    year: int,
    race: str,
    session: str,
    driver: str,
    compare: Optional[str] = None,
) -> Dict[str, Any]:
    """Compact driver summary: 1–2 features per category."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")

    def _load(name: str) -> pd.DataFrame:
        return read_parquet_df(os.path.join(session_path, name))

    lap_all_df = _load("lap_features.parquet")
    lap_df = _filter_driver(lap_all_df, driver)
    pos_df = _filter_driver(_load("position_features.parquet"), driver)
    tyre_df = _filter_driver(_load("tyre_features.parquet"), driver)
    tel_df = _filter_driver(_load("telemetry_features.parquet"), driver)
    traffic_df = _filter_driver(_load("traffic_features.parquet"), driver)
    points_df = _filter_driver(_load("points_features.parquet"), driver)
    over_df = _filter_driver(_load("overtakes_features.parquet"), driver)
    race_ctx_df = _load("race_context_features.parquet")

    lap_row = _latest_row(lap_df, "lap_number")
    tyre_row = _latest_row(tyre_df, "stint_number")
    pos_row = pos_df.iloc[0].to_dict() if not pos_df.empty else {}
    race_row = _latest_row(race_ctx_df, "lap_number")
    points_row = points_df.iloc[0].to_dict() if not points_df.empty else {}
    over_row = over_df.iloc[0].to_dict() if not over_df.empty else {}

    personal_best = _min(lap_df, "lap_duration")
    session_best = _min(lap_all_df, "lap_duration")

    summary = {
        "driver": driver,
        "compare": compare or "",
        "lap_analysis": {
            "last_lap_time": lap_row.get("lap_time_formatted"),
            "sector_times": [lap_row.get("sector_1_time"), lap_row.get("sector_2_time"), lap_row.get("sector_3_time")],
            "is_valid": lap_row.get("is_valid_lap"),
            "lap_quality_score": lap_row.get("lap_quality_score"),
            "lap_delta_to_leader": lap_row.get("lap_delta_to_leader"),
            "track_status_at_lap": lap_row.get("track_status_at_lap"),
            "tyre_compound": lap_row.get("tyre_compound"),
            "tyre_age_laps": lap_row.get("tyre_age_laps"),
            "personal_best": personal_best,
            "session_best": session_best,
        },
        "driver_performance": {
            "start_position": pos_row.get("start_position"),
            "end_position": pos_row.get("end_position"),
            "position_change": pos_row.get("position_change"),
            "laps_led": pos_row.get("laps_led"),
            "best_position": pos_row.get("best_position"),
            "worst_position": pos_row.get("worst_position"),
            "points": points_row.get("points"),
            "overtakes_made": over_row.get("overtakes_made"),
            "positions_lost_defensive": over_row.get("positions_lost_defensive"),
        },
        "tyre_analysis": {
            "current_compound": tyre_row.get("tyre_compound"),
            "tyre_age": tyre_row.get("tyre_age_at_stint_end"),
            "tyre_degradation_rate": tyre_row.get("tyre_degradation_rate"),
            "tyre_life_remaining": tyre_row.get("tyre_life_remaining"),
            "pit_stop_count": tyre_row.get("pit_stop_count"),
            "tyre_strategy_sequence": tyre_row.get("tyre_strategy_sequence"),
        },
        "telemetry_analysis": {
            "speed_max": _max(tel_df, "speed_max"),
            "speed_avg": _mean(tel_df, "speed_avg"),
            "throttle_avg": _mean(tel_df, "throttle_avg"),
            "brake_avg": _mean(tel_df, "brake_avg"),
            "drs_usage_pct": _mean(tel_df, "drs_usage_pct"),
            "gear_changes": _mean(tel_df, "gear_changes"),
        },
        "race_context": {
            "track_status": race_row.get("track_status_at_lap") or race_row.get("track_status"),
            "weather": race_row.get("weather_conditions"),
            "air_temp": race_row.get("air_temperature"),
            "track_temp": race_row.get("track_temperature"),
            "wind_speed": race_row.get("wind_speed"),
            "wind_direction": race_row.get("wind_direction"),
            "humidity": race_row.get("humidity"),
            "rainfall": race_row.get("rainfall"),
        },
        "strategic_analysis": {
            "optimal_pit_window": tyre_row.get("optimal_pit_window"),
            "traffic_time_lost": (traffic_df.iloc[0].get("estimated_time_lost") if not traffic_df.empty else None),
            "tyre_degradation_rate": tyre_row.get("tyre_degradation_rate"),
            "tyre_life_remaining": tyre_row.get("tyre_life_remaining"),
        },
    }

    # Comparison block (optional)
    if compare:
        comp_df = _load("comparison_features.parquet")
        if not comp_df.empty:
            d = str(driver).upper()
            c = str(compare).upper()
            match = comp_df[(comp_df["driver_1"].str.upper() == d) & (comp_df["driver_2"].str.upper() == c)]
            invert = False
            if match.empty:
                match = comp_df[(comp_df["driver_1"].str.upper() == c) & (comp_df["driver_2"].str.upper() == d)]
                invert = True
            if not match.empty:
                row = match.iloc[0]
                delta = row.get("pace_delta_seconds")
                if invert and delta is not None:
                    delta = -float(delta)
                summary["comparison"] = {
                    "pace_delta_seconds": delta,
                    "head_to_head_winner": row.get("head_to_head_winner"),
                }

    return summary
