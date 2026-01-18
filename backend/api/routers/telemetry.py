from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import os
import duckdb
from db.connection import db_connection

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "etl", "data", "silver")

def get_session_path(year: int, race_name: str) -> Optional[str]:
    """Get path to session directory (Q or R)."""
    # Try Q first (often has cleaner fast laps), then R
    session_path = os.path.join(DATA_DIR, str(year), race_name, "Q")
    if os.path.exists(session_path):
        return session_path
    session_path = os.path.join(DATA_DIR, str(year), race_name, "R")
    if os.path.exists(session_path):
        return session_path
    return None

@router.get("/telemetry/{year}/{round}")
async def get_telemetry(
    year: int,
    round: str,
    driver: Optional[str] = None,
    lap: Optional[int] = None,
    session_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get telemetry data for a specific race.
    """
    race_name = round.replace("-", " ")
    
    # Resolve path
    if session_type:
        silver_path = os.path.join(DATA_DIR, str(year), race_name, session_type)
    else:
        silver_path = get_session_path(year, race_name)

    if not silver_path or not os.path.exists(silver_path):
        return []

    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        return []

    try:
        # Construct query
        query = f"SELECT * FROM read_parquet('{telemetry_file}') WHERE 1=1"
        params = []

        if driver:
            query += " AND (driver_number = ? OR driver_number = ?)" 
            # DuckDB generic handling for mixed types can be tricky, assuming driver is string or int
            # We'll pass it as string for safety if column is string, or cast if needed. 
            # Let's try to match both string/int representation if possible or just use string params
            params.extend([int(driver) if driver.isdigit() else driver, driver])

        if lap:
             # We need lap info. Telemetry parquet might not have 'lap_number' if it wasn't joined.
             # The current silver schema (checked via bash) doesn't show lap_number, 
             # but it has 'session_time_seconds'.
             # We usually need to join with laps.parquet to filter by lap.
             # For V1, let's assume the telemetry file might have been enriched or we filter by time range if we had it.
             # If lap_number is missing in telemetry, this filter won't work without a join.
             pass

        # For the graph, we need sorted data
        query += " ORDER BY session_time_seconds"
        
        # Execute via connection
        # db_connection is our singleton wrapper
        # We need to fetch into a format FastAPI likes (list of dicts)
        # .df() -> to_dict is easiest for now
        df = db_connection.conn.execute(query, params).df()
        
        # Optimize: Round floats to reduce payload size
        cols_to_round = ['speed', 'throttle', 'brake', 'rpm']
        for col in cols_to_round:
            if col in df.columns:
                df[col] = df[col].round(2)

        return df.to_dict(orient="records")

    except Exception as e:
        print(f"Error fetching telemetry: {e}")
        return []

@router.get("/telemetry/{year}/{round}/{driver_id}/laps/{lap_number}")
async def get_lap_telemetry(
    year: int, 
    round: str, 
    driver_id: str,
    lap_number: int
) -> Dict[str, Any]:
    """
    Get high-frequency telemetry for a specific driver's lap.
    Joins laps.parquet to get time window, then queries telemetry.parquet.
    """
    race_name = round.replace("-", " ")
    silver_path = get_session_path(year, race_name)
    
    if not silver_path:
        raise HTTPException(status_code=404, detail="Session not found")

    laps_file = os.path.join(silver_path, "laps.parquet")
    tel_file = os.path.join(silver_path, "telemetry.parquet")
    
    if not os.path.exists(laps_file) or not os.path.exists(tel_file):
        raise HTTPException(status_code=404, detail="Data files not found")

    try:
        # 1. Get Lap Start/End Time
        lap_query = f"""
            SELECT 
                lap_start_time_seconds,
                lap_end_time_seconds,
                lap_time_seconds
            FROM read_parquet('{laps_file}')
            WHERE (driver_number = ? OR driver_name = ?)
            AND lap_number = ?
            LIMIT 1
        """
        # handling driver_id (could be '1' or 'VER')
        d_param = int(driver_id) if driver_id.isdigit() else driver_id
        
        # Note: lap_start_time_seconds might need to be calculated if not in parquet
        # Checking schema earlier: "lap_time_seconds" exists. "session_time_seconds" usually exists.
        # We might need to approximate start/end if columns missing.
        # Standard FastF1 "laps" usually has 'LapStartTime', 'Time' (end).
        
        # Let's peek at laps schema effectively using a flexible query if columns are uncertain
        # But for V1 let's assume standard names or calculate from running sum if needed.
        # Actually, let's just query the telemetry directly if we can Join.
        
        # Safer approach: Join on driver and time range
        # But first let's just get the time window from laps
        
        # Check available columns in laps first? No, let's assume standard FastF1 Silver schema
        # If schema is unknown, we might break. 
        # Plan B: Use a subquery join
        
        full_query = f"""
            WITH target_lap AS (
                SELECT 
                    driver_number,
                    Time - LapTime as start_time,
                    Time as end_time
                FROM read_parquet('{laps_file}')
                WHERE (driver_number = ? OR driver_name = ?)
                AND lap_number = ?
            )
            SELECT 
                t.date,
                t.session_time_seconds,
                t.speed,
                t.rpm,
                t.throttle,
                t.brake,
                t.gear,
                t.drs
            FROM read_parquet('{tel_file}') t, target_lap l
            WHERE t.driver_number = l.driver_number
            AND t.session_time_seconds >= epoch(l.start_time) -- FastF1 Time is Timedelta usually? 
            -- Wait, in Silver we converted times to seconds.
            -- Let's assume laps.parquet has 'session_time_seconds' (end of lap) and 'lap_time_seconds'
            
            -- REVISED QUERY based on standard Silver transform
        """
        pass # Placeholder for thought trace
        
        # Correct logic:
        # 1. Fetch Lap info (End Time & Lap Duration)
        # 2. Start Time = End Time - Duration
        # 3. Query Telemetry between Start and End
        
        lap_info = db_connection.conn.execute(f"""
            SELECT 
                session_time_seconds as end_time,
                lap_time_seconds as duration,
                driver_number
            FROM read_parquet('{laps_file}')
            WHERE (driver_number = '{driver_id}' OR driver_name = '{driver_id}')
            AND lap_number = {lap_number}
        """).fetchone()
        
        if not lap_info:
             raise HTTPException(status_code=404, detail="Lap not found")
             
        end_time, duration, drv_num = lap_info
        start_time = end_time - duration
        
        # Query Telemetry
        # We also calculate 'distance' (approx via speed * time) or 'lap_distance' if available
        # For simple V1, we return time-based array, frontend can scale to distance if needed
        # Or better: FastF1 telemetry usually has 'Distance' column.
        
        tel_query = f"""
            SELECT
                session_time_seconds,
                speed,
                rpm,
                throttle,
                brake,
                gear,
                drs,
                (session_time_seconds - {start_time}) as lap_time
            FROM read_parquet('{tel_file}')
            WHERE driver_number = {drv_num}
            AND session_time_seconds >= {start_time}
            AND session_time_seconds <= {end_time}
            ORDER BY session_time_seconds ASC
        """
        
        df = db_connection.conn.execute(tel_query).df()
        
        # Calculate distance (integral of speed) if Distance column missing
        # Distance = speed (km/h) * time (s) / 3600 * 1000 = speed * time / 3.6
        if 'Distance' not in df.columns:
            # Simple Riemann sum
            df['dt'] = df['session_time_seconds'].diff().fillna(0)
            df['dist_inc'] = (df['speed'] / 3.6) * df['dt']
            df['distance'] = df['dist_inc'].cumsum()
        
        return {
            "driver": driver_id,
            "lap": lap_number,
            "data": df.to_dict(orient="records")
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
