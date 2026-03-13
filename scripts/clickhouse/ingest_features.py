from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import clickhouse_connect
import duckdb


DATA_ROOT = Path(os.getenv("TELEMETRYX_DATA_ROOT", "backend/etl/data"))
FEATURES_DIR = DATA_ROOT / "features"


def _client():
    return clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
        database=os.getenv("CLICKHOUSE_DATABASE", "telemetryx"),
    )


def _iter_feature_files() -> Iterable[Tuple[int, str, str, str, Path]]:
    for year_dir in sorted(
        [d for d in FEATURES_DIR.iterdir() if d.is_dir() and d.name.isdigit()]
    ):
        year = int(year_dir.name)
        for race_dir in sorted([d for d in year_dir.iterdir() if d.is_dir()]):
            for session_dir in sorted([d for d in race_dir.iterdir() if d.is_dir()]):
                for f in sorted(session_dir.glob("*_features.parquet")):
                    feature_type = f.name.replace("_features.parquet", "")
                    yield year, race_dir.name, session_dir.name, feature_type, f


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


def _load_feature_file(
    client: Any,
    *,
    year: int,
    race_name: str,
    session: str,
    feature_type: str,
    path: Path,
) -> None:
    dataset = f"feature_rows:{feature_type}"
    if _already_ingested(client, dataset, path):
        return

    conn = duckdb.connect()
    try:
        rows = conn.execute("SELECT * FROM read_parquet(?)", [str(path)]).fetchall()
        columns = [d[0] for d in conn.description] if conn.description else []
        payload: List[List[Any]] = []
        for idx, row in enumerate(rows, start=1):
            obj = {col: row[i] for i, col in enumerate(columns)}
            payload.append(
                [
                    int(year),
                    race_name,
                    session,
                    feature_type,
                    json.dumps(obj, default=str, separators=(",", ":")),
                    str(path),
                    int(idx),
                ]
            )
        if payload:
            client.insert(
                "feature_rows",
                payload,
                column_names=[
                    "year",
                    "race_name",
                    "session",
                    "feature_type",
                    "payload_json",
                    "source_path",
                    "source_row",
                ],
            )
        _upsert_watermark(client, dataset, path)
        _audit(
            client,
            {
                "dataset": dataset,
                "year": year,
                "race_name": race_name,
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
            dataset=dataset,
            year=year,
            race_name=race_name,
            session=session,
            expected_rows=len(rows),
            observed_rows=len(payload),
            detail=str(path),
        )
    except Exception as exc:
        _audit(
            client,
            {
                "dataset": dataset,
                "year": year,
                "race_name": race_name,
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
    for year, race, session, feature_type, path in _iter_feature_files():
        _load_feature_file(
            client,
            year=year,
            race_name=race,
            session=session,
            feature_type=feature_type,
            path=path,
        )
    print("Feature ingestion to ClickHouse completed")


if __name__ == "__main__":
    main()
