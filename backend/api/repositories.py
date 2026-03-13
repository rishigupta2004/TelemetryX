from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .clickhouse import get_clickhouse_client


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def fetch_telemetry_stream_clickhouse(
    *,
    year: int,
    race_name: str,
    session_type: str,
    driver_number: int,
    time_start_ms: int,
    time_end_ms: int,
    channels: List[str],
    max_samples: int,
) -> Optional[Dict[str, Any]]:
    client: Any = get_clickhouse_client()
    if client is None:
        return None

    safe_cols = [
        c for c in channels if c in {"speed", "throttle", "brake", "rpm", "gear", "drs"}
    ]
    if not safe_cols:
        safe_cols = ["speed", "throttle", "brake"]
    select_cols = ", ".join(["time_ms", *safe_cols])
    query = (
        f"SELECT {select_cols} "
        "FROM telemetry_stream "
        f"WHERE year = {int(year)} "
        f"AND race_name = '{_escape(race_name)}' "
        f"AND session = '{_escape(session_type)}' "
        f"AND driver_number = {int(driver_number)} "
        f"AND time_ms BETWEEN {int(time_start_ms)} AND {int(time_end_ms)} "
        "ORDER BY time_ms "
        f"LIMIT {int(max_samples) + 1}"
    )
    result = client.query(query)
    rows = result.result_rows
    if len(rows) > int(max_samples):
        return None
    data: List[Dict[str, Any]] = []
    for row in rows:
        rec: Dict[str, Any] = {"time_ms": float(row[0])}
        for idx, col in enumerate(safe_cols, start=1):
            value = row[idx]
            if col in {"gear", "drs"} and value is not None:
                rec[col] = int(value)
            elif value is None:
                rec[col] = None
            else:
                rec[col] = round(float(value), 2)
        data.append(rec)
    return {
        "driver_number": int(driver_number),
        "time_window": [int(time_start_ms), int(time_end_ms)],
        "channels": safe_cols,
        "samples": len(data),
        "data": data,
    }


def fetch_positions_stream_clickhouse(
    *,
    year: int,
    race_name: str,
    session_type: str,
    time_start_ms: int,
    time_end_ms: int,
    drivers: Optional[List[int]],
    sample_rate: int,
    max_rows: int,
) -> Optional[List[Dict[str, Any]]]:
    client: Any = get_clickhouse_client()
    if client is None:
        return None

    where = [
        f"year = {int(year)}",
        f"race_name = '{_escape(race_name)}'",
        f"session = '{_escape(session_type)}'",
        f"time_ms BETWEEN {int(time_start_ms)} AND {int(time_end_ms)}",
    ]
    if drivers:
        where.append(
            "driver_number IN (" + ",".join(str(int(x)) for x in drivers) + ")"
        )

    query = (
        "SELECT time_ms, driver_number, x, y FROM ("
        "SELECT time_ms, driver_number, x, y, row_number() OVER (PARTITION BY driver_number ORDER BY time_ms) AS rn "
        "FROM positions_stream "
        f"WHERE {' AND '.join(where)}"
        ") "
        f"WHERE ((rn - 1) % {max(1, int(sample_rate))}) = 0 "
        "ORDER BY driver_number, time_ms "
        f"LIMIT {int(max_rows) + 1}"
    )
    result = client.query(query)
    rows = result.result_rows
    if len(rows) > int(max_rows):
        return None
    return [
        {
            "time_ms": float(r[0]),
            "driver_number": int(r[1]),
            "x": float(r[2]),
            "y": float(r[3]),
        }
        for r in rows
    ]


def fetch_feature_rows_clickhouse(
    *,
    year: int,
    race_name: str,
    session_type: str,
    feature_type: str,
    limit: int,
) -> Optional[List[Dict[str, Any]]]:
    client: Any = get_clickhouse_client()
    if client is None:
        return None

    query = (
        "SELECT payload_json "
        "FROM feature_rows "
        f"WHERE year = {int(year)} "
        f"AND race_name = '{_escape(race_name)}' "
        f"AND session = '{_escape(session_type)}' "
        f"AND feature_type = '{_escape(feature_type)}' "
        "ORDER BY source_row "
        f"LIMIT {int(max(1, limit))}"
    )
    result = client.query(query)
    out: List[Dict[str, Any]] = []
    for row in result.result_rows:
        raw = row[0]
        if not isinstance(raw, str):
            continue
        try:
            rec = json.loads(raw)
            if isinstance(rec, dict):
                out.append(rec)
        except Exception:
            continue
    return out
