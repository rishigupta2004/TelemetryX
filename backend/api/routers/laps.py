from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..config import SILVER_DIR
from ..utils import normalize_session_code, read_parquet_df, resolve_dir

router = APIRouter()

VALID_SESSIONS = {
    "R",
    "Q",
    "SQ",
    "S",
    "FP1",
    "FP2",
    "FP3",
    "SS",
    "FP",
    "SQ1",
    "SQ2",
    "SQ3",
    "Q1",
    "Q2",
    "Q3",
}
VALID_YEARS = set(range(2018, 2026))
MAX_ROUND_LENGTH = 200


def _validate_year(year: int) -> int:
    if year not in VALID_YEARS:
        raise HTTPException(400, f"Invalid year. Must be one of: {sorted(VALID_YEARS)}")
    return year


def _validate_session(session: Optional[str]) -> Optional[str]:
    if session is None:
        return session
    normalized = session.upper().strip()
    if normalized and normalized not in VALID_SESSIONS:
        raise HTTPException(
            400, f"Invalid session type. Must be one of: {sorted(VALID_SESSIONS)}"
        )
    return normalized


def _validate_round(round: str) -> str:
    if ".." in round or "/" in round or "\\" in round:
        raise HTTPException(400, "Invalid round parameter: path traversal not allowed")
    if len(round) > MAX_ROUND_LENGTH:
        raise HTTPException(
            400, f"Round parameter exceeds maximum length of {MAX_ROUND_LENGTH}"
        )
    return round


def _resolve_session_dir(
    year: int, race_name: str, session_type: Optional[str]
) -> Optional[Tuple[str, str]]:
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return None

    if session_type:
        sess = normalize_session_code(session_type)
        path = os.path.join(year_path, race_dir, sess)
        return (race_dir, path) if os.path.exists(path) else None

    # Default: prefer Qualifying, then Race, then Sprint, then Sprint Shootout.
    for sess in ("Q", "R", "S", "SS"):
        path = os.path.join(year_path, race_dir, sess)
        if os.path.exists(path):
            return race_dir, path
    return None


def _laps_df(year: int, race_slug: str, session_type: Optional[str]) -> pd.DataFrame:
    race_name = race_slug.replace("-", " ")
    resolved = _resolve_session_dir(year, race_name, session_type)
    if not resolved:
        return pd.DataFrame()
    _race_dir, silver_path = resolved
    laps_file = os.path.join(silver_path, "laps.parquet")
    return read_parquet_df(laps_file)


def _is_quali_like(session_type: Optional[str]) -> bool:
    code = normalize_session_code(session_type) if session_type else ""
    return code in {"Q", "S"}


def _segment_labels(session_type: Optional[str]) -> List[str]:
    return (
        ["SQ1", "SQ2", "SQ3"]
        if normalize_session_code(session_type) == "S"
        else ["Q1", "Q2", "Q3"]
    )


def _assign_segment(
    end_time_s: float, cuts: Tuple[float, float], labels: List[str]
) -> str:
    if end_time_s < cuts[0]:
        return labels[0]
    if end_time_s < cuts[1]:
        return labels[1]
    return labels[2]


def _with_segments(df: pd.DataFrame, session_type: Optional[str]) -> pd.DataFrame:
    if df.empty or not _is_quali_like(session_type):
        return df
    if "segment" in df.columns:
        return df
    if "session_time_seconds" not in df.columns:
        return df

    times = pd.to_numeric(df["session_time_seconds"], errors="coerce").dropna()
    if times.empty:
        return df
    t_min = float(times.min())
    t_max = float(times.max())
    if t_max <= t_min:
        return df
    span = t_max - t_min
    cuts = (t_min + span / 3.0, t_min + 2.0 * span / 3.0)
    labels = _segment_labels(session_type)

    out = df.copy()
    out["segment"] = [
        _assign_segment(float(t), cuts, labels) if pd.notna(t) else ""
        for t in pd.to_numeric(out["session_time_seconds"], errors="coerce")
    ]
    return out


def _driver_filter_mask(df: pd.DataFrame, driver_id: str) -> Optional[pd.Series]:
    mask = None
    if "driver_name" in df.columns:
        mask = df["driver_name"].astype(str) == str(driver_id)
    if "driver_number" in df.columns:
        by_number = df["driver_number"].astype(str) == str(driver_id)
        mask = by_number if mask is None else (mask | by_number)
    return mask


