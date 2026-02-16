from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.routers import sessions as sessions_router
from main import app


client = TestClient(app)


def _make_session_dir(tmp_path: Path, year: int, race_name: str = "Bahrain Grand Prix", session: str = "R") -> Path:
    session_dir = tmp_path / "silver" / str(year) / race_name / session
    session_dir.mkdir(parents=True)
    return session_dir


def _stub_session_loaders(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sessions_router, "load_metadata", lambda year, race, session: {"duration": 5400})
    monkeypatch.setattr(sessions_router, "load_drivers", lambda silver_path, year=None: [])
    monkeypatch.setattr(sessions_router, "load_laps", lambda silver_path, latest_only=False: [])
    monkeypatch.setattr(sessions_router, "load_positions", lambda year, race, session: [])
    monkeypatch.setattr(sessions_router, "load_weather", lambda silver_path: [])
    monkeypatch.setattr(sessions_router, "load_race_control", lambda silver_path: [])
    monkeypatch.setattr(sessions_router, "load_track_geometry", lambda race, year=None: {})
    monkeypatch.setattr(sessions_router, "cache_get", lambda key: None)
    monkeypatch.setattr(sessions_router, "cache_set", lambda key, payload: payload)


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R",
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/viz",
    ],
)
def test_session_endpoints_set_telemetry_available_false_when_parquet_missing(tmp_path, monkeypatch, endpoint):
    _make_session_dir(tmp_path, 2025)
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))
    _stub_session_loaders(monkeypatch)

    response = client.get(endpoint)
    assert response.status_code == 200
    metadata = response.json()["metadata"]
    assert metadata["telemetryAvailable"] is False
    assert metadata["telemetryUnavailableReason"] is None


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R",
        "/api/v1/sessions/2025/Bahrain-Grand-Prix/R/viz",
    ],
)
def test_session_endpoints_set_telemetry_available_true_when_parquet_present(tmp_path, monkeypatch, endpoint):
    session_dir = _make_session_dir(tmp_path, 2025)
    (session_dir / "telemetry.parquet").touch()
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))
    _stub_session_loaders(monkeypatch)

    response = client.get(endpoint)
    assert response.status_code == 200
    metadata = response.json()["metadata"]
    assert metadata["telemetryAvailable"] is True
    assert metadata["telemetryUnavailableReason"] is None


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/sessions/2018/Bahrain-Grand-Prix/R",
        "/api/v1/sessions/2018/Bahrain-Grand-Prix/R/viz",
    ],
)
def test_session_endpoints_keep_reason_and_force_telemetry_unavailable(tmp_path, monkeypatch, endpoint):
    session_dir = _make_session_dir(tmp_path, 2018)
    (session_dir / "telemetry.parquet").touch()
    monkeypatch.setattr(sessions_router, "SILVER_DIR", str(tmp_path / "silver"))
    _stub_session_loaders(monkeypatch)

    response = client.get(endpoint)
    assert response.status_code == 200
    metadata = response.json()["metadata"]
    assert metadata["telemetryAvailable"] is False
    assert metadata["telemetryUnavailableReason"] == (
        "Telemetry unavailable for this session due to FIA data restrictions."
    )
