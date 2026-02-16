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
release_gate=0
gate_only=0
print_qa_matrix=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-gate)
      release_gate=1
      ;;
    --gate-only)
      release_gate=1
      gate_only=1
      ;;
    --print-qa-matrix)
      print_qa_matrix=1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--release-gate] [--gate-only] [--print-qa-matrix]" >&2
      exit 2
      ;;
  esac
  shift
done

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

run_release_gate() {
  local checklist_flag=""
  if [[ "${print_qa_matrix}" == "1" ]]; then
    checklist_flag="--print-checklist"
  fi

  echo "[phase6] running backend consistency gate (R, SR, Q)"
  "${PY}" scripts/diagnose_backend.py --release-gate --sessions "R,SR,Q" ${checklist_flag}

  echo "[phase6] running regression tests"
  PYTHONPATH="${PWD}/backend${PYTHONPATH:+:${PYTHONPATH}}" "${PY}" -m pytest backend/tests/test_lap_selection_logic.py -q
  PYTHONPATH="${PWD}/frontend:${PWD}/frontend/app${PYTHONPATH:+:${PYTHONPATH}}" "${PY}" -m pytest frontend/tests/ui/test_main_window.py -q
}

if [[ "${release_gate}" == "1" ]]; then
  run_release_gate
  if [[ "${gate_only}" == "1" ]]; then
    exit 0
  fi
fi

"${PY}" -m app.main
