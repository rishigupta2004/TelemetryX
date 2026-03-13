from pathlib import Path

import duckdb
from fastapi.testclient import TestClient

import pytest

from main import app
from api.routers import sessions as sessions_router
from api.routers.sessions import (
    DEFAULT_TELEMETRY_WINDOW_S,
    _remap_positions_to_manual,
    _session_race_time_bounds,
    _resolve_time_window,
    load_race_control,
    load_telemetry,
    load_weather,
)

client = TestClient(app)


def _write_parquet(path: Path, select_query: str) -> None:
    conn = duckdb.connect()
    try:
        conn.execute(f"COPY ({select_query}) TO '{path.as_posix()}' (FORMAT PARQUET)")
    finally:
        conn.close()


def test_load_telemetry_casts_driver_name_for_coalesce(tmp_path):
    session_dir = tmp_path / "session"
    session_dir.mkdir()

    _write_parquet(
        session_dir / "telemetry.parquet",
        """
        SELECT * FROM (
            VALUES
                (44, 0.10::DOUBLE, 300.0, 0.40, FALSE, 12000.0, 8, 1),
                (44, 0.90::DOUBLE, 305.0, 0.70, TRUE, 12100.0, 8, 1),
                (44, 1.10::DOUBLE, 306.0, 0.80, FALSE, 12200.0, 8, 0)
        ) AS t(driver_number, session_time_seconds, speed, throttle, brake, rpm, gear, drs)
        """,
    )
    _write_parquet(
        session_dir / "laps.parquet",
        """
        SELECT * FROM (
            VALUES
                (44, 7)
        ) AS t(driver_number, driver_name)
        """,
    )

    downsampled = load_telemetry(str(session_dir), hz=1.0)
    assert "7" in downsampled
    assert len(downsampled["7"]) == 2
    assert isinstance(downsampled["7"][0]["driverName"], str)
    assert downsampled["7"][0]["timestamp"] == 0.9
    assert downsampled["7"][0]["brake"] == 100.0

    full_rate = load_telemetry(str(session_dir), hz=0.0)
    assert "7" in full_rate
    assert len(full_rate["7"]) == 3
    assert isinstance(full_rate["7"][0]["driverName"], str)


def test_load_weather_returns_consistent_typed_payload(tmp_path):
    session_dir = tmp_path / "session"
    session_dir.mkdir()

    _write_parquet(
        session_dir / "weather.parquet",
        """
        SELECT * FROM (
            VALUES
                (1000000000::BIGINT, 25.23::DOUBLE, 33.81::DOUBLE, 40.44::DOUBLE, 1013.26::DOUBLE, 180::BIGINT, 5.55::DOUBLE, TRUE),
                (2000000000::BIGINT, NULL::DOUBLE, NULL::DOUBLE, NULL::DOUBLE, NULL::DOUBLE, NULL::BIGINT, NULL::DOUBLE, NULL::BOOLEAN)
        ) AS t(Time, air_temperature, track_temperature, humidity, pressure, wind_direction, wind_speed, Rainfall)
        """,
    )

    payload = load_weather(str(session_dir))
    assert len(payload) == 2

    first = payload[0]
    assert first["timestamp"] == 1.0
    assert first["airTemp"] == 25.2
    assert first["trackTemp"] == 33.8
    assert first["humidity"] == 40.4
    assert first["pressure"] == 1013.3
    assert first["windDirection"] == 180
    assert isinstance(first["windDirection"], int)
    assert first["windSpeed"] == 5.6
    assert first["rainfall"] == 1
    assert isinstance(first["rainfall"], int)

    second = payload[1]
    assert second["timestamp"] == 2.0
    assert second["windDirection"] is None
    assert second["rainfall"] == 0


def test_load_race_control_handles_mixed_types_without_binder_errors(tmp_path):
    session_dir = tmp_path / "session"
    session_dir.mkdir()

    _write_parquet(
        session_dir / "race_control.parquet",
        """
        SELECT * FROM (
            VALUES
                (TIMESTAMP '2024-03-01 12:00:00', 'FLAG', 'Yellow in sector 1', 'YELLOW', 'Track', '1', '44', '3'),
                (TIMESTAMP '2024-03-01 12:00:05', 'NOTE', 'Safety car deployed', 'SC', 'Track', 'SC', 'N/A', 'LAP-NA')
        ) AS t(session_time, category, message, Flag, Scope, Sector, RacingNumber, Lap)
        """,
    )

    payload = load_race_control(str(session_dir), limit=500)
    assert len(payload) == 2

    first = payload[0]
    assert first["timestamp"] == 0.0
    assert first["time"] == "12:00:00"
    assert first["category"] == "FLAG"
    assert first["message"] == "Yellow in sector 1"
    assert first["flag"] == "YELLOW"
    assert first["scope"] == "Track"
    assert first["sector"] == 1
    assert isinstance(first["sector"], int)
    assert first["racingNumber"] == 44
    assert first["lap"] == 3

    second = payload[1]
    assert second["timestamp"] == 5.0
    assert second["sector"] is None
    assert second["racingNumber"] is None
    assert second["lap"] is None

    latest_only = load_race_control(str(session_dir), limit=1)
    assert len(latest_only) == 1
    assert latest_only[0]["message"] == "Safety car deployed"


