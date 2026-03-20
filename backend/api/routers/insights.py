from __future__ import annotations

import json
import math
import os
import re
import time
from datetime import date, datetime
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import duckdb
import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from ..config import GOLD_DIR, MEDIA_CACHE_DIR, TRACK_GEOMETRY_DIR
from ..utils import (
    normalize_key,
    normalize_track_geometry_start_position,
    resolve_track_geometry_file,
)

router = APIRouter()

_DRIVER_POINTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
_CACHE_TTL_SECONDS = 12 * 60 * 60
_JOLPICA_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

# Formula1.com uses event slugs that are not fully deterministic from race names.
_RACE_TO_F1_SLUG: Dict[str, str] = {
    "australian grand prix": "Australia",
    "chinese grand prix": "China",
    "japanese grand prix": "Japan",
    "bahrain grand prix": "Bahrain",
    "saudi arabian grand prix": "Saudi_Arabia",
    "miami grand prix": "Miami",
    "emilia romagna grand prix": "EmiliaRomagna",
    "monaco grand prix": "Monaco",
    "spanish grand prix": "Spain",
    "canadian grand prix": "Canada",
    "austrian grand prix": "Austria",
    "british grand prix": "Great_Britain",
    "belgian grand prix": "Belgium",
    "hungarian grand prix": "Hungary",
    "dutch grand prix": "Netherlands",
    "italian grand prix": "Italy",
    "azerbaijan grand prix": "Azerbaijan",
    "singapore grand prix": "Singapore",
    "united states grand prix": "United_States",
    "mexico city grand prix": "Mexico",
    "sao paulo grand prix": "Brazil",
    "las vegas grand prix": "Las_Vegas",
    "qatar grand prix": "Qatar",
    "abu dhabi grand prix": "United_Arab_Emirates",
}


def _safe_float(value: Any) -> Optional[float]:
    try:
        f = float(value)
    except Exception:
        return None
    if not math.isfinite(f):
        return None
    return f


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        i = int(value)
        return i
    except Exception:
        return None


def _race_dirs_for_year(year: int) -> List[str]:
    year_path = Path(GOLD_DIR) / str(int(year))
    if not year_path.exists():
        return []
    races = [p.name for p in year_path.iterdir() if p.is_dir()]
    races.sort()
    return races


def _read_records(path: Path, sql: str, params: Optional[List[Any]] = None) -> List[Tuple[Any, ...]]:
    if not path.exists():
        return []
    conn = duckdb.connect()
    try:
        rows = conn.execute(sql, params or []).fetchall()
        return rows
    finally:
        conn.close()


def _parquet_columns(path: Path) -> set[str]:
    if not path.exists():
        return set()
    conn = duckdb.connect()
    try:
        rows = conn.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(path)]).fetchall()
        return {str(row[0]) for row in rows}
    finally:
        conn.close()


def _pick_column(path: Path, candidates: List[str], fallback: str = "NULL") -> str:
    cols = _parquet_columns(path)
    for col in candidates:
        if col in cols:
            return col
    return fallback


def _standings_cache_file(year: int) -> Path:
    cache_dir = Path(MEDIA_CACHE_DIR) / "insights"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"standings_{int(year)}.json"


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=True))


def _is_fresh(path: Path, ttl_s: int) -> bool:
    if not path.exists():
        return False
    age = time.time() - path.stat().st_mtime
    return age <= ttl_s


def _profile_meta_cache_file() -> Path:
    cache_dir = Path(MEDIA_CACHE_DIR) / "insights"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "jolpica_driver_meta.json"


def _career_meta_cache_file() -> Path:
    cache_dir = Path(MEDIA_CACHE_DIR) / "insights"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "jolpica_driver_career.json"


def _wiki_image_cache_file() -> Path:
    cache_dir = Path(MEDIA_CACHE_DIR) / "insights"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "wikipedia_images.json"


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


