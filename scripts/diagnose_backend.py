#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


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


def _load_backend_client() -> Any:
    # Backward compatibility: older repo layouts exposed TelemetryXBackend from frontend/app.
    # Fall back to a local lightweight client when that package is not present.
    sys.path.insert(0, str(_repo_root()))
    sys.path.insert(0, str(_repo_root() / "frontend"))
    try:
        from app.services.api.telemetryx_backend import TelemetryXBackend  # type: ignore # noqa: E402

        return TelemetryXBackend()
    except Exception:
        return _CompatBackendClient()


@dataclass
class _CompatConfig:
    base_url: str
    token: str


class _CompatBackendClient:
    def __init__(self) -> None:
        self.config = _CompatConfig(
            base_url=_base_url(),
            token=os.getenv("TELEMETRYX_API_TOKEN", "").strip(),
        )
        self._mode = "http"
        self._inproc = None
        self._http = None

        requested_mode = os.getenv("TELEMETRYX_BACKEND_MODE", "").strip().lower()
        if requested_mode == "inproc":
            self._inproc = self._build_inproc_client()
            self._mode = "inproc"
        else:
            import httpx

            self._http = httpx.Client(timeout=10.0)

    def _build_inproc_client(self) -> Any:
        from starlette.testclient import TestClient
        from backend.main import app

        return TestClient(app)

    def _path(self, path: str) -> str:
        clean = "/" + str(path or "").lstrip("/")
        if clean.startswith("/api/v1/") or clean == "/api/v1":
            return clean
        return f"/api/v1{clean}"

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        if self._mode == "inproc":
            if self._inproc is None:
                raise RuntimeError("in-process backend client is not initialized")
            resp = self._inproc.get(self._path(path), params=params)
        else:
            if self._http is None:
                raise RuntimeError("http backend client is not initialized")
            headers: Dict[str, str] = {}
            if self.config.token:
                headers["Authorization"] = f"Bearer {self.config.token}"
            url = f"{self.config.base_url.rstrip('/')}/{str(path).lstrip('/')}"
            resp = self._http.get(url, params=params, headers=headers)

        if getattr(resp, "status_code", 0) >= 400:
            detail = ""
            try:
                detail = (resp.text or "").strip()
            except Exception:
                pass
            raise RuntimeError(f"GET {path} failed with {resp.status_code}: {detail[:240]}")

        try:
            return resp.json()
        except Exception:
            return json.loads(resp.text or "{}")

    def seasons(self) -> Any:
        return self._get("/seasons")

    def races_for_year(self, year: int) -> Any:
        return self._get(f"/seasons/{int(year)}/races")

    def close(self) -> None:
        try:
            if self._http is not None:
                self._http.close()
        except Exception:
            pass
        try:
            if self._inproc is not None:
                self._inproc.close()
        except Exception:
            pass


def _session_list(raw: str) -> List[str]:
    seen = set()
    out: List[str] = []
    for piece in str(raw or "").split(","):
        code = str(piece or "").strip().upper()
        if not code or code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out or ["R", "SR", "Q"]


def _race_name_from_row(row: Any) -> str:
    if not isinstance(row, dict):
        return ""
    for key in ("name", "race_name", "raceName", "round_name"):
        value = row.get(key)
        if value:
            return str(value)
    return ""


def _race_slug(name: str) -> str:
    return str(name or "").strip().replace(" ", "-")


def _api_get(backend: Any, path: str, params: Optional[Dict[str, Any]] = None) -> Tuple[bool, Any]:
    try:
        return True, backend._get(path, params=params)  # noqa: SLF001
    except Exception as e:
        return False, repr(e)


def _choose_driver_token(dr: Any) -> str:
    if not isinstance(dr, dict):
        return ""
    num = dr.get("driver_number")
    if num is not None and str(num).strip() != "":
        return str(num)
    name = dr.get("driver")
    return str(name or "")


