from fastapi import APIRouter, Query
from typing import List, Dict, Any, Optional
import os
from db.connection import db_connection
from ..utils import resolve_dir, normalize_session_code
from ..config import SILVER_DIR

router = APIRouter()

@router.get("/drivers/{year}/{round}")
async def get_drivers(
    year: int,
    round: str,
    session_type: Optional[str] = None,
    limit: int = Query(default=40, ge=1, le=200),
) -> List[Dict[str, Any]]:
    race_name = round.replace("-", " ")
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return []
    
    if session_type:
        silver_path = os.path.join(year_path, race_dir, normalize_session_code(session_type))
    else:
        silver_path = os.path.join(year_path, race_dir, "Q")
        if not os.path.exists(silver_path):
            silver_path = os.path.join(year_path, race_dir, "R")
        
    if not os.path.exists(silver_path):
        return []
        
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        return []

    try:
        query = """
            SELECT DISTINCT 
                driver_name, 
                driver_number,
                team_name
            FROM read_parquet(?)
            WHERE driver_name IS NOT NULL
            ORDER BY driver_name
            LIMIT ?
        """
        result = db_connection.conn.execute(query, [laps_file, int(limit)]).fetchall()
        
        return [{
            "driver": row[0],
            "driver_number": row[1], 
            "team": row[2]
        } for row in result]
    except Exception as e:
        print(f"Error fetching drivers: {e}")
        return []

@router.get("/drivers/{year}/{round}/{driver_id}")
async def get_driver(year: int, round: str, driver_id: str, session_type: Optional[str] = None) -> Dict[str, Any]:
    race_name = round.replace("-", " ")
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return {"error": "Session not found"}
    
    if session_type:
        silver_path = os.path.join(year_path, race_dir, normalize_session_code(session_type))
    else:
        silver_path = os.path.join(year_path, race_dir, "Q")
        if not os.path.exists(silver_path):
            silver_path = os.path.join(year_path, race_dir, "R")
        
    if not os.path.exists(silver_path):
        return {"error": "Session not found"}
        
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        return {"error": "Data not found"}

    try:
        # Handle driver ID (name or number)
        where_clause = "driver_number = ?" if driver_id.isdigit() else "driver_name = ?"
        param = int(driver_id) if driver_id.isdigit() else driver_id
        
        result = db_connection.conn.execute("""
            SELECT DISTINCT 
                driver_name, 
                driver_number,
                team_name
            FROM read_parquet(?)
            WHERE {where_clause}
            LIMIT 1
        """.replace("{where_clause}", where_clause), [laps_file, param]).fetchone()
        
        if result:
            return {
                "driver": result[0], 
                "driver_number": result[1],
                "team": result[2]
            }
        return {"error": "Driver not found"}
    except Exception as e:
        print(f"Error fetching driver: {e}")
        return {"error": "Driver not found"}
