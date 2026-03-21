#!/usr/bin/env python3
"""
TelemetryX — Final Validation: verify all 8 fixes are correctly applied.
Run from repo root.  Optionally pass --live URL for API endpoint checks.

Usage:
  python3 final_test.py
  python3 final_test.py --live http://localhost:9000/api/v1 --year 2023 --race bahrain-grand-prix --session R

Note: /health is registered at the root (not under /api/v1), so pass the
      api/v1 base and the script strips the prefix for that one call.
"""
import os, re, sys, json, time, argparse
from pathlib import Path

# ── colour helpers ────────────────────────────────────────────────────────────
GREEN = "\033[0;32m"; RED = "\033[0;31m"; YELLOW = "\033[0;33m"; BOLD = "\033[1m"; NC = "\033[0m"
def ok(msg):   print(f"  {GREEN}✓{NC}  {msg}")
def fail(msg): print(f"  {RED}✗{NC}  {msg}"); FAILURES.append(msg)
def warn(msg): print(f"  {YELLOW}~{NC}  {msg}")

FAILURES = []

# ── file helpers ─────────────────────────────────────────────────────────────
def read(path):
    p = Path(path)
    if not p.exists():
        return None
    return p.read_text(encoding="utf-8")

def check(label, path, *patterns, absent=None):
    src = read(path)
    if src is None:
        fail(f"{label} — file not found: {path}")
        return
    for pat in patterns:
        if pat not in src:
            fail(f"{label} — pattern missing in {path}:\n       '{pat}'")
            return
    if absent:
        for pat in absent:
            if pat in src:
                fail(f"{label} — pattern should be absent in {path}:\n       '{pat}'")
                return
    ok(label)

# ─────────────────────────────────────────────────────────────────────────────
# STATIC CHECKS
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}══ Static code checks ══{NC}\n")

# Fix 1 — AnimatedTrackMap.tsx
check(
    "Fix 1a: AnimatedTrackMap — trackGeometry imports present",
    "frontend/src/components/AnimatedTrackMap.tsx",
    "buildPathLookup", "computeArcLengths", "interpolateFromLookup",
)
check(
    "Fix 1b: AnimatedTrackMap — Float32Array lookup used in dotPositions",
    "frontend/src/components/AnimatedTrackMap.tsx",
    "interpolateFromLookup(trackLookup",
    absent=["getPointAtLength"],
)
check(
    "Fix 1c: AnimatedTrackMap — trackLookup memo present",
    "frontend/src/components/AnimatedTrackMap.tsx",
    "buildPathLookup(trackData.points",
)

# Fix 2 — strategy.py
check(
    "Fix 2a: strategy.py — lru_cache imported",
    "ml/strategy.py",
    "from functools import lru_cache",
)
check(
    "Fix 2b: strategy.py — decorator on generate_strategy_permutations",
    "ml/strategy.py",
    "@lru_cache",
    "generate_strategy_permutations",
)
check(
    "Fix 2c: strategy.py — hashable tuple parameter",
    "ml/strategy.py",
    "compounds: tuple",
)
check(
    "Fix 2d: strategy.py — call-site passes available compounds",
    "ml/strategy.py",
    "generate_strategy_permutations(config.total_laps, available",
)

# Fix 3 — sessions.py
src3 = read("backend/api/routers/sessions.py")
if src3 is None:
    fail("Fix 3 — sessions.py not found")
else:
    # Count conn.close() occurrences remaining in load_* functions
    # (allow 0 or allow them in the _fetchall/_fetchone helpers only)
    load_fns_src = re.search(
        r"def load_drivers.*?def load_metadata",
        src3, re.DOTALL
    )
    if load_fns_src:
        remaining = load_fns_src.group().count("conn.close()")
        if remaining == 0:
            ok("Fix 3: sessions.py — no conn.close() in load_* functions")
        else:
            fail(f"Fix 3: sessions.py — {remaining} conn.close() call(s) still present in load_* functions")
    else:
        warn("Fix 3: sessions.py — could not isolate load_* section; manual check needed")

