from __future__ import annotations

import mimetypes
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..cache import cache_get, cache_set
from ..config import MEDIA_CACHE_DIR
from ..utils import display_session_code, normalize_key, normalize_session_code
from . import sessions as sessions_router

router = APIRouter()

_ALLOWED_YEAR_MIN = 2018
_ALLOWED_YEAR_MAX = 2025
_CATALOG_TTL_S = 24 * 3600
_IMAGE_TIMEOUT_S = 20.0
_API_TIMEOUT_S = 20.0
_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg"}


def _api_sports_base_url() -> str:
    return os.getenv("APISPORTS_FORMULA1_BASE_URL", "https://v1.formula-1.api-sports.io").rstrip("/")


def _get_api_key() -> Optional[str]:
    value = (
        os.getenv("APISPORTS_API_KEY")
        or os.getenv("API_SPORTS_KEY")
        or os.getenv("X_APISPORTS_KEY")
        or ""
    ).strip()
    return value or None


def _catalog_root(year: int) -> Path:
    return MEDIA_CACHE_DIR / "api_sports" / "formula1" / str(int(year))


def _safe_slug(value: str) -> str:
    key = normalize_key(value).replace(" ", "_")
    key = re.sub(r"[^a-z0-9_]+", "", key)
    return key or "unknown"


def _parse_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        return int(str(value).strip())
    except Exception:
        return None


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _pick_str(*values: Any) -> Optional[str]:
    for value in values:
        text = _as_str(value)
        if text:
            return text
    return None


