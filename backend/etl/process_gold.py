"""
Gold Layer Aggregation.

Creates:
- driver_standings
- constructor_standings
- fastest_laps
- track_maps from 3D data
"""

import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import pandas as pd
import numpy as np

SILVER_DIR = Path(__file__).parent / "data" / "silver"
GOLD_DIR = Path(__file__).parent / "data" / "gold"


def compute_driver_standings(
    laps: pd.DataFrame,
    year: int,
    round_num: int,
    session: str
) -> pd.DataFrame:
    """Compute driver standings from lap data."""
    if laps.empty or "driver_number" not in laps.columns:
        return pd.DataFrame()
    
    valid_laps = laps[laps["is_valid_lap"] == True] if "is_valid_lap" in laps.columns else laps
    
    standings = []
    
    for driver, driver_laps in valid_laps.groupby("driver_number"):
        if "lap_time_seconds" in driver_laps.columns:
            total_time = driver_laps["lap_time_seconds"].sum()
            lap_count = len(driver_laps)
            avg_lap = driver_laps["lap_time_seconds"].mean()
            min_lap = driver_laps["lap_time_seconds"].min()
            
            fastest_lap_idx = driver_laps["lap_time_seconds"].idxmin()
            fastest_lap = driver_laps.loc[fastest_lap_idx]
        else:
            total_time = 0
            lap_count = 0
            avg_lap = 0
            min_lap = 0
            fastest_lap = pd.Series()
        
        team = driver_laps["team_name"].iloc[0] if "team_name" in driver_laps.columns else None
        driver_name = driver_laps["driver_name"].iloc[0] if "driver_name" in driver_laps.columns else None
        
        standings.append({
            "year": year,
            "round": round_num,
            "session": session,
            "driver_number": driver,
            "driver_name": driver_name,
            "team_name": team,
            "total_laps": lap_count,
            "total_time_seconds": total_time,
            "avg_lap_time": avg_lap,
            "fastest_lap_time": min_lap,
            "position": 0
        })
    
    if not standings:
        return pd.DataFrame()
    
    df = pd.DataFrame(standings)
    df = df.sort_values("total_time_seconds")
    df["position"] = range(1, len(df) + 1)
    
    return df


def compute_constructor_standings(
    driver_standings: pd.DataFrame,
    year: int,
    round_num: int,
    session: str
) -> pd.DataFrame:
    """Compute constructor standings from driver standings."""
    if driver_standings.empty or "team_name" not in driver_standings.columns:
        return pd.DataFrame()
    
    constructor_data = driver_standings.groupby("team_name").agg({
        "total_time_seconds": "sum",
        "total_laps": "sum",
        "driver_number": "count"
    }).reset_index()
    
    constructor_data = constructor_data.sort_values("total_time_seconds")
    constructor_data["position"] = range(1, len(constructor_data) + 1)
    constructor_data.columns = [
        "team_name",
        "total_time_seconds",
        "total_laps",
        "driver_count",
        "position"
    ]
    
    constructor_data["year"] = year
    constructor_data["round"] = round_num
    constructor_data["session"] = session
    
    return constructor_data


def compute_fastest_laps(
    laps: pd.DataFrame,
    year: int,
    round_num: int,
    session: str
) -> pd.DataFrame:
    """Compute fastest laps for each driver."""
    if laps.empty or "lap_time_seconds" not in laps.columns:
        return pd.DataFrame()
    
    valid_laps = laps[laps["is_valid_lap"] == True] if "is_valid_lap" in laps.columns else laps
    
    fastest = valid_laps.loc[valid_laps.groupby("driver_number")["lap_time_seconds"].idxmin()]
    
    # Select available columns (some may not exist)
    select_cols = ["driver_number", "team_name", "lap_number", "lap_time_seconds", "lap_time_formatted",
                   "sector_1_formatted", "sector_2_formatted", "sector_3_formatted",
                   "tyre_compound", "tyre_age_laps"]
    available_cols = [c for c in select_cols if c in fastest.columns]
    
    result = fastest[available_cols].copy()
    
    result["year"] = year
    result["round"] = round_num
    result["session"] = session
    
    result = result.sort_values("lap_time_seconds")
    result["position"] = range(1, len(result) + 1)
    
    return result


