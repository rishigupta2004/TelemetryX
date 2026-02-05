from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .config import CATALOG_DIR
from .utils import normalize_key


def _season_path(year: int) -> Optional[Path]:
    if not CATALOG_DIR or not CATALOG_DIR.exists():
        return None
    path = Path(CATALOG_DIR) / f"{int(year)}_season.json"
    return path if path.exists() else None


@lru_cache(maxsize=64)
def load_season_catalog(year: int) -> Dict[str, Any]:
    path = _season_path(year)
    if not path:
        return {}
    try:
        data = json.loads(path.read_text())
    except Exception:
        return {}

    # Optional overrides from _inputs (race calendar + driver/team roster).
    try:
        alt_calendar = Path(CATALOG_DIR) / f"{int(year)} Race Calendar.json"
        if alt_calendar.exists():
            cal = json.loads(alt_calendar.read_text())
            if isinstance(cal, dict):
                if cal.get("races"):
                    data["races"] = cal.get("races")
                if cal.get("race_keys"):
                    data["race_keys"] = cal.get("race_keys")
    except Exception:
        pass

    try:
        alt_roster = Path(CATALOG_DIR) / f"{int(year)}_drivers_teams.json"
        if alt_roster.exists():
            roster = json.loads(alt_roster.read_text())
            if isinstance(roster, dict) and roster.get("teams"):
                data["teams"] = roster.get("teams")
    except Exception:
        pass

    return data


def calendar_order(year: int) -> List[str]:
    data = load_season_catalog(year)
    races = data.get("races") or []
    return [str(r) for r in races if r]


@lru_cache(maxsize=64)
def driver_team_maps(year: int) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """Return (by_number, by_code) maps for a season catalog."""
    data = load_season_catalog(year)
    teams = data.get("teams") or []
    by_number: Dict[str, Dict[str, Any]] = {}
    by_code: Dict[str, Dict[str, Any]] = {}
    for team in teams:
        team_name = str(team.get("team_name") or team.get("teamName") or "")
        team_color = str(team.get("color") or team.get("teamColor") or "")
        for drv in team.get("drivers", []):
            code = str(drv.get("driver_id") or drv.get("abbrev") or drv.get("code") or "").upper()
            num = str(drv.get("driver_number") or drv.get("number") or "").strip()
            full_name = str(drv.get("driver_name") or drv.get("name") or "").strip()
            entry = {
                "driver_name": full_name,
                "driver_number": num,
                "driver_code": code,
                "team_name": team_name,
                "team_color": team_color,
            }
            if num:
                by_number[num] = entry
            if code:
                by_code[code] = entry
    return by_number, by_code


def canonical_driver_info(year: int, driver_number: Optional[str], driver_name: Optional[str]) -> Dict[str, Any]:
    """Best-effort lookup by driver number or code."""
    by_number, by_code = driver_team_maps(year)
    if driver_number and str(driver_number) in by_number:
        return by_number[str(driver_number)]
    if driver_name:
        key = str(driver_name).strip()
        key_up = key.upper()
        if key_up in by_code:
            return by_code[key_up]
        key_norm = normalize_key(key).replace(" ", "")
        for entry in by_code.values():
            if normalize_key(entry.get("driver_name") or "").replace(" ", "") == key_norm:
                return entry
    return {}


def race_key_for_name(year: int, race_name: str) -> str:
    """Return circuit key (e.g. 'australia') for a race name if present in catalog."""
    data = load_season_catalog(year)
    races = data.get("races") or []
    keys = data.get("race_keys") or []
    target = normalize_key(race_name)
    for k, r in zip(keys, races):
        if normalize_key(str(r)) == target:
            return str(k)
    return ""
