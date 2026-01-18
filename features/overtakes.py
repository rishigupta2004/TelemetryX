"""Overtake tracking."""

from features.utils import load_session, save_features
import pandas as pd


def build_overtake_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Analyze overtakes and position changes."""
    data = load_session(year, race, session)
    pos = data.get("positions", pd.DataFrame())
    if pos.empty:
        return pd.DataFrame()

    pos = pos.sort_values(["driver_number", "date"])
    pos["pos_change"] = pos.groupby("driver_number")["position"].diff()

    result = pos.groupby("driver_number").agg({
        "pos_change": lambda x: (x < 0).sum()
    }).reset_index()
    result.columns = ["driver_number", "overtakes_made"]
    result["positions_lost_defensive"] = pos.groupby("driver_number")["pos_change"].apply(lambda x: (x > 0).sum()).values
    result["net_position_change"] = pos.groupby("driver_number")["pos_change"].sum().values
    result["year"], result["race_name"], result["session"] = year, race, session.upper()
    return result


def run(year: int, race: str, session: str):
    f = build_overtake_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "overtake_features")
    return f
