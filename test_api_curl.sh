#!/usr/bin/env bash
# TelemetryX API Curl Test Suite
# Tests all major endpoints and validates response shapes + values
# Usage: ./test_api_curl.sh [BASE_URL] [YEAR] [RACE] [SESSION]

set -euo pipefail

BASE="${1:-http://localhost:9000/api/v1}"
YEAR="${2:-2023}"
RACE="${3:-bahrain-grand-prix}"
SESSION="${4:-R}"
DRIVER="${5:-1}"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

pass=0; fail=0; warn=0

header() { echo -e "\n${BOLD}════════════════════════════════════════${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${BOLD}════════════════════════════════════════${NC}"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; ((pass++)); }
fail()   { echo -e "  ${RED}✗${NC} $1"; ((fail++)); }
warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; ((warn++)); }

# Core test runner: curl + jq validation
test_endpoint() {
    local label="$1"; local url="$2"; local check="$3"
    local resp http_code body

    resp=$(curl -s -w "\n__HTTP_CODE__:%{http_code}" --max-time 10 "$url" 2>/dev/null || true)
    http_code=$(echo "$resp" | grep '__HTTP_CODE__:' | cut -d: -f2)
    body=$(echo "$resp" | sed '/^__HTTP_CODE__:/d')

    if [[ "$http_code" == "200" ]]; then
        # Run jq validation if provided
        if [[ -n "$check" ]]; then
            local result
            result=$(echo "$body" | python3 -c "$check" 2>&1)
            if [[ $? -eq 0 ]]; then
                ok "$label → HTTP 200 | $result"
            else
                warn "$label → HTTP 200 but check failed: $result"
            fi
        else
            ok "$label → HTTP 200"
        fi
    else
        fail "$label → HTTP ${http_code:-TIMEOUT/ERROR}"
        echo "       URL: $url"
        [[ -n "$body" ]] && echo "       Body: $(echo "$body" | head -c 200)"
    fi
}

echo -e "\n${BOLD}TelemetryX API Test Suite${NC}"
echo -e "Base:    ${YELLOW}$BASE${NC}"
echo -e "Session: ${YELLOW}$YEAR / $RACE / $SESSION${NC}"

# ── 1. HEALTH ────────────────────────────────────────────────────────────────
header "1. Health & Infrastructure"

test_endpoint "GET /health" \
    "${BASE%/api/v1}/health" \
    "import sys,json; d=json.load(sys.stdin); assert d.get('status') in ('ok','healthy','up','running'), f'status={d}'; print(f'status={d[\"status\"]}')"

test_endpoint "GET /metrics" \
    "${BASE}/metrics" \
    "import sys; body=sys.stdin.read(); assert len(body) > 0, 'empty metrics'; lines=[l for l in body.split('\n') if l.strip()]; print(f'{len(lines)} metric lines')"

# ── 2. SEASONS & RACES ───────────────────────────────────────────────────────
header "2. Seasons & Races"

test_endpoint "GET /seasons" \
    "${BASE}/seasons" \
    "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list) and len(d)>0, 'empty'; years=[x['year'] for x in d]; print(f'years={years[:5]}')"

test_endpoint "GET /races/{year}" \
    "${BASE}/races/${YEAR}" \
    "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list) and len(d)>0, 'empty'; print(f'{len(d)} races, first={d[0].get(\"race_name\",d[0].get(\"name\",\"?\"))}')"

test_endpoint "GET /seasons/{year}" \
    "${BASE}/seasons/${YEAR}" \
    "import sys,json; d=json.load(sys.stdin); assert d.get('year')==${YEAR}, 'year mismatch'; print(f'year={d[\"year\"]}')"

test_endpoint "GET /seasons/{year}/races" \
    "${BASE}/seasons/${YEAR}/races" \
    "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list), 'not list'; print(f'{len(d)} races')"

# ── 3. SESSIONS ───────────────────────────────────────────────────────────────
header "3. Sessions"

test_endpoint "GET /features/{year}/{race} (session list)" \
    "${BASE}/features/${YEAR}/${RACE}" \
    "import sys,json; d=json.load(sys.stdin); sessions=d.get('sessions',[]); print(f'sessions={sessions}')"

test_endpoint "GET /sessions/{year}/{race}/{session}/viz" \
    "${BASE}/sessions/${YEAR}/${RACE}/${SESSION}/viz?include_weather=1&include_race_control=1" \
    "
import sys,json
d=json.load(sys.stdin)
meta=d.get('metadata',{})
drivers=d.get('drivers',[])
laps=d.get('laps',[])
assert meta.get('year')==${YEAR}, f'year mismatch got {meta}'
dur=meta.get('duration',0)
tl=meta.get('totalLaps',0)
print(f'drivers={len(drivers)} laps={len(laps)} duration={dur:.0f}s totalLaps={tl}')
"

