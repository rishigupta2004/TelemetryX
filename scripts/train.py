"""ML Training Module - Consolidated.

Training for:
- Driver Clustering (Performance-based)
- Undercut Prediction

Usage:
    python scripts/train.py --model all
    python scripts/train.py --model clustering-performance
    python scripts/train.py --model undercut
"""

import sys
from pathlib import Path
from datetime import datetime
import argparse
import json
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from sklearn.preprocessing import RobustScaler
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.utils.class_weight import compute_class_weight

try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    from sklearn.ensemble import RandomForestClassifier

sys.path.insert(0, str(Path(__file__).parent))

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
FEATURES_PATH = DATA_PATH / "features"
MODELS_PATH = Path(__file__).parent / "models"

CIRCUIT_DATA = {
    "Monaco": {"type": "street", "length": 3.337, "stress": 0.3},
    "Hungary": {"type": "street", "length": 4.381, "stress": 0.4},
    "Belgium": {"type": "permanent", "length": 7.004, "stress": 0.9},
    "Italy": {"type": "permanent", "length": 5.793, "stress": 0.8},
    "Bahrain": {"type": "permanent", "length": 5.412, "stress": 0.7},
    "Australia": {"type": "street", "length": 5.278, "stress": 0.5},
    "China": {"type": "permanent", "length": 5.451, "stress": 0.6},
    "Brazil": {"type": "street", "length": 4.309, "stress": 0.7},
    "Singapore": {"type": "street", "length": 5.063, "stress": 0.4},
    "Spain": {"type": "permanent", "length": 4.655, "stress": 0.6},
    "Azerbaijan": {"type": "street", "length": 6.003, "stress": 0.5},
    "Abu Dhabi": {"type": "street", "length": 5.554, "stress": 0.5},
    "Japan": {"type": "permanent", "length": 5.807, "stress": 0.7},
    "Mexico City": {"type": "street", "length": 4.304, "stress": 0.6},
    "Miami": {"type": "street", "length": 5.412, "stress": 0.5},
    "Las Vegas": {"type": "street", "length": 6.201, "stress": 0.5},
    "Canada": {"type": "street", "length": 4.361, "stress": 0.5},
    "Austria": {"type": "permanent", "length": 4.318, "stress": 0.6},
    "British": {"type": "permanent", "length": 5.891, "stress": 0.7},
    "Netherlands": {"type": "street", "length": 4.259, "stress": 0.5},
    "Emilia Romagna": {"type": "permanent", "length": 4.909, "stress": 0.6},
    "Saudi Arabian": {"type": "street", "length": 6.174, "stress": 0.7},
    "Qatar": {"type": "permanent", "length": 5.380, "stress": 0.6},
    "São Paulo": {"type": "street", "length": 4.309, "stress": 0.7},
    "default": {"type": "permanent", "length": 5.0, "stress": 0.5},
}

COMPOUND_ORDER = {"HYPERSOFT": 0, "ULTRASOFT": 1, "SUPERSOFT": 2, "SOFT": 3, "MEDIUM": 4, "HARD": 5, "INTERMEDIATE": 6, "WET": 7}


def load_parquet(key):
    files = list(FEATURES_PATH.rglob(f"{key}_features.parquet"))
    if not files:
        return pd.DataFrame()
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


