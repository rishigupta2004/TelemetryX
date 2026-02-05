from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..config import SILVER_DIR
from ..utils import normalize_session_code, read_parquet_df, resolve_dir

router = APIRouter()


def _resolve_session_dir(year: int, race_name: str, session_type: Optional[str]) -> Optional[Tuple[str, str]]:
    year_path = os.path.join(SILVER_DIR, str(year))
    race_dir = resolve_dir(year_path, race_name)
    if not race_dir:
        return None

    if session_type:
        sess = normalize_session_code(session_type)
        path = os.path.join(year_path, race_dir, sess)
        return (race_dir, path) if os.path.exists(path) else None

    # Default: prefer Qualifying, then Race, then Sprint, then Sprint Shootout.
    for sess in ("Q", "R", "S", "SS"):
        path = os.path.join(year_path, race_dir, sess)
        if os.path.exists(path):
            return race_dir, path
    return None


def _laps_df(year: int, race_slug: str, session_type: Optional[str]) -> pd.DataFrame:
    race_name = race_slug.replace("-", " ")
    resolved = _resolve_session_dir(year, race_name, session_type)
    if not resolved:
        return pd.DataFrame()
    _race_dir, silver_path = resolved
    laps_file = os.path.join(silver_path, "laps.parquet")
    return read_parquet_df(laps_file)


@router.get("/laps/{year}/{round}")
async def get_laps(
    year: int,
    round: str,
    valid_only: bool = Query(default=False),
    session_type: Optional[str] = Query(default=None),
) -> List[Dict[str, Any]]:
    """Return lap rows (schema depends on source/parquet)."""
    df = _laps_df(year, round, session_type)
    if df.empty:
        return []
    if valid_only and "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712
    return df.to_dict(orient="records")


@router.get("/laps/{year}/{round}/{driver_id}")
async def get_driver_laps(
    year: int,
    round: str,
    driver_id: str,
    valid_only: bool = Query(default=False),
    session_type: Optional[str] = Query(default=None),
) -> List[Dict[str, Any]]:
    df = _laps_df(year, round, session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")

    driver_mask = None
    if "driver_name" in df.columns:
        driver_mask = df["driver_name"].astype(str) == str(driver_id)
    if "driver_number" in df.columns:
        m = df["driver_number"].astype(str) == str(driver_id)
        driver_mask = m if driver_mask is None else (driver_mask | m)
    if driver_mask is None:
        return []

    df = df[driver_mask]
    if valid_only and "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712
    if "lap_number" in df.columns:
        df = df.sort_values("lap_number")
    return df.to_dict(orient="records")


@router.get("/laps/{year}/{round}/gap-analysis")
async def get_gap_analysis(
    year: int,
    round: str,
    session_type: str = Query(default="R"),
) -> Dict[str, Any]:
    """Gap-to-leader per lap (race trace style)."""
    df = _laps_df(year, round, session_type=session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")
    required = {"driver_number", "lap_number", "lap_time_seconds"}
    if not required.issubset(set(df.columns)):
        raise HTTPException(status_code=422, detail="Missing required lap columns for gap analysis")

    df = df.dropna(subset=["driver_number", "lap_number", "lap_time_seconds"])
    df = df.sort_values(["driver_number", "lap_number"])
    df["race_time"] = df.groupby("driver_number")["lap_time_seconds"].cumsum()

    leader = df.groupby("lap_number")["race_time"].min().rename("leader_time").reset_index()
    merged = df.merge(leader, on="lap_number", how="left")
    merged["gap_to_leader"] = merged["race_time"] - merged["leader_time"]

    name_col = "driver_name" if "driver_name" in merged.columns else None
    driver_keys = merged[name_col].unique().tolist() if name_col else merged["driver_number"].unique().tolist()

    out: Dict[str, Any] = {"drivers": [], "data": {}}
    for drv in driver_keys:
        if name_col:
            ddf = merged[merged[name_col] == drv]
            key = str(drv)
        else:
            ddf = merged[merged["driver_number"] == drv]
            key = str(int(drv))
        cols = ["lap_number", "gap_to_leader"]
        if "position" in ddf.columns:
            cols.append("position")
        out["drivers"].append(key)
        out["data"][key] = ddf[cols].to_dict(orient="records")
    return out


@router.get("/laps/{year}/{round}/head-to-head")
async def get_head_to_head(
    year: int,
    round: str,
    driver1: str,
    driver2: str,
    session_type: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    """Fastest-lap comparison between two drivers."""
    df = _laps_df(year, round, session_type=session_type)
    if df.empty:
        raise HTTPException(status_code=404, detail="Laps data not found")
    if "lap_time_seconds" not in df.columns:
        raise HTTPException(status_code=422, detail="Missing lap_time_seconds")

    # Filter to just the two drivers (by name or number) and valid laps if available.
    mask = pd.Series([False] * len(df))
    if "driver_name" in df.columns:
        mask = mask | (df["driver_name"].astype(str) == driver1) | (df["driver_name"].astype(str) == driver2)
    if "driver_number" in df.columns:
        mask = mask | (df["driver_number"].astype(str) == str(driver1)) | (df["driver_number"].astype(str) == str(driver2))
    df = df[mask]
    if "is_valid_lap" in df.columns:
        df = df[df["is_valid_lap"] == True]  # noqa: E712

    group_cols = [c for c in ("driver_name", "driver_number") if c in df.columns]
    if not group_cols:
        raise HTTPException(status_code=422, detail="Missing driver identity columns")

    fastest = df.groupby(group_cols)["lap_time_seconds"].min().reset_index().sort_values("lap_time_seconds")
    if len(fastest) < 2:
        raise HTTPException(status_code=404, detail="Could not find both drivers with valid laps")

    a = fastest.iloc[0].to_dict()
    b = fastest.iloc[1].to_dict()
    diff = float(b["lap_time_seconds"]) - float(a["lap_time_seconds"])

    def _fmt(seconds: float) -> str:
        m = int(seconds // 60)
        s = seconds % 60
        return f"{m}:{s:06.3f}"

    return {
        "driver_1": {
            "name": str(a.get("driver_name") or ""),
            "number": int(a.get("driver_number") or 0),
            "fastest_lap_formatted": _fmt(float(a["lap_time_seconds"])),
            "fastest_lap_seconds": float(a["lap_time_seconds"]),
        },
        "driver_2": {
            "name": str(b.get("driver_name") or ""),
            "number": int(b.get("driver_number") or 0),
            "fastest_lap_formatted": _fmt(float(b["lap_time_seconds"])),
            "fastest_lap_seconds": float(b["lap_time_seconds"]),
        },
        "difference_seconds": diff,
        "difference": f"{diff:+.3f}",
        "interpretation": f"{b.get('driver_name') or b.get('driver_number')} is {diff:.3f}s slower than {a.get('driver_name') or a.get('driver_number')}",
    }

