#!/usr/bin/env python3
"""
Unified ETL Pipeline Runner.

Usage:
    python run_etl.py --year 2023 --race "Bahrain" --session R --round 1
    
Pipeline stages:
    1. Bronze: Download from OpenF1, FastF1, TracingInsights
    2. Silver: Transform and standardize
    3. Gold: Aggregate standings and track maps
"""

import argparse
import sys
from pathlib import Path

from ingest_unified import run_bronze_ingestion
from process_silver import run_silver_transform
from process_gold import run_gold_aggregation


def run_full_pipeline(
    year: int,
    race: str,
    session: str = "R",
    round_num: int = 1,
    github_token: str = None,
    force_bronze: bool = False
) -> None:
    """
    Run the complete ETL pipeline.
    
    Args:
        year: F1 season year
        race: Race name
        session: Session type (R, Q, FP1, FP2, FP3)
        round_num: Race round number
        github_token: GitHub token for TracingInsights
        force_bronze: Force re-download even if data exists
    """
    print(f"\n{'#'*70}")
    print(f"# UNIFIED F1 ETL PIPELINE")
    print(f"# Year: {year} | Race: {race} | Session: {session} | Round: {round_num}")
    print(f"{'#'*70}")
    
    bronze_results = run_bronze_ingestion(
        year=year,
        race=race,
        session=session,
        force=force_bronze,
        github_token=github_token
    )
    
    silver_results = run_silver_transform(
        year=year,
        race=race,
        session=session,
        round_num=round_num
    )
    
    gold_results = run_gold_aggregation(
        year=year,
        race=race,
        session=session,
        round_num=round_num
    )
    
    print(f"\n{'#'*70}")
    print(f"# PIPELINE COMPLETE")
    print(f"{'#'*70}")
    print(f"\nOutput locations:")
    print(f"  Bronze: data/bronze/{year}/{race}/{session}/")
    print(f"  Silver: data/silver/{year}/{race}/{session}/")
    print(f"  Gold:   data/gold/{year}/{race}/{session}/")


def main():
    parser = argparse.ArgumentParser(
        description="Unified F1 ETL Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Full pipeline for Bahrain GP
    python run_etl.py --year 2023 --race "Bahrain" --session R --round 1
    
    # Qualifying session only
    python run_etl.py --year 2023 --race "Monaco" --session Q --round 6
    
    # Force re-download bronze data
    python run_etl.py --year 2023 --race "Silverstone" --session R --round 10 --force
        """
    )
    
    parser.add_argument("--year", type=int, required=True, help="F1 season year")
    parser.add_argument("--race", type=str, required=True, help="Race name")
    parser.add_argument(
        "--session", type=str, default="R",
        help="Session type (R, Q, FP1, FP2, FP3)"
    )
    parser.add_argument("--round", type=int, default=1, help="Race round number")
    parser.add_argument(
        "--token", type=str, default=None,
        help="GitHub token for TracingInsights (optional)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Force re-download even if bronze data exists"
    )
    
    args = parser.parse_args()
    
    run_full_pipeline(
        year=args.year,
        race=args.race,
        session=args.session,
        round_num=args.round,
        github_token=args.token,
        force_bronze=args.force
    )


if __name__ == "__main__":
    main()