def train_clustering_performance(verbose=True):
    if verbose:
        print("=" * 50)
        print("DRIVER CLUSTERING (PERFORMANCE)")
        print("=" * 50)

    years = list(range(2018, 2025))
    all_qualifying, all_race = [], []

    for year in years:
        year_path = FEATURES_PATH / str(year)
        if not year_path.exists():
            continue
        for race_folder in year_path.iterdir():
            if not race_folder.is_dir():
                continue
            for session, file_name in [("Q", "lap_features"), ("R", "lap_features")]:
                path = race_folder / session / f"{file_name}.parquet"
                if path.exists():
                    try:
                        df = pd.read_parquet(path)
                        if not df.empty and 'driver_name' in df.columns:
                            df['year'], df['race_name'] = year, race_folder.name
                            (all_qualifying if session == "Q" else all_race).append(df)
                    except:
                        pass

    if not all_qualifying:
        return {"status": "error", "msg": "No qualifying data"}

    q_df, r_df = pd.concat(all_qualifying), pd.concat(all_race) if all_race else pd.DataFrame()
    valid_q = q_df[q_df['is_valid_lap'] == True].copy()

    # Qualifying positions
    q_agg = []
    for (year, race), group in valid_q.groupby(['year', 'race_name']):
        best = group.groupby('driver_name')['lap_duration'].min().reset_index()
        best.columns = ['driver_name', 'best_lap']
        best = best.sort_values('best_lap')
        best['qualifying_position'] = range(1, len(best) + 1)
        best['year'], best['race_name'] = year, race
        q_agg.append(best)
    q_agg = pd.concat(q_agg, ignore_index=True)

    drv_q = q_agg.groupby('driver_name').agg({
        'qualifying_position': ['mean', 'min', 'std', 'count'],
        'best_lap': 'min'
    }).reset_index()
    drv_q.columns = ['driver_name', 'avg_qualifying', 'best_qualifying', 'quali_std', 'total_q', 'best_lap']
    drv_q['quali_variance'] = drv_q['quali_std'] / drv_q['avg_qualifying']

    for col, limit in [('q1_appearances', 10), ('q2_appearances', 15), ('q3_appearances', 20), ('pole_positions', 1), ('front_row', 2)]:
        counts = q_agg[q_agg['qualifying_position'] <= limit].groupby('driver_name').size().reset_index(name=col)
        drv_q = drv_q.merge(counts, on='driver_name', how='left')
    drv_q = drv_q.fillna(0)

    # Race performance
    drv_r = pd.DataFrame()
    if not r_df.empty:
        valid_r = r_df[r_df['is_valid_lap'] == True].copy()
        race_agg = []
        for (year, race), group in valid_r.groupby(['year', 'race_name']):
            last = group.groupby('driver_name').last()[['position']].reset_index()
            last.columns = ['driver_name', 'finish']
            first = group.groupby('driver_name').first()[['position']].reset_index()
            first.columns = ['driver_name', 'start']
            race_agg.append(last.merge(first, on='driver_name'))
            race_agg[-1]['year'], race_agg[-1]['race_name'] = year, race
        race_df = pd.concat(race_agg, ignore_index=True)

        drv_r = race_df.groupby('driver_name').agg({
            'finish': ['mean', 'min', 'std', 'count'],
            'start': 'mean'
        }).reset_index()
        drv_r.columns = ['driver_name', 'avg_finish', 'best_finish', 'finish_std', 'total_races', 'avg_start']
        drv_r['finish_variance'] = drv_r['finish_std'] / drv_r['avg_finish']

        for col, limit in [('wins', 1), ('podiums', 3), ('points_finishes', 10), ('dnfs', 15)]:
            counts = race_df[race_df['finish'] <= limit].groupby('driver_name').size().reset_index(name=col)
            drv_r = drv_r.merge(counts, on='driver_name', how='left')
        drv_r = drv_r.fillna(0)

        for col in ['wins', 'podiums', 'points_finishes', 'dnfs']:
            drv_r[f'{col}_rate'] = drv_r[col] / drv_r['total_races'].replace(0, 1)

        # Position changes
        pc = race_df.groupby('driver_name')['finish'].agg(pos_change=lambda x: x.iloc[0] - x.iloc[-1]).reset_index()
        pc.columns = ['driver_name', 'pos_change_avg']
        drv_r = drv_r.merge(pc, on='driver_name', how='left')

    drv = drv_q.merge(drv_r, on='driver_name', how='outer').fillna(0)

    # Add rate columns that might be missing
    for col in ['points_rate', 'dnf_rate', 'wins_rate', 'podiums_rate']:
        if col not in drv.columns:
            drv[col] = 0
    feats = ['avg_qualifying', 'best_qualifying', 'quali_std', 'quali_variance',
             'q1_appearances', 'q2_appearances', 'q3_appearances', 'pole_positions', 'front_row',
             'avg_finish', 'best_finish', 'finish_std', 'finish_variance',
             'wins', 'podiums', 'points_finishes', 'dnfs',
             'wins_rate', 'podiums_rate', 'points_rate', 'dnf_rate', 'pos_change_avg']

    X, scaler = drv[feats].copy(), RobustScaler()
    X_scaled = scaler.fit_transform(X)

    best_sil, best_n, best_labels = -1, 4, None
    for n in range(3, 9):
        labels = KMeans(n_clusters=n, random_state=42, n_init=10).fit_predict(X_scaled)
        sil = silhouette_score(X_scaled, labels)
        if sil > best_sil:
            best_sil, best_n, best_labels = sil, n, labels

    drv['cluster'] = best_labels
    gmm = GaussianMixture(n_components=best_n, random_state=42, covariance_type='full').fit(X_scaled)
    for i in range(best_n):
        drv[f'prob_cluster_{i}'] = gmm.predict_proba(X_scaled)[:, i]

    centers_scaled = gmm.means_
    centers = pd.DataFrame(scaler.inverse_transform(centers_scaled), columns=feats)
    labels = {}
    for c in range(best_n):
        center = centers.iloc[c]
        if center['wins_rate'] > 0.2:
            labels[c] = "The Elite"
        elif center['wins_rate'] > 0.05:
            labels[c] = "The Winner"
        elif center['podiums_rate'] > 0.15:
            labels[c] = "Podium Hunter"
        elif center['avg_qualifying'] < 8 and center['avg_finish'] > center['avg_qualifying'] + 2:
            labels[c] = "Sunday Specialist"
        elif center['avg_qualifying'] < 8:
            labels[c] = "The Qualifier"
        elif center['avg_finish'] < 10 and center['finish_std'] < 5:
            labels[c] = "Mr. Consistent"
        else:
            labels[c] = "Midfield Runner"
    drv['cluster_label'] = drv['cluster'].map(labels)

    MODELS_PATH.mkdir(parents=True, exist_ok=True)
    drv.to_parquet(MODELS_PATH / 'driver_clusters_performance.parquet', index=False)

    info = {'model': 'kmeans_gmm', 'n_clusters': best_n, 'silhouette_score': float(best_sil),
            'features': feats, 'labels': labels,
            'n_drivers': len(drv), 'years': years, 'trained_at': datetime.now().isoformat()}
    with open(MODELS_PATH / 'clustering_performance_info.json', 'w') as f:
        json.dump(info, f, indent=2)

    if verbose:
        print(f"  Drivers: {len(drv)}, Clusters: {best_n}, Silhouette: {best_sil:.4f}")
        for c in range(best_n):
            print(f"    {labels[c]}: {(drv['cluster'] == c).sum()} drivers")

    return {"status": "success", "info": info}


