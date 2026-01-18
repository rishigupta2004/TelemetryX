"""
Silver Layer Transformation with Official F1 Standards.

Transforms bronze data (raw FastF1) to silver (standardized F1 format):
- Time format: "M:SS.mmm" (e.g., "1:30.031")
- Lap validation: 60-600 seconds only
- Deleted laps: Tracked with official track status codes
- All columns standardized to F1 conventions

Author: TelemetryX
"""

import os
from pathlib import Path
from datetime import timedelta
from typing import Dict, Optional, List
import pandas as pd
import numpy as np

BRONZE_DIR = Path(__file__).parent / "data" / "bronze"
SILVER_DIR = Path(__file__).parent / "data" / "silver"


# ============================================================================
# OFFICIAL FIA TRACK STATUS CODES
# ============================================================================
TRACK_STATUS_CODES = {
    "1": "ALL_CLEAR",
    "2": "YELLOW",
    "4": "RED_FLAG",
    "5": "VSC",
    "6": "SAFETY_CAR",
    "7": "VSC_ENDING",
    "": "UNKNOWN"
}

# FIA standard tyre compounds
TYRE_COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]

# Team name mapping (FastF1 → Official FIA names, year-specific)
TEAM_NAMES = {
    # Red Bull
    "Red Bull Racing": "Red Bull Racing",
    "Red Bull": "Red Bull Racing",
    # Ferrari
    "Ferrari": "Scuderia Ferrari",
    "Scuderia Ferrari": "Scuderia Ferrari",
    # Mercedes
    "Mercedes": "Mercedes-AMG Petronas",
    "Mercedes-AMG Petronas": "Mercedes-AMG Petronas",
    # McLaren
    "McLaren": "McLaren Racing",
    "McLaren F1 Team": "McLaren Racing",
    # Alpine
    "Alpine F1 Team": "Alpine F1 Team",
    "Alpine": "Alpine F1 Team",
    # Williams
    "Williams": "Williams Racing",
    "Williams Racing": "Williams Racing",
    # Aston Martin
    "Aston Martin": "Aston Martin Aramco",
    "Aston Martin Aramco": "Aston Martin Aramco",
    "Aston Martin F1 Team": "Aston Martin Aramco",
    # Alfa Romeo
    "Alfa Romeo": "Alfa Romeo F1 Team",
    "Alfa Romeo F1 Team": "Alfa Romeo F1 Team",
    # Haas
    "Haas": "Haas F1 Team",
    "Haas F1 Team": "Haas F1 Team",
    # RB / AlphaTauri
    "RB": "Visa Cash App RB",
    "Visa Cash App RB": "Visa Cash App RB",
    "AlphaTauri": "Visa Cash App RB",
    "Scuderia AlphaTauri": "Visa Cash App RB",
}


# ============================================================================
# TIME FORMAT CONVERSION FUNCTIONS
# ============================================================================

