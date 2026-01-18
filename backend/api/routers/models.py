from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
import pandas as pd
import json
import os
import pickle
import numpy as np

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
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = "/Volumes/Space/PROJECTS/TelemetryX/scripts/models"


@router.get("/models/clustering")
async def get_driver_clusters(probabilities: bool = False, driver: Optional[str] = None) -> Dict[str, Any]:
    """Get driver clustering model results."""
    clusters_file = os.path.join(MODELS_DIR, "driver_clusters_performance.parquet")
    info_file = os.path.join(MODELS_DIR, "clustering_performance_info.json")

    if not os.path.exists(clusters_file):
        raise HTTPException(status_code=404, detail="Clustering model not found")

    df = pd.read_parquet(clusters_file)
    info = json.load(open(info_file)) if os.path.exists(info_file) else {}

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

    df, info = pd.read_parquet(clusters_file), json.load(open(info_file)) if os.path.exists(info_file) else {}
    labels = info.get("labels", {})

    reverse_labels = {v.lower(): k for k, v in labels.items()}
    if cluster_label.lower() not in reverse_labels:
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_label}' not found")

    cluster_id = int(reverse_labels[cluster_label.lower()])
    drivers = df[df["cluster"] == cluster_id]["driver_name"].tolist()

    return {"status": "success", "cluster": cluster_label, "n_drivers": len(drivers), "drivers": drivers}


@router.get("/models/undercut")
async def get_undercut_analysis() -> Dict[str, Any]:
    """Get undercut analysis and model info."""
    events_file = os.path.join(MODELS_DIR, "undercut_events.parquet")
    info_file = os.path.join(MODELS_DIR, "undercut_info.json")

    if not os.path.exists(events_file):
        raise HTTPException(status_code=404, detail="Undercut model not found")

    df, info = pd.read_parquet(events_file), json.load(open(info_file)) if os.path.exists(info_file) else {}
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
        "sample_events": df.head(20).to_dict(orient="records"),
    }


@router.get("/models/undercut/predict")
async def predict_undercut(
    position_before_pit: int, tyre_age: int, stint_length: int, compound: str,
    track_temp: float = 30.0, pit_lap: int = 15, race_name: str = "Bahrain Grand Prix"
) -> Dict[str, Any]:
    """Predict undercut success probability."""
    model_file = os.path.join(MODELS_DIR, "undercut_model.pkl")
    if not os.path.exists(model_file):
        raise HTTPException(status_code=404, detail="Undercut model not found")

    with open(model_file, "rb") as f:
        model_data = pickle.load(f)

    model, scaler, features = model_data["model"], model_data["scaler"], model_data["features"]
    compound_order = model_data.get("compound_order", {})
    circuit_data = model_data.get("circuit_data", {})

    compound_ord = compound_order.get(compound.upper(), 3)
    track_stress = circuit_data.get(race_name, circuit_data.get("default", {"stress": 0.5}))["stress"]

    X = pd.DataFrame([{"position_before_pit": position_before_pit, "tyre_age": tyre_age, "stint_length": stint_length,
                       "compound_ordinal": compound_ord, "track_stress": track_stress, "pit_lap": pit_lap}])[features]
    prob = model.predict_proba(scaler.transform(X))[0][1]

    return {
        "prediction": "SUCCESS" if prob > 0.5 else "FAILURE",
        "success_probability": round(float(prob), 4),
        "confidence": "high" if abs(prob - 0.5) > 0.3 else "medium" if abs(prob - 0.5) > 0.15 else "low",
        "recommendations": ["High tyre age reduces undercut success - consider extending stint"] if tyre_age > 15 else
                          ["Pushing from outside top 10 - undercut less effective"] if position_before_pit > 10 else []
    }


@router.get("/models/undercut/events")
async def get_undercut_events(race_name: Optional[str] = None, year: Optional[int] = None, success_only: bool = False) -> Dict[str, Any]:
    """Get historical undercut events."""
    events_file = os.path.join(MODELS_DIR, "undercut_events.parquet")
    if not os.path.exists(events_file):
        raise HTTPException(status_code=404, detail="Undercut events not found")

    df = pd.read_parquet(events_file)
    if race_name:
        df = df[df["race_name"].str.contains(race_name, case=False, na=False)]
    if year:
        df = df[df["year"] == year]
    if success_only:
        df = df[df["undercut_success"] == 1]

    return {"status": "success", "n_events": len(df), "success_rate": float(df["undercut_success"].mean()),
            "events": df.to_dict(orient="records")}


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
            info = json.load(open(os.path.join(MODELS_DIR, infopath))) if os.path.exists(os.path.join(MODELS_DIR, infopath)) else {}
            models.append({"id": fname, "name": name, "exists": True, "trained_at": info.get("trained_at"),
                          "metrics": {"silhouette_score": info.get("silhouette_score"),
                                     "accuracy": info.get("test_accuracy"), "auc": info.get("test_auc")}})
    return {"models": models, "models_dir": MODELS_DIR}
