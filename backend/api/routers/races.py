from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
import duckdb
import os
import pandas as pd
import time
from ..utils import normalize_key, read_parquet_df, resolve_dir
from ..catalog import calendar_order
from ..utils import display_session_code
from ..config import SILVER_DIR, BRONZE_DIR
from db.connection import get_db_connection

router = APIRouter()

VALID_SESSIONS = {
    "R",
    "Q",
    "SQ",
    "S",
    "FP1",
    "FP2",
    "FP3",
    "SS",
    "FP",
    "SQ1",
    "SQ2",
    "SQ3",
    "Q1",
    "Q2",
    "Q3",
}
VALID_YEARS = set(range(2018, 2026))
MAX_ROUND_LENGTH = 200
RACES_CACHE_TTL_SECONDS = 300
_RACES_CACHE: Dict[tuple[str, int], Dict[str, Any]] = {}


def _validate_year(year: int) -> int:
    if year not in VALID_YEARS:
        raise HTTPException(400, f"Invalid year. Must be one of: {sorted(VALID_YEARS)}")
    return year


def _validate_round(round: str) -> str:
    if ".." in round or "/" in round or "\\" in round:
        raise HTTPException(400, "Invalid round parameter: path traversal not allowed")
    if len(round) > MAX_ROUND_LENGTH:
        raise HTTPException(
            400, f"Round parameter exceeds maximum length of {MAX_ROUND_LENGTH}"
        )
    return round


def get_races_from_fs(year: int) -> List[Dict[str, Any]]:
    """Get all races for a given year from filesystem."""
    cache_key = (str(SILVER_DIR), year)
    cached = _RACES_CACHE.get(cache_key)
    now = time.time()
    if cached and now - float(cached.get("ts", 0.0)) < RACES_CACHE_TTL_SECONDS:
        return [dict(row) for row in cached.get("rows", [])]

    year_path = os.path.join(str(SILVER_DIR), str(year))
    if not os.path.exists(year_path):
        return []

    # Calendar order from catalog (if available)
    calendar = calendar_order(year)
    available_dirs = [
        d for d in os.listdir(year_path) if os.path.isdir(os.path.join(year_path, d))
    ]
    available_norm = {normalize_key(d): d for d in available_dirs}

    def _sessions_for(race_path: str) -> List[str]:
        sessions = []
        for sess in ["Q", "R", "S", "SS"]:
            if os.path.exists(os.path.join(race_path, sess)):
                sessions.append(display_session_code(sess))
        return sessions

    def _sort_date_for(race_dir: str) -> str:
        race_path = os.path.join(year_path, race_dir)
        for sess in ["R", "Q", "S", "SS"]:
            laps_file = os.path.join(race_path, sess, "laps.parquet")
            if not os.path.exists(laps_file):
                continue
            try:
                conn = get_db_connection().parquet_conn
                try:
                    schema = conn.execute(
                        "DESCRIBE SELECT * FROM read_parquet(?)",
                        [laps_file],
                    ).fetchall()
                    cols = [str(r[0]) for r in schema if r and r[0]]
                    col_map = {c.lower(): c for c in cols}
                    ts_col = None
                    for candidate in (
                        "lapstartdate",
                        "lap_start_date",
                        "lapstarttime",
                        "lap_start_time",
                        "date",
                        "timestamp",
                        "time",
                    ):
                        if candidate in col_map:
                            ts_col = col_map[candidate]
                            break
                    if not ts_col:
                        continue
                    row = conn.execute(
                        f"SELECT MIN({ts_col}) FROM read_parquet(?) WHERE {ts_col} IS NOT NULL",
                        [laps_file],
                    ).fetchone()
                finally:
                    conn.close()
                if row and row[0] is not None:
                    return str(row[0])
            except Exception:
                continue
        return ""

    catalog_index = {normalize_key(name): idx for idx, name in enumerate(calendar)}
    catalog_display = {normalize_key(name): name for name in calendar}

    rows: List[Dict[str, Any]] = []
    for dir_name in available_dirs:
        race_path = os.path.join(year_path, dir_name)
        sessions = _sessions_for(race_path)
        if not sessions:
            continue
        norm = normalize_key(dir_name)
        sort_date = _sort_date_for(dir_name)
        rows.append(
            {
                "year": year,
                "race_name": dir_name,
                "sessions": sessions,
                "display_name": catalog_display.get(norm, dir_name),
                "_sort_date": sort_date,
                "_catalog_rank": catalog_index.get(norm),
            }
        )

    rows.sort(
        key=lambda row: (
            0 if row.get("_sort_date") else 1 if row.get("_catalog_rank") is not None else 2,
            row.get("_sort_date") or "",
            row.get("_catalog_rank") if row.get("_catalog_rank") is not None else 10_000,
            normalize_key(str(row.get("race_name") or "")),
        )
    )

    races: List[Dict[str, Any]] = []
    for i, row in enumerate(rows, start=1):
        races.append(
            {
                "year": year,
                "round": i,
                "race_name": row["race_name"],
                "sessions": row["sessions"],
                "display_name": row["display_name"],
            }
        )
    _RACES_CACHE[cache_key] = {"ts": now, "rows": [dict(row) for row in races]}
    return races


