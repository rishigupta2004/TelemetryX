from __future__ import annotations

import os
from pathlib import Path

# This project keeps parquet as the canonical storage format.
# The API queries parquet via DuckDB (read_parquet) and should not depend on pandas parquet engines.
#
# In production, mount the data directory into the container and set:
#   TELEMETRYX_DATA_ROOT=/data
#
# Expected layout under TELEMETRYX_DATA_ROOT:
#   silver/{year}/{Race Name}/{Q,R,S,SS}/...
#   bronze/{year}/{Race Name}/{Q,R,S,SS}/...
#   gold/{year}/{Race Name}/{Q,R,S,SS}/...
#   features/{year}/{Race Name}/{Q,R,S,SS}/...
#   track_geometry/...


def _default_data_root() -> Path:
    backend_dir = Path(__file__).resolve().parents[1]  # .../backend
    return backend_dir / "etl" / "data"


REPO_ROOT = Path(__file__).resolve().parents[2]
INPUTS_DIR = REPO_ROOT / "_inputs"
INPUTS_SEASONS_DIR = INPUTS_DIR / "seasons"
INPUTS_TRACKS_DIR = INPUTS_DIR / "tracks"


def _env_or_default(name: str, default: Path) -> Path:
    value = os.getenv(name)
    if value:
        return Path(value).expanduser().resolve()
    return default


DATA_ROOT = (
    Path(os.getenv("TELEMETRYX_DATA_ROOT", str(_default_data_root())))
    .expanduser()
    .resolve()
)

SILVER_DIR = DATA_ROOT / "silver"
BRONZE_DIR = DATA_ROOT / "bronze"
GOLD_DIR = DATA_ROOT / "gold"
FEATURES_DIR = DATA_ROOT / "features"
MEDIA_CACHE_DIR = DATA_ROOT / "media_cache"
TRACK_GEOMETRY_DIR = (
    Path(os.getenv("TELEMETRYX_TRACK_GEOMETRY_DIR", str(DATA_ROOT / "track_geometry")))
    .expanduser()
    .resolve()
)
CATALOG_DIR = _env_or_default(
    "TELEMETRYX_CATALOG_DIR",
    INPUTS_SEASONS_DIR if INPUTS_SEASONS_DIR.exists() else DATA_ROOT / "catalog",
)

# ML model artifacts (trained outputs). In production this can be mounted separately.
MODELS_DIR = (
    Path(os.getenv("TELEMETRYX_MODELS_DIR", str(REPO_ROOT / "scripts" / "models")))
    .expanduser()
    .resolve()
)

# Serving data source mode:
# - duckdb: Parquet + DuckDB only
# - clickhouse: ClickHouse primary for hot endpoints
# - shadow: DuckDB response with ClickHouse comparison logging
DATA_SOURCE_MODE = str(os.getenv("TELEMETRYX_DATA_SOURCE", "duckdb")).strip().lower()
