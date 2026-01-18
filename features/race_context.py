"""Race context features."""

from features.utils import load_session, save_features
import pandas as pd

TRACK_STATUS = {"1": "GREEN", "2": "YELLOW", "4": "RED_FLAG", "5": "VSC", "6": "SAFETY_CAR", "7": "VSC_ENDING"}


def build_race_context_features(year: int, race: str, session: str) -> pd.DataFrame:
    """Build race context features."""
    data = load_session(year, race, session)
    if "laps" not in data:
        return pd.DataFrame()

    laps = data["laps"]
    weather = data.get("weather", pd.DataFrame())

    df = laps[["lap_number"]].drop_duplicates().sort_values("lap_number").copy()
    df["year"], df["race_name"], df["session"] = year, race, session.upper()

    if "track_status_code" in df.columns:
        df["track_status_at_lap"] = df["track_status_code"].map(
            lambda x: TRACK_STATUS.get(str(x), "UNKNOWN") if pd.notna(x) else None)
        df["yellow_flag_periods"] = (df["track_status_code"] == "2").astype(int)
        df["red_flag_periods"] = (df["track_status_code"] == "4").astype(int)
        df["safety_car_deployed"] = (df["track_status_code"] == "6").astype(int)
        df["vsc_deployed"] = (df["track_status_code"] == "5").astype(int)

    for col in ["air_temperature", "track_temperature", "humidity"]:
        if col not in df.columns and col in weather.columns:
            df[col] = weather[col].iloc[0] if not weather.empty else None

    df["weather_conditions"] = df.apply(
        lambda r: "RAIN" if pd.notna(r.get("rainfall")) and r["rainfall"] > 0
        else "HOT" if pd.notna(r.get("track_temperature")) and r["track_temperature"] > 50
        else "WINDY" if pd.notna(r.get("wind_speed")) and r["wind_speed"] > 20
        else "DRY", axis=1)

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
