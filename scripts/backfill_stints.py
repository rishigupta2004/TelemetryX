import argparse
from pathlib import Path
import sys
import pandas as pd

ROOT = Path(__file__).parent.parent
sys.path.append(str(ROOT))

from backend.etl.sources.ingest_openf1 import ingest_openf1, find_session_key, OpenF1Client
from backend.etl.sources.ingest_fastf1 import ingest_fastf1


BRONZE_DIR = Path("backend/etl/data/bronze")
SILVER_DIR = Path("backend/etl/data/silver")


def _infer_round(year: int, race: str) -> int | None:
    race_dir = SILVER_DIR / str(year) / race
    if not race_dir.exists():
        return None
    for session in ["R", "Q", "S", "SS"]:
        laps_path = race_dir / session / "laps.parquet"
        if laps_path.exists():
            try:
                df = pd.read_parquet(laps_path)
                if "round" in df.columns and not df["round"].isna().all():
                    return int(df["round"].dropna().iloc[0])
            except Exception:
                continue
    return None


def _write_bronze(df: pd.DataFrame, year: int, race: str, session: str, source: str) -> None:
    out_dir = BRONZE_DIR / str(year) / race / session / source
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_dir / "stints.parquet", index=False)


def _write_silver(df: pd.DataFrame, year: int, race: str, session: str, round_value: int | None) -> None:
    out_dir = SILVER_DIR / str(year) / race / session
    out_dir.mkdir(parents=True, exist_ok=True)
    if "year" not in df.columns:
        df["year"] = year
    if "round" not in df.columns:
        df["round"] = round_value
    if "session" not in df.columns:
        df["session"] = session
    df.to_parquet(out_dir / "stints.parquet", index=False)


def _normalize_openf1_stints(df: pd.DataFrame) -> pd.DataFrame:
    cols = {
        "driver_number": "driver_number",
        "stint_number": "stint_number",
        "lap_start": "lap_start",
        "lap_end": "lap_end",
        "compound": "compound",
        "tyre_age_at_start": "tyre_age_at_start",
        "meeting_key": "meeting_key",
        "session_key": "session_key",
    }
    out = df[[c for c in cols if c in df.columns]].rename(columns=cols)
    return out


def _derive_stints_from_fastf1_laps(laps: pd.DataFrame) -> pd.DataFrame:
    needed = ["DriverNumber", "Stint", "LapNumber", "Compound"]
    if any(c not in laps.columns for c in needed):
        return pd.DataFrame()
    df = laps.dropna(subset=["DriverNumber", "Stint", "LapNumber"]).copy()
    df["DriverNumber"] = df["DriverNumber"].astype(int)
    df["Stint"] = df["Stint"].astype(int)
    df["LapNumber"] = df["LapNumber"].astype(int)
    rows = []
    for (drv, stint), group in df.groupby(["DriverNumber", "Stint"]):
        compound = group["Compound"].dropna()
        if compound.empty:
            continue
        tyre_age = group["TyreLife"].dropna() if "TyreLife" in group.columns else pd.Series([])
        rows.append({
            "driver_number": drv,
            "stint_number": int(stint),
            "lap_start": int(group["LapNumber"].min()),
            "lap_end": int(group["LapNumber"].max()),
            "compound": str(compound.iloc[0]).upper(),
            "tyre_age_at_start": float(tyre_age.min()) if not tyre_age.empty else None,
        })
    return pd.DataFrame(rows)


def _missing_stints(year: int, race: str, session: str) -> bool:
    sdir = SILVER_DIR / str(year) / race / session
    return not (sdir / "stints.parquet").exists()


def backfill_stints(year: int | None, session: str | None, race_filter: str | None) -> None:
    years = [year] if year else sorted([int(p.name) for p in SILVER_DIR.iterdir() if p.is_dir() and p.name.isdigit()])
    client = OpenF1Client()

    for y in years:
        year_dir = SILVER_DIR / str(y)
        for race_dir in sorted([d for d in year_dir.iterdir() if d.is_dir()]):
            race = race_dir.name
            if race_filter and race_filter.lower() not in race.lower():
                continue
            for sess in ["Q", "R", "S", "SS"]:
                if session and sess != session:
                    continue
                if not (race_dir / sess).exists():
                    continue
                if not _missing_stints(y, race, sess):
                    continue

                round_value = _infer_round(y, race)
                print(f"Backfill stints: {y} {race} {sess}")

                openf1_data = ingest_openf1(y, race, session_code=sess, tables=["stints"])
                if openf1_data and "stints" in openf1_data and not openf1_data["stints"].empty:
                    stints = _normalize_openf1_stints(openf1_data["stints"])
                    if not stints.empty:
                        _write_bronze(openf1_data["stints"], y, race, sess, "openf1")
                        _write_silver(stints, y, race, sess, round_value)
                        print(f"  OpenF1 stints: {len(stints)}")
                        continue

                fastf1_data = ingest_fastf1(y, race, session_type=sess, types=["laps"])
                if fastf1_data and "laps" in fastf1_data and not fastf1_data["laps"].empty:
                    derived = _derive_stints_from_fastf1_laps(fastf1_data["laps"])
                    if not derived.empty:
                        session_key = find_session_key(client, y, race, session_code=sess)
                        derived["meeting_key"] = None
                        derived["session_key"] = session_key
                        _write_bronze(derived, y, race, sess, "fastf1")
                        _write_silver(derived, y, race, sess, round_value)
                        print(f"  FastF1 stints: {len(derived)}")
                        continue

                print("  No stints found")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing stints into silver")
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--session", type=str, default=None, choices=["Q", "R", "S", "SS"])
    parser.add_argument("--race", type=str, default=None)
    args = parser.parse_args()
    backfill_stints(args.year, args.session, args.race)


if __name__ == "__main__":
    main()
