from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
import os
import json
import datetime
import pandas as pd
import duckdb
import logging
from pathlib import Path
from ..driver_mapping import get_driver_name, get_team_name
from ..cache import cache_get, cache_set
from ..utils import (
    resolve_dir,
    resolve_track_geometry_file,
    normalize_key,
    normalize_session_code,
    display_session_code,
)
from ..config import SILVER_DIR, BRONZE_DIR, GOLD_DIR, TRACK_GEOMETRY_DIR, TRACK_GEOMETRY_MANUAL_DIR
from ..catalog import race_key_for_name, load_season_catalog
from functools import lru_cache

logger = logging.getLogger(__name__)

router = APIRouter()

_track_geometry_cache = {}


def telemetry_unavailable_reason(year: int, race_name: str, session: str) -> Optional[str]:
    if year == 2018 and normalize_key(race_name) == normalize_key("Bahrain Grand Prix") and session.upper() == "R":
        return "Telemetry unavailable for this session due to FIA data restrictions."
    return None


def get_session_path(year: int, race_name: str, session: str) -> Optional[str]:
    session = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return None
    silver_path = os.path.join(year_path, race_dir, session)
    if os.path.exists(silver_path):
        return silver_path
    return None


def get_team_color(team_name: Optional[str]) -> str:
    if not team_name:
        return ""
    key = team_name.lower().strip()
    # Common substrings across seasons/sponsors
    if "red bull" in key:
        return "#3671C6"
    if "mercedes" in key:
        return "#27F4D2"
    if "mclaren" in key:
        return "#FF8700"
    if "ferrari" in key:
        return "#E8002D"
    if "alpine" in key:
        return "#0093CC"
    if "aston martin" in key:
        return "#229971"
    if "williams" in key:
        return "#64C4FF"
    if "haas" in key:
        return "#B6BABD"
    if "alfa romeo" in key:
        return "#C92D2D"
    if "sauber" in key or "kick" in key or "stake" in key:
        return "#00E701"
    if "alpha tauri" in key or "racing bulls" in key or "visa cash app" in key or key == "rb":
        return "#5E8FAA"
    if "renault" in key:
        return "#FFCE00"
    return ""


def _parse_driver_numbers(value: Optional[str]) -> List[int]:
    if not value:
        return []
    out: List[int] = []
    for part in str(value).split(","):
        part = part.strip()
        if not part:
            continue
        if part.isdigit():
            out.append(int(part))
    return sorted({int(x) for x in out})


def load_drivers(silver_path: str, year: Optional[int] = None) -> list:
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        return []
    
    conn = duckdb.connect()
    try:
        # Check which columns are available (FastF1 vs OpenF1)
        schema_query = f"DESCRIBE SELECT * FROM read_parquet('{laps_file}')"
        columns = {row[0] for row in conn.execute(schema_query).fetchall()}
        
        # FastF1 has driver_name and team_name, OpenF1 only has driver_number
        if 'driver_name' in columns:
            query = f"""
                SELECT DISTINCT driver_name, driver_number, team_name
                FROM read_parquet('{laps_file}')
                WHERE driver_name IS NOT NULL
                ORDER BY driver_name
            """
            result = conn.execute(query).fetchall()
            drivers = []
            for row in result:
                driver_name = row[0]
                driver_number = row[1]
                team_name = row[2] or get_team_name(row[1])
                team_color = get_team_color(team_name)
                if year:
                    from ..catalog import canonical_driver_info

                    info = canonical_driver_info(int(year), str(driver_number), str(driver_name))
                    if info:
                        driver_name = info.get("driver_name") or driver_name
                        team_name = info.get("team_name") or team_name
                        team_color = info.get("team_color") or team_color
                drivers.append(
                    {
                        "driverName": driver_name,
                        "driverNumber": driver_number,
                        "teamName": team_name,
                        "teamColor": team_color,
                    }
                )
            return drivers
        else:
            # OpenF1 schema - only has driver_number, use mapping
            query = f"""
                SELECT DISTINCT driver_number
                FROM read_parquet('{laps_file}')
                WHERE driver_number IS NOT NULL
                ORDER BY driver_number
            """
            result = conn.execute(query).fetchall()
            drivers = []
            for row in result:
                driver_number = row[0]
                driver_name = get_driver_name(driver_number)
                team_name = get_team_name(driver_number)
                team_color = get_team_color(team_name)
                if year:
                    from ..catalog import canonical_driver_info

                    info = canonical_driver_info(int(year), str(driver_number), str(driver_name))
                    if info:
                        driver_name = info.get("driver_name") or driver_name
                        team_name = info.get("team_name") or team_name
                        team_color = info.get("team_color") or team_color
                drivers.append(
                    {
                        "driverName": driver_name,
                        "driverNumber": driver_number,
                        "teamName": team_name,
                        "teamColor": team_color,
                    }
                )
            return drivers
    finally:
        conn.close()


