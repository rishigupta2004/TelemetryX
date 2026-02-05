import requests
import pandas as pd
from typing import Dict, Optional
from .name_utils import canonicalize_race_name, normalize_key


class OpenF1Client:
    BASE_URL = "https://api.openf1.org/v1"
    
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"Accept": "application/json"})
    
    def _get(self, endpoint, params=None):
        try:
            r = self.s.get(f"{self.BASE_URL}/{endpoint}", params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None
    
    def get_meetings(self, year=None):
        params = {}
        if year:
            params["year"] = year
        return self._get("meetings", params) or []
    
    def get_sessions(self, meeting_key=None, year=None):
        params = {}
        if meeting_key:
            params["meeting_key"] = meeting_key
        if year:
            params["year"] = year
        return self._get("sessions", params) or []

    def get_drivers(self, meeting_key=None, session_key=None):
        params = {}
        if meeting_key:
            params["meeting_key"] = meeting_key
        if session_key:
            params["session_key"] = session_key
        return self._get("drivers", params) or []
    
    def get_laps(self, session_key):
        return self._get("laps", {"session_key": session_key}) or []
    
    def get_telemetry(self, session_key, driver=None):
        p = {"session_key": session_key}
        if driver:
            p["driver_number"] = driver
        return self._get("telemetry", p) or []
    
    def get_position(self, session_key, driver=None):
        p = {"session_key": session_key}
        if driver:
            p["driver_number"] = driver
        return self._get("position", p) or []
    
    def get_team_radio(self, session_key):
        return self._get("team_radio", {"session_key": session_key}) or []
    
    def get_overtakes(self, session_key):
        return self._get("overtakes", {"session_key": session_key}) or []
    
    def get_intervals(self, session_key):
        return self._get("intervals", {"session_key": session_key}) or []
    
    def get_stints(self, session_key):
        return self._get("stints", {"session_key": session_key}) or []


def _normalize_session_code(session_code: str) -> str:
    if not session_code:
        return "R"
    code = session_code.strip().upper()
    mapping = {
        "RACE": "R",
        "QUALI": "Q",
        "QUALIFYING": "Q",
        "SPRINT": "S",
        "SPRINT RACE": "S",
        "SPRINT SHOOTOUT": "SS",
        "SPRINT QUALIFYING": "SS",
        "PRACTICE 1": "FP1",
        "PRACTICE 2": "FP2",
        "PRACTICE 3": "FP3",
    }
    return mapping.get(code, code)


def _session_name_targets(session_code: str, year: Optional[int] = None):
    code = _normalize_session_code(session_code)
    if code == "S":
        if year and year <= 2021:
            return ["Sprint Qualifying"]
        return ["Sprint", "Sprint Race"]
    if code == "SS":
        if year and year >= 2024:
            return ["Sprint Qualifying", "Sprint Shootout"]
        if year == 2023:
            return ["Sprint Shootout"]
        return []
    return {
        "R": ["Race"],
        "Q": ["Qualifying"],
        "FP1": ["Practice 1"],
        "FP2": ["Practice 2"],
        "FP3": ["Practice 3"],
    }.get(code, [])


def _session_type_target(session_code: str):
    code = _normalize_session_code(session_code)
    return {
        "R": "Race",
        "Q": "Qualifying",
        "S": "Race",
        "SS": "Qualifying",
        "FP1": "Practice",
        "FP2": "Practice",
        "FP3": "Practice",
    }.get(code)


def find_meeting_key(client, year: int, race_name: str):
    """Find meeting_key for a race by matching meeting name."""
    meetings = client.get_meetings(year)
    race_norm = normalize_key(canonicalize_race_name(year, race_name))

    for m in meetings:
        name = m.get("meeting_name", "")
        name_norm = normalize_key(name.replace("formula 1", ""))
        if race_norm and (race_norm in name_norm or name_norm in race_norm):
            return m.get("meeting_key")
    return None


def find_session_key(client, year, race_name, session_code: str = None):
    """Find session_key for a race by matching name and session type."""
    meetings = client.get_meetings(year)
    race_lower = normalize_key(canonicalize_race_name(year, race_name))
    
    for m in meetings:
        name = normalize_key(m.get("meeting_name", "").replace("formula 1", ""))
        if race_lower in name or name in race_lower:
            meeting_key = m.get("meeting_key")
            sessions = client.get_sessions(meeting_key=meeting_key)
            if not sessions:
                continue

            # If no session code specified, default to Race (legacy behavior)
            if not session_code:
                for s in sessions:
                    if s.get("session_type") == "Race":
                        return s.get("session_key")
                return sessions[0].get("session_key")

            targets = _session_name_targets(session_code, year)
            # Match by exact or contains on session_name
            for target in targets:
                for s in sessions:
                    name = (s.get("session_name") or "").lower()
                    if name == target.lower():
                        return s.get("session_key")
            for target in targets:
                for s in sessions:
                    name = (s.get("session_name") or "").lower()
                    if target.lower() in name:
                        return s.get("session_key")

            # Sprint sessions must match by name; avoid fallback to Race/Qualifying
            code = _normalize_session_code(session_code)
            if code in {"S", "SS"}:
                return None

            # Fallback by session_type
            type_target = _session_type_target(session_code)
            if type_target:
                candidates = [s for s in sessions if (s.get("session_type") or "").lower() == type_target.lower()]
                if candidates:
                    # Prefer most recent for sprint/ss (usually later in weekend)
                    candidates = sorted(candidates, key=lambda s: s.get("date_start") or "")
                    return candidates[-1].get("session_key")
    return None


def ingest_openf1(year: int, race_name: str, session_code: str = None, tables: Optional[Dict[str, str]] = None) -> Dict[str, pd.DataFrame]:
    """Download from OpenF1 HTTP API for a specific session."""
    client = OpenF1Client()
    session_key = find_session_key(client, year, race_name, session_code=session_code)
    
    if not session_key:
        print(f"OpenF1: No session for {year} {race_name} {session_code or ''}")
        return {}
    
    result = {}

    table_map = {
        "laps": ("laps", client.get_laps, "laps"),
        "telemetry_3d": ("telemetry", client.get_telemetry, "telemetry_3d"),
        "positions": ("positions", client.get_position, "positions"),
        "team_radio": ("team_radio", client.get_team_radio, "team_radio"),
        "overtakes": ("overtakes", client.get_overtakes, "overtakes"),
        "stints": ("stints", client.get_stints, "stints"),
    }

    to_fetch = list(table_map.keys()) if tables is None else [t for t in tables if t in table_map]

    for key in to_fetch:
        name, func, out_key = table_map[key]
        data = func(session_key)
        if data:
            result[out_key] = pd.DataFrame(data)
            print(f"  {name}: {len(result[out_key])} records")
    
    return result


if __name__ == "__main__":
    data = ingest_openf1(2023, "Bahrain", session_code="R")
    if data:
        print(f"OK: {list(data.keys())}")
