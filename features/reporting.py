"""Feature reporting and summaries."""

from pathlib import Path
import json
import pandas as pd
from typing import Dict, List, Optional, Tuple

from features.utils import FEATURES_PATH, tdelta_to_formatted

OUTPUTS_PATH = FEATURES_PATH / "presentations"


def load_feature_frames(
    feature_name: str,
    year: Optional[int] = None,
    race: Optional[str] = None,
    session: Optional[str] = None,
) -> pd.DataFrame:
    if year and race and session:
        path = FEATURES_PATH / str(year) / race / session / f"{feature_name}_features.parquet"
        if not path.exists():
            return pd.DataFrame()
        df = pd.read_parquet(path)
        return df

    files = list(FEATURES_PATH.rglob(f"{feature_name}_features.parquet"))
    if not files:
        return pd.DataFrame()
    dfs = [pd.read_parquet(p) for p in files]
    df = pd.concat(dfs, ignore_index=True)
    if "year" in df.columns and year:
        df = df[df["year"] == year]
    if "race_name" in df.columns and race:
        df = df[df["race_name"] == race]
    if "session" in df.columns and session:
        df = df[df["session"] == session.upper()]
    return df


def summarize_lap_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    for col in ["lap_duration", "lap_quality_score", "is_valid_lap", "is_deleted", "sector_1_time", "sector_2_time", "sector_3_time"]:
        if col not in df.columns:
            df[col] = None
    group_cols = ["year", "race_name", "session", "driver_name"]
    if "driver_number" in df.columns:
        group_cols.append("driver_number")
    agg = df.groupby(group_cols).agg(
        avg_lap=("lap_duration", "mean"),
        best_lap=("lap_duration", "min"),
        lap_std=("lap_duration", "std"),
        valid_laps=("is_valid_lap", "sum"),
        deleted_laps=("is_deleted", "sum"),
        lap_quality_avg=("lap_quality_score", "mean"),
        lap_quality_best=("lap_quality_score", "max"),
        best_sector_1=("sector_1_time", "min"),
        best_sector_2=("sector_2_time", "min"),
        best_sector_3=("sector_3_time", "min"),
    ).reset_index()
    for col in ["valid_laps", "deleted_laps"]:
        if col in agg.columns:
            agg[col] = pd.to_numeric(agg[col], errors="coerce").fillna(0).astype(int)
    agg["lap_consistency"] = agg["lap_std"] / agg["avg_lap"]
    agg["avg_lap_formatted"] = agg["avg_lap"].apply(tdelta_to_formatted)
    agg["best_lap_formatted"] = agg["best_lap"].apply(tdelta_to_formatted)
    year_summary = agg.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        avg_lap=("avg_lap", "mean"),
        best_lap=("best_lap", "min"),
        lap_consistency=("lap_consistency", "mean"),
        avg_lap_quality=("lap_quality_avg", "mean"),
        valid_laps=("valid_laps", "sum"),
    ).reset_index()
    year_summary["avg_lap_formatted"] = year_summary["avg_lap"].apply(tdelta_to_formatted)
    year_summary["best_lap_formatted"] = year_summary["best_lap"].apply(tdelta_to_formatted)
    return agg, year_summary


def summarize_tyre_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    for col in ["stint_number", "tyre_laps_in_stint", "tyre_degradation_rate", "pit_stop_count", "grip_level", "traffic_density", "tyre_gap_ahead", "tyre_gap_behind"]:
        if col not in df.columns:
            df[col] = None
    group_cols = ["year", "race_name", "session", "driver_name"]
    agg = df.groupby(group_cols).agg(
        stints=("stint_number", "count"),
        avg_stint_length=("tyre_laps_in_stint", "mean"),
        max_stint_length=("tyre_laps_in_stint", "max"),
        avg_degradation=("tyre_degradation_rate", "mean"),
        pit_stop_count=("pit_stop_count", "sum"),
        avg_grip=("grip_level", "mean"),
        avg_traffic=("traffic_density", "mean"),
        avg_gap_ahead=("tyre_gap_ahead", "mean"),
        avg_gap_behind=("tyre_gap_behind", "mean"),
    ).reset_index()
    if "tyre_strategy_sequence" in df.columns:
        strat = df.groupby(group_cols)["tyre_strategy_sequence"].apply(lambda x: x.dropna().iloc[0] if len(x.dropna()) else None).reset_index()
        agg = agg.merge(strat, on=group_cols, how="left")
    year_summary = agg.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        stints=("stints", "sum"),
        avg_stint_length=("avg_stint_length", "mean"),
        avg_degradation=("avg_degradation", "mean"),
        pit_stop_count=("pit_stop_count", "sum"),
        avg_grip=("avg_grip", "mean"),
    ).reset_index()
    return agg, year_summary


