"""
Generate Features for All Races (Parallel Processing)

Generates features for all races using multiple CPU cores for speed.
This is Step 3 of the pipeline (Silver → Gold).

Usage:
    # All races, 8 workers (recommended for 8+ core CPUs)
    python generate_all_features.py --workers 8

    # Single race, dry run
    python generate_all_features.py --year 2024 --race "Bahrain Grand Prix" --dry-run

    # All races, single worker (slow, for debugging)
    python generate_all_features.py --workers 1

    # Only specific feature
    python generate_all_features.py --features lap,tyre,telemetry

Features generated:
    - lap, tyre, telemetry, race_context, comparison,
      position, overtakes, traffic, points

Performance:
    - 1 worker: ~1-2 min per race
    - 8 workers: ~10-15 min for all 174 races
"""

import sys
import subprocess
from pathlib import Path
from multiprocessing import Pool, cpu_count
from typing import List, Tuple
import argparse
from datetime import datetime
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from features.utils import FEATURES_PATH


# Feature modules to run
FEATURE_MODULES = [
    "lap", "tyre", "telemetry", "race_context",
    "comparison", "position", "overtakes", "traffic", "points"
]


def get_all_races_for_year(year: int) -> List[str]:
    """Get list of all races for a year from Silver directory."""
    silver_dir = Path(__file__).parent.parent / "backend" / "etl" / "data" / "silver" / str(year)
    if not silver_dir.exists():
        return []
    return sorted([d.name for d in silver_dir.iterdir() if d.is_dir()])


def get_available_sessions() -> List[str]:
    """Get list of session types."""
    return ["Q", "R", "S", "SS"]


def generate_for_race_session(args: Tuple) -> dict:
    """Generate all features for a single race/session."""
    year, race, session, features = args
    
    result = {
        "year": year,
        "race": race,
        "session": session,
        "status": "success",
        "features_generated": 0,
        "errors": []
    }
    
    for feature in features:
        cmd = [
            sys.executable, "-m", f"features.{feature}",
            "--year", str(year),
            "--race", race,
            "--session", session
        ]
        
        try:
            proc = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True,
                timeout=300  # 5 min timeout per feature
            )
            
            if proc.returncode != 0:
                result["errors"].append(f"{feature}: {proc.stderr[:100]}")
            else:
                result["features_generated"] += 1
                
        except subprocess.TimeoutExpired:
            result["errors"].append(f"{feature}: timeout")
        except Exception as e:
            result["errors"].append(f"{feature}: {str(e)}")
    
    if result["errors"]:
        result["status"] = "partial" if result["features_generated"] > 0 else "failed"
    else:
        result["status"] = "success"
    
    return result


def run_sequential(years: List[int], features: List[str], dry_run: bool = False) -> List[dict]:
    """Run feature generation sequentially."""
    results = []
    
    for year in years:
        races = get_all_races_for_year(year)
        sessions = get_available_sessions()
        
        print(f"\n{'='*60}")
        print(f"YEAR: {year} ({len(races)} races × {len(sessions)} sessions)")
        print(f"{'='*60}")
        
        for race in races:
            print(f"\n  {race}")
            for session in sessions:
                if dry_run:
                    print(f"    [DRY RUN] {year} {race} {session}")
                else:
                    result = generate_for_race_session((year, race, session, features))
                    results.append(result)
                    status = "✅" if result["status"] == "success" else "⚠️"
                    print(f"    {status} {session}: {result['features_generated']}/{len(features)} features")
    
    return results


def run_parallel(years: List[int], features: List[str], workers: int, dry_run: bool = False) -> List[dict]:
    """Run feature generation in parallel."""
    # Build task list
    tasks = []
    for year in years:
        races = get_all_races_for_year(year)
        sessions = get_available_sessions()
        for race in races:
            for session in sessions:
                tasks.append((year, race, session, features))
    
    print(f"\n{'='*60}")
    print(f"PARALLEL FEATURE GENERATION")
    print(f"{'='*60}")
    print(f"  Total tasks: {len(tasks)}")
    print(f"  Workers: {workers}")
    print(f"  Features per task: {len(features)}")
    
    if dry_run:
        print(f"\n[DRY RUN] Would process {len(tasks)} tasks")
        return []
    
    # Run in parallel
    print(f"\n  Processing...")
    start = datetime.now()
    
    with Pool(workers) as pool:
        results = pool.map(generate_for_race_session, tasks)
    
    elapsed = (datetime.now() - start).total_seconds()
    print(f"  Completed in {elapsed:.1f}s ({len(results)/elapsed*60:.1f} tasks/min)")
    
    return results


def summarize(results: List[dict]) -> None:
    """Print summary."""
    if not results:
        print("\nNo results to summarize")
        return
    
    total = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    partial = sum(1 for r in results if r["status"] == "partial")
    failed = sum(1 for r in results if r["status"] == "failed")
    
    total_features = sum(r["features_generated"] for r in results)
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total tasks:      {total}")
    print(f"  Success:          {success}")
    print(f"  Partial:          {partial}")
    print(f"  Failed:           {failed}")
    print(f"  Features gen'd:   {total_features}")
    
    if failed > 0:
        print(f"\n  Failed tasks:")
        for r in results:
            if r["status"] == "failed":
                print(f"    - {r['year']} {r['race']} {r['session']}: {r['errors']}")
    
    print(f"\n  Success rate: {success/total*100:.1f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate features for all races")
    
    # Selection
    parser.add_argument("--year", type=int, default=None, help="Specific year")
    parser.add_argument("--years", type=str, default="2024", help="Year range (e.g., 2018-2024)")
    parser.add_argument("--race", type=str, default=None, help="Specific race")
    parser.add_argument("--session", type=str, default="all", help="Session: Q, R, S, SS, all")
    
    # Features
    parser.add_argument("--features", type=str, default="all", 
                        help="Comma-separated features or 'all'")
    parser.add_argument("--exclude", type=str, default="",
                        help="Features to exclude (comma-separated)")
    
    # Execution
    parser.add_argument("--workers", type=int, default=None,
                        help="Number of workers (default: min(cpu_count, 8))")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--list-races", action="store_true", help="List available races")
    
    args = parser.parse_args()
    
    # Determine workers
    if args.workers is None:
        args.workers = min(cpu_count(), 8)
    
    # Parse years
    if "-" in args.years:
        start, end = map(int, args.years.split("-"))
        years = list(range(start, end + 1))
    else:
        years = [int(args.years)]
    
    if args.year:
        years = [args.year]
    
    # Parse features
    if args.features.lower() == "all":
        features = FEATURE_MODULES
    else:
        features = [f.strip() for f in args.features.split(",")]
    
    # Exclude features
    if args.exclude:
        exclude = [e.strip() for e in args.exclude.split(",")]
        features = [f for f in features if f not in exclude]
    
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
    
    print(f"\n{'='*60}")
    print("FEATURE GENERATION")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    print(f"  Years: {years}")
    print(f"  Sessions: {sessions}")
    print(f"  Features: {features}")
    print(f"  Workers: {args.workers}")
    
    # Check if only specific race
    if args.race:
        # Run single race
        for year in years:
            races = [args.race] if args.race in get_all_races_for_year(year) else []
            results = run_sequential(years, features, args.dry_run)
    else:
        # Run all races
        if args.workers == 1 or len(years) == 1:
            results = run_sequential(years, features, args.dry_run)
        else:
            results = run_parallel(years, features, args.workers, args.dry_run)
    
    # Summary
    if not args.dry_run:
        summarize(results)
        print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print(f"\n[DRY RUN] No changes made")
