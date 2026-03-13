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

    r = client.post(
        "/api/v1/auth/register", json={"email": email, "password": password}
    )
    assert r.status_code in (200, 409)

    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == email