def _lap_sort(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    by = []
    if "lap_time_seconds" in df.columns:
        by.append("lap_time_seconds")
    if "lap_number" in df.columns:
        by.append("lap_number")
    if not by:
        return df
    return df.sort_values(by, na_position="last")


def _pick_selected_lap(
    df: pd.DataFrame, lap_number: Optional[int]
) -> Optional[Dict[str, Any]]:
    if df.empty:
        return None
    selected = df
    if lap_number is not None and "lap_number" in selected.columns:
        selected = selected[selected["lap_number"].astype("Int64") == int(lap_number)]
        if selected.empty:
            return None
    selected = _lap_sort(selected)
    if selected.empty:
        return None
    return selected.iloc[0].to_dict()


@router.get("/laps/{year}/{round}")
async def get_laps(
    year: int,
    round: str,
    valid_only: bool = Query(default=False),
    session_type: Optional[str] = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=20000),
) -> List[Dict[str, Any]]:
    """Return lap rows (schema depends on source/parquet)."""
    _validate_year(year)
    _validate_round(round)
    session_type = _validate_session(session_type)
    df = _laps_df(year, round, session_type)
    if df.empty:
        return []
    if valid_only and "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712
    if len(df) > int(limit):
        df = df.head(int(limit))
    return df.to_dict(orient="records")


