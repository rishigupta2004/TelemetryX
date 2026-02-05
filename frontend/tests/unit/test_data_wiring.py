"""Tests for backend -> store wiring and playback-derived view models.

Goal: if these tests pass, the QML bindings have the data they expect.
"""

from __future__ import annotations

from typing import Any, Dict, List

import pytest


class _ImmediateThread:
    def __init__(self, target, daemon: bool = True):
        self._target = target
        self.daemon = daemon

    def start(self) -> None:
        self._target()


class _FakeBackend:
    def __init__(self, *args, **kwargs):
        pass

    def close(self) -> None:
        return None

    def seasons(self) -> List[Dict[str, Any]]:
        return [{"year": 2025}]

    def races_for_year(self, year: int) -> List[Dict[str, Any]]:
        assert year == 2025
        return [{"name": "Bahrain Grand Prix", "sessions": ["R", "Q", "S", "SS"]}]

    def session_viz(self, year: int, race_name: str, session: str) -> Dict[str, Any]:
        assert year == 2025
        assert race_name == "Bahrain Grand Prix"
        assert session in {"R", "Q", "S", "SS"}
        return {
            "metadata": {
                "year": 2025,
                "raceName": "Bahrain Grand Prix",
                "sessionType": session,
                "duration": 100,
                "totalLaps": 10,
            },
            "drivers": [
                {
                    "driverName": "Max Verstappen",
                    "driverNumber": "1",
                    "teamName": "Red Bull",
                    "teamColor": "#3671C6",
                },
                {
                    "driverName": "Lewis Hamilton",
                    "driverNumber": "44",
                    "teamName": "Mercedes",
                    "teamColor": "#27F4D2",
                },
            ],
            "laps": [
                {"position": 1, "driverName": "Max Verstappen", "driverNumber": "1", "lapTimeFormatted": "1:30.000"},
                {"position": 2, "driverName": "Lewis Hamilton", "driverNumber": "44", "lapTimeFormatted": "1:30.500"},
            ],
            "positions": [
                {"timestamp": 0.0, "driverNumber": 1, "x": 0.0, "y": 0.0},
                {"timestamp": 5.0, "driverNumber": 1, "x": 50.0, "y": 10.0},
                {"timestamp": 10.0, "driverNumber": 1, "x": 100.0, "y": 20.0},
                {"timestamp": 0.0, "driverNumber": 44, "x": 0.0, "y": 5.0},
                {"timestamp": 5.0, "driverNumber": 44, "x": 45.0, "y": 15.0},
                {"timestamp": 10.0, "driverNumber": 44, "x": 90.0, "y": 25.0},
            ],
            "weather": [
                {
                    "timestamp": 0.0,
                    "airTemp": 20.0,
                    "trackTemp": 30.0,
                    "humidity": 50.0,
                    "pressure": 1013.0,
                    "windDirection": 90,
                    "windSpeed": 3.0,
                    "rainfall": 0,
                },
                {
                    "timestamp": 5.0,
                    "airTemp": 21.0,
                    "trackTemp": 31.0,
                    "humidity": 49.0,
                    "pressure": 1013.0,
                    "windDirection": 92,
                    "windSpeed": 2.8,
                    "rainfall": 0,
                },
            ],
            "raceControl": [
                {
                    "timestamp": 0.0,
                    "time": "00:00:00",
                    "category": "Flag",
                    "message": "GREEN FLAG",
                    "flag": "GREEN",
                    "scope": "Track",
                    "sector": 0,
                    "racingNumber": 0,
                    "lap": 0,
                }
            ],
            "trackGeometry": {"centerline": [[0.0, 0.0], [1000.0, 0.0], [1000.0, 500.0], [0.0, 500.0]]},
        }

    def session_laps(self, year: int, race_name: str, session: str) -> List[Dict[str, Any]]:
        assert year == 2025
        assert race_name == "Bahrain Grand Prix"
        assert session in {"R", "Q", "S", "SS"}
        return [
            {
                "driverName": "Max Verstappen",
                "driverNumber": "1",
                "lapNumber": 1,
                "lapTime": 90.0,
                "lapTimeFormatted": "1:30.000",
                "position": 1,
                "tyreCompound": "SOFT",
                "isValid": True,
                "sector1": 30.0,
                "sector2": 30.0,
                "sector3": 30.0,
            },
            {
                "driverName": "Lewis Hamilton",
                "driverNumber": "44",
                "lapNumber": 1,
                "lapTime": 90.5,
                "lapTimeFormatted": "1:30.500",
                "position": 2,
                "tyreCompound": "SOFT",
                "isValid": True,
                "sector1": 30.2,
                "sector2": 30.1,
                "sector3": 30.2,
            },
        ]

    def tyre_features(self, year: int, race_name: str, session: str) -> List[Dict[str, Any]]:
        assert year == 2025
        assert race_name == "Bahrain Grand Prix"
        assert session in {"R", "Q", "S", "SS"}
        return [
            {
                "driver_number": "1",
                "driver_name": "Max Verstappen",
                "tyre_compound": "SOFT",
                "stint_number": 1,
                "first_lap": 1,
                "last_lap": 5,
                "tyre_laps_in_stint": 5,
                "tyre_age_at_stint_start": 0,
                "tyre_age_at_stint_end": 5,
            }
        ]

    def session_telemetry(
        self,
        year: int,
        race_name: str,
        session: str,
        driver_numbers: List[int] | None = None,
        hz: float = 1.0,
        t0: float | None = None,
        t1: float | None = None,
    ) -> Dict[str, Any]:
        assert year == 2025
        assert race_name == "Bahrain Grand Prix"
        assert session in {"R", "Q", "S", "SS"}
        # Real backend returns a bare {driverName: [rows...]} dict (unless unavailable).
        return {
            "Max Verstappen": [
                {
                    "driverNumber": 1,
                    "driverName": "Max Verstappen",
                    "timestamp": 0.0,
                    "speed": 100,
                    "throttle": 50,
                    "brake": 0,
                    "rpm": 11000,
                    "gear": 5,
                    "drs": 0,
                },
                {
                    "driverNumber": 1,
                    "driverName": "Max Verstappen",
                    "timestamp": 5.0,
                    "speed": 200,
                    "throttle": 90,
                    "brake": 0,
                    "rpm": 12000,
                    "gear": 7,
                    "drs": 1,
                },
            ],
            "Lewis Hamilton": [
                {
                    "driverNumber": 44,
                    "driverName": "Lewis Hamilton",
                    "timestamp": 5.0,
                    "speed": 195,
                    "throttle": 88,
                    "brake": 1,
                    "rpm": 11800,
                    "gear": 7,
                    "drs": 1,
                }
            ],
        }

    def undercut_predict(self, **params) -> Dict[str, Any]:
        assert "position_before_pit" in params
        return {"prediction": "SUCCESS", "success_probability": 0.66, "confidence": "medium", "recommendations": []}


