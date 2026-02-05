#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Run desktop against a local backend.
export PYTHONPATH="${PYTHONPATH:-}:$PWD/frontend"

PY="${PYTHON:-python3}"
if [[ -x ".venv/bin/python" ]]; then
  PY=".venv/bin/python"
fi

PORT="${PORT:-9010}"
if [[ -z "${TELEMETRYX_API_BASE_URL:-}" && -f .telemetryx_port ]]; then
  saved_port="$(cat .telemetryx_port 2>/dev/null || true)"
  if [[ "${saved_port}" =~ ^[0-9]+$ ]]; then
    PORT="${saved_port}"
  fi
fi

export PORT
export TELEMETRYX_API_BASE_URL="${TELEMETRYX_API_BASE_URL:-http://localhost:${PORT}/api/v1}"
health_url="${TELEMETRYX_API_BASE_URL%/api/v1}/health"

backend_pid=""
cleanup() {
  if [[ -n "${backend_pid}" ]]; then
    kill "${backend_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

is_healthy() {
  local body
  body="$(curl -fsS "${health_url}" 2>/dev/null || true)"
  "${PY}" -c 'import json,sys
try:
    data=json.load(sys.stdin)
except Exception:
    sys.exit(1)
sys.exit(0 if data.get("status")=="healthy" else 1)
' 2>/dev/null <<<"${body}"
}

can_inproc() {
  "${PY}" -c 'import sys
from pathlib import Path
repo=str(Path.cwd())
sys.path.insert(0, repo)
sys.path.insert(0, repo + "/frontend")
from backend.main import app  # type: ignore
from starlette.testclient import TestClient  # type: ignore
c=TestClient(app)
r=c.get("/health")
raise SystemExit(0 if getattr(r,"status_code",0)==200 else 1)
' >/dev/null 2>&1
}

# If the user explicitly requests in-process mode, skip any local server startup.
if [[ "${TELEMETRYX_BACKEND_MODE:-}" == "inproc" ]]; then
  "${PY}" -m app.main
  exit 0
fi

# If localhost networking is blocked but imports work, use in-process backend (fast start).
if ! is_healthy && can_inproc; then
  export TELEMETRYX_BACKEND_MODE="inproc"
  "${PY}" -m app.main
  exit 0
fi

if ! is_healthy; then
  # Prefer local uvicorn for dev unless TELEMETRYX_USE_DOCKER=1.
  if [[ "${TELEMETRYX_USE_DOCKER:-0}" == "1" ]]; then
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      docker compose up --build -d telemetryx-backend
    else
      echo "Docker not available/running. Start Docker Desktop or unset TELEMETRYX_USE_DOCKER." >&2
      exit 1
    fi
  else
    ports=("${PORT}" 9010 9011 9012 9020 9030 9040)
    started=0
    for p in "${ports[@]}"; do
      export PORT="${p}"
      export TELEMETRYX_API_BASE_URL="http://localhost:${PORT}/api/v1"
      health_url="${TELEMETRYX_API_BASE_URL%/api/v1}/health"

      "${PY}" -m uvicorn backend.main:app --host 127.0.0.1 --port "${PORT}" --log-level warning &
      backend_pid="$!"

      # Wait for health or early exit.
      for _ in $(seq 1 80); do
        if is_healthy; then
          started=1
          break
        fi
        if ! kill -0 "${backend_pid}" >/dev/null 2>&1; then
          break
        fi
        sleep 0.25
      done

      if [[ "${started}" == "1" ]]; then
        echo "${PORT}" > .telemetryx_port
        break
      fi

      kill "${backend_pid}" >/dev/null 2>&1 || true
      backend_pid=""
    done
  fi

  # Wait for health (Docker path)
  if [[ "${TELEMETRYX_USE_DOCKER:-0}" == "1" ]]; then
    for _ in $(seq 1 120); do
      if is_healthy; then
        break
      fi
      sleep 0.25
    done
  fi
fi

if ! is_healthy; then
  echo "Backend not reachable at ${health_url}." >&2
  echo "Falling back to in-process backend (no HTTP server)." >&2
  export TELEMETRYX_BACKEND_MODE="inproc"
fi

"${PY}" -m app.main
