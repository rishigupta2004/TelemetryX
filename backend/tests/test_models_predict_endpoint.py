import pickle
import json
import os
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402
from api.routers import models as models_router  # noqa: E402


class _DummyScaler:
    def transform(self, X):
        return X


class _DummyModel:
    def predict_proba(self, X):
        _ = X
        return np.array([[0.2, 0.8]])


client = TestClient(app)


def _seed_model(tmp_path: Path) -> None:
    payload = {
        "model": _DummyModel(),
        "scaler": _DummyScaler(),
        "features": [
            "position_before_pit",
            "tyre_age",
            "stint_length",
            "compound_ordinal",
            "track_stress",
            "pit_lap",
        ],
        "compound_order": {"SOFT": 1, "MEDIUM": 2, "HARD": 3},
        "circuit_data": {"default": {"stress": 0.5}},
    }
    with open(tmp_path / "undercut_model.pkl", "wb") as f:
        pickle.dump(payload, f)


def test_post_undercut_predict(monkeypatch, tmp_path):
    _seed_model(tmp_path)
    monkeypatch.setattr(models_router, "MODELS_DIR", str(tmp_path))

    response = client.post(
        "/api/v1/models/undercut/predict",
        json={
            "position_before_pit": 7,
            "tyre_age": 11,
            "stint_length": 13,
            "compound": "MEDIUM",
            "track_temp": 33.0,
            "pit_lap": 18,
            "race_name": "Test GP",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "success_probability" in payload
    assert payload["prediction"] in {"SUCCESS", "FAILURE"}


def test_get_undercut_predict_backwards_compatible(monkeypatch, tmp_path):
    _seed_model(tmp_path)
    monkeypatch.setattr(models_router, "MODELS_DIR", str(tmp_path))

    response = client.get(
        "/api/v1/models/undercut/predict",
        params={
            "position_before_pit": 9,
            "tyre_age": 15,
            "stint_length": 18,
            "compound": "HARD",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "summary" in payload
    assert isinstance(payload["recommendations"], list)


def test_strategy_recommendations_normalizes_sparse_payload(monkeypatch, tmp_path):
    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)

    payload = {
        "year": 2025,
        "race_name": "Test GP",
        "n_simulations": 100,
        "all_strategies": {"SOFT→HARD (Pits: 1)": {"strategy": "SOFT→HARD (Pits: 1)"}},
    }
    (strategy_dir / "2025_Test_GP.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )
    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))

    response = client.get("/api/v1/models/strategy-recommendations/2025/Test%20GP")

    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2025
    assert data["race_name"] == "Test GP"
    assert "best_strategy" in data
    assert "all_strategies" in data
    best = data["best_strategy"]
    assert "avg_points" in best
    assert isinstance(best["avg_points"], float)
    assert isinstance(best["avg_finish_position"], float)


def test_strategy_recommendations_normalizes_empty_payload(monkeypatch, tmp_path):
    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)

    (strategy_dir / "2024_Bahrain_Grand_Prix.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))

    response = client.get(
        "/api/v1/models/strategy-recommendations/2024/Bahrain%20Grand%20Prix"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2024
    assert data["race_name"] == "Bahrain Grand Prix"
    assert data["best_strategy"]["strategy"]
    assert isinstance(data["all_strategies"], dict)


def test_strategy_recommendations_refreshes_payload_after_file_update(
    monkeypatch, tmp_path
):
    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)
    strategy_file = strategy_dir / "2026_Test_GP.json"

    initial_payload = {
        "year": 2026,
        "race_name": "Test GP",
        "n_simulations": 10,
        "all_strategies": {
            "A": {
                "strategy": "A",
                "avg_points": 10.0,
                "avg_finish_position": 5.0,
                "avg_pit_stops": 1.0,
            }
        },
    }
    strategy_file.write_text(json.dumps(initial_payload), encoding="utf-8")
    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))

    first = client.get("/api/v1/models/strategy-recommendations/2026/Test%20GP")
    assert first.status_code == 200
    assert first.json()["all_strategies"]["A"]["avg_points"] == 10.0

    updated_payload = {
        "year": 2026,
        "race_name": "Test GP",
        "n_simulations": 10,
        "all_strategies": {
            "A": {
                "strategy": "A",
                "avg_points": 15.5,
                "avg_finish_position": 4.0,
                "avg_pit_stops": 1.0,
            }
        },
    }
    strategy_file.write_text(json.dumps(updated_payload), encoding="utf-8")
    now_ns = time.time_ns() + 5_000_000
    os.utime(strategy_file, ns=(now_ns, now_ns))

    second = client.get("/api/v1/models/strategy-recommendations/2026/Test%20GP")
    assert second.status_code == 200
    assert second.json()["all_strategies"]["A"]["avg_points"] == 15.5