def _load_jolpica_driver_meta(refresh: bool = False) -> Dict[str, Dict[str, Any]]:
    cache_file = _profile_meta_cache_file()
    if not refresh and _is_fresh(cache_file, _JOLPICA_CACHE_TTL_SECONDS):
        cached = _read_json(cache_file)
        if cached and isinstance(cached.get("drivers"), dict):
            return cached["drivers"]

    payload: Dict[str, Dict[str, Any]] = {}
    try:
        response = requests.get(
            "https://api.jolpi.ca/ergast/f1/2025/drivers.json?limit=200",
            timeout=12,
            headers={"User-Agent": "TelemetryX/1.0"},
        )
        if response.status_code == 200:
            rows = (
                response.json()
                .get("MRData", {})
                .get("DriverTable", {})
                .get("Drivers", [])
            )
            for row in rows:
                if not isinstance(row, dict):
                    continue
                full_name = f"{row.get('givenName', '')} {row.get('familyName', '')}".strip()
                code = str(row.get("code") or "").upper()
                number = str(row.get("permanentNumber") or "").strip()
                entry = {
                    "driverId": row.get("driverId"),
                    "fullName": full_name or None,
                    "nationality": row.get("nationality"),
                    "dateOfBirth": row.get("dateOfBirth"),
                    "age": _compute_age(row.get("dateOfBirth")),
                    "wikipediaUrl": row.get("url"),
                }
                if code:
                    payload[f"code:{code}"] = entry
                if number:
                    payload[f"num:{number}"] = entry
                if full_name:
                    payload[f"name:{normalize_key(full_name)}"] = entry
    except Exception:
        # network/source issues should not block profile endpoint
        pass

    _write_json(cache_file, {"generatedAt": int(time.time()), "drivers": payload})
    return payload


def _safe_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return float(numerator) / float(denominator)


def _extract_driver_id_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    match = re.search(r"/drivers/([^/.]+)", url)
    if not match:
        return None
    driver_id = match.group(1).strip()
    return driver_id or None


def _load_jolpica_career_meta(
    driver_meta: Dict[str, Dict[str, Any]],
    refresh_remote: bool = False,
) -> Dict[str, Dict[str, Any]]:
    cache_file = _career_meta_cache_file()
    if not refresh_remote and _is_fresh(cache_file, _JOLPICA_CACHE_TTL_SECONDS):
        cached = _read_json(cache_file)
        if cached and isinstance(cached.get("drivers"), dict):
            return cached["drivers"]
    if not refresh_remote and not cache_file.exists():
        return {}

    driver_ids: set[str] = set()
    for entry in driver_meta.values():
        if not isinstance(entry, dict):
            continue
        driver_id = str(entry.get("driverId") or "").strip()
        if not driver_id:
            driver_id = str(_extract_driver_id_from_url(entry.get("wikipediaUrl")) or "").strip()
        if driver_id:
            driver_ids.add(driver_id)

    if not driver_ids:
        return {}

    payload: Dict[str, Dict[str, Any]] = {}
    headers = {"User-Agent": "TelemetryX/1.0"}
    for driver_id in sorted(driver_ids):
        try:
            results_resp = requests.get(
                f"https://api.jolpi.ca/ergast/f1/drivers/{driver_id}/results.json?limit=3000",
                timeout=18,
                headers=headers,
            )
            if results_resp.status_code != 200:
                continue
            races = (
                results_resp.json()
                .get("MRData", {})
                .get("RaceTable", {})
                .get("Races", [])
            )
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
                    best_finish = finish_i if best_finish is None else min(best_finish, finish_i)
                    wins += 1 if finish_i == 1 else 0
                    podiums += 1 if finish_i <= 3 else 0
                if grid_i is not None:
                    poles += 1 if grid_i == 1 else 0
                    best_quali = grid_i if best_quali is None else min(best_quali, grid_i)

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
            try:
                titles_resp = requests.get(
                    f"https://api.jolpi.ca/ergast/f1/drivers/{driver_id}/driverstandings/1.json?limit=200",
                    timeout=18,
                    headers=headers,
                )
                if titles_resp.status_code == 200:
                    lists = (
                        titles_resp.json()
                        .get("MRData", {})
                        .get("StandingsTable", {})
                        .get("StandingsLists", [])
                    )
                    if isinstance(lists, list):
                        titles = len(lists)
            except Exception:
                titles = 0

            top_moments.sort(key=lambda item: (-(float(item.get("points") or 0)), int(item.get("finish") or 99)))
            payload[driver_id] = {
                "starts": starts,
                "wins": wins,
                "podiums": podiums,
                "poles": poles,
                "points": int(round(points_total)),
                "championships": titles,
                "bestFinish": best_finish,
                "bestQuali": best_quali,
                "bestRace": best_race,
                "bestMoments": top_moments[:5],
                "seasonYears": sorted(seasons_set),
            }
        except Exception:
            continue

    _write_json(cache_file, {"generatedAt": int(time.time()), "drivers": payload})
    return payload


