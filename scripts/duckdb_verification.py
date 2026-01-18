#!/usr/bin/env python3
"""
DuckDB Verification Queries for TelemetryX Features

Run with: python scripts/duckdb_verification.py
Or directly with duckdb CLI using the SQL queries below.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_PATH = ROOT / "backend" / "etl" / "data"

LAP_FILE = DATA_PATH / "features" / "2024" / "Bahrain Grand Prix" / "Q" / "lap_features.parquet"
RACE_FILE = DATA_PATH / "features" / "2024" / "Bahrain Grand Prix" / "R" / "lap_features.parquet"
TYRE_FILE = DATA_PATH / "features" / "2024" / "Bahrain Grand Prix" / "Q" / "tyre_features.parquet"
RACE_CTX_FILE = DATA_PATH / "features" / "2024" / "Bahrain Grand Prix" / "Q" / "race_context_features.parquet"
TELEMETRY_FILE = DATA_PATH / "features" / "2024" / "Bahrain Grand Prix" / "R" / "telemetry_features.parquet"
COMPARISON_FILE = DATA_PATH / "features" / "2024" / "Bahrain Grand Prix" / "R" / "comparison_features.parquet"


QUERIES = [
    {
        "name": "Test 1: Lap Features Completeness (Q Session)",
        "sql": f"""
            SELECT 
                COUNT(*) as total_laps,
                COUNT(lap_duration) as with_duration,
                COUNT(CASE WHEN is_valid_lap THEN 1 END) as valid_laps,
                COUNT(CASE WHEN is_deleted THEN 1 END) as deleted_laps,
                COUNT(deletion_reason) as with_deletion_reason,
                COUNT(deletion_reason_reconstructed) as with_reconstructed_reason
            FROM parquet_scan('{LAP_FILE}');
        """,
    },
    {
        "name": "Test 2: Sector Time Consistency (Valid Laps Only)",
        "sql": f"""
            SELECT 
                driver_name,
                lap_number,
                ROUND(lap_duration::numeric, 3) as lap_duration,
                ROUND((sector_1_time_time + sector_2_time_time + sector_3_time_time)::numeric, 3) as calculated_total,
                ROUND((lap_duration - (sector_1_time_time + sector_2_time_time + sector_3_time_time))::numeric, 3) as diff
            FROM parquet_scan('{LAP_FILE}')
            WHERE is_valid_lap = true 
            AND lap_duration IS NOT NULL
            AND sector_1_time_time IS NOT NULL
            AND sector_2_time_time IS NOT NULL
            AND sector_3_time_time IS NOT NULL
            ORDER BY diff DESC
            LIMIT 10;
        """,
    },
    {
        "name": "Test 3: Lap Quality Score Distribution",
        "sql": f"""
            SELECT 
                CASE 
                    WHEN lap_quality_timecore >= 90 THEN 'Excellent (90-100)'
                    WHEN lap_quality_timecore >= 80 THEN 'Very Good (80-89)'
                    WHEN lap_quality_timecore >= 70 THEN 'Good (70-79)'
                    WHEN lap_quality_timecore >= 60 THEN 'Average (60-69)'
                    ELSE 'Below Average (<60)'
                END as quality_bucket,
                COUNT(*) as lap_count
            FROM parquet_scan('{LAP_FILE}')
            WHERE is_valid_lap = true AND lap_quality_timecore IS NOT NULL
            GROUP BY 1
            ORDER BY MIN(lap_quality_timecore) DESC;
        """,
    },
    {
        "name": "Test 4: Tyre Features Summary",
        "sql": f"""
            SELECT 
                driver_name,
                COUNT(DISTINCT stint_number) as total_stints,
                ROUND(AVG(tyre_degradation_rate)::numeric, 3) as avg_degradation,
                MAX(tyre_laps_in_stint) as longest_stint_laps,
                SUM(pit_stop_count) as total_pit_stops
            FROM parquet_scan('{TYRE_FILE}')
            GROUP BY driver_name
            ORDER BY avg_degradation DESC
            LIMIT 15;
        """,
    },
    {
        "name": "Test 5: Tyre Strategy Analysis",
        "sql": f"""
            SELECT 
                tyre_strategy_sequence,
                COUNT(*) as usage_count,
                ROUND(AVG(stint_total_time)::numeric, 2) as avg_stint_time
            FROM parquet_scan('{TYRE_FILE}')
            GROUP BY tyre_strategy_sequence
            ORDER BY usage_count DESC
            LIMIT 10;
        """,
    },
    {
        "name": "Test 6: Race Context - Track Status Coverage",
        "sql": f"""
            SELECT 
                COALESCE(track_status_at_lap, 'UNKNOWN') as track_status,
                COUNT(*) as lap_count,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM parquet_scan('{RACE_CTX_FILE}')))::numeric, 1) as percentage
            FROM parquet_scan('{RACE_CTX_FILE}')
            GROUP BY 1
            ORDER BY lap_count DESC;
        """,
    },
    {
        "name": "Test 7: Telemetry Aggregation (Race Session)",
        "sql": f"""
            SELECT 
                driver_name,
                ROUND(AVG(speed_avg)::numeric, 1) as avg_speed,
                MAX(speed_max) as max_speed,
                ROUND(AVG(throttle_avg)::numeric, 1) as avg_throttle,
                ROUND(AVG(brake_avg)::numeric, 1) as avg_brake,
                SUM(drs_activations) as total_drs_activations
            FROM parquet_scan('{TELEMETRY_FILE}')
            GROUP BY driver_name
            ORDER BY avg_speed DESC
            LIMIT 20;
        """,
    },
    {
        "name": "Test 8: Throttle-Brake Correlation",
        "sql": f"""
            SELECT 
                driver_name,
                ROUND(AVG(throttle_brake_correlation)::numeric, 3) as throttle_brake_corr
            FROM parquet_scan('{TELEMETRY_FILE}')
            WHERE throttle_brake_correlation IS NOT NULL
            GROUP BY driver_name
            ORDER BY throttle_brake_corr DESC;
        """,
    },
    {
        "name": "Test 9: Head-to-Head Comparisons (Sample)",
        "sql": f"""
            SELECT 
                driver_1,
                driver_2,
                ROUND(pace_delta::numeric, 3) as pace_delta,
                CASE 
                    WHEN pace_delta < 0 THEN driver_1
                    WHEN pace_delta > 0 THEN driver_2
                    ELSE 'TIED'
                END as faster_driver,
                head_to_head_winner
            FROM parquet_scan('{COMPARISON_FILE}')
            ORDER BY ABS(pace_delta) DESC
            LIMIT 20;
        """,
    },
    {
        "name": "Test 10: Team Comparison Analysis",
        "sql": f"""
            SELECT 
                driver_1_team,
                driver_2_team,
                COUNT(*) as comparisons,
                ROUND(AVG(CASE WHEN head_to_head_winner = driver_1 THEN 1 ELSE 0 END) * 100::numeric, 1) as driver_1_win_pct
            FROM parquet_scan('{COMPARISON_FILE}')
            WHERE driver_1_team != driver_2_team
            GROUP BY driver_1_team, driver_2_team
            ORDER BY comparisons DESC
            LIMIT 15;
        """,
    },
]


def run_query(query_name: str, sql: str) -> bool:
    """Run a single DuckDB query and print results."""
    print(f"\n{'='*70}")
    print(f"📊 {query_name}")
    print(f"{'='*70}")
    
    try:
        result = subprocess.run(
            ["duckdb", "-c", sql],
            capture_output=True,
            text=True,
            cwd=str(ROOT)
        )
        
        if result.returncode != 0:
            print(f"❌ ERROR: {result.stderr}")
            return False
        
        print(result.stdout)
        return True
    
    except FileNotFoundError:
        print("❌ ERROR: duckdb CLI not found. Install with: brew install duckdb")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False


def run_all_queries():
    """Run all verification queries."""
    print("\n" + "="*70)
    print("🦆 TELEMETRYX DUCKDB VERIFICATION SUITE")
    print("="*70)
    print(f"\nWorking directory: {ROOT}")
    print(f"Lap file: {LAP_FILE}")
    print(f"Exists: {LAP_FILE.exists()}")
    
    passed = 0
    failed = 0
    
    for query in QUERIES:
        if run_query(query["name"], query["sql"]):
            passed += 1
        else:
            failed += 1
    
    print(f"\n{'='*70}")
    print(f"📈 SUMMARY: {passed} passed, {failed} failed")
    print(f"{'='*70}")
    
    return failed == 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--single":
        # Run single query by index
        idx = int(sys.argv[2]) - 1
        if 0 <= idx < len(QUERIES):
            run_query(QUERIES[idx]["name"], QUERIES[idx]["sql"])
        else:
            print(f"Invalid query index: {idx}")
    else:
        run_all_queries()
