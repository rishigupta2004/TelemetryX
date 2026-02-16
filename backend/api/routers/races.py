from fastapi import APIRouter, Query
from typing import List, Dict, Any
import duckdb
import os
import pandas as pd
from ..utils import normalize_key, read_parquet_df, resolve_dir
from ..catalog import calendar_order
from ..utils import display_session_code
from ..config import SILVER_DIR, BRONZE_DIR

router = APIRouter()

def get_races_from_fs(year: int) -> List[Dict[str, Any]]:
    """Get all races for a given year from filesystem."""
    year_path = os.path.join(str(SILVER_DIR), str(year))
    if not os.path.exists(year_path):
        return []

    # Calendar order from catalog (if available)
    calendar = calendar_order(year)
    available_dirs = [d for d in os.listdir(year_path) if os.path.isdir(os.path.join(year_path, d))]
    available_norm = {normalize_key(d): d for d in available_dirs}

    def _sessions_for(race_path: str) -> List[str]:
        sessions = []
        for sess in ["Q", "R", "S", "SS"]:
            if os.path.exists(os.path.join(race_path, sess)):
                sessions.append(display_session_code(sess))
        return sessions

    races: List[Dict[str, Any]] = []
    used = set()
    round_no = 0

    for race_name in calendar:
        dir_name = resolve_dir(year_path, race_name)
        if not dir_name:
            dir_name = available_norm.get(normalize_key(race_name))
        if not dir_name:
            continue
        race_path = os.path.join(year_path, dir_name)
        sessions = _sessions_for(race_path)
        if not sessions:
            continue
        round_no += 1
        used.add(dir_name)
        races.append(
            {
                "year": year,
                "round": round_no,
                "race_name": dir_name,
                "sessions": sessions,
                "display_name": race_name,
            }
        )

    # Append any races not in the calendar (alphabetical fallback)
    for dir_name in sorted(available_dirs):
        if dir_name in used:
            continue
        race_path = os.path.join(year_path, dir_name)
        sessions = _sessions_for(race_path)
        if not sessions:
            continue
        round_no += 1
        races.append(
            {
                "year": year,
                "round": round_no,
                "race_name": dir_name,
                "sessions": sessions,
                "display_name": dir_name,
            }
        )
    return races

@router.get("/races/{year}")
async def get_races_endpoint(year: int) -> List[Dict[str, Any]]:
    return get_races_from_fs(year)

@router.get("/races/{year}/{round}")
async def get_race(year: int, round: str) -> Dict[str, Any]:
    # Support lookup by round number (str) or race name (slug)
    races = get_races_from_fs(year)
    search_key = normalize_key(round)
    
    for race in races:
        # Check if round matches (as string)
        if str(race["round"]) == round:
            return race
        
        # Check if name matches
        if normalize_key(race["race_name"]) == search_key:
            return race
            
    return {"error": "Race not found"}

@router.get("/races/{year}/{round}/stints")
async def get_stints(
    year: int,
    round: str,
    limit: int = Query(default=2000, ge=1, le=20000),
) -> List[Dict[str, Any]]:
    """Get stint data for the race."""
    race_info = await get_race(year, round)
    if "error" in race_info:
        return []
    
    race_name = race_info["race_name"]
    
    # Try R session first (stints usually only relevant for Race)
    session_path = os.path.join(str(SILVER_DIR), str(year), race_name, "R")
        
    if not os.path.exists(session_path):
        session_path = None

    stints_file = os.path.join(session_path, "stints.parquet") if session_path else None
    if not stints_file or not os.path.exists(stints_file):
        # Fallback: bronze OpenF1 stints
        # bronze/{year}/{race}/{session}/openf1/stints.parquet
        candidate = os.path.join(str(BRONZE_DIR), str(year), race_name, "R", "openf1", "stints.parquet")
        if os.path.exists(candidate):
            stints_file = candidate
        else:
            # Last resort: any stints file under bronze race folder
            race_root = os.path.join(str(BRONZE_DIR), str(year), race_name)
            found = None
            if os.path.exists(race_root):
                for root, _, files in os.walk(race_root):
                    if "stints.parquet" in files:
                        found = os.path.join(root, "stints.parquet")
                        break
            if found:
                stints_file = found
            else:
                return []

    try:
        df = read_parquet_df(stints_file)
        if len(df) > int(limit):
            df = df.head(int(limit))
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error reading stints: {e}")
        return []

@router.get("/races/{year}/{round}/control")
async def get_race_control(
    year: int,
    round: str,
    limit: int = Query(default=1000, ge=1, le=10000),
) -> List[Dict[str, Any]]:
    """Get race control messages (Flags, Penalties, etc.)"""
    # Resolve race name
    race_info = await get_race(year, round)
    if "error" in race_info:
        return []
    
    race_name = race_info["race_name"]
    
    # Try R session first, then Q
    session_path = os.path.join(str(SILVER_DIR), str(year), race_name, "R")
    if not os.path.exists(session_path):
        session_path = os.path.join(str(SILVER_DIR), str(year), race_name, "Q")
        
    if not os.path.exists(session_path):
        return []

    rc_file = os.path.join(session_path, "race_control.parquet")
    if not os.path.exists(rc_file):
        return []

    try:
        df = read_parquet_df(rc_file)
        
        # Convert timestamps to string if needed
        if 'Time' in df.columns:
            df['Time'] = df['Time'].astype(str)
            
        if len(df) > int(limit):
            df = df.head(int(limit))
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error reading race control: {e}")
        return []
