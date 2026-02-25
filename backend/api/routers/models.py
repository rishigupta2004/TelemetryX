from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
import pandas as pd
import json
import os
import pickle
import numpy as np
from pydantic import BaseModel
from ..utils import read_parquet_df
from ..config import MODELS_DIR, FEATURES_DIR
from ..utils import normalize_key

_strategy_payload_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
_undercut_bundle_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}

def convert_numpy(obj):
    if isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(v) for v in obj]
    elif isinstance(obj, (np.integer, np.int64)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64)):
        return float(obj)
    return obj

router = APIRouter()


class UndercutPredictRequest(BaseModel):
    position_before_pit: int
    tyre_age: int
    stint_length: int
    compound: str
    track_temp: float = 30.0
    pit_lap: int = 15
    race_name: str = "Bahrain Grand Prix"


class StrategyRecommendationItem(BaseModel):
    strategy: str
    avg_finish_position: float
    avg_points: float
    podium_probability: Optional[float] = None
    points_probability: Optional[float] = None
    avg_pit_stops: float
    compounds: Optional[List[str]] = None
    pit_laps: Optional[List[int]] = None


class StrategyRecommendationsPayload(BaseModel):
    year: int
    race_name: str
    n_simulations: int
    best_strategy: StrategyRecommendationItem
    all_strategies: Dict[str, StrategyRecommendationItem]


def _strategy_recommendations_path(year: int, race_name: str) -> Optional[str]:
    strategy_dir = os.path.join(FEATURES_DIR, "strategy_recommendations")
    if not os.path.exists(strategy_dir):
        return None
    direct = os.path.join(
        strategy_dir,
        f"{int(year)}_{str(race_name or '').replace(' ', '_')}.json",
    )
    if os.path.exists(direct):
        return direct
    target = normalize_key(race_name)
    prefix = f"{int(year)}_"
    for fname in os.listdir(strategy_dir):
        if not fname.endswith(".json") or not fname.startswith(prefix):
            continue
        stem = fname[:-5]
        race_part = stem[len(prefix):].replace("_", " ")
        if normalize_key(race_part) == target:
            return os.path.join(strategy_dir, fname)
    return None


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _to_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return int(default)
        return int(value)
    except Exception:
        return int(default)


def _normalize_strategy_item(raw: Any, fallback_name: str) -> Dict[str, Any]:
    item = raw if isinstance(raw, dict) else {}
    compounds = item.get("compounds")
    pit_laps = item.get("pit_laps")
    return {
        "strategy": str(item.get("strategy") or fallback_name),
        "avg_finish_position": _to_float(item.get("avg_finish_position"), 20.0),
        "avg_points": _to_float(item.get("avg_points"), 0.0),
        "podium_probability": _to_float(item.get("podium_probability"), 0.0),
        "points_probability": _to_float(item.get("points_probability"), 0.0),
        "avg_pit_stops": _to_float(item.get("avg_pit_stops"), 0.0),
        "compounds": [str(v) for v in compounds] if isinstance(compounds, list) else None,
        "pit_laps": [_to_int(v, 0) for v in pit_laps] if isinstance(pit_laps, list) else None,
    }


def _normalize_strategy_payload(raw_payload: Any, expected_year: int, expected_race_name: str) -> Dict[str, Any]:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    all_raw = payload.get("all_strategies")
    normalized_all: Dict[str, Dict[str, Any]] = {}
    if isinstance(all_raw, dict):
        for name, item in all_raw.items():
            strategy_name = str(name)
            normalized_all[strategy_name] = _normalize_strategy_item(item, strategy_name)

    best_raw = payload.get("best_strategy")
    if isinstance(best_raw, dict):
        best_strategy = _normalize_strategy_item(best_raw, str(best_raw.get("strategy") or "Best Strategy"))
    elif normalized_all:
        best_strategy = max(normalized_all.values(), key=lambda x: _to_float(x.get("avg_points"), 0.0))
    else:
        best_strategy = _normalize_strategy_item({}, "Unknown")

    best_name = str(best_strategy.get("strategy") or "Unknown")
    if best_name not in normalized_all:
        normalized_all[best_name] = best_strategy

    return {
        "year": _to_int(payload.get("year"), int(expected_year)),
        "race_name": str(payload.get("race_name") or expected_race_name),
        "n_simulations": _to_int(payload.get("n_simulations"), 0),
        "best_strategy": best_strategy,
        "all_strategies": normalized_all,
    }


