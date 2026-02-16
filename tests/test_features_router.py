import asyncio
from pathlib import Path
from typing import Dict, List

import pandas as pd

from backend.api.routers import features as features_router


def _write_parquet(path: Path, rows: List[Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_parquet(path, index=False)


def _seed_feature_session(root: Path) -> None:
    session_dir = root / "2024" / "Test GP" / "R"
    _write_parquet(
        session_dir / "lap_features.parquet",
        [
            {
                "year": 2024,
                "race_name": "Test GP",
                "session": "R",
                "driver_name": "Max Verstappen",
                "lap_number": 1,
                "lap_duration": 90.101,
                "lap_time_formatted": "1:30.101",
                "position": 1,
                "tyre_compound": "MEDIUM",
            },
            {
                "year": 2024,
                "race_name": "Test GP",
                "session": "R",
                "driver_name": "Max Verstappen",
                "lap_number": 2,
                "lap_duration": 89.992,
                "lap_time_formatted": "1:29.992",
                "position": 1,
                "tyre_compound": "MEDIUM",
            },
        ],
    )
    _write_parquet(
        session_dir / "race_context_features.parquet",
        [
            {
                "lap_number": 2,
                "year": 2024,
                "race_name": "Test GP",
                "session": "R",
                "track_status": "GREEN",
                "track_status_at_lap": "GREEN",
                "air_temperature": 28.4,
                "track_temperature": 38.1,
                "weather_conditions": "Dry",
            }
        ],
    )
    _write_parquet(
        session_dir / "traffic_features.parquet",
        [
            {
                "driver_name": "Max Verstappen",
                "avg_lap_time": 90.12,
                "fastest_lap_time": 89.99,
                "laps_in_traffic": 3,
                "estimated_time_lost": 1.3,
                "year": 2024,
                "race_name": "Test GP",
                "session": "R",
            }
        ],
    )


def test_session_features_payload_non_empty(tmp_path, monkeypatch):
    _seed_feature_session(tmp_path)
    monkeypatch.setattr(features_router, "FEATURES_DIR", tmp_path)

    payload = asyncio.run(
        features_router.get_session_features(
            2024,
            "Test-GP",
            "R",
            sample_limit=2,
        )
    )

    assert payload["n_features"] >= 3
    assert payload["features"]["lap"]["n_rows"] == 2
    assert payload["features"]["lap"]["sample"]

    lap_rows = asyncio.run(features_router.get_lap_features(2024, "Test-GP", "R"))
    assert len(lap_rows) == 2


def test_feature_catalog_schema_consistency(tmp_path, monkeypatch):
    _seed_feature_session(tmp_path)
    monkeypatch.setattr(features_router, "FEATURES_DIR", tmp_path)

    summary = asyncio.run(features_router.get_features_summary())
    expected_types = list(features_router.FEATURE_DATASETS.keys())
    assert summary["feature_types"] == expected_types

    catalog = asyncio.run(features_router.get_session_feature_catalog(2024, "Test-GP", "R", sample_limit=1))
    feature_rows = catalog["features"]
    assert set(feature_rows.keys()).issubset(set(expected_types))
    assert {"lap", "race_context", "traffic"}.issubset(set(feature_rows.keys()))

    for feature_name in ["lap", "race_context", "traffic"]:
        row = feature_rows[feature_name]
        assert row["n_rows"] >= 1
        assert len(row["columns"]) > 0
        assert len(row["sample"]) == 1
