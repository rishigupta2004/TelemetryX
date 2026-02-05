#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Canonical dev/runtime Python for this repo. Avoid conda/base surprises.
PY="${PYTHON:-}"
if [[ -z "${PY}" ]]; then
  if command -v python3.12 >/dev/null 2>&1; then
    PY="python3.12"
  elif command -v python3 >/dev/null 2>&1; then
    PY="python3"
  else
    echo "python3 not found on PATH." >&2
    exit 1
  fi
fi

if [[ ! -x ".venv/bin/python" ]]; then
  "${PY}" -m venv .venv
fi

VENV_PY=".venv/bin/python"

"${VENV_PY}" -m pip install -U pip
"${VENV_PY}" -m pip install -r requirements.txt
"${VENV_PY}" -m pip install -e "frontend[dev]"

echo "OK"
echo "Run: bash scripts/run_desktop_local.sh"