@router.get("/races/{year}")
async def get_races_endpoint(year: int) -> List[Dict[str, Any]]:
    _validate_year(year)
    return get_races_from_fs(year)


@router.get("/races/{year}/{round}")
async def get_race(year: int, round: str) -> Dict[str, Any]:
    # Support lookup by round number (str) or race name (slug)
    _validate_year(year)
    _validate_round(round)
    races = get_races_from_fs(year)
    search_key = normalize_key(round)

    for race in races:
        # Check if round matches (as string)
        if str(race["round"]) == round:
            return race

        # Check if name matches
        if normalize_key(race["race_name"]) == search_key:
            return race

    return {"error": "Race not found"}


@router.get("/races/{year}/{round}/stints")
async def get_stints(
    year: int,
    round: str,
    limit: int = Query(default=2000, ge=1, le=20000),
) -> List[Dict[str, Any]]:
    """Get stint data for the race."""
    _validate_year(year)
    _validate_round(round)
    race_info = await get_race(year, round)
    if "error" in race_info:
        return []

    race_name = race_info["race_name"]

    # Try R session first (stints usually only relevant for Race)
    session_path = os.path.join(str(SILVER_DIR), str(year), race_name, "R")

    if not os.path.exists(session_path):
        session_path = None

    stints_file = os.path.join(session_path, "stints.parquet") if session_path else None
    if not stints_file or not os.path.exists(stints_file):
        # Fallback: bronze OpenF1 stints
        # bronze/{year}/{race}/{session}/openf1/stints.parquet
        candidate = os.path.join(
            str(BRONZE_DIR), str(year), race_name, "R", "openf1", "stints.parquet"
        )
        if os.path.exists(candidate):
            stints_file = candidate
        else:
            # Last resort: any stints file under bronze race folder
            race_root = os.path.join(str(BRONZE_DIR), str(year), race_name)
            found = None
            if os.path.exists(race_root):
                for root, _, files in os.walk(race_root):
                    if "stints.parquet" in files:
                        found = os.path.join(root, "stints.parquet")
                        break
            if found:
                stints_file = found
            else:
                return []

    try:
        df = read_parquet_df(stints_file)
        if len(df) > int(limit):
            df = df.head(int(limit))
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error reading stints: {e}")
        return []


@router.get("/races/{year}/{round}/control")
async def get_race_control(
    year: int,
    round: str,
    limit: int = Query(default=1000, ge=1, le=10000),
) -> List[Dict[str, Any]]:
    """Get race control messages (Flags, Penalties, etc.)"""
    _validate_year(year)
    _validate_round(round)
    # Resolve race name
    race_info = await get_race(year, round)
    if "error" in race_info:
        return []

    race_name = race_info["race_name"]

    # Try R session first, then Q
    session_path = os.path.join(str(SILVER_DIR), str(year), race_name, "R")
    if not os.path.exists(session_path):
        session_path = os.path.join(str(SILVER_DIR), str(year), race_name, "Q")

    if not os.path.exists(session_path):
        return []

    rc_file = os.path.join(session_path, "race_control.parquet")
    if not os.path.exists(rc_file):
        return []

    try:
        df = read_parquet_df(rc_file)

        # Convert timestamps to string if needed
        if "Time" in df.columns:
            df["Time"] = df["Time"].astype(str)

        if len(df) > int(limit):
            df = df.head(int(limit))
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error reading race control: {e}")
        return []
