from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import HTMLResponse
from typing import Optional, Dict, Any, Tuple
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import sys
import time
import urllib.parse
import httpx

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUTH_DB_PATH = os.getenv("TELEMETRYX_AUTH_DB_PATH") or os.path.join(BASE_DIR, "auth.db")
OAUTH_STATE: Dict[str, Dict[str, Any]] = {}
OAUTH_STATE_TTL = 600


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _db()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


_init_db()


def _secret() -> bytes:
    configured = str(os.getenv("AUTH_SECRET", "")).strip()
    if configured and configured != "dev-secret-change-me":
        return configured.encode("utf-8")
    allow_insecure = os.getenv("TELEMETRYX_ALLOW_INSECURE_AUTH_SECRET", "0") == "1"
    if allow_insecure or "pytest" in sys.modules:
        return b"dev-secret-change-me"
    raise RuntimeError(
        "AUTH_SECRET must be set to a non-default value or TELEMETRYX_ALLOW_INSECURE_AUTH_SECRET=1"
    )


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("utf-8"))


def _sign(payload: Dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    msg = f"{header_b64}.{payload_b64}".encode("utf-8")
    sig = hmac.new(_secret(), msg, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def _verify(token: str) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid token")
    header_b64, payload_b64, sig_b64 = parts
    msg = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected = hmac.new(_secret(), msg, hashlib.sha256).digest()
    got = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected, got):
        raise HTTPException(status_code=401, detail="Invalid token signature")
    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    exp = payload.get("exp")
    if exp is not None and int(exp) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def _hash_password(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return dk.hex()


def _get_user_by_email(email: str) -> Optional[sqlite3.Row]:
    conn = _db()
    try:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
        ).fetchone()
    finally:
        conn.close()


def require_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = _verify(token)
    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {"user_id": int(user_id), "email": str(email)}


def _ensure_user(email: str) -> Tuple[int, str]:
    normalized = email.lower().strip()
    user = _get_user_by_email(normalized)
    if user:
        return int(user["id"]), normalized
    salt_hex = secrets.token_bytes(16).hex()
    password_hash = _hash_password(secrets.token_hex(32), salt_hex)
    conn = _db()
    try:
        now = int(time.time())
        cur = conn.execute(
            "INSERT INTO users(email, password_hash, salt, created_at) VALUES(?, ?, ?, ?)",
            (normalized, password_hash, salt_hex, now),
        )
        last_row_id = cur.lastrowid
        if last_row_id is None:
            raise HTTPException(status_code=500, detail="Failed to create user")
        user_id = int(last_row_id)
        conn.commit()
        return user_id, normalized
    finally:
        conn.close()


def _issue_token(user_id: int, email: str) -> Dict[str, Any]:
    now = int(time.time())
    exp = now + 24 * 60 * 60
    token = _sign({"sub": user_id, "email": email, "iat": now, "exp": exp})
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": exp - now,
    }


def _oauth_config(provider: str) -> Dict[str, str]:
    if provider != "google":
        raise HTTPException(status_code=404, detail="Unknown provider")
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:9010/api/v1/auth/oauth/google/callback"
    )
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "tokeninfo": "https://oauth2.googleapis.com/tokeninfo",
    }


async def _verify_google_id_token(id_token: str, client_id: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            "https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token}
        )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google id_token")
    payload = res.json()
    if payload.get("aud") != client_id:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")
    return payload


def _store_oauth_state(
    provider: str, origin: str, extra: Optional[Dict[str, Any]] = None
) -> str:
    state = secrets.token_urlsafe(24)
    OAUTH_STATE[state] = {
        "provider": provider,
        "origin": origin,
        "expires_at": int(time.time()) + OAUTH_STATE_TTL,
        **(extra or {}),
    }
    return state


def _pop_oauth_state(state: str) -> Dict[str, Any]:
    record = OAUTH_STATE.pop(state, None)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    if record.get("expires_at", 0) < int(time.time()):
        raise HTTPException(status_code=400, detail="OAuth state expired")
    return record


