"""
Unified ETL Pipeline for F1 Data.

Data source priority:
1. OpenF1 - 3D coordinates, 3.7Hz telemetry, team radio, overtakes
2. FastF1 - Tyre data, weather, race control, laps
3. TracingInsights - GitHub backup

Output:
- data/bronze/{year}/{race}/{session}/

IMPORTANT: TELEMETRY DATA FLOW
==============================
The telemetry data should flow through Bronze layer:

    FastF1 API → Bronze (data/bronze/{year}/{race}/{session}/fastf1/telemetry.parquet)
                    ↓
                Silver (data/silver/{year}/{race}/{session}/telemetry.parquet)
                    ↓
                Gold (features/telemetry_features.parquet)

FOR EXISTING DATA (2018-2024):
==============================
Use the backfill script to ingest telemetry into Bronze:

    python backend/etl/backfill_telemetry_fastf1.py --year all

Then process to Silver:

    python backend/etl/process_silver_telemetry.py --year all

Then generate features for all races:

    python scripts/generate_all_features.py --years 2018-2024 --workers 8

FOR NEW DATA INGESTION:
=======================
Update ingest_fastf1.py to include 'telemetry' in types list.
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
import pandas as pd
import json

from sources.ingest_openf1 import ingest_openf1, OpenF1Client
from sources.ingest_fastf1 import ingest_fastf1
from sources.ing_tracing import ingest_tracing


BRONZE_DIR = Path(__file__).parent / "data" / "bronze"


def check_existing_data(
    year: int,
    race: str,
    session: str
) -> Dict[str, bool]:
    """
    Check if data already exists for the given session.
    
    Returns dict with source availability status.
    """
    session_dir = BRONZE_DIR / str(year) / race / session
    
    status = {
        "openf1_exists": False,
        "fastf1_exists": False,
        "tracing_exists": False
    }
    
    if session_dir.exists():
        for source in ["openf1", "fastf1", "tracing"]:
            source_dir = session_dir / source
            if source_dir.exists() and any(source_dir.iterdir()):
                status[f"{source}_exists"] = True
    
    return status


def save_bronze_data(
    data: Dict[str, pd.DataFrame],
    year: int,
    race: str,
    session: str,
    source: str
) -> None:
    """Save DataFrames to bronze layer."""
    session_dir = BRONZE_DIR / str(year) / race / session / source
    session_dir.mkdir(parents=True, exist_ok=True)
    
    for key, df in data.items():
        if df is not None and not df.empty:
            filepath = session_dir / f"{key}.parquet"
            df.to_parquet(filepath, index=False)


def run_bronze_ingestion(
    year: int,
    race: str,
    session: str = "R",
    force: bool = False,
    github_token: Optional[str] = None
) -> Dict:
    """
    Run unified bronze ingestion from all sources.
    
    Args:
        year: F1 season year
        race: Race name (e.g., 'Bahrain', 'Monaco')
        session: Session type (R, Q, FP1, FP2, FP3)
        force: Force re-download even if data exists
        github_token: GitHub token for TracingInsights
    
    Returns:
        Summary dict with ingestion results
    """
    session_str = session.upper()
    
    print(f"\n{'='*60}")
    print(f"BRONZE INGESTION: {year} {race} {session_str}")
    print(f"{'='*60}")
    
    existing = check_existing_data(year, race, session_str)
    print(f"Existing data: {existing}")
    
    results = {
        "year": year,
        "race": race,
        "session": session_str,
        "sources": {}
    }
    
    print(f"\n[1/3] OpenF1 (3D coordinates, 3.7Hz telemetry, team radio, overtakes)")
    
    if not existing["openf1_exists"] or force:
        openf1_data = ingest_openf1(year, race)
        if openf1_data:
            save_bronze_data(openf1_data, year, race, session_str, "openf1")
            results["sources"]["openf1"] = {"status": "success", "tables": list(openf1_data.keys())}
            print(f"  Saved {len(openf1_data)} tables to bronze")
        else:
            results["sources"]["openf1"] = {"status": "failed", "tables": []}
            print("  Failed to fetch OpenF1 data")
    else:
        print("  Data already exists, skipping")
        results["sources"]["openf1"] = {"status": "skipped", "tables": []}
    
    print(f"\n[2/3] FastF1 (Tyre data, weather, race control, laps)")
    
    if not existing["fastf1_exists"] or force:
        fastf1_data = ingest_fastf1(year, race, session_str)
        if fastf1_data:
            save_bronze_data(fastf1_data, year, race, session_str, "fastf1")
            results["sources"]["fastf1"] = {"status": "success", "tables": list(fastf1_data.keys())}
            print(f"  Saved {len(fastf1_data)} tables to bronze")
        else:
            results["sources"]["fastf1"] = {"status": "failed", "tables": []}
            print("  Failed to fetch FastF1 data")
    else:
        print("  Data already exists, skipping")
        results["sources"]["fastf1"] = {"status": "skipped", "tables": []}
    
    print(f"\n[3/3] TracingInsights (GitHub backup)")
    
    if not existing["tracing_exists"] or force:
        tracing_data = ingest_tracing(year, race, session_str, github_token)
        if tracing_data:
            save_bronze_data(tracing_data, year, race, session_str, "tracing")
            results["sources"]["tracing"] = {"status": "success", "tables": list(tracing_data.keys())}
            print(f"  Saved {len(tracing_data)} tables to bronze")
        else:
            results["sources"]["tracing"] = {"status": "failed", "tables": []}
            print("  Failed to fetch TracingInsights data")
    else:
        print("  Data already exists, skipping")
        results["sources"]["tracing"] = {"status": "skipped", "tables": []}
    
    print(f"\n{'='*60}")
    print(f"BRONZE INGESTION COMPLETE: {year} {race} {session_str}")
    print(f"{'='*60}")
    
    return results


def load_bronze_data(
    year: int,
    race: str,
    session: str,
    source: Optional[str] = None
) -> Dict[str, pd.DataFrame]:
    """
    Load bronze data for a session.
    
    Args:
        year: F1 season year
        race: Race name
        session: Session type
        source: Optional specific source to load
    
    Returns:
        dict of DataFrames
    """
    base_dir = BRONZE_DIR / str(year) / race / session.upper()
    
    if source:
        source_dirs = [base_dir / source]
    else:
        source_dirs = [d for d in base_dir.iterdir() if d.is_dir()]
    
    result = {}
    for source_dir in source_dirs:
        for parquet_file in source_dir.glob("*.parquet"):
            key = f"{source_dir.name}_{parquet_file.stem}"
            result[key] = pd.read_parquet(parquet_file)
    
    return result


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Unified F1 ETL Bronze Ingestion")
    parser.add_argument("--year", type=int, required=True, help="F1 season year")
    parser.add_argument("--race", type=str, required=True, help="Race name")
    parser.add_argument("--session", type=str, default="R", help="Session type (R, Q, FP1, FP2, FP3)")
    parser.add_argument("--force", action="store_true", help="Force re-download")
    parser.add_argument("--token", type=str, help="GitHub token for TracingInsights")
    
    args = parser.parse_args()
    
    run_bronze_ingestion(
        year=args.year,
        race=args.race,
        session=args.session,
        force=args.force,
        github_token=args.token
    )
