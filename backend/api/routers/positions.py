from fastapi import APIRouter
from typing import List, Dict, Any, Optional
import os
import pandas as pd
import duckdb
from ..utils import resolve_dir, normalize_session_code
from ..config import BRONZE_DIR, GOLD_DIR

router = APIRouter()


def _load_openf1_positions(year: int, race_name: str, session: str) -> Optional[pd.DataFrame]:
    parquet_path = os.path.join(BRONZE_DIR, str(year), race_name, session, "openf1", "telemetry_3d.parquet")
    if not os.path.exists(parquet_path):
        return None
    try:
        conn = duckdb.connect()
        try:
            return conn.execute(f"SELECT * FROM read_parquet('{parquet_path}')").df()
        finally:
            conn.close()
    except Exception:
        return None


def _load_gold_track_map(year: int, race_name: str, session: str) -> Optional[pd.DataFrame]:
    parquet_path = os.path.join(GOLD_DIR, str(year), race_name, session, "track_map.parquet")
    if not os.path.exists(parquet_path):
        return None
    try:
        conn = duckdb.connect()
        try:
            return conn.execute(f"SELECT * FROM read_parquet('{parquet_path}')").df()
        finally:
            conn.close()
    except Exception:
        return None


@router.get("/positions/{year}/{round}")
async def get_positions(
    year: int,
    round: str,
    session_type: str = "R",
    driver: Optional[str] = None,
    step: int = 10,
    max_points: int = 20000
) -> List[Dict[str, Any]]:
    race_name = round.replace("-", " ")
    bronze_year = os.path.join(BRONZE_DIR, str(year))
    gold_year = os.path.join(GOLD_DIR, str(year))
    bronze_race = resolve_dir(bronze_year, race_name) or race_name
    gold_race = resolve_dir(gold_year, race_name) or race_name
    session = normalize_session_code(session_type)

    df = _load_openf1_positions(year, bronze_race, session)
    source = "openf1"
    if df is None or df.empty:
        df = _load_gold_track_map(year, gold_race, session)
        source = "gold"

    if df is None or df.empty:
        return []

    x_col = "position_x" if "position_x" in df.columns else "x" if "x" in df.columns else None
    y_col = "position_y" if "position_y" in df.columns else "y" if "y" in df.columns else None
    drv_col = "driver_number" if "driver_number" in df.columns else "driver" if "driver" in df.columns else None
    t_col = "session_time_seconds" if "session_time_seconds" in df.columns else "timestamp" if "timestamp" in df.columns else "date" if "date" in df.columns else None

    if not x_col or not y_col or not drv_col or not t_col:
        return []

    out = df[[t_col, drv_col, x_col, y_col]].copy()
    out.columns = ["time_raw", "driver_number", "x", "y"]

    if driver is not None:
        if driver.isdigit():
            out = out[out["driver_number"] == int(driver)]
        else:
            out = out[out["driver_number"].astype(str) == driver]

    if out.empty:
        return []

    if not pd.api.types.is_numeric_dtype(out["time_raw"]):
        try:
            times = pd.to_datetime(out["time_raw"], errors="coerce")
            base = times.min()
            out["time"] = (times - base).dt.total_seconds()
        except Exception:
            out["time"] = pd.Series([0.0] * len(out))
    else:
        out["time"] = pd.to_numeric(out["time_raw"], errors="coerce")

    out = out.dropna(subset=["time", "x", "y", "driver_number"])
    out = out.sort_values(["driver_number", "time"])

    step = max(1, int(step))
    if step > 1:
        out = out.groupby("driver_number", as_index=False, group_keys=False).apply(lambda g: g.iloc[::step])

    if len(out) > max_points:
        out = out.iloc[:max_points]

    records = out[["time", "driver_number", "x", "y"]].to_dict(orient="records")
    for r in records:
        r["source"] = source
    return records
