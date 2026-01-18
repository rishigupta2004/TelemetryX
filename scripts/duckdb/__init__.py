"""DuckDB query scripts for data verification."""

from pathlib import Path
import duckdb

ROOT = Path(__file__).parent.parent.parent
DATA = ROOT / "backend" / "etl" / "data"
VIEWS_DB = ROOT / "views.duckdb"


def query(sql: str, params: tuple = None) -> list:
    """Execute SQL and return results."""
    conn = duckdb.connect(str(VIEWS_DB))
    result = conn.execute(sql, params).fetchall() if params else conn.execute(sql).fetchall()
    conn.close()
    return result


def laps_count(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "Q"):
    """Count laps in bronze layer."""
    path = str((DATA / "silver" / str(year) / race / session).absolute())
    sql = f"SELECT COUNT(*) FROM parquet_scan('{path}/laps.parquet');"
    result = query(sql)
    print(f"Laps: {result[0][0]}")


def telemetry_count(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "R"):
    """Count telemetry records."""
    path = str((DATA / "silver" / str(year) / race / session).absolute())
    sql = f"SELECT COUNT(*) FROM parquet_scan('{path}/telemetry.parquet');"
    result = query(sql)
    print(f"Telemetry records: {result[0][0]}")


def weather_snapshot(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "R"):
    """Show weather data."""
    path = str((DATA / "silver" / str(year) / race / session).absolute())
    sql = f"SELECT * FROM parquet_scan('{path}/weather.parquet') LIMIT 1;"
    result = query(sql)
    print(f"Weather: {result}")


def driver_count(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "Q"):
    """Count unique drivers."""
    path = str((DATA / "silver" / str(year) / race / session).absolute())
    sql = f"SELECT COUNT(DISTINCT driver_name) FROM parquet_scan('{path}/laps.parquet');"
    result = query(sql)
    print(f"Drivers: {result[0][0]}")


def gold_lap_features(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "Q"):
    """Query lap features from gold layer."""
    path = str((DATA / "features" / str(year) / race / session).absolute())
    sql = f"""
        SELECT driver_name, COUNT(*) as laps, AVG(lap_duration) as avg_time, 
               AVG(lap_quality_timecore) as avg_quality
        FROM parquet_scan('{path}/lap_features.parquet')
        GROUP BY driver_name ORDER BY avg_time;
    """
    result = query(sql)
    for row in result:
        print(f"{row[0]}: {row[1]} laps, avg {row[2]:.3f}s, quality {row[3]:.3f}")


def gold_tyre_features(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "Q"):
    """Query tyre features from gold layer."""
    path = str((DATA / "features" / str(year) / race / session).absolute())
    sql = f"""
        SELECT driver_name, tyre_compound, COUNT(DISTINCT stint_number) as stints,
               AVG(tyre_degradation_rate) as avg_deg
        FROM parquet_scan('{path}/tyre_features.parquet')
        GROUP BY 1, 2 ORDER BY driver_name;
    """
    result = query(sql)
    for row in result:
        print(f"{row[0]} ({row[1]}): {row[2]} stints, {row[3]:.4f} deg/lap")


def gold_comparison(year: int = 2024, race: str = "Bahrain Grand Prix", session: str = "R"):
    """Query head-to-head comparisons."""
    path = str((DATA / "features" / str(year) / race / session).absolute())
    sql = f"""
        SELECT driver_1, driver_2, pace_delta, head_to_head_winner
        FROM parquet_scan('{path}/comparison_features.parquet')
        ORDER BY ABS(pace_delta) DESC LIMIT 10;
    """
    result = query(sql)
    for row in result:
        print(f"{row[0]} vs {row[1]}: {row[2]:.3f}s, winner: {row[3]}")


def all_driver_stats():
    """Query aggregated driver stats from all features."""
    sql = """
        SELECT driver_name, 
               COUNT(DISTINCT race_name) as races,
               SUM(total_laps) as total_laps,
               AVG(avg_lap_time) as overall_avg_time
        FROM driver_lap_stats
        GROUP BY driver_name
        ORDER BY overall_avg_time
        LIMIT 20;
    """
    result = query(sql)
    print(f"{'Driver':<20} {'Races':>6} {'Laps':>8} {'Avg Time':>10}")
    print("-" * 46)
    for row in result:
        print(f"{row[0]:<20} {row[1]:>6} {row[2]:>8} {row[3]:>10.3f}s")


def team_performance():
    """Query team performance from tyre stats."""
    sql = """
        SELECT team_name, AVG(avg_degradation) as avg_deg,
               SUM(total_pit_stops) as total_pits
        FROM driver_tyre_stats
        WHERE team_name IS NOT NULL
        GROUP BY team_name
        ORDER BY avg_deg
        LIMIT 10;
    """
    result = query(sql)
    print(f"{'Team':<25} {'Avg Deg':>10} {'Total Pits':>12}")
    print("-" * 49)
    for row in result:
        print(f"{row[0]:<25} {row[1]:>10.4f} {row[2]:>12}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="DuckDB Query Scripts")
    parser.add_argument("--query", type=str, choices=["laps", "telemetry", "weather", "drivers", 
                                                      "gold_laps", "gold_tyre", "gold_comparison",
                                                      "drivers_all", "teams"],
                        default="laps")
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--race", type=str, default="Bahrain Grand Prix")
    parser.add_argument("--session", type=str, default="Q")
    args = parser.parse_args()
    
    queries = {
        "laps": lambda: laps_count(args.year, args.race, args.session),
        "telemetry": lambda: telemetry_count(args.year, args.race, "R"),
        "weather": lambda: weather_snapshot(args.year, args.race, "R"),
        "drivers": lambda: driver_count(args.year, args.race, args.session),
        "gold_laps": lambda: gold_lap_features(args.year, args.race, args.session),
        "gold_tyre": lambda: gold_tyre_features(args.year, args.race, args.session),
        "gold_comparison": lambda: gold_comparison(args.year, args.race, "R"),
        "drivers_all": all_driver_stats,
        "teams": team_performance,
    }
    queries[args.query]()
