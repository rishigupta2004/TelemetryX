from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "etl", "data", "silver")


def find_telemetry_file(silver_path: str) -> Optional[str]:
    """Find telemetry file in silver directory."""
    if not os.path.exists(silver_path):
        return None
    for fname in os.listdir(silver_path):
        if "telemetry" in fname.lower() or "car_data" in fname.lower():
            return os.path.join(silver_path, fname)
    return None


def get_session_path(year: int, race_name: str) -> Optional[str]:
    """Get path to session directory (Q or R)."""
    session_path = os.path.join(DATA_DIR, str(year), race_name, "Q")
    if os.path.exists(session_path):
        return session_path
    session_path = os.path.join(DATA_DIR, str(year), race_name, "R")
    if os.path.exists(session_path):
        return session_path
    return None


@router.get("/telemetry/{year}/{round}")
async def get_telemetry(
    year: int,
    round: str,
    driver: Optional[str] = None,
    lap: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Get telemetry data for a specific race.

    Query params:
        - driver: Filter by driver name or number
        - lap: Filter by lap number

    Returns telemetry with:
        - driver_name, driver_number
        - timestamp, session_time_seconds
        - position_x, position_y, position_z
        - speed, throttle, brake, gear
    """
    race_name = round.replace("-", " ")

    silver_path = get_session_path(year, race_name)
    if not silver_path:
        return []

    tel_file = find_telemetry_file(silver_path)
    if not tel_file or not os.path.exists(tel_file):
        return []

    try:
        df = pd.read_parquet(tel_file)

        # Filter by driver
        if driver:
            driver_upper = driver.upper()
            mask = (df["driver_name"] == driver) | \
                   (df["driver_name"] == driver_upper) | \
                   (df["driver_number"].astype(str) == driver)
            df = df[mask]

            if lap:
                df = df[df["lap_number"] == lap]
        elif lap:
            df = df[df["lap_number"] == lap]

        # Select and rename columns
        select_cols = ["driver_name", "driver_number", "lap_number", "timestamp",
                       "session_time_seconds", "position_x", "position_y", "position_z",
                       "speed", "throttle", "brake", "gear"]
        available_cols = [c for c in select_cols if c in df.columns]

        result = df[available_cols].sort_values(["driver_name", "lap_number", "timestamp"])
        return result.to_dict(orient="records")
    except Exception as e:
        return []


@router.get("/telemetry/{year}/{round}/{driver_id}/speed")
async def get_speed_data(year: int, round: str, driver_id: str) -> List[Dict[str, Any]]:
    """
    Get speed data for a driver. Returns position data if telemetry not available.
    """
    race_name = round.replace("-", " ")

    silver_path = get_session_path(year, race_name)
    if not silver_path:
        return []

    tel_file = find_telemetry_file(silver_path)
    pos_file = os.path.join(silver_path, "openf1_positions.parquet")

    try:
        # Try telemetry first, fall back to positions
        if tel_file and os.path.exists(tel_file):
            df = pd.read_parquet(tel_file)

            driver_upper = driver_id.upper()
            mask = (df["driver_name"] == driver_id) | \
                   (df["driver_name"] == driver_upper) | \
                   (df["driver_number"].astype(str) == driver_id)
            df = df[mask]

            # Check if we have speed data
            if "speed" in df.columns:
                result = df[["driver_name", "driver_number", "lap_number", "date", "speed"]]
                result = result.sort_values(["date"])
                return result.to_dict(orient="records")
        # Fall back to positions
        if os.path.exists(pos_file):
            df = pd.read_parquet(pos_file)

            driver_upper = driver_id.upper()
            mask = (df["driver_number"].astype(str) == driver_id) | \
                   (df["driver_number"].astype(str) == driver_upper)
            df = df[mask]

            result = df[["driver_number", "position", "date"]]
            result = result.rename(columns={"position": "speed_estimate", "date": "timestamp"})
            result = result.sort_values(["timestamp"])
            return result.to_dict(orient="records")

        return []
    except Exception as e:
        return []


@router.get("/telemetry/{year}/{round}/{driver_id}/throttle")
async def get_throttle_data(year: int, round: str, driver_id: str) -> List[Dict[str, Any]]:
    race_name = round.replace("-", " ")

    silver_path = get_session_path(year, race_name)
    if not silver_path:
        return []

    tel_file = find_telemetry_file(silver_path)
    if not tel_file or not os.path.exists(tel_file):
        return []

    try:
        df = pd.read_parquet(tel_file)

        driver_upper = driver_id.upper()
        mask = (df["driver_name"] == driver_id) | \
               (df["driver_name"] == driver_upper) | \
               (df["driver_number"].astype(str) == driver_id)
        df = df[mask]

        result = df[["driver_name", "driver_number", "lap_number", "timestamp", "throttle"]]
        result = result.sort_values(["lap_number", "timestamp"])
        return result.to_dict(orient="records")
    except Exception as e:
        return []


@router.get("/telemetry/{year}/{round}/{driver_id}/brake")
async def get_brake_data(year: int, round: str, driver_id: str) -> List[Dict[str, Any]]:
    race_name = round.replace("-", " ")

    silver_path = get_session_path(year, race_name)
    if not silver_path:
        return []

    tel_file = find_telemetry_file(silver_path)
    if not tel_file or not os.path.exists(tel_file):
        return []

    try:
        df = pd.read_parquet(tel_file)

        driver_upper = driver_id.upper()
        mask = (df["driver_name"] == driver_id) | \
               (df["driver_name"] == driver_upper) | \
               (df["driver_number"].astype(str) == driver_id)
        df = df[mask]

        result = df[["driver_name", "driver_number", "lap_number", "timestamp", "brake"]]
        result = result.sort_values(["lap_number", "timestamp"])
        return result.to_dict(orient="records")
    except Exception as e:
        return []