def _wikipedia_image_from_title(title: str) -> Optional[str]:
    clean_title = title.strip().replace(" ", "_")
    if not clean_title:
        return None
    try:
        resp = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "format": "json",
                "prop": "pageimages",
                "titles": clean_title,
                "pithumbsize": 900,
                "origin": "*",
            },
            timeout=15,
            headers={"User-Agent": "TelemetryX/1.0"},
        )
        if resp.status_code != 200:
            return None
        pages = resp.json().get("query", {}).get("pages", {})
        if not isinstance(pages, dict):
            return None
        for page in pages.values():
            if not isinstance(page, dict):
                continue
            thumb = page.get("thumbnail")
            if isinstance(thumb, dict):
                src = thumb.get("source")
                if isinstance(src, str) and src.startswith("http"):
                    return src
    except Exception:
        return None
    return None


def _load_wikipedia_images(
    drivers: List[Dict[str, Any]],
    teams: List[Dict[str, Any]],
    refresh_remote: bool = False,
) -> Dict[str, Dict[str, str]]:
    cache_file = _wiki_image_cache_file()
    if not refresh_remote and _is_fresh(cache_file, _JOLPICA_CACHE_TTL_SECONDS):
        cached = _read_json(cache_file)
        if cached and isinstance(cached.get("drivers"), dict) and isinstance(cached.get("teams"), dict):
            return {
                "drivers": {str(k): str(v) for k, v in cached.get("drivers", {}).items()},
                "teams": {str(k): str(v) for k, v in cached.get("teams", {}).items()},
            }
    if not refresh_remote and not cache_file.exists():
        return {"drivers": {}, "teams": {}}

    driver_images: Dict[str, str] = {}
    team_images: Dict[str, str] = {}

    for row in drivers:
        name = str(row.get("driverName") or "").strip()
        if not name:
            continue
        wiki_url = str(row.get("wikipediaUrl") or "").strip()
        title = wiki_url.rsplit("/", 1)[-1] if wiki_url else name
        img = _wikipedia_image_from_title(title.replace("_", " "))
        if img:
            driver_images[name] = img

    for row in teams:
        team_name = str(row.get("teamName") or "").strip()
        if not team_name:
            continue
        candidate_titles = [
            f"{team_name} Formula One Team",
            f"{team_name} F1 Team",
            team_name,
        ]
        for title in candidate_titles:
            img = _wikipedia_image_from_title(title)
            if img:
                team_images[team_name] = img
                break

    _write_json(cache_file, {"generatedAt": int(time.time()), "drivers": driver_images, "teams": team_images})
    return {"drivers": driver_images, "teams": team_images}


