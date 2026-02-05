"""Tyre features engineering."""

from features.utils import load_session, save_features, ensure_driver_identity
import pandas as pd
import numpy as np

TYRE_LIFE = {"SOFT": 18, "MEDIUM": 28, "HARD": 35, "INTERMEDIATE": 15, "WET": 10, "HYPERSOFT": 12, "ULTRASOFT": 14, "SUPERSOFT": 16}
TYRE_TEMP_BASE = {"SOFT": 110, "MEDIUM": 100, "HARD": 90, "INTERMEDIATE": 85, "WET": 80, "HYPERSOFT": 115, "ULTRASOFT": 112, "SUPERSOFT": 108}
GRIP_LEVEL = {"SOFT": 0.85, "MEDIUM": 0.75, "HARD": 0.65, "INTERMEDIATE": 0.55, "WET": 0.40, "HYPERSOFT": 0.90, "ULTRASOFT": 0.88, "SUPERSOFT": 0.82}


def _derive_pit_flags(laps_df: pd.DataFrame) -> pd.DataFrame:
    pit_out_cols = [c for c in ["pit_out_time_formatted", "pit_out_time", "PitOutTime"] if c in laps_df.columns]
    pit_in_cols = [c for c in ["pit_in_time_formatted", "pit_in_time", "PitInTime"] if c in laps_df.columns]
    is_pit_out = pd.Series([False] * len(laps_df), index=laps_df.index)
    is_pit_in = pd.Series([False] * len(laps_df), index=laps_df.index)
    if pit_out_cols:
        is_pit_out = laps_df[pit_out_cols].notna().any(axis=1)
    if pit_in_cols:
        is_pit_in = laps_df[pit_in_cols].notna().any(axis=1)
    return pd.DataFrame({"is_pit_out_lap": is_pit_out, "is_pit_in_lap": is_pit_in})


def _lap_context(laps_df: pd.DataFrame) -> pd.DataFrame:
    if "lap_number" not in laps_df.columns or "session_time_seconds" not in laps_df.columns:
        return pd.DataFrame(columns=["driver_name", "lap_number", "gap_ahead", "gap_behind", "traffic_nearby"])
    context_rows = []
    for lap_num, group in laps_df.groupby("lap_number"):
        group = group.sort_values("position") if "position" in group.columns else group
        times = group["session_time_seconds"].to_numpy()
        gaps_ahead = [None] * len(group)
        gaps_behind = [None] * len(group)
        if len(group) > 1:
            diffs = times[:, None] - times[None, :]
            traffic = (np.abs(diffs) <= 2).sum(axis=1) - 1
            if "position" in group.columns:
                order = group["position"].to_numpy()
                idx = order.argsort()
                sorted_times = times[idx]
                gaps_ahead_arr = np.r_[np.nan, sorted_times[1:] - sorted_times[:-1]]
                gaps_behind_arr = np.r_[sorted_times[1:] - sorted_times[:-1], np.nan]
                gaps_ahead = np.empty_like(gaps_ahead_arr)
                gaps_behind = np.empty_like(gaps_behind_arr)
                gaps_ahead[idx] = gaps_ahead_arr
                gaps_behind[idx] = gaps_behind_arr
            else:
                gaps_ahead = [None] * len(group)
                gaps_behind = [None] * len(group)
        else:
            traffic = np.array([0])
        context_rows.append(pd.DataFrame({
            "driver_name": group["driver_name"].values,
            "lap_number": group["lap_number"].values,
            "gap_ahead": gaps_ahead,
            "gap_behind": gaps_behind,
            "traffic_nearby": traffic.tolist(),
        }))
    return pd.concat(context_rows, ignore_index=True) if context_rows else pd.DataFrame()


