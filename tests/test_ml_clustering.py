import pandas as pd

from ml.clustering import build_driver_features, train_clustering


def _feature_frames():
    lap = pd.DataFrame({
        "year": [2024, 2024, 2024, 2024],
        "race_name": ["Test GP"] * 4,
        "session": ["R"] * 4,
        "driver_name": ["Driver A", "Driver A", "Driver B", "Driver C"],
        "lap_duration": [90.0, 91.0, 92.0, 89.5],
        "lap_quality_score": [95, 93, 90, 97],
    })
    position = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP"] * 3,
        "session": ["R"] * 3,
        "driver_name": ["Driver A", "Driver B", "Driver C"],
        "start_position": [3, 5, 1],
        "end_position": [2, 6, 1],
        "position_change": [1, -1, 0],
        "laps_led": [2, 0, 10],
    })
    overtakes = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP"] * 3,
        "session": ["R"] * 3,
        "driver_name": ["Driver A", "Driver B", "Driver C"],
        "overtakes_made": [2, 0, 1],
        "positions_lost_defensive": [0, 1, 0],
        "net_position_change": [1, -1, 0],
    })
    traffic = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP"] * 3,
        "session": ["R"] * 3,
        "driver_name": ["Driver A", "Driver B", "Driver C"],
        "avg_lap_time": [90.5, 92.0, 89.5],
        "estimated_time_lost": [1.2, 3.0, 0.5],
    })
    tyre = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP"] * 3,
        "session": ["R"] * 3,
        "driver_name": ["Driver A", "Driver B", "Driver C"],
        "stint_number": [1, 1, 1],
        "tyre_laps_in_stint": [12, 14, 10],
        "tyre_degradation_rate": [0.02, 0.03, 0.01],
        "pit_stop_count": [1, 2, 1],
        "grip_level": [0.8, 0.75, 0.85],
    })
    telemetry = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP"] * 3,
        "session": ["R"] * 3,
        "driver_name": ["Driver A", "Driver B", "Driver C"],
        "speed_max": [320, 315, 325],
        "speed_avg": [280, 275, 285],
        "throttle_avg": [70, 68, 72],
        "brake_avg": [15, 14, 13],
        "drs_usage_pct": [0.2, 0.15, 0.25],
    })
    points = pd.DataFrame({
        "year": [2024, 2024, 2024],
        "race_name": ["Test GP"] * 3,
        "session": ["R"] * 3,
        "driver_name": ["Driver A", "Driver B", "Driver C"],
        "points": [18, 8, 25],
        "final_position": [2, 6, 1],
    })
    return {
        "lap": lap,
        "position": position,
        "overtakes": overtakes,
        "traffic": traffic,
        "tyre": tyre,
        "telemetry": telemetry,
        "points": points,
    }


def test_build_driver_features():
    frames = _feature_frames()
    df = build_driver_features(year=2024, race="Test GP", session="R", feature_frames=frames)
    assert not df.empty
    assert "avg_lap" in df.columns
    assert "position_gain" in df.columns


def test_train_clustering_with_feature_frames():
    frames = _feature_frames()
    df, metrics = train_clustering(n_clusters=2, year=2024, race="Test GP", session="R", feature_frames=frames, verbose=False)
    assert not df.empty
    assert "cluster" in df.columns
    assert "features_used" in metrics
