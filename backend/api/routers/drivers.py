from fastapi import APIRouter
from typing import List, Dict, Any
import duckdb
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "etl", "data")
DB_PATH = os.path.join(BASE_DIR, "..", "telemetryx.duckdb")

@router.get("/drivers/{year}/{round}")
async def get_drivers(year: int, round: str) -> List[Dict[str, Any]]:
    race_name = round.replace("-", " ")
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        result = conn.execute(f"""
            SELECT DISTINCT driver, team
            FROM parquet_scan('{DATA_DIR}/silver/{{year}}/{{race_name}}/*/*.parquet')
            WHERE year = ? AND race_name = ?
            ORDER BY driver
        """, [year, race_name]).fetchall()
        return [{"driver": row[0], "team": row[1]} for row in result]
    finally:
        conn.close()

@router.get("/drivers/{year}/{round}/{driver_id}")
async def get_driver(year: int, round: str, driver_id: str) -> Dict[str, Any]:
    race_name = round.replace("-", " ")
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        result = conn.execute(f"""
            SELECT DISTINCT driver, team
            FROM parquet_scan('{DATA_DIR}/silver/{{year}}/{{race_name}}/*/*.parquet')
            WHERE year = ? AND race_name = ? AND driver = ?
        """, [year, race_name, driver_id]).fetchone()
        if result:
            return {"driver": result[0], "team": result[1]}
        return {"error": "Driver not found"}
    finally:
        conn.close()
