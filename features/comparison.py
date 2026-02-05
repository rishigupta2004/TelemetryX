"""Comparison features."""

from features.utils import load_session, save_features, ensure_driver_identity
import pandas as pd


def build_comparison_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build head-to-head comparison features."""
    data = load_session(year, race, session)
    if "laps" not in data:
        return pd.DataFrame()

    laps = data["laps"].copy()
    if "is_valid_lap" in laps.columns:
        valid = laps[laps["is_valid_lap"] == True].copy()
        if valid.empty:
            valid = laps
    else:
        valid = laps
    valid = ensure_driver_identity(valid)
    if valid.empty:
        return pd.DataFrame()
    if "lap_time_seconds" not in valid.columns and "lap_duration" in valid.columns:
        valid["lap_time_seconds"] = valid["lap_duration"]
    if "lap_time_seconds" not in valid.columns:
        return pd.DataFrame()

    stats = valid.groupby("driver_name").agg({
        "lap_time_seconds": ["mean", "median", "min", "std", "count"]
    }).reset_index()
    stats.columns = ["driver_name", "avg_lap", "median_lap", "min_lap", "std_lap", "count"]
    if "team_name" in valid.columns:
        stats["team"] = valid.groupby("driver_name")["team_name"].first().values
    else:
        stats["team"] = None

    result = []
    for i, drv1 in enumerate(stats["driver_name"]):
        for drv2 in stats["driver_name"].iloc[i+1:]:
            d1, d2 = stats[stats["driver_name"] == drv1].iloc[0], stats[stats["driver_name"] == drv2].iloc[0]
            delta = d1["median_lap"] - d2["median_lap"]
            pace_delta_pct = (delta / d2["median_lap"]) * 100 if d2["median_lap"] else None
            result.append({
                "year": year, "race_name": race, "session": session.upper(),
                "driver_1": drv1, "driver_2": drv2,
                "driver_1_team": d1["team"], "driver_2_team": d2["team"],
                "pace_delta_seconds": delta,
                "pace_delta_pct": pace_delta_pct,
                "driver_1_avg_pace": d1["avg_lap"], "driver_2_avg_pace": d2["avg_lap"],
                "driver_1_median_pace": d1["median_lap"], "driver_2_median_pace": d2["median_lap"],
                "driver_1_min_lap": d1["min_lap"], "driver_2_min_lap": d2["min_lap"],
                "driver_1_consistency": d1["std_lap"], "driver_2_consistency": d2["std_lap"],
                "head_to_head_winner": drv1 if delta < 0 else drv2 if delta > 0 else "TIED",
                "same_team": 1 if d1["team"] == d2["team"] else 0,
            })
    return pd.DataFrame(result)


def run(year: int, race: str, session: str):
    f = build_comparison_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "comparison_features")
    return f


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build Comparison Features")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="R")
    args = parser.parse_args()
    run(args.year, args.race, args.session)
