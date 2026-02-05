import pandas as pd

from features.reporting import (
    summarize_lap_features,
    summarize_tyre_features,
    summarize_telemetry_features,
    summarize_race_context_features,
)


def test_summarize_lap_features():
    df = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP", "Test GP", "Test GP"],
        "session": ["R", "R", "R"],
        "driver_name": ["Driver A", "Driver A", "Driver B"],
        "lap_duration": [90.0, 92.0, 91.0],
        "lap_quality_score": [95, 90, 93],
        "is_valid_lap": [True, True, True],
        "is_deleted": [False, False, False],
        "sector_1_time": [30.0, 31.0, 30.5],
        "sector_2_time": [30.0, 31.0, 30.5],
        "sector_3_time": [30.0, 30.0, 30.0],
    })
    race_summary, year_summary = summarize_lap_features(df)
    assert not race_summary.empty
    assert not year_summary.empty
    assert "lap_consistency" in race_summary.columns


def test_summarize_tyre_features():
    df = pd.DataFrame({
        "year": [2024, 2024],
        "race_name": ["Test GP", "Test GP"],
        "session": ["R", "R"],
        "driver_name": ["Driver A", "Driver B"],
        "stint_number": [1, 1],
        "tyre_laps_in_stint": [12, 14],
        "tyre_degradation_rate": [0.02, 0.03],
        "pit_stop_count": [1, 2],
        "grip_level": [0.8, 0.75],
        "traffic_density": [1.5, 2.0],
        "tyre_gap_ahead": [0.5, 0.7],
        "tyre_gap_behind": [0.6, 0.4],
    })
    race_summary, year_summary = summarize_tyre_features(df)
    assert not race_summary.empty
    assert not year_summary.empty
    assert "avg_degradation" in race_summary.columns


def test_summarize_telemetry_features():
    df = pd.DataFrame({
        "year": [2024, 2024],
        "race_name": ["Test GP", "Test GP"],
        "session": ["R", "R"],
        "driver_name": ["Driver A", "Driver B"],
        "speed_max": [320, 315],
        "speed_avg": [280, 275],
        "speed_std": [10, 12],
        "throttle_avg": [70, 68],
        "throttle_std": [5, 6],
        "brake_avg": [15, 14],
        "brake_std": [3, 4],
        "drs_activations": [12, 8],
        "drs_usage_pct": [0.2, 0.15],
        "rpm_max": [12000, 11800],
        "gear_changes": [40, 38],
        "coast_pct": [0.05, 0.06],
        "throttle_brake_correlation": [0.1, 0.12],
    })
    race_summary, year_summary = summarize_telemetry_features(df)
    assert not race_summary.empty
    assert not year_summary.empty
    assert "speed_max" in race_summary.columns


def test_summarize_race_context_features():
    df = pd.DataFrame({
        "year": [2024, 2024],
        "race_name": ["Test GP", "Test GP"],
        "session": ["R", "R"],
        "yellow_flag_periods": [2, 1],
        "red_flag_periods": [0, 0],
        "safety_car_deployed": [1, 0],
        "vsc_deployed": [0, 1],
        "race_control_incidents": [3, 2],
        "air_temperature": [25, 26],
        "track_temperature": [40, 41],
        "humidity": [50, 55],
        "wind_speed": [10, 11],
        "weather_conditions": ["DRY", "DRY"],
    })
    race_summary, year_summary = summarize_race_context_features(df)
    assert not race_summary.empty
    assert not year_summary.empty
    assert "yellow_flag_periods" in race_summary.columns
