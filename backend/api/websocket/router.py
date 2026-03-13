import asyncio
import contextlib
import os
import sys
import time
import uuid
from collections import defaultdict, deque
from typing import Any, Deque, Dict, Set, Tuple

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)

from ..clerk_auth import verify_clerk_token
from ..routers import metrics as metrics_router

router = APIRouter()


def _ws_int_env(name: str, default: int, min_value: int = 1) -> int:
    raw = str(os.getenv(name, str(default))).strip()
    try:
        value = int(raw)
    except Exception:
        value = int(default)
    return max(min_value, value)


def _ws_require_auth() -> bool:
    explicit = os.getenv("TELEMETRYX_REQUIRE_AUTH")
    if explicit is not None:
        return explicit.strip() == "1"
    if "pytest" in sys.modules:
        return False
    return True


def _ws_require_scope() -> bool:
    explicit = os.getenv("TELEMETRYX_WS_REQUIRE_SCOPE")
    if explicit is not None:
        return explicit.strip() != "0"
    return True


def _ws_max_connections() -> int:
    return _ws_int_env("TELEMETRYX_WS_MAX_CONNECTIONS", 200)


def _ws_max_connections_per_user() -> int:
    return _ws_int_env("TELEMETRYX_WS_MAX_CONNECTIONS_PER_USER", 4)


def _ws_max_messages_per_second() -> int:
    return _ws_int_env("TELEMETRYX_WS_MAX_MESSAGES_PER_SEC", 30)


def _extract_ws_token(websocket: WebSocket) -> str | None:
    token = (websocket.query_params.get("token") or "").strip()
    if token:
        return token
    auth_header = (websocket.headers.get("authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        bearer = auth_header.split(" ", 1)[1].strip()
        return bearer or None
    return None


def _resolve_ws_actor(websocket: WebSocket) -> Dict[str, str]:
    if not _ws_require_auth():
        return {"user_id": "anon", "email": "", "org_id": ""}

    token = _extract_ws_token(websocket)
    if not token:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing bearer token",
        )
    try:
        return verify_clerk_token(token)
    except Exception as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=f"Invalid token: {exc}",
        )


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_context: Dict[str, Dict[str, Any]] = {}
        self.scope_connections: Dict[str, Set[str]] = defaultdict(set)
        self.scope_started_at: Dict[str, float] = {}
        self.scope_context: Dict[str, Dict[str, Any]] = {}
        self.scope_ticker_tasks: Dict[str, asyncio.Task[Any]] = {}
        self.counters: Dict[str, int] = defaultdict(int)

    @staticmethod
    def _scope_key(context: Dict[str, Any]) -> str:
        return (
            f"{str(context.get('year') or '-')}|"
            f"{str(context.get('race') or '-')}|"
            f"{str(context.get('session') or '-')}"
        )

    def _active_user_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for ctx in self.connection_context.values():
            user_id = str(ctx.get("user_id") or "anon")
            counts[user_id] += 1
        return dict(counts)

    def _active_scope_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for ctx in self.connection_context.values():
            scope = f"{ctx.get('year') or '-'}|{ctx.get('race') or '-'}|{ctx.get('session') or '-'}"
            counts[scope] += 1
        return dict(counts)

    def can_accept(self, context: Dict[str, Any]) -> Tuple[bool, str | None]:
        if len(self.active_connections) >= _ws_max_connections():
            return False, "Connection limit exceeded"

        user_id = str(context.get("user_id") or "anon")
        user_connections = 0
        for ctx in self.connection_context.values():
            if str(ctx.get("user_id") or "anon") == user_id:
                user_connections += 1
        if user_connections >= _ws_max_connections_per_user():
            return False, "Per-user connection limit exceeded"
        return True, None

    async def connect(
        self, websocket: WebSocket, client_id: str, context: Dict[str, Any]
    ):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_context[client_id] = context
        scope = self._scope_key(context)
        self.scope_connections[scope].add(client_id)
        if scope not in self.scope_started_at:
            self.scope_started_at[scope] = time.perf_counter()
            self.scope_context[scope] = {
                "year": context.get("year"),
                "race": context.get("race"),
                "session": context.get("session"),
            }
        existing = self.scope_ticker_tasks.get(scope)
        if existing is None or existing.done():
            self.scope_ticker_tasks[scope] = asyncio.create_task(
                self.stream_scope_ticks(scope)
            )
            self.counters["scope_tickers_started"] += 1
            metrics_router.increment_counter("ws_scope_tickers_started_total", 1)
        self.counters["accepted"] += 1
        metrics_router.increment_counter("ws_connections_accepted_total", 1)

    def mark_rejected(self):
        self.counters["rejected"] += 1
        metrics_router.increment_counter("ws_connections_rejected_total", 1)

    def mark_rate_limited(self):
        self.counters["rate_limited"] += 1
        metrics_router.increment_counter("ws_messages_rate_limited_total", 1)

    def disconnect(self, client_id: str):
        had_connection = client_id in self.active_connections
        context = self.connection_context.get(client_id)
        if had_connection:
            del self.active_connections[client_id]
            self.counters["disconnects"] += 1
            metrics_router.increment_counter("ws_disconnects_total", 1)
        if context is not None:
            scope = self._scope_key(context)
            scoped = self.scope_connections.get(scope)
            if scoped is not None:
                scoped.discard(client_id)
                if not scoped:
                    self.scope_connections.pop(scope, None)
                    self.scope_started_at.pop(scope, None)
                    self.scope_context.pop(scope, None)
                    task = self.scope_ticker_tasks.pop(scope, None)
                    try:
                        current = asyncio.current_task()
                    except RuntimeError:
                        current = None
                    if task is not None and task is not current and not task.done():
                        task.cancel()
                        self.counters["scope_tickers_stopped"] += 1
                        metrics_router.increment_counter(
                            "ws_scope_tickers_stopped_total", 1
                        )
        self.connection_context.pop(client_id, None)

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

    async def stream_scope_ticks(self, scope: str):
        try:
            while True:
                client_ids = list(self.scope_connections.get(scope) or ())
                if not client_ids:
                    break
                context = self.scope_context.get(scope, {})
                started = self.scope_started_at.get(scope, time.perf_counter())
                current_time = round(time.perf_counter() - started, 3)
                dead_clients: list[str] = []
                self.counters["tick_frames"] += 1
                metrics_router.increment_counter("ws_tick_frames_total", 1)
                for client_id in client_ids:
                    websocket = self.active_connections.get(client_id)
                    if websocket is None:
                        dead_clients.append(client_id)
                        continue
                    payload = {
                        "type": "telemetry_tick",
                        "currentTime": current_time,
                        "year": context.get("year"),
                        "race": context.get("race"),
                        "session": context.get("session"),
                    }
                    try:
                        await websocket.send_json(payload)
                        self.counters["ticks_sent"] += 1
                        metrics_router.increment_counter("ws_ticks_sent_total", 1)
                    except Exception:
                        dead_clients.append(client_id)
                        self.counters["broadcast_errors"] += 1
                        metrics_router.increment_counter("ws_broadcast_errors_total", 1)

                for client_id in dead_clients:
                    self.disconnect(client_id)

                await asyncio.sleep(0.25)
        finally:
            task = self.scope_ticker_tasks.get(scope)
            if task is asyncio.current_task():
                self.scope_ticker_tasks.pop(scope, None)
                self.counters["scope_tickers_stopped"] += 1
                metrics_router.increment_counter("ws_scope_tickers_stopped_total", 1)

    async def stream_ticks(self, client_id: str):
        # Backward-compatible shim for older tests/imports.
        context = self.connection_context.get(client_id, {})
        scope = self._scope_key(context)
        await self.stream_scope_ticks(scope)

    def snapshot(self) -> Dict[str, Any]:
        return {
            "active_connections": len(self.active_connections),
            "limits": {
                "max_connections": _ws_max_connections(),
                "max_connections_per_user": _ws_max_connections_per_user(),
                "max_messages_per_sec": _ws_max_messages_per_second(),
            },
            "counters": {
                "accepted": int(self.counters.get("accepted", 0)),
                "rejected": int(self.counters.get("rejected", 0)),
                "disconnects": int(self.counters.get("disconnects", 0)),
                "rate_limited": int(self.counters.get("rate_limited", 0)),
                "ticks_sent": int(self.counters.get("ticks_sent", 0)),
                "tick_frames": int(self.counters.get("tick_frames", 0)),
                "scope_tickers_started": int(
                    self.counters.get("scope_tickers_started", 0)
                ),
                "scope_tickers_stopped": int(
                    self.counters.get("scope_tickers_stopped", 0)
                ),
                "broadcast_errors": int(self.counters.get("broadcast_errors", 0)),
            },
            "active_scope_tickers": len(self.scope_ticker_tasks),
            "active_by_user": self._active_user_counts(),
            "active_by_scope": self._active_scope_counts(),
        }


