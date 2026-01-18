"""
Master Orchestration Script for TelemetryX Pipeline

This script orchestrates the complete data pipeline:
1. Backfill telemetry from FastF1 to Bronze
2. Process Bronze telemetry to Silver
3. Generate features for all races (parallel)

Usage:
    # Full pipeline for all years
    python run_pipeline.py --years 2018-2024 --workers 8
    
    # Dry run first
    python run_pipeline.py --years 2024 --dry-run
    
    # Specific race/session
    python run_pipeline.py --year 2024 --race "Bahrain Grand Prix" --session R
    
    # Skip certain steps
    python run_pipeline.py --year 2024 --skip-backfill --skip-silver

Steps:
    Step 1: Backfill telemetry (FastF1 → Bronze)
    Step 2: Process telemetry (Bronze → Silver)  
    Step 3: Generate features (Silver → Gold)

Notes:
    - Step 1 (Backfill): Downloads ~6MB per race session from FastF1
    - Step 2 (Silver): Light processing, ~1-2 seconds per session
    - Step 3 (Features): Heavy processing, benefits from parallelization
"""

import sys
import subprocess
from pathlib import Path
import argparse
from datetime import datetime
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Base directory
BASE_DIR = Path(__file__).parent.parent
ETL_DIR = BASE_DIR / "backend" / "etl"
SCRIPTS_DIR = BASE_DIR / "scripts"


def run_command(cmd: list, description: str, dry_run: bool = False) -> bool:
    """Run a command and report status."""
    cmd_str = " ".join(cmd)
    
    if dry_run:
        print(f"  [DRY RUN] {description}")
        print(f"    Command: {cmd_str}")
        return True
    
    print(f"  {description}")
    print(f"    Running: {cmd_str[:60]}...")
    
    try:
        result = subprocess.run(cmd, cwd=str(ETL_DIR), capture_output=True, text=True)
        if result.returncode != 0:
            print(f"    ❌ Error: {result.stderr[:200]}")
            return False
        print(f"    ✅ Done")
        return True
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return False


def get_all_years(start: int = 2018, end: int = 2024) -> list:
    """Get list of years to process."""
    return list(range(start, end + 1))


def get_all_races_for_year(year: int) -> list:
    """Get list of all races for a year."""
    bronze_dir = ETL_DIR / "data" / "bronze" / str(year)
    if not bronze_dir.exists():
        return []
    return sorted([d.name for d in bronze_dir.iterdir() if d.is_dir()])


def get_available_sessions() -> list:
    """Get list of session types."""
    return ["Q", "R", "S", "SS"]


def step1_backfill(year: int, race: str, session: str, dry_run: bool = False) -> bool:
    """Step 1: Backfill telemetry from FastF1 to Bronze."""
    cmd = [
        sys.executable, "backfill_telemetry_fastf1.py",
        "--year", str(year),
        "--race", race,
        "--session", session
    ]
    return run_command(cmd, f"Backfill: {year} {race} {session}", dry_run)


def step2_silver(year: int, race: str, session: str, force: bool = False, dry_run: bool = False) -> bool:
    """Step 2: Process Bronze telemetry to Silver."""
    cmd = [
        sys.executable, "process_silver_telemetry.py",
        "--year", str(year),
        "--race", race,
        "--session", session
    ]
    if force:
        cmd.extend(["--force"])
    return run_command(cmd, f"Silver: {year} {race} {session}", dry_run)


def step3_features(year: int, race: str, session: str, dry_run: bool = False) -> bool:
    """Step 3: Generate features from Silver to Gold."""
    # Run all feature modules for this race/session
    features = [
        "lap", "tyre", "telemetry", "race_context", 
        "comparison", "position", "overtakes", "traffic", "points"
    ]
    
    for feature in features:
        cmd = [
            sys.executable, "-m", f"features.{feature}",
            "--year", str(year),
            "--race", race,
            "--session", session
        ]
        if not run_command(cmd, f"Feature {feature}: {year} {race} {session}", dry_run):
            return False
    
    return True


