#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TELEMETRYX_API_BASE_URL:-http://127.0.0.1:9000}"
SAMPLES="${SMOKE_SAMPLES:-8}"
YEAR="${SMOKE_YEAR:-2024}"
RACE="${SMOKE_RACE:-Abu-Dhabi-Grand-Prix}"
SESSION="${SMOKE_SESSION:-R}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

HEALTH_URL="${BASE_URL%/}/health"
DS_URL="${BASE_URL%/}/api/v1/health/data-source"
SEASONS_URL="${BASE_URL%/}/api/v1/seasons"
RACES_URL="${BASE_URL%/}/api/v1/races/${YEAR}"
FEATURES_URL="${BASE_URL%/}/api/v1/features/${YEAR}/${RACE}"
SESSION_URL="${BASE_URL%/}/api/v1/sessions/${YEAR}/${RACE}/${SESSION}"
LAPS_URL="${SESSION_URL}/laps"
TEL_URL="${SESSION_URL}/telemetry?hz=2"
POS_URL="${SESSION_URL}/positions?hz=2"
PERF_URL="${BASE_URL%/}/api/v1/metrics/performance/summary"

ENDPOINTS=(
  "$HEALTH_URL"
  "$DS_URL"
  "$SEASONS_URL"
  "$RACES_URL"
  "$FEATURES_URL"
  "$SESSION_URL"
  "$LAPS_URL"
  "$TEL_URL"
  "$POS_URL"
  "$PERF_URL"
)

echo "Smoke target: ${BASE_URL}"
echo "Scenario: ${YEAR} ${RACE} ${SESSION}"
echo "Samples per endpoint: ${SAMPLES}"
echo

STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
if [[ "$STATUS" != "200" ]]; then
  echo "Backend is not healthy at ${HEALTH_URL} (status=${STATUS})." >&2
  echo "Start backend first, for example:" >&2
  echo "  cd backend && ./start_local.sh" >&2
  exit 1
fi

export SMOKE_SAMPLES="$SAMPLES"
python3 - "$DS_URL" "${ENDPOINTS[@]}" <<'PY'
import json
import os
import statistics
import sys
import urllib.request
from urllib.error import URLError, HTTPError

samples = int(os.environ.get("SMOKE_SAMPLES", "8"))
ds_url = sys.argv[1]
endpoints = sys.argv[2:]

def fetch(url: str):
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read()
        return int(resp.getcode()), body

print("Endpoint latency summary")
print("-" * 92)
print(f"{'endpoint':65} {'code':>5} {'p50_ms':>8} {'p95_ms':>8}")
print("-" * 92)

all_ok = True
for url in endpoints:
    timings = []
    code = 0
    for _ in range(samples):
        start = __import__("time").perf_counter()
        try:
            code, _ = fetch(url)
        except HTTPError as e:
            code = int(e.code)
            all_ok = False
            timings.append((__import__("time").perf_counter() - start) * 1000.0)
            break
        except URLError:
            code = 0
            all_ok = False
            timings.append((__import__("time").perf_counter() - start) * 1000.0)
            break
        timings.append((__import__("time").perf_counter() - start) * 1000.0)

    p50 = statistics.median(timings) if timings else 0.0
    p95 = sorted(timings)[int(0.95 * (len(timings) - 1))] if len(timings) > 1 else p50
    print(f"{url[:65]:65} {code:>5} {p50:8.2f} {p95:8.2f}")
    if code != 200:
        all_ok = False

print("-" * 92)
try:
    ds_code, ds_body = fetch(ds_url)
    payload = json.loads(ds_body.decode("utf-8"))
    mode = payload.get("mode")
    duckdb = payload.get("duckdb", {})
    silver = duckdb.get("silver", {})
    print(f"data-source mode={mode} duckdb_enabled={duckdb.get('enabled')} silver_exists={silver.get('exists')} silver_subdirs={silver.get('subdirs')}")
    if ds_code != 200:
        all_ok = False
except Exception as exc:
    print(f"data-source payload read failed: {exc}")
    all_ok = False

if not all_ok:
    sys.exit(2)
PY

echo
echo "Smoke run completed."
