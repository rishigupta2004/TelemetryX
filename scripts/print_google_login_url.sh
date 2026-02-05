#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"
if [[ -x ".venv/bin/python" ]]; then
  PY=".venv/bin/python"
fi

if [[ -z "${TELEMETRYX_API_BASE_URL:-}" && -f .telemetryx_port ]]; then
  saved_port="$(cat .telemetryx_port 2>/dev/null || true)"
  if [[ "${saved_port}" =~ ^[0-9]+$ ]]; then
    base="http://localhost:${saved_port}/api/v1"
  else
    base="http://localhost:9010/api/v1"
  fi
else
  base="${TELEMETRYX_API_BASE_URL:-http://localhost:9010/api/v1}"
fi
export TELEMETRYX_API_BASE_URL="${base}"
start_url="${base%/}/auth/oauth/google/start"
health_url="${base%/api/v1}/health"

is_local=0
host="$("${PY}" - <<'PY'
from urllib.parse import urlparse
import os
base=os.environ.get("TELEMETRYX_API_BASE_URL","http://localhost:9010/api/v1")
print((urlparse(base).hostname or "").lower())
PY
)"
if [[ "${host}" == "localhost" || "${host}" == "127.0.0.1" ]]; then
  is_local=1
fi

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

if ! is_healthy; then
  if [[ "${is_local}" -ne 1 ]]; then
    echo "Backend not reachable at ${base}. Start it and re-run." >&2
    exit 1
  fi

  port="$("${PY}" - <<'PY'
from urllib.parse import urlparse
import os
u=urlparse(os.environ.get("TELEMETRYX_API_BASE_URL","http://localhost:9010/api/v1"))
print(u.port or 9010)
PY
)"
  echo "Backend not running; starting local backend on :${port}..." >&2
  "${PY}" -m uvicorn backend.main:app --host 127.0.0.1 --port "${port}" --log-level warning &
  backend_pid="$!"

  for _ in $(seq 1 80); do
    if is_healthy; then
      echo "Backend started (pid ${backend_pid})." >&2
      break
    fi
    sleep 0.25
  done
fi

if ! is_healthy; then
  echo "Backend still not reachable at ${health_url}. Check uvicorn/Docker logs." >&2
  exit 1
fi

resp="$(curl -sS -w '\n__HTTP_STATUS__:%{http_code}\n' "${start_url}")"
status="$(printf '%s' "${resp}" | tail -n 1 | sed 's/__HTTP_STATUS__://')"
body="$(printf '%s' "${resp}" | sed '$d')"

if [[ "${status}" != "200" ]]; then
  echo "OAuth start failed (HTTP ${status}). Response:" >&2
  echo "${body}" >&2
  exit 1
fi
if [[ -z "${body}" ]]; then
  echo "OAuth start returned an empty response. Check backend logs." >&2
  exit 1
fi

"${PY}" -c 'import json, sys
raw = sys.stdin.read() or ""
try:
    payload = json.loads(raw)
except Exception:
    sys.stderr.write("OAuth start returned non-JSON. Raw response follows:\\n")
    sys.stderr.write(raw + "\\n")
    raise SystemExit(1)
print(payload.get("auth_url", ""))
' <<<"${body}"
