from fastapi import APIRouter
from typing import List, Dict, Any
import os
import duckdb

router = APIRouter()

from ..config import SILVER_DIR
from ..utils import display_session_code, normalize_key
from ..catalog import calendar_order


def get_years():
    """Get all available years from processed silver data."""
    years = []
    if not os.path.exists(SILVER_DIR):
        return years
    for year_dir in sorted(os.listdir(SILVER_DIR), reverse=True):
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
async def get_races_by_year(year: int, include_timestamps: bool = False) -> List[Dict[str, Any]]:
    """Get list of races for a specific year."""
    year_path = os.path.join(str(SILVER_DIR), str(year))
    if not os.path.exists(year_path):
        return []
    
    races = []

    def _read_sort_date(race_dir: str) -> str:
        """Best-effort race ordering key.

        Uses earliest lap timestamp from available session parquet, which reflects calendar order
        without relying on any placeholder `round` fields.
        """
        for sess in ["R", "Q", "S", "SS"]:
            laps_file = os.path.join(year_path, race_dir, sess, "laps.parquet")
            if not os.path.exists(laps_file):
                continue
            try:
                conn = duckdb.connect()
                try:
                    row = conn.execute(
                        f"SELECT MIN(LapStartDate) FROM read_parquet('{laps_file}') WHERE LapStartDate IS NOT NULL"
                    ).fetchone()
                finally:
                    conn.close()
                if row and row[0] is not None:
                    return str(row[0])
            except Exception:
                continue
        return ""

    for race_dir in os.listdir(year_path):
        if os.path.isdir(os.path.join(year_path, race_dir)):
            # Count sessions
            sessions = []
            for session in ["Q", "R", "S", "SS"]:
                if os.path.exists(os.path.join(year_path, race_dir, session)):
                    sessions.append(display_session_code(session))
            
            races.append({
                "name": race_dir,
                "sessions": sessions,
                "startDate": _read_sort_date(race_dir) if include_timestamps else "",
            })
    
    # Sort by calendar round when available; fall back to name.
    order = calendar_order(year)
    order_map = {normalize_key(name): idx for idx, name in enumerate(order)}
    def _sort_key(r):
        name = str(r.get("name") or "")
        key = normalize_key(name)
        if key in order_map:
            return (0, order_map[key])
        return (1, str(r.get("startDate") or "9999"), name)
    races.sort(key=_sort_key)
    return races