@router.get("/models/clustering")
async def get_driver_clusters(probabilities: bool = False, driver: Optional[str] = None) -> Dict[str, Any]:
    """Get driver clustering model results."""
    clusters_file = os.path.join(MODELS_DIR, "driver_clusters_performance.parquet")
    info_file = os.path.join(MODELS_DIR, "clustering_performance_info.json")

    if not os.path.exists(clusters_file):
        raise HTTPException(status_code=404, detail="Clustering model not found")

    df = read_parquet_df(clusters_file)
    if os.path.exists(info_file):
        with open(info_file, "r", encoding="utf-8") as f:
            info = json.load(f)
    else:
        info = {}

    if driver:
        row = df[df["driver_name"].str.upper() == driver.upper()]
        if row.empty:
            raise HTTPException(status_code=404, detail=f"Driver {driver} not found")
        row = row.iloc[0]
        prob_cols = [c for c in df.columns if c.startswith("prob_cluster_")]
        return convert_numpy({
            "driver_name": row["driver_name"], "cluster": int(row["cluster"]),
            "cluster_label": row.get("cluster_label", "Unknown"),
            "probabilities": {int(c.split("_")[-1]): float(row[c]) for c in prob_cols} if probabilities else None,
            "features": {f: float(row[f]) for f in info.get("features", []) if f in row and pd.notna(row[f])}
        })

    prob_cols = [c for c in df.columns if c.startswith("prob_cluster_")]
    return {
        "status": "success", "n_drivers": len(df),
        "n_clusters": len(prob_cols) if prob_cols else df["cluster"].nunique(),
        "silhouette_score": info.get("silhouette_score", 0),
        "cluster_labels": info.get("labels", {}),
        "clusters": [{"driver_name": r["driver_name"], "cluster": int(r["cluster"]),
                      "probabilities": {int(c.split("_")[-1]): float(r[c]) for c in prob_cols} if probabilities else None}
                     for _, r in df.iterrows()]
    }


@router.get("/models/clustering/{cluster_label}")
async def get_cluster_drivers(cluster_label: str) -> Dict[str, Any]:
    """Get all drivers in a specific cluster."""
    clusters_file = os.path.join(MODELS_DIR, "driver_clusters_performance.parquet")
    info_file = os.path.join(MODELS_DIR, "clustering_performance_info.json")

    if not os.path.exists(clusters_file):
        raise HTTPException(status_code=404, detail="Clustering model not found")

    if os.path.exists(info_file):
        with open(info_file, "r", encoding="utf-8") as f:
            info = json.load(f)
    else:
        info = {}
    df = read_parquet_df(clusters_file)
    labels = info.get("labels", {})

    reverse_labels = {v.lower(): k for k, v in labels.items()}
    if cluster_label.lower() not in reverse_labels:
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_label}' not found")

    cluster_id = int(reverse_labels[cluster_label.lower()])
    drivers = df[df["cluster"] == cluster_id]["driver_name"].tolist()

    return {"status": "success", "cluster": cluster_label, "n_drivers": len(drivers), "drivers": drivers}


@router.get("/models/undercut")
async def get_undercut_analysis(sample_limit: int = Query(default=20, ge=0, le=200)) -> Dict[str, Any]:
    """Get undercut analysis and model info."""
    events_file = os.path.join(MODELS_DIR, "undercut_events.parquet")
    info_file = os.path.join(MODELS_DIR, "undercut_info.json")

    if not os.path.exists(events_file):
        raise HTTPException(status_code=404, detail="Undercut model not found")

    if os.path.exists(info_file):
        with open(info_file, "r", encoding="utf-8") as f:
            info = json.load(f)
    else:
        info = {}
    df = read_parquet_df(events_file)
    success_df = df[df["undercut_success"] == 1]

    return {
        "status": "success", "model": info.get("model", "unknown"),
        "n_events": len(df), "n_undercuts": int(success_df.shape[0]),
        "undercut_rate": float(success_df.shape[0] / len(df)) if len(df) > 0 else 0,
        "features": info.get("features", []), "feature_importance": info.get("feature_importance", {}),
        "train_accuracy": info.get("train_accuracy", 0), "test_accuracy": info.get("test_accuracy", 0),
        "train_auc": info.get("train_auc", 0), "test_auc": info.get("test_auc", 0),
        "n_races": info.get("n_races", df[["year", "race_name"]].drop_duplicates().shape[0]),
        "trained_at": info.get("trained_at"),
        "analysis": {"avg_position_gain_success": float(success_df["position_change"].mean()) if not success_df.empty else 0},
        "sample_events": df.head(int(sample_limit)).to_dict(orient="records"),
    }


