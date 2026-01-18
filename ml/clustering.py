"""
Driver Clustering ML Model - Refactored

K-Means clustering based on gold layer features:
- Pace: avg_lap, fastest_lap, lap_consistency
- Tyre: degradation_rate, stint_length, pit_efficiency
- Race: position_change, traffic_impact

Uses pre-computed features from the gold layer for efficiency.
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Tuple
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
FEATURES_PATH = DATA_PATH / "features"


def load_all_features() -> pd.DataFrame:
    """Load all driver features from gold layer."""
    all_dfs = []
    for pf in FEATURES_PATH.rglob("lap_features.parquet"):
        df = pd.read_parquet(pf)
        all_dfs.append(df)
    return pd.concat(all_dfs, ignore_index=True) if all_dfs else pd.DataFrame()


def build_driver_features(year: int = None) -> pd.DataFrame:
    """Build aggregated driver features for clustering."""
    df = load_all_features()
    if df.empty:
        return pd.DataFrame()
    
    if year:
        df = df[df["year"] == year]
    
    drv = df.groupby("driver_name").agg({
        "lap_duration": ["mean", "min", "std", "count"],
        "position": ["first", "last"],
    }).reset_index()
    
    drv.columns = ["driver_name", "avg_lap", "fastest_lap", "lap_std", "laps", "start_pos", "end_pos"]
    drv["position_gain"] = drv["start_pos"] - drv["end_pos"]
    drv["lap_consistency"] = drv["lap_std"] / drv["avg_lap"]
    return drv.dropna()


def train_clustering(n_clusters: int = 4, year: int = None, verbose: bool = True) -> Tuple[pd.DataFrame, Dict]:
    """Train K-Means clustering on driver features."""
    if verbose:
        print(f"\n{'='*50}")
        print(f"DRIVER CLUSTERING (K={n_clusters})")
        print(f"{'='*50}")
    
    df = build_driver_features(year)
    if df.empty:
        if verbose:
            print("No features found")
        return pd.DataFrame(), {}
    
    if len(df) < n_clusters:
        n_clusters = max(2, len(df) - 1)
    
    feats = ["avg_lap", "fastest_lap", "lap_consistency", "position_gain"]
    X = df[feats].values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df["cluster"] = kmeans.fit_predict(X_scaled)
    
    df["silhouette"] = silhouette_score(X_scaled, df["cluster"]) if len(df) > n_clusters else 0
    
    labels = {}
    for c in df["cluster"].unique():
        cluster_df = df[df["cluster"] == c]
        avg_pace = cluster_df["avg_lap"].mean()
        global_avg = df["avg_lap"].mean()
        
        if avg_pace < global_avg * 0.99:
            pace = "Front"
        elif avg_pace > global_avg * 1.01:
            pace = "Back"
        else:
            pace = "Mid"
        
        cons = "Consistent" if cluster_df["lap_consistency"].mean() < df["lap_consistency"].mean() else "Variable"
        labels[c] = f"{pace} Field - {cons}"
    
    df["cluster_label"] = df["cluster"].map(labels)
    
    out_path = FEATURES_PATH / "driver_clusters"
    out_path.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path / "clusters.parquet", index=False)
    
    metrics = {
        "n_drivers": len(df),
        "n_clusters": n_clusters,
        "silhouette": df["silhouette"].iloc[0] if len(df) > 0 else 0,
        "labels": labels,
    }
    
    if verbose:
        print(f"\nDrivers: {len(df)}, Clusters: {n_clusters}")
        print(f"Silhouette: {metrics['silhouette']:.3f}")
        for c, lbl in labels.items():
            count = (df["cluster"] == c).sum()
            print(f"  Cluster {c} ({lbl}): {count} drivers")
    
    return df, metrics


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Driver Clustering")
    parser.add_argument("--clusters", type=int, default=4)
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    train_clustering(args.clusters, args.year, verbose=not args.quiet)
