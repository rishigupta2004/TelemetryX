from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import clickhouse_connect
import duckdb


DATA_ROOT = Path(os.getenv("TELEMETRYX_DATA_ROOT", "backend/etl/data"))
SILVER_DIR = DATA_ROOT / "silver"


def _client():
    return clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
        database=os.getenv("CLICKHOUSE_DATABASE", "telemetryx"),
    )


def _iter_sessions() -> Iterable[Tuple[int, str, str, Path]]:
    for year_dir in sorted(
        [d for d in SILVER_DIR.iterdir() if d.is_dir() and d.name.isdigit()]
    ):
        year = int(year_dir.name)
        for race_dir in sorted([d for d in year_dir.iterdir() if d.is_dir()]):
            for session_dir in sorted([d for d in race_dir.iterdir() if d.is_dir()]):
                yield year, race_dir.name, session_dir.name, session_dir


def _audit(client: Any, rec: Dict[str, Any]) -> None:
    client.insert(
        "ingestion_audit",
        [
            [
                rec.get("dataset", ""),
                int(rec.get("year", 0)),
                rec.get("race_name", ""),
                rec.get("session", ""),
                rec.get("source_path", ""),
                int(rec.get("source_rows", 0)),
                int(rec.get("inserted_rows", 0)),
                rec.get("status", "ok"),
                rec.get("error", ""),
            ]
        ],
        column_names=[
            "dataset",
            "year",
            "race_name",
            "session",
            "source_path",
            "source_rows",
            "inserted_rows",
            "status",
            "error",
        ],
    )


def _quality_audit(
    client: Any,
    *,
    dataset: str,
    year: int,
    race_name: str,
    session: str,
    expected_rows: int,
    observed_rows: int,
    detail: str = "",
) -> None:
    status = "ok" if int(expected_rows) == int(observed_rows) else "mismatch"
    client.insert(
        "data_quality_audit",
        [
            [
                dataset,
                int(year),
                race_name,
                session,
                int(expected_rows),
                int(observed_rows),
                status,
                detail,
            ]
        ],
        column_names=[
            "dataset",
            "year",
            "race_name",
            "session",
            "expected_rows",
            "observed_rows",
            "status",
            "detail",
        ],
    )


def _already_ingested(client: Any, dataset: str, path: Path) -> bool:
    stat = path.stat()
    query = (
        "SELECT source_mtime, source_size FROM latest_ingest_watermarks "
        f"WHERE dataset = '{dataset}' AND source_path = '{str(path).replace("'", "\\'")}' LIMIT 1"
    )
    res = client.query(query)
    if not res.result_rows:
        return False
    mtime, size = res.result_rows[0]
    return int(mtime) == int(stat.st_mtime) and int(size) == int(stat.st_size)


def _upsert_watermark(client: Any, dataset: str, path: Path) -> None:
    stat = path.stat()
    client.insert(
        "ingest_watermarks",
        [[dataset, str(path), int(stat.st_mtime), int(stat.st_size)]],
        column_names=["dataset", "source_path", "source_mtime", "source_size"],
    )


def _load_telemetry(
    client: Any, year: int, race: str, session: str, path: Path
) -> None:
    if _already_ingested(client, "telemetry_stream", path):
        return
    conn = duckdb.connect()
    try:
        rows = conn.execute(
            """
            WITH src AS (
                SELECT
                    CAST(session_time_seconds * 1000.0 AS DOUBLE) AS time_ms,
                    CAST(driver_number AS INTEGER) AS driver_number,
                    TRY_CAST(speed AS DOUBLE) AS speed,
                    TRY_CAST(throttle AS DOUBLE) AS throttle,
                    TRY_CAST(brake AS DOUBLE) AS brake,
                    TRY_CAST(rpm AS DOUBLE) AS rpm,
                    TRY_CAST(gear AS DOUBLE) AS gear,
                    TRY_CAST(drs AS DOUBLE) AS drs,
                    row_number() OVER () AS source_row
                FROM read_parquet(?)
                WHERE session_time_seconds IS NOT NULL
                  AND driver_number IS NOT NULL
            )
            SELECT time_ms, driver_number, speed, throttle, brake, rpm, gear, drs, source_row
            FROM src
            ORDER BY source_row
            """,
            [str(path)],
        ).fetchall()

        payload: List[List[Any]] = []
        for r in rows:
            payload.append(
                [
                    int(year),
                    race,
                    session,
                    float(r[0]),
                    int(r[1]),
                    float(r[2]) if r[2] is not None else None,
                    float(r[3]) if r[3] is not None else None,
                    float(r[4]) if r[4] is not None else None,
                    float(r[5]) if r[5] is not None else None,
                    int(round(float(r[6]))) if r[6] is not None else None,
                    int(round(float(r[7]))) if r[7] is not None else None,
                    "silver",
                    str(path),
                    int(r[8]),
                ]
            )
        if payload:
            client.insert(
                "telemetry_stream",
                payload,
                column_names=[
                    "year",
                    "race_name",
                    "session",
                    "time_ms",
                    "driver_number",
                    "speed",
                    "throttle",
                    "brake",
                    "rpm",
                    "gear",
                    "drs",
                    "source",
                    "source_path",
                    "source_row",
                ],
            )
        _upsert_watermark(client, "telemetry_stream", path)
        _audit(
            client,
            {
                "dataset": "telemetry_stream",
                "year": year,
                "race_name": race,
                "session": session,
                "source_path": str(path),
                "source_rows": len(rows),
                "inserted_rows": len(payload),
                "status": "ok",
                "error": "",
            },
        )
        _quality_audit(
            client,
            dataset="telemetry_stream",
            year=year,
            race_name=race,
            session=session,
            expected_rows=len(rows),
            observed_rows=len(payload),
            detail=str(path),
        )
    except Exception as exc:
        _audit(
            client,
            {
                "dataset": "telemetry_stream",
                "year": year,
                "race_name": race,
                "session": session,
                "source_path": str(path),
                "source_rows": 0,
                "inserted_rows": 0,
                "status": "error",
                "error": str(exc),
            },
        )
    finally:
        conn.close()


