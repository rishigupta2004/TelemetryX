"""Points calculation."""

from features.utils import load_session, save_features
import pandas as pd

POINTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}


def build_points_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Calculate points earned per driver."""
    data = load_session(year, race, session)
    laps = data.get("laps", pd.DataFrame())
    if laps.empty:
        return pd.DataFrame()

    final = laps.groupby("driver_name").agg(
        final_position=("position", "last"),
        total_laps=("lap_number", "count"),
    ).reset_index()

    final["points"] = final["final_position"].map(lambda x: POINTS.get(int(x), 0) if x <= 10 else 0)
    final["year"], final["race_name"], final["session"] = year, race, session.upper()
    return final


def run(year: int, race: str, session: str):
    f = build_points_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "points_features")
    return f
