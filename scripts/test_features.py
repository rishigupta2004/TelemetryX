"""Comprehensive feature testing suite."""

import sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))

from features.lap import build_lap_features
from features.tyre import build_tyre_features
from features.telemetry import build_telemetry_features
from features.race_context import build_race_context_features
from features.comparison import build_comparison_features
from features.position import build_position_features
from features.overtakes import build_overtake_features
from features.traffic import build_traffic_features
from features.points import build_points_features

TESTS = {
    "lap": {"func": build_lap_features, "cols": ["driver_name", "lap_number", "lap_duration", "is_valid_lap", "lap_quality_score", "position", "tyre_compound", "tyre_age_laps"]},
    "tyre": {"func": build_tyre_features, "cols": ["driver_name", "stint_number", "tyre_compound", "tyre_degradation_rate", "pit_stop_count"]},
    "telemetry": {"func": build_telemetry_features, "cols": ["driver_name", "speed_max", "speed_avg", "throttle_avg", "brake_avg"]},
    "race_context": {"func": build_race_context_features, "cols": ["lap_number", "track_status_at_lap", "weather_conditions"]},
    "comparison": {"func": build_comparison_features, "cols": ["driver_1", "driver_2", "pace_delta", "head_to_head_winner"]},
    "position": {"func": build_position_features, "cols": ["driver_name", "start_position", "end_position", "position_change"]},
    "overtakes": {"func": build_overtake_features, "cols": ["driver_number", "overtakes_made", "positions_lost_defensive"]},
    "traffic": {"func": build_traffic_features, "cols": ["driver_name", "laps_in_traffic", "estimated_time_lost"]},
    "points": {"func": build_points_features, "cols": ["driver_name", "final_position", "points"]},
}


def test_feature(name: str, year: int, race: str, session: str) -> dict:
    func = TESTS[name]["func"]
    cols = TESTS[name]["cols"]
    df = func(year, race, session)
    
    result = {"passed": 0, "failed": 0, "errors": []}
    if df.empty:
        result["failed"] = 1
        result["errors"].append("Empty dataframe")
        return result
    
    for col in cols:
        if col in df.columns:
            result["passed"] += 1
        else:
            result["failed"] += 1
            result["errors"].append(f"Missing: {col}")
    
    return result


def run_all(year: int, race: str, session: str):
    print(f"\n{'='*60}")
    print(f"FEATURE TEST SUITE: {year} {race} {session}")
    print(f"{'='*60}")
    
    total_passed = total_failed = 0
    
    for name in TESTS:
        result = test_feature(name, year, race, session)
        total_passed += result["passed"]
        total_failed += result["failed"]
        
        status = "✅" if result["failed"] == 0 else "❌"
        print(f"{status} {name}: {result['passed']}/{result['passed'] + result['failed']}")
        for err in result["errors"]:
            print(f"   - {err}")
    
    print(f"\nTotal: {total_passed} passed, {total_failed} failed")
    return total_failed == 0


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Feature Test Suite")
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--race", type=str, default="Bahrain Grand Prix")
    parser.add_argument("--session", type=str, default="Q")
    args = parser.parse_args()
    run_all(args.year, args.race, args.session)