def _build_season_standings(year: int) -> Dict[str, Any]:
    races = _race_dirs_for_year(year)
    if not races:
        raise HTTPException(status_code=404, detail=f"No gold standings data available for {year}")

    driver_acc: Dict[str, Dict[str, Any]] = {}
    team_acc: Dict[str, Dict[str, Any]] = {}
    source_files: List[str] = []

    for race_name in races:
        race_dir = Path(GOLD_DIR) / str(int(year)) / race_name / "R"
        driver_file = race_dir / "driver_standings.parquet"
        team_file = race_dir / "constructor_standings.parquet"

        if driver_file.exists():
            source_files.append(str(driver_file))
            position_col = _pick_column(driver_file, ["position", "final_position"])
            avg_lap_col = _pick_column(driver_file, ["avg_lap_time", "average_lap_time"])
            fastest_lap_col = _pick_column(driver_file, ["fastest_lap_time", "best_lap_time"])
            rows = _read_records(
                driver_file,
                f"""
                SELECT
                    CAST(driver_number AS BIGINT),
                    CAST(driver_name AS VARCHAR),
                    CAST(team_name AS VARCHAR),
                    CAST({position_col} AS BIGINT),
                    CAST({avg_lap_col} AS DOUBLE),
                    CAST({fastest_lap_col} AS DOUBLE)
                FROM read_parquet(?)
                """,
                [str(driver_file)],
            )
            for driver_number, driver_name, team_name, position, avg_lap_time, fastest_lap_time in rows:
                pos_i = _safe_int(position)
                if pos_i is None:
                    continue
                key = str(driver_number) if driver_number is not None else str(driver_name)
                row = driver_acc.get(key)
                if row is None:
                    row = {
                        "driverNumber": _safe_int(driver_number),
                        "driverName": str(driver_name or ""),
                        "teamName": str(team_name or "Unknown"),
                        "points": 0,
                        "wins": 0,
                        "podiums": 0,
                        "starts": 0,
                        "bestFinish": 99,
                        "bestQuali": None,
                        "bestRace": None,
                        "seasonPointsProgression": [],
                    }
                    driver_acc[key] = row

                row["starts"] += 1
                row["bestFinish"] = min(int(row["bestFinish"]), pos_i)
                pts = _DRIVER_POINTS.get(pos_i, 0)
                row["points"] += pts
                row["wins"] += 1 if pos_i == 1 else 0
                row["podiums"] += 1 if pos_i <= 3 else 0
                row["teamName"] = str(team_name or row["teamName"])  # keep latest

                if row["bestRace"] is None or pts > int(row["bestRace"]["points"]):
                    row["bestRace"] = {
                        "raceName": race_name,
                        "finish": pos_i,
                        "points": pts,
                        "fastestLapTime": _safe_float(fastest_lap_time),
                        "avgLapTime": _safe_float(avg_lap_time),
                    }

                row["seasonPointsProgression"].append({
                    "raceName": race_name,
                    "finish": pos_i,
                    "points": pts,
                })

                team_key = normalize_key(str(team_name or "Unknown"))
                team_row = team_acc.get(team_key)
                if team_row is None:
                    team_row = {
                        "teamName": str(team_name or "Unknown"),
                        "points": 0,
                        "wins": 0,
                        "podiums": 0,
                        "starts": 0,
                        "bestFinish": 99,
                        "driverNumbers": set(),
                    }
                    team_acc[team_key] = team_row

                team_row["points"] += pts
                team_row["wins"] += 1 if pos_i == 1 else 0
                team_row["podiums"] += 1 if pos_i <= 3 else 0
                team_row["starts"] += 1
                team_row["bestFinish"] = min(int(team_row["bestFinish"]), pos_i)
                if driver_number is not None:
                    team_row["driverNumbers"].add(int(driver_number))

        if team_file.exists():
            source_files.append(str(team_file))

    drivers = sorted(
        [
            {
                **row,
                "bestFinish": None if int(row["bestFinish"]) >= 99 else int(row["bestFinish"]),
                "seasons": 1,
            }
            for row in driver_acc.values()
        ],
        key=lambda r: (-int(r["points"]), int(r["bestFinish"] or 99), str(r["driverName"])),
    )
    for idx, row in enumerate(drivers, start=1):
        row["position"] = idx

    constructors = sorted(
        [
            {
                "teamName": row["teamName"],
                "points": int(row["points"]),
                "wins": int(row["wins"]),
                "podiums": int(row["podiums"]),
                "starts": int(row["starts"]),
                "bestFinish": None if int(row["bestFinish"]) >= 99 else int(row["bestFinish"]),
                "driverCount": len(row["driverNumbers"]),
            }
            for row in team_acc.values()
        ],
        key=lambda r: (-int(r["points"]), int(r["bestFinish"] or 99), str(r["teamName"])),
    )
    for idx, row in enumerate(constructors, start=1):
        row["position"] = idx

    return {
        "year": int(year),
        "roundsCount": len(races),
        "lastRace": races[-1],
        "drivers": drivers,
        "constructors": constructors,
        "sourceFiles": source_files,
        "generatedAt": int(time.time()),
    }


