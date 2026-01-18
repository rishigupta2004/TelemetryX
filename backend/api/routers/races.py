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

@router.get("/races/{year}/{round}/control")
async def get_race_control(year: int, round: str) -> List[Dict[str, Any]]:
    """Get race control messages (Flags, Penalties, etc.)"""
    race_name = round.replace("-", " ")
    
    # Try R first, then Q
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    silver_dir = os.path.join(base_path, "etl", "data", "silver")
    
    # Try R session first for race control
    session_path = os.path.join(silver_dir, str(year), race_name, "R")
    if not os.path.exists(session_path):
        session_path = os.path.join(silver_dir, str(year), race_name, "Q")
        
    if not os.path.exists(session_path):
        return []

    rc_file = os.path.join(session_path, "race_control.parquet")
    if not os.path.exists(rc_file):
        return []

    try:
        conn = duckdb.connect(database=":memory:", read_only=False)
        # FastF1 RaceControl often has: Time, Category, Message, Driver, etc.
        # We need to check schema or just select *
        query = f"SELECT * FROM read_parquet('{rc_file}') ORDER BY Time"
        df = conn.execute(query).df()
        
        # Convert Time/Date to string if needed
        # Assuming Time is timedelta or datetime
        if 'Time' in df.columns:
            df['Time'] = df['Time'].astype(str)
            
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error reading race control: {e}")
        return []
