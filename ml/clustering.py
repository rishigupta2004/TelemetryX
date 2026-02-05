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
from typing import Dict, Optional, Tuple
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
FEATURES_PATH = DATA_PATH / "features"


def _scope_name(year: Optional[int], race: Optional[str]) -> str:
    if year and race:
        return f"{year}_{race.replace(' ', '_')}"
    if year:
        return f"{year}"
    return "all"


def load_feature_frames(
    feature_name: str,
    year: Optional[int] = None,
    race: Optional[str] = None,
    session: str = "R",
) -> pd.DataFrame:
    if year and race:
        path = FEATURES_PATH / str(year) / race / session / f"{feature_name}_features.parquet"
        if path.exists():
            return pd.read_parquet(path)
        return pd.DataFrame()
    files = list(FEATURES_PATH.rglob(f"{feature_name}_features.parquet"))
    if not files:
        return pd.DataFrame()
    df = pd.concat([pd.read_parquet(p) for p in files], ignore_index=True)
    if year and "year" in df.columns:
        df = df[df["year"] == year]
    if race and "race_name" in df.columns:
        df = df[df["race_name"] == race]
    if "session" in df.columns:
        df = df[df["session"] == session]
    return df


def build_driver_features(
    year: Optional[int] = None,
    race: Optional[str] = None,
    session: str = "R",
    feature_frames: Optional[Dict[str, pd.DataFrame]] = None,
) -> pd.DataFrame:
    lap_df = feature_frames.get("lap") if feature_frames else load_feature_frames("lap", year, race, session)
    if lap_df.empty:
        return pd.DataFrame()
    for col in ["lap_duration", "lap_quality_score"]:
        if col not in lap_df.columns:
            lap_df[col] = None

    lap_stats = lap_df.groupby("driver_name").agg(
        avg_lap=("lap_duration", "mean"),
        fastest_lap=("lap_duration", "min"),
        lap_std=("lap_duration", "std"),
        laps=("lap_duration", "count"),
        lap_quality=("lap_quality_score", "mean"),
    ).reset_index()
    lap_stats["lap_consistency"] = lap_stats["lap_std"] / lap_stats["avg_lap"]

    pos_df = feature_frames.get("position") if feature_frames else load_feature_frames("position", year, race, session)
    if not pos_df.empty:
        for col in ["start_position", "end_position", "position_change", "laps_led"]:
            if col not in pos_df.columns:
                pos_df[col] = None
        pos_stats = pos_df.groupby("driver_name").agg(
            start_pos=("start_position", "mean"),
            end_pos=("end_position", "mean"),
            position_change=("position_change", "mean"),
            laps_led=("laps_led", "sum"),
        ).reset_index()
    else:
        pos_stats = pd.DataFrame()

    ovt_df = feature_frames.get("overtakes") if feature_frames else load_feature_frames("overtakes", year, race, session)
    if not ovt_df.empty:
        for col in ["overtakes_made", "positions_lost_defensive", "net_position_change"]:
            if col not in ovt_df.columns:
                ovt_df[col] = None
        ovt_stats = ovt_df.groupby("driver_name").agg(
            overtakes_made=("overtakes_made", "sum"),
            positions_lost_defensive=("positions_lost_defensive", "sum"),
            net_position_change=("net_position_change", "sum"),
        ).reset_index()
    else:
        ovt_stats = pd.DataFrame()

    traffic_df = feature_frames.get("traffic") if feature_frames else load_feature_frames("traffic", year, race, session)
    if not traffic_df.empty:
        for col in ["avg_lap_time", "estimated_time_lost"]:
            if col not in traffic_df.columns:
                traffic_df[col] = None
        traffic_stats = traffic_df.groupby("driver_name").agg(
            avg_lap_time=("avg_lap_time", "mean"),
            estimated_time_lost=("estimated_time_lost", "sum"),
        ).reset_index()
    else:
        traffic_stats = pd.DataFrame()

    tyre_df = feature_frames.get("tyre") if feature_frames else load_feature_frames("tyre", year, race, session)
    if not tyre_df.empty:
        for col in ["stint_number", "tyre_laps_in_stint", "tyre_degradation_rate", "pit_stop_count", "grip_level"]:
            if col not in tyre_df.columns:
                tyre_df[col] = None
        tyre_stats = tyre_df.groupby("driver_name").agg(
            stints=("stint_number", "count"),
            avg_stint_length=("tyre_laps_in_stint", "mean"),
            avg_degradation=("tyre_degradation_rate", "mean"),
            pit_stop_count=("pit_stop_count", "sum"),
            avg_grip=("grip_level", "mean"),
        ).reset_index()
    else:
        tyre_stats = pd.DataFrame()

    telemetry_df = feature_frames.get("telemetry") if feature_frames else load_feature_frames("telemetry", year, race, session)
    if not telemetry_df.empty:
        for col in ["speed_max", "speed_avg", "throttle_avg", "brake_avg", "drs_usage_pct"]:
            if col not in telemetry_df.columns:
                telemetry_df[col] = None
        telemetry_stats = telemetry_df.groupby("driver_name").agg(
            speed_max=("speed_max", "max"),
            speed_avg=("speed_avg", "mean"),
            throttle_avg=("throttle_avg", "mean"),
            brake_avg=("brake_avg", "mean"),
            drs_usage_pct=("drs_usage_pct", "mean"),
        ).reset_index()
    else:
        telemetry_stats = pd.DataFrame()

    points_df = feature_frames.get("points") if feature_frames else load_feature_frames("points", year, race, session)
    if not points_df.empty:
        for col in ["points", "final_position"]:
            if col not in points_df.columns:
                points_df[col] = None
        points_stats = points_df.groupby("driver_name").agg(
            points=("points", "sum"),
            avg_finish=("final_position", "mean"),
        ).reset_index()
    else:
        points_stats = pd.DataFrame()

    frames = [lap_stats, pos_stats, ovt_stats, traffic_stats, tyre_stats, telemetry_stats, points_stats]
    drv = lap_stats
    for frame in frames[1:]:
        if not frame.empty:
            drv = drv.merge(frame, on="driver_name", how="left")

    drv["position_gain"] = drv.get("start_pos", pd.Series([0] * len(drv), index=drv.index)) - drv.get("end_pos", pd.Series([0] * len(drv), index=drv.index))
    drv["year"] = year if year else drv.get("year", None)
    if race:
        drv["race_name"] = race
    return drv.dropna(subset=["avg_lap"])


