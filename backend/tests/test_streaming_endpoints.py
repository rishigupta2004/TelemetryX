from __future__ import annotations

import os
from pathlib import Path

import duckdb
from fastapi.testclient import TestClient

from main import app
from api.routers import metrics as metrics_router
from api.routers import positions as positions_router
from api.routers import sessions as sessions_router
from api.routers import telemetry as telemetry_router


client = TestClient(app)


def _write_parquet(path: Path, query: str) -> None:
    conn = duckdb.connect()
    try:
        conn.execute(f"COPY ({query}) TO '{path.as_posix()}' (FORMAT PARQUET)")
    finally:
        conn.close()


def test_positions_stream_enforces_window_limit(tmp_path):
    r = client.get(
        "/api/v1/positions/2025/Bahrain-Grand-Prix/stream",
        params={"time_start_ms": 0, "time_end_ms": 70000, "session_type": "R"},
    )
    assert r.status_code == 413
    assert "Window exceeds 60s limit" in r.json()["detail"]


def test_positions_stream_reads_windowed_data(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 0.0::DOUBLE, 10.0::DOUBLE, 20.0::DOUBLE),
                (1, 10.0::DOUBLE, 11.0::DOUBLE, 21.0::DOUBLE),
                (1, 20.0::DOUBLE, 12.0::DOUBLE, 22.0::DOUBLE),
                (44, 5.0::DOUBLE, 30.0::DOUBLE, 40.0::DOUBLE)
        ) AS t(driver_number, session_time_seconds, x, y)
        """,
    )
    monkeypatch.setattr(positions_router, "SILVER_DIR", str(tmp_path / "silver"))
    monkeypatch.setattr(positions_router, "BRONZE_DIR", str(tmp_path / "bronze"))
    monkeypatch.setattr(positions_router, "GOLD_DIR", str(tmp_path / "gold"))

    r = client.get(
        "/api/v1/positions/2025/Bahrain-Grand-Prix/stream",
        params={
            "time_start_ms": 0,
            "time_end_ms": 12000,
            "session_type": "R",
            "drivers": [1],
            "sample_rate": 1,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert all(int(x["driver_number"]) == 1 for x in data)
    assert max(float(x["time_ms"]) for x in data) <= 12000.0
    assert all(set(row.keys()) == {"time_ms", "driver_number", "x", "y"} for row in data)


def test_positions_stream_filters_out_of_bounds_coordinates(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 1.0::DOUBLE, 100.0::DOUBLE, 200.0::DOUBLE),
                (1, 2.0::DOUBLE, 1200000.0::DOUBLE, 200.0::DOUBLE),
                (1, 3.0::DOUBLE, 100.0::DOUBLE, -1500000.0::DOUBLE)
        ) AS t(driver_number, session_time_seconds, x, y)
        """,
    )
    monkeypatch.setattr(positions_router, "SILVER_DIR", str(tmp_path / "silver"))
    monkeypatch.setattr(positions_router, "BRONZE_DIR", str(tmp_path / "bronze"))
    monkeypatch.setattr(positions_router, "GOLD_DIR", str(tmp_path / "gold"))

    r = client.get(
        "/api/v1/positions/2025/Bahrain-Grand-Prix/stream",
        params={
            "time_start_ms": 0,
            "time_end_ms": 5000,
            "session_type": "R",
            "drivers": [1],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["x"] == 100.0
    assert data[0]["y"] == 200.0


def test_positions_stream_normalizes_epoch_timestamps(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 1700000000.0::DOUBLE, 10.0::DOUBLE, 20.0::DOUBLE),
                (1, 1700000005.0::DOUBLE, 12.0::DOUBLE, 22.0::DOUBLE),
                (44, 1700000004.0::DOUBLE, 30.0::DOUBLE, 40.0::DOUBLE)
        ) AS t(driver_number, timestamp, x, y)
        """,
    )
    monkeypatch.setattr(positions_router, "SILVER_DIR", str(tmp_path / "silver"))
    monkeypatch.setattr(positions_router, "BRONZE_DIR", str(tmp_path / "bronze"))
    monkeypatch.setattr(positions_router, "GOLD_DIR", str(tmp_path / "gold"))

    r = client.get(
        "/api/v1/positions/2025/Bahrain-Grand-Prix/stream",
        params={"time_start_ms": 0, "time_end_ms": 5500, "session_type": "R", "drivers": [1]},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["time_ms"] == 0.0
    assert data[1]["time_ms"] == 5000.0


def test_legacy_positions_endpoint_is_not_capped_to_60s(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 0.0::DOUBLE, 10.0::DOUBLE, 20.0::DOUBLE),
                (1, 65.0::DOUBLE, 11.0::DOUBLE, 21.0::DOUBLE),
                (1, 130.0::DOUBLE, 12.0::DOUBLE, 22.0::DOUBLE)
        ) AS t(driver_number, session_time_seconds, x, y)
        """,
    )
    monkeypatch.setattr(positions_router, "SILVER_DIR", str(tmp_path / "silver"))
    monkeypatch.setattr(positions_router, "BRONZE_DIR", str(tmp_path / "bronze"))
    monkeypatch.setattr(positions_router, "GOLD_DIR", str(tmp_path / "gold"))

    r = client.get(
        "/api/v1/positions/2025/Bahrain-Grand-Prix",
        params={"session_type": "R", "driver": "1", "step": 1, "max_points": 1000},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 3
    assert max(float(row["time"]) for row in body) == 130.0


def test_telemetry_stream_limits_and_channels(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 0.0::DOUBLE, 250.0::DOUBLE, 70.0::DOUBLE, FALSE, 11000.0::DOUBLE, 7, 1),
                (1, 1.0::DOUBLE, 260.0::DOUBLE, 75.0::DOUBLE, TRUE, 11100.0::DOUBLE, 8, 0),
                (44, 1.0::DOUBLE, 255.0::DOUBLE, 68.0::DOUBLE, FALSE, 10900.0::DOUBLE, 7, 1)
        ) AS t(driver_number, session_time_seconds, speed, throttle, brake, rpm, gear, drs)
        """,
    )
    monkeypatch.setattr(telemetry_router, "SILVER_DIR", str(tmp_path / "silver"))

    too_wide = client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix/stream",
        params={
            "time_start_ms": 0,
            "time_end_ms": 31000,
            "driver_number": 1,
            "session_type": "R",
        },
    )
    assert too_wide.status_code == 413

    invalid_range = client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix/stream",
        params={
            "time_start_ms": 5000,
            "time_end_ms": 1000,
            "driver_number": 1,
            "session_type": "R",
        },
    )
    assert invalid_range.status_code == 400

    invalid = client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix/stream",
        params={
            "time_start_ms": 0,
            "time_end_ms": 5000,
            "driver_number": 1,
            "session_type": "R",
            "channels": ["speed", "bad_channel"],
        },
    )
    assert invalid.status_code == 400

    ok = client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix/stream",
        params={
            "time_start_ms": 0,
            "time_end_ms": 5000,
            "driver_number": 1,
            "session_type": "R",
            "channels": ["speed", "throttle"],
        },
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["samples"] == 2
    assert body["channels"] == ["speed", "throttle"]
    assert set(body["data"][0].keys()) == {"time_ms", "speed", "throttle"}


def test_legacy_telemetry_endpoint_is_not_capped_to_5000_rows(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT
            1::INTEGER AS driver_number,
            (i * 0.1)::DOUBLE AS session_time_seconds,
            (200.0 + i * 0.01)::DOUBLE AS speed,
            0.5::DOUBLE AS throttle,
            FALSE AS brake,
            11000.0::DOUBLE AS rpm,
            7::INTEGER AS gear,
            1::INTEGER AS drs
        FROM range(0, 6001) AS r(i)
        """,
    )
    monkeypatch.setattr(telemetry_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix",
        params={"driver": "1", "session_type": "R"},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 6001
    assert body[-1]["session_time_seconds"] == 600.0


def test_telemetry_stream_lap_selection_and_channel_normalization(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 90.0::DOUBLE, 240.0::DOUBLE, 0.55::DOUBLE, 0.00::DOUBLE, 10800.0::DOUBLE, 6, TRUE),
                (1, 94.0::DOUBLE, 248.0::DOUBLE, 0.70::DOUBLE, 1.00::DOUBLE, 11200.0::DOUBLE, 7, FALSE),
                (1, 98.0::DOUBLE, 252.0::DOUBLE, 0.75::DOUBLE, 0.10::DOUBLE, 11300.0::DOUBLE, 8, TRUE)
        ) AS t(driver_number, session_time_seconds, speed, throttle, brake, rpm, gear, drs)
        """,
    )
    _write_parquet(
        silver / "laps.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 10, 98.0::DOUBLE, 8.0::DOUBLE)
        ) AS t(driver_number, lap_number, session_time_seconds, lap_time_seconds)
        """,
    )
    monkeypatch.setattr(telemetry_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix/stream",
        params={
            "driver_number": 1,
            "lap_number": 10,
            "session_type": "R",
            "channels": ["speed", "throttle", "brake", "drs", "gear"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["samples"] == 3
    assert body["time_window"] == [90000, 98000]
    first = body["data"][0]
    assert first["throttle"] == 55.0
    assert first["brake"] == 0.0
    assert first["drs"] == 1
    assert first["gear"] == 6


def test_session_telemetry_enforces_driver_limit(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 0.0::DOUBLE, 250.0::DOUBLE, 70.0::DOUBLE, FALSE, 11000.0::DOUBLE, 7, 1)
        ) AS t(driver_number, session_time_seconds, speed, throttle, brake, rpm, gear, drs)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/telemetry",
        params={"drivers": "1,2,3,4,5,6,7,8,9"},
    )
    assert r.status_code == 413
    assert "Max 8 drivers per request" in r.json()["detail"]


def test_session_telemetry_returns_413_on_row_oversize(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT
            1::INTEGER AS driver_number,
            (i * 0.003)::DOUBLE AS session_time_seconds,
            250.0::DOUBLE AS speed,
            70.0::DOUBLE AS throttle,
            FALSE AS brake,
            11000.0::DOUBLE AS rpm,
            7::INTEGER AS gear,
            1::INTEGER AS drs
        FROM range(0, 35001) AS r(i)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/telemetry",
        params={"drivers": "1", "hz": 0, "t0": 0, "t1": 120},
    )
    assert r.status_code == 413
    assert "Result exceeds 30000 rows" in r.json()["detail"]


def test_session_positions_returns_413_on_row_oversize(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT
            1::INTEGER AS driver_number,
            (i * 0.003)::DOUBLE AS session_time_seconds,
            (10.0 + i * 0.01)::DOUBLE AS x,
            (20.0 + i * 0.01)::DOUBLE AS y
        FROM range(0, 35001) AS r(i)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/positions",
        params={"drivers": "1", "hz": 0, "t0": 0, "t1": 180},
    )
    assert r.status_code == 413
    assert "Result exceeds 30000 rows" in r.json()["detail"]


def test_session_telemetry_default_window_is_bounded(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 1.0::DOUBLE, 250.0::DOUBLE, 70.0::DOUBLE, FALSE, 11000.0::DOUBLE, 7, 1),
                (1, 119.0::DOUBLE, 260.0::DOUBLE, 75.0::DOUBLE, FALSE, 11100.0::DOUBLE, 8, 0),
                (1, 200.0::DOUBLE, 280.0::DOUBLE, 80.0::DOUBLE, TRUE, 11300.0::DOUBLE, 8, 0)
        ) AS t(driver_number, session_time_seconds, speed, throttle, brake, rpm, gear, drs)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/telemetry",
        params={"drivers": "1", "hz": 0},
    )
    assert r.status_code == 200
    body = r.json()
    rows = body.get("1") or []
    assert len(rows) == 2
    assert max(float(x["timestamp"]) for x in rows) <= 120.0


