"""Traffic impact analysis."""

from features.utils import load_session, save_features, ensure_driver_identity
import pandas as pd


def build_traffic_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Calculate time lost due to traffic."""
    data = load_session(year, race, session)
    laps = data.get("laps", pd.DataFrame())
    if laps.empty:
        return pd.DataFrame()

    if "is_valid_lap" in laps.columns:
        valid = laps[laps["is_valid_lap"] == True].copy()
        if valid.empty:
            valid = laps.copy()
    else:
        valid = laps.copy()
    valid = ensure_driver_identity(valid)
    if valid.empty:
        return pd.DataFrame()
    if "lap_time_seconds" not in valid.columns and "lap_duration" in valid.columns:
        valid["lap_time_seconds"] = valid["lap_duration"]

    def traffic_stats(group: pd.DataFrame) -> pd.Series:
        times = group["lap_time_seconds"].dropna()
        if times.empty:
            return pd.Series({"avg_lap_time": None, "fastest_lap_time": None, "laps_in_traffic": 0, "estimated_time_lost": 0})
        median = times.median()
        iqr = times.quantile(0.75) - times.quantile(0.25)
        threshold = max(median * 1.02, median + 1.5 * iqr)
        traffic_laps = times[times > threshold]
        return pd.Series({
            "avg_lap_time": float(times.mean()),
            "fastest_lap_time": float(times.min()),
            "laps_in_traffic": int(len(traffic_laps)),
            "estimated_time_lost": float((traffic_laps - median).sum()),
        })

    result = valid.groupby("driver_name").apply(traffic_stats).reset_index()
    result["year"], result["race_name"], result["session"] = year, race, session.upper()
    return result


def run(year: int, race: str, session: str):
    f = build_traffic_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "traffic_features")
    return f