test_endpoint "GET /sessions/{year}/{race}/{session}/laps" \
    "${BASE}/sessions/${YEAR}/${RACE}/${SESSION}/laps" \
    "
import sys,json
d=json.load(sys.stdin)
assert isinstance(d,list), 'not list'
if d:
    sample=d[0]
    keys=list(sample.keys())
    assert 'driverNumber' in sample or 'driver_number' in sample, f'missing driver col, keys={keys[:8]}'
    lap_times=[x.get('lapTime',x.get('lap_time_seconds')) for x in d if x.get('lapTime') or x.get('lap_time_seconds')]
    if lap_times:
        times=[t for t in lap_times if t and t>0]
        best=min(times) if times else None
        print(f'{len(d)} laps, best={best:.3f}s' if best else f'{len(d)} laps (no valid times)')
    else:
        print(f'{len(d)} laps')
"

test_endpoint "GET /sessions/{year}/{race}/{session}/telemetry (windowed)" \
    "${BASE}/sessions/${YEAR}/${RACE}/${SESSION}/telemetry?hz=1&t0=0&t1=60" \
    "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,dict) and 'telemetryUnavailableReason' in d:
    reason=d['telemetryUnavailableReason']
    print(f'UNAVAILABLE: {reason}')
elif isinstance(d,dict):
    drivers=list(d.keys())
    total=sum(len(v) for v in d.values())
    sample_row=next(iter(d.values()),[{}])[0] if d else {}
    channels=[k for k in sample_row if k not in ('driverNumber','driverName','timestamp')]
    print(f'drivers={drivers[:4]} rows={total} channels={channels}')
else:
    print(f'type={type(d).__name__} keys={list(d.keys())[:5] if isinstance(d,dict) else \"n/a\"}')
"

test_endpoint "GET /sessions/{year}/{race}/{session}/positions (windowed)" \
    "${BASE}/sessions/${YEAR}/${RACE}/${SESSION}/positions?hz=2&t0=0&t1=30" \
    "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,list):
    if d:
        sample=d[0]
        x_range=[min(r.get('x',0) for r in d), max(r.get('x',0) for r in d)]
        drivers=len({r.get('driverNumber') for r in d})
        print(f'{len(d)} rows, {drivers} drivers, x_range=[{x_range[0]:.0f},{x_range[1]:.0f}]')
    else:
        print('0 rows (positions may not be available)')
elif isinstance(d,dict) and 'positions' in d:
    rows=d['positions']
    print(f'{len(rows)} rows (wrapped)')
"

# ── 4. FEATURES ───────────────────────────────────────────────────────────────
header "4. Feature Engineering Endpoints"

for feat in lap tyre telemetry comparison position traffic overtakes points race-context; do
    test_endpoint "GET /features/.../$(echo $feat | tr '-' '_')" \
        "${BASE}/features/${YEAR}/${RACE}/${SESSION}/${feat}" \
        "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,list):
    print(f'{len(d)} rows' + (', cols='+str(list(d[0].keys())[:6]) if d else ''))
elif isinstance(d,dict):
    print(f'dict keys={list(d.keys())[:5]}')
"
done

# ── 5. DRIVER SUMMARY ─────────────────────────────────────────────────────────
header "5. Driver Summary"

test_endpoint "GET /features/.../driver-summary (driver=${DRIVER})" \
    "${BASE}/features/${YEAR}/${RACE}/${SESSION}/driver-summary?driver=${DRIVER}" \
    "
import sys,json
d=json.load(sys.stdin)
avail=d.get('available',False)
if not avail:
    print(f'UNAVAILABLE: {d.get(\"reason\",\"?\")}')
else:
    lap=d.get('lap_analysis',{})
    tyre=d.get(' tyre_analysis',{})
    tel=d.get('telemetry_analysis',{})
    pos=d.get('driver_performance',{})
    print(f'lapN={lap.get(\"lap_number\")} pos={lap.get(\"position\")} compound={ tyre.get(\"current_compound\")} vmax={tel.get(\"speed_max\")} pts={pos.get(\"points\")}')
"

# ── 6. ML MODELS ──────────────────────────────────────────────────────────────
header "6. ML Models"

test_endpoint "GET /models/clustering" \
    "${BASE}/models/clustering" \
    "
import sys,json
d=json.load(sys.stdin)
clusters=d.get('clusters',[])
n=d.get('n_clusters',d.get('n_drivers','?'))
silh=d.get('silhouette_score','?')
labels=d.get('cluster_labels',{})
print(f'{len(clusters)} drivers, n_clusters={n}, silhouette={silh}, labels={list(labels.values())[:3]}')
"

