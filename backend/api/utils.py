import os
import unicodedata
from functools import lru_cache
from typing import Optional, Sequence

import duckdb
import pandas as pd


def normalize_key(value: str) -> str:
    if value is None:
        return ""
    text = value.replace("-", " ").replace("_", " ").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = " ".join(text.split()).lower()
    return text


def normalize_session_code(value: str) -> str:
    """Normalize incoming session codes to on-disk codes.

    Data folders use: Q, R, S, SS
    UI may prefer:     Q, R, S, SR  (SR is treated as alias for SS)
    """
    code = str(value or "").strip().upper()
    if code == "SR":
        return "SS"
    return code


def display_session_code(value: str) -> str:
    """Convert on-disk codes to UI-facing codes."""
    code = normalize_session_code(value)
    return "SR" if code == "SS" else code


@lru_cache(maxsize=2048)
def _list_dir_entries(base_dir: str) -> tuple:
    if not base_dir or not os.path.exists(base_dir):
        return ()
    return tuple(os.listdir(base_dir))


def resolve_dir(base_dir: str, name: str) -> Optional[str]:
    if not base_dir or not os.path.exists(base_dir):
        return None
    direct = os.path.join(base_dir, name)
    if os.path.isdir(direct):
        return name
    target = normalize_key(name)
    for entry in _list_dir_entries(base_dir):
        if os.path.isdir(os.path.join(base_dir, entry)) and normalize_key(entry) == target:
            return entry
    return None


def resolve_track_geometry_file(track_dir: str, race_name: str, year: Optional[int] = None) -> Optional[str]:
    if not track_dir or not os.path.exists(track_dir):
        return None
    slug = normalize_key(race_name).replace(" ", "_")
    if year:
        year_file = os.path.join(track_dir, f"{slug}_{year}.json")
        if os.path.exists(year_file):
            return year_file
        version_dir = os.path.join(track_dir, "versions", slug)
        version_file = os.path.join(version_dir, f"{year}.json")
        if os.path.exists(version_file):
            return version_file
    direct = os.path.join(track_dir, f"{slug}.json")
    if os.path.exists(direct):
        return direct
    target = normalize_key(race_name)
    for entry in _list_dir_entries(track_dir):
        if not entry.endswith(".json"):
            continue
        base = entry[:-5].replace("_", " ")
        if normalize_key(base) == target:
            return os.path.join(track_dir, entry)
    return None


def read_parquet_df(path: str, columns: Optional[Sequence[str]] = None) -> pd.DataFrame:
    """Read a parquet file via DuckDB (avoids requiring pyarrow/fastparquet)."""
    if not path or not os.path.exists(path):
        return pd.DataFrame()
    cols = "*"
    if columns:
        cols = ", ".join([f'"{c}"' for c in columns])
    conn = duckdb.connect()
    try:
        return conn.execute(f"SELECT {cols} FROM read_parquet('{path}')").df()
    finally:
        conn.close()
