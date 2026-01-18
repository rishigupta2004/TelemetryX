from fastapi import APIRouter
from typing import List, Dict, Any
import duckdb
import os

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "..", "telemetryx.duckdb")

def get_races(year: int) -> List[Dict[str, Any]]:
    """Get all races for a given year."""
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        result = conn.execute("""
            SELECT DISTINCT year, round_number, session_name
            FROM races
            WHERE year = ?
            ORDER BY round_number
        """, [year]).fetchall()
        return [{"year": row[0], "round": row[1], "session": row[2]} for row in result]
    finally:
        conn.close()

@router.get("/races/{year}")
async def get_races_endpoint(year: int) -> List[Dict[str, Any]]:
    return get_races(year)

@router.get("/races/{year}/{round}")
async def get_race(year: int, round: str) -> Dict[str, Any]:
    races = get_races(year)
    for i, race in enumerate(races):
        if race["race_name"].lower().replace(" ", "-") == round.lower().replace(" ", "-"):
            return {"round": i + 1, **race}
    return {"error": "Race not found"}
