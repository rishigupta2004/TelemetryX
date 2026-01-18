"""Lap features engineering."""

from features.utils import load_session, save_features, tdelta_to_seconds
import pandas as pd
import numpy as np

TRACK_STATUS = {"1": "GREEN", "2": "YELLOW", "4": "RED_FLAG", "5": "VSC", "6": "SAFETY_CAR", "7": "VSC_ENDING"}
DELETION_MAP = {"acar": "Track Limits", "failed_to_set_personal_best": "Personal Best Failed",
                "yle": "Yellow Flag", "ttr": "Track Limits", "sp": "Spun", "dnf": "Did Not Finish"}


def build_lap_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build comprehensive lap features."""
    data = load_session(year, race, session)
    if "laps" not in data:
        return pd.DataFrame()

    df = data["laps"].copy()
    df["year"], df["race_name"], df["session"] = year, race, session.upper()

    for i, col in enumerate(["Sector1SessionTime", "Sector2SessionTime", "Sector3SessionTime"], 1):
        if col in df.columns:
            df[f"sector_{i}_time"] = df[col].apply(tdelta_to_seconds)

    df["lap_duration"] = df["lap_time_seconds"]

    valid = df[df["is_valid_lap"] == True].copy()
    if not valid.empty:
        driver_best = valid.groupby("driver_name")["lap_time_seconds"].min().to_dict()
        session_best = valid["lap_time_seconds"].min()

        df["lap_quality_score"] = df.apply(
            lambda r: 0 if r.get("is_deleted") or pd.isna(r.get("lap_time_seconds"))
            else max(0, min(100, 100 - ((r["lap_time_seconds"] - driver_best.get(r.get("driver_name"), session_best)) /
            driver_best.get(r.get("driver_name"), session_best) * 100 * 0.5 +
            (r["lap_time_seconds"] - session_best) / session_best * 100 * 0.5))), axis=1)
        df["lap_delta_to_leader"] = df["lap_time_seconds"] - session_best

    if "track_status_code" in df.columns:
        df["track_status_at_lap"] = df["track_status_code"].map(
            lambda x: TRACK_STATUS.get(str(x), "UNKNOWN") if pd.notna(x) else None)

    cols = ["year", "race_name", "session", "driver_name", "driver_number", "lap_number",
            "lap_duration", "lap_quality_score", "sector_1_time", "sector_2_time", "sector_3_time",
            "is_valid_lap", "is_deleted", "deletion_reason", "personal_best", "session_best",
            "lap_delta_to_leader", "track_status_at_lap", "team_name", "position",
            "tyre_compound", "tyre_age_laps"]
    return df[[c for c in cols if c in df.columns]]


def run(year: int, race: str, session: str):
    f = build_lap_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "lap_features")
    return f


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build Lap Features")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="Q")
    args = parser.parse_args()
    run(args.year, args.race, args.session)
