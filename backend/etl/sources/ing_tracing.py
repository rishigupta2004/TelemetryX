import requests
import pandas as pd
import json
from datetime import datetime
from typing import Optional, Dict, List
from pathlib import Path

from .name_utils import canonicalize_race_name, race_name_candidates, normalize_key
from .ingest_openf1 import OpenF1Client, find_meeting_key


class TracingInsightsClient:
    """Client for TracingInsights GitHub telemetry data."""

    OWNER = "TracingInsights"
    RAW_BASE = "https://raw.githubusercontent.com"
    API_BASE = "https://api.github.com"

    def __init__(self, token: str = None):
        self.session = requests.Session()
        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"token {token}"
        self.session.headers.update(headers)

    def raw_json(self, repo: str, path: str) -> Optional[dict]:
        url = f"{self.RAW_BASE}/{self.OWNER}/{repo}/main/{path}"
        try:
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            return json.loads(resp.text)
        except Exception:
            return None


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


def tracing_session_targets(session_code: str, year: Optional[int]) -> List[str]:
    code = _normalize_session_code(session_code)
    if code == "S":
        if year and year <= 2021:
            return ["Sprint Qualifying"]
        return ["Sprint"]
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


def _safe_float(value):
    if value is None or value == "None":
        return None
    try:
        return float(value)
    except Exception:
        return None


def _build_driver_number_map(year: int, race_name: str) -> Dict[str, int]:
    client = OpenF1Client()
    meeting_key = find_meeting_key(client, year, race_name)
    mapping = {}
    if meeting_key:
        drivers = client.get_drivers(meeting_key=meeting_key)
        for d in drivers:
            code = (d.get("name_acronym") or "").upper()
            num = d.get("driver_number")
            if code and num is not None:
                mapping[code] = num
    if mapping:
        return mapping

    race_keys = {normalize_key(name) for name in race_name_candidates(year, race_name)}
    etl_root = Path(__file__).resolve().parents[1]
    bronze_root = etl_root / "data" / "bronze" / str(year)
    silver_root = etl_root / "data" / "silver" / str(year)

    def _read_laps_map(laps_path: Path, driver_col: str, number_col: str) -> Dict[str, int]:
        if not laps_path.exists():
            return {}
        try:
            df = pd.read_parquet(laps_path, columns=[driver_col, number_col])
        except Exception:
            return {}
        df = df.dropna(subset=[driver_col, number_col])
        if df.empty:
            return {}
        result = {}
        for driver, number in df[[driver_col, number_col]].dropna().drop_duplicates().itertuples(index=False):
            if driver is None or number is None:
                continue
            try:
                result[str(driver).upper()] = int(number)
            except Exception:
                continue
        return result

    for root, driver_col, number_col, pattern in [
        (bronze_root, "Driver", "DriverNumber", "*/fastf1/laps.parquet"),
        (silver_root, "driver_name", "driver_number", "*/laps.parquet"),
    ]:
        if not root.exists():
            continue
        for race_dir in root.iterdir():
            if not race_dir.is_dir():
                continue
            if normalize_key(race_dir.name) not in race_keys:
                continue
            for laps_path in sorted(race_dir.glob(pattern)):
                mapping.update(_read_laps_map(laps_path, driver_col, number_col))
        if mapping:
            return mapping

    return mapping


def _resolve_race_session(client: TracingInsightsClient, year: int, race: str, session_code: str):
    repo = str(year)
    race_candidates = race_name_candidates(year, race)
    session_targets = tracing_session_targets(session_code, year)
    for race_dir in race_candidates:
        for session_dir in session_targets:
            drivers_json = client.raw_json(repo, f"{race_dir}/{session_dir}/drivers.json")
            if drivers_json:
                return race_dir, session_dir, drivers_json
    return None, None, None


