#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_env() -> None:
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(_repo_root() / ".env")
    except Exception:
        pass


def _base_url() -> str:
    base = os.getenv("TELEMETRYX_API_BASE_URL", "").strip()
    if base:
        return base.rstrip("/")

    port_file = _repo_root() / ".telemetryx_port"
    if port_file.exists():
        try:
            raw = port_file.read_text(encoding="utf-8").strip()
            if raw.isdigit():
                return f"http://localhost:{int(raw)}/api/v1"
        except Exception:
            pass
    return "http://localhost:9010/api/v1"


def _health_url(base_url: str) -> str:
    base = (base_url or "").rstrip("/")
    if base.endswith("/api/v1"):
        base = base[: -len("/api/v1")]
    return f"{base}/health"


def _snippet(text: str, n: int = 200) -> str:
    txt = (text or "").strip().replace("\n", " ")
    if len(txt) <= n:
        return txt
    return txt[:n] + "…"


def _try_http_health(base_url: str) -> Tuple[Optional[int], str]:
    try:
        import httpx

        r = httpx.get(_health_url(base_url), timeout=2)
        return r.status_code, _snippet(r.text, 160)
    except Exception as e:
        return None, repr(e)


def _try_inproc_health(client: Any) -> Tuple[Optional[int], str]:
    try:
        r = client.get("/health")
        return getattr(r, "status_code", None), _snippet(getattr(r, "text", "") or "", 160)
    except Exception as e:
        return None, repr(e)


def _summarize_seasons(seasons: Any) -> Dict[str, Any]:
    years = []
    if isinstance(seasons, list):
        for s in seasons:
            if isinstance(s, dict) and isinstance(s.get("year"), int):
                years.append(int(s["year"]))
    years = sorted(set(years), reverse=True)
    return {"n": len(years), "years_head": years[:10]}


def main() -> int:
    _load_env()
    # Ensure both the desktop package (`frontend/app` via `frontend/`) and backend package (`backend/`)
    # are importable when running this script directly.
    sys.path.insert(0, str(_repo_root()))
    sys.path.insert(0, str(_repo_root() / "frontend"))

    from app.services.api.telemetryx_backend import TelemetryXBackend  # noqa: E402

    backend = TelemetryXBackend()
    try:
        base = backend.config.base_url.rstrip("/")
        mode = getattr(backend, "_mode", "http")
        has_token = bool(getattr(backend.config, "token", "") or "")

        print("MODE", mode)
        print("BASE", base)
        print("TOKEN", "set" if has_token else "missing")

        if mode == "inproc":
            code, body = _try_inproc_health(getattr(backend, "_inproc", None))
            print("HEALTH", code, body)
        else:
            code, body = _try_http_health(base)
            print("HEALTH", code, body)

        try:
            seasons = backend.seasons()
            info = _summarize_seasons(seasons)
            print("SEASONS", json.dumps(info, ensure_ascii=False))
        except Exception as e:
            print("SEASONS_ERROR", repr(e))
            return 1

        try:
            years = info.get("years_head") or []
            year = int(years[0]) if years else None
        except Exception:
            year = None

        if year:
            try:
                races = backend.races_for_year(year)
                try:
                    races = sorted(
                        [r for r in (races or []) if isinstance(r, dict)],
                        key=lambda r: (
                            str(r.get("startDate") or "9999"),
                            str(r.get("name") or r.get("race_name") or ""),
                        ),
                    )
                except Exception:
                    pass
                names = []
                if isinstance(races, list):
                    for r in races[:10]:
                        if isinstance(r, dict) and r.get("name"):
                            names.append(str(r.get("name")))
                print("RACES", json.dumps({"year": year, "n": len(races or []), "head": names}, ensure_ascii=False))
            except Exception as e:
                print("RACES_ERROR", repr(e))

        return 0
    finally:
        backend.close()


if __name__ == "__main__":
    raise SystemExit(main())