def _load_positions(
    client: Any, year: int, race: str, session: str, path: Path
) -> None:
    if _already_ingested(client, "positions_stream", path):
        return
    conn = duckdb.connect()
    try:
        schema = {
            r[0]
            for r in conn.execute(
                "DESCRIBE SELECT * FROM read_parquet(?)", [str(path)]
            ).fetchall()
        }
        x_col = (
            "position_x" if "position_x" in schema else ("x" if "x" in schema else None)
        )
        y_col = (
            "position_y" if "position_y" in schema else ("y" if "y" in schema else None)
        )
        d_col = (
            "driver_number"
            if "driver_number" in schema
            else ("driver" if "driver" in schema else None)
        )
        if not x_col or not y_col or not d_col:
            return
        if "session_time_seconds" in schema:
            t_expr = "session_time_seconds * 1000.0"
        elif "timestamp" in schema:
            t_expr = "(timestamp - min(timestamp) OVER ()) * 1000.0"
        elif "date" in schema:
            t_expr = "(epoch(date) - min(epoch(date)) OVER ()) * 1000.0"
        else:
            return

        rows = conn.execute(
            f"""
            SELECT
              CAST({t_expr} AS DOUBLE) AS time_ms,
              CAST({d_col} AS INTEGER) AS driver_number,
              CAST({x_col} AS DOUBLE) AS x,
              CAST({y_col} AS DOUBLE) AS y,
              row_number() OVER () AS source_row
            FROM read_parquet(?)
            WHERE {x_col} IS NOT NULL
              AND {y_col} IS NOT NULL
              AND {d_col} IS NOT NULL
            ORDER BY source_row
            """,
            [str(path)],
        ).fetchall()

        payload: List[List[Any]] = []
        for r in rows:
            payload.append(
                [
                    int(year),
                    race,
                    session,
                    float(r[0]),
                    int(r[1]),
                    float(r[2]),
                    float(r[3]),
                    "silver",
                    str(path),
                    int(r[4]),
                ]
            )
        if payload:
            client.insert(
                "positions_stream",
                payload,
                column_names=[
                    "year",
                    "race_name",
                    "session",
                    "time_ms",
                    "driver_number",
                    "x",
                    "y",
                    "source",
                    "source_path",
                    "source_row",
                ],
            )
        _upsert_watermark(client, "positions_stream", path)
        _audit(
            client,
            {
                "dataset": "positions_stream",
                "year": year,
                "race_name": race,
                "session": session,
                "source_path": str(path),
                "source_rows": len(rows),
                "inserted_rows": len(payload),
                "status": "ok",
                "error": "",
            },
        )
        _quality_audit(
            client,
            dataset="positions_stream",
            year=year,
            race_name=race,
            session=session,
            expected_rows=len(rows),
            observed_rows=len(payload),
            detail=str(path),
        )
    except Exception as exc:
        _audit(
            client,
            {
                "dataset": "positions_stream",
                "year": year,
                "race_name": race,
                "session": session,
                "source_path": str(path),
                "source_rows": 0,
                "inserted_rows": 0,
                "status": "error",
                "error": str(exc),
            },
        )
    finally:
        conn.close()


def main() -> None:
    client = _client()
    for year, race, session, session_dir in _iter_sessions():
        tel = session_dir / "telemetry.parquet"
        if tel.exists():
            _load_telemetry(client, year, race, session, tel)
        for pos_name in ("positions.parquet", "openf1_positions.parquet"):
            pos = session_dir / pos_name
            if pos.exists():
                _load_positions(client, year, race, session, pos)
    print("Silver ingestion to ClickHouse completed")


if __name__ == "__main__":
    main()