def _print_matrix_checklist(sessions: Sequence[str]) -> None:
    print("QA_MATRIX")
    print("  Use one race with available data per session.")
    for session in sessions:
        print(f"  - {session}: playback -> tab switch -> compare -> seek")
    print("  - playback: open session and verify timeline scrubs")
    print("  - tab switch: timing <-> telemetry <-> track <-> strategy <-> features")
    print("  - compare: set primary + compare driver and verify overlays")
    print("  - seek: jump to >=2 distant timestamps and confirm data refresh")


def _run_release_gate(
    backend: Any,
    sessions: Sequence[str],
    year_hint: Optional[int],
    race_hint: Optional[str],
    max_races_scan: int,
    print_checklist: bool,
) -> int:
    failures = 0
    checks = 0
    if print_checklist:
        _print_matrix_checklist(sessions)

    ok_seasons, seasons_or_err = _api_get(backend, "/seasons")
    checks += 1
    if not ok_seasons or not isinstance(seasons_or_err, list):
        print("GATE FAIL seasons", seasons_or_err)
        return 1

    info = _summarize_seasons(seasons_or_err)
    years = info.get("years_head") or []
    year = int(year_hint) if year_hint else (int(years[0]) if years else None)
    if not year:
        print("GATE FAIL no seasons available")
        return 1
    print("GATE YEAR", year)

    ok_races, races_or_err = _api_get(backend, f"/seasons/{year}/races")
    checks += 1
    races = races_or_err if ok_races and isinstance(races_or_err, list) else []
    if not races:
        print("GATE FAIL races", races_or_err)
        return 1

    race_names = [name for name in (_race_name_from_row(r) for r in races) if name]
    if not race_names:
        print("GATE FAIL no race names in races payload")
        return 1

    for session in sessions:
        session_code = str(session).upper()
        race_candidates = [str(race_hint)] if race_hint else race_names[: max(1, int(max_races_scan))]
        selected_race = ""
        viz_payload: Dict[str, Any] = {}

        for race_name in race_candidates:
            slug = _race_slug(race_name)
            ok_viz, viz_or_err = _api_get(
                backend,
                f"/sessions/{year}/{slug}/{session_code}/viz",
                params={
                    "include_positions": "0",
                    "include_weather": "0",
                    "include_race_control": "0",
                },
            )
            checks += 1
            if ok_viz and isinstance(viz_or_err, dict):
                selected_race = race_name
                viz_payload = viz_or_err
                break

        if not selected_race:
            failures += 1
            print(f"GATE FAIL session={session_code} could not find race with session data")
            continue

        slug = _race_slug(selected_race)
        print(f"GATE SESSION {session_code} race={selected_race}")

        if not isinstance(viz_payload.get("metadata"), dict):
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=playback missing metadata")
        else:
            print(f"GATE PASS session={session_code} workflow=playback")

        ok_laps, laps_or_err = _api_get(
            backend,
            f"/laps/{year}/{slug}/summary",
            params={"session_type": session_code},
        )
        checks += 1
        if not ok_laps or not isinstance(laps_or_err, dict):
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=tab-switch endpoint=laps.summary detail={laps_or_err}")
        else:
            print(f"GATE PASS session={session_code} workflow=tab-switch endpoint=laps.summary")

        ok_features, features_or_err = _api_get(backend, f"/features/{year}/{slug}/{session_code}")
        checks += 1
        if not ok_features or not isinstance(features_or_err, dict):
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=tab-switch endpoint=features detail={features_or_err}")
        else:
            print(f"GATE PASS session={session_code} workflow=tab-switch endpoint=features")

        ok_drivers, drivers_or_err = _api_get(
            backend,
            f"/drivers/{year}/{slug}",
            params={"session_type": session_code, "limit": 20},
        )
        checks += 1
        drivers = drivers_or_err if ok_drivers and isinstance(drivers_or_err, list) else []
        if not drivers:
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=compare endpoint=drivers detail={drivers_or_err}")
            continue

        primary = _choose_driver_token(drivers[0])
        compare = _choose_driver_token(drivers[1]) if len(drivers) > 1 else ""
        if not primary:
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=compare missing primary driver token")
            continue

        ok_selection, selection_or_err = _api_get(
            backend,
            f"/laps/{year}/{slug}/{primary}/selection",
            params={"session_type": session_code},
        )
        checks += 1
        if not ok_selection or not isinstance(selection_or_err, dict):
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=compare endpoint=lap-selection detail={selection_or_err}")
        else:
            print(f"GATE PASS session={session_code} workflow=compare endpoint=lap-selection")

        if compare:
            ok_h2h, h2h_or_err = _api_get(
                backend,
                f"/laps/{year}/{slug}/head-to-head",
                params={"driver1": primary, "driver2": compare, "session_type": session_code},
            )
            checks += 1
            if not ok_h2h:
                detail = str(h2h_or_err or "")
                # Sprint-like sessions can legitimately miss two comparable valid laps.
                if "Could not find both drivers with valid laps" in detail:
                    print(
                        f"GATE WARN session={session_code} workflow=compare endpoint=head-to-head "
                        "insufficient comparable laps"
                    )
                else:
                    failures += 1
                    print(f"GATE FAIL session={session_code} workflow=compare endpoint=head-to-head detail={h2h_or_err}")
            elif not isinstance(h2h_or_err, dict):
                failures += 1
                print(f"GATE FAIL session={session_code} workflow=compare endpoint=head-to-head detail={h2h_or_err}")
            else:
                print(f"GATE PASS session={session_code} workflow=compare endpoint=head-to-head")

        for t0, t1 in ((0, 45), (240, 285)):
            ok_tel, tel_or_err = _api_get(
                backend,
                f"/sessions/{year}/{slug}/{session_code}/telemetry",
                params={"hz": 1.0, "t0": float(t0), "t1": float(t1)},
            )
            checks += 1
            if not ok_tel or not isinstance(tel_or_err, dict):
                failures += 1
                print(
                    f"GATE FAIL session={session_code} workflow=seek endpoint=telemetry window={t0}-{t1} detail={tel_or_err}"
                )
                continue
            print(f"GATE PASS session={session_code} workflow=seek endpoint=telemetry window={t0}-{t1}")

        ok_positions, pos_or_err = _api_get(
            backend,
            f"/sessions/{year}/{slug}/{session_code}/positions",
            params={"hz": 1.0, "t0": 120.0, "t1": 160.0},
        )
        checks += 1
        if not ok_positions or not isinstance(pos_or_err, list):
            failures += 1
            print(f"GATE FAIL session={session_code} workflow=seek endpoint=positions detail={pos_or_err}")
        else:
            print(f"GATE PASS session={session_code} workflow=seek endpoint=positions")

    print(f"GATE SUMMARY checks={checks} failures={failures}")
    return 1 if failures else 0


