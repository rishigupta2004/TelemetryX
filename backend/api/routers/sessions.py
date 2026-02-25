from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List, Tuple
import os
import json
import datetime
import math
import time
import hashlib
import uuid
import pandas as pd
import duckdb
import logging
from ..driver_mapping import get_driver_name, get_team_name
from ..cache import cache_get, cache_set
from ..utils import (
    resolve_dir,
    resolve_track_geometry_file,
    normalize_key,
    normalize_session_code,
    display_session_code,
)
from ..config import SILVER_DIR, BRONZE_DIR, GOLD_DIR, TRACK_GEOMETRY_DIR
from . import metrics as metrics_router

logger = logging.getLogger(__name__)

router = APIRouter()

_track_geometry_cache = {}

MAX_SESSION_WINDOW_S = 300.0
DEFAULT_TELEMETRY_WINDOW_S = 120.0
DEFAULT_POSITIONS_WINDOW_S = 180.0
MAX_SESSION_DRIVERS = 8
MAX_SESSION_TELEMETRY_ROWS = 30_000
MAX_SESSION_POSITIONS_ROWS = 30_000
MAX_MANUAL_REMAP_ROWS = 50_000
ALLOW_SYNTHETIC_POSITIONS = str(os.getenv("TELEMETRYX_ALLOW_SYNTHETIC_POSITIONS", "0")).strip().lower() in {"1", "true", "yes", "on"}
_SESSION_TEL_ROUTE = "/api/v1/sessions/{year}/{race}/{session}/telemetry"
_SESSION_POS_ROUTE = "/api/v1/sessions/{year}/{race}/{session}/positions"


