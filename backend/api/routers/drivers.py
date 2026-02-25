from fastapi import APIRouter, Query
from typing import List, Dict, Any, Optional
import os
import duckdb
from ..utils import resolve_dir, normalize_session_code
from ..config import SILVER_DIR

router = APIRouter()


def _fetchall(sql: str, params: List[Any]) -> List[Any]:
    conn = duckdb.connect()
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def _fetchone(sql: str, params: List[Any]) -> Any:
    conn = duckdb.connect()
    try:
        return conn.execute(sql, params).fetchone()
    finally:
        conn.close()

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
        schema = _fetchall("DESCRIBE SELECT * FROM read_parquet(?)", [laps_file])
        columns = {str(row[0]) for row in schema}

        has_driver_name = "driver_name" in columns
        has_team_name = "team_name" in columns

        name_expr = "CAST(driver_name AS VARCHAR)" if has_driver_name else "CAST(driver_number AS VARCHAR)"
        team_expr = "CAST(team_name AS VARCHAR)" if has_team_name else "NULL"
        order_expr = "driver_name" if has_driver_name else "driver_number"

        query = f"""
            SELECT DISTINCT
                {name_expr} AS driver_name,
                CAST(driver_number AS INTEGER) AS driver_number,
                {team_expr} AS team_name
            FROM read_parquet(?)
            WHERE driver_number IS NOT NULL
            ORDER BY {order_expr}
            LIMIT ?
        """
        result = _fetchall(query, [laps_file, int(limit)])
        
        return [{
            "driver": row[0] if row[0] else str(row[1]),
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
        schema = _fetchall("DESCRIBE SELECT * FROM read_parquet(?)", [laps_file])
        columns = {str(row[0]) for row in schema}

        has_driver_name = "driver_name" in columns
        has_team_name = "team_name" in columns

        if driver_id.isdigit():
            where_clause = "driver_number = ?"
            params: List[Any] = [laps_file, int(driver_id)]
        else:
            if not has_driver_name:
                return {"error": "Driver not found"}
            where_clause = "driver_name = ?"
            params = [laps_file, driver_id]

        name_expr = "CAST(driver_name AS VARCHAR)" if has_driver_name else "CAST(driver_number AS VARCHAR)"
        team_expr = "CAST(team_name AS VARCHAR)" if has_team_name else "NULL"

        result = _fetchone(
            f"""
            SELECT DISTINCT
                {name_expr} AS driver_name,
                CAST(driver_number AS INTEGER) AS driver_number,
                {team_expr} AS team_name
            FROM read_parquet(?)
            WHERE {where_clause}
            LIMIT 1
            """,
            params,
        )
        
        if result:
            return {
                "driver": result[0] if result[0] else str(result[1]),
                "driver_number": result[1],
                "team": result[2]
            }
        return {"error": "Driver not found"}
    except Exception as e:
        print(f"Error fetching driver: {e}")
        return {"error": "Driver not found"}