@pytest.fixture
def root_store():
    from app.core.store.root_store import RootStore

    rs = RootStore()
    rs.initialize()
    return rs


def test_load_session_into_store_populates_models(monkeypatch, root_store):
    from app.services import bootstrap

    monkeypatch.setattr(bootstrap, "TelemetryXBackend", _FakeBackend)
    monkeypatch.setattr(bootstrap.threading, "Thread", _ImmediateThread)

    bootstrap.load_session_into_store(root_store, 2025, "Bahrain Grand Prix", "R")

    assert root_store.session.season == 2025
    assert root_store.session.session == "R"
    assert root_store.session.total_laps == 10
    assert root_store.session.duration_seconds == 100
    assert root_store.session.race_name == "Bahrain Grand Prix"
    assert root_store.session.track_points and len(root_store.session.track_points) >= 4

    # Drivers + timing rows
    assert len(root_store.driver.all_drivers) == 2
    assert [d["code"] for d in root_store.driver.all_drivers] == ["VER", "HAM"]
    assert len(root_store.session.timing_rows) == 2
    assert root_store.session.timing_rows[0]["code"] == "VER"
    assert root_store.session.timing_rows[0]["lastLapSeconds"] == pytest.approx(90.0)

    # Track cars (initial, based on latest position per driver)
    cars = {c["code"]: c for c in root_store.session.track_cars}
    assert set(cars.keys()) == {"VER", "HAM"}
    # Positions are fit into the track-geometry coordinate space.
    assert isinstance(cars["VER"]["x"], float)
    assert isinstance(cars["VER"]["y"], float)

    # Features (tyre stints)
    assert len(root_store.session.tyre_stints) == 1
    assert root_store.session.tyre_stints[0]["code"] == "VER"
    assert root_store.session.tyre_stints[0]["compound"] == "SOFT"

    # Telemetry was loaded synchronously via patched Thread
    assert root_store.session._telemetry_index
    assert root_store.session._telemetry_time_bounds == (0.0, 5.0)
    assert root_store.session._weather_index
    assert root_store.session.race_control


def test_bootstrap_store_from_backend_sets_available_sessions(monkeypatch, root_store):
    from app.services import bootstrap

    monkeypatch.setattr(bootstrap, "TelemetryXBackend", _FakeBackend)
    monkeypatch.setattr(bootstrap.threading, "Thread", _ImmediateThread)

    bootstrap.bootstrap_store_from_backend(root_store)
    assert root_store.session.available_sessions == ["R", "Q", "S", "SS"]
    assert root_store.session.session in {"R", "Q", "S", "SS"}


def test_predict_undercut_writes_result(monkeypatch, root_store):
    from app.services import bootstrap, strategy

    monkeypatch.setattr(bootstrap, "TelemetryXBackend", _FakeBackend)
    monkeypatch.setattr(bootstrap.threading, "Thread", _ImmediateThread)
    bootstrap.load_session_into_store(root_store, 2025, "Bahrain Grand Prix", "R")

    monkeypatch.setattr(strategy, "TelemetryXBackend", _FakeBackend)
    strategy.predict_undercut_into_store(root_store.session, "VER", "HAM")

    assert root_store.session.undercut_prediction["attacker"] == "VER"
    assert root_store.session.undercut_prediction["result"]["success_probability"] == pytest.approx(0.66)