manager = ConnectionManager()


@router.get("/ws/telemetry/stats")
async def websocket_telemetry_stats() -> Dict[str, Any]:
    return manager.snapshot()


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    client_id = uuid.uuid4().hex

    try:
        actor = _resolve_ws_actor(websocket)
        context = {
            "year": websocket.query_params.get("year"),
            "race": websocket.query_params.get("race"),
            "session": websocket.query_params.get("session"),
            "token_present": bool(websocket.query_params.get("token")),
            "user_id": actor.get("user_id"),
            "org_id": actor.get("org_id"),
        }

        if _ws_require_scope() and (
            not context["year"] or not context["race"] or not context["session"]
        ):
            manager.mark_rejected()
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="year, race, and session are required",
            )

        allowed, reason = manager.can_accept(context)
        if not allowed:
            manager.mark_rejected()
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason=reason or "Connection rejected",
            )

        await manager.connect(websocket, client_id, context)

        max_messages_per_sec = _ws_max_messages_per_second()
        inbound_window: Deque[float] = deque()
        while True:
            data = await websocket.receive_text()
            now = time.perf_counter()
            inbound_window.append(now)
            while inbound_window and (now - inbound_window[0]) > 1.0:
                inbound_window.popleft()
            if len(inbound_window) > max_messages_per_sec:
                manager.mark_rate_limited()
                raise WebSocketException(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="Rate limit exceeded",
                )

            if data.strip().lower() == "ping":
                metrics_router.increment_counter("ws_ping_messages_total", 1)
                await manager.send_message(client_id, {"type": "pong"})
                continue

            metrics_router.increment_counter("ws_messages_received_total", 1)
            await manager.send_message(client_id, {"type": "received", "data": data})
    except WebSocketDisconnect:
        pass
    except WebSocketException as exc:
        with contextlib.suppress(Exception):
            await websocket.close(code=exc.code, reason=exc.reason)
    finally:
        manager.disconnect(client_id)
