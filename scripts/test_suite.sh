#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[suite] backend + ml/features tests"
python3 -m pytest backend/tests tests/test_features_router.py -q

echo "[suite] frontend unit/integration tests"
npm --prefix frontend-electron run test

echo "[suite] frontend production build"
npm --prefix frontend-electron run build

echo "[suite] all checks passed"