def load_laps(silver_path: str, latest_only: bool = False) -> list:
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        return []
    
    conn = duckdb.connect()
    try:
        # Check which columns are available (FastF1 vs OpenF1)
        schema_query = f"DESCRIBE SELECT * FROM read_parquet('{laps_file}')"
        columns_in_file = {row[0] for row in conn.execute(schema_query).fetchall()}
        
        # Determine schema type
        is_fastf1 = 'driver_name' in columns_in_file
        
        if is_fastf1:
            # FastF1 schema
            if latest_only:
                session_code = os.path.basename(str(silver_path)).upper()
                # Qualifying data often has `position=0` in our parquet; compute classification by best lap.
                if session_code == "Q":
                    query = f"""
                        WITH candidates AS (
                            SELECT
                                driver_name,
                                driver_number,
                                lap_number,
                                lap_time_seconds,
                                lap_time_formatted,
                                session_time_seconds,
                                LapStartTime,
                                tyre_compound,
                                is_valid_lap,
                                is_deleted,
                                Sector1SessionTime,
                                Sector2SessionTime,
                                Sector3SessionTime
                            FROM read_parquet('{laps_file}')
                            WHERE lap_time_seconds IS NOT NULL
                              AND (is_deleted IS NULL OR is_deleted = FALSE)
                              AND (is_valid_lap IS NULL OR is_valid_lap = TRUE)
                        ),
                        best AS (
                            SELECT *,
                                   ROW_NUMBER() OVER (PARTITION BY driver_number ORDER BY lap_time_seconds) AS rn
                            FROM candidates
                        )
                        SELECT
                            driver_name,
                            driver_number,
                            lap_number,
                            lap_time_seconds,
                            lap_time_formatted,
                            session_time_seconds AS lapEndSeconds,
                            LapStartTime AS lapStartTime,
                            ROW_NUMBER() OVER (ORDER BY lap_time_seconds) AS position,
                            tyre_compound,
                            is_valid_lap,
                            is_deleted,
                            Sector1SessionTime,
                            Sector2SessionTime,
                            Sector3SessionTime
                        FROM best
                        WHERE rn = 1
                        ORDER BY position
                    """
                else:
                    query = f"""
                        SELECT 
                            driver_name,
                            driver_number,
                            lap_number,
                            lap_time_seconds,
                            lap_time_formatted,
                            session_time_seconds AS lapEndSeconds,
                            LapStartTime AS lapStartTime,
                            position,
                            tyre_compound,
                            is_valid_lap,
                            is_deleted,
                            Sector1SessionTime,
                            Sector2SessionTime,
                            Sector3SessionTime
                        FROM read_parquet('{laps_file}')
                        WHERE (driver_name, lap_number) IN (
                            SELECT driver_name, MAX(lap_number)
                            FROM read_parquet('{laps_file}')
                            GROUP BY driver_name
                        )
                        ORDER BY position
                    """
            else:
                query = f"""
                    SELECT 
                        driver_name,
                        driver_number,
                        lap_number,
                        lap_time_seconds,
                        lap_time_formatted,
                        session_time_seconds AS lapEndSeconds,
                        LapStartTime AS lapStartTime,
                        position,
                        tyre_compound,
                        is_valid_lap,
                        is_deleted,
                        Sector1SessionTime,
                        Sector2SessionTime,
                        Sector3SessionTime
                    FROM read_parquet('{laps_file}')
                    ORDER BY lap_number, driver_name
                """
            result = conn.execute(query).fetchall()
            columns = [
                "driverName",
                "driverNumber",
                "lapNumber",
                "lapTime",
                "lapTimeFormatted",
                "lapEndSeconds",
                "lapStartTime",
                "position",
                "tyreCompound",
                "isValid",
                "isDeleted",
                "sector1",
                "sector2",
                "sector3",
            ]
        else:
            # OpenF1 schema
            if latest_only:
                query = f"""
                    SELECT 
                        driver_number,
                        lap_number,
                        lap_time_seconds,
                        is_valid_lap,
                        duration_sector_1,
                        duration_sector_2,
                        duration_sector_3
                    FROM read_parquet('{laps_file}')
                    WHERE (driver_number, lap_number) IN (
                        SELECT driver_number, MAX(lap_number)
                        FROM read_parquet('{laps_file}')
                        GROUP BY driver_number
                    )
                    ORDER BY lap_number
                """
            else:
                query = f"""
                    SELECT 
                        driver_number,
                        lap_number,
                        lap_time_seconds,
                        is_valid_lap,
                        duration_sector_1,
                        duration_sector_2,
                        duration_sector_3
                    FROM read_parquet('{laps_file}')
                    ORDER BY lap_number, driver_number
                """
            result = conn.execute(query).fetchall()
            
            # Build laps with OpenF1 data + driver name mapping
            laps = []
            for row in result:
                # Format lap time
                lap_time_formatted = f"{int(row[2] // 60)}:{row[2] % 60:06.3f}" if row[2] else None
                laps.append({
                    "driverName": get_driver_name(row[0]),
                    "driverNumber": row[0],
                    "lapNumber": row[1],
                    "lapTime": row[2],
                    "lapTimeFormatted": lap_time_formatted,
                    "lapEndSeconds": None,
                    "lapStartTime": None,
                    "position": None,
                    "tyreCompound": None,
                    "isValid": row[3],
                    "isDeleted": False,
                    "sector1": row[4],
                    "sector2": row[5],
                    "sector3": row[6]
                })
            return laps

        # Process FastF1 results
        def _coerce_seconds(value):
            if value is None:
                return None
            # DuckDB may return timedelta-like objects, integers (ns/us/ms), or floats.
            try:
                if hasattr(value, "total_seconds"):
                    return float(value.total_seconds())
            except Exception:
                pass
            if isinstance(value, datetime.time):
                return float(value.hour * 3600 + value.minute * 60 + value.second + value.microsecond / 1e6)
            try:
                numeric = float(value)
            except Exception:
                return None
            # Heuristic unit normalization:
            # - ns values ~ 1e12 for ~1000s
            # - us values ~ 1e9 for ~1000s
            # - ms values ~ 1e6 for ~1000s
            if numeric > 1e11:
                return numeric / 1e9
            if numeric > 1e8:
                return numeric / 1e6
            if numeric > 1e5:
                return numeric / 1e3
            return numeric

        laps = []
        for row in result:
            record = dict(zip(columns, row))
            # Sector*SessionTime comes from FastF1 as a "session time at sector end" (not duration).
            # Normalize units to seconds and convert to sector durations when possible.
            s1 = _coerce_seconds(record.get("sector1"))
            s2 = _coerce_seconds(record.get("sector2"))
            s3 = _coerce_seconds(record.get("sector3"))
            lap_time = _coerce_seconds(record.get("lapTime"))

            if (
                lap_time is not None
                and s3 is not None
                and s3 > lap_time
                and (s2 is None or s3 >= s2)
                and (s1 is None or s2 is None or s2 >= s1)
            ):
                lap_start = s3 - lap_time
                dur1 = (s1 - lap_start) if s1 is not None else None
                dur2 = (s2 - s1) if (s2 is not None and s1 is not None) else None
                dur3 = (s3 - s2) if (s3 is not None and s2 is not None) else None

                def _ok(d):
                    return d if d is not None and pd.notna(d) and d > 0 and d < 600 else None

                record["sector1"] = _ok(dur1)
                record["sector2"] = _ok(dur2)
                record["sector3"] = _ok(dur3)
            else:
                # Avoid surfacing session-time stamps in the UI if we couldn't convert them.
                if (lap_time is None or (lap_time is not None and lap_time < 600)) and any(
                    v is not None and v > 600 for v in (s1, s2, s3)
                ):
                    record["sector1"] = None
                    record["sector2"] = None
                    record["sector3"] = None
                else:
                    record["sector1"] = s1
                    record["sector2"] = s2
                    record["sector3"] = s3
            # Normalize lap start/end timestamps to session-time seconds if available.
            end_s = _coerce_seconds(record.get("lapEndSeconds") or record.get("session_time_seconds"))
            start_s = _coerce_seconds(record.get("lapStartTime"))
            if start_s is None and end_s is not None and lap_time is not None:
                start_s = end_s - lap_time
            if end_s is None and start_s is not None and lap_time is not None:
                end_s = start_s + lap_time
            record["lapStartSeconds"] = start_s
            record["lapEndSeconds"] = end_s
            laps.append(record)
        return laps
    finally:
        conn.close()