def timedelta_to_seconds(val) -> Optional[float]:
    """Convert timedelta to seconds (float)."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, pd.Timedelta):
        return val.total_seconds()
    if isinstance(val, timedelta):
        return val.total_seconds()
    return None


def timedelta_to_formatted(val) -> Optional[str]:
    """
    Convert timedelta to F1 standard format 'M:SS.mmm'.
    
    Examples:
        0 days 00:01:30.031 → "1:30.031"
        0 days 00:00:52.456 → "0:52.456"
        0 days 00:01:05.000 → "1:05.000"
    """
    seconds = timedelta_to_seconds(val)
    if seconds is None or pd.isna(seconds):
        return None
    
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}:{secs:06.3f}"


def session_time_to_seconds(val) -> Optional[float]:
    """Convert session time (timedelta from session start) to seconds."""
    return timedelta_to_seconds(val)


# ============================================================================
# COLUMN MAPPING (Bronze → Silver)
# ============================================================================

LAPS_COLUMN_MAPPING = {
    "Driver": "driver_name",
    "DriverNumber": "driver_number",
    "LapTime": "lap_time_formatted",
    "LapNumber": "lap_number",
    "Time": "session_time_seconds",
    "Team": "team_name",
    "Compound": "tyre_compound",
    "Position": "position",
    "Deleted": "is_deleted",
    "DeletedReason": "deletion_reason",
    "TrackStatus": "track_status_code",
    "IsAccurate": "is_inaccurate",
    "Stint": "stint_number",
    "TyreLife": "tyre_age_laps",
    "FreshTyre": "tyre_fresh",
    "PitOutTime": "pit_out_time_formatted",
    "PitInTime": "pit_in_time_formatted",
    "Sector1Time": "sector_1_formatted",
    "Sector2Time": "sector_2_formatted",
    "Sector3Time": "sector_3_formatted",
    "SpeedI1": "speed_trap_1",
    "SpeedI2": "speed_trap_2",
    "SpeedFL": "speed_finish_line",
    "SpeedST": "speed_max",
    "AirTemp": "air_temperature",
    "TrackTemp": "track_temperature",
    "Humidity": "humidity",
    "Pressure": "pressure",
    "WindSpeed": "wind_speed",
    "WindDirection": "wind_direction",
    "RainFall": "rainfall",
    "X": "position_x",
    "Y": "position_y",
    "Z": "position_z",
}


# ============================================================================
# DATA TRANSFORMATION FUNCTIONS
# ============================================================================

def standardize_team_name(team: str) -> str:
    """Standardize team name to official FIA name."""
    if team is None or pd.isna(team):
        return None
    return TEAM_NAMES.get(str(team).strip(), str(team).strip())


def standardize_tyre_compound(compound: str) -> Optional[str]:
    """Standardize tyre compound to uppercase FIA format."""
    if compound is None or pd.isna(compound):
        return None
    compound_str = str(compound).strip().upper()
    
    # Handle variations
    if compound_str in ["I", "INTER", "INTERMEDIATE"]:
        return "INTERMEDIATE"
    elif compound_str in ["W", "WET"]:
        return "WET"
    elif compound_str in ["S", "SOFT"]:
        return "SOFT"
    elif compound_str in ["M", "MED", "MEDIUM"]:
        return "MEDIUM"
    elif compound_str in ["H", "HARD"]:
        return "HARD"
    
    return compound_str


def map_track_status(code: str) -> str:
    """Map track status code to descriptive name."""
    return TRACK_STATUS_CODES.get(str(code).strip(), "UNKNOWN")


def validate_lap_time(lap_time_seconds: Optional[float]) -> bool:
    """
    Validate lap time is in reasonable F1 range.
    
    F1 laps are typically 60-600 seconds (1-10 minutes).
    Formation laps may be slower, but 10+ minutes is impossible.
    """
    if lap_time_seconds is None or pd.isna(lap_time_seconds):
        return False
    return 60.0 <= lap_time_seconds <= 600.0


def transform_laps(
    bronze_df: pd.DataFrame,
    year: int,
    round_num: int,
    session: str,
    race_name: str
) -> pd.DataFrame:
    """
    Transform bronze laps to silver standard.
    
    Output columns:
        - driver_name: Full driver name
        - driver_number: FIA driver number
        - lap_time_formatted: "M:SS.mmm" format
        - lap_time_seconds: For calculations
        - lap_number: Lap number
        - session_time_seconds: Seconds from session start
        - team_name: Official team name
        - tyre_compound: SOFT/MEDIUM/HARD/INTER/WET
        - position: Finishing position (1-20)
        - is_deleted: Boolean
        - deletion_reason: Reason for deletion
        - track_status_code: 1/2/4/5/6/7
        - track_status: Descriptive name
        - is_inaccurate: Boolean
        - is_valid_lap: 60s < time < 600s AND not deleted
        - year, round, session, race_name
    """
    if bronze_df.empty:
        return pd.DataFrame()
    
    df = bronze_df.copy()
    
    # 1. Apply column mapping
    rename_map = {}
    for col in df.columns:
        if col in LAPS_COLUMN_MAPPING:
            rename_map[col] = LAPS_COLUMN_MAPPING[col]
    df = df.rename(columns=rename_map)
    
    # 2. Convert lap time to seconds (for calculations)
    if "lap_time_formatted" in df.columns:
        df["lap_time_seconds"] = df["lap_time_formatted"].apply(timedelta_to_seconds)
    
    # 3. Format time columns as "M:SS.mmm"
    # These columns may contain timedelta values that need to be formatted
    format_cols = {
        "lap_time_formatted": "lap_time_formatted",
        "pit_out_time_formatted": "PitOutTime",
        "pit_in_time_formatted": "PitInTime",
        "sector_1_formatted": "Sector1Time",
        "sector_2_formatted": "Sector2Time",
        "sector_3_formatted": "Sector3Time",
    }
    for target_col, source_col in format_cols.items():
        if source_col in df.columns:
            df[target_col] = df[source_col].apply(timedelta_to_formatted)
        elif target_col in df.columns:
            df[target_col] = df[target_col].apply(timedelta_to_formatted)
    
    # 4. Convert session time to seconds
    if "session_time_seconds" in df.columns:
        df["session_time_seconds"] = df["session_time_seconds"].apply(session_time_to_seconds)
    
    # 5. Standardize team names
    if "team_name" in df.columns:
        df["team_name"] = df["team_name"].apply(standardize_team_name)
    
    # 6. Standardize tyre compounds
    if "tyre_compound" in df.columns:
        df["tyre_compound"] = df["tyre_compound"].apply(standardize_tyre_compound)
    
    # 7. Map track status codes
    if "track_status_code" in df.columns:
        df["track_status"] = df["track_status_code"].apply(map_track_status)
    
    # 8. Add computed fields
    df["year"] = year
    df["round"] = round_num
    df["session"] = session.upper()
    df["race_name"] = race_name
    
    # 9. Validate laps (60s < time < 600s)
    if "lap_time_seconds" in df.columns:
        df["is_valid_lap"] = df["lap_time_seconds"].apply(validate_lap_time)
    else:
        df["is_valid_lap"] = False
    
    # 10. Ensure boolean types
    bool_cols = ["is_deleted", "is_inaccurate", "is_valid_lap", "tyre_fresh"]
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].fillna(False).astype(bool)
    
    # 11. Ensure numeric types
    if "driver_number" in df.columns:
        df["driver_number"] = pd.to_numeric(df["driver_number"], errors='coerce').fillna(0).astype(int)
    if "position" in df.columns:
        df["position"] = pd.to_numeric(df["position"], errors='coerce').fillna(0).astype(int)
    if "lap_number" in df.columns:
        df["lap_number"] = pd.to_numeric(df["lap_number"], errors='coerce').fillna(0).astype(int)
    
    return df


def transform_telemetry(
    bronze_df: pd.DataFrame,
    year: int,
    round_num: int,
    session: str,
    race_name: str
) -> pd.DataFrame:
    """Transform bronze telemetry to silver standard."""
    if bronze_df.empty:
        return pd.DataFrame()
    
    df = bronze_df.copy()
    
    # Standardize column names
    rename_map = {
        "Date": "timestamp",
        "DateTime": "timestamp",
        "Time": "session_time",
        "Driver": "driver_name",
        "DriverNumber": "driver_number",
        "X": "position_x",
        "Y": "position_y",
        "Z": "position_z",
        "Speed": "speed",
        "Throttle": "throttle",
        "Brake": "brake",
        "Gear": "gear",
    }
    
    for col in df.columns:
        if col in rename_map:
            df = df.rename(columns={col: rename_map[col]})
    
    # Convert timestamp
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce')
    
    # Add computed fields
    df["year"] = year
    df["round"] = round_num
    df["session"] = session.upper()
    df["race_name"] = race_name
    
    return df


def transform_weather(
    bronze_df: pd.DataFrame,
    year: int,
    round_num: int,
    session: str,
    race_name: str
) -> pd.DataFrame:
    """Transform bronze weather data to silver standard."""
    if bronze_df.empty:
        return pd.DataFrame()
    
    df = bronze_df.copy()
    
    # Standardize column names
    rename_map = {
        "Date": "timestamp",
        "AirTemp": "air_temperature",
        "TrackTemp": "track_temperature",
        "Humidity": "humidity",
        "Pressure": "pressure",
        "RainFall": "rainfall",
        "WindDirection": "wind_direction",
        "WindSpeed": "wind_speed",
    }
    
    for col in df.columns:
        if col in rename_map:
            df = df.rename(columns={col: rename_map[col]})
    
    # Add computed fields
    df["year"] = year
    df["round"] = round_num
    df["session"] = session.upper()
    df["race_name"] = race_name
    
    return df


def transform_race_control(
    bronze_df: pd.DataFrame,
    year: int,
    round_num: int,
    session: str,
    race_name: str
) -> pd.DataFrame:
    """Transform bronze race control messages to silver standard."""
    if bronze_df.empty:
        return pd.DataFrame()
    
    df = bronze_df.copy()
    
    # Standardize column names
    rename_map = {
        "Date": "timestamp",
        "Time": "session_time",
        "Message": "message",
        "Category": "category",
        "Driver": "driver_name",
        "Status": "status",
    }
    
    for col in df.columns:
        if col in rename_map:
            df = df.rename(columns={col: rename_map[col]})
    
    # Convert timestamp
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce')
    
    # Add computed fields
    df["year"] = year
    df["round"] = round_num
    df["session"] = session.upper()
    df["race_name"] = race_name
    
    return df


# ============================================================================
# MAIN TRANSFORMATION FUNCTION
# ============================================================================

def run_silver_transform(
    year: int,
    race_name: str,
    session: str = "R",
    round_num: int = 1,
    verbose: bool = True
) -> Dict[str, pd.DataFrame]:
    """
    Run silver transformation for a single session.
    
    Args:
        year: F1 season year (2018-2025)
        race_name: Race name (e.g., "Bahrain Grand Prix")
        session: Session type (Q, R, S, SS)
        round_num: Race round number
        verbose: Print progress
    
    Returns:
        Dict of silver DataFrames: {"laps": df, "telemetry": df, ...}
    """
    if verbose:
        print(f"\n{'='*60}")
        print(f"SILVER TRANSFORMATION: {year} {race_name} {session}")
        print(f"{'='*60}")
    
    bronze_path = BRONZE_DIR / str(year) / race_name / session
    
    if not bronze_path.exists():
        if verbose:
            print(f"⚠️  Bronze data not found: {bronze_path}")
        return {}
    
    # Load bronze data from all source directories
    bronze_data = {}
    for source_dir in bronze_path.iterdir():
        if source_dir.is_dir():
            for parquet_file in source_dir.glob("*.parquet"):
                key = f"{source_dir.name}_{parquet_file.stem}"
                try:
                    bronze_data[key] = pd.read_parquet(parquet_file)
                except Exception as e:
                    if verbose:
                        print(f"⚠️  Error reading {parquet_file}: {e}")
    
    if verbose:
        print(f"Loaded {len(bronze_data)} bronze tables")
    
    silver = {}
    
    # Transform laps
    laps_key = None
    for key in bronze_data.keys():
        if "laps" in key.lower() and "stint" not in key.lower():
            laps_key = key
            break
    
    if laps_key:
        if verbose:
            print("Transforming laps...")
        laps = transform_laps(bronze_data[laps_key], year, round_num, session, race_name)
        if not laps.empty:
            silver["laps"] = laps
            if verbose:
                valid_count = laps["is_valid_lap"].sum() if "is_valid_lap" in laps.columns else 0
                print(f"  laps: {len(laps)} rows, {valid_count} valid")
    
    # Transform telemetry
    tel_keys = [k for k in bronze_data.keys() 
                if any(x in k.lower() for x in ["telemetry", "car_data", "position"])]
    if tel_keys:
        if verbose:
            print("Transforming telemetry...")
        for key in tel_keys:
            tel = transform_telemetry(bronze_data[key], year, round_num, session, race_name)
            if not tel.empty:
                silver[key.lower().replace("fastf1_", "")] = tel
                if verbose:
                    print(f"  {key}: {len(tel)} rows")
    
    # Transform weather
    weather_key = None
    for key in bronze_data.keys():
        if "weather" in key.lower():
            weather_key = key
            break
    
    if weather_key:
        if verbose:
            print("Transforming weather...")
        weather = transform_weather(bronze_data[weather_key], year, round_num, session, race_name)
        if not weather.empty:
            silver["weather"] = weather
            if verbose:
                print(f"  weather: {len(weather)} rows")
    
    # Transform race control
    rc_key = None
    for key in bronze_data.keys():
        if "race_control" in key.lower():
            rc_key = key
            break
    
    if rc_key:
        if verbose:
            print("Transforming race control...")
        rc = transform_race_control(bronze_data[rc_key], year, round_num, session, race_name)
        if not rc.empty:
            silver["race_control"] = rc
            if verbose:
                print(f"  race_control: {len(rc)} rows")
    
    # Save silver data
    if verbose:
        print(f"\nSaving silver data...")
    
    silver_path = SILVER_DIR / str(year) / race_name / session.upper()
    silver_path.mkdir(parents=True, exist_ok=True)
    
    for key, df in silver.items():
        filepath = silver_path / f"{key}.parquet"
        df.to_parquet(filepath, index=False)
        if verbose:
            print(f"  {key}.parquet: {len(df)} rows")
    
    if verbose:
        print(f"\n{'='*60}")
        print(f"SILVER TRANSFORMATION COMPLETE")
        print(f"{'='*60}")
    
    return silver


def process_all_sessions(
    start_year: int = 2018,
    end_year: int = 2025,
    sessions: List[str] = None,
    verbose: bool = True
):
    """
    Process all sessions across all years.
    
    Args:
        start_year: First year to process
        end_year: Last year to process
        sessions: List of sessions to process (default: ["Q", "R", "S", "SS"])
        verbose: Print progress
    """
    if sessions is None:
        sessions = ["Q", "R", "S", "SS"]
    
    total_transformed = 0
    errors = []
    
    for year in range(start_year, end_year + 1):
        year_path = BRONZE_DIR / str(year)
        if not year_path.exists():
            continue
        
        if verbose:
            print(f"\n{'#'*60}")
            print(f"PROCESSING YEAR: {year}")
            print(f"{'#'*60}")
        
        for race_path in sorted(year_path.iterdir()):
            if not race_path.is_dir():
                continue
            
            race_name = race_path.name
            
            for session in sessions:
                session_path = race_path / session
                if not session_path.exists():
                    continue
                
                try:
                    # Auto-detect round number from order
                    races_before = sum(1 for r in sorted(year_path.iterdir()) 
                                      if r.is_dir() and r.name < race_name)
                    round_num = races_before + 1
                    
                    result = run_silver_transform(
                        year=year,
                        race_name=race_name,
                        session=session,
                        round_num=round_num,
                        verbose=verbose
                    )
                    
                    if result:
                        total_transformed += len(result)
                    
                except Exception as e:
                    errors.append({
                        "year": year,
                        "race": race_name,
                        "session": session,
                        "error": str(e)
                    })
                    if verbose:
                        print(f"❌ Error: {e}")
    
    if verbose:
        print(f"\n{'='*60}")
        print(f"SILVER LAYER PROCESSING COMPLETE")
        print(f"{'='*60}")
        print(f"Total sessions processed: {total_transformed}")
        if errors:
            print(f"Errors: {len(errors)}")
            for e in errors[:5]:
                print(f"  - {e['year']} {e['race']} {e['session']}: {e['error']}")
    
    return {"transformed": total_transformed, "errors": errors}


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Silver Layer Transformation")
    parser.add_argument("--year", type=int, help="Specific year to process")
    parser.add_argument("--race", type=str, help="Specific race to process")
    parser.add_argument("--session", type=str, default="R", 
                        help="Session type (Q, R, S, SS)")
    parser.add_argument("--all", action="store_true",
                        help="Process all years and sessions")
    parser.add_argument("--quiet", action="store_true",
                        help="Less verbose output")
    
    args = parser.parse_args()
    
    if args.all:
        process_all_sessions(verbose=not args.quiet)
    elif args.year and args.race:
        run_silver_transform(
            year=args.year,
            race_name=args.race,
            session=args.session,
            verbose=not args.quiet
        )
    else:
        parser.print_help()
