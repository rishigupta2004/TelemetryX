"""Shared utilities."""

from pathlib import Path
import pandas as pd

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
SILVER_PATH = DATA_PATH / "silver"
FEATURES_PATH = DATA_PATH / "features"

_session_cache = {}


def load_session(year: int, race: str, session: str, use_cache: bool = True) -> dict:
    """Load all parquet files for a session."""
    key = f"{year}/{race}/{session}"
    if use_cache and key in _session_cache:
        return _session_cache[key]

    path = SILVER_PATH / str(year) / race / session
    if not path.exists():
        raise FileNotFoundError(f"Session not found: {path}")

    data = {pf.stem.lower().replace("fastf1_", "").replace("openf1_", ""): pd.read_parquet(pf) for pf in path.glob("*.parquet")}

    if use_cache:
        _session_cache[key] = data
    return data


def clear_cache():
    """Clear the session cache."""
    global _session_cache
    _session_cache = {}


def save_features(df: pd.DataFrame, year: int, race: str, session: str, name: str):
    """Save features to parquet."""
    out = FEATURES_PATH / str(year) / race / session
    out.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out / f"{name}.parquet", index=False)
    print(f"Saved: {out / f'{name}.parquet'} ({len(df)} rows)")


def ensure_driver_identity(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure driver_name/driver_number are present."""
    if "driver_name" not in df.columns and "driver_number" in df.columns:
        df["driver_name"] = df["driver_number"].astype(str)
    if "driver_number" not in df.columns and "driver_name" in df.columns:
        df["driver_number"] = None
    return df


def tdelta_to_seconds(val) -> float:
    """Convert timedelta to seconds."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, pd.Timedelta):
        return val.total_seconds()
    return None


def tdelta_to_formatted(val) -> str:
    """Convert seconds to formatted lap time."""
    seconds = tdelta_to_seconds(val)
    if seconds is None or pd.isna(seconds):
        return None
    seconds = round(float(seconds), 3)
    return f"{int(seconds // 60)}:{seconds % 60:06.3f}"