def build_tyre_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build tyre features for all drivers."""
    data = load_session(year, race, session)
    laps_df = data.get("laps", pd.DataFrame()).copy()
    stints_df = data.get("stints", pd.DataFrame()).copy()

    if laps_df.empty or "tyre_compound" not in laps_df.columns:
        if stints_df.empty:
            return pd.DataFrame()
        stints_df = ensure_driver_identity(stints_df)
        stints_df = stints_df.rename(columns={"compound": "tyre_compound"})
        stints_df["tyre_laps_in_stint"] = (stints_df["lap_end"] - stints_df["lap_start"] + 1).clip(lower=1)
        stints_df["tyre_age_at_stint_start"] = stints_df.get("tyre_age_at_start", 0)
        stints_df["tyre_age_at_stint_end"] = stints_df["tyre_age_at_stint_start"] + stints_df["tyre_laps_in_stint"] - 1
        stints_df["pit_stop_count"] = stints_df.groupby("driver_name")["stint_number"].transform("count").fillna(1).astype(int) - 1
        stints_df["year"] = year
        stints_df["race_name"] = race
        stints_df["session"] = session.upper()
        stints_df["tyre_degradation_rate"] = None
        stints_df["estimated_tyre_temp"] = None
        stints_df["grip_level"] = None
        stints_df["traffic_density"] = None
        stints_df["position"] = None
        stints_df["is_overtake_lap"] = None
        stints_df["tyre_gap_ahead"] = None
        stints_df["tyre_gap_behind"] = None
        stints_df["tyre_life_remaining"] = None
        stints_df["optimal_pit_window"] = None
        stints_df["first_lap"] = stints_df.get("lap_start")
        stints_df["last_lap"] = stints_df.get("lap_end")
        cols = [
            "year", "race_name", "session", "driver_name", "driver_number",
            "stint_number", "tyre_compound",
            "tyre_age_at_stint_start", "tyre_age_at_stint_end", "tyre_laps_in_stint",
            "tyre_degradation_rate", "pit_stop_count",
            "first_lap", "last_lap",
            "estimated_tyre_temp", "grip_level",
            "traffic_density", "position", "is_overtake_lap",
            "tyre_gap_ahead", "tyre_gap_behind",
            "tyre_life_remaining", "optimal_pit_window",
        ]
        df = stints_df[[c for c in cols if c in stints_df.columns]]
        if not df.empty:
            df["tyre_strategy_sequence"] = df.groupby("driver_name")["tyre_compound"].transform(lambda x: "→".join(x.astype(str)))
        return df

    laps_df = ensure_driver_identity(laps_df)
    pits = _derive_pit_flags(laps_df)
    laps_df = pd.concat([laps_df, pits], axis=1)
    valid = laps_df[laps_df["is_valid_lap"] == True].copy().sort_values("lap_number")
    if valid.empty:
        return pd.DataFrame()

    context = _lap_context(valid)
    traffic = context.groupby("driver_name")["traffic_nearby"].mean().to_dict() if not context.empty else {}
    gaps_ahead = context.groupby("driver_name")["gap_ahead"].mean().to_dict() if not context.empty else {}
    gaps_behind = context.groupby("driver_name")["gap_behind"].mean().to_dict() if not context.empty else {}
    position = valid.groupby("driver_name")["position"].first().to_dict() if "position" in valid.columns else {}
    overtake_laps = valid.groupby("driver_name").apply(
        lambda d: (d["position"].diff() < 0).sum() if "position" in d.columns else 0).to_dict()

    result = []
    for drv in valid["driver_name"].unique():
        drv_laps = valid[valid["driver_name"] == drv].copy()
        if "stint_number" in drv_laps.columns:
            drv_laps["stint"] = drv_laps["stint_number"]
        else:
            compound_change = drv_laps["tyre_compound"] != drv_laps["tyre_compound"].shift()
            pit_out = drv_laps.get("is_pit_out_lap", pd.Series([False] * len(drv_laps), index=drv_laps.index)) == True
            drv_laps["stint"] = (compound_change | pit_out).cumsum()

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
                "tyre_life_remaining": max(0, life - age_end),
                "optimal_pit_window": pred_len,
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
