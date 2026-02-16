#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:-playback.log}"
RUNTIME_S="${RUNTIME_S:-180}"
BACKEND_MODE="${TELEMETRYX_BACKEND_MODE:-inproc}"
QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"

echo "[smoke] starting app for ${RUNTIME_S}s -> ${LOG_FILE}"
export TELEMETRYX_SMOKE_TOWER=1
export TELEMETRYX_BACKEND_MODE="${BACKEND_MODE}"
export QT_QPA_PLATFORM="${QPA_PLATFORM}"
set +e
timeout "${RUNTIME_S}"s python -m frontend.app.main > "${LOG_FILE}" 2>&1
APP_EXIT=$?
set -e
echo "[smoke] app_exit=${APP_EXIT} backend_mode=${TELEMETRYX_BACKEND_MODE} qt_qpa=${QT_QPA_PLATFORM}"
if [ "${APP_EXIT}" -ne 0 ] && [ "${APP_EXIT}" -ne 124 ]; then
  echo "[smoke] warning: app exited before timeout"
fi

TICK_START_COUNT="$(grep -c '"event":"tick_start"' "${LOG_FILE}" || true)"
echo "[smoke] tick_start_events=${TICK_START_COUNT}"
STARTUP_EXIT=0
if [ "${TICK_START_COUNT}" -lt 3 ]; then
  STARTUP_EXIT=2
  echo "[smoke] startup gate failed: too few tick_start events (<3)"
  echo "[smoke] tail ${LOG_FILE}:"
  tail -n 40 "${LOG_FILE}" || true
fi
AUTOPLAY_STARTED_COUNT="$(grep -c '"event":"smoke_autoplay_started"' "${LOG_FILE}" || true)"
echo "[smoke] smoke_autoplay_started_events=${AUTOPLAY_STARTED_COUNT}"
if [ "${AUTOPLAY_STARTED_COUNT}" -lt 1 ]; then
  STARTUP_EXIT=3
  echo "[smoke] startup gate failed: smoke autoplay never started"
  echo "[smoke] smoke startup events:"
  grep '"event":"smoke_' "${LOG_FILE}" || true
fi

echo "[smoke] timing tower"
TOWER_EXIT=0
python scripts/smoke_timing_tower.py "${LOG_FILE}" --strict || TOWER_EXIT=$?

echo "[smoke] telemetry binding"
TEL_EXIT=0
python scripts/smoke_telemetry_binding.py "${LOG_FILE}" --strict --require-ok-status || TEL_EXIT=$?

echo "[smoke] done"
if [ "${STARTUP_EXIT}" -ne 0 ]; then
  exit "${STARTUP_EXIT}"
fi
if [ "${TOWER_EXIT}" -ne 0 ]; then
  exit "${TOWER_EXIT}"
fi
if [ "${TEL_EXIT}" -ne 0 ]; then
  exit "${TEL_EXIT}"
fi
