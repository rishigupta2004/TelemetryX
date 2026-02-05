"""Race context features."""

from features.utils import load_session, save_features
import pandas as pd

TRACK_STATUS = {
    "1": "GREEN",
    "2": "YELLOW",
    "4": "RED_FLAG",
    "5": "VSC",
    "6": "SAFETY_CAR",
    "7": "VSC_ENDING",
}


def build_race_context_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build race context features."""
    data = load_session(year, race, session)
    if "laps" not in data or data["laps"].empty:
        return pd.DataFrame()

    laps = data["laps"]
    weather = data.get("weather", pd.DataFrame()).copy()
    race_control = data.get("race_control", pd.DataFrame()).copy()

    df = laps[["lap_number"]].drop_duplicates().sort_values("lap_number").copy()
    df["year"], df["race_name"], df["session"] = year, race, session.upper()

    track_cols = [c for c in ["track_status_code", "track_status"] if c in laps.columns]
    if track_cols:
        track = laps[["lap_number"] + track_cols].drop_duplicates("lap_number")
        df = df.merge(track, on="lap_number", how="left")

        if "track_status_code" in df.columns:
            df["track_status_at_lap"] = df["track_status_code"].map(
                lambda x: TRACK_STATUS.get(str(x), "UNKNOWN") if pd.notna(x) else None
            )
            status_code = df["track_status_code"].astype(str)
        else:
            status_code = pd.Series([None] * len(df))

        if "track_status" in df.columns:
            status_text = df["track_status"].astype(str)
            if "track_status_at_lap" not in df.columns:
                df["track_status_at_lap"] = status_text
        else:
            status_text = pd.Series([None] * len(df))

        df["yellow_flag_periods"] = ((status_code == "2") | (status_text.str.contains("YELLOW", na=False))).astype(int)
        df["red_flag_periods"] = ((status_code == "4") | (status_text.str.contains("RED", na=False))).astype(int)
        df["safety_car_deployed"] = ((status_code == "6") | (status_text.str.contains("SAFETY", na=False))).astype(int)
        df["vsc_deployed"] = ((status_code == "5") | (status_text.str.contains("VSC", na=False))).astype(int)

    if not weather.empty:
        weather = weather.rename(columns={"Rainfall": "rainfall"})
        for col in ["air_temperature", "track_temperature", "humidity", "wind_speed", "wind_direction", "pressure", "rainfall"]:
            if col in weather.columns:
                df[col] = weather[col].iloc[0]

    df["weather_conditions"] = df.apply(
        lambda r: "RAIN" if pd.notna(r.get("rainfall")) and r["rainfall"] > 0
        else "HOT" if pd.notna(r.get("track_temperature")) and r["track_temperature"] > 50
        else "WINDY" if pd.notna(r.get("wind_speed")) and r["wind_speed"] > 20
        else "DRY", axis=1)

    if not race_control.empty and "Lap" in race_control.columns:
        rc = race_control.copy()
        rc["lap_number"] = pd.to_numeric(rc["Lap"], errors="coerce")
        rc = rc.dropna(subset=["lap_number"])
        incidents = rc.groupby("lap_number").size().reset_index(name="race_control_incidents")
        df = df.merge(incidents, on="lap_number", how="left")
        df["race_control_incidents"] = df["race_control_incidents"].fillna(0).astype(int)

    return df


def run(year: int, race: str, session: str):
    f = build_race_context_features(year, race, session)
    if not f.empty:
        save_features(f, year, race, session, "race_context_features")
    return f


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build Race Context Features")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="R")
    args = parser.parse_args()
    run(args.year, args.race, args.session)
