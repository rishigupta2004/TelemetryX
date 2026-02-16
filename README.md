# TelemetryX

**TelemetryX is a desktop‑first Formula 1 telemetry and strategy analysis suite.**  
It turns full‑session datasets into a broadcast‑grade command center for fans, analysts, and creators.

---

## Product Snapshot

- **Post‑session precision** with full timing, telemetry, and context
- **Dense desktop layouts** designed for real analysis
- **Data‑driven UI** — every panel is computed from the dataset
- **Evolving platform** — track layouts and features expand season by season

---

## What TelemetryX Delivers

- **Broadcast View**: timing tower + live track + race context
- **Telemetry View**: lap replay, traces, and delta analysis
- **Strategy View**: tyre stints, pit windows, undercut/overcut signals
- **Features View**: live feature feed and visual summaries

TelemetryX is designed like a race‑engineering desk: **dense, readable, and actionable**.

---

## Feature Coverage (80+)

TelemetryX ships with **80+ engineered features** across seven categories:

- **Timing & pace** — lap times, gaps, consistency, stint pace  
- **Telemetry** — speed, throttle, brake, gear, RPM, DRS  
- **Strategy** — pit windows, tyre degradation, undercut/overcut  
- **Race context** — weather, race control, safety phases  
- **Driver performance** — sector strength, recovery, errors  
- **Track & circuit** — layout dominance, sector splits, corner behavior  
- **Comparisons** — teammate deltas, session‑segment analysis  

Full inventory: `features_Catalog.md`

---

## Data & Coverage

- **FastF1** for 2018+ telemetry, timing, and session metadata  
- **Ergast** for historical results (2000–2017)  

Coverage varies by season and session due to FIA restrictions.

**Important:** the raw 50GB+ dataset is not included in this repo.  
TelemetryX connects to a local or remote data backend; data packs are managed separately.

---

## How TelemetryX Works (High‑Level)

1. **Ingestion** (FastF1 / Ergast)  
2. **Normalization** (sessions, drivers, laps, telemetry)  
3. **Feature generation** (80+ engineered metrics)  
4. **Playback engine** (time‑aligned replay)  
5. **Desktop UI** (real‑time reactive panels)

---

## Releases

TelemetryX is a desktop app. Public releases will be distributed from the Releases page.

## Phase 6 Consistency Gate (Developer)

Use this lightweight gate before release candidates to validate cross-session consistency and key QA workflows.

- Backend matrix gate (R, SR, Q):
  - `python scripts/diagnose_backend.py --release-gate --sessions R,SR,Q --print-checklist`
- Regression tests:
  - `PYTHONPATH=$PWD/backend python -m pytest backend/tests/test_lap_selection_logic.py -q`
  - `PYTHONPATH=$PWD/frontend:$PWD/frontend/app python -m pytest frontend/tests/ui/test_main_window.py -q`
- One-command local gate via launcher:
  - `./scripts/run_desktop_local.sh --gate-only --release-gate --print-qa-matrix`

Manual QA matrix workflow per session type (`R`, `SR`, `Q`):

1. Playback: load session, start/pause timeline, scrub timeline.
2. Tab switch: move across timing, telemetry, track, strategy, features.
3. Compare: select primary + compare driver; verify comparison overlays.
4. Seek: jump to distant timestamps and confirm telemetry/positions refresh.

---

## Docs (for developers)

- `TelemetryX.md` — product vision + system architecture  
- `Frontend_ArchitectureOverview.md` — UI system design  
- `features_Catalog.md` — feature inventory  
- `_inputs/DATA_INDEX.md` — data package index  

---

## Privacy & Licensing

TelemetryX is a fan‑driven analytics project.  
It is not affiliated with Formula 1, FIA, or any team.

License is not yet specified. Add a `LICENSE` file before public distribution.