def _collect_profile_stats(refresh_remote: bool = False) -> Dict[str, Any]:
    years = sorted([int(p.name) for p in Path(GOLD_DIR).iterdir() if p.is_dir() and p.name.isdigit()])
    if not years:
        raise HTTPException(status_code=404, detail="No gold data available")

    driver_totals: Dict[str, Dict[str, Any]] = {}
    team_totals: Dict[str, Dict[str, Any]] = {}
    driver_codes: Dict[str, str] = {}

    for year in years:
        races = _race_dirs_for_year(year)
        for race_name in races:
            race_dir = Path(GOLD_DIR) / str(year) / race_name
            race_file = race_dir / "R" / "driver_standings.parquet"
            quali_file = race_dir / "Q" / "driver_standings.parquet"

            if race_file.exists():
                pos_col = _pick_column(race_file, ["position", "final_position"])
                race_rows = _read_records(
                    race_file,
                    f"""
                    SELECT
                        CAST(driver_number AS BIGINT),
                        CAST(driver_name AS VARCHAR),
                        CAST(team_name AS VARCHAR),
                        CAST({pos_col} AS BIGINT)
                    FROM read_parquet(?)
                    """,
                    [str(race_file)],
                )
                for driver_number, driver_name, team_name, position in race_rows:
                    pos_i = _safe_int(position)
                    if pos_i is None:
                        continue
                    key = str(driver_number) if driver_number is not None else str(driver_name)
                    if driver_name:
                        driver_codes[key] = str(driver_name).strip().upper()
                    rec = driver_totals.get(key)
                    if rec is None:
                        rec = {
                            "driverNumber": _safe_int(driver_number),
                            "driverName": str(driver_name or ""),
                            "teamName": str(team_name or "Unknown"),
                            "seasonsSet": set(),
                            "starts": 0,
                            "wins": 0,
                            "podiums": 0,
                            "points": 0,
                            "bestFinish": 99,
                            "bestQuali": 99,
                            "championships": 0,
                            "bestRace": None,
                        }
                        driver_totals[key] = rec

                    rec["teamName"] = str(team_name or rec["teamName"])
                    rec["starts"] += 1
                    rec["seasonsSet"].add(int(year))
                    rec["wins"] += 1 if pos_i == 1 else 0
                    rec["podiums"] += 1 if pos_i <= 3 else 0
                    rec["bestFinish"] = min(int(rec["bestFinish"]), pos_i)
                    pts = _DRIVER_POINTS.get(pos_i, 0)
                    rec["points"] += pts
                    if rec["bestRace"] is None or pts > int(rec["bestRace"]["points"]):
                        rec["bestRace"] = {"raceName": race_name, "year": int(year), "finish": pos_i, "points": pts}

                    tkey = normalize_key(str(team_name or "Unknown"))
                    team = team_totals.get(tkey)
                    if team is None:
                        team = {
                            "teamName": str(team_name or "Unknown"),
                            "seasonsSet": set(),
                            "starts": 0,
                            "wins": 0,
                            "podiums": 0,
                            "points": 0,
                            "championships": 0,
                            "bestFinish": 99,
                        }
                        team_totals[tkey] = team
                    team["seasonsSet"].add(int(year))
                    team["starts"] += 1
                    team["wins"] += 1 if pos_i == 1 else 0
                    team["podiums"] += 1 if pos_i <= 3 else 0
                    team["points"] += pts
                    team["bestFinish"] = min(int(team["bestFinish"]), pos_i)

            if quali_file.exists():
                q_pos_col = _pick_column(quali_file, ["position", "final_position"])
                q_rows = _read_records(
                    quali_file,
                    f"SELECT CAST(driver_number AS BIGINT), CAST(driver_name AS VARCHAR), CAST({q_pos_col} AS BIGINT) FROM read_parquet(?)",
                    [str(quali_file)],
                )
                for driver_number, driver_name, position in q_rows:
                    pos_i = _safe_int(position)
                    if pos_i is None:
                        continue
                    key = str(driver_number) if driver_number is not None else str(driver_name)
                    if key in driver_totals:
                        driver_totals[key]["bestQuali"] = min(int(driver_totals[key]["bestQuali"]), pos_i)

        # Championship heuristics from computed points by year.
        season_rows: Dict[str, int] = defaultdict(int)
        for race_name in races:
            race_file = Path(GOLD_DIR) / str(year) / race_name / "R" / "driver_standings.parquet"
            if not race_file.exists():
                continue
            season_pos_col = _pick_column(race_file, ["position", "final_position"])
            rows = _read_records(
                race_file,
                f"SELECT CAST(driver_number AS BIGINT), CAST(driver_name AS VARCHAR), CAST({season_pos_col} AS BIGINT) FROM read_parquet(?)",
                [str(race_file)],
            )
            for driver_number, driver_name, position in rows:
                pos_i = _safe_int(position)
                if pos_i is None:
                    continue
                key = str(driver_number) if driver_number is not None else str(driver_name)
                season_rows[key] += _DRIVER_POINTS.get(pos_i, 0)
        if season_rows:
            champ = max(season_rows.items(), key=lambda item: item[1])[0]
            if champ in driver_totals:
                driver_totals[champ]["championships"] += 1
                tname = normalize_key(str(driver_totals[champ].get("teamName") or ""))
                if tname in team_totals:
                    team_totals[tname]["championships"] += 1

    driver_profiles: List[Dict[str, Any]] = []
    external_meta = _load_jolpica_driver_meta(refresh=refresh_remote)
    career_meta = _load_jolpica_career_meta(external_meta, refresh_remote=refresh_remote)
    for row in driver_totals.values():
        seasons = sorted(int(y) for y in row["seasonsSet"])
        lookup_key_num = f"num:{row['driverNumber']}" if row["driverNumber"] is not None else ""
        raw_driver_name = str(row["driverName"] or "").strip().upper()
        lookup_key_code = ""
        if raw_driver_name.isalpha() and 2 <= len(raw_driver_name) <= 4:
            lookup_key_code = f"code:{raw_driver_name}"
        row_key = str(row["driverNumber"]) if row["driverNumber"] is not None else str(row["driverName"])
        if not lookup_key_code and row_key in driver_codes:
            lookup_key_code = f"code:{driver_codes[row_key]}"
        lookup_key_name = f"name:{normalize_key(str(row['driverName']))}"
        meta = (
            external_meta.get(lookup_key_code)
            or external_meta.get(lookup_key_name)
            or external_meta.get(lookup_key_num)
            or {}
        )
        driver_id = str(meta.get("driverId") or "").strip() or str(_extract_driver_id_from_url(meta.get("wikipediaUrl")) or "").strip()
        cmeta = career_meta.get(driver_id, {}) if driver_id else {}
        local_best_finish = None if int(row["bestFinish"]) >= 99 else int(row["bestFinish"])
        local_best_quali = None if int(row["bestQuali"]) >= 99 else int(row["bestQuali"])
        starts = int(cmeta.get("starts") or int(row["starts"]))
        wins = int(cmeta.get("wins") or int(row["wins"]))
        podiums = int(cmeta.get("podiums") or int(row["podiums"]))
        poles = int(cmeta.get("poles") or 0)
        points = int(cmeta.get("points") or int(row["points"]))
        championships = int(cmeta.get("championships") or int(row["championships"]))
        season_years = cmeta.get("seasonYears") if isinstance(cmeta.get("seasonYears"), list) and cmeta.get("seasonYears") else seasons
        season_years = [int(v) for v in season_years]
        best_finish = cmeta.get("bestFinish") if cmeta.get("bestFinish") is not None else local_best_finish
        best_quali = cmeta.get("bestQuali") if cmeta.get("bestQuali") is not None else local_best_quali
        best_race = cmeta.get("bestRace") if isinstance(cmeta.get("bestRace"), dict) else row["bestRace"]
        best_moments_rows = cmeta.get("bestMoments") if isinstance(cmeta.get("bestMoments"), list) else []
        win_rate = _safe_ratio(wins, starts) * 100.0
        podium_rate = _safe_ratio(podiums, starts) * 100.0
        pole_rate = _safe_ratio(poles, starts) * 100.0
        best_moments = []
        for item in best_moments_rows[:3]:
            if not isinstance(item, dict):
                continue
            label = f"{item.get('raceName', 'Race')} {item.get('year', '')}".strip()
            finish = _safe_int(item.get("finish"))
            points_i = _safe_float(item.get("points")) or 0.0
            if finish is not None:
                label += f" - P{finish}"
            label += f" ({points_i:.0f} pts)"
            best_moments.append(label)
        if not best_moments and best_race:
            best_moments = [f"{best_race.get('raceName', 'Race')} {best_race.get('year', '')}".strip()]

        achievements = [
            f"{championships} World Drivers' Championships",
            f"{wins} career wins",
            f"{podiums} career podiums",
            f"{poles} career poles",
        ]
        records = [
            f"Best finish: P{best_finish if best_finish is not None else '-'}",
            f"Best quali: P{best_quali if best_quali is not None else '-'}",
            f"Win rate: {win_rate:.1f}%",
            f"Podium rate: {podium_rate:.1f}%",
            f"Pole rate: {pole_rate:.1f}%",
        ]

        driver_profiles.append(
            {
                "driverNumber": row["driverNumber"],
                "driverName": row["driverName"],
                "fullName": meta.get("fullName"),
                "teamName": row["teamName"],
                "age": meta.get("age"),
                "nationality": meta.get("nationality"),
                "dateOfBirth": meta.get("dateOfBirth"),
                "wikipediaUrl": meta.get("wikipediaUrl"),
                "starts": starts,
                "seasons": len(season_years),
                "seasonYears": season_years,
                "poles": poles,
                "wins": wins,
                "podiums": podiums,
                "points": points,
                "championships": championships,
                "bestFinish": best_finish,
                "bestQuali": best_quali,
                "achievements": achievements,
                "records": records,
                "bestRace": best_race,
                "bestMoments": best_moments if best_moments else ["Data pending"],
            }
        )

    driver_profiles.sort(key=lambda r: (-int(r["championships"]), -int(r["wins"]), -int(r["points"]), str(r["driverName"])))

    team_profiles: List[Dict[str, Any]] = []
    for row in team_totals.values():
        seasons = sorted(int(y) for y in row["seasonsSet"])
        starts = int(row["starts"])
        wins = int(row["wins"])
        podiums = int(row["podiums"])
        win_rate = _safe_ratio(wins, starts) * 100.0
        podium_rate = _safe_ratio(podiums, starts) * 100.0
        team_profiles.append(
            {
                "teamName": row["teamName"],
                "seasons": len(seasons),
                "seasonYears": seasons,
                "starts": starts,
                "wins": wins,
                "podiums": podiums,
                "points": int(row["points"]),
                "championships": int(row["championships"]),
                "bestFinish": None if int(row["bestFinish"]) >= 99 else int(row["bestFinish"]),
                "records": [
                    f"{wins} wins",
                    f"{int(row['championships'])} constructors' titles",
                    f"Win rate: {win_rate:.1f}%",
                    f"Podium rate: {podium_rate:.1f}%",
                ],
            }
        )

    team_profiles.sort(key=lambda r: (-int(r["championships"]), -int(r["wins"]), -int(r["points"]), str(r["teamName"])))

    wiki_images = _load_wikipedia_images(driver_profiles, team_profiles, refresh_remote=refresh_remote)
    for row in driver_profiles:
        row["driverImage"] = wiki_images.get("drivers", {}).get(str(row.get("driverName") or ""))
    for row in team_profiles:
        row["teamImage"] = wiki_images.get("teams", {}).get(str(row.get("teamName") or ""))

    return {
        "drivers": driver_profiles,
        "teams": team_profiles,
        "generatedAt": int(time.time()),
        "availableYears": years,
    }