def ingest_tracing(
    year: int,
    race: str,
    session_type: str = "R",
    github_token: str = None,
    tables: Optional[List[str]] = None,
) -> Dict[str, pd.DataFrame]:
    """
    Download telemetry/laptimes from TracingInsights GitHub.

    Returns:
        dict with DataFrames: telemetry, laps
    """
    client = TracingInsightsClient(github_token)
    repo = str(year)
    race_name = canonicalize_race_name(year, race)

    race_dir, session_dir, drivers_json = _resolve_race_session(client, year, race_name, session_type)
    if not race_dir or not session_dir:
        print(f"TracingInsights: Session not found for {year} {race_name} {session_type}")
        return {}

    if tables is None:
        tables = ["telemetry", "laps"]

    session_path = f"{race_dir}/{session_dir}"
    teams = {d.get("driver"): d.get("team") for d in (drivers_json or {}).get("drivers", [])}

    driver_number_map = _build_driver_number_map(year, race_name)

    telemetry_frames = []
    laps_frames = []

    driver_codes = [d.get("driver") for d in (drivers_json or {}).get("drivers", []) if d.get("driver")]
    if not driver_codes:
        driver_codes = list(driver_number_map.keys())

    for driver_code in driver_codes:
        laptimes = client.raw_json(repo, f"{session_path}/{driver_code}/laptimes.json")
        if not laptimes:
            continue

        lap_numbers = laptimes.get("lap", [])
        lap_times = laptimes.get("time", [])
        compounds = laptimes.get("compound", [])
        stints = laptimes.get("stint", [])
        s1 = laptimes.get("s1", [])
        s2 = laptimes.get("s2", [])
        s3 = laptimes.get("s3", [])
        life = laptimes.get("life", [])
        positions = laptimes.get("pos", [])
        pb = laptimes.get("pb", [])

        if not lap_numbers or not lap_times:
            continue

        lap_time_seconds = [_safe_float(x) for x in lap_times]
        lap_start_seconds = []
        running = 0.0
        for t in lap_time_seconds:
            lap_start_seconds.append(running)
            running += t or 0.0

        driver_number = driver_number_map.get(driver_code)
        team_name = teams.get(driver_code)

        if "laps" in tables:
            laps_df = pd.DataFrame({
                "Driver": driver_code,
                "DriverNumber": driver_number,
                "LapNumber": lap_numbers,
                "LapTime": pd.to_timedelta(lap_time_seconds, unit="s"),
                "Stint": stints,
                "Compound": compounds,
                "TyreLife": life,
                "Position": positions,
                "IsPersonalBest": pb,
                "Sector1Time": pd.to_timedelta([_safe_float(x) for x in s1], unit="s"),
                "Sector2Time": pd.to_timedelta([_safe_float(x) for x in s2], unit="s"),
                "Sector3Time": pd.to_timedelta([_safe_float(x) for x in s3], unit="s"),
                "Team": team_name,
                "Time": pd.to_timedelta([start + (t or 0.0) for start, t in zip(lap_start_seconds, lap_time_seconds)], unit="s"),
                "LapStartTime": pd.to_timedelta(lap_start_seconds, unit="s"),
            })
            for col in ["LapNumber", "Stint", "TyreLife", "Position"]:
                if col in laps_df.columns:
                    laps_df[col] = pd.to_numeric(laps_df[col], errors="coerce")
            if "IsPersonalBest" in laps_df.columns:
                laps_df["IsPersonalBest"] = laps_df["IsPersonalBest"].apply(
                    lambda v: False if v in (None, "None") else bool(v)
                )
            laps_frames.append(laps_df)

        if "telemetry" in tables:
            for lap_num, lap_start in zip(lap_numbers, lap_start_seconds):
                tel = client.raw_json(repo, f"{session_path}/{driver_code}/{int(lap_num)}_tel.json")
                if not tel or "tel" not in tel:
                    continue
                tel_df = pd.DataFrame(tel["tel"])
                if tel_df.empty:
                    continue

                tel_df["Time"] = pd.to_timedelta(tel_df["time"], unit="s")
                tel_df["SessionTime"] = pd.to_timedelta(tel_df["time"] + lap_start, unit="s")
                tel_df["Source"] = "tracing"
                tel_df["driver_number"] = driver_number
                tel_df["lap_number"] = lap_num
                if "time" in tel_df.columns:
                    tel_df = tel_df.drop(columns=["time"])

                rename_map = {
                    "speed": "Speed",
                    "rpm": "RPM",
                    "gear": "nGear",
                    "throttle": "Throttle",
                    "brake": "Brake",
                    "drs": "DRS",
                    "x": "X",
                    "y": "Y",
                    "z": "Z",
                }
                tel_df = tel_df.rename(columns=rename_map)
                telemetry_frames.append(tel_df)

    result = {}
    if telemetry_frames:
        result["telemetry"] = pd.concat(telemetry_frames, ignore_index=True)
        print(f"TracingInsights: telemetry rows {len(result['telemetry'])}")
    if laps_frames:
        result["laps"] = pd.concat(laps_frames, ignore_index=True)
        print(f"TracingInsights: laps rows {len(result['laps'])}")

    return result


def tracing_session_available(year: int, race: str, session_type: str = "R") -> bool:
    client = TracingInsightsClient()
    race_name = canonicalize_race_name(year, race)
    race_dir, session_dir, drivers_json = _resolve_race_session(client, year, race_name, session_type)
    return bool(race_dir and session_dir and drivers_json)


if __name__ == "__main__":
    data = ingest_tracing(2024, "Abu Dhabi Grand Prix", "R")
    if data:
        print(f"TracingInsights ingestion complete. Keys: {list(data.keys())}")