test_endpoint "GET /models/strategy-recommendations/{year}/{race}" \
    "${BASE}/models/strategy-recommendations/${YEAR}/${RACE}" \
    "
import sys,json
d=json.load(sys.stdin)
best=d.get('best_strategy',{})
n_sim=d.get('n_simulations','?')
all_s=d.get('all_strategies',{})
if best:
    strat=best.get('strategy','?')
    pos=best.get('avg_finish_position','?')
    pts=best.get('avg_points','?')
    podium=best.get('podium_probability','?')
    print(f'best={strat} pos={pos:.1f} pts={pts:.1f} podium={float(podium)*100:.1f}% n_sim={n_sim} total_strategies={len(all_s)}')
else:
    print(f'no best strategy, n_sim={n_sim}')
"

test_endpoint "GET /models/undercut" \
    "${BASE}/models/undercut" \
    "
import sys,json
d=json.load(sys.stdin)
print(f'status={d.get(\"status\")} n_events={d.get(\"n_events\")} model={d.get(\"model\",\"?\")}')
"

# ── 7. LAPS DETAIL ────────────────────────────────────────────────────────────
header "7. Laps Detail Endpoints"

test_endpoint "GET /laps/{year}/{race}?valid_only=true" \
    "${BASE}/laps/${YEAR}/${RACE}?valid_only=true&session_type=${SESSION}" \
    "
import sys,json
d=json.load(sys.stdin)
assert isinstance(d,list),'not list'
if d:
    times=[x.get('lap_time_seconds') for x in d if x.get('lap_time_seconds')]
    valid=[t for t in times if t and 60<t<300]
    if valid:
        print(f'{len(d)} laps, best={min(valid):.3f}s, avg={sum(valid)/len(valid):.3f}s')
    else:
        print(f'{len(d)} laps (no parseable times)')
else:
    print('0 valid laps')
"

test_endpoint "GET /laps/{year}/{race}/{driver}" \
    "${BASE}/laps/${YEAR}/${RACE}/${DRIVER}?session_type=${SESSION}" \
    "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,list):
    times=[x.get('lap_time_seconds') for x in d if x.get('lap_time_seconds') and x['lap_time_seconds']>0]
    print(f'{len(d)} laps, {len(times)} with times, best={min(times):.3f}s' if times else f'{len(d)} laps')
elif 'error' in d:
    print(f'error: {d[\"error\"]}')
"

# ── 8. METRICS / PERFORMANCE ──────────────────────────────────────────────────
header "8. Performance Metrics"

test_endpoint "GET /metrics/performance" \
    "${BASE}/metrics/performance" \
    "
import sys,json
d=json.load(sys.stdin)
routes=list(d.keys())
print(f'{len(routes)} tracked routes: {routes[:3]}')
"

test_endpoint "GET /ws/telemetry/stats" \
    "${BASE}/ws/telemetry/stats" \
    "
import sys,json
d=json.load(sys.stdin)
active=d.get('active_connections',0)
counters=d.get('counters',{})
print(f'active_connections={active} accepted={counters.get(\"accepted\",0)} ticks_sent={counters.get(\"ticks_sent\",0)}')
"

# ── 9. DATA SOURCE HEALTH ─────────────────────────────────────────────────────
header "9. Data Source Health"

test_endpoint "GET /health/data-source" \
    "${BASE}/health/data-source" \
    "
import sys,json
d=json.load(sys.stdin)
mode=d.get('mode','?')
duck=d.get('duckdb',{})
silver=duck.get('silver',{})
feats=duck.get('features',{})
print(f'mode={mode} silver_exists={silver.get(\"exists\")} silver_subdirs={silver.get(\"subdirs\")} features_subdirs={feats.get(\"subdirs\")}')
"

# ── 10. FEATURE CATALOG ───────────────────────────────────────────────────────
header "10. Feature Catalog"

test_endpoint "GET /features/{year}/{race}/{session}" \
    "${BASE}/features/${YEAR}/${RACE}/${SESSION}" \
    "
import sys,json
d=json.load(sys.stdin)
feats=d.get('features',{})
print(f'{d.get(\"n_features\",0)} feature sets: {list(feats.keys())}')
"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}════════ RESULTS ════════${NC}"
echo -e "  ${GREEN}✓ Passed:${NC}  $pass"
echo -e "  ${YELLOW}⚠ Warned:${NC}  $warn"
echo -e "  ${RED}✗ Failed:${NC}  $fail"
total=$((pass + fail + warn))
echo -e "  Total:     $total"

if [[ $fail -eq 0 && $warn -eq 0 ]]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
elif [[ $fail -eq 0 ]]; then
    echo -e "\n${YELLOW}All core tests passed (some warnings).${NC}"
else
    echo -e "\n${RED}Some tests failed. Check backend is running at ${BASE}${NC}"
    exit 1
fi