def _f1_slug_from_race(race_name: str) -> Optional[str]:
    key = normalize_key(race_name)
    if key in _RACE_TO_F1_SLUG:
        return _RACE_TO_F1_SLUG[key]
    cleaned = race_name.replace("Grand Prix", "").replace("grand prix", "").strip()
    cleaned = cleaned.replace(" ", "_")
    return cleaned if cleaned else None


def _extract_f1_facts(html: str) -> Dict[str, str]:
    facts: Dict[str, str] = {}
    for label in ["First Grand Prix", "Number of Laps", "Circuit Length", "Race Distance", "Lap Record"]:
        pattern = re.compile(rf">{re.escape(label)}<.*?<dd[^>]*>(.*?)</dd>", re.IGNORECASE | re.DOTALL)
        match = pattern.search(html)
        if not match:
            continue
        value = re.sub(r"<[^>]+>", "", match.group(1)).strip()
        if value:
            facts[label] = value

    desc = None
    meta_match = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]+)"', html, re.IGNORECASE)
    if meta_match:
        desc = meta_match.group(1).strip()
    if desc:
        facts["Description"] = desc

    return facts


def _load_track_geometry(year: int, race_name: str) -> Dict[str, Any]:
    fpath = resolve_track_geometry_file(str(TRACK_GEOMETRY_DIR), race_name, year)
    if not fpath:
        return {}
    try:
        with open(fpath, "r") as fh:
            return normalize_track_geometry_start_position(json.load(fh))
    except Exception:
        return {}