def _predict_undercut_core(
    position_before_pit: int, tyre_age: int, stint_length: int, compound: str,
    track_temp: float = 30.0, pit_lap: int = 15, race_name: str = "Bahrain Grand Prix"
) -> Dict[str, Any]:
    if position_before_pit < 1 or position_before_pit > 20:
        raise HTTPException(status_code=422, detail="position_before_pit must be within 1-20")
    if tyre_age < 0 or tyre_age > 80:
        raise HTTPException(status_code=422, detail="tyre_age must be within 0-80")
    if stint_length < 1 or stint_length > 90:
        raise HTTPException(status_code=422, detail="stint_length must be within 1-90")
    if pit_lap < 1 or pit_lap > 90:
        raise HTTPException(status_code=422, detail="pit_lap must be within 1-90")
    if track_temp < -10 or track_temp > 80:
        raise HTTPException(status_code=422, detail="track_temp must be within -10 to 80")

    model_file = os.path.join(MODELS_DIR, "undercut_model.pkl")
    if not os.path.exists(model_file):
        raise HTTPException(status_code=404, detail="Undercut model not found")
    model_mtime = float(os.path.getmtime(model_file))
    cached_bundle = _undercut_bundle_cache.get(model_file)
    if cached_bundle and cached_bundle[0] == model_mtime:
        model_data = cached_bundle[1]
    else:
        with open(model_file, "rb") as f:
            model_data = pickle.load(f)
        _undercut_bundle_cache[model_file] = (model_mtime, model_data)

    model, scaler, features = model_data["model"], model_data["scaler"], model_data["features"]
    compound_order = model_data.get("compound_order", {})
    circuit_data = model_data.get("circuit_data", {})

    compound_ord = compound_order.get(compound.upper(), 3)
    race_key = normalize_key(str(race_name))
    race_circuit = None
    if isinstance(circuit_data, dict):
        race_circuit = circuit_data.get(race_name)
        if not isinstance(race_circuit, dict):
            for key, value in circuit_data.items():
                if normalize_key(str(key)) == race_key and isinstance(value, dict):
                    race_circuit = value
                    break
    if not isinstance(race_circuit, dict):
        race_circuit = circuit_data.get("default", {"stress": 0.5}) if isinstance(circuit_data, dict) else {"stress": 0.5}
    if not isinstance(race_circuit, dict):
        race_circuit = {"stress": 0.5}

    base_stress = float(race_circuit.get("stress", 0.5))
    temp_adjustment = max(-0.2, min(0.2, (float(track_temp) - 30.0) / 50.0))
    track_stress = max(0.0, min(1.0, base_stress + temp_adjustment))

    feature_row = {
        "position_before_pit": int(position_before_pit),
        "tyre_age": int(tyre_age),
        "stint_length": int(stint_length),
        "compound_ordinal": int(compound_ord),
        "track_stress": float(track_stress),
        "track_temp": float(track_temp),
        "pit_lap": int(pit_lap),
    }
    missing_features = [f for f in features if f not in feature_row]
    if missing_features:
        raise HTTPException(
            status_code=500,
            detail=f"Undercut model requires unsupported features: {', '.join(missing_features)}",
        )

    X = pd.DataFrame([feature_row])[features]
    prob = model.predict_proba(scaler.transform(X))[0][1]
    prediction = "SUCCESS" if prob > 0.5 else "FAILURE"
    confidence = "high" if abs(prob - 0.5) > 0.3 else "medium" if abs(prob - 0.5) > 0.15 else "low"
    recommendations = ["High tyre age reduces undercut success - consider extending stint"] if tyre_age > 15 else \
                     ["Pushing from outside top 10 - undercut less effective"] if position_before_pit > 10 else []
    if prediction == "SUCCESS":
        summary = f"Projected undercut success is {round(float(prob) * 100)}% with {confidence} confidence."
        strategy_call = "Attack this window if pit lane traffic is clear."
    else:
        summary = f"Projected undercut success is only {round(float(prob) * 100)}% with {confidence} confidence."
        strategy_call = "Delay the stop or prioritize track position over the undercut."

    return {
        "prediction": prediction,
        "success_probability": round(float(prob), 4),
        "confidence": confidence,
        "summary": summary,
        "strategy_call": strategy_call,
        "recommendations": recommendations,
    }


