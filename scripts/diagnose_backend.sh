#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"
if [[ -x ".venv/bin/python" ]]; then
  PY=".venv/bin/python"
fi

TELEMETRYX_BACKEND_MODE="${TELEMETRYX_BACKEND_MODE:-inproc}" "${PY}" scripts/diagnose_backend.py

