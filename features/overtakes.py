"""Overtake tracking."""

from features.utils import load_session, save_features, ensure_driver_identity
import pandas as pd


def build_overtake_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Analyze overtakes and position changes."""
    data = load_session(year, race, session)
    laps = data.get("laps", pd.DataFrame())
    if not laps.empty and "position" in laps.columns:
        laps = ensure_driver_identity(laps)
        laps = laps.sort_values(["driver_name", "lap_number"]).copy()
        pit_flags = pd.DataFrame(index=laps.index)
        pit_in_cols = [c for c in ["pit_in_time_formatted", "pit_in_time", "PitInTime"] if c in laps.columns]
        pit_out_cols = [c for c in ["pit_out_time_formatted", "pit_out_time", "PitOutTime"] if c in laps.columns]
        pit_flags["is_pit_lap"] = False
        if pit_in_cols:
            pit_flags["is_pit_lap"] |= laps[pit_in_cols].notna().any(axis=1)
        if pit_out_cols:
            pit_flags["is_pit_lap"] |= laps[pit_out_cols].notna().any(axis=1)
        laps = pd.concat([laps, pit_flags], axis=1)
        laps["pos_change"] = laps.groupby("driver_name")["position"].diff()
        laps.loc[laps["is_pit_lap"] == True, "pos_change"] = 0

        result = laps.groupby(["driver_name", "driver_number"]).agg(
            overtakes_made=("pos_change", lambda x: (x < 0).sum()),
            positions_lost_defensive=("pos_change", lambda x: (x > 0).sum()),
            net_position_change=("pos_change", "sum"),
        ).reset_index()
        result["year"], result["race_name"], result["session"] = year, race, session.upper()
        return result

    pos = data.get("positions", pd.DataFrame())
    if pos.empty:
        return pd.DataFrame()

    pos = ensure_driver_identity(pos)
    pos = pos.sort_values(["driver_number", "date"]).copy()
    pos["pos_change"] = pos.groupby("driver_number")["position"].diff()

    result = pos.groupby("driver_number").agg(
        overtakes_made=("pos_change", lambda x: (x < 0).sum()),
        positions_lost_defensive=("pos_change", lambda x: (x > 0).sum()),
        net_position_change=("pos_change", "sum"),
    ).reset_index()
    result["driver_name"] = result["driver_number"].astype(str)
    result["year"], result["race_name"], result["session"] = year, race, session.upper()
    return result


def run(year: int, race: str, session: str):
    f = build_overtake_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "overtakes_features")
    return f