def summarize_telemetry_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    for col in [
        "speed_max",
        "speed_avg",
        "speed_std",
        "throttle_avg",
        "throttle_std",
        "brake_avg",
        "brake_std",
        "drs_activations",
        "drs_usage_pct",
        "rpm_max",
        "gear_changes",
        "coast_pct",
        "throttle_brake_correlation",
    ]:
        if col not in df.columns:
            df[col] = None
    group_cols = ["year", "race_name", "session", "driver_name"]
    agg = df.groupby(group_cols).agg(
        speed_max=("speed_max", "max"),
        speed_avg=("speed_avg", "mean"),
        speed_std=("speed_std", "mean"),
        throttle_avg=("throttle_avg", "mean"),
        throttle_std=("throttle_std", "mean"),
        brake_avg=("brake_avg", "mean"),
        brake_std=("brake_std", "mean"),
        drs_activations=("drs_activations", "sum"),
        drs_usage_pct=("drs_usage_pct", "mean"),
        rpm_max=("rpm_max", "max"),
        gear_changes=("gear_changes", "sum"),
        coast_pct=("coast_pct", "mean"),
        throttle_brake_correlation=("throttle_brake_correlation", "mean"),
    ).reset_index()
    year_summary = agg.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        speed_max=("speed_max", "max"),
        speed_avg=("speed_avg", "mean"),
        throttle_avg=("throttle_avg", "mean"),
        brake_avg=("brake_avg", "mean"),
        drs_usage_pct=("drs_usage_pct", "mean"),
    ).reset_index()
    return agg, year_summary


def summarize_race_context_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    for col in [
        "yellow_flag_periods",
        "red_flag_periods",
        "safety_car_deployed",
        "vsc_deployed",
        "race_control_incidents",
        "air_temperature",
        "track_temperature",
        "humidity",
        "wind_speed",
        "weather_conditions",
    ]:
        if col not in df.columns:
            df[col] = None
    group_cols = ["year", "race_name", "session"]
    agg = df.groupby(group_cols).agg(
        yellow_flag_periods=("yellow_flag_periods", "sum"),
        red_flag_periods=("red_flag_periods", "sum"),
        safety_car_deployed=("safety_car_deployed", "sum"),
        vsc_deployed=("vsc_deployed", "sum"),
        race_control_incidents=("race_control_incidents", "sum"),
        air_temperature=("air_temperature", "mean"),
        track_temperature=("track_temperature", "mean"),
        humidity=("humidity", "mean"),
        wind_speed=("wind_speed", "mean"),
    ).reset_index()
    if "weather_conditions" in df.columns:
        conditions = df.groupby(group_cols)["weather_conditions"].agg(lambda x: x.dropna().iloc[0] if len(x.dropna()) else None).reset_index()
        agg = agg.merge(conditions, on=group_cols, how="left")
    year_summary = agg.groupby(["year"]).agg(
        races=("race_name", "nunique"),
        yellow_flag_periods=("yellow_flag_periods", "sum"),
        safety_car_deployed=("safety_car_deployed", "sum"),
        vsc_deployed=("vsc_deployed", "sum"),
        race_control_incidents=("race_control_incidents", "sum"),
    ).reset_index()
    return agg, year_summary


def summarize_comparison_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    df = df.copy()
    if "pace_delta_seconds" not in df.columns and "pace_delta" in df.columns:
        df["pace_delta_seconds"] = df["pace_delta"]
    if "pace_delta_formatted" not in df.columns and "pace_delta_seconds" in df.columns:
        df["pace_delta_formatted"] = df["pace_delta_seconds"].apply(tdelta_to_formatted)
    df["abs_pace_delta"] = df["pace_delta_seconds"].abs()
    race_summary = df.sort_values("abs_pace_delta", ascending=False).groupby(["year", "race_name", "session"]).head(10)
    winners = df[df["head_to_head_winner"] != "TIED"].copy()
    year_summary = winners.groupby(["year", "head_to_head_winner"]).agg(
        head_to_head_wins=("head_to_head_winner", "count"),
        avg_pace_advantage=("pace_delta_seconds", "mean"),
    ).reset_index().rename(columns={"head_to_head_winner": "driver_name"})
    return race_summary, year_summary


