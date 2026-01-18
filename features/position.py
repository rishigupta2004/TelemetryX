"""Position progression tracking."""

from features.utils import load_session, save_features
import pandas as pd


def build_position_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Track position changes per driver."""
    data = load_session(year, race, session)
    laps = data.get("laps", pd.DataFrame())
    if laps.empty:
        return pd.DataFrame()
    
    result = laps.groupby("driver_name").agg(
        start_position=("position", "first"),
        end_position=("position", "last"),
        position_change=("position", lambda x: x.iloc[0] - x.iloc[-1]),
        total_laps=("lap_number", "count"),
        best_position=("position", "min"),
        worst_position=("position", "max"),
    ).reset_index()
    
    # Calculate laps led
    laps_led = laps[laps["position"] == 1].groupby("driver_name").size().reset_index(name="laps_led")
    result = result.merge(laps_led, on="driver_name", how="left")
    result["laps_led"] = result["laps_led"].fillna(0).astype(int)
    
    result["year"] = year
    result["race_name"] = race
    result["session"] = session.upper()
    return result


def run(year: int, race: str, session: str):
    f = build_position_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "position_features")
    return f