def process_year(
    year: int,
    sessions: list,
    races: list = None,
    skip_backfill: bool = False,
    skip_silver: bool = False,
    force: bool = False,
    dry_run: bool = False
) -> dict:
    """Process all races for a year."""
    results = {
        "year": year,
        "total": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0
    }
    
    if races is None:
        races = get_all_races_for_year(year)
    
    print(f"\n{'='*70}")
    print(f"YEAR: {year} ({len(races)} races × {len(sessions)} sessions = {len(races) * len(sessions)} tasks)")
    print(f"{'='*70}")
    
    for race in races:
        print(f"\n  Race: {race}")
        
        for session in sessions:
            results["total"] += 1
            
            # Step 1: Backfill telemetry
            if not skip_backfill:
                if not step1_backfill(year, race, session, dry_run):
                    results["failed"] += 1
                    continue
            
            # Step 2: Process to Silver
            if not skip_silver:
                if not step2_silver(year, race, session, force, dry_run):
                    results["failed"] += 1
                    continue
            
            # Step 3: Generate features
            if not step3_features(year, race, session, dry_run):
                results["failed"] += 1
                continue
            
            results["success"] += 1
    
    return results


def summarize(results: list) -> None:
    """Print summary of all results."""
    total = sum(r["total"] for r in results)
    success = sum(r["success"] for r in results)
    failed = sum(r["failed"] for r in results)
    
    print(f"\n{'='*70}")
    print("FINAL SUMMARY")
    print(f"{'='*70}")
    print(f"  Total tasks:  {total}")
    print(f"  Success:      {success}")
    print(f"  Failed:       {failed}")
    print(f"  Success rate: {success/total*100:.1f}%" if total > 0 else "  N/A")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Master pipeline orchestration")
    
    # Year/race selection
    parser.add_argument("--year", type=int, default=None, help="Specific year (e.g., 2024)")
    parser.add_argument("--years", type=str, default="2024", help="Year range (e.g., 2018-2024 or 2024)")
    parser.add_argument("--race", type=str, default=None, help="Specific race name")
    parser.add_argument("--session", type=str, default="R", help="Session: Q, R, S, SS, or all")
    
    # Step control
    parser.add_argument("--skip-backfill", action="store_true", help="Skip backfill step")
    parser.add_argument("--skip-silver", action="store_true", help="Skip Silver processing step")
    parser.add_argument("--force", action="store_true", help="Force re-process existing data")
    
    # Execution options
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--list-races", action="store_true", help="List available races")
    
    args = parser.parse_args()
    
    # Parse years
    if "-" in args.years:
        start, end = map(int, args.years.split("-"))
        years = get_all_years(start, end)
    else:
        years = [int(args.years)]
    
    # Override with specific year if provided
    if args.year:
        years = [args.year]
    
    # Parse sessions
    if args.session.lower() == "all":
        sessions = get_available_sessions()
    else:
        sessions = [args.session.upper()]
    
    # List races and exit
    if args.list_races:
        for year in years:
            races = get_all_races_for_year(year)
            print(f"\nYear {year}: {len(races)} races")
            for race in races:
                print(f"  - {race}")
        sys.exit(0)
    
    # Validate
    if not years:
        print("Error: No years specified")
        sys.exit(1)
    
    print(f"\n{'='*70}")
    print("TELEMETRYX PIPELINE")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")
    print(f"Years: {years}")
    print(f"Sessions: {sessions}")
    print(f"Steps: ", end="")
    steps = []
    if not args.skip_backfill:
        steps.append("1) Backfill→Bronze")
    if not args.skip_silver:
        steps.append("2) Silver")
    steps.append("3) Features")
    print(" → ".join(steps))
    
    # Process all years
    all_results = []
    for year in years:
        races = None
        if args.race:
            races = [args.race]
        result = process_year(
            year=year,
            sessions=sessions,
            races=races,
            skip_backfill=args.skip_backfill,
            skip_silver=args.skip_silver,
            force=args.force,
            dry_run=args.dry_run
        )
        all_results.append(result)
    
    # Summary
    if not args.dry_run:
        summarize(all_results)
        print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print(f"\n[DRY RUN] No changes made")