def test_session_telemetry_with_metadata_wrapper(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "telemetry.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 1.0::DOUBLE, 250.0::DOUBLE, 70.0::DOUBLE, FALSE, 11000.0::DOUBLE, 7, 1),
                (1, 2.0::DOUBLE, 260.0::DOUBLE, 75.0::DOUBLE, FALSE, 11100.0::DOUBLE, 8, 0)
        ) AS t(driver_number, session_time_seconds, speed, throttle, brake, rpm, gear, drs)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))
    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/telemetry",
        params={"drivers": "1", "hz": 0, "with_metadata": 1},
    )
    assert r.status_code == 200
    body = r.json()
    assert "telemetry" in body
    assert "metadata" in body
    meta = body["metadata"]
    assert meta["rowLimit"] == 30000
    assert meta["rowCount"] == 2
    assert isinstance(meta.get("sourceVersion"), str)


def test_session_positions_default_window_is_bounded(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 10.0::DOUBLE, 10.0::DOUBLE, 20.0::DOUBLE),
                (1, 170.0::DOUBLE, 11.0::DOUBLE, 21.0::DOUBLE),
                (1, 220.0::DOUBLE, 12.0::DOUBLE, 22.0::DOUBLE)
        ) AS t(driver_number, session_time_seconds, x, y)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))

    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/positions",
        params={"drivers": "1", "hz": 0},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    assert max(float(x["timestamp"]) for x in body) <= 180.0


