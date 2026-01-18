"""Tyre features engineering."""

from features.utils import load_session, save_features
import pandas as pd
import numpy as np

TYRE_LIFE = {"SOFT": 18, "MEDIUM": 28, "HARD": 35, "INTERMEDIATE": 15, "WET": 10, "HYPERSOFT": 12, "ULTRASOFT": 14, "SUPERSOFT": 16}
TYRE_TEMP_BASE = {"SOFT": 110, "MEDIUM": 100, "HARD": 90, "INTERMEDIATE": 85, "WET": 80, "HYPERSOFT": 115, "ULTRASOFT": 112, "SUPERSOFT": 108}
GRIP_LEVEL = {"SOFT": 0.85, "MEDIUM": 0.75, "HARD": 0.65, "INTERMEDIATE": 0.55, "WET": 0.40, "HYPERSOFT": 0.90, "ULTRASOFT": 0.88, "SUPERSOFT": 0.82}


def build_tyre_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build tyre features for all drivers."""
    data = load_session(year, race, session)
    if "laps" not in data:
        return pd.DataFrame()

    laps_df = data["laps"]
    valid = laps_df[laps_df["is_valid_lap"] == True].copy().sort_values("lap_number")
    if valid.empty:
        return pd.DataFrame()

    # Pre-calculate traffic, position, gaps, overtakes per driver
    traffic = valid.groupby("driver_name").apply(
        lambda d: np.mean([len(d[(abs(d["lap_time_seconds"] - t) <= 2) & (d["driver_name"] != drv)]) 
                          for drv, t in zip(d["driver_name"], d["lap_time_seconds"])]) if len(d) > 1 else 0)
    traffic = traffic.to_dict() if hasattr(traffic, 'to_dict') else dict(traffic)

    position = valid.groupby("driver_name")["position"].first().to_dict()
    gaps_ahead = {drv: np.nan for drv in valid["driver_name"].unique()}
    gaps_behind = {drv: np.nan for drv in valid["driver_name"].unique()}
    overtake_laps = valid.groupby("driver_name").apply(
        lambda d: (d["position"].diff() < 0).sum() if len(d) > 1 else 0).to_dict()

    result = []
    for drv in valid["driver_name"].unique():
        drv_laps = valid[valid["driver_name"] == drv].copy()
        stint_col = "is_pit_out_lap" if "is_pit_out_lap" in drv_laps.columns else "tyre_compound"
        drv_laps["stint"] = ((drv_laps.get("is_pit_out_lap", False) == True) |
                            (drv_laps["tyre_compound"] != drv_laps["tyre_compound"].shift())).cumsum()

        for stint_num, stint in drv_laps.groupby("stint"):
            if stint.empty:
                continue
            stint = stint.sort_values("lap_number")
            compound, age_start = stint["tyre_compound"].iloc[0], stint.get("tyre_age_laps", pd.Series([0])).iloc[0]
            laps = len(stint)
            age_end = stint.get("tyre_age_laps", pd.Series([age_start + i for i in range(len(stint))])).iloc[-1]
            deg = np.polyfit(range(len(stint)), stint["lap_time_seconds"].dropna(), 1)[0] if len(stint) >= 3 and not stint["lap_time_seconds"].dropna().empty else 0
            deg = max(0, deg)
            pit_laps = stint[stint.get("is_pit_out_lap", pd.Series([False])) == True]

            life = TYRE_LIFE.get(compound.upper(), 20)
            pred_len = age_start + max(5, life - age_start)

            result.append({
                "year": year, "race_name": race, "session": session.upper(),
                "driver_name": drv, "driver_number": stint["driver_number"].iloc[0],
                "stint_number": int(stint_num), "tyre_compound": compound,
                "tyre_age_at_stint_start": age_start, "tyre_age_at_stint_end": age_end,
                "tyre_laps_in_stint": laps,
                "tyre_degradation_rate": deg,
                "pit_stop_count": len(pit_laps),
                "first_lap": stint["lap_number"].iloc[0], "last_lap": stint["lap_number"].iloc[-1],
                "estimated_tyre_temp": min(140, max(60, TYRE_TEMP_BASE.get(compound.upper(), 100) + deg * 50 + min(laps * 0.5, 20))),
                "grip_level": round(max(0.1, min(1.0, GRIP_LEVEL.get(compound.upper(), 0.7) * max(0, 1 - age_start / 30) * max(0, 1 - deg * 10))), 3),
                "traffic_density": traffic.get(drv, 0),
                "position": position.get(drv, np.nan),
                "is_overtake_lap": overtake_laps.get(drv, 0),
                "tyre_gap_ahead": gaps_ahead.get(drv, np.nan),
                "tyre_gap_behind": gaps_behind.get(drv, np.nan),
            })

    df = pd.DataFrame(result)
    if not df.empty:
        df["tyre_strategy_sequence"] = df.groupby("driver_name")["tyre_compound"].transform(lambda x: "→".join(x))
    return df


def run(year: int, race: str, session: str):
    f = build_tyre_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "tyre_features")
    return f


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build Tyre Features")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="R")
    args = parser.parse_args()
    run(args.year, args.race, args.session)
