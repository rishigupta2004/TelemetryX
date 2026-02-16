from __future__ import annotations

import os
import builtins
import json
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from db.connection import db_connection
from ..config import SILVER_DIR
from ..utils import normalize_session_code, resolve_dir
from . import metrics as metrics_router

router = APIRouter()

MAX_WINDOW_S = 30.0
MAX_LAP_WINDOW_S = 180.0
MAX_CHANNELS = 8
MAX_SAMPLES = 5_000
ALLOWED_CHANNELS = {"speed", "throttle", "brake", "rpm", "gear", "drs"}
_STREAM_METRICS_ROUTE = "/api/v1/telemetry/{year}/{round}/stream"


def _estimate_payload_bytes(payload: Any) -> int:
    try:
        return len(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8"))
    except Exception:
        return 0


def get_session_path(year: int, race_name: str, session_type: Optional[str] = None) -> Optional[str]:
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return None
    if session_type:
        path = os.path.join(year_path, race_dir, normalize_session_code(session_type))
        return path if os.path.exists(path) else None
    for code in ("Q", "R", "S", "SS"):
        path = os.path.join(year_path, race_dir, code)
        if os.path.exists(path):
            return path
    return None


def _resolve_driver_number(silver_path: str, driver: str) -> Optional[int]:
    if driver.isdigit():
        return int(driver)
    laps_file = os.path.join(silver_path, "laps.parquet")
    if not os.path.exists(laps_file):
        return None
    row = db_connection.conn.execute(
        "SELECT CAST(driver_number AS INTEGER) FROM read_parquet(?) WHERE driver_name = ? LIMIT 1",
        [laps_file, driver],
    ).fetchone()
    if not row:
        return None
    return int(row[0])


def _normalize_channel_value(channel: str, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return 1 if value else 0
    try:
        numeric = float(value)
    except Exception:
        return value
    if channel in {"throttle", "brake"} and 0.0 <= numeric <= 1.0:
        numeric *= 100.0
    if channel in {"gear", "drs"}:
        return int(round(numeric))
    return builtins.round(numeric, 2)


@router.get("/telemetry/{year}/{round}/stream")
async def get_telemetry_stream(
    year: int,
    round: str,
    time_start_ms: Optional[int] = Query(default=None, description="Window start in milliseconds"),
    time_end_ms: Optional[int] = Query(default=None, description="Window end in milliseconds"),
    driver_number: int = Query(...),
    channels: List[str] = Query(default=["speed", "throttle", "brake"]),
    session_type: str = Query(default="R"),
    lap_number: Optional[int] = Query(default=None, ge=1),
) -> Dict[str, Any]:
    started_at = time.perf_counter()
    if lap_number is None and (time_start_ms is None or time_end_ms is None):
        raise HTTPException(status_code=422, detail="time_start_ms and time_end_ms are required when lap_number is not provided")
    if lap_number is None and int(time_end_ms) <= int(time_start_ms):
        raise HTTPException(status_code=400, detail="time_end_ms must be greater than time_start_ms")
    if len(channels) > MAX_CHANNELS:
        raise HTTPException(status_code=413, detail=f"Max {MAX_CHANNELS} channels per request")

    requested = [str(c).strip().lower() for c in channels if str(c).strip()]
    if not requested:
        requested = ["speed", "throttle", "brake"]
    invalid = [c for c in requested if c not in ALLOWED_CHANNELS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid channels: {invalid}")

    race_name = round.replace("-", " ")
    silver_path = get_session_path(year, race_name, session_type=session_type)
    if not silver_path:
        payload = {
            "driver_number": driver_number,
            "time_window": [int(time_start_ms or 0), int(time_end_ms or 0)],
            "channels": requested,
            "samples": 0,
            "data": [],
        }
        metrics_router.record_endpoint_sample(
            _STREAM_METRICS_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            _estimate_payload_bytes(payload),
            0,
        )
        return payload

    if lap_number is not None:
        laps_file = os.path.join(silver_path, "laps.parquet")
        if not os.path.exists(laps_file):
            raise HTTPException(status_code=404, detail="Laps data not found for lap selection")
        lap_row = db_connection.conn.execute(
            """
            SELECT
                CAST(session_time_seconds AS DOUBLE) AS end_time,
                CAST(lap_time_seconds AS DOUBLE) AS duration
            FROM read_parquet(?)
            WHERE CAST(driver_number AS INTEGER) = ? AND CAST(lap_number AS INTEGER) = ?
            LIMIT 1
            """,
            [laps_file, int(driver_number), int(lap_number)],
        ).fetchone()
        if not lap_row:
            raise HTTPException(status_code=404, detail="Lap not found")
        end_time = float(lap_row[0] or 0.0)
        duration = float(lap_row[1] or 0.0)
        time_start_ms = int(max(0.0, end_time - duration) * 1000.0)
        time_end_ms = int(end_time * 1000.0)

    duration_s = max(0.0, (float(time_end_ms) - float(time_start_ms)) / 1000.0)
    max_window = MAX_LAP_WINDOW_S if lap_number is not None else MAX_WINDOW_S
    if duration_s > max_window:
        raise HTTPException(status_code=413, detail=f"Window exceeds {int(max_window)}s limit")

    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        payload = {"driver_number": driver_number, "time_window": [time_start_ms, time_end_ms], "channels": requested, "samples": 0, "data": []}
        metrics_router.record_endpoint_sample(
            _STREAM_METRICS_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            _estimate_payload_bytes(payload),
            0,
        )
        return payload

    select_cols = ["session_time_seconds * 1000.0 AS time_ms"] + requested
    sql = f"""
        SELECT {", ".join(select_cols)}
        FROM read_parquet(?)
        WHERE CAST(driver_number AS INTEGER) = ?
          AND (session_time_seconds * 1000.0) BETWEEN ? AND ?
        ORDER BY session_time_seconds
        LIMIT ?
    """
    rows = db_connection.conn.execute(
        sql,
        [telemetry_file, int(driver_number), int(time_start_ms), int(time_end_ms), int(MAX_SAMPLES + 1)],
    ).fetchall()
    if len(rows) > MAX_SAMPLES:
        raise HTTPException(status_code=413, detail=f"Result exceeds {MAX_SAMPLES} samples")

    data: List[Dict[str, Any]] = []
    for r in rows:
        item: Dict[str, Any] = {"time_ms": float(r[0])}
        for idx, name in enumerate(requested, start=1):
            item[name] = _normalize_channel_value(name, r[idx])
        data.append(item)
    payload = {
        "driver_number": int(driver_number),
        "time_window": [int(time_start_ms), int(time_end_ms)],
        "channels": requested,
        "samples": len(data),
        "data": data,
    }
    metrics_router.record_endpoint_sample(
        _STREAM_METRICS_ROUTE,
        (time.perf_counter() - started_at) * 1000.0,
        _estimate_payload_bytes(payload),
        len(data),
    )
    return payload


@router.get("/telemetry/{year}/{round}")
async def get_telemetry(
    year: int,
    round: str,
    driver: Optional[str] = None,
    lap: Optional[int] = None,
    session_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Backward-compatible endpoint."""
    race_name = round.replace("-", " ")
    silver_path = get_session_path(year, race_name, session_type=session_type)
    if not silver_path:
        return []
    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(telemetry_file):
        return []

    if not driver:
        sql = """
            SELECT
                session_time_seconds,
                CAST(driver_number AS INTEGER) AS driver_number,
                speed,
                throttle,
                brake,
                rpm,
                gear,
                drs
            FROM read_parquet(?)
            ORDER BY driver_number, session_time_seconds
        """
        rows = db_connection.conn.execute(sql, [telemetry_file]).fetchall()
        return [
            {
                "session_time_seconds": float(r[0]),
                "driver_number": int(r[1]),
                "speed": _normalize_channel_value("speed", r[2]),
                "throttle": _normalize_channel_value("throttle", r[3]),
                "brake": _normalize_channel_value("brake", r[4]),
                "rpm": _normalize_channel_value("rpm", r[5]),
                "gear": _normalize_channel_value("gear", r[6]),
                "drs": _normalize_channel_value("drs", r[7]),
            }
            for r in rows
        ]

    driver_number = _resolve_driver_number(silver_path, str(driver))
    if driver_number is None:
        return []

    if lap is not None:
        laps_file = os.path.join(silver_path, "laps.parquet")
        if not os.path.exists(laps_file):
            return []
        lap_row = db_connection.conn.execute(
            """
            SELECT
                CAST(session_time_seconds AS DOUBLE) AS end_time,
                CAST(lap_time_seconds AS DOUBLE) AS duration
            FROM read_parquet(?)
            WHERE CAST(driver_number AS INTEGER) = ? AND CAST(lap_number AS INTEGER) = ?
            LIMIT 1
            """,
            [laps_file, int(driver_number), int(lap)],
        ).fetchone()
        if not lap_row:
            return []
        end_time = float(lap_row[0] or 0.0)
        duration = float(lap_row[1] or 0.0)
        start_ms = int(max(0.0, end_time - duration) * 1000.0)
        end_ms = int(end_time * 1000.0)
    else:
        sql = """
            SELECT
                session_time_seconds,
                CAST(driver_number AS INTEGER) AS driver_number,
                speed,
                throttle,
                brake,
                rpm,
                gear,
                drs
            FROM read_parquet(?)
            WHERE CAST(driver_number AS INTEGER) = ?
            ORDER BY session_time_seconds
        """
        rows = db_connection.conn.execute(sql, [telemetry_file, int(driver_number)]).fetchall()
        return [
            {
                "session_time_seconds": float(r[0]),
                "driver_number": int(r[1]),
                "speed": _normalize_channel_value("speed", r[2]),
                "throttle": _normalize_channel_value("throttle", r[3]),
                "brake": _normalize_channel_value("brake", r[4]),
                "rpm": _normalize_channel_value("rpm", r[5]),
                "gear": _normalize_channel_value("gear", r[6]),
                "drs": _normalize_channel_value("drs", r[7]),
            }
            for r in rows
        ]

    lap_sql = """
        SELECT
            session_time_seconds,
            CAST(driver_number AS INTEGER) AS driver_number,
            speed,
            throttle,
            brake,
            rpm,
            gear,
            drs
        FROM read_parquet(?)
        WHERE CAST(driver_number AS INTEGER) = ?
          AND (session_time_seconds * 1000.0) BETWEEN ? AND ?
        ORDER BY session_time_seconds
    """
    rows = db_connection.conn.execute(
        lap_sql,
        [telemetry_file, int(driver_number), int(start_ms), int(end_ms)],
    ).fetchall()
    return [
        {
            "session_time_seconds": float(r[0]),
            "driver_number": int(r[1]),
            "speed": _normalize_channel_value("speed", r[2]),
            "throttle": _normalize_channel_value("throttle", r[3]),
            "brake": _normalize_channel_value("brake", r[4]),
            "rpm": _normalize_channel_value("rpm", r[5]),
            "gear": _normalize_channel_value("gear", r[6]),
            "drs": _normalize_channel_value("drs", r[7]),
        }
        for r in rows
    ]


@router.get("/telemetry/{year}/{round}/{driver_id}/laps/{lap_number}")
async def get_lap_telemetry(
    year: int,
    round: str,
    driver_id: str,
    lap_number: int,
    session_type: Optional[str] = None,
) -> Dict[str, Any]:
    race_name = round.replace("-", " ")
    silver_path = get_session_path(year, race_name, session_type=session_type)
    if not silver_path:
        raise HTTPException(status_code=404, detail="Session not found")
    laps_file = os.path.join(silver_path, "laps.parquet")
    telemetry_file = os.path.join(silver_path, "telemetry.parquet")
    if not os.path.exists(laps_file) or not os.path.exists(telemetry_file):
        raise HTTPException(status_code=404, detail="Data files not found")

    driver_number = _resolve_driver_number(silver_path, str(driver_id))
    if driver_number is None:
        raise HTTPException(status_code=404, detail="Driver not found")

    lap_row = db_connection.conn.execute(
        """
        SELECT
            CAST(session_time_seconds AS DOUBLE) AS end_time,
            CAST(lap_time_seconds AS DOUBLE) AS duration
        FROM read_parquet(?)
        WHERE CAST(driver_number AS INTEGER) = ? AND CAST(lap_number AS INTEGER) = ?
        LIMIT 1
        """,
        [laps_file, int(driver_number), int(lap_number)],
    ).fetchone()
    if not lap_row:
        raise HTTPException(status_code=404, detail="Lap not found")

    end_time = float(lap_row[0] or 0.0)
    duration = float(lap_row[1] or 0.0)
    start_ms = int(max(0.0, end_time - duration) * 1000.0)
    end_ms = int(end_time * 1000.0)
    payload = await get_telemetry_stream(
        year=year,
        round=round,
        time_start_ms=start_ms,
        time_end_ms=end_ms,
        driver_number=int(driver_number),
        channels=["speed", "throttle", "brake", "rpm", "gear", "drs"],
        session_type=session_type or "R",
    )
    return {
        "driver": str(driver_id),
        "lap": int(lap_number),
        "data": payload.get("data", []),
    }
