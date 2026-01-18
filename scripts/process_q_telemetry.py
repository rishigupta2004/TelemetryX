#!/usr/bin/env python3
"""Quick script to process remaining Q telemetry to silver."""

from pathlib import Path
import pandas as pd
from datetime import timedelta
from typing import Optional
import sys

BRONZE_DIR = Path("/Volumes/Space/PROJECTS/TelemetryX/backend/etl/data/bronze")
SILVER_DIR = Path("/Volumes/Space/PROJECTS/TelemetryX/backend/etl/data/silver")

TELEMETRY_COLUMN_MAP = {
    "Date": "date",
    "Time": "time",
    "SessionTime": "session_time",
    "RPM": "rpm",
    "Speed": "speed",
    "nGear": "gear",
    "Throttle": "throttle",
    "Brake": "brake",
    "DRS": "drs",
    "Source": "source",
    "driver_number": "driver_number",
}

def timedelta_to_seconds(val) -> Optional[float]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, pd.Timedelta):
        return val.total_seconds()
    if isinstance(val, timedelta):
        return val.total_seconds()
    return None

def process_telemetry(df: pd.DataFrame, year: int, race: str, session: str) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    
    df = df.copy()
    rename_map = {k: v for k, v in TELEMETRY_COLUMN_MAP.items() if k in df.columns}
    df = df.rename(columns=rename_map)
    df["year"] = year
    df["race_name"] = race
    df["session"] = session.upper()
    
    if "session_time" in df.columns:
        df["session_time_seconds"] = df["session_time"].apply(timedelta_to_seconds)
        df = df.drop(columns=["session_time"])
    
    if "time" in df.columns:
        df["time_seconds"] = df["time"].apply(timedelta_to_seconds)
        df = df.drop(columns=["time"])
    
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "+00:00"
    
    numeric_cols = ["rpm", "speed", "gear", "throttle", "brake", "drs"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    
    cols_order = ["date", "session_time_seconds", "driver_number", "year", "race_name", "session", "speed", "rpm", "throttle", "brake", "gear", "drs"]
    cols_order = [c for c in cols_order if c in df.columns]
    return df[cols_order]

def main():
    missing = []
    
    for year_dir in sorted(BRONZE_DIR.iterdir()):
        if not year_dir.name.isdigit():
            continue
        year = int(year_dir.name)
        if year < 2018 or year > 2025:
            continue
        
        for race_dir in sorted(year_dir.iterdir()):
            if not race_dir.is_dir():
                continue
            race = race_dir.name
            bronze_path = race_dir / "Q" / "fastf1" / "telemetry.parquet"
            silver_path = SILVER_DIR / str(year) / race / "Q" / "telemetry.parquet"
            
            if bronze_path.exists() and not silver_path.exists():
                try:
                    print(f"Processing: {year} {race} Q")
                    df = pd.read_parquet(bronze_path)
                    processed = process_telemetry(df, year, race, "Q")
                    
                    if not processed.empty:
                        out_dir = SILVER_DIR / str(year) / race / "Q"
                        out_dir.mkdir(parents=True, exist_ok=True)
                        processed.to_parquet(silver_path, index=False)
                        print(f"  ✅ Saved {len(processed)} records")
                    else:
                        print(f"  ⚠️  Empty after processing")
                except Exception as e:
                    print(f"  ❌ Error: {e}")
                    missing.append(f"{year} {race}")
    
    print(f"\nDone. Missing: {len(missing)}")

if __name__ == "__main__":
    main()
