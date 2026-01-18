"""Telemetry features."""

from features.utils import load_session, save_features
import pandas as pd
import numpy as np


def build_telemetry_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build telemetry features."""
    data = load_session(year, race, session)

    tel_df = next((data[k] for k in ["telemetry", "car_data", "position"] if k in data), None)
    if tel_df is None or tel_df.empty:
        return pd.DataFrame()

    drv_col = next((c for c in ["driver_number", "driver_name"] if c in tel_df.columns), None)
    lap_col = next((c for c in ["lap_number", "lap"] if c in tel_df.columns), None)
    if drv_col is None:
        return pd.DataFrame()

    laps_df = data.get("laps", pd.DataFrame())
    if not laps_df.empty and "driver_number" in laps_df.columns and "driver_name" in laps_df.columns:
        driver_dict = dict(zip(laps_df.drop_duplicates("driver_number")["driver_number"],
                              laps_df.drop_duplicates("driver_number")["driver_name"]))
    else:
        driver_dict = {}

    if drv_col == "driver_number":
        tel_df["driver_name"] = tel_df["driver_number"].map(driver_dict).fillna(tel_df["driver_number"].astype(str))
    else:
        tel_df["driver_number"] = tel_df.get("driver_number", 0)

    result = []
    for drv in tel_df["driver_name"].unique():
        drv_data = tel_df[tel_df["driver_name"] == drv]
        groups = drv_data.groupby(lap_col) if lap_col else [(0, drv_data)]

        for lap_num, lap_d in groups:
            if lap_d.empty:
                continue
            spd = lap_d.get("speed", pd.Series()).dropna()
            thr = lap_d.get("throttle", pd.Series()).dropna()
            brk = lap_d.get("brake", pd.Series()).dropna()
            drs = lap_d.get("drs", pd.Series()).dropna()
            gear = lap_d.get("n_gear", pd.Series()).dropna()
            rpm = lap_d.get("rpm", pd.Series()).dropna()

            corr = np.corrcoef(thr.values[:min(len(thr), len(brk))],
                              brk.values[:min(len(thr), len(brk))])[0, 1] if not thr.empty and not brk.empty else None

            result.append({
                "year": year, "race_name": race, "session": session.upper(),
                "driver_name": drv, "driver_number": drv_data["driver_number"].iloc[0] if "driver_number" in drv_data.columns else None,
                "lap_number": lap_num if lap_col else None,
                "speed_max": float(spd.max()) if not spd.empty else None,
                "speed_avg": float(spd.mean()) if not spd.empty else None,
                "throttle_avg": float(thr.mean()) if not thr.empty else None,
                "brake_avg": float(brk.mean()) if not brk.empty else None,
                "brake_frequency": float((brk > 50).mean()) if not brk.empty else None,
                "drs_activations": int((drs > 0).sum()) if not drs.empty else 0,
                "rpm_max": float(rpm.max()) if not rpm.empty else None,
                "throttle_brake_correlation": corr,
            })
    return pd.DataFrame(result)


def run(year: int, race: str, session: str):
    f = build_telemetry_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "telemetry_features")
    return f


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build Telemetry Features")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="R")
    args = parser.parse_args()
    run(args.year, args.race, args.session)