def load_telemetry(
    silver_path: str,
    driver_numbers: Optional[List[int]] = None,
    t0: Optional[float] = None,
    t1: Optional[float] = None,
    hz: float = 1.0,
) -> dict:
    """Load telemetry (optionally windowed + downsampled in SQL)."""
    tel_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(tel_file):
        logger.debug(f"Telemetry file not found: {tel_file}")
        return {}
    
    laps_file = os.path.join(silver_path, "laps.parquet")
    
    conn = duckdb.connect()
    try:
        # Validate schema before querying
        try:
            schema_query = f"DESCRIBE SELECT * FROM read_parquet('{tel_file}')"
            schema_result = conn.execute(schema_query).fetchall()
            columns_in_file = {row[0] for row in schema_result}
            
            # Required columns for telemetry
            required_columns = {
                'session_time_seconds', 'speed', 'throttle', 'brake', 
                'rpm', 'gear', 'drs', 'driver_number'
            }
            
            if not required_columns.issubset(columns_in_file):
                missing = required_columns - columns_in_file
                logger.warning(
                    f"Telemetry file has wrong schema: {tel_file}. "
                    f"Missing columns: {missing}. Has: {columns_in_file}"
                )
                return {}
        except Exception as e:
            logger.error(f"Error validating telemetry schema for {tel_file}: {e}")
            return {}
        
        hz = float(hz or 0.0)
        hz = max(0.0, min(50.0, hz))

        where = ["t.driver_number IS NOT NULL"]
        if driver_numbers:
            where.append(f"t.driver_number IN ({','.join(str(int(x)) for x in driver_numbers)})")
        if t0 is not None:
            where.append(f"t.session_time_seconds >= {float(t0)}")
        if t1 is not None:
            where.append(f"t.session_time_seconds <= {float(t1)}")
        where_sql = " AND ".join(where)

        if hz > 0:
            bucket = f"CAST(floor(t.session_time_seconds * {hz}) AS BIGINT)"
            query = f"""
                WITH base AS (
                    SELECT
                        t.driver_number,
                        COALESCE(l.driver_name, CAST(t.driver_number AS VARCHAR)) as driver_name,
                        t.session_time_seconds as timestamp,
                        ROUND(t.speed, 2) as speed,
                        ROUND(t.throttle, 2) as throttle,
                        CASE WHEN t.brake THEN 100.0 ELSE 0.0 END as brake,
                        ROUND(t.rpm, 0) as rpm,
                        CAST(t.gear AS INTEGER) as gear,
                        CAST(t.drs AS INTEGER) as drs,
                        row_number() OVER (
                            PARTITION BY t.driver_number, {bucket}
                            ORDER BY t.session_time_seconds DESC
                        ) as rn
                    FROM read_parquet('{tel_file}') t
                    LEFT JOIN (
                        SELECT DISTINCT driver_number, driver_name
                        FROM read_parquet('{laps_file}')
                    ) l ON t.driver_number = l.driver_number
                    WHERE {where_sql}
                )
                SELECT driver_number, driver_name, timestamp, speed, throttle, brake, rpm, gear, drs
                FROM base
                WHERE rn = 1
                ORDER BY driver_number, timestamp
            """
        else:
            query = f"""
                SELECT
                    t.driver_number,
                    COALESCE(l.driver_name, CAST(t.driver_number AS VARCHAR)) as driver_name,
                    t.session_time_seconds as timestamp,
                    ROUND(t.speed, 2) as speed,
                    ROUND(t.throttle, 2) as throttle,
                    CASE WHEN t.brake THEN 100.0 ELSE 0.0 END as brake,
                    ROUND(t.rpm, 0) as rpm,
                    CAST(t.gear AS INTEGER) as gear,
                    CAST(t.drs AS INTEGER) as drs
                FROM read_parquet('{tel_file}') t
                LEFT JOIN (
                    SELECT DISTINCT driver_number, driver_name
                    FROM read_parquet('{laps_file}')
                ) l ON t.driver_number = l.driver_number
                WHERE {where_sql}
                ORDER BY t.driver_number, t.session_time_seconds
            """

        rows = conn.execute(query).fetchall()
        columns = ["driverNumber", "driverName", "timestamp", "speed", "throttle", "brake", "rpm", "gear", "drs"]
        tel_by_driver: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            record = dict(zip(columns, row))
            drv = str(record.get("driverName") or "")
            tel_by_driver.setdefault(drv, []).append(record)

        logger.info(f"Loaded telemetry for {len(tel_by_driver)} drivers from {tel_file}")
        return tel_by_driver
        
    except Exception as e:
        logger.error(f"Error loading telemetry from {tel_file}: {e}")
        return {}
    finally:
        conn.close()