def _extract_records(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict) and isinstance(payload.get("response"), list):
        return [item for item in payload["response"] if isinstance(item, dict)]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def _driver_catalog_items(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in records:
        driver = row.get("driver") if isinstance(row.get("driver"), dict) else row
        team = row.get("team") if isinstance(row.get("team"), dict) else {}

        number = _parse_int(
            driver.get("number") if isinstance(driver, dict) else None
        )
        name = _pick_str(
            driver.get("name") if isinstance(driver, dict) else None,
            row.get("driver_name"),
            row.get("name"),
        )
        driver_image = _pick_str(
            driver.get("image") if isinstance(driver, dict) else None,
            driver.get("photo") if isinstance(driver, dict) else None,
            row.get("image"),
            row.get("photo"),
        )
        team_name = _pick_str(
            team.get("name") if isinstance(team, dict) else None,
            row.get("team_name"),
            row.get("team"),
        )
        team_image = _pick_str(
            team.get("logo") if isinstance(team, dict) else None,
            team.get("image") if isinstance(team, dict) else None,
            row.get("logo"),
        )
        if not name and number is None:
            continue

        out.append(
            {
                "name": name,
                "name_key": normalize_key(name or ""),
                "number": number,
                "driver_image": driver_image,
                "team_name": team_name,
                "team_name_key": normalize_key(team_name or ""),
                "team_image": team_image,
            }
        )
    return out


def _team_catalog_items(records: List[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for row in records:
        team = row.get("team") if isinstance(row.get("team"), dict) else row
        name = _pick_str(
            team.get("name") if isinstance(team, dict) else None,
            row.get("team_name"),
            row.get("name"),
        )
        logo = _pick_str(
            team.get("logo") if isinstance(team, dict) else None,
            team.get("image") if isinstance(team, dict) else None,
            row.get("logo"),
            row.get("image"),
        )
        if name and logo:
            out[normalize_key(name)] = logo
    return out


async def _fetch_api_sports_json(
    client: httpx.AsyncClient,
    endpoint: str,
    params: Dict[str, Any],
    api_key: str,
) -> Any:
    url = f"{_api_sports_base_url()}/{endpoint.lstrip('/')}"
    headers = {
        "x-apisports-key": api_key,
        "Accept": "application/json",
    }
    response = await client.get(url, params=params, headers=headers)
    if response.status_code in {401, 403}:
        raise HTTPException(status_code=502, detail="API-Sports authentication failed")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"API-Sports request failed ({response.status_code})")
    return response.json()


async def _fetch_catalog_records(
    client: httpx.AsyncClient,
    year: int,
    endpoint: str,
    api_key: str,
) -> List[Dict[str, Any]]:
    candidates = [
        {"season": int(year)},
        {"year": int(year)},
        {"competition": 1, "season": int(year)},
    ]
    for params in candidates:
        try:
            payload = await _fetch_api_sports_json(client, endpoint, params, api_key)
        except HTTPException as exc:
            if "authentication failed" in str(exc.detail).lower():
                raise
            continue
        records = _extract_records(payload)
        if records:
            return records
    return []


def _stale(path: Path, max_age_s: float) -> bool:
    if not path.exists():
        return True
    try:
        return (time.time() - path.stat().st_mtime) > max_age_s
    except Exception:
        return True


def _read_json(path: Path) -> Any:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Any) -> None:
    import json

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _download_extension(url: str, content_type: Optional[str]) -> str:
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    if suffix in _ALLOWED_IMAGE_EXTENSIONS:
        return suffix
    ctype = _as_str(content_type).split(";")[0].strip().lower()
    guessed = mimetypes.guess_extension(ctype) or ""
    if guessed in _ALLOWED_IMAGE_EXTENSIONS:
        return guessed
    return ".png"


async def _download_image(
    client: httpx.AsyncClient,
    source_url: str,
    target_dir: Path,
    base_name: str,
) -> Optional[Path]:
    url = _as_str(source_url)
    if not (url.startswith("http://") or url.startswith("https://")):
        return None

    target_dir.mkdir(parents=True, exist_ok=True)
    for ext in _ALLOWED_IMAGE_EXTENSIONS:
        existing = target_dir / f"{base_name}{ext}"
        if existing.exists():
            return existing

    response = await client.get(url)
    if response.status_code >= 400:
        return None
    content = response.content
    if not content or len(content) > _MAX_IMAGE_BYTES:
        return None

    ext = _download_extension(url, response.headers.get("content-type"))
    file_path = target_dir / f"{base_name}{ext}"
    tmp_path = file_path.with_suffix(file_path.suffix + ".tmp")
    tmp_path.write_bytes(content)
    tmp_path.replace(file_path)
    return file_path


def _find_driver_match(items: List[Dict[str, Any]], driver_name: str, driver_number: Optional[int]) -> Optional[Dict[str, Any]]:
    number = _parse_int(driver_number)
    name_key = normalize_key(driver_name)
    if number is not None:
        for item in items:
            if _parse_int(item.get("number")) == number:
                return item
    if name_key:
        for item in items:
            if item.get("name_key") == name_key:
                return item
    if name_key:
        target_tokens = set(name_key.split())
        for item in items:
            tokens = set(str(item.get("name_key") or "").split())
            if target_tokens and tokens and target_tokens.issubset(tokens):
                return item
    return None


@router.get("/assets/identity/{year}/{race}/{session}")
async def get_identity_assets(
    year: int,
    race: str,
    session: str,
    force_refresh: bool = Query(default=False),
) -> Dict[str, Any]:
    race_name = race.replace("-", " ").strip()
    session_code = normalize_session_code(session)
    cache_key = ("identity_assets", int(year), normalize_key(race_name), session_code, int(bool(force_refresh)))

    if not force_refresh:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

    if year < _ALLOWED_YEAR_MIN or year > _ALLOWED_YEAR_MAX:
        return cache_set(
            cache_key,
            {
                "year": int(year),
                "race": race_name,
                "session": display_session_code(session_code),
                "enabled": False,
                "reason": f"Image enrichment is allowed only for {_ALLOWED_YEAR_MIN}-{_ALLOWED_YEAR_MAX}",
                "drivers": [],
            },
        )

    api_key = _get_api_key()
    if not api_key:
        return cache_set(
            cache_key,
            {
                "year": int(year),
                "race": race_name,
                "session": display_session_code(session_code),
                "enabled": False,
                "reason": "Missing API-Sports key (set APISPORTS_API_KEY)",
                "drivers": [],
            },
        )

    session_path = sessions_router.get_session_path(int(year), race_name, session_code)
    if not session_path:
        raise HTTPException(status_code=404, detail="Session not found")

    session_drivers = sessions_router.load_drivers(session_path, year=int(year))
    if not session_drivers:
        return cache_set(
            cache_key,
            {
                "year": int(year),
                "race": race_name,
                "session": display_session_code(session_code),
                "enabled": True,
                "reason": "No session drivers available",
                "drivers": [],
            },
        )

    root = _catalog_root(int(year))
    drivers_catalog_file = root / "drivers_catalog.json"
    teams_catalog_file = root / "teams_catalog.json"

    try:
        async with httpx.AsyncClient(timeout=_API_TIMEOUT_S, follow_redirects=True) as client:
            if force_refresh or _stale(drivers_catalog_file, _CATALOG_TTL_S):
                driver_records = await _fetch_catalog_records(client, int(year), "drivers", api_key)
                _write_json(drivers_catalog_file, driver_records)
            else:
                driver_records = _read_json(drivers_catalog_file)

            if force_refresh or _stale(teams_catalog_file, _CATALOG_TTL_S):
                team_records = await _fetch_catalog_records(client, int(year), "teams", api_key)
                _write_json(teams_catalog_file, team_records)
            else:
                team_records = _read_json(teams_catalog_file)

            driver_items = _driver_catalog_items(_extract_records(driver_records))
            team_items = _team_catalog_items(_extract_records(team_records))

            media_drivers_dir = root / "drivers"
            media_teams_dir = root / "teams"

            enriched: List[Dict[str, Any]] = []
            for driver in session_drivers:
                driver_number = _parse_int(driver.get("driverNumber"))
                driver_name = _as_str(driver.get("driverName"))
                team_name = _as_str(driver.get("teamName"))

                match = _find_driver_match(driver_items, driver_name, driver_number)
                team_key = normalize_key(team_name)
                remote_driver_image = _pick_str(match.get("driver_image") if match else None)
                remote_team_image = _pick_str(
                    match.get("team_image") if match else None,
                    team_items.get(team_key),
                )

                driver_image_url = None
                if remote_driver_image:
                    candidate_name = driver_name or (str(match.get("name")) if match else "") or "driver"
                    base = f"{driver_number or 0}_{_safe_slug(candidate_name)}"
                    path = await _download_image(client, remote_driver_image, media_drivers_dir, base)
                    if path:
                        driver_image_url = f"/api/v1/assets/media/{int(year)}/drivers/{path.name}"

                team_image_url = None
                if remote_team_image:
                    base = _safe_slug(team_name or (match.get("team_name") if match else "team"))
                    path = await _download_image(client, remote_team_image, media_teams_dir, base)
                    if path:
                        team_image_url = f"/api/v1/assets/media/{int(year)}/teams/{path.name}"

                enriched.append(
                    {
                        "driverNumber": driver_number,
                        "driverName": driver_name,
                        "teamName": team_name,
                        "driverImage": driver_image_url,
                        "teamImage": team_image_url,
                    }
                )
    except HTTPException as exc:
        return cache_set(
            cache_key,
            {
                "year": int(year),
                "race": race_name,
                "session": display_session_code(session_code),
                "enabled": False,
                "reason": str(exc.detail),
                "drivers": [],
            },
        )
    except Exception as exc:
        return cache_set(
            cache_key,
            {
                "year": int(year),
                "race": race_name,
                "session": display_session_code(session_code),
                "enabled": False,
                "reason": f"Image enrichment failed: {exc}",
                "drivers": [],
            },
        )

    payload = {
        "year": int(year),
        "race": race_name,
        "session": display_session_code(session_code),
        "enabled": True,
        "reason": None,
        "source": "api-sports",
        "drivers": enriched,
        "n_driver_images": sum(1 for item in enriched if item.get("driverImage")),
        "n_team_images": sum(1 for item in enriched if item.get("teamImage")),
    }
    return cache_set(cache_key, payload)


@router.get("/assets/media/{year}/{kind}/{filename}")
async def get_cached_media(year: int, kind: str, filename: str) -> FileResponse:
    media_kind = _as_str(kind).lower()
    if media_kind not in {"drivers", "teams"}:
        raise HTTPException(status_code=404, detail="Media type not found")
    safe_name = Path(_as_str(filename)).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = _catalog_root(int(year)) / media_kind / safe_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Media file not found")

    return FileResponse(path=str(path), filename=safe_name)
