from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from main import app
from api.routers import features as features_router
from api.routers import models as models_router
from api.routers import positions as positions_router
from api.routers import sessions as sessions_router
from api.routers import telemetry as telemetry_router


client = TestClient(app)


def test_session_viz_contract_for_timing_track_tabs(monkeypatch):
    monkeypatch.setattr(
        sessions_router, "resolve_dir", lambda _year_path, race_name: str(race_name)
    )
    monkeypatch.setattr(
        sessions_router, "get_session_path", lambda *_args, **_kwargs: "/tmp/ignored"
    )
    monkeypatch.setattr(sessions_router, "cache_get", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(sessions_router, "cache_set", lambda _key, payload: payload)
    monkeypatch.setattr(
        sessions_router,
        "load_metadata",
        lambda *_args, **_kwargs: {
            "duration": 5400,
            "session_name": "Race",
            "location": "Unit Test Circuit",
        },
    )
    monkeypatch.setattr(
        sessions_router,
        "load_drivers",
        lambda *_args, **_kwargs: [
            {
                "driverName": "Max Verstappen",
                "driverNumber": 1,
                "teamName": "Red Bull Racing",
                "teamColor": "#005AFF",
                "code": "VER",
            }
        ],
    )
    monkeypatch.setattr(
        sessions_router,
        "load_laps",
        lambda *_args, **_kwargs: [
            {
                "driverName": "VER",
                "driverNumber": 1,
                "lapNumber": 1,
                "lapTime": 89.812,
                "lapTimeFormatted": "1:29.812",
                "lapStartSeconds": 0.0,
                "lapEndSeconds": 89.812,
                "lapStartTime": 0.0,
                "position": 1,
                "tyreCompound": "SOFT",
                "isValid": True,
                "isDeleted": False,
                "sector1": 29.9,
                "sector2": 30.1,
                "sector3": 29.8,
            }
        ],
    )
    monkeypatch.setattr(
        sessions_router,
        "load_positions",
        lambda *_args, **_kwargs: [
            {
                "timestamp": 5.0,
                "driverNumber": 1,
                "x": 100.0,
                "y": 200.0,
                "sourceTimestamp": 5.0,
                "quality": "ok",
            }
        ],
    )
    monkeypatch.setattr(
        sessions_router,
        "load_weather",
        lambda *_args, **_kwargs: [
            {
                "timestamp": 10.0,
                "airTemp": 25.5,
                "trackTemp": 35.8,
                "humidity": 43.0,
                "pressure": 1012.0,
                "windDirection": 190,
                "windSpeed": 4.2,
                "rainfall": 0,
            }
        ],
    )
    monkeypatch.setattr(
        sessions_router,
        "load_race_control",
        lambda *_args, **_kwargs: [
            {
                "timestamp": 12.0,
                "time": "00:12.000",
                "category": "FLAG",
                "message": "Track clear",
                "flag": "GREEN",
                "scope": "Track",
                "sector": None,
                "racingNumber": None,
                "lap": 1,
            }
        ],
    )
    monkeypatch.setattr(
        sessions_router,
        "load_track_geometry",
        lambda *_args, **_kwargs: {
            "name": "Unit Test Circuit",
            "centerline": [[0.0, 0.0], [100.0, 0.0], [100.0, 100.0], [0.0, 100.0]],
            "startPositionIndex": 0,
            "corners": [{"index": 1, "number": 1, "name": "T1"}],
            "sectors": [{"endIndex": 1}, {"endIndex": 2}, {"endIndex": 3}],
        },
    )
    monkeypatch.setattr(
        sessions_router, "telemetry_available", lambda *_args, **_kwargs: True
    )
    monkeypatch.setattr(
        sessions_router,
        "telemetry_unavailable_reason",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        sessions_router, "_positions_bounds", lambda *_args, **_kwargs: (0.0, 89.0)
    )
    monkeypatch.setattr(
        sessions_router,
        "_session_telemetry_bounds",
        lambda *_args, **_kwargs: (0.0, 89.0),
    )

    resp = client.get("/api/v1/sessions/2024/Test-GP/R/viz")
    assert resp.status_code == 200
    payload = resp.json()

    assert set(payload.keys()) == {
        "metadata",
        "drivers",
        "laps",
        "positions",
        "weather",
        "raceControl",
        "trackGeometry",
    }
    assert payload["metadata"]["year"] == 2024
    assert isinstance(payload["drivers"], list)
    assert isinstance(payload["laps"], list)
    assert isinstance(payload["positions"], list)
    assert isinstance(payload["weather"], list)
    assert isinstance(payload["raceControl"], list)
    assert isinstance(payload["trackGeometry"], dict)


def test_stream_contracts_for_telemetry_and_positions_tabs(monkeypatch, tmp_path: Path):
    import duckdb

    silver = tmp_path / "silver" / "2024" / "Test GP" / "R"
    silver.mkdir(parents=True)

    conn = duckdb.connect()
    try:
        conn.execute(
            f"""
            COPY (
                SELECT * FROM (
                    VALUES
                        (1, 0.1::DOUBLE, 281.1::DOUBLE, 0.99::DOUBLE, 0.0::DOUBLE),
                        (1, 0.2::DOUBLE, 279.4::DOUBLE, 0.97::DOUBLE, 0.0::DOUBLE)
                ) AS t(driver_number, session_time_seconds, speed, throttle, brake)
            ) TO '{(silver / "telemetry.parquet").as_posix()}' (FORMAT PARQUET)
            """
        )
        conn.execute(
            f"""
            COPY (
                SELECT * FROM (
                    VALUES
                        (1, 0.0::DOUBLE, 100.0::DOUBLE, 200.0::DOUBLE),
                        (1, 0.1::DOUBLE, 101.0::DOUBLE, 201.0::DOUBLE)
                ) AS t(driver_number, session_time_seconds, x, y)
            ) TO '{(silver / "positions.parquet").as_posix()}' (FORMAT PARQUET)
            """
        )
    finally:
        conn.close()

    monkeypatch.setattr(telemetry_router, "SILVER_DIR", str(tmp_path / "silver"))
    monkeypatch.setattr(positions_router, "SILVER_DIR", str(tmp_path / "silver"))
    monkeypatch.setattr(positions_router, "BRONZE_DIR", str(tmp_path / "bronze"))
    monkeypatch.setattr(positions_router, "GOLD_DIR", str(tmp_path / "gold"))

    telem = client.get(
        "/api/v1/telemetry/2024/Test-GP/stream",
        params={
            "time_start_ms": 0,
            "time_end_ms": 1000,
            "driver_number": 1,
            "session_type": "R",
        },
    )
    assert telem.status_code == 200
    payload = telem.json()
    assert payload["driver_number"] == 1
    assert payload["samples"] == len(payload["data"])
    assert {"time_ms", "speed", "throttle", "brake"}.issubset(
        set(payload["data"][0].keys())
    )

    pos = client.get(
        "/api/v1/positions/2024/Test-GP/stream",
        params={"time_start_ms": 0, "time_end_ms": 1000, "session_type": "R"},
    )
    assert pos.status_code == 200
    rows = pos.json()
    assert isinstance(rows, list)
    assert len(rows) == 2
    assert {"time_ms", "driver_number", "x", "y"}.issubset(set(rows[0].keys()))


def test_features_and_models_contracts_for_feature_strategy_tabs(
    monkeypatch, tmp_path: Path
):
    monkeypatch.setattr(
        features_router,
        "_load_named_feature",
        lambda *_args, **_kwargs: [
            {
                "year": 2024,
                "race_name": "Test GP",
                "session": "R",
                "driver_name": "Max Verstappen",
                "lap_number": 1,
                "lap_duration": 89.8,
            }
        ],
    )

    features_resp = client.get("/api/v1/features/2024/Test-GP/R/lap")
    assert features_resp.status_code == 200
    rows = features_resp.json()
    assert isinstance(rows, list)
    assert rows and rows[0]["lap_number"] == 1

    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)
    strategy_file = strategy_dir / "2024_Test_GP.json"
    strategy_file.write_text(
        json.dumps(
            {
                "year": 2024,
                "race_name": "Test GP",
                "n_simulations": 100,
                "best_strategy": {
                    "strategy": "SOFT→HARD (Pits: 1)",
                    "avg_points": 20.2,
                    "avg_finish_position": 2.0,
                    "avg_pit_stops": 1.0,
                },
                "all_strategies": {
                    "SOFT→HARD (Pits: 1)": {
                        "strategy": "SOFT→HARD (Pits: 1)",
                        "avg_points": 20.2,
                        "avg_finish_position": 2.0,
                        "avg_pit_stops": 1.0,
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))
    models_router._strategy_payload_cache.clear()
    models_router._strategy_path_index.cache_clear()

    model_resp = client.get("/api/v1/models/strategy-recommendations/2024/Test-GP")
    assert model_resp.status_code == 200
    payload = model_resp.json()
    assert payload["year"] == 2024
    assert payload["race_name"] == "Test GP"
    assert "best_strategy" in payload
    assert "all_strategies" in payload
