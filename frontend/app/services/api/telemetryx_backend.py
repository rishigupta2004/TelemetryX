"""Tiny sync client for the local TelemetryX backend (FastAPI).

Keep this intentionally small: the GUI calls the backend and renders JSON.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx


def _port_from_file() -> Optional[int]:
    try:
        repo_root = Path(__file__).resolve().parents[5]
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


def _default_base_url() -> str:
    env = os.getenv("TELEMETRYX_API_BASE_URL")
    if env:
        return env
    port = _port_from_file()
    if port is None:
        try:
            port = int(os.getenv("PORT", "9010"))
        except Exception:
            port = 9010
    return f"http://localhost:{port}/api/v1"


def _health_url_from_base(base_url: str) -> str:
    base = (base_url or "").rstrip("/")
    if base.endswith("/api/v1"):
        base = base[: -len("/api/v1")]
    return f"{base}/health"


def _is_local_base(base_url: str) -> bool:
    try:
        host = (urlparse(base_url).hostname or "").lower()
    except Exception:
        host = ""
    return host in {"localhost", "127.0.0.1"}


@dataclass(frozen=True)
class TelemetryXBackendConfig:
    base_url: str = field(default_factory=_default_base_url)
    timeout_s: float = field(default_factory=lambda: float(os.getenv("TELEMETRYX_API_TIMEOUT_S", "20")))
    token: str = field(default_factory=lambda: os.getenv("TELEMETRYX_API_TOKEN", ""))
    mode: str = field(default_factory=lambda: os.getenv("TELEMETRYX_BACKEND_MODE", "http"))


class TelemetryXBackend:
    def __init__(self, config: Optional[TelemetryXBackendConfig] = None):
        self.config = config or TelemetryXBackendConfig()
        self._mode = (self.config.mode or "http").strip().lower()
        self._client: Optional[httpx.Client] = None
        self._inproc: Any = None
        try:
            self._path_prefix = (urlparse(self.config.base_url).path or "").rstrip("/")
        except Exception:
            self._path_prefix = ""

        if self._mode == "inproc":
            self._init_inproc()
        else:
            self._client = httpx.Client(timeout=self.config.timeout_s)

            # Local dev fallback: if localhost HTTP isn't reachable (common in sandboxed envs),
            # run the backend in-process instead of hanging the UI.
            if _is_local_base(self.config.base_url) and os.getenv("TELEMETRYX_BACKEND_FALLBACK_INPROC", "1") == "1":
                try:
                    r = self._client.get(_health_url_from_base(self.config.base_url), timeout=0.5)
                    if r.status_code != 200:
                        raise RuntimeError(f"health {r.status_code}")
                except Exception:
                    try:
                        self._mode = "inproc"
                        self._init_inproc()
                    except Exception:
                        self._mode = "http"

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
        self._client = None
        self._inproc = None

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        headers: Dict[str, str] = {}
        if self.config.token:
            headers["Authorization"] = f"Bearer {self.config.token}"

        if self._mode == "inproc":
            full_path = f"{self._path_prefix}/{path.lstrip('/')}" if self._path_prefix else path
            if not full_path.startswith("/"):
                full_path = "/" + full_path
            r = self._inproc.get(full_path, params=params or None, headers=headers or None)
            if getattr(r, "status_code", 0) >= 400:
                raise RuntimeError(f"Backend error {r.status_code}: {getattr(r, 'text', '')}")
            return r.json()

        url = f"{self.config.base_url.rstrip('/')}/{path.lstrip('/')}"
        if self._client is None:
            self._client = httpx.Client(timeout=self.config.timeout_s)
        r = self._client.get(url, params=params, headers=headers)
        r.raise_for_status()
        return r.json()

    def _init_inproc(self) -> None:
        # Lazy import to keep the desktop runnable against a remote backend without backend deps.
        from backend.main import app  # type: ignore
        from starlette.testclient import TestClient  # type: ignore

        self._inproc = TestClient(app)

    def seasons(self) -> List[Dict[str, Any]]:
        return self._get("/seasons")

    def races_for_year(self, year: int) -> List[Dict[str, Any]]:
        return self._get(f"/seasons/{year}/races")

    def session_viz(self, year: int, race_name: str, session: str) -> Dict[str, Any]:
        race_slug = race_name.replace(" ", "-")
        return self._get(f"/sessions/{year}/{race_slug}/{session}/viz")

    def tyre_features(self, year: int, race_name: str, session: str) -> List[Dict[str, Any]]:
        race_slug = race_name.replace(" ", "-")
        return self._get(f"/features/{year}/{race_slug}/{session}/tyre")

    def session_features(self, year: int, race_name: str, session: str) -> Dict[str, Any]:
        race_slug = race_name.replace(" ", "-")
        return self._get(f"/features/{year}/{race_slug}/{session}")

    def feature_dataset(self, year: int, race_name: str, session: str, feature_type: str) -> List[Dict[str, Any]]:
        race_slug = race_name.replace(" ", "-")
        ftype = str(feature_type or "").replace("_", "-")
        return self._get(f"/features/{year}/{race_slug}/{session}/{ftype}")

    def driver_summary(self, year: int, race_name: str, session: str, driver: str, compare: str = "") -> Dict[str, Any]:
        race_slug = race_name.replace(" ", "-")
        params: Dict[str, Any] = {"driver": driver}
        if compare:
            params["compare"] = compare
        return self._get(f"/features/{year}/{race_slug}/{session}/driver-summary", params=params)

    def session_telemetry(
        self,
        year: int,
        race_name: str,
        session: str,
        driver_numbers: Optional[List[int]] = None,
        hz: float = 1.0,
        t0: Optional[float] = None,
        t1: Optional[float] = None,
    ) -> Dict[str, Any]:
        race_slug = race_name.replace(" ", "-")
        params: Dict[str, Any] = {"hz": float(hz)}
        if driver_numbers:
            params["drivers"] = ",".join(str(int(x)) for x in driver_numbers)
        if t0 is not None:
            params["t0"] = float(t0)
        if t1 is not None:
            params["t1"] = float(t1)
        return self._get(f"/sessions/{year}/{race_slug}/{session}/telemetry", params=params)

    def session_positions(
        self,
        year: int,
        race_name: str,
        session: str,
        driver_numbers: Optional[List[int]] = None,
        hz: float = 2.0,
        t0: Optional[float] = None,
        t1: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        race_slug = race_name.replace(" ", "-")
        params: Dict[str, Any] = {"hz": float(hz)}
        if driver_numbers:
            params["drivers"] = ",".join(str(int(x)) for x in driver_numbers)
        if t0 is not None:
            params["t0"] = float(t0)
        if t1 is not None:
            params["t1"] = float(t1)
        return self._get(f"/sessions/{year}/{race_slug}/{session}/positions", params=params)

    def session_laps(self, year: int, race_name: str, session: str) -> List[Dict[str, Any]]:
        race_slug = race_name.replace(" ", "-")
        return self._get(f"/sessions/{year}/{race_slug}/{session}/laps")

    def undercut_predict(
        self,
        position_before_pit: int,
        tyre_age: int,
        stint_length: int,
        compound: str,
        track_temp: float = 30.0,
        pit_lap: int = 15,
        race_name: str = "Bahrain Grand Prix",
    ) -> Dict[str, Any]:
        return self._get(
            "/models/undercut/predict",
            params={
                "position_before_pit": position_before_pit,
                "tyre_age": tyre_age,
                "stint_length": stint_length,
                "compound": compound,
                "track_temp": track_temp,
                "pit_lap": pit_lap,
                "race_name": race_name,
            },
        )