def test_regulation_simulation_projects_2026_with_fallback(monkeypatch, tmp_path):
    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)
    strategy_payload = {
        "year": 2025,
        "race_name": "Test GP",
        "n_simulations": 1000,
        "all_strategies": {
            "SOFT→HARD (Pits: 1)": {
                "strategy": "SOFT→HARD (Pits: 1)",
                "avg_points": 18.1,
                "avg_finish_position": 3.1,
                "podium_probability": 0.56,
                "avg_pit_stops": 1.0,
            },
            "MEDIUM→HARD (Pits: 1)": {
                "strategy": "MEDIUM→HARD (Pits: 1)",
                "avg_points": 15.9,
                "avg_finish_position": 4.4,
                "podium_probability": 0.38,
                "avg_pit_stops": 1.0,
            },
        },
    }
    (strategy_dir / "2025_Test_GP.json").write_text(
        json.dumps(strategy_payload), encoding="utf-8"
    )

    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))

    response = client.get(
        "/api/v1/models/regulation-simulation/2026/Test%20GP",
        params={
            "target_year": 2026,
            "team_profile": "balanced",
            "n_samples": 400,
            "seed": 7,
        },
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["baseline_year"] == 2026
    assert payload["source_year"] == 2025
    assert payload["target_year"] == 2026
    assert payload["team_profile"] == "balanced"
    assert payload["n_samples"] == 400
    assert isinstance(payload["strategy_projection"], list)
    assert len(payload["strategy_projection"]) >= 1
    assert "lap_time_delta_seconds" in payload["metrics"]
    assert "p50" in payload["metrics"]["lap_time_delta_seconds"]
    assert "diagnostics" in payload
    assert payload["diagnostics"]["cache_hit"] is False

    second = client.get(
        "/api/v1/models/regulation-simulation/2026/Test%20GP",
        params={
            "target_year": 2026,
            "team_profile": "balanced",
            "n_samples": 400,
            "seed": 7,
        },
    )
    assert second.status_code == 200
    assert second.json()["diagnostics"]["cache_hit"] is True


def test_regulation_simulation_compare_supports_multiple_baselines(
    monkeypatch, tmp_path
):
    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)
    strategy_payload = {
        "year": 2025,
        "race_name": "Test GP",
        "n_simulations": 1000,
        "all_strategies": {
            "SOFT→HARD (Pits: 1)": {
                "strategy": "SOFT→HARD (Pits: 1)",
                "avg_points": 18.1,
                "avg_finish_position": 3.1,
                "podium_probability": 0.56,
                "avg_pit_stops": 1.0,
            }
        },
    }
    (strategy_dir / "2025_Test_GP.json").write_text(
        json.dumps(strategy_payload), encoding="utf-8"
    )
    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))

    response = client.get(
        "/api/v1/models/regulation-simulation-compare/Test%20GP",
        params={
            "baselines": [2025, 2022],
            "target_year": 2026,
            "team_profile": "balanced",
            "n_samples": 250,
            "seed": 9,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target_year"] == 2026
    assert payload["selected_baselines"] == [2025, 2022]
    assert len(payload["simulations"]) == 2
    assert all("regulation_diff" in item for item in payload["simulations"])
    assert "diagnostics" in payload
    assert "elapsed_ms_total" in payload["diagnostics"]


def test_regulation_simulation_compare_rejects_invalid_baseline(monkeypatch, tmp_path):
    features_dir = tmp_path / "features"
    strategy_dir = features_dir / "strategy_recommendations"
    strategy_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(models_router, "FEATURES_DIR", str(features_dir))

    response = client.get(
        "/api/v1/models/regulation-simulation-compare/Test%20GP",
        params={"baselines": [2019], "target_year": 2026},
    )

    assert response.status_code == 422
