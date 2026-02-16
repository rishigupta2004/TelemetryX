from __future__ import annotations

import pandas as pd
from fastapi.testclient import TestClient

from main import app
from api.routers import laps as laps_router


client = TestClient(app)


def test_driver_lap_selection_picks_fastest_in_segment(monkeypatch):
    df = pd.DataFrame(
        [
            {"driver_number": 1, "driver_name": "VER", "lap_number": 1, "lap_time_seconds": 92.2, "session_time_seconds": 120.0, "is_valid_lap": True},
            {"driver_number": 1, "driver_name": "VER", "lap_number": 4, "lap_time_seconds": 91.3, "session_time_seconds": 360.0, "is_valid_lap": True},
            {"driver_number": 1, "driver_name": "VER", "lap_number": 7, "lap_time_seconds": 90.4, "session_time_seconds": 660.0, "is_valid_lap": True},
            {"driver_number": 1, "driver_name": "VER", "lap_number": 8, "lap_time_seconds": 91.7, "session_time_seconds": 680.0, "is_valid_lap": True},
            {"driver_number": 44, "driver_name": "HAM", "lap_number": 2, "lap_time_seconds": 93.0, "session_time_seconds": 200.0, "is_valid_lap": True},
        ]
    )
    monkeypatch.setattr(laps_router, "_laps_df", lambda year, race_slug, session_type: df)

    r = client.get(
        "/api/v1/laps/2025/Bahrain-Grand-Prix/1/selection",
        params={"session_type": "Q", "segment": "Q3"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["segments"] == ["Q3"]
    assert body["selected"]["lap_number"] == 7
    assert abs(float(body["selected"]["lap_time_seconds"]) - 90.4) < 1e-6


def test_driver_lap_selection_honors_explicit_lap_number(monkeypatch):
    df = pd.DataFrame(
        [
            {"driver_number": 16, "driver_name": "LEC", "lap_number": 3, "lap_time_seconds": 93.9, "session_time_seconds": 190.0, "is_valid_lap": True},
            {"driver_number": 16, "driver_name": "LEC", "lap_number": 5, "lap_time_seconds": 92.8, "session_time_seconds": 370.0, "is_valid_lap": True},
        ]
    )
    monkeypatch.setattr(laps_router, "_laps_df", lambda year, race_slug, session_type: df)

    r = client.get(
        "/api/v1/laps/2025/Bahrain-Grand-Prix/16/selection",
        params={"session_type": "Q", "lap_number": 3},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["selected"]["lap_number"] == 3
    assert abs(float(body["selected"]["lap_time_seconds"]) - 93.9) < 1e-6


def test_driver_lap_selection_defaults_to_valid_laps(monkeypatch):
    df = pd.DataFrame(
        [
            {"driver_number": 4, "driver_name": "NOR", "lap_number": 9, "lap_time_seconds": 88.2, "session_time_seconds": 640.0, "is_valid_lap": False},
            {"driver_number": 4, "driver_name": "NOR", "lap_number": 10, "lap_time_seconds": 89.0, "session_time_seconds": 700.0, "is_valid_lap": True},
        ]
    )
    monkeypatch.setattr(laps_router, "_laps_df", lambda year, race_slug, session_type: df)

    r = client.get(
        "/api/v1/laps/2025/Bahrain-Grand-Prix/4/selection",
        params={"session_type": "Q"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["selected"]["lap_number"] == 10
    assert abs(float(body["selected"]["lap_time_seconds"]) - 89.0) < 1e-6


def test_driver_lap_selection_allows_invalid_when_requested(monkeypatch):
    df = pd.DataFrame(
        [
            {"driver_number": 4, "driver_name": "NOR", "lap_number": 9, "lap_time_seconds": 88.2, "session_time_seconds": 640.0, "is_valid_lap": False},
            {"driver_number": 4, "driver_name": "NOR", "lap_number": 10, "lap_time_seconds": 89.0, "session_time_seconds": 700.0, "is_valid_lap": True},
        ]
    )
    monkeypatch.setattr(laps_router, "_laps_df", lambda year, race_slug, session_type: df)

    r = client.get(
        "/api/v1/laps/2025/Bahrain-Grand-Prix/4/selection",
        params={"session_type": "Q", "valid_only": "false"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["selected"]["lap_number"] == 9
    assert abs(float(body["selected"]["lap_time_seconds"]) - 88.2) < 1e-6


def test_driver_lap_selection_sprint_shootout_alias(monkeypatch):
    df = pd.DataFrame(
        [
            {"driver_number": 81, "driver_name": "PIA", "lap_number": 2, "lap_time_seconds": 90.4, "session_time_seconds": 130.0, "is_valid_lap": True},
            {"driver_number": 81, "driver_name": "PIA", "lap_number": 4, "lap_time_seconds": 89.8, "session_time_seconds": 245.0, "is_valid_lap": True},
        ]
    )
    monkeypatch.setattr(laps_router, "_laps_df", lambda year, race_slug, session_type: df)

    r = client.get(
        "/api/v1/laps/2025/Bahrain-Grand-Prix/81/selection",
        params={"session_type": "SR"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["selected"]["lap_number"] == 4
    assert body["segments"] == []