def train_clustering(
    n_clusters: int = 4,
    year: Optional[int] = None,
    race: Optional[str] = None,
    session: str = "R",
    verbose: bool = True,
    feature_frames: Optional[Dict[str, pd.DataFrame]] = None,
) -> Tuple[pd.DataFrame, Dict]:
    """Train K-Means clustering on driver features."""
    if verbose:
        print(f"\n{'='*50}")
        print(f"DRIVER CLUSTERING (K={n_clusters})")
        print(f"{'='*50}")
    
    df = build_driver_features(year=year, race=race, session=session, feature_frames=feature_frames)
    if df.empty:
        if verbose:
            print("No features found")
        return pd.DataFrame(), {}
    
    if len(df) < n_clusters:
        n_clusters = max(2, len(df) - 1)
    
    id_cols = {"driver_name", "year", "race_name"}
    feats = [c for c in df.columns if c not in id_cols and pd.api.types.is_numeric_dtype(df[c])]
    if not feats:
        return pd.DataFrame(), {}
    X = df[feats].fillna(0).values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df["cluster"] = kmeans.fit_predict(X_scaled)
    
    df["silhouette"] = silhouette_score(X_scaled, df["cluster"]) if len(df) > n_clusters else 0
    
    labels = {}
    for c in df["cluster"].unique():
        cluster_df = df[df["cluster"] == c]
        avg_pace = cluster_df["avg_lap"].mean() if "avg_lap" in cluster_df.columns else None
        global_avg = df["avg_lap"].mean() if "avg_lap" in df.columns else None
        if avg_pace and global_avg:
            if avg_pace < global_avg * 0.99:
                pace = "Front"
            elif avg_pace > global_avg * 1.01:
                pace = "Back"
            else:
                pace = "Mid"
        else:
            pace = "Field"
        cons = "Consistent"
        if "lap_consistency" in df.columns:
            cons = "Consistent" if cluster_df["lap_consistency"].mean() < df["lap_consistency"].mean() else "Variable"
        labels[c] = f"{pace} Field - {cons}"
    
    df["cluster_label"] = df["cluster"].map(labels)
    
    out_path = FEATURES_PATH / "driver_clusters"
    out_path.mkdir(parents=True, exist_ok=True)
    scope = _scope_name(year, race)
    df.to_parquet(out_path / f"clusters_{scope}.parquet", index=False)
    
    labels_serializable = {str(k): v for k, v in labels.items()}
    metrics = {
        "n_drivers": len(df),
        "n_clusters": n_clusters,
        "silhouette": df["silhouette"].iloc[0] if len(df) > 0 else 0,
        "features_used": feats,
        "labels": labels_serializable,
    }
    
    metrics_path = out_path / f"metrics_{scope}.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

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
    parser.add_argument("--race", type=str, default=None)
    parser.add_argument("--session", type=str, default="R")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    train_clustering(args.clusters, args.year, race=args.race, session=args.session, verbose=not args.quiet)
