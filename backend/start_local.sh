#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt >/dev/null

export REDIS_ENABLED="${REDIS_ENABLED:-0}"
export TELEMETRYX_REQUIRE_AUTH="${TELEMETRYX_REQUIRE_AUTH:-0}"

echo "Starting TelemetryX backend (no Docker)..."
echo "DATA_SOURCE=duckdb REDIS_ENABLED=$REDIS_ENABLED TELEMETRYX_REQUIRE_AUTH=$TELEMETRYX_REQUIRE_AUTH"
exec uvicorn main:app --host 127.0.0.1 --port 9000