def summarize_position_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    race_summary = df.copy()
    year_summary = df.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        avg_start_position=("start_position", "mean"),
        avg_end_position=("end_position", "mean"),
        avg_position_change=("position_change", "mean"),
        total_laps_led=("laps_led", "sum"),
    ).reset_index()
    return race_summary, year_summary


def summarize_overtake_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    race_summary = df.copy()
    year_summary = df.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        overtakes_made=("overtakes_made", "sum"),
        positions_lost_defensive=("positions_lost_defensive", "sum"),
        net_position_change=("net_position_change", "sum"),
    ).reset_index()
    return race_summary, year_summary


def summarize_traffic_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    race_summary = df.copy()
    year_summary = df.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        avg_lap_time=("avg_lap_time", "mean"),
        total_laps_in_traffic=("laps_in_traffic", "sum"),
        estimated_time_lost=("estimated_time_lost", "sum"),
    ).reset_index()
    return race_summary, year_summary


def summarize_points_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()
    race_summary = df.copy()
    year_summary = df.groupby(["year", "driver_name"]).agg(
        races=("race_name", "nunique"),
        total_points=("points", "sum"),
        avg_finish_position=("final_position", "mean"),
    ).reset_index()
    return race_summary, year_summary


SUMMARY_BUILDERS: Dict[str, callable] = {
    "lap": summarize_lap_features,
    "tyre": summarize_tyre_features,
    "telemetry": summarize_telemetry_features,
    "race_context": summarize_race_context_features,
    "comparison": summarize_comparison_features,
    "position": summarize_position_features,
    "overtakes": summarize_overtake_features,
    "traffic": summarize_traffic_features,
    "points": summarize_points_features,
}


def write_outputs(feature_name: str, race_summary: pd.DataFrame, year_summary: pd.DataFrame) -> Dict:
    out_dir = OUTPUTS_PATH / feature_name
    out_dir.mkdir(parents=True, exist_ok=True)
    outputs = {}
    if not race_summary.empty:
        race_path = out_dir / "race_summary.parquet"
        race_summary.to_parquet(race_path, index=False)
        race_summary.to_csv(out_dir / "race_summary.csv", index=False)
        outputs["race_summary"] = str(race_path)
    if not year_summary.empty:
        year_path = out_dir / "year_summary.parquet"
        year_summary.to_parquet(year_path, index=False)
        year_summary.to_csv(out_dir / "year_summary.csv", index=False)
        outputs["year_summary"] = str(year_path)
    meta = {
        "feature": feature_name,
        "race_rows": int(len(race_summary)),
        "year_rows": int(len(year_summary)),
        "race_columns": list(race_summary.columns),
        "year_columns": list(year_summary.columns),
    }
    meta_path = out_dir / "metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    outputs["metadata"] = str(meta_path)
    return outputs


def generate_reports(
    features: Optional[List[str]] = None,
    year: Optional[int] = None,
    race: Optional[str] = None,
    session: Optional[str] = None,
) -> Dict[str, Dict]:
    features = features or list(SUMMARY_BUILDERS.keys())
    outputs = {}
    for feature_name in features:
        if feature_name not in SUMMARY_BUILDERS:
            continue
        df = load_feature_frames(feature_name, year=year, race=race, session=session)
        race_summary, year_summary = SUMMARY_BUILDERS[feature_name](df)
        outputs[feature_name] = write_outputs(feature_name, race_summary, year_summary)
    return outputs


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate feature presentations")
    parser.add_argument("--features", type=str, default="")
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--race", type=str, default=None)
    parser.add_argument("--session", type=str, default=None)
    args = parser.parse_args()

    features = [f.strip() for f in args.features.split(",") if f.strip()] if args.features else None
    generate_reports(features=features, year=args.year, race=args.race, session=args.session)
