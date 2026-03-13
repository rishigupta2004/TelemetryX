import os
import sys
from pathlib import Path
import pandas as pd
from datetime import datetime

ROOT = Path(__file__).parent.parent
sys.path.append(str(ROOT))

from backend.etl.sources.ingest_fastf1 import ingest_fastf1
from backend.etl.sources.ingest_openf1 import ingest_openf1


BRONZE_DIR = Path("backend/etl/data/bronze")
SILVER_DIR = Path("backend/etl/data/silver")


def _tdelta_to_seconds(val):
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, pd.Timedelta):
        return val.total_seconds()
    return None


def _format_lap_time(seconds):
    if seconds is None or pd.isna(seconds):
        return None
    seconds = float(seconds)
    minutes = int(seconds // 60)
    remainder = seconds % 60
    return f"{minutes}:{remainder:06.3f}"


def process_fastf1_telemetry(df, year, race, session):
    cols = {
        "Date": "date",
        "RPM": "rpm",
        "Speed": "speed",
        "nGear": "gear",
        "Throttle": "throttle",
        "Brake": "brake",
        "DRS": "drs",
        "Source": "source",
        "driver_number": "driver_number",
        "SessionTime": "session_time",
    }
    missing = [
        c for c in ["Date", "SessionTime", "driver_number"] if c not in df.columns
    ]
    if missing:
        return pd.DataFrame()
    out = df.rename(columns={k: v for k, v in cols.items() if k in df.columns}).copy()
    out["session_time_seconds"] = out["session_time"].apply(_tdelta_to_seconds)
    out["time_seconds"] = out["session_time_seconds"]
    out["year"] = year
    out["race_name"] = race
    out["session"] = session
    keep = [
        "date",
        "session_time_seconds",
        "driver_number",
        "year",
        "race_name",
        "session",
        "speed",
        "rpm",
        "gear",
        "throttle",
        "brake",
        "drs",
        "source",
        "time_seconds",
    ]
    return out[[c for c in keep if c in out.columns]]


def process_openf1_telemetry(df, year, race, session):
    if df.empty:
        return df
    out = df.copy()
    col_map = {
        "date": "date",
        "session_time": "session_time_seconds",
        "session_time_seconds": "session_time_seconds",
        "driver_number": "driver_number",
        "speed": "speed",
        "rpm": "rpm",
        "throttle": "throttle",
        "brake": "brake",
        "n_gear": "gear",
        "gear": "gear",
        "drs": "drs",
    }
    out = out.rename(columns={k: v for k, v in col_map.items() if k in out.columns})
    if "session_time_seconds" not in out.columns and "date" in out.columns:
        times = pd.to_datetime(out["date"], errors="coerce")
        base = times.min()
        out["session_time_seconds"] = (times - base).dt.total_seconds()
    out["time_seconds"] = out.get("session_time_seconds")
    out["year"] = year
    out["race_name"] = race
    out["session"] = session
    out["source"] = out.get("source", "openf1")
    keep = [
        "date",
        "session_time_seconds",
        "driver_number",
        "year",
        "race_name",
        "session",
        "speed",
        "rpm",
        "gear",
        "throttle",
        "brake",
        "drs",
        "source",
        "time_seconds",
    ]
    return out[[c for c in keep if c in out.columns]]


def process_openf1_laps(df, year, race, session):
    if df.empty:
        return df
    out = df.copy()
    if "lap_duration" in out.columns:
        out["lap_time_seconds"] = out["lap_duration"].apply(_tdelta_to_seconds)
        out["lap_time_formatted"] = out["lap_time_seconds"].apply(_format_lap_time)
    if "date_start" in out.columns:
        times = pd.to_datetime(out["date_start"], errors="coerce")
        base = times.min()
        out["session_time_seconds"] = (times - base).dt.total_seconds()
    if "duration_sector_1" in out.columns:
        out["sector_1_formatted"] = out["duration_sector_1"].apply(_format_lap_time)
    if "duration_sector_2" in out.columns:
        out["sector_2_formatted"] = out["duration_sector_2"].apply(_format_lap_time)
    if "duration_sector_3" in out.columns:
        out["sector_3_formatted"] = out["duration_sector_3"].apply(_format_lap_time)
    out["year"] = year
    out["race_name"] = race
    out["session"] = session
    out["driver_name"] = out.get("driver_name", out.get("driver_number").astype(str))
    out["is_valid_lap"] = True
    return out


def ensure_silver_laps(year, race, session):
    silver_path = SILVER_DIR / str(year) / race / session
    silver_file = silver_path / "laps.parquet"
    if silver_file.exists():
        return True
    bronze_openf1 = BRONZE_DIR / str(year) / race / session / "openf1" / "laps.parquet"
    if bronze_openf1.exists():
        df = pd.read_parquet(bronze_openf1)
        out = process_openf1_laps(df, year, race, session)
        if not out.empty:
            silver_path.mkdir(parents=True, exist_ok=True)
            out.to_parquet(silver_file, index=False)
            return True
    return False


def ensure_silver_telemetry(year, race, session):
    silver_path = SILVER_DIR / str(year) / race / session
    silver_file = silver_path / "telemetry.parquet"
    if silver_file.exists():
        return True
    bronze_fastf1 = (
        BRONZE_DIR / str(year) / race / session / "fastf1" / "telemetry.parquet"
    )
    if bronze_fastf1.exists():
        df = pd.read_parquet(bronze_fastf1)
        out = process_fastf1_telemetry(df, year, race, session)
        if not out.empty:
            silver_path.mkdir(parents=True, exist_ok=True)
            out.to_parquet(silver_file, index=False)
            return True
    bronze_openf1 = (
        BRONZE_DIR / str(year) / race / session / "openf1" / "telemetry.parquet"
    )
    if bronze_openf1.exists():
        df = pd.read_parquet(bronze_openf1)
        out = process_openf1_telemetry(df, year, race, session)
        if not out.empty:
            silver_path.mkdir(parents=True, exist_ok=True)
            out.to_parquet(silver_file, index=False)
            return True
    return False


def fetch_fastf1_telemetry(year, race, session):
    data = ingest_fastf1(year, race, session_type=session, types=["telemetry"])
    if not data or "telemetry" not in data:
        return False
    df = data["telemetry"]
    if df.empty:
        return False
    out_dir = BRONZE_DIR / str(year) / race / session / "fastf1"
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_dir / "telemetry.parquet", index=False)
    return True


