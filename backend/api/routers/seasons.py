from fastapi import APIRouter
from typing import List, Dict, Any
import os

router = APIRouter()

BRONZE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "etl", "data", "bronze")


def get_years():
    """Get all available years from bronze data."""
    years = []
    for year_dir in sorted(os.listdir(BRONZE_DIR), reverse=True):
        if year_dir.isdigit():
            years.append({"year": int(year_dir)})
    return years


@router.get("/seasons")
async def get_seasons() -> List[Dict[str, Any]]:
    """Get list of all available seasons (years)."""
    return get_years()


@router.get("/seasons/{year}")
async def get_season(year: int) -> Dict[str, Any]:
    """Get details for a specific season."""
    return {"year": year, "available": True}


@router.get("/seasons/{year}/races")
async def get_races_by_year(year: int) -> List[Dict[str, Any]]:
    """Get list of races for a specific year."""
    year_path = os.path.join(BRONZE_DIR, str(year))
    if not os.path.exists(year_path):
        return []
    
    races = []
    for race_dir in sorted(os.listdir(year_path)):
        if os.path.isdir(os.path.join(year_path, race_dir)):
            # Count sessions
            sessions = []
            for session in ["Q", "R", "S", "SS"]:
                if os.path.exists(os.path.join(year_path, race_dir, session)):
                    sessions.append(session)
            
            races.append({
                "name": race_dir,
                "sessions": sessions
            })
    
    return races
