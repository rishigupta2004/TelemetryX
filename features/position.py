"""Position progression tracking."""

from features.utils import load_session, save_features, ensure_driver_identity
import pandas as pd


def build_position_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Track position changes per driver."""
    data = load_session(year, race, session)
    laps = data.get("laps", pd.DataFrame())
    if not laps.empty and "position" in laps.columns:
        laps = ensure_driver_identity(laps)
        result = laps.groupby("driver_name").agg(
            start_position=("position", "first"),
            end_position=("position", "last"),
            position_change=("position", lambda x: x.iloc[0] - x.iloc[-1]),
            total_laps=("lap_number", "count"),
            best_position=("position", "min"),
            worst_position=("position", "max"),
        ).reset_index()

        laps_led = laps[laps["position"] == 1].groupby("driver_name").size().reset_index(name="laps_led")
        result = result.merge(laps_led, on="driver_name", how="left")
        result["laps_led"] = result["laps_led"].fillna(0).astype(int)
    else:
        pos = data.get("positions", pd.DataFrame())
        if pos.empty:
            return pd.DataFrame()
        pos = ensure_driver_identity(pos)
        pos = pos.sort_values(["driver_number", "date"])
        result = pos.groupby("driver_name").agg(
            start_position=("position", "first"),
            end_position=("position", "last"),
            position_change=("position", lambda x: x.iloc[0] - x.iloc[-1]),
        ).reset_index()
        result["total_laps"] = None
        result["best_position"] = pos.groupby("driver_name")["position"].min().values
        result["worst_position"] = pos.groupby("driver_name")["position"].max().values
        result["laps_led"] = (pos["position"] == 1).groupby(pos["driver_name"]).sum().values
    
    result["year"] = year
    result["race_name"] = race
    result["session"] = session.upper()
    return result


def run(year: int, race: str, session: str):
    f = build_position_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "position_features")
    return f