def detect_undercut_events(tyre_df, lap_df):
    events = []
    for (year, race, session), race_df in tyre_df.groupby(["year", "race_name", "session"]):
        race_laps = lap_df[(lap_df["year"] == year) & (lap_df["race_name"] == race) & (lap_df["session"] == session)]
        if race_laps.empty:
            continue
        race_laps = race_laps.sort_values(["driver_name", "lap_number"])

        for drv in race_df["driver_name"].unique():
            drv_tyre = race_df[race_df["driver_name"] == drv].sort_values(["stint_number", "first_lap"])
            drv_laps = race_laps[race_laps["driver_name"] == drv].sort_values("lap_number")
            if drv_tyre.empty or drv_laps.empty:
                continue

            for i, stint in enumerate(drv_tyre.to_dict(orient="records")):
                if i == 0:
                    continue
                pit_lap = stint.get("first_lap", 1)
                if pit_lap <= 1:
                    continue

                pos_before = drv_laps[drv_laps["lap_number"] < pit_lap]
                if pos_before.empty:
                    continue
                pos_before_pit = int(pos_before["position"].iloc[-1])

                max_lap = drv_laps["lap_number"].max()
                pos_after = drv_laps[(drv_laps["lap_number"] >= pit_lap) & (drv_laps["lap_number"] <= min(pit_lap + 5, max_lap))]
                if pos_after.empty:
                    continue
                pos_after_pit = int(pos_after["position"].iloc[-1])

                drivers_ahead = race_laps[(race_laps["lap_number"] >= pit_lap - 1) & (race_laps["lap_number"] <= pit_lap + 1)]
                if not drivers_ahead.empty:
                    ahead = drivers_ahead.groupby("driver_name")["position"].min()
                    drivers_ahead_list = ahead[ahead < pos_before_pit].index.tolist()

                undercut_success = 0
                for ahead_drv in drivers_ahead_list:
                    if ahead_drv == drv:
                        continue
                    ahead_laps = race_laps[race_laps["driver_name"] == ahead_drv]
                    if ahead_laps.empty:
                        continue
                    ahead_before = ahead_laps[ahead_laps["lap_number"] < pit_lap]
                    ahead_after = ahead_laps[(ahead_laps["lap_number"] >= pit_lap) & (ahead_laps["lap_number"] <= min(pit_lap + 5, max_lap))]
                    if not ahead_before.empty and not ahead_after.empty:
                        if pos_after_pit < int(ahead_after["position"].iloc[-1]):
                            undercut_success = 1
                            break

                events.append({
                    "year": year, "race_name": race, "session": session, "driver_name": drv,
                    "pit_lap": int(pit_lap), "position_before_pit": pos_before_pit,
                    "position_after_pit": pos_after_pit, "position_change": pos_before_pit - pos_after_pit,
                    "tyre_age": stint.get("tyre_age_at_stint_start", 0),
                    "stint_length": stint.get("tyre_laps_in_stint", 10),
                    "compound": stint.get("tyre_compound", "SOFT"),
                    "compound_ordinal": COMPOUND_ORDER.get(stint.get("tyre_compound", "SOFT"), 3),
                    "track_stress": CIRCUIT_DATA.get(race, CIRCUIT_DATA["default"])["stress"],
                    "undercut_success": undercut_success,
                })
    return pd.DataFrame(events)


