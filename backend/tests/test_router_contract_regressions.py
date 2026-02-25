from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd
from fastapi.testclient import TestClient

from main import app
from api.routers import drivers as drivers_router
from api.routers import laps as laps_router


client = TestClient(app)


def _write_parquet(path: Path, select_query: str) -> None:
    conn = duckdb.connect()
    try:
        conn.execute(f"COPY ({select_query}) TO '{path.as_posix()}' (FORMAT PARQUET)")
    finally:
        conn.close()


def test_head_to_head_route_not_shadowed_by_driver_route(monkeypatch):
    df = pd.DataFrame(
        [
            {"driver_number": 1, "driver_name": "VER", "lap_number": 1, "lap_time_seconds": 90.1, "is_valid_lap": True},
            {"driver_number": 4, "driver_name": "NOR", "lap_number": 1, "lap_time_seconds": 90.4, "is_valid_lap": True},
        ]
    )
    monkeypatch.setattr(laps_router, "_laps_df", lambda *_args, **_kwargs: df)

    resp = client.get(
        "/api/v1/laps/2025/Bahrain-Grand-Prix/head-to-head",
        params={"driver1": "1", "driver2": "4", "session_type": "R"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, dict)
    assert "difference_seconds" in body
    assert body["driver_1"]["number"] == 1
    assert body["driver_2"]["number"] == 4


def test_drivers_endpoint_supports_openf1_schema_without_driver_name(tmp_path, monkeypatch):
    silver = tmp_path / "silver" / "2025" / "Belgian Grand Prix" / "SS"
    silver.mkdir(parents=True)
    _write_parquet(
        silver / "laps.parquet",
        """
        SELECT * FROM (
            VALUES
                (1, 1, 30.0::DOUBLE, 30.0::DOUBLE, 30.0::DOUBLE),
                (2, 4, 30.0::DOUBLE, 30.0::DOUBLE, 30.0::DOUBLE)
        ) AS t(lap_number, driver_number, duration_sector_1, duration_sector_2, duration_sector_3)
        """,
    )
    monkeypatch.setattr(drivers_router, "SILVER_DIR", str(tmp_path / "silver"))

    resp = client.get("/api/v1/drivers/2025/Belgian-Grand-Prix", params={"session_type": "SR", "limit": 10})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["driver"] == "1"
    assert body[0]["driver_number"] == 1
    assert body[1]["driver"] == "4"
    assert body[1]["driver_number"] == 4
