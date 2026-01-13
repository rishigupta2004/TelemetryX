"""Parquet storage and DuckDB queries."""
import polars as pl
import duckdb
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data"
BRONZE_DIR = DATA_DIR / "bronze"


def save_laps(laps_df: pl.DataFrame, year: int, round_num: int):
    """Save laps DataFrame to Parquet."""
    path = BRONZE_DIR / str(year) / f"round_{round_num:02d}"
    path.mkdir(parents=True, exist_ok=True)
    laps_df.write_parquet(path / "laps.parquet")
    return path / "laps.parquet"


def save_telemetry(telemetry_df, year: int, round_num: int, driver: str):
    """Save telemetry DataFrame to Parquet."""
    path = BRONZE_DIR / str(year) / f"round_{round_num:02d}" / "telemetry"
    path.mkdir(parents=True, exist_ok=True)
    
    # FastF1 Telemetry is pandas-based, convert to polars
    import pandas as pd
    if isinstance(telemetry_df, pd.DataFrame):
        df = pl.from_pandas(telemetry_df.reset_index())
    else:
        df = telemetry_df
    
    df.write_parquet(path / f"{driver}.parquet")
    return path / f"{driver}.parquet"


def load_laps(year: int, round_num: int) -> pl.DataFrame:
    """Load laps from Parquet."""
    path = BRONZE_DIR / str(year) / f"round_{round_num:02d}" / "laps.parquet"
    return pl.read_parquet(path)


def load_telemetry(year: int, round_num: int, driver: str) -> pl.DataFrame:
    """Load driver telemetry from Parquet."""
    path = BRONZE_DIR / str(year) / f"round_{round_num:02d}" / "telemetry" / f"{driver}.parquet"
    return pl.read_parquet(path)


def query(sql: str) -> pl.DataFrame:
    """Run SQL query against Parquet files using DuckDB."""
    con = duckdb.connect()
    con.execute(f"SET file_search_path = '{BRONZE_DIR}'")
    result = con.execute(sql).pl()
    con.close()
    return result


def get_parquet_path(year: int, round_num: int) -> str:
    """Get path pattern for DuckDB queries."""
    return str(BRONZE_DIR / str(year) / f"round_{round_num:02d}" / "laps.parquet")
