from __future__ import annotations

import datetime as dt
import html
import json
import logging
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..cache import cache_get, cache_set
from ..config import MEDIA_CACHE_DIR
from ..utils import normalize_key

router = APIRouter()
logger = logging.getLogger(__name__)

_FIA_BASE_URL = "https://www.fia.com"
_F1_CHAMPIONSHIP_DOCS_PATH = "/documents/championships/fia-formula-one-world-championship-14"
_DEFAULT_TIMEOUT_S = 6.0
_SEASONS_TTL_S = 24 * 60 * 60
_EVENTS_TTL_S = 6 * 60 * 60
_DOCS_TTL_S = 2 * 60 * 60


def _now_iso() -> str:
    return dt.datetime.utcnow().isoformat() + "Z"


def _file_cache_dir() -> Path:
    path = Path(MEDIA_CACHE_DIR) / "fia_documents"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _file_cache_path(key: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_.-]+", "_", key).strip("_")
    return _file_cache_dir() / f"{safe}.json"


def _read_file_cache(key: str, ttl_s: int) -> Optional[Dict[str, Any]]:
    path = _file_cache_path(key)
    if not path.exists():
        return None
    try:
        age = time.time() - path.stat().st_mtime
        if age > ttl_s:
            return None
        payload = json.loads(path.read_text())
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _write_file_cache(key: str, payload: Dict[str, Any]) -> None:
    path = _file_cache_path(key)
    try:
        path.write_text(json.dumps(payload, ensure_ascii=True))
    except Exception:
        pass


def _abs_url(path_or_url: str) -> str:
    value = str(path_or_url or "").strip()
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if not value.startswith("/"):
        value = "/" + value
    return f"{_FIA_BASE_URL}{value}"


def _strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return " ".join(html.unescape(text).split())