def _oauth_result_html(payload: Dict[str, Any], origin: str) -> str:
    origin_value = origin if origin else "*"
    data = json.dumps({"type": "telemetryx:oauth", **payload})
    return f"""
    <!DOCTYPE html>
    <html lang="en">
      <head><meta charset="utf-8" /><title>TelemetryX OAuth</title></head>
      <body style="background:#050508;color:#e2e8f0;font-family:system-ui;padding:20px;">
        <h3>TelemetryX</h3>
        <p>Login complete.</p>

        <div style="margin-top:14px;padding:12px;border:1px solid #27272a;border-radius:10px;background:#0b0b10;">
          <div style="font-size:12px;color:#a1a1aa;margin-bottom:8px;">API Token (JWT)</div>
          <textarea id="tx_token" readonly
            style="width:100%;height:110px;resize:none;background:#050508;color:#e2e8f0;border:1px solid #27272a;border-radius:8px;padding:10px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;font-size:12px;"></textarea>
          <div style="margin-top:10px;display:flex;gap:10px;align-items:center;">
            <button id="tx_copy"
              style="background:#E10600;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;">
              Copy token
            </button>
            <span id="tx_copy_status" style="font-size:12px;color:#a1a1aa;"></span>
          </div>
          <div style="margin-top:10px;font-size:12px;color:#a1a1aa;">
            Use this token in the desktop app via <code>TELEMETRYX_API_TOKEN</code>.
          </div>
        </div>

        <script>
          const payload = {data};
          const tokenEl = document.getElementById("tx_token");
          const copyBtn = document.getElementById("tx_copy");
          const copyStatus = document.getElementById("tx_copy_status");
          if (tokenEl) tokenEl.value = String(payload.token || "");
          if (copyBtn) {{
            copyBtn.addEventListener("click", async () => {{
              try {{
                await navigator.clipboard.writeText(String(payload.token || ""));
                if (copyStatus) copyStatus.textContent = "Copied.";
              }} catch (e) {{
                if (copyStatus) copyStatus.textContent = "Copy failed; select text manually.";
              }}
            }});
          }}
          let posted = false;
          try {{
            if (window.opener) {{
              window.opener.postMessage(payload, "{origin_value}");
              posted = true;
            }}
          }} catch (e) {{}}
          // If a popup opener exists we can close quickly; otherwise keep the page open so the user can copy the token.
          if (posted) {{
            setTimeout(() => window.close(), 500);
          }}
        </script>
      </body>
    </html>
    """


@router.post("/auth/register")
async def register(payload: Dict[str, Any]) -> Dict[str, Any]:
    email = str(payload.get("email") or "").lower().strip()
    password = str(payload.get("password") or "")
    if "@" not in email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    if _get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    salt_hex = secrets.token_bytes(16).hex()
    password_hash = _hash_password(password, salt_hex)

    conn = _db()
    try:
        now = int(time.time())
        cur = conn.execute(
            "INSERT INTO users(email, password_hash, salt, created_at) VALUES(?, ?, ?, ?)",
            (email, password_hash, salt_hex, now),
        )
        if cur.lastrowid is None:
            raise HTTPException(status_code=500, detail="Failed to create user")
        conn.commit()
    finally:
        conn.close()

    return {"ok": True}


@router.post("/auth/login")
async def login(payload: Dict[str, Any]) -> Dict[str, Any]:
    email = str(payload.get("email") or "").lower().strip()
    password = str(payload.get("password") or "")
    user = _get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expected = user["password_hash"]
    got = _hash_password(password, user["salt"])
    if not hmac.compare_digest(expected, got):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now = int(time.time())
    exp = now + 24 * 60 * 60
    token = _sign({"sub": user["id"], "email": user["email"], "iat": now, "exp": exp})
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": exp - now,
    }


@router.get("/auth/oauth/{provider}/start")
async def oauth_start(
    provider: str, origin: Optional[str] = Query(default="")
) -> Dict[str, Any]:
    config = _oauth_config(provider)
    if not config.get("client_id"):
        raise HTTPException(status_code=500, detail=f"{provider} OAuth not configured")
    state = _store_oauth_state(provider, origin or "")

    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    url = f"{config['auth_url']}?{urllib.parse.urlencode(params)}"
    return {"auth_url": url, "state": state}


@router.get("/auth/oauth/google/callback", response_class=HTMLResponse)
async def oauth_google_callback(code: str, state: str) -> HTMLResponse:
    record = _pop_oauth_state(state)
    if record.get("provider") != "google":
        raise HTTPException(status_code=400, detail="Provider mismatch")
    config = _oauth_config("google")
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            config["token_url"],
            data={
                "code": code,
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "redirect_uri": config["redirect_uri"],
                "grant_type": "authorization_code",
            },
        )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Google token exchange failed")
    token_data = res.json()
    id_token = token_data.get("id_token")
    if not id_token:
        raise HTTPException(status_code=401, detail="Missing Google id_token")
    payload = await _verify_google_id_token(id_token, config["client_id"])
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google account missing email")
    user_id, normalized = _ensure_user(str(email))
    token = _issue_token(user_id, normalized)
    return HTMLResponse(
        _oauth_result_html(
            {"token": token["access_token"], "email": normalized, "provider": "google"},
            record.get("origin", ""),
        )
    )


@router.get("/auth/me")
async def me(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = require_user(authorization)
    return {"email": user["email"]}
