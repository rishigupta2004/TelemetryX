# TelemetryX

**TelemetryX is a desktop‑first Formula 1 telemetry and strategy analysis suite.**  
Built for post‑session replay, it combines a command‑center UI with a high‑fidelity data pipeline.

![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![PySide6](https://img.shields.io/badge/PySide6-Qt%206-2e86c1)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109%2B-05998b)
![DuckDB](https://img.shields.io/badge/DuckDB-1.0%2B-f2b500)

---

## Overview

TelemetryX delivers broadcast‑grade telemetry replay and strategy analysis for F1 fans and analysts.  
It is optimized for **historical sessions** and **dense multi‑panel workflows**, not live telemetry.

---

## Why TelemetryX

- **Post‑session precision**: replay complete sessions with full context.  
- **Desktop density**: multi‑panel layouts for timing, telemetry, strategy, and features.  
- **Data‑driven UI**: every number on screen is derived from the dataset.  
- **Evolving platform**: new features and track layouts are added continuously.  

---

## What you can do

- Explore **timing + track** in a single broadcast view  
- Replay **telemetry traces** (speed, throttle, brake, gear)  
- Compare drivers in qualifying with **delta time + distance**  
- Analyze **tyre strategy** and pit windows  
- Browse a growing **feature catalog** derived from race data

---

## Feature Catalog (80+)

TelemetryX ships with **80+ engineered features**, organized across seven categories, including:

- **Timing & pace** — lap times, deltas, consistency, stint pace  
- **Telemetry** — speed, throttle, brake, gear, RPM, DRS analysis  
- **Strategy** — pit windows, tyre degradation, undercut/overcut signals  
- **Race context** — weather, race control, safety phases  
- **Driver performance** — sector strength, consistency, errors, recovery  
- **Track & circuit** — layout dominance, sector splits, corner behavior  
- **Comparisons** — teammate deltas, session‑segment comparisons  

Full inventory: `features_Catalog.md`

---

## How TelemetryX feels

TelemetryX is designed like a broadcast engineering desk:

- **Broadcast View**: timing tower + live track + race context  
- **Telemetry View**: lap replay, telemetry traces, compare mode  
- **Strategy View**: tyre stints, undercut predictions  
- **Features View**: live feature feed + visual summaries  

Every panel is meant to be **actionable and dense**, not decorative.

---

## Visuals

Screenshots and walkthroughs will be added here.  
Place images under `docs/images/` and link them in this section.

---

## Evolution

TelemetryX is not a static project. It evolves continuously:

- Track layouts are versioned by season  
- Feature models are expanded as datasets grow  
- UI panels are refined based on real usage workflows  

Expect improvements every release cycle.

## Getting Started

TelemetryX is a desktop app. Users will install from the Releases page once published.

1. Download the latest release  
2. Launch TelemetryX  
3. Select a season → race → session  
4. Use playback controls to explore the session

---

## Data & Coverage

- **FastF1** provides 2018+ telemetry, timing, and session metadata  
- **Ergast** provides historical results (2000–2017)  

Availability varies by season and session due to FIA restrictions.

---

## Controls (UI)

- **Playback bar**: play/pause, seek, speed  
- **Session picker**: season → race → session  
- **Telemetry**: select driver, lap, compare  

---

## Docs (for developers)

- `TelemetryX.md` — system architecture + product vision  
- `Frontend_ArchitectureOverview.md` — UI system design  
- `features_Catalog.md` — feature inventory  
- `_inputs/DATA_INDEX.md` — metadata package index  

---

## License

License is not yet specified. Add a `LICENSE` file if this repo is intended for distribution.

---

## Disclaimer

TelemetryX is a fan‑driven analytics project. It is not affiliated with Formula 1 or any team.
