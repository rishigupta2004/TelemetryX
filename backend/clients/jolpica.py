from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from pydantic import BaseModel, Field

from backend.api.config import MEDIA_CACHE_DIR
from backend.api.utils import normalize_key

logger = logging.getLogger(__name__)

JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1"
DEFAULT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_TIMEOUT_DRIVERS = 12
DEFAULT_TIMEOUT_CAREER = 18
MAX_RETRIES = 3


class JolpicaDriver(BaseModel):
    driverId: str
    givenName: str
    familyName: str
    nationality: Optional[str] = None
    dateOfBirth: Optional[str] = None
    code: Optional[str] = None
    permanentNumber: Optional[str] = None
    url: Optional[str] = None


class JolpicaDriverTable(BaseModel):
    Drivers: List[JolpicaDriver] = Field(default_factory=list)


class JolpicaDriverMeta(BaseModel):
    driverId: Optional[str] = None
    fullName: Optional[str] = None
    nationality: Optional[str] = None
    dateOfBirth: Optional[str] = None
    age: Optional[int] = None
    wikipediaUrl: Optional[str] = None


class JolpicaRaceResult(BaseModel):
    season: Optional[str] = None
    round: Optional[str] = None
    raceName: Optional[str] = None
    Results: List[Dict[str, Any]] = Field(default_factory=list)


class JolpicaRaceTable(BaseModel):
    Races: List[JolpicaRaceResult] = Field(default_factory=list)


class JolpicaStanding(BaseModel):
    season: Optional[str] = None
    round: Optional[str] = None
    position: Optional[str] = None


class JolpicaStandingsTable(BaseModel):
    StandingsLists: List[Dict[str, Any]] = Field(default_factory=list)


class JolpicaCareerStats(BaseModel):
    starts: int = 0
    wins: int = 0
    podiums: int = 0
    poles: int = 0
    points: int = 0
    championships: int = 0
    bestFinish: Optional[int] = None
    bestQuali: Optional[int] = None
    bestRace: Optional[Dict[str, Any]] = None
    bestMoments: List[Dict[str, Any]] = Field(default_factory=list)
    seasonYears: List[int] = Field(default_factory=list)


def _compute_age(date_of_birth: Optional[str]) -> Optional[int]:
    if not date_of_birth:
        return None
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    except Exception:
        return None
    today = date.today()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(0, years)


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        f = float(value)
    except Exception:
        return None
    if not (f != f):  # NaN check
        return None
    return f


def _is_fresh(path: Path, ttl_s: int) -> bool:
    if not path.exists():
        return False
    age = time.time() - path.stat().st_mtime
    return age <= ttl_s


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=True))