def test_session_positions_with_metadata_wrapper(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Bahrain Grand Prix" / "R"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "positions.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 10.0::DOUBLE, 10.0::DOUBLE, 20.0::DOUBLE),
                (1, 20.0::DOUBLE, 11.0::DOUBLE, 21.0::DOUBLE)
        ) AS t(driver_number, session_time_seconds, x, y)
        """,
    )
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))
    r = client.get(
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/positions",
        params={"drivers": "1", "hz": 0, "with_metadata": 1},
    )
    assert r.status_code == 200
    body = r.json()
    assert "positions" in body
    assert "metadata" in body
    assert len(body["positions"]) == 2
    assert body["metadata"]["rowCount"] == 2
    assert body["metadata"]["rowLimit"] == 30000


def test_performance_summary_reports_key_route_payload_stats():
    metrics_router._counters.clear()
    metrics_router._counters["http_requests_total"] = 0
    metrics_router._timings_ms.clear()
    metrics_router._timings_ms["http_request_duration_ms_sum"] = 0.0
    metrics_router._latency_samples.clear()
    metrics_router._payload_samples.clear()
    metrics_router._endpoint_latency_samples.clear()
    metrics_router._endpoint_payload_samples.clear()
    metrics_router._endpoint_row_samples.clear()
    metrics_router._endpoint_sample_counts.clear()

    client.get(
        "/api/v1/telemetry/2025/Bahrain-Grand-Prix/stream",
        params={"time_start_ms": 0, "time_end_ms": 1000, "driver_number": 1, "session_type": "R"},
    )
    r = client.get("/api/v1/metrics/performance/summary")
    assert r.status_code == 200
    body = r.json()
    assert "routes" in body
    assert "key_routes" in body
    key = "/api/v1/telemetry/{year}/{round}/stream"
    assert key in body["key_routes"]
    assert "p50" in body["key_routes"][key]["latency_ms"]
    assert "p95" in body["key_routes"][key]["latency_ms"]
    assert "p50" in body["key_routes"][key]["payload_bytes"]
    assert "p95" in body["key_routes"][key]["payload_bytes"]
    assert "p50" in body["key_routes"][key]["row_count"]
    assert "p95" in body["key_routes"][key]["row_count"]
