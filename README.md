# TelemetryX

<div align="center">

**Desktop‑first Formula 1 telemetry and strategy analysis suite**

*Broadcast-grade race intelligence for fans, analysts, and creators*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](#)
[![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](#)
[![DuckDB](https://img.shields.io/badge/DuckDB-Embedded-FFC107?logo=duckdb&logoColor=black)](#)

</div>

---

## Overview

TelemetryX turns multi-season F1 datasets into a dense, reactive command center. It ships as an **Electron desktop app** connected to a **FastAPI + DuckDB** backend, delivering timing towers, telemetry traces, strategy analytics, and ML-powered insights — all rendered at **90fps** with sub-10ms loading targets.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron (main process)                        │
│  ├── GPU rasterization & hardware overlays     │
│  ├── Window state persistence                   │
│  └── CSP security headers                       │
├─────────────────────────────────────────────────┤
│  Renderer (React 19 + Vite 7)                   │
│  ├── Zustand stores (session, playback, driver) │
│  ├── Web Workers (telemetry, car positions)     │
│  ├── Canvas 2D (TrackMap)                       │
│  ├── ECharts + uPlot (charts)                   │
│  └── Lazy-loaded views + code splitting         │
├─────────────────────────────────────────────────┤
│  Backend (FastAPI + DuckDB)                      │
│  ├── 15+ API routers                            │
│  ├── In-memory LRU cache (64 entries, 5min TTL) │
│  ├── GZip compression                           │
│  └── WebSocket support                          │
└─────────────────────────────────────────────────┘
```

---

## Features

### Views
| View | Description |
|------|-------------|
| **Timing Tower** | Live classification with gap/interval, sectors, tyre compound, position changes |
| **Telemetry** | Lap-by-lap traces for speed, throttle, brake, gear, RPM, DRS with driver comparison |
| **Strategy** | Pit windows, tyre degradation, undercut/overcut predictor, strategy simulations |
| **Track Map** | Canvas-rendered circuit with live car positions, DRS zones, sector markers, corners |
| **Features** | Race pace analysis, season standings, clustering, circuit insights, FIA documents |

### Performance
- **90fps playback** — RAF-based playback store with 6ms minimum update interval
- **Lazy loading** — `React.lazy` + `Suspense` for all heavy views
- **Code splitting** — ECharts, uPlot, Lucide, React, Zustand in separate vendor chunks
- **Web Workers** — Telemetry data processing and car position interpolation off main thread
- **API caching** — Client-side response cache (120s TTL) + request deduplication
- **GPU acceleration** — `will-change`, `contain: layout style paint`, hardware overlays

### UI
- **Welcome screen** — Animated splash with phased progress bar
- **Glass morphism** — Metallic panels with gradient backgrounds and subtle borders
- **Micro-animations** — Modal entrance/exit, sidebar indicator bar, tooltip transitions, shimmer skeletons
- **Dark theme** — Designed for extended analysis sessions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 40, electron-vite 5 |
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| State | Zustand 5 |
| Charts | ECharts 6, uPlot 1.6, Canvas 2D |
| Icons | Lucide React |
| Backend | Python, FastAPI, DuckDB, Uvicorn |
| Data | FastF1 (2018+), Ergast (2000–2017) |

---

## Getting Started

### Prerequisites
- **Node.js** ≥ 18 and **npm** ≥ 9
- **Python** ≥ 3.10
- F1 data files (see `_inputs/DATA_INDEX.md`)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py                    # starts on :8000 by default
```

### Frontend (Electron)
```bash
cd frontend-electron
npm install
# required for sign-in
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
npm run dev                       # starts electron-vite dev server
```

### Production Build
```bash
cd frontend-electron
npm run build                     # builds to out/
```

---

## Project Structure

```
TelemetryX/
├── backend/                      # FastAPI backend
│   ├── api/                      # Routers, cache, utils
│   │   ├── routers/              # 15+ endpoint modules
│   │   ├── cache.py              # LRU cache (64 entries, 5min TTL)
│   │   └── websocket/            # Real-time data streaming
│   ├── etl/                      # Data ingestion pipeline
│   ├── main.py                   # App entry + middleware
│   └── requirements.txt
├── frontend-electron/            # Electron + React app
│   ├── electron/                 # Main process + preload
│   ├── src/
│   │   ├── api/                  # API client with cache + dedup
│   │   ├── components/           # 20+ React components
│   │   ├── hooks/                # Custom hooks (timing, positions)
│   │   ├── lib/                  # Utilities, constants, colors
│   │   ├── stores/               # Zustand stores (4)
│   │   ├── views/                # 5 main views + sub-views
│   │   ├── workers/              # Web workers (2)
│   │   ├── App.tsx               # Root with lazy loading
│   │   └── index.css             # Design system + animations
│   ├── electron.vite.config.ts   # Build config with chunk splitting
│   └── package.json
├── features/                     # Feature definitions
├── ml/                           # ML models
├── scripts/                      # Utility scripts
├── tests/                        # Backend tests
└── docs/                         # Documentation
```

---

## Data & Coverage

- **FastF1** for 2018+ telemetry, timing, and session metadata
- **Ergast** for historical results (2000–2017)

Coverage varies by season and session due to FIA restrictions.

> **Note:** The raw 50GB+ dataset is not included in this repo. TelemetryX connects to a local or remote data backend; data packs are managed separately.

---

## Quality Gate

```bash
# TypeScript check
cd frontend-electron && npx tsc --noEmit

# Backend tests
cd backend && python -m pytest tests/ -v

# Full release gate
./scripts/run_desktop_local.sh --gate-only --release-gate
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `TelemetryX.md` | Product vision + system architecture |
| `Frontend_ArchitectureOverview.md` | UI system design |
| `features_Catalog.md` | 80+ feature inventory |
| `AGENTS.md` | Agent development guidelines |

---

## License

TelemetryX is a fan‑driven analytics project. It is not affiliated with Formula 1, FIA, or any team.

License is not yet specified. Add a `LICENSE` file before public distribution.