class JolpicaClient:
    def __init__(
        self,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
        timeout_drivers: int = DEFAULT_TIMEOUT_DRIVERS,
        timeout_career: int = DEFAULT_TIMEOUT_CAREER,
        max_retries: int = MAX_RETRIES,
        cache_dir: Optional[Path] = None,
    ):
        self.cache_ttl_seconds = cache_ttl_seconds
        self.timeout_drivers = timeout_drivers
        self.timeout_career = timeout_career
        self.max_retries = max_retries
        self.cache_dir = cache_dir or (Path(MEDIA_CACHE_DIR) / "insights")
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "TelemetryX/1.0"})

    def _driver_meta_cache_file(self) -> Path:
        cache_dir = self.cache_dir
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / "jolpica_driver_meta.json"

    def _career_meta_cache_file(self) -> Path:
        cache_dir = self.cache_dir
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / "jolpica_driver_career.json"

    def _request_with_retry(
        self,
        url: str,
        timeout: int,
    ) -> Optional[requests.Response]:
        for attempt in range(self.max_retries):
            try:
                response = self._session.get(url, timeout=timeout)
                if response.status_code == 200:
                    return response
                logger.warning(
                    f"Jolpica API returned {response.status_code} for {url}, attempt {attempt + 1}/{self.max_retries}"
                )
            except requests.exceptions.Timeout:
                logger.warning(
                    f"Jolpica API timeout for {url}, attempt {attempt + 1}/{self.max_retries}"
                )
            except requests.exceptions.RequestException as e:
                logger.warning(
                    f"Jolpica API request error for {url}: {e}, attempt {attempt + 1}/{self.max_retries}"
                )

            if attempt < self.max_retries - 1:
                sleep_time = 2**attempt
                time.sleep(sleep_time)

        return None

    def get_drivers(
        self, season: int, refresh: bool = False
    ) -> Dict[str, JolpicaDriverMeta]:
        cache_file = self._driver_meta_cache_file()
        if not refresh and _is_fresh(cache_file, self.cache_ttl_seconds):
            cached = _read_json(cache_file)
            if cached and isinstance(cached.get("drivers"), dict):
                return {
                    k: JolpicaDriverMeta(**v)
                    if isinstance(v, dict)
                    else JolpicaDriverMeta()
                    for k, v in cached["drivers"].items()
                }

        payload: Dict[str, JolpicaDriverMeta] = {}
        try:
            url = f"{JOLPICA_BASE_URL}/{season}/drivers.json?limit=200"
            response = self._request_with_retry(url, self.timeout_drivers)
            if response is None:
                logger.error(
                    f"Failed to fetch drivers from Jolpica API after {self.max_retries} retries"
                )
                return payload

            rows = (
                response.json()
                .get("MRData", {})
                .get("DriverTable", {})
                .get("Drivers", [])
            )
            for row in rows:
                if not isinstance(row, dict):
                    continue
                full_name = (
                    f"{row.get('givenName', '')} {row.get('familyName', '')}".strip()
                )
                code = str(row.get("code") or "").upper()
                number = str(row.get("permanentNumber") or "").strip()
                entry = JolpicaDriverMeta(
                    driverId=row.get("driverId"),
                    fullName=full_name or None,
                    nationality=row.get("nationality"),
                    dateOfBirth=row.get("dateOfBirth"),
                    age=_compute_age(row.get("dateOfBirth")),
                    wikipediaUrl=row.get("url"),
                )
                if code:
                    payload[f"code:{code}"] = entry
                if number:
                    payload[f"num:{number}"] = entry
                if full_name:
                    payload[f"name:{normalize_key(full_name)}"] = entry
        except Exception as e:
            logger.error(f"Error fetching drivers from Jolpica API: {e}")

        _write_json(
            cache_file,
            {
                "generatedAt": int(time.time()),
                "drivers": {k: v.model_dump() for k, v in payload.items()},
            },
        )
        return payload

    def get_driver_career(self, driver_id: str) -> Optional[JolpicaCareerStats]:
        try:
            starts = 0
            wins = 0
            podiums = 0
            poles = 0
            points_total = 0.0
            best_finish: Optional[int] = None
            best_quali: Optional[int] = None
            best_race: Optional[Dict[str, Any]] = None
            seasons_set: set[int] = set()
            top_moments: List[Dict[str, Any]] = []

            results_url = (
                f"{JOLPICA_BASE_URL}/drivers/{driver_id}/results.json?limit=3000"
            )
            results_resp = self._request_with_retry(results_url, self.timeout_career)
            if results_resp is None:
                logger.error(f"Failed to fetch career results for driver {driver_id}")
                return None

            races = (
                results_resp.json()
                .get("MRData", {})
                .get("RaceTable", {})
                .get("Races", [])
            )
            for race in races:
                if not isinstance(race, dict):
                    continue
                season_i = _safe_int(race.get("season"))
                if season_i is not None:
                    seasons_set.add(season_i)
                race_name = str(race.get("raceName") or "Unknown")
                results = race.get("Results")
                if not isinstance(results, list) or not results:
                    continue
                result = results[0] if isinstance(results[0], dict) else {}
                starts += 1
                finish_i = _safe_int(result.get("position"))
                grid_i = _safe_int(result.get("grid"))
                pts = _safe_float(result.get("points")) or 0.0
                points_total += pts

                if finish_i is not None:
                    best_finish = (
                        finish_i if best_finish is None else min(best_finish, finish_i)
                    )
                    wins += 1 if finish_i == 1 else 0
                    podiums += 1 if finish_i <= 3 else 0
                if grid_i is not None:
                    poles += 1 if grid_i == 1 else 0
                    best_quali = (
                        grid_i if best_quali is None else min(best_quali, grid_i)
                    )

                if best_race is None or pts > float(best_race.get("points", -1)):
                    best_race = {
                        "raceName": race_name,
                        "year": season_i,
                        "finish": finish_i,
                        "points": pts,
                    }

                top_moments.append(
                    {
                        "raceName": race_name,
                        "year": season_i,
                        "finish": finish_i,
                        "grid": grid_i,
                        "points": pts,
                    }
                )

            titles = 0
            titles_url = f"{JOLPICA_BASE_URL}/drivers/{driver_id}/driverstandings/1.json?limit=200"
            titles_resp = self._request_with_retry(titles_url, self.timeout_career)
            if titles_resp is not None:
                lists = (
                    titles_resp.json()
                    .get("MRData", {})
                    .get("StandingsTable", {})
                    .get("StandingsLists", [])
                )
                if isinstance(lists, list):
                    titles = len(lists)

            top_moments.sort(
                key=lambda item: (
                    -(float(item.get("points") or 0)),
                    int(item.get("finish") or 99),
                )
            )

            return JolpicaCareerStats(
                starts=starts,
                wins=wins,
                podiums=podiums,
                poles=poles,
                points=int(round(points_total)),
                championships=titles,
                bestFinish=best_finish,
                bestQuali=best_quali,
                bestRace=best_race,
                bestMoments=top_moments[:5],
                seasonYears=sorted(seasons_set),
            )
        except Exception as e:
            logger.error(f"Error fetching career data for driver {driver_id}: {e}")
            return None

    def get_all_drivers_career(
        self,
        driver_ids: List[str],
        refresh: bool = False,
    ) -> Dict[str, JolpicaCareerStats]:
        cache_file = self._career_meta_cache_file()
        if not refresh and _is_fresh(cache_file, self.cache_ttl_seconds):
            cached = _read_json(cache_file)
            if cached and isinstance(cached.get("drivers"), dict):
                return {
                    k: JolpicaCareerStats(**v)
                    if isinstance(v, dict)
                    else JolpicaCareerStats()
                    for k, v in cached["drivers"].items()
                }

        payload: Dict[str, JolpicaCareerStats] = {}
        for driver_id in sorted(driver_ids):
            career = self.get_driver_career(driver_id)
            if career is not None:
                payload[driver_id] = career

        _write_json(
            cache_file,
            {
                "generatedAt": int(time.time()),
                "drivers": {k: v.model_dump() for k, v in payload.items()},
            },
        )
        return payload


_client_instance: Optional[JolpicaClient] = None


def get_jolpica_client(
    cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
    timeout_drivers: int = DEFAULT_TIMEOUT_DRIVERS,
    timeout_career: int = DEFAULT_TIMEOUT_CAREER,
    max_retries: int = MAX_RETRIES,
) -> JolpicaClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = JolpicaClient(
            cache_ttl_seconds=cache_ttl_seconds,
            timeout_drivers=timeout_drivers,
            timeout_career=timeout_career,
            max_retries=max_retries,
        )
    return _client_instance