# Fix 4 — features.py
check(
    "Fix 4a: features.py — race-dir mtime in find_features_path",
    "backend/api/routers/features.py",
    "race_mtime_ns",
    "race_dir_path",
)
check(
    "Fix 4b: features.py — year-dir mtime no longer primary",
    "backend/api/routers/features.py",
    "race_mtime_ns",
    absent=["year_mtime_ns = int(os.stat(year_path)"],
)

# Fix 5 — playbackStore.ts
check(
    "Fix 5: playbackStore.ts — _cachedState reset in setDuration",
    "frontend/src/stores/playbackStore.ts",
    "_cachedState = null",
)

# Fix 6 — telemetryStore.ts + sessionStore.ts
check(
    "Fix 6a: telemetryStore.ts — CACHE_TTL_MS constant",
    "frontend/src/stores/telemetryStore.ts",
    "CACHE_TTL_MS",
)
check(
    "Fix 6b: telemetryStore.ts — ts field in cache entries",
    "frontend/src/stores/telemetryStore.ts",
    "ts: Date.now()",
)
check(
    "Fix 6c: telemetryStore.ts — TTL check on cache read",
    "frontend/src/stores/telemetryStore.ts",
    "CACHE_TTL_MS",
    "cached.ts",
)
check(
    "Fix 6d: sessionStore.ts — clearTelemetry called on session switch",
    "frontend/src/stores/sessionStore.ts",
    "clearTelemetry()",
)
check(
    "Fix 6e: sessionStore.ts — useTelemetryStore imported",
    "frontend/src/stores/sessionStore.ts",
    "useTelemetryStore",
)

# Fix 7 — race_context.py
check(
    "Fix 7a: race_context.py — weather written only to first lap",
    "features/race_context.py",
    "first_lap",
    "df.loc[df[\"lap_number\"] == first_lap",
)
check(
    "Fix 7b: race_context.py — no full-df broadcast",
    "features/race_context.py",
    absent=["df[col] = weather[col].iloc[0]"],
)

# Fix 8 — useWindowedPositions.ts
check(
    "Fix 8a: useWindowedPositions.ts — getRaceControlState imported",
    "frontend/src/hooks/useWindowedPositions.ts",
    "getRaceControlState",
)
check(
    "Fix 8b: useWindowedPositions.ts — lastFlagRef declared",
    "frontend/src/hooks/useWindowedPositions.ts",
    "lastFlagRef",
)
check(
    "Fix 8c: useWindowedPositions.ts — flagChanged triggers fetch",
    "frontend/src/hooks/useWindowedPositions.ts",
    "flagChanged",
    "lastFlagRef.current = activeFlag",
)