@router.get("/models/undercut/predict")
async def predict_undercut(
    position_before_pit: int, tyre_age: int, stint_length: int, compound: str,
    track_temp: float = 30.0, pit_lap: int = 15, race_name: str = "Bahrain Grand Prix"
) -> Dict[str, Any]:
    """Predict undercut success probability (query parameter form)."""
    return _predict_undercut_core(
        position_before_pit=position_before_pit,
        tyre_age=tyre_age,
        stint_length=stint_length,
        compound=compound,
        track_temp=track_temp,
        pit_lap=pit_lap,
        race_name=race_name,
    )


@router.post("/models/undercut/predict")
async def predict_undercut_post(payload: UndercutPredictRequest) -> Dict[str, Any]:
    """Predict undercut success probability (JSON body form)."""
    return _predict_undercut_core(
        position_before_pit=int(payload.position_before_pit),
        tyre_age=int(payload.tyre_age),
        stint_length=int(payload.stint_length),
        compound=str(payload.compound),
        track_temp=float(payload.track_temp),
        pit_lap=int(payload.pit_lap),
        race_name=str(payload.race_name),
    )


@router.get("/models/undercut/events")
async def get_undercut_events(
    race_name: Optional[str] = None,
    year: Optional[int] = None,
    success_only: bool = False,
    limit: int = Query(default=500, ge=1, le=5000),
) -> Dict[str, Any]:
    """Get historical undercut events."""
    events_file = os.path.join(MODELS_DIR, "undercut_events.parquet")
    if not os.path.exists(events_file):
        raise HTTPException(status_code=404, detail="Undercut events not found")

    df = read_parquet_df(events_file)
    if race_name:
        df = df[df["race_name"].str.contains(race_name, case=False, na=False)]
    if year:
        df = df[df["year"] == year]
    if success_only:
        df = df[df["undercut_success"] == 1]

    total = len(df)
    if total > int(limit):
        df = df.head(int(limit))
    return {
        "status": "success",
        "n_events": int(total),
        "returned_events": int(len(df)),
        "success_rate": float(df["undercut_success"].mean()) if len(df) > 0 else 0.0,
        "events": df.to_dict(orient="records"),
    }


@router.get("/models/list")
async def list_models() -> Dict[str, Any]:
    """List all available ML models."""
    models = []
    for fname, name, fpath, infopath in [
        ("driver_clusters_performance", "Driver Clustering (Performance)", "driver_clusters_performance.parquet", "clustering_performance_info.json"),
        ("undercut_model", "Undercut Prediction", "undercut_model.pkl", "undercut_info.json"),
    ]:
        fpath = os.path.join(MODELS_DIR, fpath)
        if os.path.exists(fpath):
            info_path = os.path.join(MODELS_DIR, infopath)
            if os.path.exists(info_path):
                with open(info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
            else:
                info = {}
            models.append({"id": fname, "name": name, "exists": True, "trained_at": info.get("trained_at"),
                          "metrics": {"silhouette_score": info.get("silhouette_score"),
                                     "accuracy": info.get("test_accuracy"), "auc": info.get("test_auc")}})
    return {"models": models, "models_dir": MODELS_DIR}


@router.get("/models/strategy-recommendations/{year}/{race}")
async def get_strategy_recommendations(year: int, race: str) -> Dict[str, Any]:
    race_name = race.replace("-", " ")
    path = _strategy_recommendations_path(int(year), str(race_name))
    if not path or not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=f"Strategy recommendations not found for {year} {race_name}",
        )
    try:
        mtime = float(os.path.getmtime(path))
        cached = _strategy_payload_cache.get(path)
        if cached and cached[0] == mtime:
            payload = cached[1]
        else:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            _strategy_payload_cache[path] = (mtime, payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read strategy recommendations: {e}")
    payload = _normalize_strategy_payload(payload, expected_year=int(year), expected_race_name=str(race_name))
    try:
        if hasattr(StrategyRecommendationsPayload, "model_validate"):
            validated = StrategyRecommendationsPayload.model_validate(payload)  # pydantic v2
        else:
            validated = StrategyRecommendationsPayload.parse_obj(payload)  # pydantic v1
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid strategy recommendations payload schema: {e}")
    if hasattr(validated, "model_dump"):
        return validated.model_dump()
    return validated.dict()