@router.get("/laps/{year}/{round}/summary")
async def get_laps_summary(
    year: int,
    round: str,
    session_type: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    """Lightweight lap summary for fast initial table render."""
    _validate_year(year)
    _validate_round(round)
    session_type = _validate_session(session_type)
    df = _laps_df(year, round, session_type)
    if df.empty:
        return {"session_info": {"total_laps": 0, "drivers": 0}, "laps": []}

    summary_cols = [
        "driver_number",
        "driver_name",
        "lap_number",
        "lap_time_seconds",
        "position",
        "is_valid_lap",
    ]
    cols = [c for c in summary_cols if c in df.columns]
    if cols:
        summary = df[cols]
    else:
        summary = df
    if "lap_number" in summary.columns:
        summary = summary.sort_values(
            ["driver_number", "lap_number"], na_position="last"
        )

    total_laps = (
        int(df["lap_number"].max())
        if "lap_number" in df.columns and not df["lap_number"].isna().all()
        else 0
    )
    drivers = int(df["driver_number"].nunique()) if "driver_number" in df.columns else 0
    return {
        "session_info": {"total_laps": total_laps, "drivers": drivers},
        "laps": summary.to_dict(orient="records"),
    }


@router.get("/laps/{year}/{round}/head-to-head")
async def get_head_to_head(
    year: int,
    round: str,
    driver1: str,
    driver2: str,
    session_type: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    """Fastest-lap comparison between two drivers."""
    _validate_year(year)
    _validate_round(round)
    session_type = _validate_session(session_type)
    df = _laps_df(year, round, session_type=session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")
    if "lap_time_seconds" not in df.columns:
        raise HTTPException(status_code=422, detail="Missing lap_time_seconds")

    # Filter to just the two drivers (by name or number) and valid laps if available.
    mask = pd.Series([False] * len(df))
    if "driver_name" in df.columns:
        mask = (
            mask
            | (df["driver_name"].astype(str) == driver1)
            | (df["driver_name"].astype(str) == driver2)
        )
    if "driver_number" in df.columns:
        mask = (
            mask
            | (df["driver_number"].astype(str) == str(driver1))
            | (df["driver_number"].astype(str) == str(driver2))
        )
    df = df[mask]
    if "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712

    group_cols = [c for c in ("driver_name", "driver_number") if c in df.columns]
    if not group_cols:
        raise HTTPException(status_code=422, detail="Missing driver identity columns")

    fastest = (
        df.groupby(group_cols)["lap_time_seconds"]
        .min()
        .reset_index()
        .sort_values("lap_time_seconds")
    )
    if len(fastest) < 2:
        raise HTTPException(
            status_code=404, detail="Could not find both drivers with valid laps"
        )

    a = fastest.iloc[0].to_dict()
    b = fastest.iloc[1].to_dict()
    diff = float(b["lap_time_seconds"]) - float(a["lap_time_seconds"])

    def _fmt(seconds: float) -> str:
        m = int(seconds // 60)
        s = seconds % 60
        return f"{m}:{s:06.3f}"

    return {
        "driver_1": {
            "name": str(a.get("driver_name") or ""),
            "number": int(a.get("driver_number") or 0),
            "fastest_lap_formatted": _fmt(float(a["lap_time_seconds"])),
            "fastest_lap_seconds": float(a["lap_time_seconds"]),
        },
        "driver_2": {
            "name": str(b.get("driver_name") or ""),
            "number": int(b.get("driver_number") or 0),
            "fastest_lap_formatted": _fmt(float(b["lap_time_seconds"])),
            "fastest_lap_seconds": float(b["lap_time_seconds"]),
        },
        "difference_seconds": diff,
        "difference": f"{diff:+.3f}",
        "interpretation": f"{b.get('driver_name') or b.get('driver_number')} is {diff:.3f}s slower than {a.get('driver_name') or a.get('driver_number')}",
    }


@router.get("/laps/{year}/{round}/{driver_id}")
async def get_driver_laps(
    year: int,
    round: str,
    driver_id: str,
    valid_only: bool = Query(default=False),
    session_type: Optional[str] = Query(default=None),
    segment: Optional[str] = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=10000),
) -> List[Dict[str, Any]]:
    df = _laps_df(year, round, session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")

    df = _with_segments(df, session_type)
    driver_mask = _driver_filter_mask(df, driver_id)
    if driver_mask is None:
        return []

    df = df[driver_mask]
    if valid_only and "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712
    if segment and "segment" in df.columns:
        df = df[df["segment"].astype(str).str.upper() == str(segment).upper()]
    if "lap_number" in df.columns and "lap_time_seconds" in df.columns:
        df = _lap_sort(df)
    elif "lap_number" in df.columns:
        df = df.sort_values("lap_number")
    if len(df) > int(limit):
        df = df.head(int(limit))
    return df.to_dict(orient="records")


@router.get("/laps/{year}/{round}/{driver_id}/selection")
async def get_driver_lap_selection(
    year: int,
    round: str,
    driver_id: str,
    session_type: Optional[str] = Query(default=None),
    segment: Optional[str] = Query(default=None),
    lap_number: Optional[int] = Query(default=None, ge=1),
    valid_only: bool = Query(default=True),
    limit: int = Query(default=400, ge=1, le=5000),
) -> Dict[str, Any]:
    df = _laps_df(year, round, session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")

    df = _with_segments(df, session_type)
    driver_mask = _driver_filter_mask(df, driver_id)
    if driver_mask is None:
        return {"driver": str(driver_id), "segments": [], "selected": None, "laps": []}

    df = df[driver_mask]
    if valid_only and "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712
    if segment and "segment" in df.columns:
        df = df[df["segment"].astype(str).str.upper() == str(segment).upper()]

    sorted_df = _lap_sort(df)
    if len(sorted_df) > int(limit):
        sorted_df = sorted_df.head(int(limit))

    selected = _pick_selected_lap(sorted_df, lap_number)
    segments = []
    if "segment" in sorted_df.columns:
        segments = sorted(
            {str(s) for s in sorted_df["segment"].dropna().tolist() if str(s)}
        )

    return {
        "driver": str(driver_id),
        "segment": str(segment or ""),
        "segments": segments,
        "selected": selected,
        "laps": sorted_df.to_dict(orient="records"),
    }


@router.get("/laps/{year}/{round}/gap-analysis")
async def get_gap_analysis(
    year: int,
    round: str,
    session_type: str = Query(default="R"),
) -> Dict[str, Any]:
    """Gap-to-leader per lap (race trace style)."""
    _validate_year(year)
    _validate_round(round)
    session_type = _validate_session(session_type)
    df = _laps_df(year, round, session_type=session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")
    required = {"driver_number", "lap_number", "lap_time_seconds"}
    if not required.issubset(set(df.columns)):
        raise HTTPException(
            status_code=422, detail="Missing required lap columns for gap analysis"
        )

    df = df.dropna(subset=["driver_number", "lap_number", "lap_time_seconds"])
    df = df.sort_values(["driver_number", "lap_number"])
    df["race_time"] = df.groupby("driver_number")["lap_time_seconds"].cumsum()

    leader = (
        df.groupby("lap_number")["race_time"].min().rename("leader_time").reset_index()
    )
    merged = df.merge(leader, on="lap_number", how="left")
    merged["gap_to_leader"] = merged["race_time"] - merged["leader_time"]

    name_col = "driver_name" if "driver_name" in merged.columns else None
    driver_keys = (
        merged[name_col].unique().tolist()
        if name_col
        else merged["driver_number"].unique().tolist()
    )

    out: Dict[str, Any] = {"drivers": [], "data": {}}
    for drv in driver_keys:
        if name_col:
            ddf = merged[merged[name_col] == drv]
            key = str(drv)
        else:
            ddf = merged[merged["driver_number"] == drv]
            key = str(int(drv))
        cols = ["lap_number", "gap_to_leader"]
        if "position" in ddf.columns:
            cols.append("position")
        out["drivers"].append(key)
        out["data"][key] = ddf[cols].to_dict(orient="records")
    return out
