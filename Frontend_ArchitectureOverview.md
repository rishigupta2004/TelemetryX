# Part 1: Pre-Draft Discussion + Refined Executive Overview

I'll deliver this in **5 parts**. Here's Part 1.

---

## What We're Drafting

Before jumping in, let me outline the refinements and what makes this "as far as a developer can go" in Python GUI:

### Original Document Gaps to Address

| Area | Original State | Refined State |
|------|----------------|---------------|
| State Management | Basic "signals → UI" mention | Full reactive store pattern with undo/redo |
| Component System | Panel contract only | Complete design system with atomic components |
| Accessibility | Not addressed | WCAG-aligned keyboard nav + screen reader hints |
| Plugin Architecture | None | Extension points for custom panels |
| Hot Reload | None | QML hot-reload + Python module reload for dev |
| Multi-Monitor | Mentioned | Full workspace persistence + popout state |
| GPU Rendering | PyQtGraph mention | Explicit Vulkan/OpenGL strategy |
| Theming | "Design tokens" only | Full theme engine with runtime switching |
| Offline Mode | Cache mention | Complete offline-first architecture |
| Error Boundaries | Panel-level stale | Hierarchical error isolation |

---

### Key Refinements for "Best-in-Class" Python GUI

```
┌─────────────────────────────────────────────────────────────────┐
│                    REFINEMENT PILLARS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. REACTIVE ARCHITECTURE                                       │
│     └─ Observable stores, computed properties, effect system    │
│                                                                 │
│  2. COMPONENT-FIRST DESIGN SYSTEM                               │
│     └─ Atomic → Molecular → Organism → Template → Page          │
│                                                                 │
│  3. RENDERING PIPELINE                                          │
│     └─ Scene graph batching, GPU compute for data, LOD system   │
│                                                                 │
│  4. OFFLINE-FIRST DATA LAYER                                    │
│     └─ Local-first sync, conflict resolution, delta updates     │
│                                                                 │
│  5. PROFESSIONAL UX PATTERNS                                    │
│     └─ Command palette, workspace layouts, keyboard-first       │
│                                                                 │
│  6. EXTENSIBILITY                                               │
│     └─ Plugin API, custom panels, theme SDK                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Refined Executive Summary

### Vision Statement

> **TelemetryX Desktop** is a professional-grade telemetry command center that matches Bloomberg Terminal density with broadcast-quality visuals—built entirely in Python using Qt 6.

### Target User Archetypes

| Persona | Needs | Priority Features |
|---------|-------|-------------------|
| Race Engineer | Real-time decision support | Timing tower, undercut predictor, live telemetry |
| Data Analyst | Deep post-race analysis | Compare mode, export, batch queries |
| Enthusiast | Learning + exploration | Guided UI, presets, simplified views |

### Quality Attributes (Prioritized)

```
Performance ████████████ (Critical)
Reliability ███████████░ (Critical)
Usability   ██████████░░ (High)
Extensibility ████████░░░░ (Medium)
Portability ██████░░░░░░ (Medium)
```

### Final Stack Decision Matrix

| Layer | Choice | Maturity | Performance | Flexibility |
|-------|--------|----------|-------------|-------------|
| Framework | PySide6 | ★★★★★ | ★★★★★ | ★★★★☆ |
| UI Layer | QML + Qt Quick | ★★★★☆ | ★★★★★ | ★★★★★ |
| Charts | PyQtGraph + Custom OpenGL | ★★★★☆ | ★★★★★ | ★★★★☆ |
| State | Custom Reactive Store | ★★★☆☆ | ★★★★★ | ★★★★★ |
| Data | httpx + DuckDB | ★★★★★ | ★★★★★ | ★★★★☆ |
| Packaging | PyInstaller + Nuitka (optional) | ★★★★☆ | ★★★★☆ | ★★★☆☆ |

---

## Document Structure (5 Parts)

| Part | Content |
|------|---------|
| **1** (This) | Discussion + Executive Overview |
| **2** | System Architecture (Deep) |
| **3** | UI Architecture + Design System |
| **4** | Wireframes (All Views) |
| **5** | Advanced Topics + Electron/Web Wrapping |

---
# Part 2: System Architecture (Deep)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TelemetryX Desktop                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         PRESENTATION LAYER                               │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │   │
│  │  │   Shell     │ │   Views     │ │ Components  │ │   Themes    │        │   │
│  │  │  (QML)      │ │  (QML)      │ │  (QML)      │ │  (QML)      │        │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘        │   │
│  │         └────────────────┴────────────────┴──────────────┘               │   │
│  │                                  │                                       │   │
│  │                          Property Bindings                               │   │
│  │                                  ▼                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                           │
│                              Bridge Layer                                       │
│                      (QObject + Signals/Slots)                                  │
│                                     │                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         APPLICATION LAYER                                │   │
│  │                                                                          │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │   │
│  │  │   State Store    │  │ Playback Engine  │  │ Command System   │       │   │
│  │  │                  │  │                  │  │                  │       │   │
│  │  │ • SessionState   │  │ • Clock Manager  │  │ • Undo/Redo      │       │   │
│  │  │ • UIState        │  │ • Seek Handler   │  │ • Keybindings    │       │   │
│  │  │ • DriverState    │  │ • Rate Control   │  │ • Macros         │       │   │
│  │  │ • TelemetryState │  │ • Live Sync      │  │ • Palette        │       │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │   │
│  │           │                     │                     │                  │   │
│  │           └─────────────────────┼─────────────────────┘                  │   │
│  │                                 │                                        │   │
│  └─────────────────────────────────┼────────────────────────────────────────┘   │
│                                    │                                            │
│  ┌─────────────────────────────────┼────────────────────────────────────────┐   │
│  │                         DATA LAYER                                       │   │
│  │                                 │                                        │   │
│  │  ┌──────────────────┐  ┌───────┴────────┐  ┌──────────────────┐         │   │
│  │  │   API Client     │  │  Cache Manager │  │  Sync Engine     │         │   │
│  │  │                  │  │                │  │                  │         │   │
│  │  │ • REST (httpx)   │  │ • Memory (LRU) │  │ • Delta Sync     │         │   │
│  │  │ • WebSocket      │  │ • Disk (DuckDB)│  │ • Conflict Res.  │         │   │
│  │  │ • Retry Logic    │  │ • Invalidation │  │ • Queue Manager  │         │   │
│  │  └──────────────────┘  └────────────────┘  └──────────────────┘         │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         INFRASTRUCTURE LAYER                             │   │
│  │                                                                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │   │
│  │  │  Logging   │ │  Config    │ │  Plugins   │ │  Exports   │            │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘            │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────────────┐
                    │           BACKEND (FastAPI)           │
                    │                                       │
                    │  /seasons  /races  /sessions          │
                    │  /telemetry  /positions  /laps        │
                    │  /features/*  /models/*               │
                    │  /ws/telemetry (live)                 │
                    │                                       │
                    └───────────────────────────────────────┘
```

---

## 2. Core Subsystem Breakdown

### 2.1 State Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REACTIVE STATE SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        ┌─────────────┐                          │
│                        │  Root Store │                          │
│                        └──────┬──────┘                          │
│                               │                                 │
│         ┌─────────────────────┼─────────────────────┐           │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐   │
│  │SessionStore │       │  UIStore    │       │DriverStore  │   │
│  │             │       │             │       │             │   │
│  │• season     │       │• activeTab  │       │• selected   │   │
│  │• race       │       │• sidebarOpen│       │• compared   │   │
│  │• session    │       │• theme      │       │• filters    │   │
│  │• status     │       │• layout     │       │• pinned     │   │
│  └──────┬──────┘       └──────┬──────┘       └──────┬──────┘   │
│         │                     │                     │           │
│         └─────────────────────┼─────────────────────┘           │
│                               │                                 │
│                               ▼                                 │
│                      ┌─────────────────┐                        │
│                      │ Computed Props  │                        │
│                      │                 │                        │
│                      │ • filteredLaps  │                        │
│                      │ • deltaValues   │                        │
│                      │ • rankChanges   │                        │
│                      └────────┬────────┘                        │
│                               │                                 │
│                               ▼                                 │
│                      ┌─────────────────┐                        │
│                      │  Effect System  │                        │
│                      │                 │                        │
│                      │ • Auto-fetch    │                        │
│                      │ • Persistence   │                        │
│                      │ • Analytics     │                        │
│                      └─────────────────┘                        │
│                                                                 │
│  PRINCIPLES:                                                    │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ • Single source of truth per domain                        ││
│  │ • Immutable updates (copy-on-write)                        ││
│  │ • Time-travel debugging support                            ││
│  │ • Selective subscriptions (fine-grained reactivity)        ││
│  │ • Middleware pipeline (logging, persistence, validation)   ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Store Domain Model

| Store | Responsibilities | Key Observables |
|-------|------------------|-----------------|
| **SessionStore** | Current session context | `season`, `race`, `session`, `loadState` |
| **UIStore** | UI chrome state | `activeView`, `sidebarOpen`, `theme`, `workspaceLayout` |
| **DriverStore** | Driver selection/filtering | `primaryDriver`, `compareDriver`, `filters`, `pinnedDrivers` |
| **TelemetryStore** | Time-series data cache | `channels`, `timeRange`, `downsampledSeries` |
| **PlaybackStore** | Playback engine state | `currentTime`, `isPlaying`, `playbackRate`, `mode` |
| **TimingStore** | Timing tower data | `standings`, `sectors`, `gaps`, `predictions` |
| **TrackStore** | Track + position data | `geometry`, `positions`, `selectedCar` |
| **StrategyStore** | Strategy analysis state | `stints`, `pitStops`, `predictions`, `scenarios` |

---

## 3. Data Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER DEEP DIVE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         REQUEST LIFECYCLE                             │ │
│  │                                                                       │ │
│  │    UI Request                                                         │ │
│  │         │                                                             │ │
│  │         ▼                                                             │ │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐             │ │
│  │  │   Query     │────▶│   Cache     │────▶│  Network    │             │ │
│  │  │  Resolver   │     │   Lookup    │     │   Fetch     │             │ │
│  │  └─────────────┘     └──────┬──────┘     └──────┬──────┘             │ │
│  │                             │                   │                     │ │
│  │                      Cache Hit?                 │                     │ │
│  │                      /      \                   │                     │ │
│  │                    Yes       No ────────────────┘                     │ │
│  │                     │                   │                             │ │
│  │                     ▼                   ▼                             │ │
│  │              ┌───────────┐       ┌───────────┐                        │ │
│  │              │  Return   │       │  Fetch +  │                        │ │
│  │              │  Cached   │       │  Cache    │                        │ │
│  │              └───────────┘       └───────────┘                        │ │
│  │                     │                   │                             │ │
│  │                     └─────────┬─────────┘                             │ │
│  │                               ▼                                       │ │
│  │                        ┌───────────┐                                  │ │
│  │                        │ Transform │                                  │ │
│  │                        │ + Validate│                                  │ │
│  │                        └─────┬─────┘                                  │ │
│  │                              ▼                                        │ │
│  │                         To Store                                      │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         CACHING STRATEGY                              │ │
│  │                                                                       │ │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │   │                      MEMORY CACHE (L1)                          │ │ │
│  │   │                                                                 │ │ │
│  │   │   Type: LRU Dictionary                                          │ │ │
│  │   │   Size: 500MB max                                               │ │ │
│  │   │   TTL: Session-scoped                                           │ │ │
│  │   │   Contents:                                                     │ │ │
│  │   │     • Current session telemetry (hot data)                      │ │ │
│  │   │     • Selected drivers' lap data                                │ │ │
│  │   │     • Active view computed data                                 │ │ │
│  │   │                                                                 │ │ │
│  │   └─────────────────────────────────────────────────────────────────┘ │ │
│  │                               │                                       │ │
│  │                          Cache Miss                                   │ │
│  │                               ▼                                       │ │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │   │                      DISK CACHE (L2)                            │ │ │
│  │   │                                                                 │ │ │
│  │   │   Type: DuckDB (embedded columnar)                              │ │ │
│  │   │   Size: 5GB max (configurable)                                  │ │ │
│  │   │   TTL: 30 days (sliding)                                        │ │ │
│  │   │   Contents:                                                     │ │ │
│  │   │     • Session index + metadata                                  │ │ │
│  │   │     • Downsampled series (pre-computed LODs)                    │ │ │
│  │   │     • Historical session data                                   │ │ │
│  │   │     • User preferences + workspace layouts                      │ │ │
│  │   │                                                                 │ │ │
│  │   │   Schema:                                                       │ │ │
│  │   │   ┌──────────────────────────────────────────────────────────┐  │ │ │
│  │   │   │ sessions: session_key, metadata_json, cached_at          │  │ │ │
│  │   │   │ telemetry: session_key, driver, channel, lod, data_blob  │  │ │ │
│  │   │   │ positions: session_key, time_bucket, positions_blob      │  │ │ │
│  │   │   │ user_prefs: key, value_json                              │  │ │ │
│  │   │   └──────────────────────────────────────────────────────────┘  │ │ │
│  │   └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Threading Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            THREADING MODEL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        MAIN THREAD (Qt)                              │   │
│  │                                                                      │   │
│  │   Responsibilities:                                                  │   │
│  │   • QML rendering + UI updates                                       │   │
│  │   • User input handling                                              │   │
│  │   • Qt signal/slot dispatch                                          │   │
│  │   • State store updates (atomic)                                     │   │
│  │                                                                      │   │
│  │   Rules:                                                             │   │
│  │   • No blocking operations (>16ms)                                   │   │
│  │   • No network I/O                                                   │   │
│  │   • No heavy computation                                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                           Signal + Queue                                    │
│                                    │                                        │
│  ┌─────────────────────────────────┼───────────────────────────────────┐   │
│  │                                 ▼                                    │   │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │   │
│  │  │  IO Thread  │  │  Compute Pool   │  │  Render Thread (opt)   │  │   │
│  │  │             │  │                 │  │                         │  │   │
│  │  │ • HTTP      │  │ • Downsampling  │  │ • Chart GPU ops         │  │   │
│  │  │ • WebSocket │  │ • Aggregations  │  │ • Track scene render    │  │   │
│  │  │ • Disk I/O  │  │ • ML inference  │  │ • Video decode          │  │   │
│  │  │             │  │ • Export gen    │  │                         │  │   │
│  │  └──────┬──────┘  └────────┬────────┘  └────────────┬────────────┘  │   │
│  │         │                  │                        │                │   │
│  │         │         WORKER THREADS                    │                │   │
│  │         │                                           │                │   │
│  └─────────┼───────────────────────────────────────────┼────────────────┘   │
│            │                                           │                    │
│            └────────────────────┬──────────────────────┘                    │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌───────────────────────┐                                │
│                    │   Thread-safe Queue   │                                │
│                    │   (results → main)    │                                │
│                    └───────────────────────┘                                │
│                                                                             │
│  ASYNC INTEGRATION (qasync):                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Qt Event Loop ◄────► asyncio Event Loop (unified via qasync)      │   │
│  │                                                                      │   │
│  │   • Coroutines scheduled on main loop                                │   │
│  │   • await for network ops (non-blocking)                             │   │
│  │   • Qt signals can trigger coroutines                                │   │
│  │   • Coroutines can emit Qt signals                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Communication Patterns

### 5.1 Component Communication

