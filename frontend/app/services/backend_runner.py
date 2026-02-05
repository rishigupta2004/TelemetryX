"""Optionally start the local TelemetryX backend automatically.

This keeps the UX to a single command for the desktop app.
"""

from __future__ import annotations

import os
import socket
import threading
import time
from typing import Optional
from urllib.parse import urlparse
from pathlib import Path

import httpx


def _port_from_file() -> Optional[int]:
    try:
        repo_root = Path(__file__).resolve().parents[4]
        p = repo_root / ".telemetryx_port"
        if not p.exists():
            return None
        raw = p.read_text(encoding="utf-8").strip()
        if not raw.isdigit():
            return None
        port = int(raw)
        if 1 <= port <= 65535:
            return port
    except Exception:
        return None
    return None


def _effective_base_url() -> str:
    env = os.getenv("TELEMETRYX_API_BASE_URL")
    if env:
        return env.rstrip("/")
    port = _port_from_file()
    if port is None:
        try:
            port = int(os.getenv("PORT", "9010"))
        except Exception:
            port = 9010
    return f"http://localhost:{port}/api/v1"


def _health_url() -> str:
    base = _effective_base_url().rstrip("/")
    # Backend health is mounted at root, not under /api/v1
    if base.endswith("/api/v1"):
        base = base[: -len("/api/v1")]
    return f"{base}/health"


def _is_local_backend() -> bool:
    base = _effective_base_url()
    try:
        host = (urlparse(base).hostname or "").lower()
    except Exception:
        host = ""
    return host in {"localhost", "127.0.0.1"}


def _start_backend_thread(port: int) -> None:
    def _run():
        try:
            import sys
            from pathlib import Path

            # Ensure repo root is importable so `backend.main` works when running from frontend package context.
            repo_root = str(Path(__file__).resolve().parents[3])
            if repo_root not in sys.path:
                sys.path.insert(0, repo_root)

            import uvicorn

            uvicorn.run("backend.main:app", host="127.0.0.1", port=port, log_level="warning")
        except Exception:
            # Best-effort; caller will treat backend as unavailable.
            return

    threading.Thread(target=_run, daemon=True).start()


def ensure_backend_running(timeout_s: float = 3.0) -> bool:
    """Return True if backend is reachable; otherwise try to start it and re-check."""
    # In-process backend (no TCP server). Used in sandboxed environments and as a fallback when
    # localhost networking is blocked. The API client will use TestClient in this mode.
    if os.getenv("TELEMETRYX_BACKEND_MODE", "").strip().lower() == "inproc":
        return True

    url = _health_url()

    def _ok() -> bool:
        try:
            r = httpx.get(url, timeout=0.5)
            return r.status_code == 200
        except Exception:
            return False

    if _ok():
        return True

    # Remote backend: never try to autostart a local server.
    if not _is_local_backend():
        return False

    if os.getenv("TELEMETRYX_AUTOSTART_BACKEND", "1") != "1":
        return False

    # If localhost connections are blocked but imports work, fall back to running the backend
    # in-process (no networking). This keeps the desktop usable even when TCP is restricted.
    if os.getenv("TELEMETRYX_BACKEND_FALLBACK_INPROC", "1") == "1":
        try:
            from backend.main import app  # type: ignore
            from starlette.testclient import TestClient  # type: ignore

            c = TestClient(app)
            r = c.get("/health")
            if getattr(r, "status_code", 0) == 200:
                os.environ["TELEMETRYX_BACKEND_MODE"] = "inproc"
                return True
        except Exception:
            pass

    # Some environments disallow binding/listening sockets entirely. In that case, run the backend
    # in-process (no TCP) and let the API client use TestClient.
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            probe.bind(("127.0.0.1", 0))
        finally:
            probe.close()
    except PermissionError:
        os.environ["TELEMETRYX_BACKEND_MODE"] = "inproc"
        return True
    except Exception:
        # Ignore and continue with normal startup.
        pass

    port = int(os.getenv("PORT", "9010"))
    _start_backend_thread(port)

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if _ok():
            return True
        time.sleep(0.1)
    return False