def _run_basic_diagnose(backend: Any) -> int:
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


def main() -> int:
    parser = argparse.ArgumentParser(description="TelemetryX backend diagnostics and lightweight release gate checks")
    parser.add_argument("--release-gate", action="store_true", help="Run R/SR/Q consistency checks for Phase 6 workflows")
    parser.add_argument("--sessions", default="R,SR,Q", help="Comma-separated session matrix (default: R,SR,Q)")
    parser.add_argument("--year", type=int, default=None, help="Year override for release gate")
    parser.add_argument("--race", default=None, help="Race name/slug override for release gate")
    parser.add_argument("--max-races-scan", type=int, default=8, help="How many races to scan when finding data per session")
    parser.add_argument("--print-checklist", action="store_true", help="Print manual QA matrix checklist text")
    args = parser.parse_args()

    _load_env()
    backend = _load_backend_client()
    if args.release_gate:
        sessions = _session_list(args.sessions)
        try:
            return _run_release_gate(
                backend=backend,
                sessions=sessions,
                year_hint=args.year,
                race_hint=args.race,
                max_races_scan=args.max_races_scan,
                print_checklist=bool(args.print_checklist),
            )
        finally:
            backend.close()
    return _run_basic_diagnose(backend)


if __name__ == "__main__":
    raise SystemExit(main())
