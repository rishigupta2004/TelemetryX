<!-- telemetryx/README.md -->
<!-- Launch and Virality Agent - Complete Rewrite -->

<!--
  Hero GIF Spec:
  - Tool: Kap (Mac) or OBS + gifski
  - Scene: BroadcastView, Monaco 2024 demo mode
  - Duration: 20 seconds, loops cleanly
  - Settings: 15fps, 800x500, <5MB
  - Content: drivers racing, one overtake, telemetry strip at bottom updating
-->
![TelemetryX - Formula 1 Telemetry Dashboard](https://placehold.co/800x500/050508/e10600?text=TelemetryX+Monaco+2024+Demo)

> Formula 1 telemetry. Race intelligence. Broadcast-grade.

[![Stars](https://img.shields.io/github/stars/telemetryx/telemetryx?style=flat&color=gold)](https://github.com/telemetryx/telemetryx/stargazers)
[![Tests: 164](https://img.shields.io/badge/tests-164-brightgreen)](https://github.com/telemetryx/telemetryx/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-orange)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue?logo=python)](https://www.python.org/)
[![Electron](https://img.shields.io/badge/electron-40-47848F?logo=electron)](https://www.electronjs.org/)

---

## What it does

### Timing Tower
Live position classification with gap/interval calculations, sector times, tyre compound tracking, DRS indicators, and position swap animations. Real-time updates at sub-second latency.

![Timing Tower](https://placehold.co/600x300/1a1a2e/e10600?text=Timing+Tower+with+Position+Swaps)

### Multi-Driver Telemetry
Compare up to 4 drivers simultaneously with team color coding, mini-sector colouring, lap-by-lap traces for speed, throttle, brake, gear, RPM, and DRS.

![Telemetry Overlay](https://placehold.co/600x300/1a1a2e/27F4D2?text=Multi-Driver+Telemetry+Overlay)

### Monte Carlo Strategy Simulation
Two-phase rendering (400 instant → 3000 async), 30+ circuit-specific pit stop models, SC/VSC probability analysis, backtest RMSE panel, and JSON export.

![Strategy Simulation](https://placehold.co/600x300/1a1a2e/FF8000?text=Monte+Carlo+Strategy+Simulation)

---

## Quick start (no Docker)

```bash
git clone https://github.com/telemetryx/telemetryx.git && cd TelemetryX && ./start.sh
```

That's it. The app starts in **demo mode** with Monaco 2024 pre-loaded using local DuckDB (no Docker).

**Demo mode includes:**
- All 4 main views fully populated
- Pre-computed Monte Carlo simulation (3000 samples)
- Track map with 20 drivers racing
- Zero .env configuration required

Manual local run (no Docker):

```bash
# 1. Configure environment
cp .env.example .env
# Optional: edit .env

# 2. Start backend
cd backend && source .venv/bin/activate && TELEMETRYX_DATA_SOURCE=duckdb REDIS_ENABLED=0 TELEMETRYX_REQUIRE_AUTH=0 python main.py

# 3. Start frontend
cd frontend-electron && npm run dev
```

Optional Docker mode is only for local infra benchmarking (ClickHouse/Redis), not required for normal app usage.

---

## Features

<details>
<summary>Click to expand full feature list (80+ items)</summary>

### Views
- **Timing Tower** — Live position classification, gaps, intervals, sector times, tyre compound, DRS indicator, position swap animations
- **Telemetry** — Multi-driver comparison (up to 4), speed/throttle/brake/gear/RPM traces, mini-sector colouring, lap selector per driver
- **Strategy** — Pit window calculator, tyre degradation curves, undercut/overcut predictor, stint planning
- **Simulation** — Monte Carlo with 30+ circuit models, SC/VSC probability, backtest RMSE, JSON export
- **Track Map** — 2.5D animated circuit, 38 real circuits from GPS, CSS perspective with tilt sliders, clean HUD mode
- **Broadcast View** — Production-ready display for screen recording/streaming

### Data & Analysis
- Race pace analysis per driver/team
- Season standings (drivers & constructors)
- Driver clustering by performance
- Circuit insights and facts
- FIA documents viewer (stewards decisions, technical directives)
- Tyre stint analysis and degradation tracking
- Undercut/overcut effectiveness calculator
- Position gain/loss analysis

### Performance
- **90fps playback** — RAF-based timing with 6ms update interval
- **Lazy loading** — React.lazy + Suspense for all views
- **Code splitting** — Separate vendor chunks (React, ECharts, uPlot, Lucide, Zustand)
- **Web Workers** — Telemetry processing and car position interpolation off main thread
- **API caching** — Client-side response cache with 120s TTL
- **Initial load bundles React (~716KB vendor chunk, cached after first run). App startup chunk is 78KB.**

### UI/UX
- Welcome screen with animated progress
- Glass morphism panels
- Micro-animations (modal, sidebar, tooltip transitions)
- Dark theme optimized for analysis
- Responsive layout (ultrawide supported)
- Team color coding throughout
- DNF/PIT/OUT status badges
- FL (Fastest Lap) badge
- Tyre chip visualization

### Backend
- FastAPI with Pydantic v2
- DuckDB for embedded analytics
- Global error handler
- GZip compression
- WebSocket support for real-time
- Background task processing

### Data Sources
- FastF1 (2018+ live timing, telemetry, session metadata)
- Ergast (historical results 2000–2017)
- OpenF1 WebSocket (real-time car positions)
- Jolpica-F1 (race calendar, driver info)

</details>

---

## Architecture

See [`/docs/architecture.md`](docs/architecture.md) for detailed system design including:

- Electron main process (GPU rasterization, window state, CSP)
- React 19 renderer (Zustand stores, Web Workers, Canvas 2D)
- FastAPI + DuckDB backend (15+ routers, LRU cache, WebSocket)
- Data pipeline (FastF1, Ergast, OpenF1)

---

## Contributing

Contributions welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting PRs.

### Development Setup

```bash
# Clone and setup
git clone https://github.com/telemetryx/telemetryx.git
cd TelemetryX

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend-electron
npm install

# Run in demo mode
DEMO_MODE=true npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend && python -m pytest tests/ -v

# Frontend tests
cd frontend-electron && npm test
```

### Quality Gates

```bash
# TypeScript check
cd frontend-electron && npx tsc --noEmit

# Full release validation
./scripts/run_desktop_local.sh --gate-only --release-gate
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 40, electron-vite 5 |
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| State | Zustand 5 |
| Charts | ECharts 6, uPlot 1.6, Canvas 2D |
| Backend | Python, FastAPI, DuckDB, Uvicorn |
| Data | FastF1 (2018+), Ergast (2000–2017), OpenF1 |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

TelemetryX is a fan-driven analytics project. It is not affiliated with Formula 1, FIA, or any team.

---

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/telemetryx/telemetryx/issues)
- 💬 [Discussions](https://github.com/telemetryx/telemetryx/discussions)
- 🐦 [@TelemetryX](https://twitter.com/telemetryx)