def test_playback_sync_updates_track_and_telemetry(monkeypatch, root_store):
    from app.services import bootstrap
    from app.services.playback_sync import PlaybackSync

    monkeypatch.setattr(bootstrap, "TelemetryXBackend", _FakeBackend)
    monkeypatch.setattr(bootstrap.threading, "Thread", _ImmediateThread)
    bootstrap.load_session_into_store(root_store, 2025, "Bahrain Grand Prix", "R")

    root_store.driver.select_primary_driver("VER")
    root_store.driver.select_compare_driver("HAM")

    sync = PlaybackSync(root_store)
    sync.on_time_changed(50.0)  # duration is 100s -> progress=0.5 -> pick timestamp ~5.0

    cars = {c["code"]: c for c in root_store.session.track_cars}
    assert isinstance(cars["VER"]["x"], float)
    assert isinstance(cars["HAM"]["x"], float)

    snap = root_store.session.telemetry_snapshot
    assert snap["primary"]["code"] == "VER"
    # Telemetry bounds are (0..5); session time clamps to t=5.0.
    assert snap["primary"]["speed"] == 200
    assert snap["compare"] is None

    win = root_store.session.telemetry_window
    assert win["primary"]["code"] == "VER"
    assert win["compare"] is None
    assert win["windowS"] == pytest.approx(5.0)
    assert win["t0"] == pytest.approx(0.0)
    assert win["t1"] == pytest.approx(5.0)
    assert win["primary"]["speed"] == [100.0, 200.0]

    wx = root_store.session.weather_snapshot
    assert wx["airTemp"] == pytest.approx(20.0)


def test_qml_can_read_store_properties(qapp, root_store):
    """Minimal QML compile/binding test for the fields the UI uses."""
    from PySide6.QtCore import QUrl
    from PySide6.QtQml import QQmlComponent, QQmlEngine

    from app.core.bridge.store_bridge import RootBridge
    from app.services import bootstrap

    # Prepare deterministic store state.
    bootstrap.TelemetryXBackend = _FakeBackend  # type: ignore[attr-defined]
    bootstrap.threading.Thread = _ImmediateThread  # type: ignore[attr-defined]
    bootstrap.load_session_into_store(root_store, 2025, "Bahrain Grand Prix", "R")

    engine = QQmlEngine()
    bridge = RootBridge(root_store, engine)
    engine.rootContext().setContextProperty("rootStore", bridge)

    qml = b"""
import QtQuick 2.15
QtObject {
  property int nRows: rootStore.session.timingRows.length
  property int nTrack: rootStore.session.trackPoints.length
  property string firstCode: rootStore.session.timingRows.length > 0 ? rootStore.session.timingRows[0].code : ""
  property int nSessions: rootStore.session.availableSessions.length
  property bool hasTelWindowProp: rootStore.session.telemetryWindow !== undefined
  property bool hasWeatherProp: rootStore.session.weatherSnapshot !== undefined
  property int nRaceControl: rootStore.session.raceControl.length
}
"""
    comp = QQmlComponent(engine)
    comp.setData(qml, QUrl())
    obj = comp.create()
    assert obj is not None
    assert obj.property("nRows") == 2
    assert obj.property("nTrack") >= 4
    assert obj.property("firstCode") == "VER"
    assert obj.property("hasTelWindowProp") is True
    assert obj.property("hasWeatherProp") is True
    assert obj.property("nRaceControl") == 1


def test_dump_wiring_output_smoke(monkeypatch, root_store):
    """Human-readable wiring dump; run with `pytest -s` to see output."""
    from app.services import bootstrap
    from app.services.playback_sync import PlaybackSync

    monkeypatch.setattr(bootstrap, "TelemetryXBackend", _FakeBackend)
    monkeypatch.setattr(bootstrap.threading, "Thread", _ImmediateThread)

    bootstrap.bootstrap_store_from_backend(root_store)
    root_store.driver.select_primary_driver("VER")
    root_store.driver.select_compare_driver("HAM")

    sync = PlaybackSync(root_store)
    sync.on_time_changed(50.0)

    print("available_sessions:", root_store.session.available_sessions)
    print("session_name:", root_store.session.session_name)
    print("drivers:", root_store.driver.all_drivers)
    print("timing_rows[0]:", root_store.session.timing_rows[0])
    print("track_points(count):", len(root_store.session.track_points))
    print("track_cars(t=50s):", root_store.session.track_cars)
    print("tyre_stints:", root_store.session.tyre_stints)
    print("telemetry_snapshot(t=50s):", root_store.session.telemetry_snapshot)
    print("telemetry_window(t=50s):", root_store.session.telemetry_window)

    assert root_store.session.telemetry_snapshot["primary"]["code"] == "VER"
    assert root_store.session.telemetry_window["primary"]["speed"]