def _extract_select_options(page_html: str, select_id: str) -> List[Tuple[str, str]]:
    select_match = re.search(
        rf"<select[^>]*id=\"{re.escape(select_id)}\"[^>]*>(.*?)</select>",
        page_html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not select_match:
        return []
    body = select_match.group(1)
    options: List[Tuple[str, str]] = []
    for value, label in re.findall(
        r"<option\s+value=\"([^\"]*)\"[^>]*>(.*?)</option>",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        options.append((html.unescape(value).strip(), _strip_html(label)))
    return options


def _parse_season_paths(championship_page_html: str) -> Dict[int, str]:
    out: Dict[int, str] = {}
    for value, label in _extract_select_options(championship_page_html, "facetapi_select_facet_form_3"):
        if not value.startswith("/"):
            continue
        match = re.search(r"\bSEASON\s+(\d{4})\b", label, flags=re.IGNORECASE)
        if not match:
            continue
        out[int(match.group(1))] = value
    if out:
        return out
    # Fallback: capture season options anywhere in the HTML.
    for value, label in re.findall(
        r"<option\s+value=\"([^\"]*/season/season-[^\"]+)\"[^>]*>(.*?)</option>",
        championship_page_html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        match = re.search(r"\bSEASON\s+(\d{4})\b", _strip_html(label), flags=re.IGNORECASE)
        if not match:
            continue
        out[int(match.group(1))] = html.unescape(value).strip()
    return out


def _parse_event_paths(season_page_html: str) -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    for value, label in _extract_select_options(season_page_html, "facetapi_select_facet_form_2"):
        if not value.startswith("/documents/"):
            continue
        if "/event/" not in value:
            continue
        if not label or normalize_key(label) == "event":
            continue
        out.append((label, value))
    if out:
        return out
    # Fallback: scan the whole page for event options/links.
    for value, label in re.findall(
        r"<option\s+value=\"([^\"]*/event/[^\"]+)\"[^>]*>(.*?)</option>",
        season_page_html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        clean_label = _strip_html(label)
        if not clean_label or normalize_key(clean_label) == "event":
            continue
        out.append((clean_label, html.unescape(value).strip()))
    if out:
        return out
    for value, label in re.findall(
        r"<a[^>]+href=\"([^\"]*/event/[^\"]+)\"[^>]*>(.*?)</a>",
        season_page_html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        clean_label = _strip_html(label)
        if not clean_label:
            continue
        out.append((clean_label, html.unescape(value).strip()))
    return out


def _race_signature(value: str) -> str:
    tokens = [tok for tok in normalize_key(value).split() if tok not in {"grand", "prix", "gp", "tests", "season"}]
    return " ".join(tokens)


def _match_event_path(events: List[Tuple[str, str]], race_name: str) -> Optional[Tuple[str, str]]:
    if not events:
        return None
    direct_key = normalize_key(race_name)
    direct_sig = _race_signature(race_name)

    for name, path in events:
        if normalize_key(name) == direct_key:
            return name, path

    for name, path in events:
        if _race_signature(name) and _race_signature(name) == direct_sig:
            return name, path

    return None


def _parse_published_at(raw_value: str, timezone_label: str) -> Tuple[Optional[str], Optional[float]]:
    value = str(raw_value or "").strip()
    if not value:
        return None, None

    try:
        parsed = dt.datetime.strptime(value, "%d.%m.%y %H:%M")
    except ValueError:
        return None, None

    tz_key = str(timezone_label or "").strip().upper()
    tzinfo = None
    if tz_key == "CET":
        tzinfo = dt.timezone(dt.timedelta(hours=1), name="CET")
    elif tz_key == "CEST":
        tzinfo = dt.timezone(dt.timedelta(hours=2), name="CEST")

    if tzinfo is not None:
        parsed = parsed.replace(tzinfo=tzinfo)
        return parsed.isoformat(), parsed.timestamp()

    return parsed.isoformat(), parsed.timestamp()


def _classify_document(title: str) -> str:
    key = normalize_key(title)
    if not key:
        return "other"
    if "technical directive" in key or "td-" in key or key.startswith("td "):
        return "technical_directive"
    if "race director" in key or "event notes" in key or "race directors" in key:
        return "race_director_note"
    if "infringement" in key or "summons" in key or "decision" in key or "stewards" in key:
        return "stewards_decision"
    if "classification" in key or "starting grid" in key or "championship points" in key:
        return "classification"
    if "scrutineering" in key:
        return "scrutineering"
    if "entry list" in key:
        return "entry_list"
    return "other"


def _parse_documents(event_page_html: str) -> Tuple[str, List[Dict[str, Any]]]:
    title_match = re.search(
        r"<div\s+class=\"event-title\s+active\"\s*>(.*?)</div>",
        event_page_html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    event_name = _strip_html(title_match.group(1)) if title_match else ""

    row_re = re.compile(
        r"<li\s+class=\"document-row\s+key-(?P<key>\d+)\"[^>]*>\s*"
        r"<a\s+href=\"(?P<href>[^\"]+)\"[^>]*>"
        r"(?P<body>.*?)"
        r"</a>\s*</li>",
        flags=re.IGNORECASE | re.DOTALL,
    )

    docs: List[Dict[str, Any]] = []
    for match in row_re.finditer(event_page_html):
        key = int(match.group("key"))
        href = html.unescape(match.group("href").strip())
        body = match.group("body")

        title_match = re.search(r"<div\s+class=\"title\"[^>]*>(.*?)</div>", body, flags=re.IGNORECASE | re.DOTALL)
        published_match = re.search(
            r"<span[^>]*class=\"date-display-single\"[^>]*>(.*?)</span>\s*([A-Za-z]{2,5})?",
            body,
            flags=re.IGNORECASE | re.DOTALL,
        )

        title = _strip_html(title_match.group(1)) if title_match else ""
        published_raw = _strip_html(published_match.group(1)) if published_match else ""
        timezone_label = _strip_html(published_match.group(2)) if published_match and published_match.group(2) else ""

        published_at, published_epoch = _parse_published_at(published_raw, timezone_label)
        number_match = re.search(r"\bDoc\s*(\d+)\b", title, flags=re.IGNORECASE)

        docs.append(
            {
                "key": key,
                "doc_number": int(number_match.group(1)) if number_match else key,
                "title": title,
                "category": _classify_document(title),
                "published_raw": published_raw,
                "published_at": published_at,
                "published_epoch": published_epoch,
                "timezone": timezone_label or None,
                "url": _abs_url(href),
                "filename": href.rsplit("/", 1)[-1] if "/" in href else href,
            }
        )

    docs.sort(key=lambda item: ((item.get("published_epoch") or -1), int(item.get("doc_number") or 0)), reverse=True)
    return event_name, docs


async def _fetch_text(url: str) -> str:
    headers = {
        "User-Agent": "TelemetryX/1.0 (+https://telemetryx.local)",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT_S, follow_redirects=True, headers=headers) as client:
        response = await client.get(url)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"FIA source request failed ({response.status_code})")
    return response.text


async def _get_season_paths(force_refresh: bool = False) -> Dict[int, str]:
    cache_key = ("fia_document_seasons",)
    file_key = "seasons"
    if not force_refresh:
        cached = cache_get(cache_key)
        if isinstance(cached, dict):
            return cached
        file_cached = _read_file_cache(file_key, _SEASONS_TTL_S)
        if isinstance(file_cached, dict):
            cache_set(cache_key, file_cached)
            return file_cached

    championship_html = await _fetch_text(_abs_url(_F1_CHAMPIONSHIP_DOCS_PATH))
    season_paths = _parse_season_paths(championship_html)
    cache_set(cache_key, season_paths)
    _write_file_cache(file_key, season_paths)
    return season_paths


async def _resolve_season_path(year: int, force_refresh: bool = False) -> Optional[str]:
    season_paths = await _get_season_paths(force_refresh=force_refresh)
    return season_paths.get(int(year))


async def _get_events_for_year(year: int, force_refresh: bool = False) -> Dict[str, Any]:
    cache_key = ("fia_document_events", int(year))
    file_key = f"events_{int(year)}"
    if not force_refresh:
        cached = cache_get(cache_key)
        if isinstance(cached, dict):
            return cached
        file_cached = _read_file_cache(file_key, _EVENTS_TTL_S)
        if isinstance(file_cached, dict):
            cache_set(cache_key, file_cached)
            return file_cached

    season_path = await _resolve_season_path(year, force_refresh=force_refresh)
    if not season_path:
        raise HTTPException(status_code=404, detail=f"No FIA documents season found for year {year}")

    season_html = await _fetch_text(_abs_url(season_path))
    events = _parse_event_paths(season_html)
    payload = {
        "year": int(year),
        "season_path": season_path,
        "n_events": len(events),
        "events": [{"name": name, "path": path} for name, path in events],
        "source": _abs_url(season_path),
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    cache_set(cache_key, payload)
    _write_file_cache(file_key, payload)
    return payload


@router.get("/fia-documents/seasons")
async def get_fia_document_seasons(force_refresh: bool = Query(default=False)) -> Dict[str, Any]:
    season_paths = await _get_season_paths(force_refresh=force_refresh)
    years = sorted(int(year) for year in season_paths.keys())
    return {
        "n_seasons": len(years),
        "seasons": [{"year": year, "path": season_paths.get(year)} for year in years],
        "source": _abs_url(_F1_CHAMPIONSHIP_DOCS_PATH),
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


@router.get("/fia-documents/{year}")
async def get_fia_document_events(year: int, force_refresh: bool = Query(default=False)) -> Dict[str, Any]:
    try:
        # Check cache first
        cache_key = ("fia_document_events", int(year))
        file_key = f"events_{int(year)}"
        if not force_refresh:
            cached = cache_get(cache_key)
            if isinstance(cached, dict):
                return cached
            file_cached = _read_file_cache(file_key, _EVENTS_TTL_S)
            if isinstance(file_cached, dict):
                cache_set(cache_key, file_cached)
                return file_cached

        # Try to resolve season path
        season_path = await _resolve_season_path(year, force_refresh=force_refresh)
        if not season_path:
            # Return empty instead of 404
            return {
                "year": year,
                "season_path": "",
                "n_events": 0,
                "events": [],
                "source": "unavailable",
                "fetched_at": _now_iso(),
            }

        # Fetch events
        season_html = await _fetch_text(_abs_url(season_path))
        events = _parse_event_paths(season_html)
        payload = {
            "year": int(year),
            "season_path": season_path,
            "n_events": len(events),
            "events": [{"name": name, "path": path} for name, path in events],
            "source": _abs_url(season_path),
            "fetched_at": _now_iso(),
        }
        cache_set(cache_key, payload)
        _write_file_cache(file_key, payload)
        return payload

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("[FIA] events fetch failed year=%s: %s", year, exc)
        return {
            "year": year,
            "season_path": "",
            "n_events": 0,
            "events": [],
            "source": "error",
            "fetched_at": _now_iso(),
        }


@router.get("/fia-documents/{year}/{race}")
async def get_fia_documents(
    year: int,
    race: str,
    force_refresh: bool = Query(default=False),
) -> Dict[str, Any]:
    race_name = race.replace("-", " ").strip()
    cache_key = ("fia_documents", int(year), normalize_key(race_name))
    file_key = f"docs_{int(year)}_{normalize_key(race_name).replace(' ', '_')}"

    if not force_refresh:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        file_cached = _read_file_cache(file_key, _DOCS_TTL_S)
        if isinstance(file_cached, dict):
            cache_set(cache_key, file_cached)
            return file_cached

    try:
        season_path = await _resolve_season_path(year, force_refresh=force_refresh)
        if not season_path:
            return {
                "year": year,
                "requested_race": race_name,
                "event_name": race_name,
                "season_path": "",
                "event_path": "",
                "source": "unavailable",
                "fetched_at": _now_iso(),
                "total_documents": 0,
                "category_counts": {},
                "latest_published_at": None,
                "documents": [],
            }

        events_payload = await _get_events_for_year(int(year), force_refresh=force_refresh)
        events = [(str(item.get("name") or ""), str(item.get("path") or "")) for item in events_payload.get("events", [])]
        matched = _match_event_path(events, race_name)
        
        if not matched:
            raise HTTPException(
                status_code=404,
                detail={
                    "message": f"No FIA event documents found for '{race_name}' in {year}",
                    "available_events": [name for name, _ in events],
                },
            )

        event_name, event_path = matched
        event_html = await _fetch_text(_abs_url(event_path))
        parsed_event_name, documents = _parse_documents(event_html)

        category_counts: Dict[str, int] = {}
        for doc in documents:
            category = str(doc.get("category") or "other")
            category_counts[category] = category_counts.get(category, 0) + 1

        latest = next((doc.get("published_at") for doc in documents if doc.get("published_at")), None)
        
        payload: Dict[str, Any] = {
            "year": int(year),
            "requested_race": race_name,
            "event_name": parsed_event_name or event_name,
            "season_path": season_path,
            "event_path": event_path,
            "source": _abs_url(event_path),
            "fetched_at": _now_iso(),
            "total_documents": len(documents),
            "category_counts": category_counts,
            "latest_published_at": latest,
            "documents": documents,
        }
        
        cache_set(cache_key, payload)
        _write_file_cache(file_key, payload)
        return payload

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("[FIA] docs fetch failed year=%s race=%s: %s", year, race, exc)
        return {
            "year": year,
            "requested_race": race_name,
            "event_name": race_name,
            "season_path": "",
            "event_path": "",
            "source": "error",
            "fetched_at": _now_iso(),
            "total_documents": 0,
            "category_counts": {},
            "latest_published_at": None,
            "documents": [],
        }