def train_undercut_model(verbose=True):
    if verbose:
        print("=" * 50)
        print("UNDERCUT PREDICTION MODEL")
        print("=" * 50)

    import pickle
    from sklearn.metrics import classification_report

    tyre_df, lap_df = load_parquet("tyre"), load_parquet("lap")
    if tyre_df.empty or lap_df.empty:
        return {"status": "error", "msg": "No data"}

    events_df = detect_undercut_events(tyre_df, lap_df)
    if len(events_df) < 50:
        return {"status": "error", "msg": f"Insufficient data: {len(events_df)}"}

    MODELS_PATH.mkdir(parents=True, exist_ok=True)
    events_df.to_parquet(MODELS_PATH / "undercut_events.parquet", index=False)

    feats = ["position_before_pit", "tyre_age", "stint_length", "compound_ordinal", "track_stress", "pit_lap"]
    X, y = events_df[feats].fillna(events_df[feats].median()), events_df["undercut_success"]

    X_sorted, y_sorted = events_df.sort_values("year")[feats].fillna(0), events_df.sort_values("year")["undercut_success"]
    train_size = int(len(X_sorted) * 0.8)
    X_train, X_test = X_sorted.iloc[:train_size], X_sorted.iloc[train_size:]
    y_train, y_test = y_sorted.iloc[:train_size], y_sorted.iloc[train_size:]

    if HAS_XGB:
        weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
        model = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, subsample=0.8,
                              colsample_bytree=0.8, random_state=42, n_jobs=-1, eval_metric="logloss")
        model.fit(X_train, y_train, sample_weight=np.array([weights[c] for c in y_train]))
    else:
        model = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1, class_weight="balanced")
        model.fit(X_train, y_train)

    train_acc, test_acc = accuracy_score(y_train, model.predict(X_train)), accuracy_score(y_test, model.predict(X_test))
    train_auc = roc_auc_score(y_train, model.predict_proba(X_train)[:, 1])
    test_auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])

    scaler = RobustScaler().fit(X)
    with open(MODELS_PATH / "undercut_model.pkl", "wb") as f:
        pickle.dump({"model": model, "scaler": scaler, "features": feats, "compound_order": COMPOUND_ORDER, "circuit_data": CIRCUIT_DATA}, f)

    imp = {k: float(v) for k, v in zip(feats, model.feature_importances_)}
    info = {"model": "xgboost" if HAS_XGB else "rf", "n_events": len(events_df),
            "features": feats, "feature_importance": imp,
            "train_accuracy": float(train_acc), "test_accuracy": float(test_acc),
            "train_auc": float(train_auc), "test_auc": float(test_auc),
            "undercut_rate": float(y.mean()), "n_races": events_df[["year", "race_name"]].drop_duplicates().shape[0],
            "trained_at": datetime.now().isoformat()}
    with open(MODELS_PATH / "undercut_info.json", "w") as f:
        json.dump(info, f, indent=2)

    if verbose:
        print(f"  Events: {len(events_df)}, Undercut rate: {y.mean():.2%}")
        print(f"  Train accuracy: {train_acc:.4f}, Test accuracy: {test_acc:.4f}")
        print(f"  Test AUC: {test_auc:.4f}")
        print(f"  Top features: {list(sorted(imp.items(), key=lambda x: -x[1])[:3])}")

    return {"status": "success", "info": info}


def main():
    parser = argparse.ArgumentParser(description="ML Training")
    parser.add_argument("--model", default="all", choices=["all", "clustering-performance", "undercut"])
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    print(f"\n{'=' * 50}TELEMETRYX ML TRAINING{datetime.now().strftime(' %Y-%m-%d %H:%M:%S')}{'=' * 50}")

    results = {}
    if args.model in ["all", "clustering-performance"]:
        results["clustering"] = train_clustering_performance(not args.quiet)
    if args.model in ["all", "undercut"]:
        results["undercut"] = train_undercut_model(not args.quiet)

    if not args.quiet:
        print(f"\n{'=' * 50}SUMMARY{'=' * 50}")
        for name, res in results.items():
            status = res.get("status", "error")
            print(f"  {name}: {status}")
            if status == "success" and "info" in res:
                info = res["info"]
                print(f"    - Records: {info.get('n_drivers', info.get('n_events', '?'))}")
                print(f"    - Silhouette: {info.get('silhouette_score', info.get('test_accuracy', info.get('test_auc', '?'))):.4f}")

    print(f"\nModels: {MODELS_PATH}")


if __name__ == "__main__":
    main()
