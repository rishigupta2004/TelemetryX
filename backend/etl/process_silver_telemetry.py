"""
Silver Layer Standardization for Telemetry

Transforms Bronze telemetry (raw FastF1) to Silver (standardized format):
- Column names standardized (Date -> date, Speed -> speed, etc.)
- Time formats converted to seconds
- Data types standardized
- Session/year metadata added

Usage:
    python process_silver_telemetry.py --year 2024 --race "Bahrain Grand Prix" --session R
    python process_silver_telemetry.py --year 2024 --race "Bahrain Grand Prix" --session all
    python process_silver_telemetry.py --year all  # Process all races

Output:
    data/silver/{year}/{race}/{session}/telemetry.parquet
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import timedelta
from typing import Optional
import argparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

BRONZE_DIR = Path(__file__).parent / "data" / "bronze"
SILVER_DIR = Path(__file__).parent / "data" / "silver"


# Bronze to Silver column mapping
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
    """Convert timedelta to seconds."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, pd.Timedelta):
        return val.total_seconds()
    if isinstance(val, timedelta):
        return val.total_seconds()
    return None


def process_telemetry(
    df: pd.DataFrame,
    year: int,
    race: str,
    session: str
) -> pd.DataFrame:
    """Process telemetry from Bronze to Silver format."""
    if df is None or df.empty:
        return pd.DataFrame()
    
    # Create a copy to avoid modifying original
    df = df.copy()
    
    # Rename columns using mapping
    rename_map = {k: v for k, v in TELEMETRY_COLUMN_MAP.items() if k in df.columns}
    df = df.rename(columns=rename_map)
    
    # Add session metadata
    df["year"] = year
    df["race_name"] = race
    df["session"] = session.upper()
    
    # Convert time columns to seconds
    if "session_time" in df.columns:
        df["session_time_seconds"] = df["session_time"].apply(timedelta_to_seconds)
        df = df.drop(columns=["session_time"])
    
    if "time" in df.columns:
        df["time_seconds"] = df["time"].apply(timedelta_to_seconds)
        df = df.drop(columns=["time"])
    
    # Convert date to ISO format string
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "+00:00"
    
    # Ensure numeric types
    numeric_cols = ["rpm", "speed", "gear", "throttle", "brake", "drs"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Ensure driver_number is integer
    if "driver_number" in df.columns:
        df["driver_number"] = pd.to_numeric(df["driver_number"], errors='coerce')
    
    # Reorder columns for consistency
    standard_cols = [
        "date", "session_time_seconds", "driver_number", "year", "race_name", "session",
        "speed", "rpm", "gear", "throttle", "brake", "drs", "source"
    ]
    
    # Keep only columns that exist
    final_cols = [c for c in standard_cols if c in df.columns]
    # Add any extra columns
    extra_cols = [c for c in df.columns if c not in final_cols]
    
    return df[final_cols + extra_cols]


def check_bronze_telemetry(year: int, race: str, session: str) -> bool:
    """Check if Bronze telemetry exists."""
    bronze_path = BRONZE_DIR / str(year) / race / session / "fastf1" / "telemetry.parquet"
    return bronze_path.exists()


def check_silver_telemetry(year: int, race: str, session: str) -> bool:
    """Check if Silver telemetry already exists."""
    silver_path = SILVER_DIR / str(year) / race / session / "telemetry.parquet"
    return silver_path.exists()


def save_silver_telemetry(df: pd.DataFrame, year: int, race: str, session: str) -> int:
    """Save processed telemetry to Silver layer."""
    if df is None or df.empty:
        return 0
    
    silver_path = SILVER_DIR / str(year) / race / session
    silver_path.mkdir(parents=True, exist_ok=True)
    
    output_file = silver_path / "telemetry.parquet"
    df.to_parquet(output_file, index=False)
    
    return len(df)


def process_single_session(
    year: int,
    race: str,
    session: str,
    force: bool = False,
    dry_run: bool = False
) -> dict:
    """Process telemetry for a single race/session."""
    result = {
        "year": year,
        "race": race,
        "session": session,
        "status": "pending",
        "records": 0,
        "error": None
    }
    
    # Check Bronze exists
    if not check_bronze_telemetry(year, race, session):
        print(f"  ⚠️  No Bronze telemetry: {year} {race} {session}")
        result["status"] = "missing_bronze"
        return result
    
    # Check Silver exists
    if check_silver_telemetry(year, race, session) and not force:
        print(f"  ⏭️  Skipping (exists): {year} {race} {session}")
        result["status"] = "skipped"
        return result
    
    if dry_run:
        print(f"  🔍 Would process: {year} {race} {session}")
        result["status"] = "dry_run"
        return result
    
    # Read Bronze
    bronze_path = BRONZE_DIR / str(year) / race / session / "fastf1" / "telemetry.parquet"
    print(f"  📖 Reading: {year} {race} {session}")
    
    try:
        df = pd.read_parquet(bronze_path)
        print(f"    Bronze records: {len(df)}")
        
        # Process to Silver
        processed = process_telemetry(df, year, race, session)
        print(f"    Silver records: {len(processed)}")
        
        # Save Silver
        records = save_silver_telemetry(processed, year, race, session)
        print(f"    ✅ Saved {records} records to Silver")
        result["status"] = "success"
        result["records"] = records
        
    except Exception as e:
        print(f"    ❌ Error: {e}")
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


def get_available_sessions() -> list:
    """Get list of session types to process."""
    return ["Q", "R", "S", "SS"]


def get_all_races_for_year(year: int) -> list:
    """Get list of all races for a year from Bronze directory."""
    year_dir = BRONZE_DIR / str(year)
    if not year_dir.exists():
        return []
    return sorted([d.name for d in year_dir.iterdir() if d.is_dir()])


def run_for_year(
    year: int,
    sessions: list = None,
    force: bool = False,
    dry_run: bool = False
) -> list:
    """Process all races for a specific year."""
    if sessions is None:
        sessions = get_available_sessions()
    
    results = []
    races = get_all_races_for_year(year)
    
    print(f"\n{'='*60}")
    print(f"YEAR: {year} ({len(races)} races)")
    print(f"{'='*60}")
    
    for race in races:
        print(f"\n  Race: {race}")
        for session in sessions:
            result = process_single_session(year, race, session, force, dry_run)
            results.append(result)
    
    return results


def summarize_results(results: list) -> None:
    """Print summary of results."""
    total = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    missing = sum(1 for r in results if r["status"] == "missing_bronze")
    failed = sum(1 for r in results if r["status"] == "error")
    dry_run = sum(1 for r in results if r["status"] == "dry_run")
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total:    {total}")
    print(f"  Success:  {success}")
    print(f"  Skipped:  {skipped}")
    print(f"  Missing:  {missing}")
    print(f"  Failed:   {failed}")
    print(f"  Dry Run:  {dry_run}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process telemetry from Bronze to Silver")
    parser.add_argument("--year", type=str, required=True, help="Year to process (e.g., 2024) or 'all'")
    parser.add_argument("--race", type=str, default=None, help="Specific race name (optional)")
    parser.add_argument("--session", type=str, default="R", help="Session type: Q, R, S, SS, or all")
    parser.add_argument("--force", action="store_true", help="Re-process even if Silver exists")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--list-races", action="store_true", help="List available races for the year")
    
    args = parser.parse_args()
    
    # Handle session types
    if args.session.lower() == "all":
        sessions = get_available_sessions()
    else:
        sessions = [args.session.upper()]
    
    # Handle year - 'all' or specific year
    if args.year.lower() == "all":
        years = list(range(2018, 2025))  # 2018-2024
    else:
        years = [int(args.year)]
    
    # List races and exit
    if args.list_races:
        races = get_all_races_for_year(int(args.year) if args.year.lower() != "all" else 2024)
        print(f"Races for {args.year}:")
        for race in races:
            print(f"  - {race}")
        sys.exit(0)
    
    # Handle specific race
    if args.race:
        results = []
        print(f"\n{'='*60}")
        print(f"SINGLE RACE: {args.year} {args.race} {','.join(sessions)}")
        print(f"{'='*60}")
        for session in sessions:
            for year in years:
                result = process_single_session(year, args.race, session, args.force, args.dry_run)
                results.append(result)
    else:
        # Process all races for all years
        results = []
        for year in years:
            year_results = run_for_year(year, sessions, args.force, args.dry_run)
            results.extend(year_results)
    
    # Print summary
    if not args.dry_run:
        summarize_results(results)
    else:
        print(f"\n[DRY RUN] No changes made")