```
┌─────────────────────────────────────────────────────────────────┐
│                   COMMUNICATION PATTERNS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PATTERN 1: DOWNWARD (Parent → Child)                           │
│  ──────────────────────────────────────                         │
│                                                                 │
│     Parent QML                                                  │
│         │                                                       │
│         │  property binding                                     │
│         ▼                                                       │
│     Child QML                                                   │
│                                                                 │
│     Example: TimingTower passes `standings` to DriverRow        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PATTERN 2: UPWARD (Child → Parent)                             │
│  ──────────────────────────────────────                         │
│                                                                 │
│     Child QML                                                   │
│         │                                                       │
│         │  signal emission                                      │
│         ▼                                                       │
│     Parent QML (signal handler)                                 │
│                                                                 │
│     Example: DriverRow emits `driverSelected(driverId)`         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PATTERN 3: SIBLING (via Store)                                 │
│  ──────────────────────────────────────                         │
│                                                                 │
│     Component A          Store           Component B            │
│         │                  │                  │                 │
│         │──── action ─────▶│                  │                 │
│         │                  │◀─ subscribe ─────│                 │
│         │                  │                  │                 │
│         │                  │──── notify ─────▶│                 │
│                                                                 │
│     Example: DriverList selection updates TelemetryChart        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PATTERN 4: CROSS-LAYER (QML ↔ Python)                          │
│  ──────────────────────────────────────                         │
│                                                                 │
│     QML                   Bridge              Python            │
│      │                   (QObject)               │              │
│      │                      │                    │              │
│      │─── property read ───▶│◀─── @Property ────│              │
│      │◀── property notify ──│──── Signal ───────│              │
│      │─── method call ─────▶│◀─── @Slot ────────│              │
│      │◀── signal ───────────│──── emit() ───────│              │
│                                                                 │
│     Example: QML calls store.selectDriver(), Python updates     │
│              store, emits driverChanged signal, QML rebinds     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Error Handling Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR BOUNDARY SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            ┌──────────────┐                                 │
│                            │ App-Level    │                                 │
│                            │ Error Handler│                                 │
│                            └───────┬──────┘                                 │
│                                    │                                        │
│            ┌───────────────────────┼───────────────────────┐                │
│            │                       │                       │                │
│            ▼                       ▼                       ▼                │
│     ┌────────────┐          ┌────────────┐          ┌────────────┐         │
│     │View Error  │          │View Error  │          │View Error  │         │
│     │ Boundary   │          │ Boundary   │          │ Boundary   │         │
│     └─────┬──────┘          └─────┬──────┘          └─────┬──────┘         │
│           │                       │                       │                 │
│     ┌─────┴─────┐           ┌─────┴─────┐           ┌─────┴─────┐          │
│     │           │           │           │           │           │          │
│     ▼           ▼           ▼           ▼           ▼           ▼          │
│  ┌──────┐   ┌──────┐    ┌──────┐   ┌──────┐    ┌──────┐   ┌──────┐        │
│  │Panel │   │Panel │    │Panel │   │Panel │    │Panel │   │Panel │        │
│  │Error │   │Error │    │Error │   │Error │    │Error │   │Error │        │
│  │Bound.│   │Bound.│    │Bound.│   │Bound.│    │Bound.│   │Bound.│        │
│  └──────┘   └──────┘    └──────┘   └──────┘    └──────┘   └──────┘        │
│                                                                             │
│  ERROR STATES:                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Loading    →    Ready    →    Stale    →    Error                 │   │
│  │      │              │             │             │                    │   │
│  │      │              │             │             │                    │   │
│  │   skeleton      full UI      dimmed +       error card              │   │
│  │   shimmer                    "stale" pill   + retry btn             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  RECOVERY STRATEGIES:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Error Type          │ Recovery Action                             │   │
│  │   ────────────────────┼──────────────────────────────────           │   │
│  │   Network timeout     │ Exponential backoff + manual retry          │   │
│  │   API 4xx             │ Show error message, no auto-retry           │   │
│  │   API 5xx             │ Auto-retry 3x, then show error              │   │
│  │   Data validation     │ Log + show "data error" + fallback          │   │
│  │   Render crash        │ Isolate panel, show recovery UI             │   │
│  │   Critical failure    │ App-level error screen + export logs        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Plugin Architecture (Extensibility)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLUGIN SYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PLUGIN HOST                                   │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │   │   Loader     │  │   Registry   │  │   Sandbox    │              │   │
│  │   │              │  │              │  │              │              │   │
│  │   │ • Discovery  │  │ • Manifest   │  │ • API limits │              │   │
│  │   │ • Validation │  │ • Lifecycle  │  │ • Isolation  │              │   │
│  │   │ • Loading    │  │ • Events     │  │ • Resources  │              │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                          Plugin API                                         │
│                                 │                                           │
│  ┌──────────────────────────────┴──────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  EXTENSION POINTS:                                                   │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │  Custom Panels  │  │  Data Sources   │  │  Themes         │      │   │
│  │  │                 │  │                 │  │                 │      │   │
│  │  │ • Register view │  │ • Add endpoints │  │ • Color schemes │      │   │
│  │  │ • Custom QML    │  │ • Transform     │  │ • Typography    │      │   │
│  │  │ • Own store     │  │ • Cache rules   │  │ • Iconography   │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │  Export Formats │  │  Keybindings    │  │  Overlays       │      │   │
│  │  │                 │  │                 │  │                 │      │   │
│  │  │ • PNG/PDF ext   │  │ • Commands      │  │ • Track overlays│      │   │
│  │  │ • Custom export │  │ • Shortcuts     │  │ • Chart annot.  │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PLUGIN MANIFEST (plugin.json):                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  {                                                                   │   │
│  │    "id": "custom-strategy-panel",                                    │   │
│  │    "version": "1.0.0",                                               │   │
│  │    "displayName": "Custom Strategy Panel",                           │   │
│  │    "entryPoint": "main.py",                                          │   │
│  │    "extensionPoints": ["panels"],                                    │   │
│  │    "permissions": ["api.read", "store.strategy"],                    │   │
│  │    "minAppVersion": "1.0.0"                                          │   │
│  │  }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Directory Structure (Refined)

```
telemetryx_desktop/
├── app/
│   ├── __init__.py
│   ├── main.py                    # Entry point + app bootstrap
│   ├── core/
│   │   ├── __init__.py
│   │   ├── store/                 # Reactive state management
│   │   │   ├── base.py            # Observable, computed, effect
│   │   │   ├── session_store.py
│   │   │   ├── driver_store.py
│   │   │   ├── telemetry_store.py
│   │   │   ├── playback_store.py
│   │   │   ├── ui_store.py
│   │   │   └── root_store.py      # Composition root
│   │   ├── commands/              # Command pattern + undo/redo
│   │   │   ├── base.py
│   │   │   ├── history.py
│   │   │   └── registry.py
│   │   ├── playback/              # Playback engine
│   │   │   ├── clock.py
│   │   │   ├── controller.py
│   │   │   └── sync.py
│   │   └── bridge/                # QML ↔ Python bridge objects
│   │       ├── store_bridge.py
│   │       ├── playback_bridge.py
│   │       └── command_bridge.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── api/
│   │   │   ├── client.py          # Base HTTP client
│   │   │   ├── endpoints.py       # Typed endpoint wrappers
│   │   │   └── websocket.py       # WebSocket manager
│   │   ├── cache/
│   │   │   ├── memory_cache.py    # LRU in-memory
│   │   │   ├── disk_cache.py      # DuckDB persistence
│   │   │   └── invalidation.py    # Cache invalidation rules
│   │   └── sync/
│   │       ├── delta_sync.py      # Incremental updates
│   │       └── offline.py         # Offline queue
│   ├── models/
│   │   ├── __init__.py
│   │   ├── session.py             # Pydantic: Session, Race, etc.
│   │   ├── driver.py              # Pydantic: Driver, Standing
│   │   ├── telemetry.py           # Pydantic: TelemetryPoint, Channel
│   │   ├── timing.py              # Pydantic: Lap, Sector, Gap
│   │   └── strategy.py            # Pydantic: Stint, Prediction
│   ├── rendering/
│   │   ├── __init__.py
│   │   ├── charts/
│   │   │   ├── base_chart.py      # PyQtGraph base wrapper
│   │   │   ├── telemetry_chart.py # Multi-channel stacked
│   │   │   ├── delta_chart.py     # Zero-emphasis delta
│   │   │   └── strategy_chart.py  # Stint timeline
│   │   ├── track/
│   │   │   ├── track_renderer.py  # Track geometry
│   │   │   ├── car_overlay.py     # Car position dots
│   │   │   └── heat_overlay.py    # Optional heatmap
│   │   └── video/
│   │       ├── player.py          # QtMultimedia wrapper
│   │       └── sync.py            # Playback sync
│   ├── exports/
│   │   ├── __init__.py
│   │   ├── png_export.py
│   │   ├── csv_export.py
│   │   └── pdf_export.py
│   └── plugins/
│       ├── __init__.py
│       ├── loader.py
│       ├── registry.py
│       └── sandbox.py
├── ui/
│   ├── qml/
│   │   ├── main.qml               # Root window
│   │   ├── App.qml                # App shell
│   │   ├── Theme.qml              # Singleton: tokens
│   │   ├── components/
│   │   │   ├── atoms/             # Buttons, inputs, badges
│   │   │   ├── molecules/         # Cards, list items, controls
│   │   │   ├── organisms/         # Panels, toolbars, sidebars
│   │   │   └── templates/         # Page layouts
│   │   ├── views/
│   │   │   ├── TimingView.qml
│   │   │   ├── TelemetryView.qml
│   │   │   ├── TrackView.qml
│   │   │   ├── CompareView.qml
│   │   │   ├── StrategyView.qml
│   │   │   └── SettingsView.qml
│   │   └── popouts/
│   │       └── PopoutWindow.qml
│   └── assets/
│       ├── icons/
│       ├── fonts/
│       └── images/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── ui/
├── plugins/                       # User-installed plugins
├── scripts/
│   ├── build.py
│   └── dev.py
├── pyproject.toml
└── README.md
```

---

**End of Part 2.**

# Part 3: UI Architecture + Complete Design System

---

## 1. Design System Foundation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DESIGN SYSTEM OVERVIEW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                           ┌─────────────────┐                               │
│                           │  DESIGN TOKENS  │                               │
│                           │   (Foundation)  │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐        │
│  │   Colors    │           │ Typography  │           │   Spacing   │        │
│  └─────────────┘           └─────────────┘           └─────────────┘        │
│         │                          │                          │             │
│         └──────────────────────────┼──────────────────────────┘             │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────────┐                               │
│                           │    ATOMS        │                               │
│                           │ (Primitives)    │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────────┐                               │
│                           │   MOLECULES     │                               │
│                           │ (Combinations)  │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────────┐                               │
│                           │   ORGANISMS     │                               │
│                           │  (Sections)     │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────────┐                               │
│                           │   TEMPLATES     │                               │
│                           │   (Layouts)     │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────────┐                               │
│                           │     PAGES       │                               │
│                           │    (Views)      │                               │
│                           └─────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens

### 2.1 Color System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COLOR PALETTE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DARK THEME (Primary)                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  BACKGROUND SCALE                                                    │   │
│  │  ─────────────────                                                   │   │
│  │  bg.base         #0D0D0F    ████  App background                    │   │
│  │  bg.raised       #141417    ████  Cards, panels                     │   │
│  │  bg.overlay      #1A1A1E    ████  Modals, popovers                  │   │
│  │  bg.elevated     #222228    ████  Hover states                      │   │
│  │  bg.muted        #2A2A32    ████  Disabled backgrounds              │   │
│  │                                                                      │   │
│  │  FOREGROUND SCALE                                                    │   │
│  │  ──────────────────                                                  │   │
│  │  fg.primary      #FFFFFF    ████  Primary text                      │   │
│  │  fg.secondary    #A1A1AA    ████  Secondary text                    │   │
│  │  fg.tertiary     #71717A    ████  Tertiary/placeholder              │   │
│  │  fg.muted        #52525B    ████  Disabled text                     │   │
│  │                                                                      │   │
│  │  BORDER SCALE                                                        │   │
│  │  ────────────────                                                    │   │
│  │  border.default  #27272A    ████  Default borders                   │   │
│  │  border.muted    #1F1F23    ████  Subtle borders                    │   │
│  │  border.emphasis #3F3F46    ████  Emphasis borders                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SEMANTIC COLORS                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ACCENT (Brand)                                                      │   │
│  │  accent.default    #E10600    ████  F1 Red - Primary actions        │   │
│  │  accent.hover      #FF1E00    ████  Hover state                     │   │
│  │  accent.muted      #E10600/20 ████  Backgrounds                     │   │
│  │                                                                      │   │
│  │  SUCCESS                                                             │   │
│  │  success.default   #22C55E    ████  Personal best, positive         │   │
│  │  success.muted     #22C55E/20 ████  Background                      │   │
│  │                                                                      │   │
│  │  WARNING                                                             │   │
│  │  warning.default   #F59E0B    ████  Caution, stale data             │   │
│  │  warning.muted     #F59E0B/20 ████  Background                      │   │
│  │                                                                      │   │
│  │  ERROR                                                               │   │
│  │  error.default     #EF4444    ████  Errors, critical                │   │
│  │  error.muted       #EF4444/20 ████  Background                      │   │
│  │                                                                      │   │
│  │  INFO                                                                │   │
│  │  info.default      #3B82F6    ████  Information, links              │   │
│  │  info.muted        #3B82F6/20 ████  Background                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  F1 SPECIAL COLORS                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  SESSION BEST                                                        │   │
│  │  timing.sessionBest  #A855F7  ████  Purple - Session best lap       │   │
│  │                                                                      │   │
│  │  PERSONAL BEST                                                       │   │
│  │  timing.personalBest #22C55E  ████  Green - Personal best           │   │
│  │                                                                      │   │
│  │  YELLOW FLAG                                                         │   │
│  │  flag.yellow         #FACC15  ████  Yellow flag sectors             │   │
│  │                                                                      │   │
│  │  RED FLAG                                                            │   │
│  │  flag.red            #EF4444  ████  Red flag                        │   │
│  │                                                                      │   │
│  │  TYRE COMPOUNDS                                                      │   │
│  │  tyre.soft           #EF4444  ████  Red - Soft                      │   │
│  │  tyre.medium         #FACC15  ████  Yellow - Medium                 │   │
│  │  tyre.hard           #FFFFFF  ████  White - Hard                    │   │
│  │  tyre.intermediate   #22C55E  ████  Green - Intermediate            │   │
│  │  tyre.wet            #3B82F6  ████  Blue - Wet                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TEAM COLORS (Subset - 2024 Season)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  team.redbull        #3671C6  ████                                  │   │
│  │  team.mercedes       #27F4D2  ████                                  │   │
│  │  team.ferrari        #E80020  ████                                  │   │
│  │  team.mclaren        #FF8000  ████                                  │   │
│  │  team.astonmartin    #229971  ████                                  │   │
│  │  team.alpine         #FF87BC  ████                                  │   │
│  │  team.williams       #64C4FF  ████                                  │   │
│  │  team.haas           #B6BABD  ████                                  │   │
│  │  team.sauber         #52E252  ████                                  │   │
│  │  team.rb             #6692FF  ████                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Typography System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TYPOGRAPHY SCALE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FONT FAMILIES                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  font.display     "Formula1 Display"    Headlines, large numbers    │   │
│  │  font.primary     "Inter"               Body text, UI elements      │   │
│  │  font.mono        "JetBrains Mono"      Data, timing values         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TYPE SCALE                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Token          Size    Weight    Line-H   Letter-Sp   Usage        │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  display.xl     48px    700       1.1      -0.02em     Hero titles  │   │
│  │  display.lg     36px    700       1.1      -0.02em     Page titles  │   │
│  │  display.md     28px    600       1.2      -0.01em     Section head │   │
│  │  display.sm     24px    600       1.2      -0.01em     Card titles  │   │
│  │                                                                      │   │
│  │  heading.lg     20px    600       1.3      0           Panel titles │   │
│  │  heading.md     18px    600       1.3      0           Subsections  │   │
│  │  heading.sm     16px    600       1.4      0           List headers │   │
│  │                                                                      │   │
│  │  body.lg        16px    400       1.5      0           Long-form    │   │
│  │  body.md        14px    400       1.5      0           Default body │   │
│  │  body.sm        13px    400       1.5      0           Secondary    │   │
│  │                                                                      │   │
│  │  label.lg       14px    500       1.4      0.01em      Form labels  │   │
│  │  label.md       12px    500       1.4      0.02em      Tags, badges │   │
│  │  label.sm       11px    500       1.4      0.02em      Micro labels │   │
│  │                                                                      │   │
│  │  data.xl        28px    600       1.1      -0.02em     Hero metrics │   │
│  │  data.lg        20px    500       1.2      -0.01em     Large values │   │
│  │  data.md        14px    500       1.3      0           Table cells  │   │
│  │  data.sm        12px    500       1.3      0           Compact data │   │
│  │  data.xs        11px    500       1.3      0.01em      Micro data   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIMING TOWER SPECIFIC                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  timing.position   28px    700    1.0    -0.02em    Position nums   │   │
│  │  timing.gap        14px    500    1.0    -0.01em    Gap values      │   │
│  │  timing.laptime    16px    500    1.0    0          Lap times       │   │
│  │  timing.sector     14px    500    1.0    0          Sector times    │   │
│  │                                                                      │   │
│  │  Note: All timing values use font.mono for alignment                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Spacing + Sizing System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPACING + SIZING SCALE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BASE SPACING (4px grid)                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Token      Value    Visual                     Usage                │   │
│  │  ────────────────────────────────────────────────────────────────── │   │
│  │  space.0    0px      │                          Reset                │   │
│  │  space.px   1px      ▌                          Hairline             │   │
│  │  space.0.5  2px      █                          Micro gaps           │   │
│  │  space.1    4px      ██                         Tight spacing        │   │
│  │  space.1.5  6px      ███                        Icon gaps            │   │
│  │  space.2    8px      ████                       Component internal   │   │
│  │  space.3    12px     ██████                     Related elements     │   │
│  │  space.4    16px     ████████                   Standard gap         │   │
│  │  space.5    20px     ██████████                 Section spacing      │   │
│  │  space.6    24px     ████████████               Panel padding        │   │
│  │  space.8    32px     ████████████████           Major sections       │   │
│  │  space.10   40px     ████████████████████       Page margins         │   │
│  │  space.12   48px     ████████████████████████   Large gaps           │   │
│  │  space.16   64px     ████████████████████████████████                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  COMPONENT SIZING                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  size.xs     24px     Micro buttons, badges                         │   │
│  │  size.sm     32px     Small buttons, inputs                         │   │
│  │  size.md     40px     Default buttons, inputs                       │   │
│  │  size.lg     48px     Large buttons, inputs                         │   │
│  │  size.xl     56px     Hero buttons                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  BORDER RADIUS                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  radius.none    0px      Sharp corners                              │   │
│  │  radius.sm      4px      Buttons, badges                            │   │
│  │  radius.md      6px      Cards, inputs                              │   │
│  │  radius.lg      8px      Modals, panels                             │   │
│  │  radius.xl      12px     Large cards                                │   │
│  │  radius.full    9999px   Pills, avatars                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ELEVATION (Shadows)                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  elevation.none     none                       Flat                 │   │
│  │  elevation.sm       0 1px 2px rgba(0,0,0,0.3)  Subtle lift          │   │
│  │  elevation.md       0 4px 8px rgba(0,0,0,0.4)  Cards                │   │
│  │  elevation.lg       0 8px 16px rgba(0,0,0,0.5) Modals               │   │
│  │  elevation.xl       0 16px 32px rgba(0,0,0,0.6) Popovers            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYOUT CONSTANTS                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  layout.topbar.height       48px                                    │   │
│  │  layout.sidebar.width       280px                                   │   │
│  │  layout.sidebar.collapsed   64px                                    │   │
│  │  layout.playback.height     56px                                    │   │
│  │  layout.panel.minWidth      320px                                   │   │
│  │  layout.panel.header        44px                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Hierarchy (Atomic Design)

### 3.1 Atoms (Primitives)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ATOMS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BUTTONS                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Primary  │ │Secondary │ │  Ghost   │ │  Danger  │ │   Icon   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │                                                                      │   │
│  │  Sizes: xs (24px) | sm (32px) | md (40px) | lg (48px)               │   │
│  │  States: default | hover | active | disabled | loading              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  INPUTS                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────┐                            │   │
│  │  │ 🔍  Search sessions...              │  Text Input                │   │
│  │  └─────────────────────────────────────┘                            │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────┐                            │   │
│  │  │ Select driver              ▼        │  Select/Dropdown           │   │
│  │  └─────────────────────────────────────┘                            │   │
│  │                                                                      │   │
│  │  ┌──┐                                                               │   │
│  │  │✓ │  Checkbox                                                     │   │
│  │  └──┘                                                               │   │
│  │                                                                      │   │
│  │  ○────────────●─────────○  Slider                                   │   │
│  │                                                                      │   │
│  │  ◉ Option A   ○ Option B    Radio                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  BADGES + PILLS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌──────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                  │   │
│  │  │ LIVE │ │ STALE │ │ ERROR │ │  P1   │ │  +2   │                  │   │
│  │  └──────┘ └───────┘ └───────┘ └───────┘ └───────┘                  │   │
│  │   Green    Yellow     Red     Neutral   Positive                    │   │
│  │                                                                      │   │
│  │  Variants: solid | outline | subtle                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  STATUS INDICATORS                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ● Connected    ● Live    ○ Offline    ◐ Loading    ● Error         │   │
│  │                                                                      │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  Progress Bar                       │   │
│  │                                                                      │   │
│  │  ◠ Loading Spinner                                                   │   │
│  │                                                                      │   │
│  │  ▓▓▓▓▓▓░░░░  Skeleton Shimmer                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ICONS                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Sizes: 12px | 16px | 20px | 24px | 32px                            │   │
│  │                                                                      │   │
│  │  Categories:                                                         │   │
│  │  • Navigation: home, menu, back, forward, close, expand, collapse   │   │
│  │  • Actions: play, pause, seek, refresh, export, settings, popout    │   │
│  │  • Status: check, warning, error, info, live, stale                 │   │
│  │  • F1: flag, tyre, pit, drs, fastest                                │   │
│  │  • Data: chart, table, map, compare, delta                          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TYPOGRAPHY COMPONENTS                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  <Heading level="1|2|3|4" />                                        │   │
│  │  <Text variant="body|label" size="sm|md|lg" />                      │   │
│  │  <DataValue format="time|gap|speed|percentage" />                   │   │
│  │  <MonoText />                                                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Molecules (Combinations)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MOLECULES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DRIVER CHIP                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────┐                             │   │
│  │  │ ████ │ VER │ M. Verstappen    ✕    │                             │   │
│  │  └────────────────────────────────────┘                             │   │
│  │    │      │     │                 │                                  │   │
│  │    │      │     │                 └─ Remove action                   │   │
│  │    │      │     └─ Full name                                         │   │
│  │    │      └─ 3-letter code                                           │   │
│  │    └─ Team color bar                                                 │   │
│  │                                                                      │   │
│  │  States: default | selected | compared | disabled                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SESSION CARD                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────┐       │   │
│  │  │  🏁  Bahrain Grand Prix                                   │       │   │
│  │  │      Race · 2024-03-02 · 15:00 UTC                       │       │   │
│  │  │                                                          │       │   │
│  │  │  ● Completed        57 Laps        VER P1               │       │   │
│  │  └──────────────────────────────────────────────────────────┘       │   │
│  │                                                                      │   │
│  │  States: default | hover | selected | loading                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAP TIME CELL                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │   1:32.456     │  │   1:31.892     │  │   1:30.558     │      │   │
│  │  │   (normal)     │  │   (PB green)   │  │   (SB purple)  │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                      │   │
│  │  Variants: normal | personalBest | sessionBest | invalid            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  GAP INDICATOR                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                │   │
│  │  │  +2.345 │  │  -0.123 │  │   LAP   │  │   PIT   │                │   │
│  │  │  (gap)  │  │  (delta)│  │ (lapped)│  │ (in pit)│                │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TYRE INDICATOR                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────┐                                 │   │
│  │  │  ⬤  SOFT  │  23 laps  │  NEW  │                                 │   │
│  │  └────────────────────────────────┘                                 │   │
│  │      │    │        │         │                                       │   │
│  │      │    │        │         └─ Age indicator                        │   │
│  │      │    │        └─ Laps on tyre                                   │   │
│  │      │    └─ Compound name                                           │   │
│  │      └─ Compound color dot                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SEARCH INPUT                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────┐      │   │
│  │  │ 🔍 │ Search...                                     │ ⌘K │      │   │
│  │  └───────────────────────────────────────────────────────────┘      │   │
│  │                                                                      │   │
│  │  Features: icon prefix, placeholder, keyboard shortcut hint         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TOOLTIP                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │       ┌─────────────────────────┐                                   │   │
│  │       │  Gap to leader: +12.4s  │                                   │   │
│  │       │  Pit stops: 2           │                                   │   │
│  │       └────────────△────────────┘                                   │   │
│  │                    │                                                 │   │
│  │               anchor point                                           │   │
│  │                                                                      │   │
│  │  Positions: top | bottom | left | right (auto-flip at edges)        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ACTION GROUP                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────┬────┬────┐                                                   │   │
│  │  │ ↗  │ ⟳  │ ⚙  │   (Popout | Refresh | Settings)                  │   │
│  │  └────┴────┴────┘                                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Organisms (Sections)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORGANISMS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PANEL SHELL (Universal Container)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ ▌ Panel Title              ● LIVE  Updated: 2s ago   ↗  ⟳  ⚙  │ │   │
│  │  ├────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                                                │ │   │
│  │  │                                                                │ │   │
│  │  │                    [ CONTENT SLOT ]                            │ │   │
│  │  │                                                                │ │   │
│  │  │                                                                │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Header components:                                                  │   │
│  │  • Color bar (optional, left edge)                                  │   │
│  │  • Title                                                            │   │
│  │  • Status pill (Live/Stale/Error)                                   │   │
│  │  • "Updated" timestamp                                              │   │
│  │  • Action buttons (Popout, Refresh, Settings)                       │   │
│  │                                                                      │   │
│  │  Content states: loading | empty | error | stale | ready            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIMING TOWER                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ POS │ DRIVER      │ GAP     │ INT   │ LAST    │ S1   S2   S3  │ │   │
│  │  ├────────────────────────────────────────────────────────────────┤ │   │
│  │  │  1  │▌VER Verstap │ LEADER  │  —    │ 1:32.4  │ ██  ██  ██   │ │   │
│  │  │  2  │▌PER Perez   │ +2.345  │+2.345 │ 1:32.8  │ ██  ██  ░░   │ │   │
│  │  │  3  │▌LEC Leclerc │ +5.678  │+3.333 │ 1:32.1  │ ██  ░░  ░░   │ │   │
│  │  │  4  │▌SAI Sainz   │ +8.901  │+3.223 │ 1:33.2  │ ░░  ░░  ░░   │ │   │
│  │  │  5  │▌HAM Hamilto │ +12.34  │+3.439 │ 1:32.9  │ ██  ██  ██   │ │   │
│  │  │  .  │     ...     │   ...   │  ...  │   ...   │  .   .   .   │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Features:                                                           │   │
│  │  • Sticky header                                                    │   │
│  │  • Virtualized rows (20 drivers max, but supports scrolling)        │   │
│  │  • Column sorting                                                   │   │
│  │  • Row selection (click to select primary, Ctrl+click for compare)  │   │
│  │  • Team color bar per row                                           │   │
│  │  • Sector time color coding (green/purple/yellow)                   │   │
│  │  • Position change animation                                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TELEMETRY CHART STACK                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ SPEED (km/h)                                            [350] │ │   │
│  │  │ ┌──────────────────────────────────────────────────────────┐  │ │   │
│  │  │ │     ╱╲    ╱╲    ╱╲                                       │  │ │   │
│  │  │ │    ╱  ╲  ╱  ╲  ╱  ╲     ← VER (solid)                   │  │ │   │
│  │  │ │   ╱    ╲╱    ╲╱    ╲    ← HAM (dashed)                  │  │ │   │
│  │  │ │  ╱                   ╲                                   │  │ │   │
│  │  │ └──────────────────────────────────────────────────────────┘  │ │   │
│  │  │                          │                                     │ │   │
│  │  │                    cursor│                                     │ │   │
│  │  ├────────────────────────────────────────────────────────────────┤ │   │
│  │  │ THROTTLE (%)                                            [100] │ │   │
│  │  │ ┌──────────────────────────────────────────────────────────┐  │ │   │
│  │  │ │ ████████░░░░░████████░░░░░████████░░░░░░░░░░░░░░░░░░░░░ │  │ │   │
│  │  │ └──────────────────────────────────────────────────────────┘  │ │   │
│  │  ├────────────────────────────────────────────────────────────────┤ │   │
│  │  │ BRAKE (%)                                               [100] │ │   │
│  │  │ ┌──────────────────────────────────────────────────────────┐  │ │   │
│  │  │ │ ░░░░░░░░████░░░░░░░░████░░░░░░░░████░░░░░░░░░░░░░░░░░░░ │  │ │   │
│  │  │ └──────────────────────────────────────────────────────────┘  │ │   │
│  │  ├────────────────────────────────────────────────────────────────┤ │   │
│  │  │ GEAR                                                      [8] │ │   │
│  │  │ ┌──────────────────────────────────────────────────────────┐  │ │   │
│  │  │ │ ▁▃▅▇▇▇▅▃▁▃▅▇▇▇▅▃▁▃▅▇▇▇▅▃▁▃▅▇▇▇░░░░░░░░░░░░░░░░░░░░░░░░░ │  │ │   │
│  │  │ └──────────────────────────────────────────────────────────┘  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Features:                                                           │   │
│  │  • Synced X-axis (time or distance)                                 │   │
│  │  • Synced cursor across all charts                                  │   │
│  │  • Value readouts at cursor position                                │   │
│  │  • Primary driver (solid line) + Compare driver (dashed line)       │   │
│  │  • Y-axis auto-scaling with manual override                         │   │
│  │  • Zoom/pan with mouse wheel + drag                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TRACK MAP                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                │ │   │
│  │  │              ╭──────────────────────────╮                      │ │   │
│  │  │             ╱                            ╲                     │ │   │
│  │  │            │  ●1                          │                    │ │   │
│  │  │            │      ●2                      │                    │ │   │
│  │  │             ╲        ●3                  ╱                     │ │   │
│  │  │              ╰───●4──────────────────────╯                     │ │   │
│  │  │                                                                │ │   │
│  │  │   ●=car position    ▬=selected car    ○=compare car           │ │   │
│  │  │                                                                │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Features:                                                           │   │
│  │  • Track centerline geometry                                        │   │
│  │  • Car dots at sampled position (from playback time)                │   │
│  │  • Team color per car                                               │   │
│  │  • Hover tooltip with driver info                                   │   │
│  │  • Click to select driver                                           │   │
│  │  • Selected car highlighted                                         │   │
│  │  • Optional: sector shading, DRS zones                              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layout System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LAYOUT SYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SHELL STRUCTURE                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │                         TOP BAR (48px)                         │ │   │
│  │  ├──────────┬─────────────────────────────────────────────────────┤ │   │
│  │  │          │                                                     │ │   │
│  │  │  SIDEBAR │              MAIN CONTENT AREA                      │ │   │
│  │  │  (280px) │                                                     │ │   │
│  │  │          │  ┌─────────────────────────────────────────────┐   │ │   │
│  │  │  • Logo  │  │            VIEW CONTENT                     │   │ │   │
│  │  │  • Nav   │  │                                             │   │ │   │
│  │  │  • Search│  │  (Timing/Track/Telemetry/Compare/Strategy)  │   │ │   │
│  │  │  • Driver│  │                                             │   │ │   │
│  │  │    List  │  └─────────────────────────────────────────────┘   │ │   │
│  │  │          │                                                     │ │   │
│  │  │          ├─────────────────────────────────────────────────────┤ │   │
│  │  │          │              PLAYBACK BAR (56px)                    │ │   │
│  │  └──────────┴─────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  GRID SYSTEM                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Base: 12-column grid with 16px gutters                             │   │
│  │                                                                      │   │
│  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐                                         │   │
│  │  │1│2│3│4│5│6│7│8│9│10│11│12│                                       │   │
│  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘                                         │   │
│  │                                                                      │   │
│  │  Common layouts:                                                     │   │
│  │  • Full width: span 12                                              │   │
│  │  • Half: span 6 + span 6                                            │   │
│  │  • Thirds: span 4 + span 4 + span 4                                 │   │
│  │  • Sidebar + Main: span 4 + span 8                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  BREAKPOINTS (Desktop-focused)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  compact     < 1280px    Sidebar collapses, single-column view      │   │
│  │  standard    1280-1920px  Full sidebar, 2-column layouts            │   │
│  │  expanded    > 1920px     Extended panels, 3-column possible        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PANEL ARRANGEMENTS (Per View)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  TIMING VIEW                                                         │   │
│  │  ┌────────────────────────────┬────────────────────────────┐        │   │
│  │  │                            │                            │        │   │
│  │  │      TIMING TOWER          │      TRACK MAP             │        │   │
│  │  │         (span 6)           │       (span 6)             │        │   │
│  │  │                            │                            │        │   │
│  │  └────────────────────────────┴────────────────────────────┘        │   │
│  │                                                                      │   │
│  │  TELEMETRY VIEW                                                      │   │
│  │  ┌────────────────────────────────────────────────────────┐         │   │
│  │  │              TELEMETRY CHART STACK (span 12)           │         │   │
│  │  └────────────────────────────────────────────────────────┘         │   │
│  │  ┌─────────────────────┬──────────────────────────────────┐         │   │
│  │  │    TRACK MAP        │      DELTA CHART                 │         │   │
│  │  │     (span 4)        │       (span 8)                   │         │   │
│  │  └─────────────────────┴──────────────────────────────────┘         │   │
│  │                                                                      │   │
│  │  COMPARE VIEW                                                        │   │
│  │  ┌────────────────────────────────────────────────────────┐         │   │
│  │  │           LAP COMPARISON CHART STACK (span 12)         │         │   │
│  │  └────────────────────────────────────────────────────────┘         │   │
│  │  ┌──────────────┬──────────────┬──────────────────────────┐         │   │
│  │  │  DRIVER A    │  DRIVER B    │     DELTA BREAKDOWN      │         │   │
│  │  │   (span 3)   │   (span 3)   │       (span 6)           │         │   │
│  │  └──────────────┴──────────────┴──────────────────────────┘         │   │
│  │                                                                      │   │
│  │  STRATEGY VIEW                                                       │   │
│  │  ┌────────────────────────────────────────────────────────┐         │   │
│  │  │              STINT TIMELINE (span 12)                  │         │   │
│  │  └────────────────────────────────────────────────────────┘         │   │
│  │  ┌────────────────────────────┬───────────────────────────┐         │   │
│  │  │    UNDERCUT PREDICTOR      │     PIT STOP TABLE        │         │   │
│  │  │         (span 6)           │       (span 6)            │         │   │
│  │  └────────────────────────────┴───────────────────────────┘         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Theming Engine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THEMING SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ARCHITECTURE                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │       ┌─────────────────┐                                           │   │
│  │       │  Theme Manager  │                                           │   │
│  │       │  (Python)       │                                           │   │
│  │       └────────┬────────┘                                           │   │
│  │                │                                                     │   │
│  │         loads/switches                                               │   │
│  │                │                                                     │   │
│  │                ▼                                                     │   │
│  │       ┌─────────────────┐                                           │   │
│  │       │  Theme.qml      │  ← QML Singleton (pragma Singleton)       │   │
│  │       │  (Token Store)  │                                           │   │
│  │       └────────┬────────┘                                           │   │
│  │                │                                                     │   │
│  │         property bindings                                            │   │
│  │                │                                                     │   │
│  │    ┌───────────┼───────────┐                                        │   │
│  │    ▼           ▼           ▼                                        │   │
│  │  ┌─────┐   ┌─────┐    ┌─────┐                                       │   │
│  │  │Comp │   │Comp │    │Comp │   All components bind to Theme.*      │   │
│  │  │  A  │   │  B  │    │  C  │                                       │   │
│  │  └─────┘   └─────┘    └─────┘                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  THEME VARIANTS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │   DARK (Default)│  │      LIGHT      │  │   HIGH CONTRAST │      │   │
│  │  │                 │  │                 │  │                 │      │   │
│  │  │  bg: #0D0D0F    │  │  bg: #FAFAFA    │  │  bg: #000000    │      │   │
│  │  │  fg: #FFFFFF    │  │  fg: #171717    │  │  fg: #FFFFFF    │      │   │
│  │  │                 │  │                 │  │  borders: #FFF  │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  RUNTIME SWITCHING                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  1. User selects theme in Settings                                  │   │
│  │  2. ThemeManager updates Theme.qml properties                       │   │
│  │  3. QML property bindings auto-update all components                │   │
│  │  4. Preference persisted to config                                  │   │
│  │                                                                      │   │
│  │  Transition: 200ms ease-out for color changes                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Animation System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ANIMATION SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIMING TOKENS                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  duration.instant    0ms       Immediate feedback                   │   │
│  │  duration.fast       100ms     Micro-interactions                   │   │
│  │  duration.normal     200ms     Standard transitions                 │   │
│  │  duration.slow       300ms     Emphasis transitions                 │   │
│  │  duration.slower     500ms     Large content changes                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  EASING CURVES                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  easing.easeOut      Easing.OutCubic      Most UI transitions       │   │
│  │  easing.easeIn       Easing.InCubic       Exit animations           │   │
│  │  easing.easeInOut    Easing.InOutCubic    Symmetric transitions     │   │
│  │  easing.spring       Easing.OutBack       Playful feedback          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  STANDARD ANIMATIONS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  POSITION CHANGES (Timing Tower)                                    │   │
│  │  • Row slides up/down on position change                            │   │
│  │  • Duration: 300ms                                                  │   │
│  │  • Easing: easeInOut                                                │   │
│  │                                                                      │   │
│  │  VALUE UPDATES                                                       │   │
│  │  • Text color flash on value change                                 │   │
│  │  • Duration: 150ms fade in, 500ms hold, 150ms fade out              │   │
│  │                                                                      │   │
│  │  HOVER STATES                                                        │   │
│  │  • Background color transition                                       │   │
│  │  • Duration: 100ms                                                  │   │
│  │  • Easing: easeOut                                                  │   │
│  │                                                                      │   │
│  │  PANEL EXPAND/COLLAPSE                                               │   │
│  │  • Height animation + opacity fade                                  │   │
│  │  • Duration: 200ms                                                  │   │
│  │  • Easing: easeOut                                                  │   │
│  │                                                                      │   │
│  │  CHART CURSOR                                                        │   │
│  │  • No animation (immediate tracking)                                │   │
│  │  • Value readouts: 50ms fade                                        │   │
│  │                                                                      │   │
│  │  CAR DOTS (Track Map)                                                │   │
│  │  • Position interpolation between updates                           │   │
│  │  • Duration: matches playback tick rate                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  REDUCED MOTION                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  When user prefers reduced motion:                                   │   │
│  │  • All durations → 0ms                                              │   │
│  │  • Position changes → instant swap                                  │   │
│  │  • Maintain essential feedback (color changes, focus rings)         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Accessibility (A11y)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCESSIBILITY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KEYBOARD NAVIGATION                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  GLOBAL SHORTCUTS                                                    │   │
│  │  ───────────────────────────────────────────────────                │   │
│  │  ⌘/Ctrl + K         Command palette                                │   │
│  │  ⌘/Ctrl + 1-5       Switch view tabs                               │   │
│  │  ⌘/Ctrl + \         Toggle sidebar                                 │   │
│  │  Space              Play/Pause playback                             │   │
│  │  ← / →              Seek backward/forward                           │   │
│  │  ⌘/Ctrl + E         Export current view                            │   │
│  │  Escape             Close modal/popover                             │   │
│  │                                                                      │   │
│  │  FOCUS MANAGEMENT                                                    │   │
│  │  ───────────────────────────────────────────────────                │   │
│  │  Tab                Move focus forward                              │   │
│  │  Shift + Tab        Move focus backward                             │   │
│  │  Arrow keys         Navigate within components (lists, tables)      │   │
│  │  Enter              Activate focused element                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FOCUS INDICATORS                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────┐                                    │   │
│  │  │  ┌───────────────────────┐  │                                    │   │
│  │  │  │      Button Text      │◄─┼── 2px accent color ring           │   │
│  │  │  └───────────────────────┘  │   2px offset from element          │   │
│  │  └─────────────────────────────┘                                    │   │
│  │                                                                      │   │
│  │  Focus ring visible only on keyboard navigation (not mouse click)   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SCREEN READER SUPPORT                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  • All interactive elements have accessible names                   │   │
│  │  • Dynamic content changes announced via Qt accessibility API       │   │
│  │  • Data tables have proper row/column headers                       │   │
│  │  • Charts have text alternatives (summary + data export)            │   │
│  │  • Status changes announced (e.g., "Data updated", "Error loading") │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  COLOR CONTRAST                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  • All text meets WCAG AA contrast ratio (4.5:1 for normal text)    │   │
│  │  • Interactive elements meet 3:1 contrast ratio                     │   │
│  │  • Color is not the only indicator (icons/patterns supplement)      │   │
│  │  • High contrast theme available for enhanced visibility            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**End of Part 3.**

# Part 4: Complete Wireframes (All Views)

---

## 1. Application Shell

### 1.1 Top Bar

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              TOP BAR (48px height)                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌────────────┐  ┌─────────────────────────────────────────────┐        ┌────┐ ┌────┐ ┌────┐ ┌──────────┐  │   │
│  │  │ ≡  TX      │  │  Bahrain GP · Race · 2024-03-02    ▼       │        │ ● │ │ 🔔 │ │ ⚙ │ │  ○ User  │  │   │
│  │  └────────────┘  └─────────────────────────────────────────────┘        └────┘ └────┘ └────┘ └──────────┘  │   │
│  │       │                              │                                     │      │      │         │       │   │
│  │       │                              │                                     │      │      │         │       │   │
│  │  Menu + Logo              Session Selector                           Status  Notif  Settings   Profile    │   │
│  │  (click to                (dropdown with                            (green=                               │   │
│  │   toggle                   recent + search)                          connected)                           │   │
│  │   sidebar)                                                                                                 │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  SESSION SELECTOR DROPDOWN (Expanded)                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌─────────────────────────────────────────────┐                                                           │   │
│  │  │  Bahrain GP · Race · 2024-03-02    ▼       │                                                           │   │
│  │  └─────────────────────────────────────────────┘                                                           │   │
│  │  ┌─────────────────────────────────────────────┐                                                           │   │
│  │  │ 🔍  Search sessions...                      │                                                           │   │
│  │  ├─────────────────────────────────────────────┤                                                           │   │
│  │  │                                             │                                                           │   │
│  │  │  RECENT                                     │                                                           │   │
│  │  │  ─────────────────────────────────────────  │                                                           │   │
│  │  │  🏁 Bahrain GP · Race · 2024-03-02     ✓   │  ← Currently selected                                     │   │
│  │  │  🏁 Bahrain GP · Qualifying · 2024-03-01   │                                                           │   │
│  │  │  🏁 Bahrain GP · FP3 · 2024-03-01          │                                                           │   │
│  │  │                                             │                                                           │   │
│  │  │  2024 SEASON                                │                                                           │   │
│  │  │  ─────────────────────────────────────────  │                                                           │   │
│  │  │  🏁 Saudi Arabian GP                    ▶  │  ← Expandable                                             │   │
│  │  │  🏁 Australian GP                       ▶  │                                                           │   │
│  │  │  🏁 Japanese GP                         ▶  │                                                           │   │
│  │  │  ...                                        │                                                           │   │
│  │  │                                             │                                                           │   │
│  │  │  ─────────────────────────────────────────  │                                                           │   │
│  │  │  📁 Browse All Sessions...                  │                                                           │   │
│  │  │                                             │                                                           │   │
│  │  └─────────────────────────────────────────────┘                                                           │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Sidebar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          SIDEBAR (280px width)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EXPANDED STATE                            COLLAPSED STATE (64px)            │
│  ┌──────────────────────────────┐          ┌────────────────┐                │
│  │                              │          │                │                │
│  │  ┌────────────────────────┐  │          │  ┌──────────┐  │                │
│  │  │ 🔍 Search drivers...   │  │          │  │    🔍    │  │                │
│  │  └────────────────────────┘  │          │  └──────────┘  │                │
│  │                              │          │                │                │
│  │  NAVIGATION                  │          │  ┌──────────┐  │                │
│  │  ────────────────────────    │          │  │    📊    │  │  Timing        │
│  │  ┌────────────────────────┐  │          │  ├──────────┤  │                │
│  │  │ 📊  Timing        ◀───│──┼── Active │  │    📈    │  │  Telemetry     │
│  │  ├────────────────────────┤  │          │  ├──────────┤  │                │
│  │  │ 📈  Telemetry          │  │          │  │    🗺    │  │  Track         │
│  │  ├────────────────────────┤  │          │  ├──────────┤  │                │
│  │  │ 🗺   Track              │  │          │  │    ⇄    │  │  Compare       │
│  │  ├────────────────────────┤  │          │  ├──────────┤  │                │
│  │  │ ⇄   Compare            │  │          │  │    🎯    │  │  Strategy      │
│  │  ├────────────────────────┤  │          │  └──────────┘  │                │
│  │  │ 🎯  Strategy           │  │          │                │                │
│  │  └────────────────────────┘  │          │  ────────────  │                │
│  │                              │          │                │                │
│  │  DRIVERS                     │          │  ┌──────────┐  │                │
│  │  ────────────────────────    │          │  │   VER    │  │                │
│  │                              │          │  │  ══════  │  │                │
│  │  Primary Driver              │          │  ├──────────┤  │                │
│  │  ┌────────────────────────┐  │          │  │   HAM    │  │                │
│  │  │ ████│VER│M. Verstappen │  │          │  │  ------  │  │                │
│  │  └────────────────────────┘  │          │  └──────────┘  │                │
│  │                              │          │                │                │
│  │  Compare Driver (optional)   │          │                │                │
│  │  ┌────────────────────────┐  │          │                │                │
│  │  │ ████│HAM│L. Hamilton ✕ │  │          │                │                │
│  │  └────────────────────────┘  │          │                │                │
│  │                              │          │                │                │
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │          │                │                │
│  │                              │          │                │                │
│  │  All Drivers                 │          │                │                │
│  │  ┌────────────────────────┐  │          │                │                │
│  │  │ ▢ Filter by team    ▼ │  │          │                │                │
│  │  └────────────────────────┘  │          │                │                │
│  │                              │          │                │                │
│  │  ┌────────────────────────┐  │          │                │                │
│  │  │░░░░│VER│Verstappen   ●│◄─┼─ Selected│                │                │
│  │  ├────────────────────────┤  │          │                │                │
│  │  │░░░░│PER│Perez          │  │          │                │                │
│  │  ├────────────────────────┤  │          │                │                │
│  │  │░░░░│LEC│Leclerc        │  │          │                │                │
│  │  ├────────────────────────┤  │          │                │                │
│  │  │░░░░│SAI│Sainz          │  │          │                │                │
│  │  ├────────────────────────┤  │          │                │                │
│  │  │░░░░│HAM│Hamilton     ○│◄─┼─ Compare │                │                │
│  │  ├────────────────────────┤  │          │                │                │
│  │  │░░░░│RUS│Russell        │  │          │                │                │
│  │  ├────────────────────────┤  │          │                │                │
│  │  │    ...                 │  │          │                │                │
│  │  └────────────────────────┘  │          │                │                │
│  │         (scrollable)         │          │                │                │
│  │                              │          │                │                │
│  │  ────────────────────────    │          │  ────────────  │                │
│  │  ┌────────────────────────┐  │          │  ┌──────────┐  │                │
│  │  │ ⚙  Settings            │  │          │  │    ⚙     │  │                │
│  │  └────────────────────────┘  │          │  └──────────┘  │                │
│  │                              │          │                │                │
│  └──────────────────────────────┘          └────────────────┘                │
│                                                                              │
│  LEGEND:                                                                     │
│  ● = Primary selected    ○ = Compare selected    ████ = Team color bar      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Playback Bar

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           PLAYBACK BAR (56px height)                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌──────────────────┐  ┌─────────────────────────────────────────────────────────────────┐  ┌────────────┐  │   │
│  │  │                  │  │                                                                 │  │            │  │   │
│  │  │  ⏮  ◀◀  ▶  ▶▶  ⏭ │  │  00:00:00 ═══════════●═══════════════════════════════ 01:32:45 │  │  1x  ▼     │  │   │
│  │  │                  │  │                       ▲                                         │  │            │  │   │
│  │  └──────────────────┘  └───────────────────────┼─────────────────────────────────────────┘  └────────────┘  │   │
│  │          │                                     │                                                   │        │   │
│  │          │                              Current position                                    Playback rate   │   │
│  │          │                              (draggable)                                         dropdown        │   │
│  │          │                                                                                                  │   │
│  │     Transport                                                                                               │   │
│  │     Controls                                                                                                │   │
│  │                                                                                                             │   │
│  │     ⏮ = Start        ◀◀ = Step back 10s       ▶ = Play/Pause                                               │   │
│  │     ⏭ = End          ▶▶ = Step forward 10s    (shows ⏸ when playing)                                        │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  TIMELINE DETAIL                                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  00:00:00 ═══════════════════════════════●═══════════════════════════════════════════════════════ 01:32:45  │   │
│  │            │           │           │     │     │           │           │           │           │            │   │
│  │           L1          L10         L20   L25   L30         L40         L50        L55         L57            │   │
│  │            ▼           ▼           ▼           ▼           ▼           ▼                                    │   │
│  │           ░░░         ░░░         ░░░         ░░░         ░░░         ░░░                                   │   │
│  │                                                                                                             │   │
│  │  ░░░ = Lap markers (subtle vertical lines)                                                                  │   │
│  │  ▓▓▓ = Safety car periods (yellow overlay)                                                                  │   │
│  │  ███ = Red flag periods (red overlay)                                                                       │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  LIVE MODE VARIANT                                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌──────────────────┐  ┌─────────────────────────────────────────────────────────────────┐  ┌────────────┐  │   │
│  │  │                  │  │                                                                 │  │            │  │   │
│  │  │  ⏮  ◀◀  ▶  ▶▶  🔴│  │  LAP 25/57 ════════════════════════════════════════════════●   │  │ ● LIVE     │  │   │
│  │  │                  │  │                                                             │   │  │            │  │   │
│  │  └──────────────────┘  └─────────────────────────────────────────────────────────────┼───┘  └────────────┘  │   │
│  │                                                                                      │                      │   │
│  │                                                                              "Live edge"                    │   │
│  │                                                                              (auto-follow)                  │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  RATE DROPDOWN                                                                                                      │
│  ┌───────────────────┐                                                                                              │
│  │  ○  0.25x         │                                                                                              │
│  │  ○  0.5x          │                                                                                              │
│  │  ●  1x       ← default                                                                                           │
│  │  ○  2x            │                                                                                              │
│  │  ○  4x            │                                                                                              │
│  └───────────────────┘                                                                                              │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Timing View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                TIMING VIEW                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  ┌──────────────────────────────────────────────┐ │   │
│  │  │                                                      │  │                                              │ │   │
│  │  │  ▌ TIMING TOWER          ● LIVE   2s ago   ↗  ⟳  ⚙  │  │  ▌ TRACK MAP      ● LIVE   2s ago   ↗  ⟳  ⚙ │ │   │
│  │  │                                                      │  │                                              │ │   │
│  │  ├──────────────────────────────────────────────────────┤  ├──────────────────────────────────────────────┤ │   │
│  │  │                                                      │  │                                              │ │   │
│  │  │  POS  DRIVER         GAP      INT     LAST     S1-3  │  │                                              │ │   │
│  │  │  ───────────────────────────────────────────────────  │  │         ╭──────────────────────────╮        │ │   │
│  │  │                                                      │  │        ╱                            ╲       │ │   │
│  │  │   1  ▌VER Verstappen  LEADER   —     1:32.456  ██ ██  │  │       │  ●1                          │       │ │   │
│  │  │      ═══════════════════════════════════════════════  │  │       │      ●2    ●3                │       │ │   │
│  │  │   2  ▌PER Perez       +2.345  +2.345  1:32.891  ██ ░░  │  │       │          ●4   ●5            │       │ │   │
│  │  │      ───────────────────────────────────────────────  │  │        ╲     ●6          ●7        ╱        │ │   │
│  │  │   3  ▌LEC Leclerc     +5.678  +3.333  1:31.892  ██ ██  │  │         ╰───●8─────────────●9──────╯        │ │   │
│  │  │      ───────────────────────────────────────────────  │  │              ●10   ...    ●20               │ │   │
│  │  │   4  ▌SAI Sainz       +8.901  +3.223  1:33.201  ░░ ░░  │  │                                              │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │   5  ▌HAM Hamilton    +12.34  +3.439  1:32.567  ██ ██  │  │   ───────────────────────────────────────   │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │   6  ▌RUS Russell     +15.67  +3.330  1:32.789  ██ ░░  │  │   SELECTED: VER (Lap 25, Sector 2)          │ │   │
│  │  │      ───────────────────────────────────────────────  │  │   Position: T4 entry                        │ │   │
│  │  │   7  ▌NOR Norris      +18.90  +3.230  1:32.901  ░░ ░░  │  │                                              │ │   │
│  │  │      ───────────────────────────────────────────────  │  │   ● Primary (VER)                           │ │   │
│  │  │   8  ▌PIA Piastri     +22.12  +3.220  1:33.012  ░░ ░░  │  │   ○ Compare (HAM)                           │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │   9  ▌ALO Alonso      +25.34  +3.220  1:33.123  ██ ░░  │  │                                              │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  10  ▌STR Stroll      +28.56  +3.220  1:33.234  ░░ ░░  │  │                                              │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  11  ▌ALB Albon       +31.78  +3.220  1:33.345  ░░ ░░  │  └──────────────────────────────────────────────┘ │   │
│  │  │      ───────────────────────────────────────────────  │                                                    │   │
│  │  │  12  ▌SAR Sargeant    +34.90  +3.120  1:33.456  ░░ ░░  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  13  ▌BOT Bottas      +38.01  +3.110  1:33.567  ░░ ░░  │  │  ▌ LAP INFO                   ↗  ⟳  ⚙      │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  14  ▌ZHO Zhou        +41.12  +3.110  1:33.678  ░░ ░░  │  ├──────────────────────────────────────────────┤ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  15  ▌MAG Magnussen   +44.23  +3.110  1:33.789  ░░ ░░  │  │  LAP 25 / 57                                │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  16  ▌HUL Hulkenberg  +47.34  +3.110  1:33.890  ░░ ░░  │  │  ┌────────────┬────────────┬────────────┐   │ │   │
│  │  │      ───────────────────────────────────────────────  │  │  │  FASTEST   │  AVG LAP   │  LEADER    │   │ │   │
│  │  │  17  ▌TSU Tsunoda     +50.45  +3.110  1:33.901  ░░ ░░  │  │  │  1:30.558  │  1:32.123  │  VER       │   │ │   │
│  │  │      ───────────────────────────────────────────────  │  │  │   (LEC)    │            │            │   │ │   │
│  │  │  18  ▌RIC Ricciardo   +53.56  +3.110  1:34.012  ░░ ░░  │  │  └────────────┴────────────┴────────────┘   │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  19  ▌OCO Ocon        +56.67   LAP   1:34.123  ░░ ░░  │  │  CONDITIONS: Dry  │  Track: 42°C            │ │   │
│  │  │      ───────────────────────────────────────────────  │  │                                              │ │   │
│  │  │  20  ▌GAS Gasly        PIT     PIT   1:58.234  ░░ ░░  │  └──────────────────────────────────────────────┘ │   │
│  │  │                                                      │                                                    │   │
│  │  └──────────────────────────────────────────────────────┘                                                    │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  LEGEND:                                                                                                            │
│  ▌= Team color bar    ██ = Personal/Session best sector    ░░ = Normal sector    ═══ = Selected row                │
│  Sector colors: Green = PB, Purple = SB, Yellow = Slower                                                            │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Telemetry View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              TELEMETRY VIEW                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                                                       │ │   │
│  │  │  ▌ TELEMETRY STACK                                    ● LIVE   2s ago              ↗  ⟳  ⚙           │ │   │
│  │  │                                                                                                       │ │   │
│  │  │  ┌────────────────────────────────────────────────────────────────────────────────────────┐          │ │   │
│  │  │  │  VER (━━━)  vs  HAM (┄┄┄)         LAP 25         │  Time ○  Distance ●  │          │ │   │
│  │  │  └────────────────────────────────────────────────────────────────────────────────────────┘          │ │   │
│  │  │                                                                                                       │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │  SPEED (km/h)                                                                               350 ─┐   │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐│   │ │   │
│  │  │  │                                                                                              ││   │ │   │
│  │  │  │       ╱╲         ╱╲         ╱╲         ╱╲         ╱╲│        ╱╲                             ││   │ │   │
│  │  │  │      ╱  ╲       ╱  ╲       ╱  ╲       ╱  ╲       ╱  │╲      ╱  ╲                            ││   │ │   │
│  │  │  │     ╱    ╲     ╱    ╲     ╱    ╲     ╱    ╲     ╱   │ ╲    ╱    ╲                           ││   │ │   │
│  │  │  │    ╱......╲...╱......╲...╱......╲...╱......╲...╱    │..╲..╱......╲...                       ││   │ │   │
│  │  │  │   ╱        ╲ ╱        ╲ ╱        ╲ ╱        ╲ ╱     │   ╲╱        ╲                         ││   │ │   │
│  │  │  │  ╱          V          V          V          V      │    V          ╲                       ││   │ │   │
│  │  │  │                                                     │                                       ││   │ │   │
│  │  │  └─────────────────────────────────────────────────────┼───────────────────────────────────────┘│   │ │   │
│  │  │                                                        │cursor                           50 ─┘   │ │   │
│  │  │                                                        │                                         │ │   │
│  │  │                                                   ┌────┴────┐                                    │ │   │
│  │  │                                                   │VER: 312 │                                    │ │   │
│  │  │                                                   │HAM: 308 │                                    │ │   │
│  │  │                                                   └─────────┘                                    │ │   │
│  │  │                                                                                                   │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │  THROTTLE (%)                                                                           100 ─┐   │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐│   │ │   │
│  │  │  │████████████░░░░░░░░░████████████░░░░░░░░░█████│█████░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░││   │ │   │
│  │  │  │████████████░░░░░░░░░████████████░░░░░░░░░█████│█████░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░││   │ │   │
│  │  │  │............         ............         .....│.....         ............                   ││   │ │   │
│  │  │  └───────────────────────────────────────────────┼──────────────────────────────────────────────┘│   │ │   │
│  │  │                                                  │                                      0 ─┘    │ │   │
│  │  │                                                  │VER: 100% HAM: 95%                            │ │   │
│  │  │                                                                                                   │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │  BRAKE (%)                                                                              100 ─┐   │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐│   │ │   │
│  │  │  │░░░░░░░░░░░░██████████░░░░░░░░░░░░██████████░░░░│░░░░░██████████░░░░░░░░░░░░██████████░░░░░░░░││   │ │   │
│  │  │  │            ██████████            ██████████    │     ██████████            ██████████        ││   │ │   │
│  │  │  │            ..........            ..........    │     ..........            ..........        ││   │ │   │
│  │  │  └────────────────────────────────────────────────┼─────────────────────────────────────────────┘│   │ │   │
│  │  │                                                   │                                     0 ─┘    │ │   │
│  │  │                                                   │VER: 0% HAM: 0%                              │ │   │
│  │  │                                                                                                   │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │  GEAR                                                                                     8 ─┐   │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐│   │ │   │
│  │  │  │▅▆▇▇▇▆▅▄▃▂▃▄▅▆▇▇▇▆▅▄▃▂▃▄▅▆▇▇▇▆▅▄▃▂│▃▄▅▆▇▇▇▆▅▄▃▂▃▄▅▆▇▇▇▆▅▄▃▂▃▄▅▆▇▇▇▆▅▄▃▂                      ││   │ │   │
│  │  │  │.............................................│.................................................││   │ │   │
│  │  │  └─────────────────────────────────────────────┼────────────────────────────────────────────────┘│   │ │   │
│  │  │                                                │                                        1 ─┘    │ │   │
│  │  │                                                │VER: 7  HAM: 6                                  │ │   │
│  │  │                                                                                                   │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │  DRS                                                                                              │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐│   │ │   │
│  │  │  │░░░░░░░░░░░░░░░░░░░░░░██████████████░░░░░░░░│░░░░░░██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││   │ │   │
│  │  │  └──────────────────────────────────────────────────────────────────────────────────────────────┘│   │ │   │
│  │  │                                                │VER: OFF  HAM: OFF                               │ │   │
│  │  │                                                                                                   │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                         │   │
│  │  ┌─────────────────────────────────────┐  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │                                     │  │                                                           │ │   │
│  │  │  ▌ MINI MAP         ↗  ⟳           │  │  ▌ DELTA                                      ↗  ⟳  ⚙    │ │   │
│  │  │                                     │  │                                                           │ │   │
│  │  ├─────────────────────────────────────┤  ├───────────────────────────────────────────────────────────┤ │   │
│  │  │                                     │  │                                                           │ │   │
│  │  │      ╭──────────────╮               │  │  +0.5 ──┬────────────────────────────────────────────────│ │   │
│  │  │     ╱                ╲              │  │         │                  ╱╲                            │ │   │
│  │  │    │  ●               │             │  │     0 ──┼────────────────╱────╲──────────────────────────│ │   │
│  │  │    │       ○          │             │  │         │              ╱        ╲            ╱           │ │   │
│  │  │     ╲                ╱              │  │  -0.5 ──┼────────────╱────────────╲────────╱─────────────│ │   │
│  │  │      ╰──────────────╯               │  │         │          ╱                ╲    ╱               │ │   │
│  │  │                                     │  │                                       ╲╱                  │ │   │
│  │  │  Cursor: T4 entry                   │  │                                                           │ │   │
│  │  │                                     │  │  VER vs HAM: -0.234s (VER ahead)                         │ │   │
│  │  │                                     │  │                                                           │ │   │
│  │  └─────────────────────────────────────┘  └───────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  LEGEND:                                                                                                            │
│  ━━━ = Primary driver (VER)     ┄┄┄/... = Compare driver (HAM)     █ = Filled area     │ = Cursor line             │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Track View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                TRACK VIEW                                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                                                       │ │   │
│  │  │  ▌ TRACK MAP - Bahrain International Circuit                      ● LIVE   2s ago      ↗  ⟳  ⚙      │ │   │
│  │  │                                                                                                       │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                                                                                       │ │   │
│  │  │                                                                                                       │ │   │
│  │  │                              SECTOR 1                                                                 │ │   │
│  │  │                   ┌────────────────────────────────┐                                                  │ │   │
│  │  │                  ╱                                  ╲                                                 │ │   │
│  │  │                 ╱      T1                            ╲                                                │ │   │
│  │  │                │     ╭────╮                           │                                               │ │   │
│  │  │               ╱     ╱      ╲   T2                      │                                              │ │   │
│  │  │              │     │   ●1   │  ╭──╮                    │                                              │ │   │
│  │  │              │     │        │ │●2 │                    │      SECTOR 2                                │ │   │
│  │  │              │      ╲      ╱  ╰──╯    T3              │  ┌─────────────────┐                         │ │   │
│  │  │              │       ╰────╯           ╭───╮            ╲ │                 │                          │ │   │
│  │  │    S/F LINE  │                       │ ●3 │             ╲│     T5    T6    │                          │ │   │
│  │  │       │      │                        ╰───╯    T4        │    ╭──╮  ╭──╮   │                          │ │   │
│  │  │    ═══╪═══   │                              ╭────────────│───│●5 ││ ●6│───│─────────╮                 │ │   │
│  │  │       │      │                             ╱             │    ╰──╯  ╰──╯   │         ╲                │ │   │
│  │  │       │      │                            │●4            │                 │          │               │ │   │
│  │  │       │       ╲                           │              │                 │          │               │ │   │
│  │  │       │        ╲                          ╲              │                 │         ╱                │ │   │
│  │  │       │         │                          ╲             │                 │        ╱                 │ │   │
│  │  │       │         │                           ╲            └─────────────────┘       │                  │ │   │
│  │  │       │         │          PIT LANE          ╲                                    ╱                   │ │   │
│  │  │       │         │         ═══════════         ╲                                  │                    │ │   │
│  │  │       │         │         ●PIT (GAS)           │                                 │                    │ │   │
│  │  │       │          ╲                             │     SECTOR 3                    │                    │ │   │
│  │  │       │           ╲                           ╱   ┌───────────────────┐          │                    │ │   │
│  │  │       │            ╲                         │    │                   │         ╱                     │ │   │
│  │  │       │             │                        │    │   T11   T12  T13  │        │                      │ │   │
│  │  │       │             │                        │    │  ╭──╮  ╭──╮ ╭──╮  │       ╱                       │ │   │
│  │  │       │              ╲        T14   T15      │    │ │●11││●12││●13│  │      ╱                        │ │   │
│  │  │       ▼               ╲      ╭──╮  ╭──╮      │    │  ╰──╯  ╰──╯ ╰──╯  │     │                         │ │   │
│  │  │                        ╲    │●14││●15│      │    │                   │     │                         │ │   │
│  │  │     ●20                 │    ╰──╯  ╰──╯      │    └───────────────────┘     │                         │ │   │
│  │  │     ●19                 │                   ╱                               │                         │ │   │
│  │  │     ●18                  ╲                 ╱                                │                         │ │   │
│  │  │                           ╲───────────────╱                                 │                         │ │   │
│  │  │                            ╲                                               ╱                          │ │   │
│  │  │                             ╲─────────────────────────────────────────────╱                           │ │   │
│  │  │                                                                                                       │ │   │
│  │  │                                                                                                       │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────────────────────────────────    │ │   │
│  │  │                                                                                                       │ │   │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐           LEGEND                                                 │ │   │
│  │  │  │ ●1 VER │  │ ●5 HAM │  │ ●PIT   │           ● = Car position (team color)                          │ │   │
│  │  │  │ Leader │  │ +12.3s │  │ GAS    │           ▌ = Selected driver (enlarged)                         │ │   │
│  │  │  └────────┘  └────────┘  └────────┘           ○ = Compare driver (ring outline)                      │ │   │
│  │  │                                               ═ = DRS detection zone                                 │ │   │
│  │  │  View: ○ All Cars  ● Top 10  ○ Selected Only              ─ = DRS activation zone                    │ │   │
│  │  │                                                                                                       │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  │  ┌──────────────────────────────────────────┐  ┌──────────────────────────────────────────────────────────┐ │   │
│  │  │                                          │  │                                                          │ │   │
│  │  │  ▌ GAP VISUALIZATION        ↗  ⟳  ⚙    │  │  ▌ POSITION CHART                           ↗  ⟳  ⚙    │ │   │
│  │  │                                          │  │                                                          │ │   │
│  │  ├──────────────────────────────────────────┤  ├──────────────────────────────────────────────────────────┤ │   │
│  │  │                                          │  │                                                          │ │   │
│  │  │  VER ████████████████████████████ 0.0s   │  │   1 ─VER━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │   │
│  │  │  PER ███████████████████████░░░░░ +2.3s  │  │   2 ─PER━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │   │
│  │  │  LEC ██████████████████████░░░░░░ +5.7s  │  │   3 ─LEC━━━━━━━━╲━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │   │
│  │  │  SAI █████████████████████░░░░░░░ +8.9s  │  │   4 ─SAI━━━━━━━━━╲━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │   │
│  │  │  HAM ████████████████████░░░░░░░░ +12.3s │  │   5 ─HAM━━━━━━━━━━╱━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │   │
│  │  │  RUS ███████████████████░░░░░░░░░ +15.7s │  │       Lap 1     5    10    15    20    25              │ │   │
│  │  │  ...                                     │  │                                    ▲                    │ │   │
│  │  │                                          │  │                              current lap                │ │   │
│  │  │  Scale: 0─────────────────────────60s    │  │                                                          │ │   │
│  │  │                                          │  │                                                          │ │   │
│  │  └──────────────────────────────────────────┘  └──────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Compare View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                               COMPARE VIEW                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌─────────────────────────────────┐  ┌───────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │  ▌ DRIVER A           ⟳        │  │  ▌ LAP COMPARISON                                     ↗  ⟳  ⚙    │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  ├─────────────────────────────────┤  ├───────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │  ┌──────────────────────────┐   │  │  LAP SELECTION                                                    │ │   │
│  │  │  │ ████│VER│M. Verstappen ▼│   │  │  ┌─────────────────────────────────────────────────────────────┐  │ │   │
│  │  │  └──────────────────────────┘   │  │  │  VER Lap 25 (1:31.234) ▼  │  vs  │  HAM Lap 24 (1:31.456) ▼│  │ │   │
│  │  │                                 │  │  └─────────────────────────────────────────────────────────────┘  │ │   │
│  │  │  ┌──────────────────────────┐   │  │                                                                   │ │   │
│  │  │  │      LAP 25              │   │  │  ━ VER (primary)    ┄ HAM (compare)                               │ │   │
│  │  │  │                          │   │  │                                                                   │ │   │
│  │  │  │   ⏱ 1:31.234            │   │  │  SPEED OVERLAY                                                    │ │   │
│  │  │  │                          │   │  │  ┌────────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │   S1: 28.456   ██ PB     │   │  │  │     ╱╲         ╱╲         ╱╲         ╱╲         ╱╲         │  │ │   │
│  │  │  │   S2: 34.123   ██ SB     │   │  │  │    ╱..╲.......╱..╲.......╱..╲.......╱..╲.......╱..╲        │  │ │   │
│  │  │  │   S3: 28.655   ░░        │   │  │  │   ╱    ╲     ╱    ╲     ╱    ╲     ╱    ╲     ╱    ╲       │  │ │   │
│  │  │  │                          │   │  │  │  ╱      ╲   ╱      ╲   ╱      ╲   ╱      ╲   ╱      ╲      │  │ │   │
│  │  │  │   ⬤ SOFT  18 laps       │   │  │  │ ╱        ╲ ╱        ╲ ╱        ╲ ╱        ╲ ╱        ╲     │  │ │   │
│  │  │  │                          │   │  │  └────────────────────────────────────────────────────────────┘  │ │   │
│  │  │  │   Fuel: ~45 kg           │   │  │                                                                   │ │   │
│  │  │  │                          │   │  │  DELTA (VER vs HAM)                                               │ │   │
│  │  │  └──────────────────────────┘   │  │  ┌────────────────────────────────────────────────────────────┐  │ │   │
│  │  │                                 │  │  │ +0.3 ──┬──────────╱╲───────────────────────────────────────│  │ │   │
│  │  │                                 │  │  │        │         ╱  ╲                          ╱           │  │ │   │
│  │  │                                 │  │  │  0.0 ──┼────────╱────╲────────────────────────╱────────────│  │ │   │
│  │  │                                 │  │  │        │       ╱      ╲        ╱╲            ╱             │  │ │   │
│  │  │                                 │  │  │ -0.3 ──┼──────╱────────╲──────╱──╲──────────╱──────────────│  │ │   │
│  │  │                                 │  │  │        │     ╱          ╲    ╱    ╲        ╱               │  │ │   │
│  │  │                                 │  │  │ -0.6 ──┼────╱────────────╲──╱──────╲──────╱────────────────│  │ │   │
│  │  │                                 │  │  │        │                  ╲╱        ╲    ╱                 │  │ │   │
│  │  │                                 │  │  │        │                            ╲╱                    │  │ │   │
│  │  │                                 │  │  └────────────────────────────────────────────────────────────┘  │ │   │
│  │  │                                 │  │           T1    T4    T8    T11   T13   T15   S/F               │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  FINAL DELTA: VER -0.222s faster                                 │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  └─────────────────────────────────┘  └───────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  │  ┌─────────────────────────────────┐  ┌───────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │  ▌ DRIVER B           ⟳        │  │  ▌ SECTOR BREAKDOWN                               ↗  ⟳  ⚙        │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  ├─────────────────────────────────┤  ├───────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │  ┌──────────────────────────┐   │  │           SECTOR 1        SECTOR 2        SECTOR 3      TOTAL    │ │   │
│  │  │  │ ████│HAM│L. Hamilton  ▼ │   │  │  ┌──────────────────────────────────────────────────────────────┐ │ │   │
│  │  │  └──────────────────────────┘   │  │  │                                                              │ │ │   │
│  │  │                                 │  │  │  VER    28.456 ██      34.123 ██      28.655 ░░    1:31.234  │ │ │   │
│  │  │  ┌──────────────────────────┐   │  │  │                                                              │ │ │   │
│  │  │  │      LAP 24              │   │  │  │  HAM    28.567 ░░      34.234 ░░      28.655 ░░    1:31.456  │ │ │   │
│  │  │  │                          │   │  │  │                                                              │ │ │   │
│  │  │  │   ⏱ 1:31.456            │   │  │  ├──────────────────────────────────────────────────────────────┤ │ │   │
│  │  │  │                          │   │  │  │                                                              │ │ │   │
│  │  │  │   S1: 28.567   ░░        │   │  │  │  DELTA  -0.111 ✓      -0.111 ✓       0.000 =     -0.222 ✓   │ │ │   │
│  │  │  │   S2: 34.234   ░░        │   │  │  │         VER faster   VER faster     Equal      VER faster   │ │ │   │
│  │  │  │   S3: 28.655   ░░        │   │  │  │                                                              │ │ │   │
│  │  │  │                          │   │  │  └──────────────────────────────────────────────────────────────┘ │ │   │
│  │  │  │   ⬤ MEDIUM  12 laps     │   │  │                                                                   │ │   │
│  │  │  │                          │   │  │  KEY DIFFERENCES:                                                 │ │   │
│  │  │  │   Fuel: ~48 kg           │   │  │  ┌──────────────────────────────────────────────────────────────┐ │ │   │
│  │  │  │                          │   │  │  │  • T1: VER 2km/h faster on exit                             │ │ │   │
│  │  │  └──────────────────────────┘   │  │  │  • T4: VER brakes 5m later                                  │ │ │   │
│  │  │                                 │  │  │  • T8: VER gains 0.1s on acceleration                       │ │ │   │
│  │  │                                 │  │  │  • T11-12: Similar performance                              │ │ │   │
│  │  │                                 │  │  │  • T15: VER better traction out of corner                   │ │ │   │
│  │  │                                 │  │  └──────────────────────────────────────────────────────────────┘ │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  └─────────────────────────────────┘  └───────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  LEGEND:                                                                                                            │
│  ██ PB = Personal Best    ██ SB = Session Best    ░░ = Normal    ✓ = Faster    ✗ = Slower    = = Equal             │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Strategy View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              STRATEGY VIEW                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                                                       │ │   │
│  │  │  ▌ STINT TIMELINE                                                  ● LIVE   2s ago      ↗  ⟳  ⚙      │ │   │
│  │  │                                                                                                       │ │   │
│  │  ├───────────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                                                                                       │ │   │
│  │  │  LAP    1    5    10   15   20   25   30   35   40   45   50   55   57                               │ │   │
│  │  │         │    │    │    │    │    │    │    │    │    │    │    │    │                                │ │   │
│  │  │  VER  ──█████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░──                │ │   │
│  │  │         SOFT (18)          ↓ MEDIUM (25+)                                                            │ │   │
│  │  │                           PIT                                                                         │ │   │
│  │  │  PER  ──█████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░──                │ │   │
│  │  │         SOFT (20)          ↓ HARD (25+)                                                              │ │   │
│  │  │                           PIT                                                                         │ │   │
│  │  │  LEC  ──███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░──                │ │   │
│  │  │         SOFT (15)    ↓ MEDIUM (25+)                                                                  │ │   │
│  │  │                     PIT                                                                               │ │   │
│  │  │  SAI  ──███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░──                │ │   │
│  │  │         SOFT (15)    ↓ MEDIUM (25+)                                                                  │ │   │
│  │  │                     PIT                                                                               │ │   │
│  │  │  HAM  ──████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░──                │ │   │
│  │  │         MEDIUM (22)          ↓ HARD (25+)                                                            │ │   │
│  │  │                             PIT                                                                       │ │   │
│  │  │  ...                                                                                                  │ │   │
│  │  │                                                                                                       │ │   │
│  │  │  LEGEND:  ███ SOFT   ░░░ MEDIUM   ▓▓▓ HARD   ═══ INTER   ▒▒▒ WET   ↓ PIT STOP                        │ │   │
│  │  │                                                                                                       │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  │  ┌────────────────────────────────────────────────────┐  ┌────────────────────────────────────────────────┐ │   │
│  │  │                                                    │  │                                                │ │   │
│  │  │  ▌ UNDERCUT PREDICTOR                 ↗  ⟳  ⚙    │  │  ▌ PIT STOPS                       ↗  ⟳  ⚙    │ │   │
│  │  │                                                    │  │                                                │ │   │
│  │  ├────────────────────────────────────────────────────┤  ├────────────────────────────────────────────────┤ │   │
│  │  │                                                    │  │                                                │ │   │
│  │  │  SCENARIO INPUTS                                   │  │  POS  DRIVER   LAP  TYRES      DURATION       │ │   │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  ────────────────────────────────────────────  │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  │  Attacker:  ┌─────────────────────────────┐  │  │  │   1   VER      18   S→M        22.456s        │ │   │
│  │  │  │             │  PER  Sergio Perez       ▼  │  │  │  │   2   PER      20   S→H        23.123s        │ │   │
│  │  │  │             └─────────────────────────────┘  │  │  │   3   LEC      15   S→M        22.789s        │ │   │
│  │  │  │                                              │  │  │   4   SAI      15   S→M        22.901s        │ │   │
│  │  │  │  Defender:  ┌─────────────────────────────┐  │  │  │   5   HAM      22   M→H        24.567s        │ │   │
│  │  │  │             │  LEC  Charles Leclerc    ▼  │  │  │  │   6   RUS      22   M→H        24.234s        │ │   │
│  │  │  │             └─────────────────────────────┘  │  │  │   .   ...      ..   ....       .......        │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  │  Current Gap:    5.2s                        │  │  │  AVERAGE PIT TIME: 23.4s                       │ │   │
│  │  │  │                                              │  │  │  FASTEST PIT: 22.1s (VER)                      │ │   │
│  │  │  │  New Tyre:  ○ Soft  ● Medium  ○ Hard         │  │  │  SLOWEST PIT: 28.9s (BOT - issue)              │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  │  Pit Window:  ┌─────────┐                    │  │  │                                                │ │   │
│  │  │  │               │  NOW ▼  │                    │  │  │                                                │ │   │
│  │  │  │               └─────────┘                    │  │  │                                                │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  └──────────────────────────────────────────────┘  │  │                                                │ │   │
│  │  │                                                    │  │                                                │ │   │
│  │  │  PREDICTION RESULT                                 │  │                                                │ │   │
│  │  │  ┌──────────────────────────────────────────────┐  │  │                                                │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  │  ┌────────────────────────────────────────┐  │  │  │                                                │ │   │
│  │  │  │  │     UNDERCUT LIKELY TO SUCCEED         │  │  │  │                                                │ │   │
│  │  │  │  │                                        │  │  │  │                                                │ │   │
│  │  │  │  │     Confidence: ████████░░ 78%         │  │  │  │                                                │ │   │
│  │  │  │  └────────────────────────────────────────┘  │  │  │                                                │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  │  Expected gap after PER pits: -1.2s         │  │  │                                                │ │   │
│  │  │  │  (PER would be ahead)                       │  │  │                                                │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  │  Factors:                                    │  │  │                                                │ │   │
│  │  │  │  • PER tyre advantage: +1.2s/lap            │  │  │                                                │ │   │
│  │  │  │  • LEC degradation: 0.15s/lap               │  │  │                                                │ │   │
│  │  │  │  • Pit delta: 22.5s                         │  │  │                                                │ │   │
│  │  │  │                                              │  │  │                                                │ │   │
│  │  │  └──────────────────────────────────────────────┘  │  │                                                │ │   │
│  │  │                                                    │  │                                                │ │   │
│  │  │  ┌────────────────────────────────────────────┐    │  │                                                │ │   │
│  │  │  │        RECALCULATE          RESET          │    │  │                                                │ │   │
│  │  │  └────────────────────────────────────────────┘    │  │                                                │ │   │
│  │  │                                                    │  │                                                │ │   │
│  │  └────────────────────────────────────────────────────┘  └────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Settings View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              SETTINGS VIEW                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌─────────────────────────────────┐  ┌───────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │  SETTINGS                       │  │  APPEARANCE                                                       │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  ├─────────────────────────────────┤  ├───────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │  ┌───────────────────────────┐  │  │  THEME                                                            │ │   │
│  │  │  │ 🎨  Appearance       ◀────│──┼──│  ───────────────────────────────────────────────────────          │ │   │
│  │  │  ├───────────────────────────┤  │  │                                                                   │ │   │
│  │  │  │ 🔌  Connection            │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │ │   │
│  │  │  ├───────────────────────────┤  │  │  │              │  │              │  │              │            │ │   │
│  │  │  │ 📊  Data                  │  │  │  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │            │ │   │
│  │  │  ├───────────────────────────┤  │  │  │  │ ██████ │  │  │  │ ░░░░░░ │  │  │  │ ▓▓▓▓▓▓ │  │            │ │   │
│  │  │  │ ⌨️  Shortcuts             │  │  │  │  │ ██  ██ │  │  │  │ ░░  ░░ │  │  │  │ ▓▓  ▓▓ │  │            │ │   │
│  │  │  ├───────────────────────────┤  │  │  │  │ ██████ │  │  │  │ ░░░░░░ │  │  │  │ ▓▓▓▓▓▓ │  │            │ │   │
│  │  │  │ 📤  Export                │  │  │  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │            │ │   │
│  │  │  ├───────────────────────────┤  │  │  │              │  │              │  │              │            │ │   │
│  │  │  │ 🧩  Plugins               │  │  │  │  ● Dark     │  │  ○ Light    │  │  ○ High Cont │            │ │   │
│  │  │  ├───────────────────────────┤  │  │  │   (default) │  │              │  │              │            │ │   │
│  │  │  │ ℹ️  About                  │  │  │  └──────────────┘  └──────────────┘  └──────────────┘            │ │   │
│  │  │  └───────────────────────────┘  │  │                                                                   │ │   │
│  │  │                                 │  │  ───────────────────────────────────────────────────────          │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ACCENT COLOR                                                     │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │ │   │
│  │  │                                 │  │  │ ●  │ │    │ │    │ │    │ │    │ │    │                       │ │   │
│  │  │                                 │  │  │ ██ │ │ ██ │ │ ██ │ │ ██ │ │ ██ │ │ ██ │                       │ │   │
│  │  │                                 │  │  │Red │ │Blue│ │Grn │ │Pur │ │Org │ │Cyn │                       │ │   │
│  │  │                                 │  │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                       │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ───────────────────────────────────────────────────────          │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  FONT SIZE                                                        │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  Small    ○────────●────────○    Large                           │ │   │
│  │  │                                 │  │                    ▲                                              │ │   │
│  │  │                                 │  │                  Medium                                           │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ───────────────────────────────────────────────────────          │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ACCESSIBILITY                                                    │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ┌──┐                                                             │ │   │
│  │  │                                 │  │  │✓ │  Reduce motion                                             │ │   │
│  │  │                                 │  │  └──┘                                                             │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ┌──┐                                                             │ │   │
│  │  │                                 │  │  │  │  High contrast focus indicators                            │ │   │
│  │  │                                 │  │  └──┘                                                             │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ┌──┐                                                             │ │   │
│  │  │                                 │  │  │  │  Screen reader optimizations                               │ │   │
│  │  │                                 │  │  └──┘                                                             │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ───────────────────────────────────────────────────────          │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  DENSITY                                                          │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │  ○ Comfortable   ● Compact   ○ Dense                             │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  │                                 │  │                                                                   │ │   │
│  │  └─────────────────────────────────┘  └───────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Modal/Dialog Wireframes

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          MODALS + DIALOGS                                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  COMMAND PALETTE (⌘K)                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │                           ┌───────────────────────────────────────────────────────────┐                     │   │
│  │                           │                                                           │                     │   │
│  │                           │  🔍  Type a command or search...                          │                     │   │
│  │                           │                                                           │                     │   │
│  │                           ├───────────────────────────────────────────────────────────┤                     │   │
│  │                           │                                                           │                     │   │
│  │                           │  RECENT                                                   │                     │   │
│  │                           │  ─────────────────────────────────────────────────────    │                     │   │
│  │                           │  ↳ Go to Timing View                            ⌘1       │                     │   │
│  │                           │  ↳ Go to Telemetry View                         ⌘2       │                     │   │
│  │                           │                                                           │                     │   │
│  │                           │  COMMANDS                                                 │                     │   │
│  │                           │  ─────────────────────────────────────────────────────    │                     │   │
│  │                           │  ▶ Play/Pause                                   Space     │                     │   │
│  │                           │  ↗ Export Current View                          ⌘E       │                     │   │
│  │                           │  ⟳ Refresh Data                                 ⌘R       │                     │   │
│  │                           │  ⚙ Open Settings                                ⌘,       │                     │   │
│  │                           │                                                           │                     │   │
│  │                           │  SESSIONS                                                 │                     │   │
│  │                           │  ─────────────────────────────────────────────────────    │                     │   │
│  │                           │  🏁 Bahrain GP · Race                                     │                     │   │
│  │                           │  🏁 Bahrain GP · Qualifying                               │                     │   │
│  │                           │  🏁 Saudi Arabian GP · Race                               │                     │   │
│  │                           │                                                           │                     │   │
│  │                           └───────────────────────────────────────────────────────────┘                     │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  EXPORT DIALOG                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │                      ┌────────────────────────────────────────────────────────────────┐                     │   │
│  │                      │                                                                │                     │   │
│  │                      │  EXPORT                                                   ✕    │                     │   │
│  │                      │                                                                │                     │   │
│  │                      ├────────────────────────────────────────────────────────────────┤                     │   │
│  │                      │                                                                │                     │   │
│  │                      │  FORMAT                                                        │                     │   │
│  │                      │  ┌────────────────────────────────────────────────────────┐    │                     │   │
│  │                      │  │  ● PNG   ○ PDF   ○ CSV   ○ JSON                        │    │                     │   │
│  │                      │  └────────────────────────────────────────────────────────┘    │                     │   │
│  │                      │                                                                │                     │   │
│  │                      │  CONTENT                                                       │                     │   │
│  │                      │  ┌──┐                                                          │                     │   │
│  │                      │  │✓ │  Current View (Telemetry)                               │                     │   │
│  │                      │  └──┘                                                          │                     │   │
│  │                      │  ┌──┐                                                          │                     │   │
│  │                      │  │  │  All Views                                              │                     │   │
│  │                      │  └──┘                                                          │                     │   │
│  │                      │  ┌──┐                                                          │                     │   │
│  │                      │  │  │  Raw Data Only                                          │                     │   │
│  │                      │  └──┘                                                          │                     │   │
│  │                      │                                                                │                     │   │
│  │                      │  RESOLUTION (for images)                                       │                     │   │
│  │                      │  ┌────────────────────────────────────────────────────────┐    │                     │   │
│  │                      │  │  ○ 1x   ● 2x   ○ 4x                                    │    │                     │   │
│  │                      │  └────────────────────────────────────────────────────────┘    │                     │   │
│  │                      │                                                                │                     │   │
│  │                      ├────────────────────────────────────────────────────────────────┤                     │   │
│  │                      │                                                                │                     │   │
│  │                      │                        ┌──────────┐  ┌──────────────────┐      │                     │   │
│  │                      │                        │  Cancel  │  │     Export       │      │                     │   │
│  │                      │                        └──────────┘  └──────────────────┘      │                     │   │
│  │                      │                                                                │                     │   │
│  │                      └────────────────────────────────────────────────────────────────┘                     │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  ERROR STATE (Panel Level)                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                                                        │ │   │
│  │  │  ▌ TIMING TOWER                                     ● ERROR   5m ago              ↗  ⟳  ⚙            │ │   │
│  │  │                                                                                                        │ │   │
│  │  ├────────────────────────────────────────────────────────────────────────────────────────────────────────┤ │   │
│  │  │                                                                                                        │ │   │
│  │  │                                                                                                        │ │   │
│  │  │                                                                                                        │ │   │
│  │  │                              ┌─────────────────────────────────────┐                                   │ │   │
│  │  │                              │                                     │                                   │ │   │
│  │  │                              │           ⚠                         │                                   │ │   │
│  │  │                              │                                     │                                   │ │   │
│  │  │                              │   Failed to load timing data        │                                   │ │   │
│  │  │                              │                                     │                                   │ │   │
│  │  │                              │   Connection timeout after 30s      │                                   │ │   │
│  │  │                              │                                     │                                   │ │   │
│  │  │                              │   ┌────────────────────────────┐    │                                   │ │   │
│  │  │                              │   │       Retry Now            │    │                                   │ │   │
│  │  │                              │   └────────────────────────────┘    │                                   │ │   │
│  │  │                              │                                     │                                   │ │   │
│  │  │                              │   View error details                │                                   │ │   │
│  │  │                              │                                     │                                   │ │   │
│  │  │                              └─────────────────────────────────────┘                                   │ │   │
│  │  │                                                                                                        │ │   │
│  │  │                                                                                                        │ │   │
│  │  │                                                                                                        │ │   │
│  │  └────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

**End of Part 4.**

# Part 5: Advanced Topics + Electron/Web Wrapping + Final Summary

---

## 1. Advanced Rendering Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      GPU RENDERING ARCHITECTURE                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  RENDERING STRATEGY BY COMPONENT                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Component          │ Renderer              │ GPU Acceleration │ Target FPS │ Notes                       │   │
│  │   ───────────────────┼───────────────────────┼──────────────────┼────────────┼────────────────────────────  │   │
│  │   QML UI (Shell)     │ Qt Quick Scene Graph  │ ✓ (default)      │ 60         │ Hardware compositing        │   │
│  │   Telemetry Charts   │ PyQtGraph + OpenGL    │ ✓ (explicit)     │ 60         │ Custom shaders optional     │   │
│  │   Track Map          │ QML Canvas / OpenGL   │ ✓ (v2)           │ 30-60      │ LOD for car count           │   │
│  │   Timing Tower       │ QML ListView          │ ✓ (default)      │ 60         │ Virtualized rows            │   │
│  │   Video Player       │ QtMultimedia          │ ✓ (platform)     │ 30         │ Hardware decode             │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PYQTGRAPH OPENGL PIPELINE                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │     Raw Telemetry Data                                                                                      │   │
│  │            │                                                                                                │   │
│  │            ▼                                                                                                │   │
│  │    ┌───────────────────┐                                                                                    │   │
│  │    │   Downsampling    │  ← LTTB algorithm (Largest Triangle Three Buckets)                                │   │
│  │    │   (Python/NumPy)  │  ← Target: max 2000 points per visible window                                     │   │
│  │    └─────────┬─────────┘                                                                                    │   │
│  │              │                                                                                              │   │
│  │              ▼                                                                                              │   │
│  │    ┌───────────────────┐                                                                                    │   │
│  │    │   Vertex Buffer   │  ← numpy array → OpenGL VBO                                                       │   │
│  │    │   Upload          │  ← Batched updates (not per-frame)                                                │   │
│  │    └─────────┬─────────┘                                                                                    │   │
│  │              │                                                                                              │   │
│  │              ▼                                                                                              │   │
│  │    ┌───────────────────┐                                                                                    │   │
│  │    │   GPU Rendering   │  ← Line/area rendering via shaders                                                │   │
│  │    │   (OpenGL 3.3+)   │  ← Anti-aliasing: MSAA or shader-based                                            │   │
│  │    └─────────┬─────────┘                                                                                    │   │
│  │              │                                                                                              │   │
│  │              ▼                                                                                              │   │
│  │    ┌───────────────────┐                                                                                    │   │
│  │    │   Qt Compositor   │  ← Blended with QML scene graph                                                   │   │
│  │    └───────────────────┘                                                                                    │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  LEVEL OF DETAIL (LOD) SYSTEM                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Zoom Level     │ Points per Lap │ Visual Quality      │ Use Case                                         │   │
│  │   ───────────────┼────────────────┼─────────────────────┼──────────────────────────────────────────────────  │   │
│  │   Full Session   │ 100            │ Overview shape      │ Initial load, zoom-out                            │   │
│  │   10 Laps        │ 500            │ Trend visible       │ Medium zoom                                       │   │
│  │   3 Laps         │ 1000           │ Details emerging    │ Analysis zoom                                     │   │
│  │   1 Lap          │ 2000           │ Full detail         │ Deep analysis                                     │   │
│  │   Sector         │ Full (5000+)   │ Every sample        │ Corner analysis                                   │   │
│  │                                                                                                             │   │
│  │   LOD transitions:                                                                                          │   │
│  │   • Triggered by zoom level change                                                                          │   │
│  │   • Async loading (show current LOD, upgrade in background)                                                 │   │
│  │   • Smooth interpolation during transition                                                                  │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Performance Optimization Deep Dive

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      PERFORMANCE OPTIMIZATION                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  PERFORMANCE BUDGETS (Refined)                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Metric                        │ Budget        │ Measurement Method            │ Alert Threshold          │   │
│  │   ──────────────────────────────┼───────────────┼───────────────────────────────┼─────────────────────────  │   │
│  │   Cold start → usable UI        │ < 2.0s        │ App launch to first render    │ > 3.0s                   │   │
│  │   Session switch                │ < 500ms       │ Click to new data displayed   │ > 1.0s                   │   │
│  │   Timing tower update cycle     │ < 50ms (20Hz) │ Data receive to render        │ > 100ms                  │   │
│  │   Chart pan/zoom response       │ < 16ms (60Hz) │ Input to frame complete       │ > 33ms                   │   │
│  │   Chart cursor tracking         │ < 8ms         │ Mouse move to cursor update   │ > 16ms                   │   │
│  │   Track map car positions       │ < 33ms (30Hz) │ Data to position update       │ > 50ms                   │   │
│  │   Memory (long session)         │ < 1.5GB       │ Process working set           │ > 2.0GB                  │   │
│  │   Memory (idle)                 │ < 400MB       │ Process working set           │ > 600MB                  │   │
│  │   CPU (idle)                    │ < 2%          │ Process CPU utilization       │ > 5%                     │   │
│  │   CPU (live streaming)          │ < 15%         │ Process CPU utilization       │ > 25%                    │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  OPTIMIZATION STRATEGIES                                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   STARTUP OPTIMIZATION                                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────────────────────────────────────────     │   │
│  │                                                                                                             │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                                                                                                     │   │   │
│  │   │   Phase 1 (0-500ms)        Phase 2 (500-1000ms)      Phase 3 (1000-2000ms)                         │   │   │
│  │   │   ──────────────────       ────────────────────       ─────────────────────                         │   │   │
│  │   │   • Load Qt runtime        • Load QML engine          • Fetch session index                         │   │   │
│  │   │   • Init Python            • Render shell skeleton    • Populate sidebar                            │   │   │
│  │   │   • Load core modules      • Show loading state       • Load last session                           │   │   │
│  │   │                            • Init store system        • Render first view                           │   │   │
│  │   │                                                                                                     │   │   │
│  │   │   [█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]            │   │   │
│  │   │   0ms                      500ms                      1000ms                     2000ms             │   │   │
│  │   │                                                                                                     │   │   │
│  │   └─────────────────────────────────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                                             │   │
│  │   Key techniques:                                                                                           │   │
│  │   • Lazy import Python modules (import on first use)                                                        │   │
│  │   • Pre-compile QML to .qmlc files                                                                          │   │
│  │   • Cache session index in DuckDB (skip network on start)                                                   │   │
│  │   • Progressive UI reveal (shell first, data later)                                                         │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   MEMORY OPTIMIZATION                                                                                       │   │
│  │   ─────────────────────────────────────────────────────────────────────────────────────────────────────     │   │
│  │                                                                                                             │   │
│  │   Data Lifecycle:                                                                                           │   │
│  │                                                                                                             │   │
│  │   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                           │   │
│  │   │   Network   │ ───▶ │   Memory    │ ───▶ │    Disk     │ ───▶ │   Evicted   │                           │   │
│  │   │   Fetch     │      │   Cache     │      │   Cache     │      │  (freed)    │                           │   │
│  │   └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘                           │   │
│  │                              │                    │                                                         │   │
│  │                              │                    │                                                         │   │
│  │                        LRU eviction          30-day TTL                                                     │   │
│  │                        (500MB cap)           (5GB cap)                                                      │   │
│  │                                                                                                             │   │
│  │   Memory pools:                                                                                             │   │
│  │   • Hot data: Current session telemetry (up to 200MB)                                                       │   │
│  │   • Warm data: Recent laps, compare data (up to 200MB)                                                      │   │
│  │   • Cold data: Session metadata, computed results (up to 100MB)                                             │   │
│  │                                                                                                             │   │
│  │   Techniques:                                                                                               │   │
│  │   • NumPy memory-mapped arrays for large datasets                                                           │   │
│  │   • Shared memory for cross-view data (e.g., positions)                                                     │   │
│  │   • Explicit gc.collect() on session switch                                                                 │   │
│  │   • Weak references for cached computed values                                                              │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   CPU OPTIMIZATION                                                                                          │   │
│  │   ─────────────────────────────────────────────────────────────────────────────────────────────────────     │   │
│  │                                                                                                             │   │
│  │   Computation Distribution:                                                                                 │   │
│  │                                                                                                             │   │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────────────────────┐     │   │
│  │   │                                                                                                   │     │   │
│  │   │   Main Thread              Worker Pool                   GPU                                     │     │   │
│  │   │   ────────────             ───────────                   ───                                     │     │   │
│  │   │   • UI updates             • Downsampling                • Chart rendering                       │     │   │
│  │   │   • Input handling         • Data parsing                • Scene compositing                     │     │   │
│  │   │   • State updates          • Delta calculations          • Video decode                          │     │   │
│  │   │   • Signal dispatch        • Export generation           • Anti-aliasing                         │     │   │
│  │   │                            • ML inference                                                        │     │   │
│  │   │                            • Cache I/O                                                           │     │   │
│  │   │                                                                                                   │     │   │
│  │   │   Target: < 16ms/frame     Target: Background            Target: < 8ms/frame                     │     │   │
│  │   │                                                                                                   │     │   │
│  │   └───────────────────────────────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                                             │   │
│  │   Techniques:                                                                                               │   │
│  │   • Debounce rapid updates (e.g., slider changes: 50ms)                                                     │   │
│  │   • Batch state updates (coalesce within single frame)                                                      │   │
│  │   • Use NumPy/Numba for hot paths                                                                           │   │
│  │   • Profile with py-spy / Qt Creator profiler                                                               │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Offline-First Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       OFFLINE-FIRST ARCHITECTURE                                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  SYNC STATE MACHINE                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │                                    ┌─────────────┐                                                          │   │
│  │                         ┌─────────▶│   ONLINE    │◀─────────┐                                               │   │
│  │                         │          └──────┬──────┘          │                                               │   │
│  │                         │                 │                 │                                               │   │
│  │                   network restored    connection lost   sync complete                                       │   │
│  │                         │                 │                 │                                               │   │
│  │                         │                 ▼                 │                                               │   │
│  │                  ┌──────┴──────┐   ┌─────────────┐   ┌──────┴──────┐                                        │   │
│  │                  │   SYNCING   │◀──│   OFFLINE   │──▶│   SYNCING   │                                        │   │
│  │                  │  (upload)   │   └─────────────┘   │  (download) │                                        │   │
│  │                  └─────────────┘                     └─────────────┘                                        │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  OFFLINE CAPABILITIES                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Feature                        │ Offline Support │ Sync Strategy                                         │   │
│  │   ───────────────────────────────┼─────────────────┼───────────────────────────────────────────────────────  │   │
│  │   Session browsing               │ ✓ Full          │ Index cached on first load                            │   │
│  │   Previously viewed sessions     │ ✓ Full          │ Full data cached on access                            │   │
│  │   Telemetry analysis             │ ✓ Cached only   │ LOD data cached per session                           │   │
│  │   New session access             │ ✗ None          │ Requires network                                      │   │
│  │   Live mode                      │ ✗ None          │ WebSocket required                                    │   │
│  │   Export                         │ ✓ Cached data   │ Works on cached data                                  │   │
│  │   Settings                       │ ✓ Full          │ Local storage only                                    │   │
│  │   User preferences               │ ✓ Full          │ Sync on reconnect (optional)                          │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  CONFLICT RESOLUTION                                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Data Type          │ Strategy           │ Resolution                                                     │   │
│  │   ───────────────────┼────────────────────┼─────────────────────────────────────────────────────────────── │   │
│  │   Session data       │ Server wins        │ Immutable after session end                                   │   │
│  │   User preferences   │ Last-write wins    │ Timestamp comparison                                          │   │
│  │   Workspace layouts  │ Last-write wins    │ Prompt user on conflict                                       │   │
│  │   Pinned drivers     │ Merge              │ Union of local and remote                                     │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Electron / Web Wrapping Options

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ELECTRON / WEB DEPLOYMENT OPTIONS                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  OPTION COMPARISON                                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Option                │ Effort │ Performance │ Distribution │ Best For                                   │   │
│  │   ──────────────────────┼────────┼─────────────┼──────────────┼──────────────────────────────────────────  │   │
│  │   Native Qt (current)   │ Done   │ ★★★★★      │ Desktop only │ Power users, performance-critical          │   │
│  │   Electron wrapper      │ Medium │ ★★★☆☆      │ Desktop      │ Web tech reuse, easier updates             │   │
│  │   Web app (full rewrite)│ High   │ ★★★☆☆      │ Browser      │ Maximum reach, no install                  │   │
│  │   PWA                   │ High   │ ★★★☆☆      │ Browser+PWA  │ Cross-platform, offline capable            │   │
│  │   Tauri (Rust)          │ Medium │ ★★★★☆      │ Desktop      │ Smaller bundle, native perf                │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│                                                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│  OPTION A: ELECTRON WRAPPER (Hybrid Approach)                                                                       │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                                     │
│  Architecture:                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │   │                              ELECTRON SHELL                                                          │ │   │
│  │   │                                                                                                      │ │   │
│  │   │   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │ │   │
│  │   │   │                           CHROMIUM RENDERER                                                    │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   │   ┌───────────────────────────────────────────┐  ┌───────────────────────────────────────────┐ │ │ │   │
│  │   │   │   │             REACT/VUE UI                  │  │           WEB WORKERS                     │ │ │ │   │
│  │   │   │   │                                           │  │                                           │ │ │ │   │
│  │   │   │   │   • Shell (top bar, sidebar, nav)         │  │   • Data processing                       │ │ │ │   │
│  │   │   │   │   • Timing tower (virtualized)            │  │   • Downsampling                          │ │ │ │   │
│  │   │   │   │   • Strategy panels                       │  │   • Delta calculations                    │ │ │ │   │
│  │   │   │   │   • Settings                              │  │                                           │ │ │ │   │
│  │   │   │   │                                           │  │                                           │ │ │ │   │
│  │   │   │   └───────────────────────────────────────────┘  └───────────────────────────────────────────┘ │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   │   ┌───────────────────────────────────────────┐  ┌───────────────────────────────────────────┐ │ │ │   │
│  │   │   │   │          WEBGL CHARTS                     │  │           VIDEO PLAYER                    │ │ │ │   │
│  │   │   │   │                                           │  │                                           │ │ │ │   │
│  │   │   │   │   • Telemetry charts (Chart.js/uPlot)     │  │   • HLS.js for streaming                  │ │ │ │   │
│  │   │   │   │   • Track map (Canvas/WebGL)              │  │   • Native video element                  │ │ │ │   │
│  │   │   │   │   • Position charts                       │  │                                           │ │ │ │   │
│  │   │   │   │                                           │  │                                           │ │ │ │   │
│  │   │   │   └───────────────────────────────────────────┘  └───────────────────────────────────────────┘ │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   └────────────────────────────────────────────────────────────────────────────────────────────────┘ │ │   │
│  │   │                                             │                                                        │ │   │
│  │   │                                      IPC Bridge                                                      │ │   │
│  │   │                                             │                                                        │ │   │
│  │   │   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │ │   │
│  │   │   │                           NODE.JS MAIN PROCESS                                                 │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   │   • Window management                                                                          │ │ │   │
│  │   │   │   • System tray                                                                                │ │ │   │
│  │   │   │   • Auto-updater                                                                               │ │ │   │
│  │   │   │   • Native file dialogs                                                                        │ │ │   │
│  │   │   │   • Local database (better-sqlite3)                                                            │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   └────────────────────────────────────────────────────────────────────────────────────────────────┘ │ │   │
│  │   │                                                                                                      │ │   │
│  │   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  Pros:                                                                                                              │
│  • Reuse web development skills                                                                                     │
│  • Easier auto-update via electron-updater                                                                          │
│  • Can share code with future web version                                                                           │
│  • Large ecosystem of UI libraries                                                                                  │
│                                                                                                                     │
│  Cons:                                                                                                              │
│  • Large bundle size (~150MB+)                                                                                      │
│  • Higher memory usage than native Qt                                                                               │
│  • WebGL charts less performant than OpenGL                                                                         │
│  • Complete UI rewrite required                                                                                     │
│                                                                                                                     │
│  Tech Stack:                                                                                                        │
│  • Framework: Electron 28+                                                                                          │
│  • UI: React 18 + TypeScript                                                                                        │
│  • State: Zustand or Jotai                                                                                          │
│  • Charts: uPlot (fastest) or Lightweight Charts                                                                    │
│  • Styling: Tailwind CSS                                                                                            │
│  • Build: Vite + electron-builder                                                                                   │
│                                                                                                                     │
│                                                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│  OPTION B: TAURI (Rust-based Alternative)                                                                           │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                                     │
│  Architecture:                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │   │                               TAURI SHELL                                                            │ │   │
│  │   │                                                                                                      │ │   │
│  │   │   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │ │   │
│  │   │   │                      SYSTEM WEBVIEW (WebKit/WebView2)                                          │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   │   Same web UI as Electron option                                                               │ │ │   │
│  │   │   │   (React/Vue + WebGL charts)                                                                   │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   └────────────────────────────────────────────────────────────────────────────────────────────────┘ │ │   │
│  │   │                                             │                                                        │ │   │
│  │   │                                       IPC (JSON-RPC)                                                 │ │   │
│  │   │                                             │                                                        │ │   │
│  │   │   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │ │   │
│  │   │   │                            RUST BACKEND                                                        │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   │   • Window management                                                                          │ │ │   │
│  │   │   │   • File system access                                                                         │ │ │   │
│  │   │   │   • HTTP client                                                                                │ │ │   │
│  │   │   │   • SQLite (rusqlite)                                                                          │ │ │   │
│  │   │   │   • Heavy computation (optional)                                                               │ │ │   │
│  │   │   │                                                                                                │ │ │   │
│  │   │   └────────────────────────────────────────────────────────────────────────────────────────────────┘ │ │   │
│  │   │                                                                                                      │ │   │
│  │   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  Pros:                                                                                                              │
│  • Much smaller bundle (~10-20MB vs 150MB+)                                                                         │
│  • Lower memory usage (uses system webview)                                                                         │
│  • Better security model                                                                                            │
│  • Rust backend for performance-critical ops                                                                        │
│                                                                                                                     │
│  Cons:                                                                                                              │
│  • Webview inconsistencies across platforms                                                                         │
│  • Smaller ecosystem than Electron                                                                                  │
│  • Rust learning curve for backend                                                                                  │
│  • Still requires UI rewrite                                                                                        │
│                                                                                                                     │
│                                                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│  OPTION C: WEB APPLICATION (Full Browser)                                                                           │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                                     │
│  Architecture:                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │   │                                                                                                       │ │   │
│  │   │   BROWSER                                                                                             │ │   │
│  │   │   ──────────────────────────────────────────────────────────────────────────────────────────────────  │ │   │
│  │   │                                                                                                       │ │   │
│  │   │   ┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐          │ │   │
│  │   │   │          FRONTEND (SPA)                 │   │           SERVICE WORKER                │          │ │   │
│  │   │   │                                         │   │                                         │          │ │   │
│  │   │   │   • React/Vue/Svelte                    │   │   • Offline caching                     │          │ │   │
│  │   │   │   • WebGL charts                        │   │   • Background sync                     │          │ │   │
│  │   │   │   • IndexedDB for local cache           │   │   • Push notifications                  │          │ │   │
│  │   │   │                                         │   │                                         │          │ │   │
│  │   │   └─────────────────────────────────────────┘   └─────────────────────────────────────────┘          │ │   │
│  │   │                                                                                                       │ │   │
│  │   └───────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                            │                                                                │   │
│  │                                       HTTPS/WSS                                                             │   │
│  │                                            │                                                                │   │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │   │                                                                                                       │ │   │
│  │   │   EXISTING BACKEND (FastAPI)                                                                          │ │   │
│  │   │   ──────────────────────────────────────────────────────────────────────────────────────────────────  │ │   │
│  │   │                                                                                                       │ │   │
│  │   │   No changes required - same API                                                                      │ │   │
│  │   │                                                                                                       │ │   │
│  │   └───────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  Pros:                                                                                                              │
│  • No installation required                                                                                         │
│  • Works on any device with browser                                                                                 │
│  • Instant updates (no app store)                                                                                   │
│  • SEO possible for public pages                                                                                    │
│  • Can be wrapped as PWA for "app-like" experience                                                                  │
│                                                                                                                     │
│  Cons:                                                                                                              │
│  • Browser performance limits                                                                                       │
│  • No native file system access                                                                                     │
│  • Limited offline capabilities                                                                                     │
│  • WebSocket connection management                                                                                  │
│  • Complete UI rewrite required                                                                                     │
│                                                                                                                     │
│                                                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│  OPTION D: HYBRID (Qt + Embedded Web for Select Components)                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                                     │
│  Architecture:                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │   │
│  │   │                         PYSIDE6 APPLICATION (Current)                                                │ │   │
│  │   │                                                                                                      │ │   │
│  │   │   ┌──────────────────────────────────────┐  ┌──────────────────────────────────────────────────────┐ │ │   │
│  │   │   │                                      │  │                                                      │ │ │   │
│  │   │   │         NATIVE QML UI                │  │              QT WEBENGINE VIEW                       │ │ │   │
│  │   │   │                                      │  │                                                      │ │ │   │
│  │   │   │   • Shell                            │  │   • Embedded web components                          │ │ │   │
│  │   │   │   • High-perf charts (PyQtGraph)     │  │   • Strategy visualizations (D3.js)                  │ │ │   │
│  │   │   │   • Track map (OpenGL)               │  │   • Interactive reports                              │ │ │   │
│  │   │   │   • Timing tower                     │  │   • Help/documentation                               │ │ │   │
│  │   │   │                                      │  │                                                      │ │ │   │
│  │   │   │   (Performance-critical)             │  │   (Flexibility-prioritized)                          │ │ │   │
│  │   │   │                                      │  │                                                      │ │ │   │
│  │   │   └──────────────────────────────────────┘  └──────────────────────────────────────────────────────┘ │ │   │
│  │   │                                                                                                      │ │   │
│  │   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  Pros:                                                                                                              │
│  • Keep high-performance native components                                                                          │
│  • Use web tech for complex visualizations (D3.js, etc.)                                                            │
│  • Gradual migration path                                                                                           │
│  • Reuse web components across platforms later                                                                      │
│                                                                                                                     │
│  Cons:                                                                                                              │
│  • Increased bundle size (Qt WebEngine ~100MB)                                                                      │
│  • Complexity of bridging Qt <-> Web                                                                                │
│  • Two rendering pipelines to maintain                                                                              │
│                                                                                                                     │
│                                                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│  RECOMMENDED PATH                                                                                                   │
│  ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                                     │
│  Phase 1 (Now): Native Qt Desktop                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Focus on:                                                                                                 │   │
│  │   • Shipping v1.0 with PySide6 + QML + PyQtGraph                                                            │   │
│  │   • Proving the UX and feature set                                                                          │   │
│  │   • Building user base                                                                                      │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  Phase 2 (Later): Evaluate Web/Electron Based on Needs                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   If primary need is...           │ Recommended path                                                        │   │
│  │   ────────────────────────────────┼───────────────────────────────────────────────────────────────────────  │   │
│  │   Wider distribution (no install) │ Web app (Option C) or PWA                                               │   │
│  │   Easier updates + web skills     │ Electron (Option A)                                                     │   │
│  │   Smaller bundle + performance    │ Tauri (Option B)                                                        │   │
│  │   Gradual migration               │ Hybrid Qt+Web (Option D)                                                │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Testing Strategy (Refined)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          TESTING STRATEGY                                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  TEST PYRAMID                                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │                                    ╱╲                                                                       │   │
│  │                                   ╱  ╲                                                                      │   │
│  │                                  ╱ E2E╲        5-10 tests                                                   │   │
│  │                                 ╱──────╲       • Full app smoke tests                                       │   │
│  │                                ╱        ╲      • Critical user journeys                                     │   │
│  │                               ╱Integration╲    20-50 tests                                                  │   │
│  │                              ╱────────────╲    • View rendering                                             │   │
│  │                             ╱              ╲   • Store + API integration                                    │   │
│  │                            ╱      Unit      ╲  200+ tests                                                   │   │
│  │                           ╱──────────────────╲ • Store logic                                                │   │
│  │                          ╱                    ╲• Data transforms                                            │   │
│  │                         ╱                      ╲• Utilities                                                 │   │
│  │                        ╱────────────────────────╲                                                           │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  TEST CATEGORIES                                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Category          │ Tool              │ Target                           │ Frequency                     │   │
│  │   ──────────────────┼───────────────────┼──────────────────────────────────┼─────────────────────────────  │   │
│  │   Unit (Python)     │ pytest            │ Stores, services, utilities      │ Every commit                  │   │
│  │   Unit (QML)        │ Qt Quick Test     │ Component logic                  │ Every commit                  │   │
│  │   Integration       │ pytest-qt         │ Widget integration               │ Every commit                  │   │
│  │   Visual Regression │ pytest + PIL      │ Chart rendering                  │ PR merges                     │   │
│  │   E2E               │ pytest-qt + Robot │ Full app flows                   │ Nightly                       │   │
│  │   Performance       │ Custom harness    │ Rendering, memory                │ Weekly                        │   │
│  │   Accessibility     │ Axe + manual      │ A11y compliance                  │ Major releases                │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  GOLDEN TESTS (Visual Regression)                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Test Name                         │ What It Captures                    │ Tolerance                      │   │
│  │   ──────────────────────────────────┼─────────────────────────────────────┼─────────────────────────────── │   │
│  │   timing_tower_20_drivers           │ Full tower layout + colors          │ 0.1%                           │   │
│  │   telemetry_2_drivers_5_channels    │ Chart stack rendering               │ 0.5%                           │   │
│  │   track_map_bahrain                 │ Track geometry + car positions      │ 0.2%                           │   │
│  │   delta_chart_positive_negative     │ Zero line + color coding            │ 0.3%                           │   │
│  │   strategy_stint_timeline           │ Tyre colors + pit markers           │ 0.2%                           │   │
│  │                                                                                                             │   │
│  │   Golden images stored in: tests/golden/                                                                    │   │
│  │   Updated via: pytest --update-golden                                                                       │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Packaging + Distribution (Refined)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      PACKAGING + DISTRIBUTION                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  BUILD MATRIX                                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Platform       │ Architecture  │ Format              │ Signing          │ Distribution                   │   │
│  │   ───────────────┼───────────────┼─────────────────────┼──────────────────┼─────────────────────────────── │   │
│  │   macOS          │ arm64 (M1+)   │ .app + .dmg         │ Apple notarized  │ GitHub Releases + direct       │   │
│  │   macOS          │ x86_64        │ .app + .dmg         │ Apple notarized  │ GitHub Releases + direct       │   │
│  │   Windows        │ x86_64        │ .exe (NSIS)         │ Code signing     │ GitHub Releases + direct       │   │
│  │   Linux (opt)    │ x86_64        │ .AppImage           │ N/A              │ GitHub Releases                │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PYINSTALLER CONFIGURATION                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Bundle Contents:                                                                                          │   │
│  │   ─────────────────────────────────────────────────────────────────────────────────────────────             │   │
│  │   • Python runtime (embedded)                                                                               │   │
│  │   • PySide6 libraries + Qt plugins                                                                          │   │
│  │   • QML files + assets                                                                                      │   │
│  │   • Application Python modules                                                                              │   │
│  │   • DuckDB + httpx dependencies                                                                             │   │
│  │                                                                                                             │   │
│  │   Optimization:                                                                                             │   │
│  │   ─────────────────────────────────────────────────────────────────────────────────────────────             │   │
│  │   • UPX compression (optional, may break on macOS)                                                          │   │
│  │   • Exclude unused Qt modules (Qt3D, QtBluetooth, etc.)                                                     │   │
│  │   • Strip debug symbols                                                                                     │   │
│  │   • Tree-shake unused Python imports                                                                        │   │
│  │                                                                                                             │   │
│  │   Expected sizes:                                                                                           │   │
│  │   • macOS: ~200MB (compressed DMG: ~80MB)                                                                   │   │
│  │   • Windows: ~180MB (installer: ~70MB)                                                                      │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  CI/CD PIPELINE                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │   │
│  │   │   Commit    │────▶│    Lint     │────▶│    Test     │────▶│    Build    │────▶│   Release   │          │   │
│  │   └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘          │   │
│  │                                                                                                             │   │
│  │   Lint:                                                                                                     │   │
│  │   • ruff (Python linting)                                                                                   │   │
│  │   • mypy (type checking)                                                                                    │   │
│  │   • qmllint (QML validation)                                                                                │   │
│  │                                                                                                             │   │
│  │   Test:                                                                                                     │   │
│  │   • pytest --cov (unit + integration)                                                                       │   │
│  │   • Visual regression on Linux runner                                                                       │   │
│  │                                                                                                             │   │
│  │   Build:                                                                                                    │   │
│  │   • Matrix: [macos-14, macos-13, windows-2022]                                                              │   │
│  │   • PyInstaller bundle                                                                                      │   │
│  │   • Code signing (secrets stored in CI)                                                                     │   │
│  │                                                                                                             │   │
│  │   Release:                                                                                                  │   │
│  │   • Tag-triggered                                                                                           │   │
│  │   • Upload to GitHub Releases                                                                               │   │
│  │   • Generate changelog                                                                                      │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  AUTO-UPDATE STRATEGY (v2)                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Options:                                                                                                  │   │
│  │   ───────────────────────────────────────────────────────────────────────────────────────────────────────   │   │
│  │   • Sparkle (macOS) - native, well-established                                                              │   │
│  │   • WinSparkle (Windows) - Sparkle port                                                                     │   │
│  │   • Custom (check GitHub API for new releases)                                                              │   │
│  │                                                                                                             │   │
│  │   Flow:                                                                                                     │   │
│  │   1. App checks for update on startup (or periodic)                                                         │   │
│  │   2. If new version available, show non-blocking notification                                               │   │
│  │   3. User clicks "Update" → download in background                                                          │   │
│  │   4. Prompt to restart when ready                                                                           │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Phased Delivery Plan (Refined)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        PHASED DELIVERY PLAN                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  PHASE 0: FOUNDATIONS (3-4 days)                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ Repository structure with pyproject.toml                                                                │   │
│  │   ☐ PySide6 + QML hello world running                                                                       │   │
│  │   ☐ Design tokens implemented in Theme.qml                                                                  │   │
│  │   ☐ Shell layout: TopBar + Sidebar + Content area + Playback bar                                            │   │
│  │   ☐ Basic navigation between empty view stubs                                                               │   │
│  │   ☐ CI pipeline: lint + test + build (no release yet)                                                       │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ App launches on macOS and Windows                                                                       │   │
│  │   ✓ Can navigate between all 6 views                                                                        │   │
│  │   ✓ Theme colors applied consistently                                                                       │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 1: DATA LAYER + SESSION BROWSER (3-4 days)                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ Typed API client (httpx + Pydantic models)                                                              │   │
│  │   ☐ DuckDB cache layer for session index                                                                    │   │
│  │   ☐ Session selector dropdown in TopBar                                                                     │   │
│  │   ☐ Session list in sidebar with search                                                                     │   │
│  │   ☐ Connection status indicator                                                                             │   │
│  │   ☐ Error handling with retry UI                                                                            │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ Can browse and select sessions from API                                                                 │   │
│  │   ✓ Sessions cached locally, work offline                                                                   │   │
│  │   ✓ Network errors handled gracefully                                                                       │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 2: TIMING TOWER (4-6 days)                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ TimingStore with standings data                                                                         │   │
│  │   ☐ Virtualized table component (QML ListView)                                                              │   │
│  │   ☐ Sticky header with column labels                                                                        │   │
│  │   ☐ Team color bar per row                                                                                  │   │
│  │   ☐ Sector time color coding (PB/SB/normal)                                                                 │   │
│  │   ☐ Gap and interval formatting                                                                             │   │
│  │   ☐ Row selection (primary + compare)                                                                       │   │
│  │   ☐ Position change animation                                                                               │   │
│  │   ☐ Driver list in sidebar synced with tower                                                                │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ Tower displays all 20 drivers correctly                                                                 │   │
│  │   ✓ Can select primary and compare drivers                                                                  │   │
│  │   ✓ Sector colors match broadcast                                                                           │   │
│  │   ✓ Smooth scrolling + animations                                                                           │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 3: TELEMETRY CHARTS (5-8 days)                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ TelemetryStore with channel data + downsampling                                                         │   │
│  │   ☐ PyQtGraph chart widget embedded in QML                                                                  │   │
│  │   ☐ Stacked charts: Speed, Throttle, Brake, Gear, DRS                                                       │   │
│  │   ☐ Synced X-axis across all charts                                                                         │   │
│  │   ☐ Synced cursor with value readouts                                                                       │   │
│  │   ☐ Primary + compare driver rendering                                                                      │   │
│  │   ☐ Time/Distance axis toggle                                                                               │   │
│  │   ☐ Zoom/pan with mouse                                                                                     │   │
│  │   ☐ Delta chart (zero-emphasis)                                                                             │   │
│  │   ☐ LOD system for large datasets                                                                           │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ Charts render at 60fps with 2 drivers                                                                   │   │
│  │   ✓ Cursor tracking < 16ms latency                                                                          │   │
│  │   ✓ Can compare two drivers visually                                                                        │   │
│  │   ✓ Works with full race telemetry                                                                          │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 4: TRACK MAP + PLAYBACK (4-6 days)                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ TrackStore with geometry + positions                                                                    │   │
│  │   ☐ Track centerline rendering (QML Canvas or OpenGL)                                                       │   │
│  │   ☐ Car position dots with team colors                                                                      │   │
│  │   ☐ Selected car highlighting                                                                               │   │
│  │   ☐ Hover tooltips on cars                                                                                  │   │
│  │   ☐ PlaybackStore with clock + rate control                                                                 │   │
│  │   ☐ Playback bar controls (play/pause/seek/rate)                                                            │   │
│  │   ☐ Timeline scrubbing synced to all views                                                                  │   │
│  │   ☐ Lap markers on timeline                                                                                 │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ Track map shows all 20 cars                                                                             │   │
│  │   ✓ Cars move smoothly during playback                                                                      │   │
│  │   ✓ Seeking updates all views instantly                                                                     │   │
│  │   ✓ Playback rates work correctly                                                                           │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 5: COMPARE VIEW (3-5 days)                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ Driver A / Driver B selection panels                                                                    │   │
│  │   ☐ Lap selector dropdowns                                                                                  │   │
│  │   ☐ Overlay speed chart                                                                                     │   │
│  │   ☐ Cumulative delta chart                                                                                  │   │
│  │   ☐ Sector breakdown table                                                                                  │   │
│  │   ☐ Key differences summary                                                                                 │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ Can compare any two laps                                                                                │   │
│  │   ✓ Delta shows where time is gained/lost                                                                   │   │
│  │   ✓ Sector times highlight faster driver                                                                    │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 6: STRATEGY VIEW (4-6 days)                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ StrategyStore with stint data                                                                           │   │
│  │   ☐ Stint timeline chart (horizontal bars)                                                                  │   │
│  │   ☐ Tyre compound colors + lap counts                                                                       │   │
│  │   ☐ Pit stop markers                                                                                        │   │
│  │   ☐ Pit stop table                                                                                          │   │
│  │   ☐ Undercut predictor UI                                                                                   │   │
│  │   ☐ Scenario inputs (attacker, defender, gap, tyre)                                                         │   │
│  │   ☐ Prediction result display                                                                               │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ Stint timeline matches broadcast look                                                                   │   │
│  │   ✓ Can run undercut predictions                                                                            │   │
│  │   ✓ Predictions return within 500ms                                                                         │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 7: POLISH + EXPORT (4-6 days)                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ Settings view with all options                                                                          │   │
│  │   ☐ Theme switching (dark/light)                                                                            │   │
│  │   ☐ Export dialog (PNG/PDF/CSV)                                                                             │   │
│  │   ☐ Command palette (⌘K)                                                                                    │   │
│  │   ☐ Keyboard shortcuts for all major actions                                                                │   │
│  │   ☐ Accessibility pass (focus rings, tab order)                                                             │   │
│  │   ☐ Panel popout to separate windows                                                                        │   │
│  │   ☐ Workspace layout persistence                                                                            │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ All settings functional                                                                                 │   │
│  │   ✓ Export works for all views                                                                              │   │
│  │   ✓ Keyboard-only navigation possible                                                                       │   │
│  │   ✓ Multi-monitor popouts work                                                                              │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PHASE 8: PACKAGING + RELEASE (3-5 days)                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Deliverables:                                                                                             │   │
│  │   ☐ PyInstaller spec finalized                                                                              │   │
│  │   ☐ macOS code signing + notarization                                                                       │   │
│  │   ☐ Windows code signing                                                                                    │   │
│  │   ☐ DMG and NSIS installers                                                                                 │   │
│  │   ☐ GitHub Actions release workflow                                                                         │   │
│  │   ☐ Release notes template                                                                                  │   │
│  │   ☐ User documentation (README, getting started)                                                            │   │
│  │   ☐ Smoke test checklist                                                                                    │   │
│  │                                                                                                             │   │
│  │   Exit Criteria:                                                                                            │   │
│  │   ✓ v1.0.0 released on GitHub                                                                               │   │
│  │   ✓ Installers work on fresh systems                                                                        │   │
│  │   ✓ No code signing warnings                                                                                │   │
│  │   ✓ Documentation published                                                                                 │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  TIMELINE SUMMARY                                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   Phase    │ Duration  │ Cumulative │ Key Milestone                                                        │   │
│  │   ─────────┼───────────┼────────────┼────────────────────────────────────────────────────────────────────  │   │
│  │   Phase 0  │ 3-4 days  │ Week 1     │ App shell running                                                    │   │
│  │   Phase 1  │ 3-4 days  │ Week 1-2   │ Can browse sessions                                                  │   │
│  │   Phase 2  │ 4-6 days  │ Week 2-3   │ Timing tower complete                                                │   │
│  │   Phase 3  │ 5-8 days  │ Week 3-4   │ Telemetry charts working                                             │   │
│  │   Phase 4  │ 4-6 days  │ Week 5     │ Track map + playback                                                 │   │
│  │   Phase 5  │ 3-5 days  │ Week 5-6   │ Compare view                                                         │   │
│  │   Phase 6  │ 4-6 days  │ Week 6-7   │ Strategy view                                                        │   │
│  │   Phase 7  │ 4-6 days  │ Week 7-8   │ Polish + export                                                      │   │
│  │   Phase 8  │ 3-5 days  │ Week 8-9   │ v1.0.0 RELEASE                                                       │   │
│  │   ─────────┼───────────┼────────────┼────────────────────────────────────────────────────────────────────  │   │
│  │   TOTAL    │ 33-50 days│ 8-10 weeks │                                                                      │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Final Checklist

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            FINAL CHECKLIST                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  PRE-DEVELOPMENT                                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ Repository created with proper structure                                                                │   │
│  │   ☐ Development environment documented                                                                      │   │
│  │   ☐ Backend API endpoints verified working                                                                  │   │
│  │   ☐ Design tokens finalized                                                                                 │   │
│  │   ☐ Team color palette confirmed for current season                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  ARCHITECTURE                                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ Reactive store pattern implemented                                                                      │   │
│  │   ☐ QML ↔ Python bridge working                                                                             │   │
│  │   ☐ Thread safety verified for worker operations                                                            │   │
│  │   ☐ Memory management strategy implemented                                                                  │   │
│  │   ☐ Error boundary system in place                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  UI/UX                                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ All design tokens applied                                                                               │   │
│  │   ☐ Typography scale consistent                                                                             │   │
│  │   ☐ Color contrast meets WCAG AA                                                                            │   │
│  │   ☐ Focus indicators visible                                                                                │   │
│  │   ☐ Keyboard navigation complete                                                                            │   │
│  │   ☐ Loading states for all async operations                                                                 │   │
│  │   ☐ Error states graceful                                                                                   │   │
│  │   ☐ Animations smooth (60fps)                                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PERFORMANCE                                                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ Cold start < 2s                                                                                         │   │
│  │   ☐ Chart interactions 60fps                                                                                │   │
│  │   ☐ Memory usage < 1.5GB (long session)                                                                     │   │
│  │   ☐ CPU idle < 2%                                                                                           │   │
│  │   ☐ LOD system working for large datasets                                                                   │   │
│  │   ☐ Downsampling produces accurate results                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  DATA                                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ All Pydantic models match API responses                                                                 │   │
│  │   ☐ Cache invalidation working                                                                              │   │
│  │   ☐ Offline mode functional for cached data                                                                 │   │
│  │   ☐ Error retry logic tested                                                                                │   │
│  │   ☐ WebSocket reconnection handled                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  TESTING                                                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ Unit test coverage > 70%                                                                                │   │
│  │   ☐ Integration tests for all views                                                                         │   │
│  │   ☐ Visual regression baselines captured                                                                    │   │
│  │   ☐ E2E smoke tests passing                                                                                 │   │
│  │   ☐ Performance benchmarks recorded                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  PACKAGING                                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ macOS build tested on Intel and Apple Silicon                                                           │   │
│  │   ☐ Windows build tested on Windows 10/11                                                                   │   │
│  │   ☐ Code signing verified (no warnings)                                                                     │   │
│  │   ☐ Installer tested on fresh systems                                                                       │   │
│  │   ☐ Uninstall works cleanly                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  DOCUMENTATION                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │   ☐ README with installation instructions                                                                   │   │
│  │   ☐ Keyboard shortcut reference                                                                             │   │
│  │   ☐ Troubleshooting guide                                                                                   │   │
│  │   ☐ Architecture documentation for contributors                                                             │   │
│  │   ☐ Changelog for v1.0.0                                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Document Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           DOCUMENT SUMMARY                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                     │
│  This document defines the complete architecture for TelemetryX Desktop v1.0:                                      │
│                                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   PART 1: Executive Overview + Refinement Philosophy                                                        │   │
│  │   • "Best-in-class" Python GUI principles                                                                   │   │
│  │   • Stack decision matrix                                                                                   │   │
│  │   • Quality attributes                                                                                      │   │
│  │                                                                                                             │   │
│  │   PART 2: System Architecture (Deep)                                                                        │   │
│  │   • Layer diagram (Presentation → Application → Data → Infrastructure)                                      │   │
│  │   • Reactive state management system                                                                        │   │
│  │   • Data layer with caching strategy                                                                        │   │
│  │   • Threading model (main + workers + GPU)                                                                  │   │
│  │   • Communication patterns                                                                                  │   │
│  │   • Error handling architecture                                                                             │   │
│  │   • Plugin system design                                                                                    │   │
│  │   • Complete directory structure                                                                            │   │
│  │                                                                                                             │   │
│  │   PART 3: UI Architecture + Design System                                                                   │   │
│  │   • Design tokens (colors, typography, spacing)                                                             │   │
│  │   • Atomic component hierarchy (atoms → molecules → organisms)                                              │   │
│  │   • Layout system (shell, grid, breakpoints)                                                                │   │
│  │   • Theming engine                                                                                          │   │
│  │   • Animation system                                                                                        │   │
│  │   • Accessibility (keyboard, screen reader, contrast)                                                       │   │
│  │                                                                                                             │   │
│  │   PART 4: Complete Wireframes                                                                               │   │
│  │   • Application shell (TopBar, Sidebar, Playback bar)                                                       │   │
│  │   • Timing View                                                                                             │   │
│  │   • Telemetry View                                                                                          │   │
│  │   • Track View                                                                                              │   │
│  │   • Compare View                                                                                            │   │
│  │   • Strategy View                                                                                           │   │
│  │   • Settings View                                                                                           │   │
│  │   • Modals and dialogs                                                                                      │   │
│  │                                                                                                             │   │
│  │   PART 5: Advanced Topics + Distribution                                                                    │   │
│  │   • GPU rendering pipeline                                                                                  │   │
│  │   • Performance optimization strategies                                                                     │   │
│  │   • Offline-first architecture                                                                              │   │
│  │   • Electron/Tauri/Web wrapping options                                                                     │   │
│  │   • Testing strategy                                                                                        │   │
│  │   • Packaging + distribution                                                                                │   │
│  │   • Phased delivery plan (8-10 weeks)                                                                       │   │
│  │   • Final checklist                                                                                         │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  NEXT STEPS:                                                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                             │   │
│  │   1. Review and approve this architecture                                                                   │   │
│  │   2. Set up repository with Phase 0 structure                                                               │   │
│  │   3. Begin implementation following phased plan                                                             │   │
│  │   4. Regular checkpoints at each phase completion                                                           │   │
│  │   5. Evaluate Electron/Web path after v1.0 release                                                          │   │
│  │                                                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                     │
│  VERSION: 2.0 (Refined)                                                                                             │
│  LAST UPDATED: January 2025                                                                                         │
│  STATUS: Ready for Implementation                                                                                   │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

**End of Part 5. Document Complete.**