def _estimate_payload_bytes(payload: Any) -> int:
    try:
        return len(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8"))
    except Exception:
        return 0


def _telemetry_row_count(payload: Any) -> int:
    if not isinstance(payload, dict):
        return 0
    if isinstance(payload.get("telemetry"), dict):
        tel = payload.get("telemetry") or {}
    else:
        tel = payload
    if not isinstance(tel, dict):
        return 0
    total = 0
    for rows in tel.values():
        if isinstance(rows, list):
            total += len(rows)
    return int(total)


def _telemetry_series_stats(payload: Any) -> Tuple[int, Optional[float], Optional[float], List[str]]:
    rows_total = 0
    min_ts: Optional[float] = None
    max_ts: Optional[float] = None
    columns: set[str] = set()
    if not isinstance(payload, dict):
        return 0, None, None, []
    tel_obj = payload.get("telemetry") if isinstance(payload.get("telemetry"), dict) else payload
    if not isinstance(tel_obj, dict):
        return 0, None, None, []
    for rows in tel_obj.values():
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            rows_total += 1
            columns.update(str(k) for k in row.keys())
            ts = row.get("timestamp")
            try:
                tsv = float(ts) if ts is not None else None
            except Exception:
                tsv = None
            if tsv is None:
                continue
            if min_ts is None or tsv < min_ts:
                min_ts = tsv
            if max_ts is None or tsv > max_ts:
                max_ts = tsv
    return int(rows_total), min_ts, max_ts, sorted(columns)


def _positions_series_stats(rows: Any) -> Tuple[int, Optional[float], Optional[float], List[str]]:
    rows_total = 0
    min_ts: Optional[float] = None
    max_ts: Optional[float] = None
    columns: set[str] = set()
    if not isinstance(rows, list):
        return 0, None, None, []
    for row in rows:
        if not isinstance(row, dict):
            continue
        rows_total += 1
        columns.update(str(k) for k in row.keys())
        ts = row.get("timestamp")
        try:
            tsv = float(ts) if ts is not None else None
        except Exception:
            tsv = None
        if tsv is None:
            continue
        if min_ts is None or tsv < min_ts:
            min_ts = tsv
        if max_ts is None or tsv > max_ts:
            max_ts = tsv
    return int(rows_total), min_ts, max_ts, sorted(columns)


def _build_source_version(
    *,
    year: int,
    race: str,
    session: str,
    endpoint: str,
    columns: List[str],
    row_count: int,
    min_ts: Optional[float],
    max_ts: Optional[float],
) -> str:
    token = "|".join(
        [
            str(int(year)),
            str(race),
            str(session),
            str(endpoint),
            ",".join(columns or []),
            str(int(row_count)),
            "" if min_ts is None else f"{float(min_ts):.6f}",
            "" if max_ts is None else f"{float(max_ts):.6f}",
        ]
    )
    return hashlib.sha1(token.encode("utf-8")).hexdigest()


def _request_id() -> str:
    return uuid.uuid4().hex


def telemetry_unavailable_reason(year: int, race_name: str, session: str) -> Optional[str]:
    if year == 2018 and normalize_key(race_name) == normalize_key("Bahrain Grand Prix") and session.upper() == "R":
        return "Telemetry unavailable for this session due to FIA data restrictions."
    return None


def telemetry_available(silver_path: str, reason: Optional[str]) -> bool:
    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    return reason is None and os.path.exists(telemetry_file)


def _session_telemetry_bounds(silver_path: str) -> Optional[Tuple[float, float]]:
    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        return None
    conn = duckdb.connect()
    try:
        row = conn.execute(
            """
            SELECT
                MIN(CAST(session_time_seconds AS DOUBLE)),
                MAX(CAST(session_time_seconds AS DOUBLE))
            FROM read_parquet(?)
            WHERE session_time_seconds IS NOT NULL
            """,
            [telemetry_file],
        ).fetchone()
        if not row:
            return None
        lo = float(row[0]) if row[0] is not None else 0.0
        hi = float(row[1]) if row[1] is not None else 0.0
        if hi <= lo:
            return None
        return (lo, hi)
    except Exception:
        return None
    finally:
        conn.close()


def _session_positions_bounds(silver_path: str) -> Optional[Tuple[float, float]]:
    candidates = [
        os.path.join(silver_path, "positions.parquet"),
        os.path.join(silver_path, "openf1_positions.parquet"),
    ]
    existing = [p for p in candidates if os.path.exists(p)]
    if not existing:
        return None
    conn = duckdb.connect()
    try:
        for path in existing:
            try:
                schema = {r[0] for r in conn.execute("DESCRIBE SELECT * FROM read_parquet(?)", [path]).fetchall()}
            except Exception:
                continue
            ts_col = None
            if "session_time_seconds" in schema:
                ts_col = "session_time_seconds"
            elif "timestamp" in schema:
                ts_col = "timestamp"
            if not ts_col:
                continue
            try:
                row = conn.execute(
                    f"""
                    SELECT
                        MIN(CAST({ts_col} AS DOUBLE)),
                        MAX(CAST({ts_col} AS DOUBLE))
                    FROM read_parquet(?)
                    WHERE {ts_col} IS NOT NULL
                    """,
                    [path],
                ).fetchone()
            except Exception:
                continue
            if not row:
                continue
            lo = float(row[0]) if row[0] is not None else 0.0
            hi = float(row[1]) if row[1] is not None else 0.0
            if hi > lo:
                return (lo, hi)
    except Exception:
        return None
    finally:
        conn.close()
    return None


def _session_race_time_bounds(silver_path: str, session_code: str) -> Optional[Tuple[float, float]]:
    code = str(session_code or "").upper()
    if code not in {"R", "SR"}:
        return None
    try:
        laps = load_laps(silver_path, latest_only=False)
    except Exception:
        return None
    if not isinstance(laps, list) or not laps:
        return None

    def _num(value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value)
        except Exception:
            return None

    starts: List[float] = []
    ends: List[float] = []
    for lap in laps:
        if not isinstance(lap, dict):
            continue
        try:
            lap_no = int(lap.get("lapNumber") or 0)
        except Exception:
            lap_no = 0
        if lap_no <= 0:
            continue
        start_s = _num(lap.get("lapStartSeconds"))
        end_s = _num(lap.get("lapEndSeconds"))
        lap_time_s = _num(lap.get("lapTime"))
        if start_s is None and end_s is not None and lap_time_s is not None and lap_time_s > 0:
            start_s = float(end_s) - float(lap_time_s)
        if end_s is None and start_s is not None and lap_time_s is not None and lap_time_s > 0:
            end_s = float(start_s) + float(lap_time_s)
        if start_s is None or end_s is None:
            continue
        if not (math.isfinite(float(start_s)) and math.isfinite(float(end_s))):
            continue
        if float(end_s) <= float(start_s):
            continue
        starts.append(float(start_s))
        ends.append(float(end_s))

    if not starts or not ends:
        return None
    lo = float(min(starts))
    hi = float(max(ends))
    if hi <= lo:
        return None
    return (lo, hi)


def _positions_bounds(rows: Any) -> Optional[Tuple[float, float]]:
    if not isinstance(rows, list):
        return None
    vals: List[float] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            ts = float(row.get("timestamp"))
            vals.append(ts)
        except Exception:
            continue
    if not vals:
        return None
    lo = float(min(vals))
    hi = float(max(vals))
    if hi <= lo:
        return None
    return (lo, hi)


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


def _resolve_time_window(
    t0: Optional[float],
    t1: Optional[float],
    default_window_s: float,
) -> Tuple[float, float]:
    if (t0 is None) != (t1 is None):
        raise HTTPException(status_code=400, detail="Provide both t0 and t1, or neither")
    if t0 is None and t1 is None:
        start = 0.0
        end = float(default_window_s)
    else:
        start = float(t0)
        end = float(t1)
    if end <= start:
        raise HTTPException(status_code=400, detail="t1 must be greater than t0")
    window_s = end - start
    if window_s > MAX_SESSION_WINDOW_S:
        raise HTTPException(status_code=413, detail=f"Window exceeds {int(MAX_SESSION_WINDOW_S)}s limit")
    return start, end


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
            has_pit_in = "pit_in_time_formatted" in columns_in_file
            has_pit_out = "pit_out_time_formatted" in columns_in_file
            pit_in_expr = "CAST(pit_in_time_formatted AS VARCHAR)" if has_pit_in else "NULL"
            pit_out_expr = "CAST(pit_out_time_formatted AS VARCHAR)" if has_pit_out else "NULL"
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
                                {pit_in_expr} AS pitInTimeFormatted,
                                {pit_out_expr} AS pitOutTimeFormatted,
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
                            pitInTimeFormatted,
                            pitOutTimeFormatted,
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
                            {pit_in_expr} AS pitInTimeFormatted,
                            {pit_out_expr} AS pitOutTimeFormatted,
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
                        {pit_in_expr} AS pitInTimeFormatted,
                        {pit_out_expr} AS pitOutTimeFormatted,
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
                "pitInTimeFormatted",
                "pitOutTimeFormatted",
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
                    "pitInTimeFormatted": None,
                    "pitOutTimeFormatted": None,
                    "pitInSeconds": None,
                    "pitOutSeconds": None,
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

        def _parse_formatted_clock(value):
            if value is None:
                return None
            raw = str(value).strip()
            if not raw:
                return None
            if "day" in raw:
                parts = raw.split()
                raw = parts[-1] if parts else raw
            if ":" not in raw:
                try:
                    return float(raw)
                except Exception:
                    return None
            bits = raw.split(":")
            try:
                nums = [float(x) for x in bits]
            except Exception:
                return None
            if len(nums) == 2:
                minutes, seconds = nums
                hours = 0.0
            elif len(nums) == 3:
                hours, minutes, seconds = nums
            else:
                return None
            return hours * 3600.0 + minutes * 60.0 + seconds

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
            record["pitInSeconds"] = _parse_formatted_clock(record.get("pitInTimeFormatted"))
            record["pitOutSeconds"] = _parse_formatted_clock(record.get("pitOutTimeFormatted"))
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
    max_rows: int = MAX_SESSION_TELEMETRY_ROWS,
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
            optional_column_groups = {
                "ersDeploy": [
                    "ers_deploy",
                    "ers_deployment",
                    "ersdeploy",
                    "ersDeployment",
                ],
                "ersHarvest": [
                    "ers_harvest",
                    "ers_recovery",
                    "ersharvest",
                    "ersHarvest",
                ],
            }
            optional_expr: Dict[str, str] = {}
            for alias, candidates in optional_column_groups.items():
                src = next((c for c in candidates if c in columns_in_file), None)
                if src:
                    optional_expr[alias] = (
                        f"ROUND(try_cast(t.{src} AS DOUBLE), 2) as {alias}"
                    )
                else:
                    optional_expr[alias] = f"NULL as {alias}"
        except Exception as e:
            logger.error(f"Error validating telemetry schema for {tel_file}: {e}")
            return {}
        
        hz = max(0.0, min(50.0, float(hz or 0.0)))
        t0_bound, t1_bound = _resolve_time_window(t0, t1, DEFAULT_TELEMETRY_WINDOW_S)

        where = [
            "t.driver_number IS NOT NULL",
            "t.session_time_seconds >= ?",
            "t.session_time_seconds <= ?",
        ]
        params: List[Any] = [tel_file, float(t0_bound), float(t1_bound)]
        if driver_numbers:
            where.append("t.driver_number IN (" + ",".join(["?"] * len(driver_numbers)) + ")")
            params.extend([int(x) for x in driver_numbers])
        where_sql = " AND ".join(where)

        # Keep telemetry query minimal in the hot path; driver names are resolved client-side.
        if hz > 0:
            bucket = f"CAST(floor(t.session_time_seconds * {hz}) AS BIGINT)"
            query = f"""
                WITH base AS (
                    SELECT
                        t.driver_number,
                        CAST(t.driver_number AS VARCHAR) as driver_name,
                        t.session_time_seconds as timestamp,
                        ROUND(t.speed, 2) as speed,
                        ROUND(t.throttle, 2) as throttle,
                        ROUND(
                            CASE
                                WHEN try_cast(t.brake AS DOUBLE) IS NULL THEN 0.0
                                WHEN try_cast(t.brake AS DOUBLE) <= 1.0 THEN try_cast(t.brake AS DOUBLE) * 100.0
                                ELSE try_cast(t.brake AS DOUBLE)
                            END,
                            2
                        ) as brake,
                        ROUND(t.rpm, 0) as rpm,
                        CAST(t.gear AS INTEGER) as gear,
                        CAST(t.drs AS INTEGER) as drs,
                        {optional_expr['ersDeploy']},
                        {optional_expr['ersHarvest']},
                        row_number() OVER (
                            PARTITION BY t.driver_number, {bucket}
                            ORDER BY t.session_time_seconds DESC
                        ) as rn
                    FROM read_parquet(?) t
                    WHERE {where_sql}
                )
                SELECT
                    driver_number,
                    driver_name,
                    timestamp,
                    speed,
                    throttle,
                    brake,
                    rpm,
                    gear,
                    drs,
                    ersDeploy,
                    ersHarvest
                FROM base
                WHERE rn = 1
                ORDER BY driver_number, timestamp
                LIMIT ?
            """
        else:
            query = f"""
                SELECT
                    t.driver_number,
                    CAST(t.driver_number AS VARCHAR) as driver_name,
                    t.session_time_seconds as timestamp,
                    ROUND(t.speed, 2) as speed,
                    ROUND(t.throttle, 2) as throttle,
                    ROUND(
                        CASE
                            WHEN try_cast(t.brake AS DOUBLE) IS NULL THEN 0.0
                            WHEN try_cast(t.brake AS DOUBLE) <= 1.0 THEN try_cast(t.brake AS DOUBLE) * 100.0
                            ELSE try_cast(t.brake AS DOUBLE)
                        END,
                        2
                    ) as brake,
                    ROUND(t.rpm, 0) as rpm,
                    CAST(t.gear AS INTEGER) as gear,
                    CAST(t.drs AS INTEGER) as drs,
                    {optional_expr['ersDeploy']},
                    {optional_expr['ersHarvest']}
                FROM read_parquet(?) t
                WHERE {where_sql}
                ORDER BY t.driver_number, t.session_time_seconds
                LIMIT ?
            """

        rows = conn.execute(query, [*params, int(max_rows) + 1]).fetchall()
        if len(rows) > int(max_rows):
            raise HTTPException(status_code=413, detail=f"Result exceeds {int(max_rows)} rows")

        driver_name_map: Dict[int, str] = {}
        try:
            if os.path.exists(laps_file):
                rows_nums = sorted({int(r[0]) for r in rows if r and r[0] is not None})
                if rows_nums:
                    in_list = ",".join(str(n) for n in rows_nums)
                    map_rows = conn.execute(
                        f"""
                        SELECT DISTINCT
                            driver_number,
                            CAST(driver_name AS VARCHAR) as driver_name
                        FROM read_parquet('{laps_file}')
                        WHERE driver_number IN ({in_list})
                          AND driver_name IS NOT NULL
                        """
                    ).fetchall()
                    for num, name in map_rows:
                        try:
                            driver_name_map[int(num)] = str(name)
                        except Exception:
                            continue
        except Exception:
            driver_name_map = {}

        columns = [
            "driverNumber",
            "driverName",
            "timestamp",
            "speed",
            "throttle",
            "brake",
            "rpm",
            "gear",
            "drs",
            "ersDeploy",
            "ersHarvest",
        ]
        tel_by_driver: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            record = dict(zip(columns, row))
            try:
                drv_num = int(record.get("driverNumber") or 0)
                if drv_num in driver_name_map:
                    record["driverName"] = driver_name_map[drv_num]
            except Exception:
                pass
            drv = str(record.get("driverName") or "")
            tel_by_driver.setdefault(drv, []).append(record)

        logger.info(f"Loaded telemetry for {len(tel_by_driver)} drivers from {tel_file}")
        return tel_by_driver
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading telemetry from {tel_file}: {e}")
        return {}
    finally:
        conn.close()


def load_weather(silver_path: str, limit: int = 240) -> list:
    weather_file = os.path.join(silver_path, "weather.parquet")
    if not os.path.exists(weather_file):
        return []

    conn = duckdb.connect()
    try:
        schema_query = f"DESCRIBE SELECT * FROM read_parquet('{weather_file}')"
        columns = {
            str(row[0]).lower(): str(row[0])
            for row in conn.execute(schema_query).fetchall()
            if row and row[0]
        }

        def _col_ref(*names: str) -> Optional[str]:
            for name in names:
                raw = columns.get(name.lower())
                if raw:
                    return f'"{raw}"'
            return None

        def _cast_expr(sql_type: str, *names: str) -> str:
            ref = _col_ref(*names)
            if ref is None:
                return f"CAST(NULL AS {sql_type})"
            return f"TRY_CAST({ref} AS {sql_type})"

        time_ns_expr = _cast_expr("DOUBLE", "Time", "time")
        if "time" not in columns:
            logger.warning(f"Weather schema missing Time column: {weather_file}")
            return []

        query = f"""
            WITH normalized AS (
                SELECT
                    {time_ns_expr} AS time_ns,
                    {_cast_expr("DOUBLE", "air_temperature")} AS air_temp,
                    {_cast_expr("DOUBLE", "track_temperature")} AS track_temp,
                    {_cast_expr("DOUBLE", "humidity")} AS humidity,
                    {_cast_expr("DOUBLE", "pressure")} AS pressure,
                    {_cast_expr("INTEGER", "wind_direction")} AS wind_direction,
                    {_cast_expr("DOUBLE", "wind_speed")} AS wind_speed,
                    {_cast_expr("BOOLEAN", "Rainfall", "rainfall")} AS rainfall
                FROM read_parquet('{weather_file}')
            )
            SELECT
                time_ns / 1000000000.0 AS abs_ts,
                ROUND(air_temp, 1) AS airTemp,
                ROUND(track_temp, 1) AS trackTemp,
                ROUND(humidity, 1) AS humidity,
                ROUND(pressure, 1) AS pressure,
                wind_direction AS windDirection,
                ROUND(wind_speed, 1) AS windSpeed,
                CAST(CASE WHEN COALESCE(rainfall, FALSE) THEN 1 ELSE 0 END AS INTEGER) AS rainfall
            FROM normalized
            WHERE time_ns IS NOT NULL
            ORDER BY time_ns DESC
            LIMIT {max(1, int(limit))}
        """
        rows = conn.execute(query).fetchall()
        rows = list(reversed(rows))
        payload = []
        for row in rows:
            timestamp = float(row[0]) if row[0] is not None else None
            air_temp = round(float(row[1]), 1) if row[1] is not None else None
            track_temp = round(float(row[2]), 1) if row[2] is not None else None
            humidity = round(float(row[3]), 1) if row[3] is not None else None
            pressure = round(float(row[4]), 1) if row[4] is not None else None
            wind_direction = int(row[5]) if row[5] is not None else None
            wind_speed = round(float(row[6]), 1) if row[6] is not None else None
            rainfall = int(row[7]) if row[7] is not None else 0
            payload.append(
                {
                    "timestamp": timestamp,
                    "airTemp": air_temp,
                    "trackTemp": track_temp,
                    "humidity": humidity,
                    "pressure": pressure,
                    "windDirection": wind_direction,
                    "windSpeed": wind_speed,
                    "rainfall": rainfall,
                }
            )
        return payload
    except Exception as e:
        logger.error(f"Error reading weather: {e}")
        return []
    finally:
        conn.close()


def load_race_control(silver_path: str, limit: int = 200) -> list:
    rc_file = os.path.join(silver_path, "race_control.parquet")
    if not os.path.exists(rc_file):
        return []

    conn = duckdb.connect()
    try:
        def _normalize_seconds_expr(expr: str) -> str:
            return f"""
                CASE
                    WHEN {expr} IS NULL THEN NULL
                    WHEN abs({expr}) > 1e11 THEN {expr} / 1e9
                    WHEN abs({expr}) > 1e8 THEN {expr} / 1e6
                    WHEN abs({expr}) > 1e5 THEN {expr} / 1e3
                    ELSE {expr}
                END
            """

        def _session_epoch_offset_seconds() -> Optional[float]:
            laps_file = os.path.join(silver_path, "laps.parquet")
            if not os.path.exists(laps_file):
                return None
            try:
                laps_schema_query = f"DESCRIBE SELECT * FROM read_parquet('{laps_file}')"
                laps_columns = {
                    str(row[0]).lower(): str(row[0])
                    for row in conn.execute(laps_schema_query).fetchall()
                    if row and row[0]
                }

                def _laps_col_ref(*names: str) -> Optional[str]:
                    for name in names:
                        raw = laps_columns.get(name.lower())
                        if raw:
                            return f'"{raw}"'
                    return None

                lap_start_date_expr = _laps_col_ref("LapStartDate", "lap_start_date")
                lap_start_time_expr = _laps_col_ref("LapStartTime", "lap_start_time", "lapStartTime")
                lap_end_expr = _laps_col_ref("session_time_seconds", "sessionTimeSeconds", "session_time")
                lap_time_expr = _laps_col_ref("lap_time_seconds", "lapTime", "lap_time")

                if not lap_start_date_expr:
                    return None

                rel_start_expr: Optional[str] = None
                if lap_start_time_expr:
                    rel_start_expr = _normalize_seconds_expr(f"TRY_CAST({lap_start_time_expr} AS DOUBLE)")
                elif lap_end_expr and lap_time_expr:
                    rel_start_expr = f"""
                        (TRY_CAST({lap_end_expr} AS DOUBLE) - TRY_CAST({lap_time_expr} AS DOUBLE))
                    """
                if not rel_start_expr:
                    return None

                offset_query = f"""
                    SELECT AVG(epoch(TRY_CAST({lap_start_date_expr} AS TIMESTAMP)) - ({rel_start_expr}))
                    FROM read_parquet('{laps_file}')
                    WHERE {lap_start_date_expr} IS NOT NULL
                      AND ({rel_start_expr}) IS NOT NULL
                      AND ({rel_start_expr}) >= 0
                """
                row = conn.execute(offset_query).fetchone()
                if not row or row[0] is None:
                    return None
                return float(row[0])
            except Exception:
                return None

        session_epoch_offset = _session_epoch_offset_seconds()

        schema_query = f"DESCRIBE SELECT * FROM read_parquet('{rc_file}')"
        columns = {
            str(row[0]).lower(): str(row[0])
            for row in conn.execute(schema_query).fetchall()
            if row and row[0]
        }

        def _col_ref(*names: str) -> Optional[str]:
            for name in names:
                raw = columns.get(name.lower())
                if raw:
                    return f'"{raw}"'
            return None

        def _varchar_expr(*names: str) -> str:
            ref = _col_ref(*names)
            if ref is None:
                return "CAST('' AS VARCHAR)"
            return f"COALESCE(TRY_CAST({ref} AS VARCHAR), CAST('' AS VARCHAR))"

        def _int_expr(*names: str) -> str:
            ref = _col_ref(*names)
            if ref is None:
                return "CAST(NULL AS INTEGER)"
            return f"TRY_CAST({ref} AS INTEGER)"

        session_time_expr = _col_ref("session_time", "SessionTime", "Time", "time")
        if session_time_expr is None:
            logger.warning(f"Race control schema missing session-time column: {rc_file}")
            return []

        query = f"""
            WITH normalized AS (
                SELECT
                    TRY_CAST({session_time_expr} AS TIMESTAMP) AS session_time,
                    {_varchar_expr("category")} AS category,
                    {_varchar_expr("message")} AS message,
                    {_varchar_expr("Flag", "flag")} AS flag,
                    {_varchar_expr("Scope", "scope")} AS scope,
                    {_int_expr("Sector", "sector")} AS sector,
                    {_int_expr("RacingNumber", "racingNumber", "racing_number")} AS racingNumber,
                    {_int_expr("Lap", "lap")} AS lap
                FROM read_parquet('{rc_file}')
            )
            SELECT
                epoch(session_time) AS abs_ts,
                strftime('%H:%M:%S', session_time) AS time,
                category,
                message,
                flag,
                scope,
                sector,
                racingNumber,
                lap
            FROM normalized
            WHERE session_time IS NOT NULL
            ORDER BY session_time DESC
            LIMIT {max(1, int(limit))}
        """
        rows = conn.execute(query).fetchall()
        rows = list(reversed(rows))
        base_ts = float(rows[0][0]) if rows and rows[0][0] is not None else 0.0
        data = []
        for row in rows:
            ts_raw = float(row[0]) if row[0] is not None else None
            if ts_raw is None:
                ts_session = None
            elif session_epoch_offset is not None:
                ts_session = ts_raw - session_epoch_offset
            elif ts_raw > 1e8:
                # Backward-compatible fallback: if race-control time is absolute epoch and
                # we can't derive session epoch offset, keep prior relative behavior.
                ts_session = ts_raw - base_ts
            else:
                ts_session = ts_raw
            data.append(
                {
                    "timestamp": ts_session,
                    "time": str(row[1]) if row[1] is not None else "",
                    "category": str(row[2]) if row[2] is not None else "",
                    "message": str(row[3]) if row[3] is not None else "",
                    "flag": str(row[4]) if row[4] is not None else "",
                    "scope": str(row[5]) if row[5] is not None else "",
                    "sector": int(row[6]) if row[6] is not None else None,
                    "racingNumber": int(row[7]) if row[7] is not None else None,
                    "lap": int(row[8]) if row[8] is not None else None,
                }
            )
        return data
    except Exception as e:
        logger.error(f"Error reading race control: {e}")
        return []
    finally:
        conn.close()


def _centerline_with_dist(geometry: Optional[Dict[str, Any]]) -> List[Dict[str, float]]:
    if not geometry:
        return []
    layout = geometry.get("layout") if isinstance(geometry, dict) else None
    coords = (layout or {}).get("path_coordinates") if isinstance(layout, dict) else None
    pts = coords if isinstance(coords, list) and coords else geometry.get("centerline")
    if not pts:
        return []
    out: List[Dict[str, float]] = []
    total = 0.0
    prev: Optional[Tuple[float, float]] = None
    for p in pts:
        if isinstance(p, dict):
            x = float(p.get("x") or 0.0)
            y = float(p.get("y") or 0.0)
            dist = p.get("distance")
        else:
            if not p or len(p) < 2:
                continue
            x = float(p[0])
            y = float(p[1])
            dist = None
        if dist is None:
            if prev is not None:
                total += math.hypot(x - prev[0], y - prev[1])
            dist = total
        out.append({"x": x, "y": y, "distance": float(dist)})
        prev = (x, y)
    return out


def _recompute_distances(points: List[Dict[str, float]]) -> List[Dict[str, float]]:
    if not points:
        return points
    total = 0.0
    prev: Optional[Tuple[float, float]] = None
    out: List[Dict[str, float]] = []
    for p in points:
        x = float(p.get("x") or 0.0)
        y = float(p.get("y") or 0.0)
        if prev is not None:
            total += math.hypot(x - prev[0], y - prev[1])
        out.append({"x": x, "y": y, "distance": total})
        prev = (x, y)
    return out


def _is_placeholder_layout(geometry: Dict[str, Any]) -> bool:
    """Detect synthetic template layouts that are not track-accurate.

    The imported `_inputs/tracks/*` package can contain scaffold layouts sharing
    the exact same coordinate envelope and point scaffold across circuits.
    Those files are useful placeholders but should not override real geometry.
    """
    try:
        layout = geometry.get("layout") if isinstance(geometry, dict) else None
        coords = (layout or {}).get("path_coordinates") if isinstance(layout, dict) else None
        if not isinstance(coords, list) or len(coords) != 80:
            return False
        xs = [float(p.get("x") or 0.0) for p in coords if isinstance(p, dict)]
        ys = [float(p.get("y") or 0.0) for p in coords if isinstance(p, dict)]
        if len(xs) != 80 or len(ys) != 80:
            return False
        if (
            abs(min(xs) - 28.1) <= 0.2
            and abs(max(xs) - 771.9) <= 0.2
            and abs(min(ys) - 80.0) <= 0.2
            and abs(max(ys) - 520.0) <= 0.2
        ):
            p0 = coords[0] if isinstance(coords[0], dict) else {}
            p1 = coords[1] if isinstance(coords[1], dict) else {}
            # Signature of the generated placeholder template.
            if (
                abs(float(p0.get("x") or 0.0) - 750.0) <= 0.2
                and abs(float(p0.get("y") or 0.0) - 300.0) <= 0.2
                and abs(float(p1.get("x") or 0.0) - 760.56) <= 0.3
                and abs(float(p1.get("y") or 0.0) - 321.94) <= 0.3
            ):
                return True
    except Exception:
        return False
    return False


def _signed_area(pts: List[Dict[str, float]]) -> float:
    if not pts:
        return 0.0
    area = 0.0
    count = len(pts)
    for i in range(count):
        p0 = pts[i]
        p1 = pts[(i + 1) % count]
        x0 = float(p0.get("x") or 0.0)
        y0 = float(p0.get("y") or 0.0)
        x1 = float(p1.get("x") or 0.0)
        y1 = float(p1.get("y") or 0.0)
        area += (x0 * y1) - (x1 * y0)
    return area


def _project_distance(
    x: float,
    y: float,
    pts: List[Dict[str, float]],
    last_idx: Optional[int] = None,
    window: int = 40,
    max_sq_error: Optional[float] = None,
) -> Tuple[Optional[float], Optional[int], Optional[float]]:
    if not pts or len(pts) < 2:
        return None, last_idx, None
    count = len(pts)

    def _search(iterable: Any) -> Tuple[Optional[float], Optional[int], Optional[float]]:
        best = None
        best_idx = last_idx
        best_dist = None
        for i in iterable:
            p0 = pts[i]
            p1 = pts[(i + 1) % count]
            x0, y0 = float(p0["x"]), float(p0["y"])
            x1, y1 = float(p1["x"]), float(p1["y"])
            dx = x1 - x0
            dy = y1 - y0
            seg = dx * dx + dy * dy
            if seg <= 1e-12:
                continue
            t = ((x - x0) * dx + (y - y0) * dy) / seg
            t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
            px = x0 + dx * t
            py = y0 + dy * t
            d2 = (x - px) ** 2 + (y - py) ** 2
            if best is None or d2 < best:
                best = d2
                best_idx = i
                best_dist = float(p0["distance"]) + math.hypot(dx, dy) * t
        return best_dist, best_idx, best

    if last_idx is None or last_idx < 0 or last_idx >= count:
        return _search(range(count - 1))

    w = max(6, int(window))
    local = [int((last_idx + k) % (count - 1)) for k in range(-w, w + 1)]
    dist, idx, best = _search(local)
    # If the local projection is too far from the centerline, recover by
    # searching globally once to avoid branch-jump artifacts.
    if (
        max_sq_error is not None
        and best is not None
        and float(best) > float(max_sq_error)
    ):
        return _search(range(count - 1))
    return dist, idx, best


def _point_at_distance(pts: List[Dict[str, float]], dist: float) -> Tuple[float, float]:
    if not pts:
        return 0.0, 0.0
    if dist <= float(pts[0]["distance"]):
        return float(pts[0]["x"]), float(pts[0]["y"])
    if dist >= float(pts[-1]["distance"]):
        return float(pts[-1]["x"]), float(pts[-1]["y"])
    lo, hi = 0, len(pts) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if float(pts[mid]["distance"]) < dist:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    p0, p1 = pts[i - 1], pts[i]
    d0, d1 = float(p0["distance"]), float(p1["distance"])
    if d1 <= d0:
        return float(p0["x"]), float(p0["y"])
    w = (dist - d0) / (d1 - d0)
    x = float(p0["x"]) + (float(p1["x"]) - float(p0["x"])) * w
    y = float(p0["y"]) + (float(p1["y"]) - float(p0["y"])) * w
    return x, y


def _remap_positions_to_manual(rows: List[Dict[str, Any]], year: int, race_name: str) -> List[Dict[str, Any]]:
    # Canonical-only mode: no manual remapping.
    return rows


def load_positions(year: int, race_name: str, session: str) -> list:
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return []
    silver_path = os.path.join(year_path, race_dir, normalize_session_code(session))
    fastf1_positions_path = os.path.join(silver_path, "positions.parquet")
    silver_openf1_positions_path = os.path.join(silver_path, "openf1_positions.parquet")

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
                rows = df.to_dict(orient="records")
                rows = _remap_positions_to_manual(rows, int(year), str(race_name))
                if rows:
                    return rows
        except Exception as e:
            print(f"Error reading positions: {e}")

    if os.path.exists(silver_openf1_positions_path):
        try:
            conn = duckdb.connect()
            try:
                schema = {r[0] for r in conn.execute(f"DESCRIBE SELECT * FROM read_parquet('{silver_openf1_positions_path}')").fetchall()}
                if {"x", "y", "driver_number"}.issubset(schema) and ("timestamp" in schema or "session_time_seconds" in schema):
                    t_expr = "timestamp" if "timestamp" in schema else "session_time_seconds"
                    query = f"""
                        SELECT
                            {t_expr} AS timestamp,
                            driver_number AS driverNumber,
                            x,
                            y
                        FROM read_parquet('{silver_openf1_positions_path}')
                        WHERE driver_number IS NOT NULL
                        ORDER BY driverNumber, timestamp
                    """
                    df = conn.execute(query).df()
                else:
                    df = conn.execute(f"SELECT * FROM read_parquet('{silver_openf1_positions_path}')").df()
            finally:
                conn.close()
            if df is not None and not df.empty and {"timestamp", "driverNumber", "x", "y"}.issubset(set(df.columns)):
                df = _clean_positions(df)
                df = df.dropna(subset=["timestamp", "x", "y", "driverNumber"])
                rows = df[["timestamp", "driverNumber", "x", "y"]].to_dict(orient="records")
                rows = _remap_positions_to_manual(rows, int(year), str(race_name))
                if rows:
                    return rows
        except Exception:
            pass

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
    if df is not None and not df.empty and 'x' in df.columns and 'y' in df.columns:
        out = df[["timestamp", "driver_number", "x", "y"]].copy()
        out.columns = ["timestamp", "driverNumber", "x", "y"]
        out = out.dropna(subset=["timestamp", "x", "y", "driverNumber"])
        rows = out.to_dict(orient="records")
        rows = _remap_positions_to_manual(rows, int(year), str(race_name))
        if rows:
            return rows

    # Fallback approximation from telemetry is opt-in only.
    if ALLOW_SYNTHETIC_POSITIONS:
        return derive_positions_from_telemetry(year, race_name, session)
    return []

def _downsample_position_rows(rows: list, hz: float) -> list:
    if not isinstance(rows, list) or not rows:
        return []
    hz_val = float(hz or 0.0)
    if hz_val <= 0:
        return rows
    buckets = {}
    for row in rows:
        try:
            drv = int(row.get("driverNumber") or 0)
            ts = float(row.get("timestamp") or 0.0)
            key = (drv, int(ts * hz_val))
            prev = buckets.get(key)
            if prev is None or float(row.get("timestamp") or 0.0) >= float(prev.get("timestamp") or 0.0):
                buckets[key] = row
        except Exception:
            continue
    out = list(buckets.values())
    out.sort(key=lambda r: (int(r.get("driverNumber") or 0), float(r.get("timestamp") or 0.0)))
    max_rows = 50000
    if len(out) <= max_rows:
        return out
    try:
        n_drivers = max(1, len({int(r.get("driverNumber") or 0) for r in out}))
        per_driver = max(500, max_rows // n_drivers)
        trimmed = []
        current_driver = None
        driver_rows = []
        for row in out:
            drv = int(row.get("driverNumber") or 0)
            if current_driver is None:
                current_driver = drv
            if drv != current_driver:
                stride = max(1, len(driver_rows) // per_driver)
                trimmed.extend(driver_rows[::stride])
                driver_rows = []
                current_driver = drv
            driver_rows.append(row)
        if driver_rows:
            stride = max(1, len(driver_rows) // per_driver)
            trimmed.extend(driver_rows[::stride])
        return trimmed[:max_rows]
    except Exception:
        stride = max(1, len(out) // max_rows)
        return out[::stride][:max_rows]

def _cap_position_rows(rows: list, max_rows: int = 50000) -> list:
    if not isinstance(rows, list) or len(rows) <= max_rows:
        return rows or []
    try:
        by_driver = {}
        for row in rows:
            drv = int(row.get("driverNumber") or 0)
            by_driver.setdefault(drv, []).append(row)
        per_driver = max(500, max_rows // max(1, len(by_driver)))
        out = []
        for drv in sorted(by_driver.keys()):
            bucket = by_driver[drv]
            stride = max(1, len(bucket) // per_driver)
            out.extend(bucket[::stride])
        return out[:max_rows]
    except Exception:
        stride = max(1, len(rows) // max_rows)
        return rows[::stride][:max_rows]


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
                    "y": float(pos[1]),
                    "_projected": True,
                    "_trackDistance": float(distance),
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


def load_track_geometry(race_name: str, year: Optional[int] = None) -> Optional[Dict]:
    geometry_file = resolve_track_geometry_file(str(TRACK_GEOMETRY_DIR), race_name, year=year)
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
    # Keep base endpoint lightweight. Heavy datasets are fetched through
    # dedicated windowed endpoints (`/telemetry`, `/positions`) by the desktop app.
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
    track_geometry = load_track_geometry(race_dir, year=year)
    weather = []
    race_control = []
    
    total_laps = max([lap["lapNumber"] for lap in laps]) if laps else 57
    session_duration = metadata.get("duration", 5400)
    reason = telemetry_unavailable_reason(year, race_dir, session_code)
    telemetry_is_available = telemetry_available(silver_path, reason)
    
    return {
        "metadata": {
            "year": year,
            "raceName": race_dir,
            "sessionType": display_session_code(session_code),
            "duration": session_duration,
            "totalLaps": total_laps,
            "telemetryAvailable": telemetry_is_available,
            "telemetryUnavailableReason": reason
        },
        "drivers": drivers,
        "laps": laps,
        "telemetry": {},
        "positions": [],
        "weather": weather,
        "raceControl": race_control,
        "trackGeometry": track_geometry
    }


@router.get("/sessions/{year}/{race}/{session}/viz")
async def get_session_viz(
    year: int,
    race: str,
    session: str,
    include_positions: bool = False,
    include_weather: bool = True,
    include_race_control: bool = True,
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
    
    cache_key = (
        "session_viz",
        int(year),
        str(race_dir),
        str(session_code),
        int(bool(include_positions)),
        int(bool(include_weather)),
        int(bool(include_race_control)),
    )
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    metadata = load_metadata(year, race_dir, session_code)
    drivers = load_drivers(silver_path, year=year)
    laps = load_laps(silver_path, latest_only=True)
    positions = load_positions(year, race_dir, session_code) if include_positions else []
    track_geometry = load_track_geometry(race_dir, year=year)
    weather = load_weather(silver_path) if include_weather else []
    race_control = load_race_control(silver_path) if include_race_control else []
    pos_bounds = _positions_bounds(positions) if include_positions else _session_positions_bounds(silver_path)
    tel_bounds = _session_telemetry_bounds(silver_path)
    race_bounds = _session_race_time_bounds(silver_path, session_code)
    
    total_laps = max([lap["lapNumber"] for lap in laps]) if laps else 57
    session_duration = metadata.get("duration", 5400)
    reason = telemetry_unavailable_reason(year, race_dir, session_code)
    telemetry_is_available = telemetry_available(silver_path, reason)
    source_version = _build_source_version(
        year=int(year),
        race=str(race_dir),
        session=str(session_code),
        endpoint="session_viz",
        columns=["drivers", "laps", "positions", "weather", "raceControl"],
        row_count=int(len(drivers) + len(laps) + len(positions) + len(weather) + len(race_control)),
        min_ts=float((tel_bounds or pos_bounds or (0.0, 0.0))[0]),
        max_ts=float((tel_bounds or pos_bounds or (0.0, float(session_duration)))[1]),
    )
    
    payload = {
        "metadata": {
            "year": year,
            "raceName": race_dir,
            "sessionType": display_session_code(session_code),
            "duration": session_duration,
            "totalLaps": total_laps,
            "telemetryAvailable": telemetry_is_available,
            "telemetryUnavailableReason": reason,
            "positionsTimeBounds": [float(pos_bounds[0]), float(pos_bounds[1])] if pos_bounds else None,
            "telemetryTimeBounds": [float(tel_bounds[0]), float(tel_bounds[1])] if tel_bounds else None,
            "raceStartSeconds": float(race_bounds[0]) if race_bounds else None,
            "raceEndSeconds": float(race_bounds[1]) if race_bounds else None,
            "raceDurationSeconds": float(race_bounds[1] - race_bounds[0]) if race_bounds else None,
            "sourceVersion": str(source_version),
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
    with_metadata: bool = Query(default=False),
) -> dict:
    started_at = time.perf_counter()
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
    if len(driver_numbers) > MAX_SESSION_DRIVERS:
        raise HTTPException(status_code=413, detail=f"Max {MAX_SESSION_DRIVERS} drivers per request")
    t0_bound, t1_bound = _resolve_time_window(t0, t1, DEFAULT_TELEMETRY_WINDOW_S)
    cache_key = (
        "session_telemetry",
        int(year),
        str(race_dir),
        str(session_code),
        ",".join(str(x) for x in driver_numbers),
        float(hz),
        float(t0_bound),
        float(t1_bound),
    )
    cached = cache_get(cache_key)
    if cached is not None and _telemetry_row_count(cached) > 0:
        rows_total, min_ts, max_ts, cols = _telemetry_series_stats(cached)
        meta = {
            "t0": float(t0_bound),
            "t1": float(t1_bound),
            "hz": float(hz),
            "requestedDrivers": [int(x) for x in driver_numbers],
            "rowCount": int(rows_total),
            "rowLimit": int(MAX_SESSION_TELEMETRY_ROWS),
            "truncated": bool(rows_total >= int(MAX_SESSION_TELEMETRY_ROWS)),
            "timeBounds": [float(min_ts), float(max_ts)] if min_ts is not None and max_ts is not None else None,
            "sourceVersion": _build_source_version(
                year=int(year),
                race=str(race_dir),
                session=str(session_code),
                endpoint="session_telemetry",
                columns=cols,
                row_count=int(rows_total),
                min_ts=min_ts,
                max_ts=max_ts,
            ),
            "requestId": _request_id(),
        }
        payload_out: Dict[str, Any] = (
            {"telemetry": cached, "metadata": meta}
            if with_metadata
            else cached
        )
        metrics_router.record_endpoint_sample(
            _SESSION_TEL_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            _estimate_payload_bytes(payload_out),
            int(rows_total),
        )
        return payload_out

    telemetry = load_telemetry(
        silver_path,
        driver_numbers=driver_numbers,
        t0=t0_bound,
        t1=t1_bound,
        hz=hz,
        max_rows=MAX_SESSION_TELEMETRY_ROWS,
    )
    reason = telemetry_unavailable_reason(year, race_dir, session_code)
    if reason and not telemetry:
        payload: Dict[str, Any] = {"telemetry": {}, "telemetryUnavailableReason": reason}
        if with_metadata:
            payload["metadata"] = {
                "t0": float(t0_bound),
                "t1": float(t1_bound),
                "hz": float(hz),
                "requestedDrivers": [int(x) for x in driver_numbers],
                "rowCount": 0,
                "rowLimit": int(MAX_SESSION_TELEMETRY_ROWS),
                "truncated": False,
                "timeBounds": None,
                "sourceVersion": _build_source_version(
                    year=int(year),
                    race=str(race_dir),
                    session=str(session_code),
                    endpoint="session_telemetry",
                    columns=[],
                    row_count=0,
                    min_ts=None,
                    max_ts=None,
                ),
                "requestId": _request_id(),
            }
        metrics_router.record_endpoint_sample(
            _SESSION_TEL_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            _estimate_payload_bytes(payload),
            0,
        )
        return payload
    payload = telemetry
    if _telemetry_row_count(telemetry) > 0:
        payload = cache_set(cache_key, telemetry)
    rows_total, min_ts, max_ts, cols = _telemetry_series_stats(payload)
    metadata = {
        "t0": float(t0_bound),
        "t1": float(t1_bound),
        "hz": float(hz),
        "requestedDrivers": [int(x) for x in driver_numbers],
        "rowCount": int(rows_total),
        "rowLimit": int(MAX_SESSION_TELEMETRY_ROWS),
        "truncated": bool(rows_total >= int(MAX_SESSION_TELEMETRY_ROWS)),
        "timeBounds": [float(min_ts), float(max_ts)] if min_ts is not None and max_ts is not None else None,
        "sourceVersion": _build_source_version(
            year=int(year),
            race=str(race_dir),
            session=str(session_code),
            endpoint="session_telemetry",
            columns=cols,
            row_count=int(rows_total),
            min_ts=min_ts,
            max_ts=max_ts,
        ),
        "requestId": _request_id(),
    }
    payload_out: Dict[str, Any] = {"telemetry": payload, "metadata": metadata} if with_metadata else payload
    metrics_router.record_endpoint_sample(
        _SESSION_TEL_ROUTE,
        (time.perf_counter() - started_at) * 1000.0,
        _estimate_payload_bytes(payload_out),
        int(rows_total),
    )
    return payload_out


@router.get("/sessions/{year}/{race}/{session}/positions")
async def get_session_positions(
    year: int,
    race: str,
    session: str,
    drivers: Optional[str] = Query(default=None, description="Comma-separated driver numbers (e.g. 1,44)"),
    hz: float = Query(default=2.0, ge=0.0, le=50.0),
    t0: Optional[float] = Query(default=None),
    t1: Optional[float] = Query(default=None),
    with_metadata: bool = Query(default=False),
) -> Any:
    started_at = time.perf_counter()
    race_name = race.replace("-", " ")
    session_code = normalize_session_code(session)
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        logger.warning(
            "session_positions_missing_race year=%s race=%s session=%s",
            str(year),
            str(race_name),
            str(session_code),
        )
        metrics_router.record_endpoint_sample(
            _SESSION_POS_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            2,
            0,
        )
        return []

    driver_numbers = _parse_driver_numbers(drivers)
    if len(driver_numbers) > MAX_SESSION_DRIVERS:
        raise HTTPException(status_code=413, detail=f"Max {MAX_SESSION_DRIVERS} drivers per request")
    t0_bound, t1_bound = _resolve_time_window(t0, t1, DEFAULT_POSITIONS_WINDOW_S)
    cache_key = (
        "session_positions",
        int(year),
        str(race_dir),
        str(session_code),
        ",".join(str(x) for x in driver_numbers),
        float(hz),
        float(t0_bound),
        float(t1_bound),
    )
    cached = cache_get(cache_key)
    if isinstance(cached, list) and len(cached) > 0:
        rows_total, min_ts, max_ts, cols = _positions_series_stats(cached)
        payload_cached: Any = cached
        if with_metadata:
            payload_cached = {
                "positions": cached,
                "metadata": {
                    "t0": float(t0_bound),
                    "t1": float(t1_bound),
                    "hz": float(hz),
                    "requestedDrivers": [int(x) for x in driver_numbers],
                    "rowCount": int(rows_total),
                    "rowLimit": int(MAX_SESSION_POSITIONS_ROWS),
                    "truncated": bool(rows_total >= int(MAX_SESSION_POSITIONS_ROWS)),
                    "timeBounds": [float(min_ts), float(max_ts)] if min_ts is not None and max_ts is not None else None,
                    "sourceVersion": _build_source_version(
                        year=int(year),
                        race=str(race_dir),
                        session=str(session_code),
                        endpoint="session_positions",
                        columns=cols,
                        row_count=int(rows_total),
                        min_ts=min_ts,
                        max_ts=max_ts,
                    ),
                    "requestId": _request_id(),
                },
            }
        metrics_router.record_endpoint_sample(
            _SESSION_POS_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            _estimate_payload_bytes(payload_cached),
            len(cached) if isinstance(cached, list) else 0,
        )
        return payload_cached

    silver_path = get_session_path(year, race_dir, session_code)
    positions_file = os.path.join(silver_path, "positions.parquet") if silver_path else ""

    if silver_path and os.path.exists(positions_file):
        try:
            conn = duckdb.connect()
            try:
                schema = {r[0] for r in conn.execute("DESCRIBE SELECT * FROM read_parquet(?)", [positions_file]).fetchall()}
                hz_val = max(0.0, min(50.0, float(hz or 0.0)))
                row_limit = int(MAX_SESSION_POSITIONS_ROWS)

                base_where = [
                    "driver_number IS NOT NULL",
                    "x IS NOT NULL",
                    "y IS NOT NULL",
                ]
                params: List[Any] = [positions_file]
                if driver_numbers:
                    base_where.append("driver_number IN (" + ",".join(["?"] * len(driver_numbers)) + ")")
                    params.extend([int(x) for x in driver_numbers])
                base_where_sql = " AND ".join(base_where)
                query = ""

                if "session_time_seconds" in schema:
                    if hz_val > 0:
                        bucket = f"CAST(floor(timestamp * {hz_val}) AS BIGINT)"
                        query = f"""
                            WITH filtered AS (
                                SELECT
                                    CAST(session_time_seconds AS DOUBLE) AS timestamp,
                                    CAST(driver_number AS INTEGER) AS driverNumber,
                                    CAST(x AS DOUBLE) AS x,
                                    CAST(y AS DOUBLE) AS y
                                FROM read_parquet(?)
                                WHERE {base_where_sql}
                                  AND session_time_seconds >= ?
                                  AND session_time_seconds <= ?
                            ),
                            ranked AS (
                                SELECT
                                    *,
                                    row_number() OVER (
                                        PARTITION BY driverNumber, {bucket}
                                        ORDER BY timestamp DESC
                                    ) AS rn
                                FROM filtered
                            )
                            SELECT timestamp, driverNumber, x, y
                            FROM ranked
                            WHERE rn = 1
                            ORDER BY driverNumber, timestamp
                            LIMIT ?
                        """
                    else:
                        query = f"""
                            SELECT
                                CAST(session_time_seconds AS DOUBLE) AS timestamp,
                                CAST(driver_number AS INTEGER) AS driverNumber,
                                CAST(x AS DOUBLE) AS x,
                                CAST(y AS DOUBLE) AS y
                            FROM read_parquet(?)
                            WHERE {base_where_sql}
                              AND session_time_seconds >= ?
                              AND session_time_seconds <= ?
                            ORDER BY driverNumber, timestamp
                            LIMIT ?
                        """
                    params.extend([float(t0_bound), float(t1_bound), int(row_limit) + 1])
                elif "date" in schema:
                    if hz_val > 0:
                        query = f"""
                            WITH filtered AS (
                                SELECT
                                    epoch(date) AS t_epoch,
                                    CAST(driver_number AS INTEGER) AS driverNumber,
                                    CAST(x AS DOUBLE) AS x,
                                    CAST(y AS DOUBLE) AS y
                                FROM read_parquet(?)
                                WHERE {base_where_sql}
                            ),
                            anchored AS (
                                SELECT
                                    t_epoch - min(t_epoch) OVER () AS timestamp,
                                    driverNumber,
                                    x,
                                    y
                                FROM filtered
                            ),
                            ranked AS (
                                SELECT
                                    *,
                                    row_number() OVER (
                                        PARTITION BY driverNumber, CAST(floor(timestamp * {hz_val}) AS BIGINT)
                                        ORDER BY timestamp DESC
                                    ) AS rn
                                FROM anchored
                                WHERE timestamp >= ? AND timestamp <= ?
                            )
                            SELECT timestamp, driverNumber, x, y
                            FROM ranked
                            WHERE rn = 1
                            ORDER BY driverNumber, timestamp
                            LIMIT ?
                        """
                    else:
                        query = f"""
                            WITH filtered AS (
                                SELECT
                                    epoch(date) AS t_epoch,
                                    CAST(driver_number AS INTEGER) AS driverNumber,
                                    CAST(x AS DOUBLE) AS x,
                                    CAST(y AS DOUBLE) AS y
                                FROM read_parquet(?)
                                WHERE {base_where_sql}
                            ),
                            anchored AS (
                                SELECT
                                    t_epoch - min(t_epoch) OVER () AS timestamp,
                                    driverNumber,
                                    x,
                                    y
                                FROM filtered
                            )
                            SELECT timestamp, driverNumber, x, y
                            FROM anchored
                            WHERE timestamp >= ? AND timestamp <= ?
                            ORDER BY driverNumber, timestamp
                            LIMIT ?
                        """
                    params.extend([float(t0_bound), float(t1_bound), int(row_limit) + 1])

                if query:
                    rows = conn.execute(query, params).fetchall()
                    if len(rows) > row_limit:
                        raise HTTPException(status_code=413, detail=f"Result exceeds {row_limit} rows")
                    payload_rows = [
                        {
                            "timestamp": float(r[0]),
                            "driverNumber": int(r[1]),
                            "x": float(r[2]),
                            "y": float(r[3]),
                        }
                        for r in rows
                    ]
                    payload = payload_rows
                    if payload_rows:
                        payload = cache_set(cache_key, payload_rows)
                    rows_total, min_ts, max_ts, cols = _positions_series_stats(payload)
                    payload_out: Any = payload
                    if with_metadata:
                        payload_out = {
                            "positions": payload,
                            "metadata": {
                                "t0": float(t0_bound),
                                "t1": float(t1_bound),
                                "hz": float(hz),
                                "requestedDrivers": [int(x) for x in driver_numbers],
                                "rowCount": int(rows_total),
                                "rowLimit": int(MAX_SESSION_POSITIONS_ROWS),
                                "truncated": bool(rows_total >= int(MAX_SESSION_POSITIONS_ROWS)),
                                "timeBounds": [float(min_ts), float(max_ts)] if min_ts is not None and max_ts is not None else None,
                                "sourceVersion": _build_source_version(
                                    year=int(year),
                                    race=str(race_dir),
                                    session=str(session_code),
                                    endpoint="session_positions",
                                    columns=cols,
                                    row_count=int(rows_total),
                                    min_ts=min_ts,
                                    max_ts=max_ts,
                                ),
                                "requestId": _request_id(),
                            },
                        }
                    metrics_router.record_endpoint_sample(
                        _SESSION_POS_ROUTE,
                        (time.perf_counter() - started_at) * 1000.0,
                        _estimate_payload_bytes(payload_out),
                        len(payload) if isinstance(payload, list) else 0,
                    )
                    return payload_out
            finally:
                conn.close()
        except HTTPException:
            raise
        except Exception:
            pass

    # Do not fallback to unbounded legacy loaders here; they can trigger full-session
    # in-memory parquet reads and stall the UI thread in local mode. Keep this endpoint
    # predictably bounded.
    payload: List[Dict[str, Any]] = []
    payload_out: Any = payload
    if with_metadata:
        payload_out = {
            "positions": payload,
            "metadata": {
                "t0": float(t0_bound),
                "t1": float(t1_bound),
                "hz": float(hz),
                "requestedDrivers": [int(x) for x in driver_numbers],
                "rowCount": 0,
                "rowLimit": int(MAX_SESSION_POSITIONS_ROWS),
                "truncated": False,
                "timeBounds": None,
                "sourceVersion": _build_source_version(
                    year=int(year),
                    race=str(race_dir),
                    session=str(session_code),
                    endpoint="session_positions",
                    columns=[],
                    row_count=0,
                    min_ts=None,
                    max_ts=None,
                ),
                "requestId": _request_id(),
            },
        }
    metrics_router.record_endpoint_sample(
        _SESSION_POS_ROUTE,
        (time.perf_counter() - started_at) * 1000.0,
        _estimate_payload_bytes(payload_out),
        0,
    )
    return payload_out
