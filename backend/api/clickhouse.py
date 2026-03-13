from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Optional


def data_source_mode() -> str:
    return str(os.getenv("TELEMETRYX_DATA_SOURCE", "duckdb")).strip().lower()


def clickhouse_enabled() -> bool:
    return data_source_mode() in {"clickhouse", "shadow"}


def clickhouse_primary() -> bool:
    return data_source_mode() == "clickhouse"


def clickhouse_shadow() -> bool:
    return data_source_mode() == "shadow"


def clickhouse_primary_strict() -> bool:
    raw = str(os.getenv("TELEMETRYX_CLICKHOUSE_PRIMARY_STRICT", "1")).strip()
    return raw not in {"0", "false", "False", "no", "off"}


def clickhouse_host() -> str:
    return str(os.getenv("CLICKHOUSE_HOST", "localhost")).strip()


def clickhouse_port() -> int:
    try:
        return int(os.getenv("CLICKHOUSE_PORT", "8123"))
    except Exception:
        return 8123


def clickhouse_database() -> str:
    return str(os.getenv("CLICKHOUSE_DATABASE", "telemetryx")).strip() or "telemetryx"


def clickhouse_user() -> str:
    return str(os.getenv("CLICKHOUSE_USER", "default")).strip() or "default"


def clickhouse_password() -> str:
    return str(os.getenv("CLICKHOUSE_PASSWORD", "")).strip()


@lru_cache(maxsize=1)
def get_clickhouse_client() -> Optional[Any]:
    if not clickhouse_enabled():
        return None
    try:
        import clickhouse_connect  # type: ignore

        return clickhouse_connect.get_client(
            host=clickhouse_host(),
            port=clickhouse_port(),
            username=clickhouse_user(),
            password=clickhouse_password(),
            database=clickhouse_database(),
        )
    except Exception:
        return None