@router.get("/insights/{year}/standings")
async def get_season_standings(year: int, refresh: bool = Query(default=False)) -> Dict[str, Any]:
    cache_file = _standings_cache_file(year)
    if not refresh and _is_fresh(cache_file, _CACHE_TTL_SECONDS):
        cached = _read_json(cache_file)
        if cached:
            return cached

    payload = await run_in_threadpool(_build_season_standings, year)
    _write_json(cache_file, payload)
    return payload


@router.get("/insights/profiles")
async def get_profiles(refresh: bool = Query(default=False)) -> Dict[str, Any]:
    cache_dir = Path(MEDIA_CACHE_DIR) / "insights"
    cache_file = cache_dir / "profiles_all.json"
    if not refresh and _is_fresh(cache_file, _CACHE_TTL_SECONDS):
        cached = _read_json(cache_file)
        if cached:
            return cached

    payload = await run_in_threadpool(_collect_profile_stats, refresh)
    _write_json(cache_file, payload)
    return payload


@router.get("/insights/{year}/{race}/circuit")
async def get_circuit_insights(year: int, race: str, refresh: bool = Query(default=False)) -> Dict[str, Any]:
    race_name = race.replace("-", " ")
    cache_dir = Path(MEDIA_CACHE_DIR) / "insights"
    cache_file = cache_dir / f"circuit_{int(year)}_{normalize_key(race_name).replace(' ', '_')}.json"

    if not refresh and _is_fresh(cache_file, _CACHE_TTL_SECONDS):
        cached = _read_json(cache_file)
        if cached:
            return cached

    geometry = await run_in_threadpool(_load_track_geometry, year, race_name)
    points = geometry.get("centerline") if isinstance(geometry, dict) else []
    corners = geometry.get("corners") if isinstance(geometry, dict) else []
    drs_zones = geometry.get("drsZones") if isinstance(geometry, dict) else []
    sectors = geometry.get("sectors") if isinstance(geometry, dict) else []

    payload: Dict[str, Any] = {
        "year": int(year),
        "race": race_name,
        "circuitName": geometry.get("name") if isinstance(geometry, dict) else None,
        "country": geometry.get("country") if isinstance(geometry, dict) else None,
        "layoutYear": geometry.get("layoutYear") if isinstance(geometry, dict) else None,
        "trackWidth": geometry.get("trackWidth") if isinstance(geometry, dict) else None,
        "cornerCount": len(corners) if isinstance(corners, list) else 0,
        "drsZoneCount": len(drs_zones) if isinstance(drs_zones, list) else 0,
        "sectorCount": len(sectors) if isinstance(sectors, list) else 0,
        "pointCount": len(points) if isinstance(points, list) else 0,
        "facts": {},
        "source": "local",
        "sourceUrl": None,
        "generatedAt": int(time.time()),
    }

    slug = _f1_slug_from_race(race_name)
    if slug:
        url = f"https://www.formula1.com/en/racing/{int(year)}/{slug}.html"
        try:
            res = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 TelemetryX"})
            if res.status_code == 200 and res.text:
                facts = _extract_f1_facts(res.text)
                if facts:
                    payload["facts"] = facts
                    payload["source"] = "formula1.com"
                    payload["sourceUrl"] = url
        except Exception:
            pass

    if not payload["facts"]:
        payload["facts"] = {
            "Circuit Length": "Unknown",
            "Race Distance": "Unknown",
            "Number of Laps": "Unknown",
            "First Grand Prix": "Unknown",
            "Note": "Formula1.com fact extraction unavailable; using geometry-derived fallback.",
        }

    _write_json(cache_file, payload)
    return payload
