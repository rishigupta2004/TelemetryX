import requests
import pandas as pd
from typing import Dict, Optional


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


def find_session_key(client, year, race_name):
    """Find session_key for a race by matching name."""
    meetings = client.get_meetings(year)
    race_lower = race_name.lower().replace("grand prix", "").strip()
    
    for m in meetings:
        name = m.get("meeting_name", "").lower().replace("grand prix", "").replace("formula 1", "").strip()
        if race_lower in name or name in race_lower:
            meeting_key = m.get("meeting_key")
            sessions = client.get_sessions(meeting_key=meeting_key)
            # Find Race session
            for s in sessions:
                if s.get("session_type") == "Race":
                    return s.get("session_key")
            if sessions:
                return sessions[0].get("session_key")
    return None


def ingest_openf1(year: int, race_name: str) -> Dict[str, pd.DataFrame]:
    """Download from OpenF1 HTTP API."""
    client = OpenF1Client()
    session_key = find_session_key(client, year, race_name)
    
    if not session_key:
        print(f"OpenF1: No session for {year} {race_name}")
        return {}
    
    result = {}
    
    for name, func, key in [
        ("laps", client.get_laps, "laps"),
        ("telemetry", client.get_telemetry, "telemetry_3d"),
        ("positions", client.get_position, "positions"),
        ("team_radio", client.get_team_radio, "team_radio"),
        ("overtakes", client.get_overtakes, "overtakes"),
        ("stints", client.get_stints, "stints"),
    ]:
        data = func(session_key)
        if data:
            result[key] = pd.DataFrame(data)
            print(f"  {name}: {len(result[key])} records")
    
    return result


if __name__ == "__main__":
    data = ingest_openf1(2023, "Bahrain")
    if data:
        print(f"OK: {list(data.keys())}")
