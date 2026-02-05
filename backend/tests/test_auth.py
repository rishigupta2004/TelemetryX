from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Ensure `import main` resolves to `backend/main.py` even when pytest rootdir is `frontend/`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402


client = TestClient(app)


def test_register_login_and_me_roundtrip():
    email = "test@example.com"
    password = "password123"

    r = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert r.status_code in (200, 409)

    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == email


def test_subscription_required_for_protected_stream_slot_state():
    email = "subtest@example.com"
    password = "password123"

    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()
    token = login["access_token"]

    streams = client.get("/api/v1/streams/list").json()
    placeholder = [s for s in streams if s["id"] == "protected-placeholder"][0]
    assert placeholder["requires_subscription"] is True
    assert placeholder.get("unlocked") is False

    client.post("/api/v1/auth/subscribe", json={"plan": "pro"}, headers={"Authorization": f"Bearer {token}"})
    streams = client.get("/api/v1/streams/list", headers={"Authorization": f"Bearer {token}"}).json()
    placeholder = [s for s in streams if s["id"] == "protected-placeholder"][0]
    assert placeholder.get("unlocked") is True
