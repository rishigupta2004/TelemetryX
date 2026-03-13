from __future__ import annotations

import os

import clickhouse_connect


def _client():
    return clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
        database=os.getenv("CLICKHOUSE_DATABASE", "telemetryx"),
    )


DDL = [
    """
    CREATE TABLE IF NOT EXISTS telemetry_stream (
      year UInt16,
      race_name String,
      session String,
      time_ms Float64,
      driver_number UInt16,
      speed Float32,
      throttle Float32,
      brake Float32,
      rpm Float32,
      gear Int8,
      drs Int8,
      source String,
      source_path String,
      source_row UInt64,
      ingested_at DateTime DEFAULT now()
    )
    ENGINE = ReplacingMergeTree(ingested_at)
    PARTITION BY (year, session)
    ORDER BY (year, race_name, session, driver_number, time_ms, source_path, source_row)
    """,
    """
    CREATE TABLE IF NOT EXISTS positions_stream (
      year UInt16,
      race_name String,
      session String,
      time_ms Float64,
      driver_number UInt16,
      x Float64,
      y Float64,
      source String,
      source_path String,
      source_row UInt64,
      ingested_at DateTime DEFAULT now()
    )
    ENGINE = ReplacingMergeTree(ingested_at)
    PARTITION BY (year, session)
    ORDER BY (year, race_name, session, driver_number, time_ms, source_path, source_row)
    """,
    """
    CREATE TABLE IF NOT EXISTS feature_rows (
      year UInt16,
      race_name String,
      session String,
      feature_type String,
      payload_json String,
      source_path String,
      source_row UInt64,
      ingested_at DateTime DEFAULT now()
    )
    ENGINE = ReplacingMergeTree(ingested_at)
    PARTITION BY (year, session, feature_type)
    ORDER BY (year, race_name, session, feature_type, source_path, source_row)
    """,
    """
    CREATE TABLE IF NOT EXISTS ingest_watermarks (
      dataset String,
      source_path String,
      source_mtime UInt64,
      source_size UInt64,
      updated_at DateTime DEFAULT now()
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (dataset, source_path)
    """,
    """
    CREATE TABLE IF NOT EXISTS ingestion_audit (
      dataset String,
      year UInt16,
      race_name String,
      session String,
      source_path String,
      source_rows UInt64,
      inserted_rows UInt64,
      status String,
      error String,
      created_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    PARTITION BY year
    ORDER BY (dataset, year, race_name, session, source_path, created_at)
    """,
    """
    CREATE TABLE IF NOT EXISTS data_quality_audit (
      dataset String,
      year UInt16,
      race_name String,
      session String,
      expected_rows UInt64,
      observed_rows UInt64,
      status String,
      detail String,
      created_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    PARTITION BY year
    ORDER BY (dataset, year, race_name, session, created_at)
    """,
    """
    CREATE VIEW IF NOT EXISTS latest_ingest_watermarks AS
    SELECT
      dataset,
      source_path,
      anyLast(source_mtime) AS source_mtime,
      anyLast(source_size) AS source_size,
      max(updated_at) AS updated_at
    FROM ingest_watermarks
    GROUP BY dataset, source_path
    """,
    """
    CREATE VIEW IF NOT EXISTS latest_ingestion_audit AS
    SELECT
      dataset,
      year,
      race_name,
      session,
      source_path,
      anyLast(source_rows) AS source_rows,
      anyLast(inserted_rows) AS inserted_rows,
      anyLast(status) AS status,
      anyLast(error) AS error,
      max(created_at) AS created_at
    FROM ingestion_audit
    GROUP BY dataset, year, race_name, session, source_path
    """,
    """
    CREATE VIEW IF NOT EXISTS latest_data_quality_audit AS
    SELECT
      dataset,
      year,
      race_name,
      session,
      anyLast(expected_rows) AS expected_rows,
      anyLast(observed_rows) AS observed_rows,
      anyLast(status) AS status,
      anyLast(detail) AS detail,
      max(created_at) AS created_at
    FROM data_quality_audit
    GROUP BY dataset, year, race_name, session
    """,
]


def main() -> None:
    client = _client()
    for sql in DDL:
        client.command(sql)
    print("ClickHouse schema initialized")


if __name__ == "__main__":
    main()
