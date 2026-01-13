"""Analysis queries for F1 data."""
import polars as pl
from src.storage.parquet_store import load_laps, load_telemetry, query, get_parquet_path


def get_driver_laps(year: int, round_num: int, driver: str) -> pl.DataFrame:
    """Get all laps for a specific driver."""
    laps = load_laps(year, round_num)
    return laps.filter(pl.col("Driver") == driver).sort("LapNumber")


def compare_drivers(year: int, round_num: int, d1: str, d2: str) -> pl.DataFrame:
    """Compare lap times between two drivers."""
    laps = load_laps(year, round_num)
    
    d1_laps = laps.filter(pl.col("Driver") == d1).select(["LapNumber", "LapTime"]).rename({"LapTime": f"{d1}_time"})
    d2_laps = laps.filter(pl.col("Driver") == d2).select(["LapNumber", "LapTime"]).rename({"LapTime": f"{d2}_time"})
    
    comparison = d1_laps.join(d2_laps, on="LapNumber", how="inner")
    comparison = comparison.with_columns(
        (pl.col(f"{d1}_time") - pl.col(f"{d2}_time")).alias("delta")
    )
    return comparison


def get_stint_summary(year: int, round_num: int, driver: str) -> pl.DataFrame:
    """Get stint breakdown for a driver."""
    laps = load_laps(year, round_num)
    driver_laps = laps.filter(pl.col("Driver") == driver)
    
    return driver_laps.group_by("Stint", "Compound").agg([
        pl.count().alias("laps"),
        pl.col("LapTime").mean().alias("avg_time"),
        pl.col("LapTime").min().alias("best_time"),
        pl.col("TyreLife").max().alias("tyre_age"),
    ]).sort("Stint")


def get_fastest_laps(year: int, round_num: int) -> pl.DataFrame:
    """Get fastest lap for each driver."""
    path = get_parquet_path(year, round_num)
    return query(f'''
        SELECT Driver, MIN(LapTime) as fastest_lap, 
               FIRST(Compound) as compound,
               FIRST(LapNumber) as lap_number
        FROM read_parquet("{path}")
        WHERE LapTime IS NOT NULL
        GROUP BY Driver
        ORDER BY fastest_lap
    ''')


def get_race_summary(year: int, round_num: int) -> pl.DataFrame:
    """Get race summary stats per driver."""
    path = get_parquet_path(year, round_num)
    return query(f'''
        SELECT 
            Driver,
            COUNT(*) as total_laps,
            MIN(LapTime) as fastest_lap,
            AVG(LapTime) as avg_lap,
            MAX(Position) as finish_position
        FROM read_parquet("{path}")
        WHERE LapTime IS NOT NULL
        GROUP BY Driver
        ORDER BY finish_position
    ''')
