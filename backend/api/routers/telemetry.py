from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import os
import duckdb
from db.connection import db_connection
from ..utils import resolve_dir, normalize_session_code
from ..config import SILVER_DIR

router = APIRouter()

def get_session_path(year: int, race_name: str) -> Optional[str]:
    """Get path to session directory (Q or R)."""
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return None
    # Try Q first (often has cleaner fast laps), then R
    session_path = os.path.join(year_path, race_dir, "Q")
    if os.path.exists(session_path):
        return session_path
    session_path = os.path.join(year_path, race_dir, "R")
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
        year_path = os.path.join(SILVER_DIR, str(year))
        race_dir = resolve_dir(year_path, race_name)
        if not race_dir:
            return []
        silver_path = os.path.join(year_path, race_dir, normalize_session_code(session_type))
    else:
        silver_path = get_session_path(year, race_name)

    if not silver_path or not os.path.exists(silver_path):
        return []

    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        return []

    try:
        # Base query structure
        query = f"SELECT * FROM read_parquet(?) WHERE 1=1"
        params = [telemetry_file]

        if driver:
            # Handle driver number lookup
            if not driver.isdigit():
                # Get number from laps file for 'VER' etc.
                laps_file = os.path.join(silver_path, "laps.parquet")
                if os.path.exists(laps_file):
                    # Use parameterized query for lookup
                    drv_row = db_connection.conn.execute(
                        f"SELECT driver_number FROM read_parquet(?) WHERE driver_name = ? LIMIT 1",
                        [laps_file, driver]
                    ).fetchone()
                    
                    if drv_row:
                        driver_num = drv_row[0]
                        query += " AND driver_number = ?"
                        params.append(int(driver_num))
                    else:
                        return [] # Driver not found
                else:
                    return []
            else:
                query += " AND driver_number = ?"
                params.append(int(driver))


        if lap:
             if not driver:
                 # Requires driver to filter by lap (simplification for V1)
                 # To support all drivers for a lap, we'd need to join or look up all start/ends
                 pass 
             else:
                 # Get lap time window for this driver
                 laps_file = os.path.join(silver_path, "laps.parquet")
                 if os.path.exists(laps_file):
                     # Reuse the params[-1] which is the driver number (int)
                     # Verify we added a driver param above
                     if params and isinstance(params[-1], int):
                        current_driver_num = params[-1]
                        
                        lap_info = db_connection.conn.execute(f"""
                            SELECT 
                                session_time_seconds as end_time,
                                lap_time_seconds as duration
                            FROM read_parquet(?)
                            WHERE driver_number = ?
                            AND lap_number = ?
                        """, [laps_file, current_driver_num, lap]).fetchone()
                        
                        if lap_info:
                            end_time, duration = lap_info
                            start_time = end_time - duration
                            query += " AND session_time_seconds >= ? AND session_time_seconds <= ?"
                            params.extend([start_time, end_time])

        # For the graph, we need sorted data
        query += " ORDER BY session_time_seconds"
        
        # Execute with params
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
        
        # Handle driver ID (name or number)
        # Fix: Ensure d_param is treated correctly. 
        # If it's a digit (e.g. '1'), query using driver_number.
        # If string (e.g. 'VER'), query using driver_name.
        
        # d_param logic fix:
        try:
            driver_num_int = int(d_param)
            where_clause = f"driver_number = {driver_num_int}"
        except ValueError:
            where_clause = f"driver_name = '{d_param}'"

        lap_info = db_connection.conn.execute(f"""
            SELECT 
                session_time_seconds as end_time,
                lap_time_seconds as duration,
                driver_number
            FROM read_parquet('{laps_file}')
            WHERE {where_clause}
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
        
        # Check if 'n_gear' column exists, if not use 'gear'
        # The bash check showed 'n_gear' is NOT in standard parquet but 'gear' IS?
        # Actually in silver/telemetry.parquet, checking earlier schema, it has 14 columns.
        # Let's just select * to be safe or check columns
        
        # Try standard column names first (FastF1 usually uses 'n_gear' or 'gear')
        # Based on schema check: 'gear' is the column name
        
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