def test_resolve_time_window_defaults_are_bounded_and_pairwise():
    start, end = _resolve_time_window(None, None, DEFAULT_TELEMETRY_WINDOW_S)
    assert start == 0.0
    assert end == float(DEFAULT_TELEMETRY_WINDOW_S)
    with pytest.raises(Exception):
        _resolve_time_window(0.0, None, DEFAULT_TELEMETRY_WINDOW_S)


def test_session_race_time_bounds_uses_lap_rows(monkeypatch):
    monkeypatch.setattr(
        sessions_router,
        "load_laps",
        lambda _path, latest_only=False: [
            {
                "lapNumber": 1,
                "lapStartSeconds": 100.0,
                "lapEndSeconds": 190.0,
                "lapTime": 90.0,
            },
            {
                "lapNumber": 2,
                "lapStartSeconds": 110.0,
                "lapEndSeconds": 210.0,
                "lapTime": 100.0,
            },
            {
                "lapNumber": 0,
                "lapStartSeconds": 0.0,
                "lapEndSeconds": 10.0,
                "lapTime": 10.0,
            },
        ],
    )
    assert _session_race_time_bounds("/tmp/ignored", "R") == (100.0, 210.0)
    assert _session_race_time_bounds("/tmp/ignored", "Q") is None


def test_session_viz_metadata_includes_race_bounds(monkeypatch):
    monkeypatch.setattr(
        sessions_router, "resolve_dir", lambda _year_path, race_name: str(race_name)
    )
    monkeypatch.setattr(
        sessions_router, "get_session_path", lambda *_args, **_kwargs: "/tmp/ignored"
    )
    monkeypatch.setattr(sessions_router, "cache_get", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(sessions_router, "cache_set", lambda _key, payload: payload)
    monkeypatch.setattr(
        sessions_router, "load_metadata", lambda *_args, **_kwargs: {"duration": 1200}
    )
    monkeypatch.setattr(sessions_router, "load_drivers", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(
        sessions_router, "load_laps", lambda *_args, **_kwargs: [{"lapNumber": 1}]
    )
    monkeypatch.setattr(sessions_router, "load_positions", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(
        sessions_router, "load_track_geometry", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(sessions_router, "load_weather", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(
        sessions_router, "load_race_control", lambda *_args, **_kwargs: []
    )
    monkeypatch.setattr(
        sessions_router, "telemetry_unavailable_reason", lambda *_args, **_kwargs: None
    )
    monkeypatch.setattr(
        sessions_router, "telemetry_available", lambda *_args, **_kwargs: True
    )
    monkeypatch.setattr(
        sessions_router, "_positions_bounds", lambda *_args, **_kwargs: None
    )
    monkeypatch.setattr(
        sessions_router,
        "_session_telemetry_bounds",
        lambda *_args, **_kwargs: (5.0, 999.0),
    )
    monkeypatch.setattr(
        sessions_router,
        "_session_race_time_bounds",
        lambda *_args, **_kwargs: (100.0, 900.0),
    )

    resp = client.get("/api/v1/sessions/2025/Unit-Test-GP/R/viz")
    assert resp.status_code == 200
    meta = resp.json().get("metadata", {})
    assert meta.get("raceStartSeconds") == 100.0
    assert meta.get("raceEndSeconds") == 900.0
    assert meta.get("raceDurationSeconds") == 800.0


def test_remap_positions_projects_normalized_coordinates_to_canonical(monkeypatch):
    coords = []
    for t in range(0, 4):
        for s in range(0, 4):
            frac = s / 3.0
            if t == 0:
                coords.append({"x": 100.0 + 100.0 * frac, "y": 100.0})
            elif t == 1:
                coords.append({"x": 200.0, "y": 100.0 + 100.0 * frac})
            elif t == 2:
                coords.append({"x": 200.0 - 100.0 * frac, "y": 200.0})
            else:
                coords.append({"x": 100.0, "y": 200.0 - 100.0 * frac})
    coords.append({"x": 100.0, "y": 100.0})
    geometry = {"layout": {"path_coordinates": coords}}
    monkeypatch.setattr(
        sessions_router, "load_track_geometry", lambda *_args, **_kwargs: geometry
    )

    rows = []
    for idx in range(25):
        t = float(idx) * 0.5
        phase = idx % 4
        if phase == 0:
            x, y = 0.05, 0.05
        elif phase == 1:
            x, y = 0.95, 0.05
        elif phase == 2:
            x, y = 0.95, 0.95
        else:
            x, y = 0.05, 0.95
        rows.append({"timestamp": t, "driverNumber": 1, "x": x, "y": y})

    out = _remap_positions_to_manual(rows, 2025, "Test GP")
    assert len(out) == len(rows)
    assert max(float(r["x"]) for r in out) > 150.0
    assert max(float(r["y"]) for r in out) > 150.0
    assert min(float(r["x"]) for r in out) >= 99.0
    assert min(float(r["y"]) for r in out) >= 99.0


def test_remap_positions_keeps_already_canonical_coordinates(monkeypatch):
    coords = []
    for t in range(0, 4):
        for s in range(0, 4):
            frac = s / 3.0
            if t == 0:
                coords.append({"x": 100.0 + 100.0 * frac, "y": 100.0})
            elif t == 1:
                coords.append({"x": 200.0, "y": 100.0 + 100.0 * frac})
            elif t == 2:
                coords.append({"x": 200.0 - 100.0 * frac, "y": 200.0})
            else:
                coords.append({"x": 100.0, "y": 200.0 - 100.0 * frac})
    coords.append({"x": 100.0, "y": 100.0})
    geometry = {"layout": {"path_coordinates": coords}}
    monkeypatch.setattr(
        sessions_router, "load_track_geometry", lambda *_args, **_kwargs: geometry
    )

    rows = []
    for idx in range(25):
        rows.append(
            {
                "timestamp": float(idx),
                "driverNumber": 63,
                "x": 100.0 + float(idx % 10),
                "y": 100.0 + float((idx * 2) % 10),
            }
        )

    out = _remap_positions_to_manual(rows, 2025, "Test GP")
    assert out == rows


@pytest.mark.parametrize(
    "geometry,seed_points",
    [
        (
            {
                "layout": {
                    "path_coordinates": [
                        {"x": 40.0, "y": 40.0},
                        {"x": 360.0, "y": 40.0},
                        {"x": 420.0, "y": 140.0},
                        {"x": 420.0, "y": 280.0},
                        {"x": 340.0, "y": 360.0},
                        {"x": 160.0, "y": 360.0},
                        {"x": 80.0, "y": 300.0},
                        {"x": 40.0, "y": 180.0},
                        {"x": 40.0, "y": 40.0},
                    ]
                }
            },
            [
                (0.05, 0.08),
                (0.92, 0.10),
                (0.95, 0.38),
                (0.80, 0.88),
                (0.22, 0.90),
                (0.08, 0.55),
            ],
        ),
        (
            {
                "layout": {
                    "path_coordinates": [
                        {"x": 90.0, "y": 70.0},
                        {"x": 300.0, "y": 90.0},
                        {"x": 370.0, "y": 180.0},
                        {"x": 330.0, "y": 260.0},
                        {"x": 250.0, "y": 300.0},
                        {"x": 170.0, "y": 280.0},
                        {"x": 120.0, "y": 210.0},
                        {"x": 110.0, "y": 140.0},
                        {"x": 90.0, "y": 70.0},
                    ]
                }
            },
            [
                (0.10, 0.12),
                (0.62, 0.14),
                (0.90, 0.44),
                (0.72, 0.86),
                (0.38, 0.90),
                (0.16, 0.58),
            ],
        ),
    ],
)
def test_remap_positions_multi_layout_stability(monkeypatch, geometry, seed_points):
    monkeypatch.setattr(
        sessions_router, "load_track_geometry", lambda *_args, **_kwargs: geometry
    )

    rows = []
    total = 180
    for idx in range(total):
        t = float(idx) * 0.2
        base = seed_points[idx % len(seed_points)]
        jitter_x = ((idx % 5) - 2) * 0.004
        jitter_y = ((idx % 7) - 3) * 0.003
        rows.append(
            {
                "timestamp": t,
                "driverNumber": 16,
                "x": max(0.0, min(1.0, base[0] + jitter_x)),
                "y": max(0.0, min(1.0, base[1] + jitter_y)),
            }
        )

    out = _remap_positions_to_manual(rows, 2024, "Stability GP")
    assert len(out) == len(rows)
    assert [r["timestamp"] for r in out] == [r["timestamp"] for r in rows]
    assert all(int(r["driverNumber"]) == 16 for r in out)

    xs = [float(r["x"]) for r in out]
    ys = [float(r["y"]) for r in out]
    assert all(v == v for v in xs)
    assert all(v == v for v in ys)

    path = geometry["layout"]["path_coordinates"]
    min_x = min(float(p["x"]) for p in path)
    max_x = max(float(p["x"]) for p in path)
    min_y = min(float(p["y"]) for p in path)
    max_y = max(float(p["y"]) for p in path)

    mapped_to_canonical = max(xs) > 5.0 and max(ys) > 5.0
    if mapped_to_canonical:
        assert min(xs) >= min_x - 2.0
        assert max(xs) <= max_x + 2.0
        assert min(ys) >= min_y - 2.0
        assert max(ys) <= max_y + 2.0
    else:
        assert min(xs) >= -0.05
        assert max(xs) <= 1.05
        assert min(ys) >= -0.05
        assert max(ys) <= 1.05

    max_step = 0.0
    for i in range(1, len(out)):
        dx = float(out[i]["x"]) - float(out[i - 1]["x"])
        dy = float(out[i]["y"]) - float(out[i - 1]["y"])
        max_step = max(max_step, (dx * dx + dy * dy) ** 0.5)
    assert max_step < (420.0 if mapped_to_canonical else 2.0)
