from __future__ import annotations

import sys
from pathlib import Path
import importlib

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402

ws_router_module = importlib.import_module("api.websocket.router")


client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_ws_state(monkeypatch):
    ws_router_module.manager.active_connections.clear()
    ws_router_module.manager.connection_context.clear()
    ws_router_module.manager.scope_connections.clear()
    ws_router_module.manager.scope_started_at.clear()
    ws_router_module.manager.scope_context.clear()
    for task in list(ws_router_module.manager.scope_ticker_tasks.values()):
        task.cancel()
    ws_router_module.manager.scope_ticker_tasks.clear()
    ws_router_module.manager.counters.clear()
    monkeypatch.delenv("TELEMETRYX_WS_MAX_CONNECTIONS", raising=False)
    monkeypatch.delenv("TELEMETRYX_WS_MAX_CONNECTIONS_PER_USER", raising=False)
    monkeypatch.delenv("TELEMETRYX_WS_MAX_MESSAGES_PER_SEC", raising=False)
    monkeypatch.delenv("TELEMETRYX_WS_REQUIRE_SCOPE", raising=False)


def _receive_until_type(websocket, message_type: str, attempts: int = 8):
    for _ in range(attempts):
        payload = websocket.receive_json()
        if payload.get("type") == message_type:
            return payload
    raise AssertionError(f"Did not receive {message_type!r} within {attempts} messages")


def test_ws_rejects_missing_scope_when_required(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "0")
    monkeypatch.setenv("TELEMETRYX_WS_REQUIRE_SCOPE", "1")
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/v1/ws/telemetry?year=2025") as ws:
            ws.receive_json()


def test_ws_ping_pong_when_auth_disabled(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "0")

    with client.websocket_connect(
        "/api/v1/ws/telemetry?year=2025&race=Bahrain+Grand+Prix&session=R"
    ) as ws:
        ws.send_text("ping")
        pong = _receive_until_type(ws, "pong")
        assert pong["type"] == "pong"


def test_ws_rejects_missing_token_when_auth_required(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "1")
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            "/api/v1/ws/telemetry?year=2025&race=Bahrain+Grand+Prix&session=R"
        ) as ws:
            ws.receive_json()


def test_ws_accepts_valid_token_when_auth_required(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "1")
    monkeypatch.setattr(
        ws_router_module,
        "verify_clerk_token",
        lambda _token: {
            "user_id": "user_123",
            "email": "driver@example.com",
            "org_id": "org_abc",
        },
    )

    with client.websocket_connect(
        "/api/v1/ws/telemetry?token=valid-token&year=2025&race=Bahrain+Grand+Prix&session=R"
    ) as ws:
        tick = _receive_until_type(ws, "telemetry_tick")
        assert tick["year"] == "2025"
        assert tick["session"] == "R"
        ws.send_text("ping")
        assert _receive_until_type(ws, "pong")["type"] == "pong"


def test_ws_rejects_when_per_user_connection_limit_exceeded(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "1")
    monkeypatch.setenv("TELEMETRYX_WS_MAX_CONNECTIONS_PER_USER", "1")
    monkeypatch.setattr(
        ws_router_module,
        "verify_clerk_token",
        lambda _token: {
            "user_id": "user_limit",
            "email": "limit@example.com",
            "org_id": "org_x",
        },
    )

    with client.websocket_connect(
        "/api/v1/ws/telemetry?token=valid-token&year=2025&race=Bahrain+Grand+Prix&session=R"
    ) as first_ws:
        _receive_until_type(first_ws, "telemetry_tick")
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(
                "/api/v1/ws/telemetry?token=valid-token&year=2025&race=Bahrain+Grand+Prix&session=R"
            ) as second_ws:
                second_ws.receive_json()


def test_ws_rate_limit_closes_connection(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "0")
    monkeypatch.setenv("TELEMETRYX_WS_MAX_MESSAGES_PER_SEC", "2")
    with client.websocket_connect(
        "/api/v1/ws/telemetry?year=2025&race=Bahrain+Grand+Prix&session=R"
    ) as ws:
        ws.send_text("one")
        ws.send_text("two")
        ws.send_text("three")
        with pytest.raises(WebSocketDisconnect):
            for _ in range(10):
                ws.receive_json()


def test_ws_stats_endpoint_reports_limits(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "0")
    monkeypatch.setenv("TELEMETRYX_WS_MAX_CONNECTIONS", "15")
    monkeypatch.setenv("TELEMETRYX_WS_MAX_CONNECTIONS_PER_USER", "2")
    monkeypatch.setenv("TELEMETRYX_WS_MAX_MESSAGES_PER_SEC", "7")

    r = client.get("/api/v1/ws/telemetry/stats")
    assert r.status_code == 200
    payload = r.json()
    assert payload["limits"]["max_connections"] == 15
    assert payload["limits"]["max_connections_per_user"] == 2
    assert payload["limits"]["max_messages_per_sec"] == 7


def test_ws_stats_groups_connections_by_scope(monkeypatch):
    monkeypatch.setenv("TELEMETRYX_REQUIRE_AUTH", "0")

    with client.websocket_connect(
        "/api/v1/ws/telemetry?year=2025&race=Bahrain+Grand+Prix&session=R"
    ) as ws1:
        with client.websocket_connect(
            "/api/v1/ws/telemetry?year=2025&race=Bahrain+Grand+Prix&session=R"
        ) as ws2:
            ws1.send_text("ping")
            ws2.send_text("ping")
            _receive_until_type(ws1, "pong")
            _receive_until_type(ws2, "pong")

            stats = client.get("/api/v1/ws/telemetry/stats")
            assert stats.status_code == 200
            body = stats.json()
            assert body["active_connections"] == 2
            assert body["active_scope_tickers"] == 1
            assert body["active_by_scope"]["2025|Bahrain Grand Prix|R"] == 2
