import pickle
import json
import sys
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
        "all_strategies": {
            "SOFT→HARD (Pits: 1)": {
                "strategy": "SOFT→HARD (Pits: 1)"
            }
        }
    }
    (strategy_dir / "2025_Test_GP.json").write_text(json.dumps(payload), encoding="utf-8")
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

    response = client.get("/api/v1/models/strategy-recommendations/2024/Bahrain%20Grand%20Prix")

    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2024
    assert data["race_name"] == "Bahrain Grand Prix"
    assert data["best_strategy"]["strategy"]
    assert isinstance(data["all_strategies"], dict)