# ─────────────────────────────────────────────────────────────────────────────
# LIVE API CHECKS (optional)
# ─────────────────────────────────────────────────────────────────────────────
def live_checks(base: str, year: int, race: str, session: str):
    try:
        import urllib.request, urllib.error
    except ImportError:
        warn("urllib not available — skipping live checks")
        return

    def get(path, timeout=30, root=False):
        # /health lives at the server root, not under /api/v1
        origin = re.sub(r'/api/v\d+.*', '', base.rstrip('/'))
        prefix = base.rstrip('/')
        url = f"{origin if root else prefix}{path}"
        try:
            start = time.monotonic()
            with urllib.request.urlopen(url, timeout=timeout) as r:
                body = r.read()
                ms = (time.monotonic() - start) * 1000
                return r.status, json.loads(body), ms
        except urllib.error.HTTPError as e:
            return e.code, {}, 0
        except Exception as e:
            return None, {}, 0

    print(f"\n{BOLD}══ Live API checks ({base}) ══{NC}\n")

    # Health — registered at root, not /api/v1
    code, body, ms = get("/health", root=True)
    if code == 200:
        ok(f"GET /health  →  {code}  ({ms:.0f}ms)")
    else:
        fail(f"GET /health  →  {code}")

    # Strategy recommendations (exercises lru_cache fix)
    code, body, ms = get(f"/models/strategy-recommendations/{year}/{race}")
    if code == 200:
        ok(f"GET /models/strategy-recommendations  →  {code}  ({ms:.0f}ms)")
        if body.get("best_strategy"):
            ok(f"  best_strategy: {body['best_strategy'].get('strategy','?')}")
    elif code == 404:
        warn(f"GET /models/strategy-recommendations  →  404 (no data for {year}/{race})")
    else:
        fail(f"GET /models/strategy-recommendations  →  {code}")

    # Features session catalog (exercises lru_cache race-mtime fix)
    code, body, ms = get(f"/features/{year}/{race}/{session}")
    if code == 200:
        ok(f"GET /features/{year}/{race}/{session}  →  {code}  ({ms:.0f}ms)")
    elif code == 404:
        warn(f"GET /features/{year}/{race}/{session}  →  404 (features not built)")
    else:
        fail(f"GET /features/{year}/{race}/{session}  →  {code}")

    # Session viz (exercises pool-conn fix)
    code, body, ms = get(f"/sessions/{year}/{race}/{session}/viz")
    if code == 200:
        drivers = len(body.get("drivers", []))
        laps    = len(body.get("laps", []))
        ok(f"GET /sessions/viz  →  {code}  ({ms:.0f}ms)  drivers={drivers} laps={laps}")
    else:
        fail(f"GET /sessions/viz  →  {code}")

    # Telemetry windowed (exercises pool-conn fix)
    code, body, ms = get(f"/sessions/{year}/{race}/{session}/telemetry?hz=1&t0=0&t1=60")
    if code == 200:
        n = sum(len(v) for v in body.values() if isinstance(v, list))
        ok(f"GET /sessions/telemetry?t0=0&t1=60  →  {code}  ({ms:.0f}ms)  rows={n}")
    else:
        fail(f"GET /sessions/telemetry  →  {code}")

    # Positions windowed
    code, body, ms = get(f"/sessions/{year}/{race}/{session}/positions?hz=2&t0=0&t1=30")
    if code == 200:
        n = len(body) if isinstance(body, list) else 0
        ok(f"GET /sessions/positions?t0=0&t1=30  →  {code}  ({ms:.0f}ms)  rows={n}")
    else:
        fail(f"GET /sessions/positions  →  {code}")

    # Tyre features (exercises race_context fix indirectly)
    code, body, ms = get(f"/features/{year}/{race}/{session}/tyre")
    if code == 200:
        ok(f"GET /features/tyre  →  {code}  ({ms:.0f}ms)  rows={len(body)}")
    elif code == 404:
        warn(f"GET /features/tyre  →  404 (features not built)")
    else:
        fail(f"GET /features/tyre  →  {code}")

    # WebSocket stats
    code, body, ms = get("/ws/telemetry/stats")
    if code == 200:
        conns = body.get("active_connections", "?")
        ok(f"GET /ws/telemetry/stats  →  {code}  active_connections={conns}")
    else:
        fail(f"GET /ws/telemetry/stats  →  {code}")

    # Metrics (perf summary)
    code, body, ms = get("/metrics/performance/summary")
    if code == 200:
        routes = len(body.get("routes", {}))
        ok(f"GET /metrics/performance/summary  →  {code}  tracked_routes={routes}")
    else:
        fail(f"GET /metrics/performance/summary  →  {code}")


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", metavar="URL", help="Base API URL e.g. http://localhost:9000/api/v1")
    parser.add_argument("--year",    default="2023", type=int)
    parser.add_argument("--race",    default="bahrain-grand-prix")
    parser.add_argument("--session", default="R")
    args = parser.parse_args()

    if args.live:
        live_checks(args.live, args.year, args.race, args.session)

    print(f"\n{'═'*50}")
    total = 24 + (9 if args.live else 0)
    passed = total - len(FAILURES)
    if FAILURES:
        print(f"{RED}{BOLD}  {len(FAILURES)} check(s) FAILED:{NC}")
        for f in FAILURES:
            print(f"    • {f}")
        sys.exit(1)
    else:
        print(f"{GREEN}{BOLD}  All {passed} checks passed ✓{NC}")

if __name__ == "__main__":
    main()
