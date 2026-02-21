import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402
from api import cache as cache_mod  # noqa: E402
from api.routers import assets as assets_router  # noqa: E402


client = TestClient(app)


def _clear_cache() -> None:
    cache_mod._CACHE.clear()


def test_identity_assets_year_gate(monkeypatch):
    _clear_cache()
    monkeypatch.setattr(assets_router, "MEDIA_CACHE_DIR", Path("/tmp/telemetryx-assets-test-1"))

    response = client.get("/api/v1/assets/identity/2017/Abu-Dhabi-Grand-Prix/R?force_refresh=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["enabled"] is False
    assert "2018-2025" in payload["reason"]


def test_identity_assets_missing_key(monkeypatch):
    _clear_cache()
    monkeypatch.setattr(assets_router, "MEDIA_CACHE_DIR", Path("/tmp/telemetryx-assets-test-2"))
    monkeypatch.setattr(assets_router, "_get_api_key", lambda: None)

    response = client.get("/api/v1/assets/identity/2024/Abu-Dhabi-Grand-Prix/R?force_refresh=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["enabled"] is False
    assert "API-Sports key" in payload["reason"]


def test_identity_assets_download_and_serve(monkeypatch, tmp_path):
    _clear_cache()
    monkeypatch.setattr(assets_router, "MEDIA_CACHE_DIR", tmp_path)
    monkeypatch.setattr(assets_router, "_get_api_key", lambda: "test-key")
    monkeypatch.setattr(assets_router.sessions_router, "get_session_path", lambda year, race, session: "/tmp/session")
    monkeypatch.setattr(
        assets_router.sessions_router,
        "load_drivers",
        lambda _path, year=None: [
            {"driverName": "Lewis Hamilton", "driverNumber": 44, "teamName": "Mercedes", "teamColor": "#27F4D2"}
        ],
    )

    async def _fake_fetch_catalog_records(_client, _year, endpoint, _api_key):
        if endpoint == "drivers":
            return [
                {
                    "driver": {
                        "name": "Lewis Hamilton",
                        "number": 44,
                        "image": "https://cdn.example.com/drivers/lewis_hamilton.png",
                    },
                    "team": {"name": "Mercedes", "logo": "https://cdn.example.com/teams/mercedes.png"},
                }
            ]
        if endpoint == "teams":
            return [{"team": {"name": "Mercedes", "logo": "https://cdn.example.com/teams/mercedes.png"}}]
        return []

    async def _fake_download(_client, _url, target_dir, base_name):
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / f"{base_name}.png"
        path.write_bytes(b"fake-image-bytes")
        return path

    monkeypatch.setattr(assets_router, "_fetch_catalog_records", _fake_fetch_catalog_records)
    monkeypatch.setattr(assets_router, "_download_image", _fake_download)

    response = client.get("/api/v1/assets/identity/2024/Abu-Dhabi-Grand-Prix/R?force_refresh=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["enabled"] is True
    assert payload["n_driver_images"] == 1
    assert payload["n_team_images"] == 1
    assert len(payload["drivers"]) == 1

    driver = payload["drivers"][0]
    assert driver["driverImage"].startswith("/api/v1/assets/media/2024/drivers/")
    assert driver["teamImage"].startswith("/api/v1/assets/media/2024/teams/")

    driver_media = client.get(driver["driverImage"])
    assert driver_media.status_code == 200
    assert driver_media.content == b"fake-image-bytes"
