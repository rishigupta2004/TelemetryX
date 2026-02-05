import os
from pathlib import Path
import json
import pandas as pd

SILVER_DIR = Path("backend/etl/data/silver")
GOLD_DIR = Path("backend/etl/data/gold")


def build_metadata(year, race, session, laps_df):
    total_laps = int(laps_df["lap_number"].max()) if "lap_number" in laps_df.columns and not laps_df.empty else None
    return {
        "year": year,
        "race_name": race,
        "session": session,
        "total_laps": total_laps,
    }


def build_fastest_laps(laps_df):
    if laps_df.empty or "lap_time_seconds" not in laps_df.columns:
        return pd.DataFrame()
    cols = [c for c in ["driver_name", "driver_number", "team_name"] if c in laps_df.columns]
    if not cols:
        return pd.DataFrame()
    df = laps_df.dropna(subset=["lap_time_seconds"]).copy()
    fastest = df.groupby(cols)["lap_time_seconds"].min().reset_index()
    fastest = fastest.rename(columns={"lap_time_seconds": "fastest_lap_seconds"})
    return fastest


def build_driver_standings(laps_df):
    if laps_df.empty or "position" not in laps_df.columns:
        return pd.DataFrame()
    cols = [c for c in ["driver_name", "driver_number", "team_name"] if c in laps_df.columns]
    if not cols:
        return pd.DataFrame()
    df = laps_df.sort_values(["driver_number", "lap_number"]).copy()
    final = df.groupby(cols)["position"].last().reset_index()
    final = final.rename(columns={"position": "final_position"})
    return final


def build_constructor_standings(driver_standings_df):
    if driver_standings_df.empty or "team_name" not in driver_standings_df.columns:
        return pd.DataFrame()
    df = driver_standings_df.dropna(subset=["team_name", "final_position"]).copy()
    agg = df.groupby("team_name")["final_position"].mean().reset_index()
    agg = agg.rename(columns={"final_position": "avg_finish_position"})
    return agg


def main():
    for year_dir in sorted(SILVER_DIR.iterdir()):
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        for race_dir in sorted(year_dir.iterdir()):
            if not race_dir.is_dir():
                continue
            for session in ["Q", "R", "S", "SS"]:
                session_dir = race_dir / session
                if not session_dir.exists():
                    continue
                laps_file = session_dir / "laps.parquet"
                if not laps_file.exists():
                    continue
                try:
                    laps_df = pd.read_parquet(laps_file)
                except Exception:
                    continue

                gold_path = GOLD_DIR / year_dir.name / race_dir.name / session
                gold_path.mkdir(parents=True, exist_ok=True)

                meta_file = gold_path / "metadata.json"
                if not meta_file.exists():
                    meta = build_metadata(int(year_dir.name), race_dir.name, session, laps_df)
                    meta_file.write_text(json.dumps(meta, indent=2))

                fastest_file = gold_path / "fastest_laps.parquet"
                if not fastest_file.exists():
                    fastest = build_fastest_laps(laps_df)
                    if not fastest.empty:
                        fastest.to_parquet(fastest_file, index=False)

                driver_file = gold_path / "driver_standings.parquet"
                constructor_file = gold_path / "constructor_standings.parquet"
                if not driver_file.exists() or not constructor_file.exists():
                    driver = build_driver_standings(laps_df)
                    if not driver.empty and not driver_file.exists():
                        driver.to_parquet(driver_file, index=False)
                    if not driver.empty and not constructor_file.exists():
                        constructor = build_constructor_standings(driver)
                        if not constructor.empty:
                            constructor.to_parquet(constructor_file, index=False)


if __name__ == "__main__":
    main()
