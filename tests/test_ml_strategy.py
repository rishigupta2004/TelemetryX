import pandas as pd

from ml import strategy


def test_strategy_results_to_frame():
    results = {
        "S->M": {
            "strategy": "S->M",
            "avg_finish_position": 4.0,
            "avg_points": 12.0,
            "podium_probability": 0.2,
            "points_probability": 0.9,
            "avg_pit_stops": 1.0,
        }
    }
    df = strategy.strategy_results_to_frame(results)
    assert not df.empty
    assert "avg_points" in df.columns


def test_infer_tyre_life_from_features(tmp_path, monkeypatch):
    features_path = tmp_path
    monkeypatch.setattr(strategy, "FEATURES_PATH", features_path)
    race_dir = features_path / "2024" / "Test GP" / "R"
    race_dir.mkdir(parents=True)
    df = pd.DataFrame({
        "tyre_compound": ["Soft", "Soft", "Hard"],
        "tyre_laps_in_stint": [10, 12, 30],
    })
    df.to_parquet(race_dir / "tyre_features.parquet", index=False)
    life = strategy.infer_tyre_life(2024, "Test GP", "R")
    assert life["SOFT"] >= 10
