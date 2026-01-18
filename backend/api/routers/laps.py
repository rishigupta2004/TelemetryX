from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import duckdb
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "etl", "data", "silver")
DB_PATH = os.path.join(BASE_DIR, "..", "telemetryx.duckdb")


@router.get("/laps/{year}/{round}")
async def get_laps(year: int, round: str, valid_only: bool = False) -> List[Dict[str, Any]]:
    """
    Get lap times for a specific race.
    
    Query params:
        - valid_only: If true, only return valid laps (60-600s, not deleted)
    
    Returns laps with:
        - driver_name: Full driver name
        - driver_number: FIA driver number
        - lap_number: Lap number
        - lap_time_formatted: "M:SS.mmm" format
        - lap_time_seconds: Seconds (for calculations)
        - team_name: Team name
        - position: Finishing position
        - tyre_compound: SOFT/MEDIUM/HARD/INTER/WET
        - is_valid_lap: Whether lap is valid for stats
        - is_deleted: Whether lap was deleted
    """
    race_name = round.replace("-", " ")
    
    # Query the silver layer directly
    silver_path = os.path.join(DATA_DIR, str(year), race_name, "Q")
    if not os.path.exists(silver_path):
        silver_path = os.path.join(DATA_DIR, str(year), race_name, "R")
    
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        raise HTTPException(status_code=404, detail=f"No lap data found for {year} {race_name}")
    
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        query = f"""
            SELECT 
                driver_name,
                driver_number,
                lap_number,
                lap_time_formatted,
                lap_time_seconds,
                team_name,
                position,
                tyre_compound,
                is_valid_lap,
                is_deleted,
                deletion_reason
            FROM read_parquet(?)
        """
        params = [laps_file]
        
        if valid_only:
            query += " WHERE is_valid_lap = true"
        
        query += " ORDER BY driver_name, lap_number"
        
        result = conn.execute(query, params).fetchall()
        
        columns = ["driver_name", "driver_number", "lap_number", "lap_time_formatted",
                   "lap_time_seconds", "team_name", "position", "tyre_compound",
                   "is_valid_lap", "is_deleted", "deletion_reason"]
        
        return [dict(zip(columns, row)) for row in result]
    finally:
        conn.close()


@router.get("/laps/{year}/{round}/{driver_id}")
async def get_driver_laps(year: int, round: str, driver_id: str, 
                         valid_only: bool = False) -> List[Dict[str, Any]]:
    """
    Get lap times for a specific driver in a specific race.
    
    Query params:
        - valid_only: If true, only return valid laps (60-600s, not deleted)
    """
    race_name = round.replace("-", " ")
    
    # Query the silver layer directly
    silver_path = os.path.join(DATA_DIR, str(year), race_name, "Q")
    if not os.path.exists(silver_path):
        silver_path = os.path.join(DATA_DIR, str(year), race_name, "R")
    
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        raise HTTPException(status_code=404, detail=f"No lap data found for {year} {race_name}")
    
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        # Try driver name first, then driver number
        query = f"""
            SELECT 
                driver_name,
                driver_number,
                lap_number,
                lap_time_formatted,
                lap_time_seconds,
                team_name,
                position,
                tyre_compound,
                is_valid_lap,
                is_deleted,
                deletion_reason
            FROM read_parquet(?)
            WHERE driver_name = ? OR driver_number = ?
        """
        params = [laps_file, driver_id, driver_id]
        
        if valid_only:
            query += " AND is_valid_lap = true"
        
        query += " ORDER BY lap_number"
        
        result = conn.execute(query, params).fetchall()
        
        columns = ["driver_name", "driver_number", "lap_number", "lap_time_formatted",
                   "lap_time_seconds", "team_name", "position", "tyre_compound",
                   "is_valid_lap", "is_deleted", "deletion_reason"]
        
        return [dict(zip(columns, row)) for row in result]
    finally:
        conn.close()


