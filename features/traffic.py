"""Traffic impact analysis."""

from features.utils import load_session, save_features
import pandas as pd


def build_traffic_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Calculate time lost due to traffic."""
    data = load_session(year, race, session)
    laps = data.get("laps", pd.DataFrame())
    if laps.empty:
        return pd.DataFrame()

    result = laps.groupby("driver_name").agg({
        "lap_time_seconds": ["mean", "min", lambda x: (x > x.mean() * 1.02).sum()]
    }).reset_index()
    result.columns = ["driver_name", "avg_lap_time", "fastest_lap_time", "laps_in_traffic"]
    result["estimated_time_lost"] = result["laps_in_traffic"] * (result["avg_lap_time"] * 0.02)
    result["year"], result["race_name"], result["session"] = year, race, session.upper()
    return result


def run(year: int, race: str, session: str):
    f = build_traffic_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "traffic_features")
    return f