def compute_track_map(
    telemetry: pd.DataFrame,
    year: int,
    round_num: int,
    session: str
) -> pd.DataFrame:
    """Create track map from 3D telemetry data."""
    if telemetry.empty or "position_x" not in telemetry.columns:
        return pd.DataFrame(), {}
    
    has_z = "position_z" in telemetry.columns
    
    track_cols = ["position_x", "position_y"]
    if has_z:
        track_cols.append("position_z")
    
    if "driver_number" in telemetry.columns:
        track_cols.append("driver_number")
    if "timestamp" in telemetry.columns:
        track_cols = ["timestamp"] + track_cols
    
    available_cols = [c for c in track_cols if c in telemetry.columns]
    track_map = telemetry[available_cols].copy()
    
    if "timestamp" in track_map.columns:
        track_map = track_map.sort_values("timestamp")
    
    track_map = track_map.drop_duplicates(subset=["position_x", "position_y"])
    
    track_map["year"] = year
    track_map["round"] = round_num
    track_map["session"] = session
    
    bounds = {
        "min_x": track_map["position_x"].min(),
        "max_x": track_map["position_x"].max(),
        "min_y": track_map["position_y"].min(),
        "max_y": track_map["position_y"].max(),
    }
    
    if has_z:
        bounds["min_z"] = track_map["position_z"].min()
        bounds["max_z"] = track_map["position_z"].max()
    
    return track_map, bounds


def run_gold_aggregation(
    year: int,
    race: str,
    session: str = "R",
    round_num: int = 1
) -> Dict[str, pd.DataFrame]:
    """
    Run gold aggregation for a session.
    
    Args:
        year: F1 season year
        race: Race name
        session: Session type
        round_num: Race round number
    
    Returns:
        dict of gold DataFrames
    """
    print(f"\n{'='*60}")
    print(f"GOLD AGGREGATION: {year} {race} {session}")
    print(f"{'='*60}")
    
    silver_path = SILVER_DIR / str(year) / race / session
    
    if not silver_path.exists():
        print(f"Silver data not found: {silver_path}")
        return {}
    
    silver_data = {}
    for parquet_file in silver_path.glob("*.parquet"):
        key = parquet_file.stem
        silver_data[key] = pd.read_parquet(parquet_file)
    
    print(f"Loaded {len(silver_data)} silver tables")
    
    gold = {}
    
    if "laps" in silver_data:
        print("Computing driver standings...")
        driver_standings = compute_driver_standings(
            silver_data["laps"], year, round_num, session
        )
        if not driver_standings.empty:
            gold["driver_standings"] = driver_standings
            print(f"  driver_standings: {len(driver_standings)} rows")
    
    if "laps" in silver_data and "driver_standings" in gold:
        print("Computing constructor standings...")
        constructor_standings = compute_constructor_standings(
            gold["driver_standings"], year, round_num, session
        )
        if not constructor_standings.empty:
            gold["constructor_standings"] = constructor_standings
            print(f"  constructor_standings: {len(constructor_standings)} rows")
    
    if "laps" in silver_data:
        print("Computing fastest laps...")
        fastest_laps = compute_fastest_laps(
            silver_data["laps"], year, round_num, session
        )
        if not fastest_laps.empty:
            gold["fastest_laps"] = fastest_laps
            print(f"  fastest_laps: {len(fastest_laps)} rows")
    
    if "telemetry" in silver_data:
        print("Computing track map...")
        track_map, bounds = compute_track_map(
            silver_data["telemetry"], year, round_num, session
        )
        if not track_map.empty:
            gold["track_map"] = track_map
            print(f"  track_map: {len(track_map)} points")
            print(f"  Track bounds: {bounds}")
    
    print(f"\nSaving gold data...")
    gold_dir = GOLD_DIR / str(year) / race / session
    gold_dir.mkdir(parents=True, exist_ok=True)
    
    metadata = {
        "year": year,
        "race": race,
        "session": session,
        "round": round_num,
        "generated_at": datetime.now().isoformat(),
        "tables": {}
    }
    
    for key, df in gold.items():
        filepath = gold_dir / f"{key}.parquet"
        df.to_parquet(filepath, index=False)
        print(f"  {key}.parquet: {len(df)} rows")
        metadata["tables"][key] = {"rows": len(df), "columns": list(df.columns)}
    
    metadata_file = gold_dir / "metadata.json"
    with open(metadata_file, "w") as f:
        import json
        json.dump(metadata, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"GOLD AGGREGATION COMPLETE")
    print(f"{'='*60}")
    
    return gold


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Gold Layer Aggregation")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="R")
    parser.add_argument("--round", type=int, default=1)
    
    args = parser.parse_args()
    
    run_gold_aggregation(
        year=args.year,
        race=args.race,
        session=args.session,
        round_num=args.round
    )
