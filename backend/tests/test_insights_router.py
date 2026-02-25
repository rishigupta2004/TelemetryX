from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from api.routers import insights as insights_router


client = TestClient(app)


def test_insights_standings_endpoint_returns_driver_and_constructor_tables(tmp_path, monkeypatch):
    monkeypatch.setattr(insights_router, "MEDIA_CACHE_DIR", tmp_path)

    resp = client.get("/api/v1/insights/2025/standings")
    assert resp.status_code == 200
    body = resp.json()
    assert body["year"] == 2025
    assert isinstance(body.get("drivers"), list)
    assert isinstance(body.get("constructors"), list)
    assert len(body["drivers"]) > 0
    assert len(body["constructors"]) > 0


def test_insights_profiles_endpoint_returns_profiles_without_remote_dependency(tmp_path, monkeypatch):
    monkeypatch.setattr(insights_router, "MEDIA_CACHE_DIR", tmp_path)
    monkeypatch.setattr(insights_router, "_load_jolpica_driver_meta", lambda refresh=False: {})

    resp = client.get("/api/v1/insights/profiles")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body.get("drivers"), list)
    assert isinstance(body.get("teams"), list)
    assert len(body["drivers"]) > 0
    assert len(body["teams"]) > 0


def test_insights_circuit_endpoint_prefers_formula1_facts_when_available(tmp_path, monkeypatch):
    monkeypatch.setattr(insights_router, "MEDIA_CACHE_DIR", tmp_path)

    class FakeResp:
        status_code = 200
        text = """
        <html>
          <meta name=\"description\" content=\"Yas Marina profile\" />
          <dt>First Grand Prix</dt><dd>2009</dd>
          <dt>Number of Laps</dt><dd>58</dd>
          <dt>Circuit Length</dt><dd>5.281km</dd>
          <dt>Race Distance</dt><dd>306.183km</dd>
        </html>
        """

    monkeypatch.setattr(insights_router.requests, "get", lambda *args, **kwargs: FakeResp())

    resp = client.get("/api/v1/insights/2025/Abu-Dhabi-Grand-Prix/circuit", params={"refresh": 1})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "formula1.com"
    assert body["facts"]["First Grand Prix"] == "2009"
    assert body["facts"]["Circuit Length"] == "5.281km"
