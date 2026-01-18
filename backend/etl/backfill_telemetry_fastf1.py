"""
Telemetry Backfill Script using FastF1

Ingest telemetry from FastF1 and save to Bronze layer.
This ensures telemetry data flows through Bronze → Silver → Gold pipeline.

Usage:
    python backfill_telemetry_fastf1.py --year 2024 --race "Bahrain Grand Prix" --session R
    python backfill_telemetry_fastf1.py --year 2024 --race "Bahrain Grand Prix" --session all
    python backfill_telemetry_fastf1.py --year all --dry-run  # Check what's missing
    python backfill_telemetry_fastf1.py --year all  # Ingest all missing telemetry

Note: This is a TEMPORARY backfill script. The main ETL pipeline (ingest_unified.py)
should be updated to include telemetry in Bronze layer for new data ingestion.
"""

import sys
from pathlib import Path
import pandas as pd
import argparse
import fastf1

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

BRONZE_DIR = Path(__file__).parent / "data" / "bronze"


def get_available_sessions() -> list:
    """Get list of session types to process."""
    return ["Q", "R", "S", "SS"]


def get_all_races_for_year(year: int) -> list:
    """Get list of all races for a year from Bronze directory."""
    year_dir = BRONZE_DIR / str(year)
    if not year_dir.exists():
        return []
    return sorted([d.name for d in year_dir.iterdir() if d.is_dir()])


def check_telemetry_exists(year: int, race: str, session: str) -> bool:
    """Check if telemetry already exists in Bronze."""
    telemetry_path = BRONZE_DIR / str(year) / race / session / "fastf1" / "telemetry.parquet"
    return telemetry_path.exists()


def save_telemetry_to_bronze(df: pd.DataFrame, year: int, race: str, session: str) -> int:
    """Save telemetry data to Bronze layer."""
    if df is None or df.empty:
        return 0
    
    # Create output directory
    output_dir = BRONZE_DIR / str(year) / race / session / "fastf1"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save telemetry
    telemetry_path = output_dir / "telemetry.parquet"
    df.to_parquet(telemetry_path, index=False)
    
    return len(df)


def ingest_telemetry(year: int, race: str, session: str, dry_run: bool = False, cache_dir: str = None) -> dict:
    """Ingest telemetry for a single race/session using FastF1."""
    result = {
        "year": year,
        "race": race,
        "session": session,
        "status": "pending",
        "records": 0,
        "error": None
    }
    
    # Check if already exists
    if check_telemetry_exists(year, race, session):
        print(f"  ⏭️  Skipping (exists): {year} {race} {session}")
        result["status"] = "skipped"
        return result
    
    if dry_run:
        print(f"  🔍 Would fetch: {year} {race} {session}")
        result["status"] = "dry_run"
        return result
    
    # Setup FastF1 cache
    if cache_dir is None:
        cache_dir = str(Path.home() / ".cache" / "fastf1")
    Path(cache_dir).mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)
    
    # Fetch from FastF1
    print(f"  📡 Fetching: {year} {race} {session}")
    
    try:
        session_obj = fastf1.get_session(year, race, session)
        session_obj.load()
        
        # Get car_data (telemetry)
        car_data = getattr(session_obj, 'car_data', None)
        if car_data is None or not car_data:
            print(f"    ⚠️  No car data available")
            result["status"] = "not_available"
            return result
        
        # Combine all driver car data into single DataFrame
        all_telemetry = []
        for drv_num, drv_data in car_data.items():
            if drv_data is not None and not drv_data.empty:
                drv_data = drv_data.copy()
                drv_data['driver_number'] = drv_num
                all_telemetry.append(drv_data)
        
        if not all_telemetry:
            print(f"    ⚠️  Empty car data")
            result["status"] = "empty"
            return result
        
        telemetry_df = pd.concat(all_telemetry, ignore_index=True)
        
        # Save to Bronze
        records = save_telemetry_to_bronze(telemetry_df, year, race, session)
        print(f"    ✅ Saved {records} telemetry records")
        result["status"] = "success"
        result["records"] = records
        
    except Exception as e:
        print(f"    ❌ Error: {e}")
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


def run_for_year(year: int, sessions: list = None, dry_run: bool = False, cache_dir: str = None) -> list:
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
            result = ingest_telemetry(year, race, session, dry_run, cache_dir)
            results.append(result)
    
    return results


def summarize_results(results: list) -> None:
    """Print summary of backfill results."""
    total = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    failed = sum(1 for r in results if r["status"] in ["not_available", "empty", "error"])
    dry_run = sum(1 for r in results if r["status"] == "dry_run")
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total:    {total}")
    print(f"  Success:  {success}")
    print(f"  Skipped:  {skipped}")
    print(f"  Failed:   {failed}")
    print(f"  Dry Run:  {dry_run}")
    
    if failed > 0:
        print(f"\n  Failed items:")
        for r in results:
            if r["status"] in ["not_available", "empty", "error"]:
                print(f"    - {r['year']} {r['race']} {r['session']}: {r['status']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill telemetry data to Bronze layer using FastF1")
    parser.add_argument("--year", type=str, required=True, help="Year to process (e.g., 2024) or 'all'")
    parser.add_argument("--race", type=str, default=None, help="Specific race name (optional)")
    parser.add_argument("--session", type=str, default="R", help="Session type: Q, R, S, SS, or all")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--list-races", action="store_true", help="List available races for the year")
    parser.add_argument("--cache-dir", type=str, default=None, help="FastF1 cache directory")
    
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
                result = ingest_telemetry(year, args.race, session, args.dry_run, args.cache_dir)
                results.append(result)
    else:
        # Process all races for all years
        results = []
        for year in years:
            year_results = run_for_year(year, sessions, args.dry_run, args.cache_dir)
            results.extend(year_results)
    
    # Print summary
    if not args.dry_run:
        summarize_results(results)
    else:
        print(f"\n[DRY RUN] No changes made")
