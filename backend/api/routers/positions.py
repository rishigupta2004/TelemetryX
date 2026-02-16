from __future__ import annotations

import os
import json
import time
from typing import Any, Dict, List, Optional, Tuple

import duckdb
from fastapi import APIRouter, HTTPException, Query

from db.connection import db_connection
from ..config import BRONZE_DIR, GOLD_DIR, SILVER_DIR
from ..utils import normalize_session_code, resolve_dir
from . import metrics as metrics_router

router = APIRouter()

MAX_WINDOW_S = 60.0
MAX_ROWS = 10_000
MAX_DRIVERS = 5
COORD_ABS_LIMIT = 1_000_000.0
_STREAM_METRICS_ROUTE = "/api/v1/positions/{year}/{round}/stream"


def _estimate_payload_bytes(payload: Any) -> int:
    try:
        return len(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8"))
    except Exception:
        return 0


def _candidate_position_files(year: int, race_name: str, session: str) -> List[str]:
    sess = normalize_session_code(session)
    files: List[str] = []
    roots = [
        os.path.join(SILVER_DIR, str(year)),
        os.path.join(BRONZE_DIR, str(year)),
        os.path.join(GOLD_DIR, str(year)),
    ]
    for root in roots:
        race_dir = resolve_dir(root, race_name) or race_name
        base = os.path.join(root, race_dir, sess)
        files.extend(
            [
                os.path.join(base, "positions.parquet"),
                os.path.join(base, "openf1", "positions.parquet"),
                os.path.join(base, "openf1", "telemetry_3d.parquet"),
                os.path.join(base, "track_map.parquet"),
            ]
        )
    out: List[str] = []
    seen = set()
    for path in files:
        if path in seen or not os.path.exists(path):
            continue
        seen.add(path)
        out.append(path)
    return out


def _column_set(path: str) -> set[str]:
    conn = duckdb.connect()
    try:
        rows = conn.execute("DESCRIBE SELECT * FROM read_parquet(?)", [path]).fetchall()
        return {str(r[0]) for r in rows}
    finally:
        conn.close()


def _shape(path: str) -> Optional[Tuple[str, str, str, str]]:
    cols = _column_set(path)
    x_col = "position_x" if "position_x" in cols else ("x" if "x" in cols else "")
    y_col = "position_y" if "position_y" in cols else ("y" if "y" in cols else "")
    d_col = "driver_number" if "driver_number" in cols else ("driver" if "driver" in cols else "")
    if not x_col or not y_col or not d_col:
        return None
    if "session_time_seconds" in cols:
        return x_col, y_col, d_col, "session_time_seconds"
    if "timestamp" in cols:
        return x_col, y_col, d_col, "timestamp"
    if "date" in cols:
        return x_col, y_col, d_col, "date"
    return None


@router.get("/positions/{year}/{round}/stream")
async def get_positions_stream(
    year: int,
    round: str,
    time_start_ms: int = Query(..., description="Window start in milliseconds"),
    time_end_ms: int = Query(..., description="Window end in milliseconds"),
    drivers: Optional[List[int]] = Query(default=None),
    sample_rate: int = Query(default=1, ge=1, le=100),
    session_type: str = Query(default="R"),
) -> List[Dict[str, Any]]:
    started_at = time.perf_counter()
    if int(time_end_ms) <= int(time_start_ms):
        raise HTTPException(status_code=400, detail="time_end_ms must be greater than time_start_ms")

    race_name = round.replace("-", " ")
    duration_s = max(0.0, (float(time_end_ms) - float(time_start_ms)) / 1000.0)
    if duration_s > MAX_WINDOW_S:
        raise HTTPException(status_code=413, detail=f"Window exceeds {int(MAX_WINDOW_S)}s limit")
    if drivers and len(drivers) > MAX_DRIVERS:
        raise HTTPException(status_code=413, detail=f"Max {MAX_DRIVERS} drivers per request")

    candidates = _candidate_position_files(year, race_name, session_type)
    if not candidates:
        metrics_router.record_endpoint_sample(
            _STREAM_METRICS_ROUTE,
            (time.perf_counter() - started_at) * 1000.0,
            2,
            0,
        )
        return []

    for path in candidates:
        shaped = _shape(path)
        if not shaped:
            continue
        x_col, y_col, d_col, time_col = shaped
        try:
            where = [
                "x IS NOT NULL",
                "y IS NOT NULL",
                "driver_number IS NOT NULL",
                f"abs(x) <= {float(COORD_ABS_LIMIT)}",
                f"abs(y) <= {float(COORD_ABS_LIMIT)}",
                "time_ms BETWEEN ? AND ?",
            ]
            params: List[Any] = [int(time_start_ms), int(time_end_ms)]
            if drivers:
                where.append("driver_number IN (" + ",".join(["?"] * len(drivers)) + ")")
                params.extend([int(x) for x in drivers])

            if time_col == "date":
                source = f"""
                    SELECT
                        (epoch(date) - min(epoch(date)) OVER ()) * 1000.0 AS time_ms,
                        CAST({d_col} AS INTEGER) AS driver_number,
                        CAST({x_col} AS DOUBLE) AS x,
                        CAST({y_col} AS DOUBLE) AS y
                    FROM read_parquet(?)
                """
            else:
                if time_col == "session_time_seconds":
                    t_expr = "session_time_seconds * 1000.0"
                else:
                    # Support absolute epoch timestamps by normalizing to session-relative ms.
                    t_expr = "(timestamp - min(timestamp) OVER ()) * 1000.0"
                source = f"""
                    SELECT
                        {t_expr} AS time_ms,
                        CAST({d_col} AS INTEGER) AS driver_number,
                        CAST({x_col} AS DOUBLE) AS x,
                        CAST({y_col} AS DOUBLE) AS y
                    FROM read_parquet(?)
                """

            sql = f"""
                WITH base AS (
                    {source}
                ),
                filtered AS (
                    SELECT * FROM base
                    WHERE {" AND ".join(where)}
                ),
                ranked AS (
                    SELECT
                        *,
                        row_number() OVER (PARTITION BY driver_number ORDER BY time_ms) AS rn
                    FROM filtered
                )
                SELECT
                    time_ms,
                    driver_number,
                    x,
                    y
                FROM ranked
                WHERE ((rn - 1) % ?) = 0
                ORDER BY driver_number, time_ms
                LIMIT ?
            """
            query_params = [path, *params, int(sample_rate), int(MAX_ROWS + 1)]
            rows = db_connection.conn.execute(sql, query_params).fetchall()
            if len(rows) > MAX_ROWS:
                raise HTTPException(status_code=413, detail=f"Result exceeds {MAX_ROWS} rows")
            payload = [
                {
                    "time_ms": float(r[0]),
                    "driver_number": int(r[1]),
                    "x": float(r[2]),
                    "y": float(r[3]),
                }
                for r in rows
            ]
            metrics_router.record_endpoint_sample(
                _STREAM_METRICS_ROUTE,
                (time.perf_counter() - started_at) * 1000.0,
                _estimate_payload_bytes(payload),
                len(payload),
            )
            return payload
        except HTTPException:
            raise
        except Exception:
            continue
    metrics_router.record_endpoint_sample(
        _STREAM_METRICS_ROUTE,
        (time.perf_counter() - started_at) * 1000.0,
        2,
        0,
    )
    return []


@router.get("/positions/{year}/{round}")
async def get_positions(
    year: int,
    round: str,
    session_type: str = "R",
    driver: Optional[str] = None,
    step: int = 10,
    max_points: int = 20000,
) -> List[Dict[str, Any]]:
    """Backward-compatible endpoint kept for older clients.

    Legacy endpoint intentionally does not enforce stream window/row caps.
    """
    race_name = round.replace("-", " ")
    candidates = _candidate_position_files(year, race_name, session_type)
    if not candidates:
        return []

    driver_number: Optional[int] = None
    if driver:
        if not str(driver).isdigit():
            return []
        driver_number = int(driver)

    sample_rate = max(1, int(step))
    max_points = max(1, int(max_points))

    for path in candidates:
        shaped = _shape(path)
        if not shaped:
            continue
        x_col, y_col, d_col, time_col = shaped
        try:
            where = [
                "x IS NOT NULL",
                "y IS NOT NULL",
                "driver_number IS NOT NULL",
                f"abs(x) <= {float(COORD_ABS_LIMIT)}",
                f"abs(y) <= {float(COORD_ABS_LIMIT)}",
            ]
            params: List[Any] = []
            if driver_number is not None:
                where.append("driver_number = ?")
                params.append(int(driver_number))

            if time_col == "date":
                source = f"""
                    SELECT
                        (epoch(date) - min(epoch(date)) OVER ()) * 1000.0 AS time_ms,
                        CAST({d_col} AS INTEGER) AS driver_number,
                        CAST({x_col} AS DOUBLE) AS x,
                        CAST({y_col} AS DOUBLE) AS y
                    FROM read_parquet(?)
                """
            else:
                if time_col == "session_time_seconds":
                    t_expr = "session_time_seconds * 1000.0"
                else:
                    t_expr = "(timestamp - min(timestamp) OVER ()) * 1000.0"
                source = f"""
                    SELECT
                        {t_expr} AS time_ms,
                        CAST({d_col} AS INTEGER) AS driver_number,
                        CAST({x_col} AS DOUBLE) AS x,
                        CAST({y_col} AS DOUBLE) AS y
                    FROM read_parquet(?)
                """

            sql = f"""
                WITH base AS (
                    {source}
                ),
                filtered AS (
                    SELECT * FROM base
                    WHERE {" AND ".join(where)}
                ),
                ranked AS (
                    SELECT
                        *,
                        row_number() OVER (PARTITION BY driver_number ORDER BY time_ms) AS rn
                    FROM filtered
                )
                SELECT
                    time_ms,
                    driver_number,
                    x,
                    y
                FROM ranked
                WHERE ((rn - 1) % ?) = 0
                ORDER BY driver_number, time_ms
                LIMIT ?
            """
            rows = db_connection.conn.execute(
                sql,
                [path, *params, int(sample_rate), int(max_points)],
            ).fetchall()
            return [
                {
                    "time": float(r[0]) / 1000.0,
                    "driver_number": int(r[1]),
                    "x": float(r[2]),
                    "y": float(r[3]),
                    "source": "legacy",
                }
                for r in rows
            ]
        except Exception:
            continue
    return []