@router.get("/fastest-lap/{year}/{round}")
async def get_fastest_lap(year: int, round: str) -> Dict[str, Any]:
    """
    Get the fastest lap for a specific race.
    
    Returns:
        - driver_name, driver_number
        - lap_time_formatted, lap_time_seconds
        - lap_number
        - team_name
        - tyre_compound
    """
    race_name = round.replace("-", " ")
    
    silver_path = os.path.join(DATA_DIR, str(year), race_name, "Q")
    if not os.path.exists(silver_path):
        silver_path = os.path.join(DATA_DIR, str(year), race_name, "R")
    
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        raise HTTPException(status_code=404, detail=f"No lap data found for {year} {race_name}")
    
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        query = f"""
            SELECT 
                driver_name,
                driver_number,
                lap_number,
                lap_time_formatted,
                lap_time_seconds,
                team_name,
                tyre_compound
            FROM read_parquet(?)
            WHERE is_valid_lap = true
            ORDER BY lap_time_seconds ASC
            LIMIT 1
        """
        result = conn.execute(query, [laps_file]).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No valid laps found")
        
        return {
            "driver_name": result[0],
            "driver_number": result[1],
            "lap_number": result[2],
            "lap_time_formatted": result[3],
            "lap_time_seconds": result[4],
            "team_name": result[5],
            "tyre_compound": result[6]
        }
    finally:
        conn.close()


@router.get("/head-to-head/{year}/{round}/{driver1}/{driver2}")
async def get_head_to_head(year: int, round: str, driver1: str, driver2: str) -> Dict[str, Any]:
    """
    Compare fastest laps between two drivers.
    
    Returns:
        - Driver 1 info
        - Driver 2 info  
        - Difference in seconds
        - Interpretation (who is faster by how much)
    """
    import pandas as pd
    
    race_name = round.replace("-", " ")
    
    silver_path = os.path.join(DATA_DIR, str(year), race_name, "Q")
    if not os.path.exists(silver_path):
        silver_path = os.path.join(DATA_DIR, str(year), race_name, "R")
    
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        raise HTTPException(status_code=404, detail=f"No lap data found for {year} {race_name}")
    
    try:
        df = pd.read_parquet(laps_file)
        
        # Filter for valid laps and the two drivers
        mask = (
            (df["is_valid_lap"] == True) & 
            ((df["driver_name"] == driver1.upper()) | (df["driver_name"] == driver1) |
             (df["driver_number"].astype(str) == driver1) |
             (df["driver_name"] == driver2.upper()) | (df["driver_name"] == driver2) |
             (df["driver_number"].astype(str) == driver2))
        )
        driver_df = df[mask]
        
        # Get fastest lap for each driver
        fastest = driver_df.groupby(["driver_name", "driver_number"])["lap_time_seconds"].min().reset_index()
        
        if len(fastest) < 2:
            raise HTTPException(status_code=404, detail="Could not find both drivers with valid laps")
        
        # Sort by fastest lap
        fastest = fastest.sort_values("lap_time_seconds")
        
        d1_name = fastest.iloc[0]["driver_name"]
        d1_num = fastest.iloc[0]["driver_number"]
        d1_time = fastest.iloc[0]["lap_time_seconds"]
        
        d2_name = fastest.iloc[1]["driver_name"]
        d2_num = fastest.iloc[1]["driver_number"]
        d2_time = fastest.iloc[1]["lap_time_seconds"]
        
        difference = d2_time - d1_time
        
        return {
            "driver_1": {
                "name": d1_name,
                "number": int(d1_num),
                "fastest_lap_formatted": f"{int(d1_time // 60)}:{d1_time % 60:06.3f}",
                "fastest_lap_seconds": d1_time
            },
            "driver_2": {
                "name": d2_name,
                "number": int(d2_num),
                "fastest_lap_formatted": f"{int(d2_time // 60)}:{d2_time % 60:06.3f}",
                "fastest_lap_seconds": d2_time
            },
            "difference": f"+{difference:.3f}",
            "difference_seconds": difference,
            "interpretation": f"{d2_name} is {difference:.3f}s slower than {d1_name}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
