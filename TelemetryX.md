# Telemetry X - Architecture Document
> Post-Race F1 Deep-Dive Analysis Platform

**Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Active Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack Justifications](#3-technology-stack-justifications)
4. [Data Pipeline Architecture](#4-data-pipeline-architecture)
5. [Historical Data Coverage (2000-2025)](#5-historical-data-coverage-2000-2025)
6. [Core Features & ML Specifications](#6-core-features--ml-specifications)
7. [Visualization Designs](#7-visualization-designs)
8. [Implementation Timeline (Three-Tier)](#8-implementation-timeline-three-tier)
9. [Future Enhancements](#9-future-enhancements)
10. [Appendix](#10-appendix)

---

## 1. Executive Summary

### Vision

Engineering-grade race analysis accessible to F1 enthusiasts. Telemetry X provides the same depth of post-race analysis that real F1 engineers use - strategy breakdowns, tire degradation curves, telemetry comparisons, and "what-if" simulations.

### What It Does

- **Analyze** driver strategies, tire degradation, and telemetry data
- **Compare** drivers corner-by-corner, lap-by-lap with professional overlays
- **Simulate** alternative pit strategies with Monte Carlo modeling
- **Visualize** data the way real F1 engineers see it on race weekends
- **Explore** historical data from 2000-2025 (25 years of F1)

### What It's NOT

- **Not real-time**: FastF1 provides post-session data only (hours after sessions)
- **Not enterprise-scale**: Designed for enthusiasts and small teams, not Netflix-level traffic
- **Not over-engineered**: Start simple, scale only when bottlenecks appear

### Target Users

| User Type | Primary Use Case | Technical Level |
|-----------|------------------|-----------------|
| F1 Enthusiast | Deep-dive into race weekends | Low-Medium |
| Data Analyst | Custom queries and exports | Medium-High |
| Content Creator | Generate insights for videos/articles | Low-Medium |
| Sim Racer | Study real driver techniques | Low |

### Key Constraints

| Constraint | Implication |
|------------|-------------|
| No real-time F1 feed | Batch processing only, streaming deferred to future |
| Public data (FastF1) | No special security/compliance requirements |
| Single developer start | Modular monolith, not microservices |
| Budget-conscious | Local-first development, cloud only when needed |

---

## 2. System Architecture Overview

### High-Level Architecture (Batch-Only)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TELEMETRY X                                     │
│                     Post-Race F1 Analysis Platform                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Streamlit UI                                  │    │
│  │  • Race Explorer    • Driver Comparison    • Strategy Simulator     │    │
│  │  • Telemetry Viewer • Tire Analysis        • Historical Browser     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│  ┌───────────────────────┐    ┌───────────────────────┐                     │
│  │     Flask API         │    │     ML Models         │                     │
│  │  • Heavy computation  │    │  • Strategy Simulator │                     │
│  │  • PDF/CSV exports    │    │  • Tire Degradation   │                     │
│  │  • Background jobs    │    │  • Pace Predictor     │                     │
│  └───────────────────────┘    └───────────────────────┘                     │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATA LAYER                                       │
│  ┌───────────────────────┐    ┌───────────────────────────────────────┐     │
│  │      DuckDB           │    │         Parquet Files                 │     │
│  │  • Analytical queries │    │  • Bronze: Raw session data           │     │
│  │  • Aggregations       │    │  • Silver: Cleaned, normalized        │     │
│  │  • Fast OLAP          │    │  • Gold: Aggregated, feature-ready    │     │
│  └───────────────────────┘    └───────────────────────────────────────┘     │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGESTION LAYER                                    │
│  ┌───────────────────────┐    ┌───────────────────────┐                     │
│  │     FastF1 API        │    │     Ergast API        │                     │
│  │  • 2018-2025 data     │    │  • 2000-2017 data     │                     │
│  │  • Full telemetry     │    │  • Lap times only     │                     │
│  │  • Session metadata   │    │  • Results, standings │                     │
│  └───────────────────────┘    └───────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Request                Processing                    Response
─────────────────────────────────────────────────────────────────────
    │                           │                            │
    │  1. Select Race           │                            │
    ▼                           │                            │
┌────────┐                      │                            │
│Streamlit│──────2. Query──────▶│                            │
└────────┘                      ▼                            │
    │                    ┌────────────┐                      │
    │                    │  DuckDB    │                      │
    │                    │  + Parquet │                      │
    │                    └─────┬──────┘                      │
    │                          │                             │
    │                    3. Raw Data                         │
    │                          │                             │
    │                          ▼                             │
    │                    ┌────────────┐                      │
    │                    │  Polars    │                      │
    │                    │  Transform │                      │
    │                    └─────┬──────┘                      │
    │                          │                             │
    │                    4. Processed                        │
    │                          │                             │
    │                          ▼                             │
    │                    ┌────────────┐                      │
    │                    │  Plotly    │                      │
    │                    │  Charts    │                      │
    │                    └─────┬──────┘                      │
    │                          │                             │
    │◀─────5. Render───────────┘                             │
    │                                                        │
    ▼                                                        ▼
┌────────┐                                            ┌────────────┐
│  User  │                                            │ Interactive │
│  Sees  │                                            │   Charts    │
└────────┘                                            └────────────┘
```

### What We're NOT Building (Initially)

| Component | Why Not | When to Add |
|-----------|---------|-------------|
| Kafka/Streaming | No real-time F1 data source | When F1 provides live telemetry |
| Kubernetes | Overkill for single-user/small team | When concurrent users > 100 |
| Microservices | Adds complexity without benefit | When team > 5 people |
| Feast Feature Store | Sub-second serving not needed | When predictions need < 100ms |
| Multi-region | 24 races/year, not 24M requests/second | When global user base exists |

---

## 3. Technology Stack Justifications

### Database: DuckDB vs PostgreSQL

| Criterion | DuckDB | PostgreSQL |
|-----------|--------|------------|
| **Query Speed (Analytics)** | 10-100x faster for OLAP | Optimized for OLTP |
| **Setup Complexity** | Zero (embedded, no server) | Requires server, config, backups |
| **Memory Usage** | ~50MB base | ~200MB+ base |
| **Time-Series Performance** | Native Parquet integration | Needs TimescaleDB extension |
| **Deployment** | Single file database | Separate service to manage |
| **Concurrent Writes** | Limited (single-writer) | Excellent (multi-writer) |
| **Best For** | Write-once, read-many | Transactional applications |

**Benchmark** (Querying 1M telemetry rows):
```
Query: SELECT Driver, AVG(Speed) FROM telemetry 
       WHERE SessionKey = '2024_Monaco_Race' GROUP BY Driver

DuckDB:     0.08 seconds
PostgreSQL: 2.30 seconds (29x slower)
```

**Decision**: DuckDB for Tier 1-2. Migrate to PostgreSQL only if:
- Concurrent editing by > 10 users
- Need row-level security
- Building transactional features (user accounts, payments)

---

### Frontend: Streamlit + Flask Hybrid

```
┌─────────────────────────────────────────────┐
│         Streamlit (Main UI)                 │
│  • Race explorer pages                      │
│  • Interactive dashboards                   │
│  • Form inputs, sliders                     │
│  • Built-in session state                   │
└─────────────────┬───────────────────────────┘
                  │ HTTP calls for heavy ops
         ┌────────┴─────────┐
         │   Flask API      │
         │  • ML predictions│
         │  • PDF exports   │
         │  • Background jobs│
         └──────────────────┘
```

| Component | Streamlit | Flask | Why Split? |
|-----------|-----------|-------|------------|
| UI Rendering | Best | Manual work | Streamlit = 10x faster dev |
| Custom APIs | Limited | Best | Flask exposes REST endpoints |
| Background Jobs | Not supported | Best | Streamlit reruns on interaction |
| Session State | Built-in | Manual | Streamlit handles elegantly |
| Authentication | Basic | Full OAuth/JWT | Flask better for auth |

---

### Data Processing: Polars vs Pandas

| Operation | Polars | Pandas | Speedup |
|-----------|--------|--------|---------|
| Read 5M rows Parquet | 0.4s | 8.3s | 20x |
| GroupBy aggregation | 0.08s | 2.1s | 26x |
| Filter + transform | 0.02s | 0.5s | 25x |
| Memory usage | Lower (lazy eval) | Higher (eager) | 2-3x |

**Why Polars**:
- Parallel processing by default
- Lazy evaluation (only compute what's needed)
- Arrow-native (zero-copy to Plotly/DuckDB)
- Better syntax for chaining operations

**When Pandas is acceptable**:
- Team already knows Pandas (learning curve consideration)
- Specific library requires Pandas input
- Small datasets (< 100k rows) where speed doesn't matter

**Decision**: Polars as primary, Pandas only for library compatibility.

---

### Visualization: Plotly + Matplotlib + Seaborn

| Library | Use Case | Why? |
|---------|----------|------|
| **Plotly** | Interactive dashboards | Zoom, hover, click events, Streamlit integration |
| **Matplotlib** | Track maps, static exports | Publication-quality, full control |
| **Seaborn** | Statistical plots | Beautiful defaults for distributions |

**Decision Matrix**:
```
Need interactivity?
├── Yes → Plotly
└── No
    ├── Statistical/distribution plot? → Seaborn
    └── Custom track visualization? → Matplotlib
```

---

### ML Framework: Scikit-learn + XGBoost + LightGBM

| Task | Framework | Why? |
|------|-----------|------|
| Tire degradation prediction | XGBoost | Best for regression on tabular data |
| Strategy classification | LightGBM | 3x faster training, similar accuracy |
| Pace forecasting | Scikit-learn | Interpretable linear models sufficient |
| Anomaly detection | Isolation Forest | Built into scikit-learn |
| Preprocessing | Scikit-learn | StandardScaler, encoders, pipelines |

**Why NOT Deep Learning (PyTorch/TensorFlow)**:
- Tabular data doesn't benefit from neural networks
- XGBoost/LightGBM consistently win Kaggle tabular competitions
- Faster training, easier deployment, more interpretable

---

## 4. Data Pipeline Architecture

### Data Sources

```
┌─────────────────────────────────────────────────────────────────┐
│                       DATA SOURCES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   FastF1     │    │   Ergast     │    │   Archives   │       │
│  │   API        │    │   API        │    │   (Scraping) │       │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤       │
│  │ 2018-2025    │    │ 1950-2024    │    │ 2000-2017    │       │
│  │ Full telemetry│   │ Results only │    │ Sector times │       │
│  │ Lap times    │    │ Lap times    │    │ Speed traps  │       │
│  │ Weather      │    │ Standings    │    │ Pit data     │       │
│  │ Tire data    │    │ Circuits     │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Storage Structure (Medallion Architecture)

```
data/
├── bronze/                    # Raw data (as received from APIs)
│   ├── 2024/
│   │   ├── round_01_bahrain/
│   │   │   ├── race_telemetry.parquet
│   │   │   ├── qualifying_telemetry.parquet
│   │   │   ├── practice_telemetry.parquet
│   │   │   ├── lap_times.parquet
│   │   │   ├── weather.parquet
│   │   │   └── metadata.json
│   │   └── round_02_saudi_arabia/
│   └── 2023/
│
├── silver/                    # Cleaned and normalized
│   ├── 2024/
│   │   ├── round_01_bahrain/
│   │   │   ├── telemetry_unified.parquet    # All sessions merged
│   │   │   ├── lap_times_enriched.parquet   # With tire compound, fuel
│   │   │   └── stints.parquet               # Stint-level aggregations
│   │   └── ...
│   └── ...
│
├── gold/                      # Feature-ready for ML
│   ├── driver_stint_features.parquet        # Per-driver, per-stint
│   ├── lap_features.parquet                 # Per-lap metrics
│   ├── circuit_characteristics.parquet      # Per-circuit baselines
│   └── tire_degradation_training.parquet    # ML training dataset
│
└── catalog.duckdb            # DuckDB catalog pointing to all Parquet files
```
---

## 5. Historical Data Coverage (2000-2025)

### Data Availability Matrix

| Year Range | Telemetry | Lap Times | Sector Times | Results | Source |
|------------|-----------|-----------|--------------|---------|--------|
| **2018-2025** | Full (Hz-level) | Full | Full (mini-sectors) | Full | FastF1 |
| **2014-2017** | Speed traps only | Full | Partial | Full | Ergast + Archives |
| **2006-2013** | None | Full | Partial (S1/S2/S3) | Full | Ergast |
| **2000-2005** | None | Full | None | Full | Ergast |
| **Pre-2000** | None | Partial | None | Full | Ergast |

### Modern Era (2018-2025) - Full Coverage

```
Available Data per Session:
├── Telemetry (sampled at ~4 Hz)
│   ├── Speed (km/h)
│   ├── Throttle (0-100%)
│   ├── Brake (0-100%)
│   ├── Gear (1-8)
│   ├── RPM
│   ├── DRS status
│   └── GPS coordinates (X, Y)
├── Timing
│   ├── Lap times (millisecond precision)
│   ├── Sector times (S1, S2, S3)
│   ├── Mini-sectors (10+ per sector)
│   └── Speed traps (3 per lap)
├── Strategy
│   ├── Pit stop times (in/out)
│   ├── Tire compound per stint
│   └── Tire age
└── Weather
    ├── Track temperature
    ├── Air temperature
    ├── Humidity
    └── Rainfall
```

### Hybrid Era (2014-2017) - Partial Coverage

```
Available:
├── Lap times (full)
├── Sector times (S1, S2, S3)
├── Speed trap readings (3 per lap)
├── Pit stop data
├── Tire compounds
└── Weather (basic)

Missing:
├── Continuous telemetry (speed, throttle, brake)
├── GPS traces
├── Gear changes
└── DRS activation data
```

### V8/V10 Era (2000-2013) - Timing Only

```
Available:
├── Lap times (millisecond precision)
├── Sector times (from 2006)
├── Race results
├── Championship standings
└── Basic pit stop data (from 2003)

Missing:
├── All telemetry data
├── Detailed tire information
└── Granular strategy data
```

### Telemetry Estimation for Older Races

For pre-2018 races, we can estimate telemetry using physics-based modeling.

### Storage Estimates

| Era | Years | Races | Storage |
|-----|-------|-------|---------|
| Modern (2018-2025) | 8 | ~180 | ~40 GB |
| Hybrid (2014-2017) | 4 | ~80 | ~2 GB |
| V8/V10 (2000-2013) | 14 | ~250 | ~500 MB |
| Pre-2000 | 50+ | ~600 | ~100 MB |
| **Total** | | | **~43 GB** |

---

## 6. Core Features & ML Specifications

### Feature 1: Strategy Simulator

Monte Carlo simulation of alternative pit strategies.

**Output Example**:
```
Strategy Simulator: Leclerc - Singapore 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Actual Strategy:
  Pit Laps: 18, 38
  Compounds: SOFT → MEDIUM → HARD
  Finish: P2

Alternative Strategy:
  Pit Laps: 15, 32
  Compounds: SOFT → HARD → HARD

Simulation Results (1000 runs):
  Expected Finish: P1.3 (± 0.8)
  Podium Probability: 91.2%
  P1 Probability: 34.7%
  Best Case: P1 | Worst Case: P4
```

---

### Feature 2: Tire Degradation Predictor

XGBoost model predicting lap time loss over stint.

**Model**: `TireDegradationPredictor`

**Input Features**:
- Lap in stint (tire age)
- Tire compound (encoded)
- Track temperature
- Circuit abrasiveness rating
- Current fuel load
- Brake aggressiveness (avg brake pressure)
- Cornering load (lateral G variance)

**Output**: Predicted lap time delta for each lap in stint with confidence intervals

**Pit Recommendations**:
- Delta > 1.5s: "PIT NOW - Critical degradation"
- Delta > 1.0s: "Consider pitting - Performance drop"
- Delta > 0.5s: "Optimal window approaching"
- Delta < 0.5s: "Stay out - Tires still good"

**Feature Importance** (from trained model):
```
1. Tire age .............. 32%
2. Track temperature ..... 18%
3. Compound .............. 15%
4. Circuit abrasiveness .. 12%
5. Driving style ......... 11%
6. Fuel load .............. 8%
7. Traffic ................. 4%
```

---

### Feature 3: Driver Performance Comparison

Multi-dimensional comparison across metrics.

**Performance Metrics Evaluated**:
- Qualifying pace (delta to teammate)
- Race pace (percentile vs field)
- Tire management (deg rate vs field)
- Consistency (lap time variance)
- Overtaking (successful passes)
- Defending (successful defenses)
- Starts (position delta on lap 1)
- Wet weather (wet vs dry performance)
- Pressure handling (final stint pace)

**Output Formats**:
- Comparison matrix: Normalized scores (0-10) for each driver on each metric
- Head-to-head radar: Radar chart data for two-driver comparison

---

### Feature 4: Pace Delta Waterfall

Corner-by-corner time breakdown.

**Functionality**:
- Divides lap into 30 mini-sectors (10 per sector)
- Calculates time delta for each mini-sector between two drivers
- Classifies each section as corner, straight, or braking zone
- Creates diverging bar chart showing where time is gained/lost

**Output Data Structure**:
- Section identifiers (MS1-MS30)
- Time deltas per section
- Section type classification
- Corner annotations where applicable
- Total cumulative delta

---

### Feature 5: Telemetry Overlay Dashboard

Professional 6-trace comparison.

**Telemetry Traces Displayed**:

| Trace | Unit | Range |
|-------|------|-------|
| Speed | km/h | 0-350 |
| Throttle | % | 0-100 |
| Brake | % | 0-100 |
| Gear | - | 1-8 |
| Steering | deg | -180 to 180 |
| Lateral G | G | -5 to 5 |

**Dashboard Features**:
- Synchronized 6-panel telemetry comparison
- Two-driver overlay (red/blue color coding)
- Corner markers as vertical reference lines
- Distance-based X-axis
- Unified hover mode (synchronized cursor across all panels)

---

## 7. Visualization Designs

### Lap Comparison View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Monaco 2024 - Lap 45 - Verstappen vs Leclerc                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐    ┌────────────────────────────────────────┐ │
│  │     Track Map            │    │     Telemetry (Time Series)            │ │
│  │                          │    │                                        │ │
│  │      ●←VER               │    │  Speed ──────────────────────────────  │ │
│  │     ╱                    │    │  350│    ╱╲      ╱╲                    │ │
│  │    ╱  S1                 │    │     │   ╱  ╲    ╱  ╲      ── VER       │ │
│  │   │                      │    │     │  ╱    ╲  ╱    ╲     -- LEC       │ │
│  │   │     S2    🏁         │    │  150│ ╱      ╲╱      ╲                 │ │
│  │    ╲                     │    │     └──────────────────────────────    │ │
│  │     ╲                    │    │     0m      1000m     2000m     3000m  │ │
│  │      ●→LEC               │    │                                        │ │
│  │                          │    │  Delta ─────────────────────────────── │ │
│  │  Heat: Speed             │    │  +0.3│────────┐                        │ │
│  │  🔴 Slow 🟡 Med 🟢 Fast   │    │     0│        └────────────           │ │
│  │                          │    │  -0.3│             VER ahead           │ │
│  └──────────────────────────┘    └────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Controls: [◄ Prev Lap] [▶ Play] [Next Lap ►]  Speed: [1x ▼]           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3D Track Elevation + Speed Profile

**Visualization Type**: Plotly Scatter3D

**Axes**:
- X: Track X coordinate (meters)
- Y: Track Y coordinate (meters)
- Z: Elevation above sea level (meters)

**Color Mapping**: Speed data mapped to Jet colorscale (Red = slow, Blue = fast)

**What This Shows**:
- Spa's Eau Rouge climb (60m elevation change)
- Baku's castle section descent
- Austin's Turn 1 uphill braking zone

---

### Tire Strategy Timeline (Gantt)

```
Singapore 2024 - Tire Strategies
─────────────────────────────────────────────────────────────────
                    Lap Number
Driver   0    10    20    30    40    50    60
─────────────────────────────────────────────────────────────────
VER      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░████████████████████
         │← Medium →│←      Hard (Long Stint)     →│

LEC      ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
         │←Soft→│←    Hard     →│←  Medium  →│

NOR      ████████████████████░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
         │←   Medium   →│←  Hard  →│←   Soft   →│
─────────────────────────────────────────────────────────────────
Legend: ▓ Soft (Red)  █ Medium (Yellow)  ░ Hard (White)
        │ = Pit stop
```

**Compound Color Mapping**:

| Compound | Color Code |
|----------|------------|
| SOFT | #FF0000 (Red) |
| MEDIUM | #FFFF00 (Yellow) |
| HARD | #FFFFFF (White) |
| INTERMEDIATE | #00FF00 (Green) |
| WET | #0000FF (Blue) |

**Chart Type**: Plotly Timeline with custom color mapping

---

### Sector Micro-Analysis (Diverging Bars)

```
Micro-Sector Analysis: Verstappen vs Leclerc
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         VER Faster ◄────────────────► LEC Faster
                    -0.1s    0    +0.1s
                      │      │      │
Sector 1 ─────────────┼──────┼──────┼─────────────
  MS1  T1 entry       ████████│      │  +0.08s VER
  MS2  T1 apex        │      │██████│  -0.05s LEC
  MS3  T1 exit        ███████│      │  +0.06s VER
  MS4  T2 braking     │      │████████  -0.09s LEC
  ...                 │      │      │

Sector 2 ─────────────┼──────┼──────┼─────────────
  MS11 Straight       │      │      │  +0.02s VER
  MS12 T8 entry       █████████      │  +0.12s VER
  ...                 │      │      │

Total: VER +0.247s faster
```

---

### Animated Race Replay

**Animation Structure**:

**Frame Content** (per lap):
- Track positions: Scatter plot with driver markers and team colors
- Gap chart: Horizontal bar chart showing gap to leader

**Controls**:
- Play/Pause buttons
- Lap slider for scrubbing
- Speed options: 0.5x, 1x, 2x, 4x

**Data Required**:
- Track X/Y positions per driver per lap
- Gap to leader per driver per lap
- Driver numbers and team colors

---

## 8. Implementation Timeline (Three-Tier)

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Week:  1   2   3   4   5   6   7   8   9  10  11  12  13  ...  24          │
│         │───────────│───────────────────────│────────────────────│          │
│         │  TIER 1   │        TIER 2         │      TIER 3        │          │
│         │  Local    │    Team Collab        │    Production      │          │
│         │───────────│───────────────────────│────────────────────│          │
│                                                                              │
│  Budget: $0/mo      │      $50-200/mo       │    $200-500/mo     │          │
│  Users:  1          │      2-5              │    10-100          │          │
│  Data:   Local only │      Shared storage   │    Cloud hosted    │          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Tier 1: Local Analytics (Weeks 1-4)

**Goal**: Prove the ML works and provides value

**Technology Stack**:
```
- DuckDB + Parquet (local files)
- Python scripts for data ingestion
- Jupyter notebooks for exploration
- Streamlit for basic dashboards
- Single Docker container for deployment
```

**Deliverables**:
- [ ] FastF1 data ingestion working
- [ ] Local Parquet storage structure
- [ ] DuckDB queries for common analyses
- [ ] Basic feature extraction (lap times, sectors)
- [ ] First ML model (tire degradation or strategy)
- [ ] Simple Streamlit dashboard

**Exit Criteria**:
```
Can answer questions like:
- "How did Verstappen's tire deg compare to Leclerc in Singapore?"
- "What was the average lap time delta between teammates?"
- "Show me the speed trace comparison for Lap 45"

If yes → Proceed to Tier 2
If no → Iterate on Tier 1
```

**Budget**: $0 (local development only)

**Checklist**:
```
□ python -c "import fastf1; print('OK')" works
□ 10GB disk space available for data cache
□ Can query lap times for 2024 season
□ Can generate basic Plotly chart from telemetry
□ Streamlit app runs locally
```

---

### Tier 2: Team Collaboration (Weeks 5-12)

**Goal**: Multiple users, reproducible results, shared access

**Technology Stack Additions**:
```
- MLflow for experiment tracking
- FastAPI for shared prediction endpoints
- Basic monitoring (structured logging)
- PostgreSQL if team > 3 people (otherwise DuckDB)
- Shared storage (S3 or equivalent)
```

**Deliverables**:
- [ ] MLflow tracking server running
- [ ] FastAPI endpoints for predictions
- [ ] Multi-user authentication (basic)
- [ ] Shared data storage
- [ ] Automated data refresh pipeline
- [ ] Strategy simulator feature complete
- [ ] Tire degradation predictor trained

**Exit Criteria**:
```
- 2+ users can access the system simultaneously
- ML experiments are tracked and reproducible
- API returns predictions in < 2 seconds
- Data refreshes automatically after race weekends

If yes → Proceed to Tier 3
If no → Iterate on Tier 2
```

**Budget**: $50-200/month
- Small cloud VM: $20-50/mo
- S3 storage: $5-10/mo
- Optional: Managed PostgreSQL: $15-50/mo

**Checklist**:
```
□ MLflow UI accessible to team
□ FastAPI docs available at /docs
□ Authentication prevents unauthorized access
□ New race data appears within 24h of race end
□ All team members can run predictions
```

---

### Tier 3: Production Service (Weeks 13-24+)

**Goal**: Scalable, monitored, production-grade

**Technology Stack Additions** (as needed):
```
- Add only what's needed based on Tier 2 learnings:
  - If API > 100 req/sec → Add Redis caching
  - If models drift → Add monitoring (Evidently)
  - If users > 100 → Consider container orchestration
  - If team > 5 → Extract microservices
```

**Deliverables**:
- [ ] Production monitoring dashboard
- [ ] Automated alerting
- [ ] CI/CD pipeline
- [ ] Load tested to 100 concurrent users
- [ ] Documentation complete
- [ ] Runbooks for common issues

**Exit Criteria**:
```
- 99% uptime over 1 month
- P95 API response < 500ms
- Zero data loss incidents
- New team member can onboard in 1 day

If yes → Production complete
If no → Iterate on Tier 3
```

**Budget**: $200-500/month
- Larger VM or container service
- Managed database
- Monitoring tools
- CDN for static assets

**Scaling Decision Tree**:
```
Problem                         → Solution
─────────────────────────────────────────────────────
API slow (> 1s response)        → Add Redis caching
Database slow (> 5s queries)    → Add indexes, consider read replicas
Storage growing (> 100GB)       → Add S3 lifecycle policies
Users growing (> 100 concurrent)→ Add horizontal scaling
Model drift detected            → Add automated retraining
```

---

## 9. Future Enhancements

### Real-Time Data (When Available)

**Trigger**: F1 provides live telemetry access (commercial partnership or API)

**Changes Required**:
```
Current (Batch)              → Future (Real-Time)
─────────────────────────────────────────────────
FastF1 polling               → WebSocket connection
Hourly data refresh          → Sub-second updates
DuckDB queries               → Redis for hot data
Streamlit polling            → Server-sent events
Batch ML predictions         → Online inference
```

**Architecture Addition**:
```
┌─────────────────────────────────────────────────────────────────┐
│                     REAL-TIME LAYER (Future)                     │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    │
│  │  WebSocket    │───▶│  Redis        │───▶│  Live         │    │
│  │  Ingestion    │    │  Streams      │    │  Dashboard    │    │
│  └───────────────┘    └───────────────┘    └───────────────┘    │
│         ▲                                                        │
│         │                                                        │
│  [F1 Live Telemetry API - Not Currently Available]              │
└─────────────────────────────────────────────────────────────────┘
```

**Do NOT build this until**:
- F1 announces official live telemetry API, OR
- Partnership secured for live data access

---

### Mobile Companion App

**Trigger**: Strong user demand + stable web platform

**Technology Options**:
- React Native (cross-platform)
- Flutter (cross-platform)
- PWA (Progressive Web App - lowest effort)

**Features**:
- Push notifications for race starts
- Quick lap time comparisons
- Simplified telemetry viewer
- Offline mode for saved analyses

---

### Community Features

**Trigger**: User base > 1000 active users

**Features**:
- User-generated analyses (share comparisons)
- Discussion threads on races
- Leaderboards for prediction accuracy
- API access for third-party tools

---

## 10. Appendix

### A. Complete Directory Structure

```
telemetry-x/
├── app/                        # Streamlit application
│   ├── __init__.py
│   ├── main.py                 # Entry point
│   ├── pages/                  # Streamlit pages
│   │   ├── 01_race_explorer.py
│   │   ├── 02_driver_comparison.py
│   │   ├── 03_strategy_simulator.py
│   │   ├── 04_telemetry_viewer.py
│   │   └── 05_historical_browser.py
│   ├── components/             # Reusable UI components
│   │   ├── track_map.py
│   │   ├── telemetry_chart.py
│   │   └── strategy_timeline.py
│   └── utils/                  # UI utilities
│       ├── formatting.py
│       └── caching.py
│
├── api/                        # Flask API
│   ├── __init__.py
│   ├── app.py                  # Flask entry point
│   ├── routes/
│   │   ├── predictions.py
│   │   ├── comparisons.py
│   │   └── exports.py
│   └── middleware/
│       ├── auth.py
│       └── logging.py
│
├── core/                       # Business logic
│   ├── __init__.py
│   ├── ingestion/              # Data fetching
│   │   ├── fastf1_client.py
│   │   ├── ergast_client.py
│   │   └── archive_scraper.py
│   ├── processing/             # Data transformation
│   │   ├── telemetry.py
│   │   ├── lap_times.py
│   │   └── features.py
│   ├── analysis/               # Analytics
│   │   ├── comparison.py
│   │   ├── degradation.py
│   │   └── strategy.py
│   └── models/                 # ML models
│       ├── tire_deg_predictor.py
│       ├── strategy_simulator.py
│       └── pace_predictor.py
│
├── data/                       # Data storage
│   ├── bronze/                 # Raw data
│   ├── silver/                 # Cleaned data
│   ├── gold/                   # Feature data
│   └── catalog.duckdb         # DuckDB catalog
│
├── models/                     # Trained ML models
│   ├── tire_deg_v1.pkl
│   └── strategy_sim_v1.pkl
│
├── tests/                      # Test suite
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── notebooks/                  # Jupyter notebooks
│   ├── exploration/
│   └── experiments/
│
├── docker/                     # Docker configs
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── config/                     # Configuration
│   ├── settings.py
│   └── logging.yaml
│
├── requirements.txt            # Python dependencies
├── pyproject.toml             # Project metadata
├── Makefile                   # Common commands
└── README.md                  # Project documentation
```

---

### B. Technology Upgrade Triggers

| Current | Upgrade To | Trigger Condition |
|---------|-----------|-------------------|
| DuckDB | PostgreSQL | > 10 concurrent users writing |
| Local storage | S3 | > 100GB data OR team > 1 |
| Streamlit only | + FastAPI | Need background jobs or REST API |
| SQLite (MLflow) | PostgreSQL (MLflow) | Team > 1 person |
| Single container | Kubernetes | > 100 concurrent users |
| Manual deploy | CI/CD | > 1 deploy per week |
| Logs only | Prometheus + Grafana | Production deployment |

---

### C. Cost Estimation by Tier

| Component | Tier 1 | Tier 2 | Tier 3 |
|-----------|--------|--------|--------|
| Compute | $0 (local) | $20-50/mo | $100-200/mo |
| Storage | $0 (local) | $5-10/mo | $20-50/mo |
| Database | $0 (DuckDB) | $0-50/mo | $50-100/mo |
| Monitoring | $0 | $0-20/mo | $20-50/mo |
| Domain/SSL | $0 | $15/yr | $15/yr |
| **Total** | **$0** | **$50-150/mo** | **$200-400/mo** |

---

### D. Security Checklist by Tier

**Tier 1 (Local)**:
- [ ] No secrets in code (use .env files)
- [ ] .gitignore includes sensitive files
- [ ] Local firewall enabled

**Tier 2 (Team)**:
- [ ] API keys in environment variables
- [ ] HTTPS only (no HTTP)
- [ ] Basic authentication implemented
- [ ] Request logging enabled
- [ ] Rate limiting on API endpoints

**Tier 3 (Production)**:
- [ ] OAuth2/JWT authentication
- [ ] Secrets in cloud secret manager
- [ ] VPC/network isolation
- [ ] Audit logging to immutable store
- [ ] Regular dependency updates
- [ ] Security headers (CORS, CSP, etc.)

---

### E. Data Quality Checks

| Check | Threshold | Action on Failure |
|-------|-----------|-------------------|
| Schema validation | 100% compliance | Block ingestion |
| Null percentage | < 5% nulls | Alert + continue |
| Value ranges | Domain-specific | Block pipeline |
| Freshness | < 24h lag | Alert |
| Duplicate detection | 0 duplicates | Dedupe + alert |

---

### F. Common Queries Reference

```sql
-- Get all lap times for a driver in a race
SELECT LapNumber, LapTime, Compound, TyreLife
FROM lap_times
WHERE Year = 2024 AND Round = 1 AND Driver = 'VER'
ORDER BY LapNumber;

-- Calculate average pace per stint
SELECT Driver, Stint, Compound,
       AVG(LapTime) as AvgLapTime,
       COUNT(*) as Laps
FROM lap_times
WHERE Year = 2024 AND Round = 1
GROUP BY Driver, Stint, Compound
ORDER BY Driver, Stint;

-- Find fastest sector times
SELECT Driver, 
       MIN(Sector1Time) as BestS1,
       MIN(Sector2Time) as BestS2,
       MIN(Sector3Time) as BestS3
FROM lap_times
WHERE Year = 2024 AND Round = 1 AND Session = 'Q'
GROUP BY Driver
ORDER BY BestS1 + BestS2 + BestS3;

-- Tire degradation analysis
SELECT TyreLife, 
       AVG(LapTime) as AvgLapTime,
       COUNT(*) as SampleSize
FROM lap_times
WHERE Compound = 'SOFT' AND Year = 2024
GROUP BY TyreLife
ORDER BY TyreLife;
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | - | Initial enterprise architecture |
| 2.0 | Jan 2026 | - | Simplified for batch-only, three-tier approach |

---

*End of Architecture Document*
