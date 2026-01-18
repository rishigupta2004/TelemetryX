"""Create and manage DuckDB materialized views."""

from pathlib import Path
import duckdb

ROOT = Path(__file__).parent.parent
VIEWS_DB = ROOT / "views.duckdb"
FEATURES_PATH = ROOT / "backend" / "etl" / "data" / "features"

VIEWS = {
    "driver_lap_stats": f"""
        CREATE OR REPLACE VIEW driver_lap_stats AS
        SELECT year, race_name, session, driver_name,
               COUNT(*) as total_laps,
               AVG(lap_duration) as avg_lap_time,
               MIN(lap_duration) as fastest_lap,
               AVG(lap_quality_timecore) as avg_quality
        FROM parquet_scan('{FEATURES_PATH}/**/lap_features.parquet')
        GROUP BY 1, 2, 3, 4;
    """,
    "driver_tyre_stats": f"""
        CREATE OR REPLACE VIEW driver_tyre_stats AS
        SELECT year, race_name, session, driver_name, tyre_compound,
               COUNT(DISTINCT stint_number) as total_stints,
               AVG(tyre_degradation_rate) as avg_degradation,
               SUM(pit_stop_count) as total_pit_stops,
               AVG(tyre_laps_in_stint) as avg_stint_length
        FROM parquet_scan('{FEATURES_PATH}/**/tyre_features.parquet')
        GROUP BY 1, 2, 3, 4, 5;
    """,
    "head_to_head": f"""
        CREATE OR REPLACE VIEW head_to_head AS
        SELECT year, race_name, session, driver_1, driver_2,
               pace_delta, head_to_head_winner, same_team
        FROM parquet_scan('{FEATURES_PATH}/**/comparison_features.parquet');
    """,
    "position_progression": f"""
        CREATE OR REPLACE VIEW position_progression AS
        SELECT year, race_name, session, driver_name,
               start_position, end_position, position_change,
               best_position, worst_position
        FROM parquet_scan('{FEATURES_PATH}/**/position_features.parquet');
    """,
    "traffic_impact": f"""
        CREATE OR REPLACE VIEW traffic_impact AS
        SELECT year, race_name, session, driver_name,
               laps_in_traffic, estimated_time_lost
        FROM parquet_scan('{FEATURES_PATH}/**/traffic_features.parquet');
    """,
    "driver_clustering_features": f"""
        CREATE OR REPLACE VIEW driver_clustering_features AS
        SELECT 
            l.year, l.race_name, l.session, l.driver_name, l.team_name,
            COUNT(*) as total_laps,
            AVG(l.lap_duration) as avg_lap_time,
            MIN(l.lap_duration) as fastest_lap,
            STDDEV(l.lap_duration) as lap_time_std,
            AVG(l.lap_quality_timecore) as avg_quality_score,
            MAX(t.tyre_degradation_rate) as max_degradation,
            AVG(t.tyre_laps_in_stint) as avg_stint_length,
            SUM(t.pit_stop_count) as total_pit_stops,
            p.start_position, p.end_position, p.position_change
        FROM parquet_scan('{FEATURES_PATH}/**/lap_features.parquet') l
        LEFT JOIN parquet_scan('{FEATURES_PATH}/**/tyre_features.parquet') t
            ON l.year = t.year AND l.race_name = t.race_name 
            AND l.session = t.session AND l.driver_name = t.driver_name
        LEFT JOIN parquet_scan('{FEATURES_PATH}/**/position_features.parquet') p
            ON l.year = p.year AND l.race_name = p.race_name 
            AND l.session = p.session AND l.driver_name = p.driver_name
        WHERE l.is_valid_lap = true
        GROUP BY 1, 2, 3, 4, 5;
    """,
}


def create_views():
    """Create all views."""
    conn = duckdb.connect(str(VIEWS_DB))
    for name, sql in VIEWS.items():
        conn.execute(sql)
        print(f"✅ Created view: {name}")
    conn.close()
    print(f"\nViews saved to: {VIEWS_DB}")


def list_views():
    """List existing views."""
    conn = duckdb.connect(str(VIEWS_DB))
    views = conn.execute("SELECT view_name FROM information_schema.views").fetchall()
    conn.close()
    return [v[0] for v in views]


def drop_view(name: str):
    """Drop a specific view."""
    conn = duckdb.connect(str(VIEWS_DB))
    conn.execute(f"DROP VIEW IF EXISTS {name}")
    conn.close()
    print(f"🗑️ Dropped view: {name}")


def query_view(name: str, limit: int = 10):
    """Query a view."""
    conn = duckdb.connect(str(VIEWS_DB))
    result = conn.execute(f"SELECT * FROM {name} LIMIT {limit};").fetchall()
    conn.close()
    return result


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="DuckDB Views Manager")
    parser.add_argument("--create", action="store_true", help="Create all views")
    parser.add_argument("--list", action="store_true", help="List existing views")
    parser.add_argument("--drop", type=str, help="Drop a specific view")
    parser.add_argument("--query", type=str, help="Query a specific view")
    args = parser.parse_args()
    
    if args.create:
        create_views()
    elif args.list:
        print("Existing views:", list_views())
    elif args.drop:
        drop_view(args.drop)
    elif args.query:
        print(query_view(args.query))