def load_weather(silver_path: str) -> list:
    weather_file = os.path.join(silver_path, "weather.parquet")
    if not os.path.exists(weather_file):
        return []

    conn = duckdb.connect()
    try:
        query = f"""
            SELECT
                Time / 1000000000.0 AS timestamp,
                ROUND(air_temperature, 1) AS airTemp,
                ROUND(track_temperature, 1) AS trackTemp,
                ROUND(humidity, 1) AS humidity,
                ROUND(pressure, 1) AS pressure,
                CAST(wind_direction AS INTEGER) AS windDirection,
                ROUND(wind_speed, 1) AS windSpeed,
                CAST(CASE WHEN Rainfall THEN 1 ELSE 0 END AS INTEGER) AS rainfall
            FROM read_parquet('{weather_file}')
            ORDER BY Time
        """
        rows = conn.execute(query).fetchall()
        cols = [
            "timestamp",
            "airTemp",
            "trackTemp",
            "humidity",
            "pressure",
            "windDirection",
            "windSpeed",
            "rainfall",
        ]
        return [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        logger.error(f"Error reading weather: {e}")
        return []
    finally:
        conn.close()


def load_race_control(silver_path: str, limit: int = 500) -> list:
    rc_file = os.path.join(silver_path, "race_control.parquet")
    if not os.path.exists(rc_file):
        return []

    conn = duckdb.connect()
    try:
        query = f"""
            SELECT
                epoch(session_time) - min(epoch(session_time)) OVER () AS timestamp,
                strftime('%H:%M:%S', session_time) AS time,
                COALESCE(CAST(category AS VARCHAR), '') AS category,
                COALESCE(CAST(message AS VARCHAR), '') AS message,
                COALESCE(CAST(Flag AS VARCHAR), '') AS flag,
                COALESCE(CAST(Scope AS VARCHAR), '') AS scope,
                COALESCE(TRY_CAST(Sector AS INTEGER), 0) AS sector,
                COALESCE(TRY_CAST(RacingNumber AS INTEGER), 0) AS racingNumber,
                COALESCE(TRY_CAST(Lap AS INTEGER), 0) AS lap
            FROM read_parquet('{rc_file}')
            ORDER BY session_time
        """
        rows = conn.execute(query).fetchall()
        cols = ["timestamp", "time", "category", "message", "flag", "scope", "sector", "racingNumber", "lap"]
        data = [dict(zip(cols, r)) for r in rows]
        if limit > 0 and len(data) > limit:
            return data[-limit:]
        return data
    except Exception as e:
        logger.error(f"Error reading race control: {e}")
        return []
    finally:
        conn.close()


def load_positions(year: int, race_name: str, session: str) -> list:
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return []
    silver_path = os.path.join(year_path, race_dir, normalize_session_code(session))
    fastf1_positions_path = os.path.join(silver_path, "positions.parquet")

    # Build driver number -> name mapping from laps file
    driver_mapping = {}
    laps_file = os.path.join(silver_path, "laps.parquet")
    if os.path.exists(laps_file):
        try:
            conn = duckdb.connect()
            try:
                query = f"""
                    SELECT DISTINCT driver_name, driver_number
                    FROM read_parquet('{laps_file}')
                    WHERE driver_name IS NOT NULL AND driver_number IS NOT NULL
                """
                for row in conn.execute(query).fetchall():
                    driver_mapping[int(row[1])] = row[0]
            finally:
                conn.close()
        except Exception as e:
            print(f"Error loading driver mapping: {e}")

    df = None

    def _clean_positions(df: Optional[pd.DataFrame]) -> Optional[pd.DataFrame]:
        if df is None or df.empty:
            return df
        if "x" in df.columns and "y" in df.columns:
            # Drop invalid (0,0) blocks that commonly appear in FastF1 exports.
            zero_mask = (df["x"].abs() + df["y"].abs()) <= 1e-6
            if zero_mask.any():
                frac = float(zero_mask.mean())
                if frac > 0.2:
                    df = df[~zero_mask].copy()
        return df

    if os.path.exists(fastf1_positions_path):
        try:
            conn = duckdb.connect()
            try:
                schema = {r[0] for r in conn.execute(f"DESCRIBE SELECT * FROM read_parquet('{fastf1_positions_path}')").fetchall()}
                if {"x", "y", "driver_number"}.issubset(schema) and ("session_time_seconds" in schema or "date" in schema):
                    if "session_time_seconds" in schema:
                        query = f"""
                            SELECT
                                session_time_seconds AS timestamp,
                                driver_number AS driverNumber,
                                x,
                                y
                            FROM read_parquet('{fastf1_positions_path}')
                            WHERE driver_number IS NOT NULL
                            ORDER BY driver_number, session_time_seconds
                        """
                    else:
                        # Derive a session-relative timestamp from `date` (global, not per-driver).
                        query = f"""
                            SELECT
                                epoch(date) - min(epoch(date)) OVER () AS timestamp,
                                driver_number AS driverNumber,
                                x,
                                y
                            FROM read_parquet('{fastf1_positions_path}')
                            WHERE driver_number IS NOT NULL
                            ORDER BY driver_number, date
                        """
                    df = conn.execute(query).df()
            finally:
                conn.close()

            if df is not None and not df.empty:
                df = _clean_positions(df)
                try:
                    if df is not None and not df.empty and float(df["timestamp"].min()) > 90.0:
                        df = None
                except Exception:
                    pass
            if df is not None and not df.empty:
                df = df.dropna(subset=["timestamp", "x", "y", "driverNumber"])
                # Keep total payload reasonable while preserving coverage for every driver.
                if len(df) > 200000:
                    try:
                        df = df.sort_values(["driverNumber", "timestamp"])
                        n_drivers = int(df["driverNumber"].nunique() or 1)
                        per_driver = max(1000, 200000 // n_drivers)
                        chunks = []
                        for drv, grp in df.groupby("driverNumber", sort=False):
                            stride = max(1, int(len(grp) // per_driver))
                            chunks.append(grp.iloc[::stride])
                        df = pd.concat(chunks, ignore_index=True)
                    except Exception:
                        df = df.sample(n=200000, random_state=42)
                return df.to_dict(orient="records")
        except Exception as e:
            print(f"Error reading positions: {e}")

    bronze_path = os.path.join(BRONZE_DIR, str(year), race_name, normalize_session_code(session))
    openf1_path = os.path.join(bronze_path, "openf1", "positions.parquet")
    gold_path = os.path.join(GOLD_DIR, str(year), race_name, normalize_session_code(session), "track_map.parquet")
    
    df = None
    
    if os.path.exists(openf1_path):
        try:
            conn = duckdb.connect()
            try:
                df = conn.execute(f"SELECT * FROM read_parquet('{openf1_path}')").df()
            finally:
                conn.close()
        except Exception:
            pass
    
    if df is None or df.empty:
        if os.path.exists(gold_path):
            try:
                conn = duckdb.connect()
                try:
                    df = conn.execute(f"SELECT * FROM read_parquet('{gold_path}')").df()
                finally:
                    conn.close()
            except Exception:
                pass
    
    if df is not None and not df.empty and 'x' in df.columns and 'y' in df.columns:
        df = _clean_positions(df)
        try:
            if df is not None and not df.empty and float(df["timestamp"].min()) > 90.0:
                df = None
        except Exception:
            pass
    if df is not None and not df.empty and 'x' in df.columns and 'y' in df.columns:
        out = df[["timestamp", "driver_number", "x", "y"]].copy()
        out.columns = ["timestamp", "driverNumber", "x", "y"]
        out = out.dropna(subset=["timestamp", "x", "y", "driverNumber"])
        return out.to_dict(orient="records")

    # Fallback: approximate a track position by integrating speed over time and mapping distance
    # onto the track centerline. (Used when no XY position feed exists for a session.)
    return derive_positions_from_telemetry(year, race_name, session)


def derive_positions_from_telemetry(year: int, race_name: str, session: str) -> list:
    """Derive positions from telemetry by integrating speed over time."""
    telemetry_file = os.path.join(SILVER_DIR, str(year), race_name, normalize_session_code(session), "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        return []
    
    geometry = load_track_geometry(race_name, year=year)
    if not geometry:
        return []
    layout = geometry.get("layout") if isinstance(geometry, dict) else None
    coords = (layout or {}).get("path_coordinates") if isinstance(layout, dict) else None
    if not coords and not geometry.get("centerline"):
        return []

    try:
        conn = duckdb.connect()
        try:
            df = conn.execute(
                f"""
                SELECT driver_number, session_time_seconds, speed
                FROM read_parquet('{telemetry_file}')
                WHERE driver_number IS NOT NULL
                ORDER BY driver_number, session_time_seconds
                """
            ).df()
        finally:
            conn.close()

        if df.empty or "driver_number" not in df.columns or "session_time_seconds" not in df.columns or "speed" not in df.columns:
            return []
        
        # Track length (meters)
        track_length = 0.0
        if geometry.get("length_km"):
            track_length = float(geometry.get("length_km")) * 1000.0
        elif geometry.get("length_m"):
            track_length = float(geometry.get("length_m"))
        elif isinstance(coords, list) and coords:
            try:
                track_length = float(coords[-1].get("distance") or 0.0)
            except Exception:
                track_length = 0.0
        if track_length <= 0 and geometry.get("centerline"):
            track_length = calculate_track_length(geometry["centerline"])
        if track_length <= 0:
            return []

        # Build a distance-indexed polyline from manual layout if present.
        dist_points = []
        if isinstance(coords, list) and coords:
            last_d = 0.0
            for i, p in enumerate(coords):
                if not isinstance(p, dict):
                    continue
                x = float(p.get("x") or 0.0)
                y = float(p.get("y") or 0.0)
                d = p.get("distance")
                if d is None and dist_points:
                    px, py, pd = dist_points[-1]
                    d = pd + ((x - px) ** 2 + (y - py) ** 2) ** 0.5
                if d is None:
                    d = last_d
                last_d = float(d)
                dist_points.append((x, y, float(d)))

        def _point_at_distance(d: float):
            if dist_points:
                d = float(d) % track_length
                for i in range(1, len(dist_points)):
                    d0 = dist_points[i - 1][2]
                    d1 = dist_points[i][2]
                    if d0 <= d <= d1:
                        if d1 <= d0:
                            return dist_points[i][0], dist_points[i][1]
                        t = (d - d0) / (d1 - d0)
                        x0, y0 = dist_points[i - 1][0], dist_points[i - 1][1]
                        x1, y1 = dist_points[i][0], dist_points[i][1]
                        return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
                return dist_points[-1][0], dist_points[-1][1]
            # Fallback to centerline index
            centerline = geometry.get("centerline") or []
            if not centerline:
                return (0.0, 0.0)
            idx = int((float(d) / track_length) * len(centerline))
            idx = min(idx, len(centerline) - 1)
            pos = centerline[idx]
            return pos[0], pos[1]

        positions = []
        for driver_num in df["driver_number"].unique():
            driver_df = df[df["driver_number"] == driver_num].copy()
            driver_df = driver_df.sort_values("session_time_seconds")
            
            times = driver_df["session_time_seconds"].values
            speeds = driver_df["speed"].fillna(0).values
            
            distances = [0.0]
            for i in range(1, len(speeds)):
                if i < len(times):
                    dt = times[i] - times[i-1]
                    if dt > 0:
                        avg_speed = (speeds[i] + speeds[i-1]) / 2 / 3.6
                        distances.append(distances[-1] + avg_speed * dt)
                    else:
                        distances.append(distances[-1])
                else:
                    distances.append(distances[-1])
            
            for i in range(0, len(driver_df), max(1, len(driver_df) // 2000)):
                if i >= len(distances):
                    break
                distance = distances[i] % track_length
                pos = _point_at_distance(distance)
                driver_row = driver_df.iloc[i]
                positions.append({
                    "timestamp": float(driver_row["session_time_seconds"]),
                    "driverNumber": int(driver_row["driver_number"]),
                    "driverName": str(int(driver_row["driver_number"])),
                    "x": float(pos[0]),
                    "y": float(pos[1])
                })
        
        return positions
        
    except Exception as e:
        print(f"Error in derive_positions_from_telemetry: {e}")
        return []


def calculate_track_length(centerline: list) -> float:
    """Calculate approximate track length from centerline."""
    if not centerline or len(centerline) < 2:
        return 5412
    
    length = 0.0
    for i in range(1, len(centerline)):
        dx = centerline[i][0] - centerline[i-1][0]
        dy = centerline[i][1] - centerline[i-1][1]
        length += (dx**2 + dy**2)**0.5
    
    return length


@lru_cache(maxsize=128)
def _load_layout_map() -> Dict[str, Dict[str, str]]:
    def _read_json(path: os.PathLike) -> Dict[str, Any]:
        try:
            return json.loads(Path(path).read_text())
        except Exception:
            return {}

    def _layout_id_map(layout_versions: Dict[str, Any]) -> Dict[str, str]:
        out: Dict[str, str] = {}
        for track_key, info in (layout_versions or {}).items():
            layouts = (info or {}).get("layouts") or {}
            for layout_key, layout in layouts.items():
                file = (layout or {}).get("file")
                if not file:
                    continue
                base = f"{track_key}_{layout_key}"
                out[base] = file
                if layout_key == "outer_circuit":
                    out[f"{track_key}_outer"] = file
                    out[f"{track_key}_outer_sakhir"] = file
        return out

    def _resolve_layout_file(layout_id: str, layout_files: Dict[str, str]) -> Optional[str]:
        if not layout_id:
            return None
        if layout_id in layout_files:
            return layout_files[layout_id]
        parts = layout_id.split("_")
        if len(parts) > 2:
            base = "_".join(parts[:2])
            if base in layout_files:
                return layout_files[base]
        if layout_id.startswith("bahrain_outer"):
            return layout_files.get("bahrain_outer") or layout_files.get("bahrain_outer_circuit")
        return None

    mapping_path = TRACK_GEOMETRY_MANUAL_DIR / "track_layout_mapping.json"
    if mapping_path.exists():
        data = _read_json(mapping_path)
        layout_versions = data.get("track_layout_versions") or {}
        season_map = data.get("season_to_tracks_map") or {}
        layout_files = _layout_id_map(layout_versions)
        derived: Dict[str, Dict[str, str]] = {}
        for year_str, layout_ids in season_map.items():
            try:
                year = int(year_str)
            except Exception:
                continue
            catalog = load_season_catalog(year)
            races = catalog.get("races") or []
            year_map: Dict[str, str] = {}
            for idx, layout_id in enumerate(layout_ids or []):
                if idx >= len(races):
                    break
                file = _resolve_layout_file(str(layout_id), layout_files)
                if not file:
                    continue
                file_name = str(file)
                if not file_name.endswith(".json"):
                    file_name = f"{file_name}.json"
                race_name = str(races[idx])
                year_map[race_name] = file_name
                year_map[normalize_key(race_name).replace(" ", "_")] = file_name
                key = race_key_for_name(year, race_name)
                if key:
                    year_map[key] = file_name
            derived[str(year)] = year_map
        if derived:
            return derived

    path = TRACK_GEOMETRY_MANUAL_DIR / "layout_map.json"
    if path.exists():
        return _read_json(path)
    return {}


def _resolve_manual_layout(race_name: str, year: Optional[int]) -> Optional[str]:
    if not year:
        return None
    mapping = _load_layout_map()
    year_map = mapping.get(str(year), {})
    if not year_map:
        return None
    key = race_key_for_name(int(year), race_name) if year else ""
    slug = normalize_key(race_name).replace(" ", "_")
    for k in [key, slug, race_name, normalize_key(race_name)]:
        if k and k in year_map:
            layout_id = str(year_map[k])
            if not layout_id.endswith(".json"):
                layout_id = layout_id + ".json"
            candidate = TRACK_GEOMETRY_MANUAL_DIR / layout_id
            if candidate.exists():
                return str(candidate)
    return None


def load_track_geometry(race_name: str, year: Optional[int] = None) -> Optional[Dict]:
    import json
    def _layout_signature(data: Dict) -> Optional[tuple]:
        try:
            coords = (data.get("layout") or {}).get("path_coordinates") or []
            if not coords:
                return None
            head = coords[:8]
            tail = coords[-8:] if len(coords) > 8 else []
            sig = [len(coords)]
            for p in head + tail:
                sig.extend([round(float(p.get("x") or 0.0), 2), round(float(p.get("y") or 0.0), 2)])
            return tuple(sig)
        except Exception:
            return None

    @lru_cache(maxsize=1)
    def _manual_layout_dupes() -> Dict[tuple, int]:
        counts: Dict[tuple, int] = {}
        try:
            for path in TRACK_GEOMETRY_MANUAL_DIR.glob("*.json"):
                try:
                    data = json.loads(path.read_text())
                except Exception:
                    continue
                sig = _layout_signature(data) if isinstance(data, dict) else None
                if sig is None:
                    continue
                counts[sig] = counts.get(sig, 0) + 1
        except Exception:
            pass
        return counts

    def _layout_quality(data: Dict) -> bool:
        """Return True if manual layout looks detailed enough to use."""
        try:
            coords = (data.get("layout") or {}).get("path_coordinates") or []
            pts = [(float(p.get("x") or 0.0), float(p.get("y") or 0.0)) for p in coords if isinstance(p, dict)]
            if len(pts) < 20:
                return False
            # Count curvature direction changes; simple ovals show ~0.
            changes = 0
            last = 0
            for i in range(1, len(pts) - 1):
                x0, y0 = pts[i - 1]
                x1, y1 = pts[i]
                x2, y2 = pts[i + 1]
                cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
                sign = 1 if cross > 0 else -1 if cross < 0 else 0
                if sign and last and sign != last:
                    changes += 1
                if sign:
                    last = sign
            return changes >= 3
        except Exception:
            return False

    manual = _resolve_manual_layout(race_name, year)
    if manual and os.path.exists(manual):
        with open(manual, "r") as f:
            data = json.load(f)
        if data and not data.get("centerline"):
            coords = (data.get("layout") or {}).get("path_coordinates") or []
            if coords:
                data["centerline"] = [[p.get("x"), p.get("y")] for p in coords if "x" in p and "y" in p]
        # Guard: if manual layout is a shared placeholder, fall back to etl geometry.
        if data:
            sig = _layout_signature(data)
            counts = _manual_layout_dupes()
            if not (sig and counts.get(sig, 0) > 1) and _layout_quality(data):
                return data
    for base_dir in (TRACK_GEOMETRY_DIR,):
        geometry_file = resolve_track_geometry_file(str(base_dir), race_name, year=year)
        if geometry_file:
            with open(geometry_file, "r") as f:
                return json.load(f)
    return None


def calculate_session_duration(year: int, race_name: str, session: str) -> int:
    """Calculate actual session duration from telemetry data."""
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return 5400
    telemetry_file = os.path.join(year_path, race_dir, normalize_session_code(session), "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        return 5400

    try:
        conn = duckdb.connect()
        try:
            query = f"""
                SELECT MIN(session_time_seconds), MAX(session_time_seconds)
                FROM read_parquet('{telemetry_file}')
                WHERE session_time_seconds IS NOT NULL
            """
            result = conn.execute(query).fetchone()
            if result and result[0] is not None and result[1] is not None:
                duration = int(result[1] - result[0])
                return max(duration, 60)
        finally:
            conn.close()
    except Exception:
        pass

    return 5400


def get_total_laps(year: int, race_name: str, session: str) -> int:
    """Get total laps from laps data."""
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return 57
    laps_file = os.path.join(year_path, race_dir, normalize_session_code(session), "laps.parquet")
    if not os.path.exists(laps_file):
        return 57

    try:
        conn = duckdb.connect()
        try:
            query = f"SELECT MAX(lap_number) FROM read_parquet('{laps_file}')"
            result = conn.execute(query).fetchone()
            if result and result[0] is not None:
                return int(result[0])
        finally:
            conn.close()
    except Exception:
        pass

    return 57


def load_metadata(year: int, race_name: str, session: str) -> Dict:
    gold_session_path = os.path.join(GOLD_DIR, str(year), race_name, normalize_session_code(session))
    metadata_file = os.path.join(gold_session_path, "metadata.json")

    if os.path.exists(metadata_file):
        import json
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
            metadata["duration"] = calculate_session_duration(year, race_name, session)
            metadata["totalLaps"] = get_total_laps(year, race_name, session)
            return metadata

    return {
        "year": year,
        "raceName": race_name,
        "sessionType": session,
        "duration": calculate_session_duration(year, race_name, session),
        "totalLaps": get_total_laps(year, race_name, session)
    }


@router.get("/sessions/{year}/{race}/{session}")
async def get_session(
    year: int,
    race: str,
    session: str
) -> Dict[str, Any]:
    race_name = race.replace("-", " ")
    session_code = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        raise HTTPException(status_code=404, detail=f"Session not found: {year} {race_name} {session}")
    silver_path = get_session_path(year, race_dir, session_code)
    
    if not silver_path:
        raise HTTPException(status_code=404, detail=f"Session not found: {year} {race_name} {session}")
    
    metadata = load_metadata(year, race_dir, session_code)
    drivers = load_drivers(silver_path, year=year)
    laps = load_laps(silver_path)
    telemetry = load_telemetry(silver_path, hz=1.0)
    positions = load_positions(year, race_dir, session_code)
    track_geometry = load_track_geometry(race_dir, year=year)
    weather = load_weather(silver_path)
    race_control = load_race_control(silver_path)
    
    total_laps = max([lap["lapNumber"] for lap in laps]) if laps else 57
    session_duration = metadata.get("duration", 5400)
    reason = telemetry_unavailable_reason(year, race_dir, session_code)
    telemetry_available = bool(telemetry) if reason is None else False
    
    return {
        "metadata": {
            "year": year,
            "raceName": race_dir,
            "sessionType": display_session_code(session_code),
            "duration": session_duration,
            "totalLaps": total_laps,
            "telemetryAvailable": telemetry_available,
            "telemetryUnavailableReason": reason
        },
        "drivers": drivers,
        "laps": laps,
        "telemetry": telemetry,
        "positions": positions,
        "weather": weather,
        "raceControl": race_control,
        "trackGeometry": track_geometry
    }


@router.get("/sessions/{year}/{race}/{session}/viz")
async def get_session_viz(
    year: int,
    race: str,
    session: str
) -> Dict[str, Any]:
    race_name = race.replace("-", " ")
    session_code = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        raise HTTPException(status_code=404, detail=f"Session not found")
    silver_path = get_session_path(year, race_dir, session_code)
    
    if not silver_path:
        raise HTTPException(status_code=404, detail=f"Session not found")
    
    cache_key = ("session_viz", int(year), str(race_dir), str(session_code))
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    metadata = load_metadata(year, race_dir, session_code)
    drivers = load_drivers(silver_path, year=year)
    laps = load_laps(silver_path, latest_only=True)
    positions = load_positions(year, race_dir, session_code)
    track_geometry = load_track_geometry(race_dir, year=year)
    weather = load_weather(silver_path)
    race_control = load_race_control(silver_path)
    
    total_laps = max([lap["lapNumber"] for lap in laps]) if laps else 57
    session_duration = metadata.get("duration", 5400)
    reason = telemetry_unavailable_reason(year, race_dir, session_code)
    telemetry_available = bool(positions) if reason is None else False
    
    payload = {
        "metadata": {
            "year": year,
            "raceName": race_dir,
            "sessionType": display_session_code(session_code),
            "duration": session_duration,
            "totalLaps": total_laps,
            "telemetryAvailable": telemetry_available,
            "telemetryUnavailableReason": reason
        },
        "drivers": drivers,
        "laps": laps,
        "positions": positions,
        "weather": weather,
        "raceControl": race_control,
        "trackGeometry": track_geometry
    }
    return cache_set(cache_key, payload)


@router.get("/sessions/{year}/{race}/{session}/laps")
async def get_session_laps(year: int, race: str, session: str) -> list:
    race_name = race.replace("-", " ")
    session_code = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        raise HTTPException(status_code=404, detail=f"Session not found")
    silver_path = get_session_path(year, race_dir, session_code)
    
    if not silver_path:
        raise HTTPException(status_code=404, detail=f"Session not found")
    
    return load_laps(silver_path)


@router.get("/sessions/{year}/{race}/{session}/telemetry")
async def get_session_telemetry(
    year: int,
    race: str,
    session: str,
    drivers: Optional[str] = Query(default=None, description="Comma-separated driver numbers (e.g. 1,44)"),
    hz: float = Query(default=1.0, ge=0.0, le=50.0),
    t0: Optional[float] = Query(default=None),
    t1: Optional[float] = Query(default=None),
) -> dict:
    race_name = race.replace("-", " ")
    session_code = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        raise HTTPException(status_code=404, detail=f"Session not found")
    silver_path = get_session_path(year, race_dir, session_code)
    
    if not silver_path:
        raise HTTPException(status_code=404, detail=f"Session not found")

    driver_numbers = _parse_driver_numbers(drivers)
    cache_key = (
        "session_telemetry",
        int(year),
        str(race_dir),
        str(session_code),
        ",".join(str(x) for x in driver_numbers),
        float(hz),
        float(t0) if t0 is not None else None,
        float(t1) if t1 is not None else None,
    )
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    telemetry = load_telemetry(silver_path, driver_numbers=driver_numbers, t0=t0, t1=t1, hz=hz)
    reason = telemetry_unavailable_reason(year, race_dir, session_code)
    if reason and not telemetry:
        return {"telemetry": {}, "telemetryUnavailableReason": reason}
    return cache_set(cache_key, telemetry)


@router.get("/sessions/{year}/{race}/{session}/positions")
async def get_session_positions(
    year: int,
    race: str,
    session: str,
    drivers: Optional[str] = Query(default=None, description="Comma-separated driver numbers (e.g. 1,44)"),
    hz: float = Query(default=2.0, ge=0.0, le=50.0),
    t0: Optional[float] = Query(default=None),
    t1: Optional[float] = Query(default=None),
) -> list:
    race_name = race.replace("-", " ")
    session_code = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return []

    driver_numbers = _parse_driver_numbers(drivers)
    cache_key = (
        "session_positions",
        int(year),
        str(race_dir),
        str(session_code),
        ",".join(str(x) for x in driver_numbers),
        float(hz),
        float(t0) if t0 is not None else None,
        float(t1) if t1 is not None else None,
    )
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    silver_path = get_session_path(year, race_dir, session_code)
    positions_file = os.path.join(silver_path, "positions.parquet") if silver_path else ""

    if silver_path and os.path.exists(positions_file):
        try:
            conn = duckdb.connect()
            try:
                schema = {
                    r[0] for r in conn.execute(f"DESCRIBE SELECT * FROM read_parquet('{positions_file}')").fetchall()
                }

                where = ["driver_number IS NOT NULL"]
                if driver_numbers:
                    where.append(f"driver_number IN ({','.join(str(int(x)) for x in driver_numbers)})")
                where_sql = " AND ".join(where)

                hz_val = float(hz or 0.0)
                hz_val = max(0.0, min(50.0, hz_val))

                if "session_time_seconds" in schema:
                    t_expr = "session_time_seconds"
                    bucket = f"CAST(floor({t_expr} * {hz_val}) AS BIGINT)" if hz_val > 0 else "NULL"
                    time_filters = []
                    if t0 is not None:
                        time_filters.append(f"{t_expr} >= {float(t0)}")
                    if t1 is not None:
                        time_filters.append(f"{t_expr} <= {float(t1)}")
                    time_sql = (" AND " + " AND ".join(time_filters)) if time_filters else ""
                    if hz_val > 0:
                        query = f"""
                            WITH base AS (
                                SELECT
                                    {t_expr} as timestamp,
                                    driver_number as driverNumber,
                                    x,
                                    y,
                                    row_number() OVER (
                                        PARTITION BY driver_number, {bucket}
                                        ORDER BY {t_expr} DESC
                                    ) as rn
                                FROM read_parquet('{positions_file}')
                                WHERE {where_sql}{time_sql}
                            )
                            SELECT timestamp, driverNumber, x, y
                            FROM base
                            WHERE rn = 1
                            ORDER BY driverNumber, timestamp
                        """
                    else:
                        query = f"""
                            SELECT
                                {t_expr} as timestamp,
                                driver_number as driverNumber,
                                x,
                                y
                            FROM read_parquet('{positions_file}')
                            WHERE {where_sql}{time_sql}
                            ORDER BY driverNumber, timestamp
                        """
                elif "date" in schema:
                    # Compute global session-relative time from timestamps.
                    time_filters = []
                    if t0 is not None:
                        time_filters.append(f"timestamp >= {float(t0)}")
                    if t1 is not None:
                        time_filters.append(f"timestamp <= {float(t1)}")
                    time_sql = ("WHERE " + " AND ".join(time_filters)) if time_filters else ""
                    time_and_sql = (" AND " + " AND ".join(time_filters)) if time_filters else ""
                    if hz_val > 0:
                        query = f"""
                            WITH base AS (
                                SELECT
                                    epoch(date) as t_epoch,
                                    min(epoch(date)) OVER () as t_min,
                                    driver_number,
                                    x,
                                    y
                                FROM read_parquet('{positions_file}')
                                WHERE {where_sql}
                            ),
                            sampled AS (
                                SELECT
                                    (t_epoch - t_min) as timestamp,
                                    driver_number as driverNumber,
                                    x,
                                    y,
                                    row_number() OVER (
                                        PARTITION BY driver_number, CAST(floor((t_epoch - t_min) * {hz_val}) AS BIGINT)
                                        ORDER BY t_epoch DESC
                                    ) as rn
                                FROM base
                            )
                            SELECT timestamp, driverNumber, x, y
                            FROM sampled
                            WHERE rn = 1{time_and_sql}
                            ORDER BY driverNumber, timestamp
                        """
                    else:
                        query = f"""
                            WITH base AS (
                                SELECT
                                    epoch(date) - min(epoch(date)) OVER () as timestamp,
                                    driver_number as driverNumber,
                                    x,
                                    y
                                FROM read_parquet('{positions_file}')
                                WHERE {where_sql}
                            )
                            SELECT timestamp, driverNumber, x, y
                            FROM base
                            {time_sql}
                            ORDER BY driverNumber, timestamp
                        """
                else:
                    query = ""

                if query:
                    df = conn.execute(query).df()
                    df = df.dropna(subset=["timestamp", "driverNumber", "x", "y"])
                    return cache_set(cache_key, df.to_dict(orient="records"))
            finally:
                conn.close()
        except Exception:
            pass

    rows = load_positions(year, race_dir, session_code)
    if driver_numbers:
        rows = [r for r in rows if int(r.get("driverNumber") or 0) in driver_numbers]
    return cache_set(cache_key, rows)