def fetch_openf1_telemetry(year, race, session):
    data = ingest_openf1(year, race, session_code=session, tables=["telemetry"])
    if not data:
        return False
    key = "telemetry_3d" if "telemetry_3d" in data else "telemetry"
    if key not in data or data[key].empty:
        return False
    out_dir = BRONZE_DIR / str(year) / race / session / "openf1"
    out_dir.mkdir(parents=True, exist_ok=True)
    data[key].to_parquet(out_dir / "telemetry.parquet", index=False)
    return True


def main():
    missing = []
    for year in sorted(SILVER_DIR.iterdir()):
        if not year.is_dir() or not year.name.isdigit():
            continue
        for race in sorted(year.iterdir()):
            if not race.is_dir():
                continue
            for session in ["Q", "R", "S", "SS"]:
                session_path = race / session
                if not session_path.exists():
                    continue
                laps_ok = ensure_silver_laps(year.name, race.name, session)
                tel_ok = ensure_silver_telemetry(year.name, race.name, session)
                if not tel_ok:
                    fetched = fetch_fastf1_telemetry(int(year.name), race.name, session)
                    if fetched:
                        tel_ok = ensure_silver_telemetry(year.name, race.name, session)
                if not tel_ok:
                    fetched = fetch_openf1_telemetry(int(year.name), race.name, session)
                    if fetched:
                        tel_ok = ensure_silver_telemetry(year.name, race.name, session)
                if not (laps_ok and tel_ok):
                    missing.append((year.name, race.name, session, laps_ok, tel_ok))

    # Safety-first: never delete medallion data by default.
    # Set TELEMETRYX_ALLOW_DESTRUCTIVE_BACKFILL=1 only for explicit maintenance windows.
    allow_destructive = (
        os.getenv("TELEMETRYX_ALLOW_DESTRUCTIVE_BACKFILL", "0").strip() == "1"
    )
    to_delete = [m for m in missing if m[2] in {"S", "SS"} and not (m[3] and m[4])]
    if allow_destructive:
        for year, race, session, _, _ in to_delete:
            path = SILVER_DIR / str(year) / race / session
            if path.exists():
                for p in path.rglob("*"):
                    if p.is_file():
                        p.unlink()
                for p in sorted(path.rglob("*"), reverse=True):
                    if p.is_dir():
                        p.rmdir()
                path.rmdir()
    elif to_delete:
        print(
            f"[SAFE MODE] Skipping deletion of {len(to_delete)} incomplete sprint session directories"
        )

    print("Missing after backfill:", len(missing))
    if missing:
        for m in missing[:50]:
            print(m)


if __name__ == "__main__":
    main()
