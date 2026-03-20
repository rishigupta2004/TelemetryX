

# I Can't Access GitHub Links — But I Know Your Entire Project

From our conversation I have the complete picture: all endpoints, data shapes, features, layout, colors, everything. Here's your full architecture + instructions document.

**Create this file at `frontend-electron/.opencode/instructions.md`:**

---

```markdown
# TelemetryX Electron Frontend — Architecture & Agent Instructions

## THIS FILE IS LAW. EVERY RULE IS BINDING.

---

## PART 1: PROJECT IDENTITY

TelemetryX is a desktop F1 race analysis application.
- **Backend**: Python FastAPI (../backend/) — DONE, WORKING, DO NOT MODIFY
- **Data**: Parquet files + DuckDB (../backend/etl/data/) — DO NOT MODIFY  
- **ML**: Clustering + Strategy models (../ml/) — DO NOT MODIFY
- **Frontend**: Electron + React + TypeScript — THIS IS WHAT WE BUILD
- **Legacy Reference**: ../frontend/ (PySide6/QML — READ ONLY, use as visual spec)

The backend runs at `http://localhost:8000` and serves all data via REST/JSON.
The frontend fetches data from these endpoints and renders an F1 timing interface.

---

## PART 2: ABSOLUTE RULES

### RULE 1: NO MOCK DATA
- Every component fetches from the REAL FastAPI backend
- No hardcoded driver names, lap times, positions, weather values
- No placeholder data "to make it look right"
- No `const drivers = [{name: "Verstappen"...}]` anywhere
- If backend returns empty → show empty state message
- If backend errors → show error state message

### RULE 2: ONE COMPONENT AT A TIME
- Build one component → wire to real data → user verifies visually
- Do NOT move to next component until user confirms current one works
- Do NOT declare "done" based on tests or console.log alone
- "Done" means the USER sees it working on screen

### RULE 3: VERIFY DATA SHAPE BEFORE CODING
- Before building any component, make a REAL API call first
- Use curl or fetch to hit the actual endpoint
- Show the actual JSON response structure
- Use THOSE field names in your TypeScript types
- NEVER guess field names

### RULE 4: MINIMAL CHANGES
- Each task should touch the minimum files necessary
- No refactoring code that already works
- No "improvements" to working components
- No adding libraries without explicit approval
- If it works, don't touch it

### RULE 5: TECH STACK IS LOCKED
Do NOT add packages beyond what's listed in Part 4 without asking.

### RULE 6: REFERENCE THE LEGACY FRONTEND
- The QML files in ../frontend/ui/qml/ show the intended UI design
- Read them to understand layout, structure, and data bindings
- Replicate the VISUAL DESIGN in React, not the code architecture
- The PySide6 bridge/store/signal system does NOT apply to React

---

## PART 3: APPLICATION ARCHITECTURE

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  electron/main.ts — creates BrowserWindow, manages lifecycle │
├─────────────────────────────────────────────────────────────┤
│                   React Renderer Process                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    App.tsx                            │    │
│  │  ┌─────────┐ ┌────────────────────────┐ ┌────────┐  │    │
│  │  │ Sidebar │ │    View Router         │ │ TopBar │  │    │
│  │  │         │ │  ┌──────────────────┐  │ │        │  │    │
│  │  │ Driver  │ │  │ TimingView       │  │ │Session │  │    │
│  │  │ List    │ │  │ TelemetryView    │  │ │Info    │  │    │
│  │  │         │ │  │ StrategyView     │  │ │        │  │    │
│  │  │         │ │  │ TrackView        │  │ │        │  │    │
│  │  │         │ │  │ FeaturesView     │  │ │        │  │    │
│  │  │         │ │  └──────────────────┘  │ │        │  │    │
│  │  └─────────┘ └────────────────────────┘ └────────┘  │    │
│  │  ┌──────────────────────────────────────────────────┐│    │
│  │  │              PlaybackBar                         ││    │
│  │  └──────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                    fetch() / HTTP                            │
│                           │                                  │
├───────────────────────────▼─────────────────────────────────┤
│              FastAPI Backend (localhost:8000)                 │
│                  (separate process)                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Directory Structure

```
frontend-electron/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── index.html
├── .opencode/
│   └── instructions.md          ← THIS FILE
├── electron/
│   ├── main.ts                  ← Electron main process
│   └── preload.ts               ← Preload script (if needed)
├── src/
│   ├── main.tsx                 ← React entry point
│   ├── App.tsx                  ← Root component, view routing
│   ├── index.css                ← Tailwind imports + CSS variables
│   │
│   ├── api/
│   │   └── client.ts            ← API client (fetch wrapper + typed methods)
│   │
│   ├── stores/
│   │   ├── sessionStore.ts      ← Session data, loading state
│   │   ├── playbackStore.ts     ← Playback time, play/pause, speed
│   │   └── driverStore.ts       ← Selected driver(s)
│   │
│   ├── types/
│   │   └── index.ts             ← All TypeScript interfaces
│   │
│   ├── hooks/
│   │   ├── useTimingData.ts     ← Derives timing rows from session data
│   │   ├── usePositions.ts      ← Car positions at current time
│   │   ├── useTelemetry.ts      ← Telemetry window at current time
│   │   ├── useWeather.ts        ← Weather at current time
│   │   └── useRaceControl.ts    ← Race control messages up to current time
│   │
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── PlaybackBar.tsx
│   │   ├── SessionPicker.tsx
│   │   ├── TimingTower.tsx
│   │   ├── TrackMap.tsx
│   │   ├── TelemetryChart.tsx
│   │   ├── WeatherPanel.tsx
│   │   ├── RaceControlFeed.tsx
│   │   ├── PitStrategy.tsx
│   │   ├── DriverSummary.tsx
│   │   └── UndercutPredictor.tsx
│   │
│   ├── views/
│   │   ├── TimingView.tsx       ← TimingTower + TrackMap + Weather + RaceControl
│   │   ├── TelemetryView.tsx    ← All telemetry charts
│   │   ├── StrategyView.tsx     ← PitStrategy + UndercutPredictor
│   │   ├── TrackView.tsx        ← Large track map + details
│   │   └── FeaturesView.tsx     ← Driver summary + clusters + intelligence
│   │
│   └── lib/
│       ├── colors.ts            ← Team colors, compound colors, theme
│       ├── format.ts            ← Time formatting, number formatting
│       └── trackGeometry.ts     ← Track SVG path utilities
│
└── public/
    └── (static assets if any)
```

### 3.3 Data Flow

```
                    ONE-WAY DATA FLOW
                    
Backend API ──fetch()──▶ Zustand Store ──subscribe──▶ React Components
                              │
                              │ derived via hooks
                              ▼
                     useTimingData(currentTime)
                     usePositions(currentTime)
                     useTelemetry(currentTime)
                     useWeather(currentTime)
                     useRaceControl(currentTime)
                              │
                              ▼
                     Components re-render with
                     time-sliced data
```

```
PLAYBACK FLOW

PlaybackStore.play()
    │
    ▼
requestAnimationFrame loop
    │
    ├── currentTime += deltaTime * speed
    │
    └── All hooks that depend on currentTime
        automatically re-derive their data
        │
        ├── TimingTower re-renders with new positions
        ├── TrackMap re-renders with new car positions
        ├── TelemetryChart scrolls to new time
        ├── WeatherPanel updates to nearest reading
        └── RaceControlFeed shows messages up to time
```

### 3.4 State Management (Zustand)

```typescript
// sessionStore.ts — what data is loaded
interface SessionStore {
  // Selection
  selectedYear: number | null
  selectedRace: string | null
  selectedSession: string | null
  
  // Raw data from API
  sessionData: SessionVizResponse | null
  tyreData: TyreFeature[] | null
  driverSummary: DriverSummaryResponse | null
  clusterData: ClusterResult[] | null
  strategyRecs: StrategyRecommendation | null
  
  // State
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  
  // Actions
  loadSession: (year: number, race: string, session: string) => Promise<void>
  clearSession: () => void
}

// playbackStore.ts — timeline control
interface PlaybackStore {
  currentTime: number        // seconds from session start
  isPlaying: boolean
  speed: number              // 1, 2, 4, 8, 16
  duration: number           // total session duration
  
  play: () => void
  pause: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
}

// driverStore.ts — selection
interface DriverStore {
  primaryDriver: string | null      // 3-letter code e.g. "VER"
  compareDriver: string | null      // for telemetry overlay
  
  selectPrimary: (code: string) => void
  selectCompare: (code: string | null) => void
  clearSelection: () => void
}
```

---

## PART 4: TECH STACK (LOCKED)

| Layer | Package | Version | Purpose |
|-------|---------|---------|---------|
| Runtime | Electron | 33+ | Desktop shell |
| UI | React | 19.x | Component rendering |
| Language | TypeScript | 5.x | Type safety |
| Bundler | Vite | 6.x | Dev server + build |
| Electron+Vite | electron-vite | latest | Electron integration |
| State | Zustand | 5.x | Simple reactive state |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Charts | lightweight-charts OR uPlot | latest | High-perf time series |
| Table | @tanstack/react-table | 8.x | Virtualized data table |
| Icons | lucide-react | latest | Icon set |
| HTTP | Built-in fetch | — | API calls |

**DO NOT ADD** any package not on this list without user approval.
No axios, no redux, no styled-components, no framer-motion, 
no chart.js, no recharts, no material-ui, no shadcn.

---

## PART 5: BACKEND API CONTRACT

Backend runs at: `http://localhost:8000`

### 5.1 Session Discovery

```
GET /api/v1/seasons
Response: [
  { "year": 2025, ... },
  { "year": 2024, ... },
  ...
]

GET /api/v1/seasons/{year}/races
Response: [
  { "round": 1, "raceName": "Bahrain Grand Prix", ... },
  ...
]
```

### 5.2 Session Data (Primary — loads everything)

```
GET /api/v1/sessions/{year}/{race}/{session}/viz
    ?include_weather=1&include_race_control=1
    
Response: {
  "laps": [
    { "driver": "VER", "driverNumber": 1, "lapNumber": 1, 
      "lapTime": 93.456, "sector1": 28.1, "sector2": 35.2, 
      "sector3": 30.1, "compound": "SOFT", "stint": 1, 
      "position": 1, ... },
    ...
  ],
  "positions": [
    { "driverNumber": 1, "timestamp": 0.0, "x": 123.4, 
      "y": 456.7, ... },
    ...
  ],
  "weather": [
    { "timestamp": 14.5, "airTemp": 27.9, "trackTemp": 34.5, 
      "humidity": 45.0, "windSpeed": 2.9, "windDirection": 29, 
      "rainfall": 0, "pressure": 1007.9 },
    ...
  ],
  "raceControl": [
    { "timestamp": 0.0, "category": "Flag", "flag": "GREEN", 
      "message": "GREEN LIGHT - PIT EXIT OPEN", "driver": null },
    ...
  ],
  "drivers": [
    { "code": "VER", "name": "Max Verstappen", 
      "teamColor": "#3671C6", "driverNumber": 1, ... },
    ...
  ],
  ...
}

NOTE: Field names above are APPROXIMATE. Before building any 
component, make a real curl call and verify exact names.
```

### 5.3 Windowed Data (for large datasets)

```
GET /api/v1/sessions/{year}/{race}/{session}/positions
    ?t_min=0&t_max=120
Response: { "positions": [...], "metadata": {...} }

GET /api/v1/sessions/{year}/{race}/{session}/telemetry
    ?t_min=0&t_max=120
Response: { "telemetry": [...], "metadata": {...} }

GET /api/v1/sessions/{year}/{race}/{session}/laps
Response: [ { lap row }, ... ]
```

### 5.4 Features & ML

```
GET /api/v1/features/{year}/{race}/{session}/tyre
Response: [
  { "driver": "VER", "compound": "SOFT", "stint": 1, 
    "lapStart": 1, "lapEnd": 15, ... },
  ...
]

GET /api/v1/features/{year}/{race}/{session}/driver-summary
Response: { "overview": {...}, "performance": {...}, ... }

GET /api/v1/models/clustering
Response: [ { "driver": "VER", "cluster": 0, ... }, ... ]

POST /api/v1/models/undercut/predict
Body: { "year": 2025, "race": "...", "session": "R", 
        "driver1": "VER", "driver2": "HAM" }
Response: { "prediction": "...", "success_probability": 0.72, 
            "confidence": 0.85, "summary": "...", 
            "strategy_call": "...", "recommendations": [...] }

GET /api/v1/models/strategy-recommendations/{year}/{race}
Response: { "best_strategy": {...}, "all_strategies": [...] }
```

### 5.5 CORS Setup Required

Add to backend/main.py (ONE TIME):
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## PART 6: DESIGN SYSTEM

### 6.1 Colors

```css
/* Theme — Dark broadcast quality */
--bg-primary:      #0f0f0f;    /* app background */
--bg-secondary:    #1a1a1a;    /* panel background */
--bg-card:         #242424;    /* card/component background */
--bg-hover:        #2a2a2a;    /* hover state */
--bg-selected:     #1e3a5f;    /* selected row/item */
--text-primary:    #ffffff;    /* main text */
--text-secondary:  #a0a0a0;    /* labels, secondary info */
--text-muted:      #666666;    /* disabled, tertiary */
--accent:          #e10600;    /* F1 red — primary accent */
--accent-blue:     #0090ff;    /* selection, links */
--border:          #333333;    /* subtle borders */

/* Status */
--green:           #00d846;    /* green flag, personal best */
--yellow:          #ffd700;    /* yellow flag, slower */
--red:             #ff1801;    /* red flag, danger */
--purple:          #a855f7;    /* session best */
--sc-orange:       #ff8c00;    /* safety car */

/* Tire Compounds */
--tyre-soft:       #ff1801;
--tyre-medium:     #ffd700;
--tyre-hard:       #ffffff;
--tyre-inter:      #00d846;
--tyre-wet:        #0090ff;
```

### 6.2 Typography

```css
/* Fonts */
font-family-ui:      'Inter', -apple-system, sans-serif;
font-family-mono:    'JetBrains Mono', 'SF Mono', monospace;

/* Scale */
text-xs:    11px;   /* labels, badges */
text-sm:    13px;   /* secondary text, table cells */
text-base:  14px;   /* primary data values */
text-lg:    16px;   /* headings */
text-xl:    20px;   /* view titles */

/* RULE: All numeric values (times, gaps, temperatures, 
   percentages) use font-family-mono for alignment */
```

### 6.3 Spacing

```css
gap-tight:     4px;
gap-sm:        8px;
gap-md:        12px;
gap-lg:        16px;
gap-xl:        24px;
padding-card:  12px;
padding-panel: 16px;
radius-sm:     4px;   /* badges, buttons */
radius-md:     6px;   /* cards */
radius-lg:     8px;   /* panels */
```

---

## PART 7: 8 FEATURE REQUIREMENTS

### Feature 1: Timing Tower

```
DATA SOURCE: sessionData.laps + derived calculations
COMPONENT: TimingTower.tsx
VIEW: TimingView.tsx (left panel)

Columns:
  POS | DRIVER | GAP | INT | LAST | BEST | TYRE | S1 | S2 | S3

Requirements:
- Rows sorted by position (P1 top, P20 bottom)
- Team color strip on left border of each row
- Gap to leader: "+5.432s" format
- Interval to car ahead: "+0.892s" format
- Sector colors: purple=session best, green=personal best, yellow=slower
- Tyre badge: colored dot/pill with compound initial (S/M/H/I/W)
- Status badges: PIT, OUT, DNF, SC
- Click row → selects driver (updates driverStore)
- Selected row highlighted with --bg-selected
- Monospace font for all time values
- Compact row height: 28-32px
- Virtualized via TanStack Table for performance

Edge cases:
- DNF: row grayed out, shows "DNF"
- No data: show "No timing data available"
```

### Feature 2: Track Map

```
DATA SOURCE: sessionData.positions + track geometry
COMPONENT: TrackMap.tsx
VIEWS: TimingView.tsx (right panel), TrackView.tsx (full)

Requirements:
- SVG rendering of track outline from geometry data
- Car markers: small circle with team color + 3-letter driver code
- Markers positioned by x,y from position data
- If x,y are 0/invalid: position by lap progress along track path
- Smooth position updates during playback
- Click car → selects driver
- Hover car → tooltip (driver, position, gap, tyre)
- Sector markers on track
- Start/finish line marked
- "Track layout not available" if no geometry

Edge cases:
- Car in pit: marker disappears or moves to pit area
- DNF: marker grayed or removed
```

### Feature 3: Telemetry Charts

```
DATA SOURCE: sessionData.telemetry (or /telemetry endpoint)
COMPONENT: TelemetryChart.tsx (reusable per channel)
VIEW: TelemetryView.tsx

Channels: Speed, Throttle, Brake, Gear, DRS, RPM
  - Speed: 0-350 km/h
  - Throttle: 0-100%
  - Brake: 0-100%
  - Gear: 0-8
  - DRS: 0/1
  - RPM: 0-15000

Requirements:
- Stacked charts sharing X-axis (time)
- Synchronized zoom/pan across all charts
- Playback cursor line at current time
- Primary driver trace in team color
- Compare driver overlay in second color
- Click chart → seek playback to that time
- High performance: handle 10k+ data points
- Only show channels that have data
- "No telemetry data" if empty

Edge cases:
- Missing channel: hide that chart, show others
- Very sparse data: still render correctly
```

### Feature 4: Weather Panel

```
DATA SOURCE: sessionData.weather
COMPONENT: WeatherPanel.tsx
VIEW: TimingView.tsx (compact), FeaturesView.tsx (detailed)

Fields: Track Temp, Air Temp, Humidity, Wind Speed, 
        Wind Direction, Rainfall, Pressure

Requirements:
- Display all available fields with labels and units
- Temperature color: cold(<15°C)=blue, moderate=neutral, hot(>30°C)=red
- Rain indicator prominent (icon + color)
- Updates based on playback time (nearest reading)
- "No weather data" if empty
- Compact mode for TimingView (key values only)
```

### Feature 5: Race Control Feed

```
DATA SOURCE: sessionData.raceControl
COMPONENT: RaceControlFeed.tsx
VIEW: TimingView.tsx

Requirements:
- Scrollable message list, newest at top
- Message styling by type:
  - Green flag: green-tinted background
  - Yellow flag: yellow/amber background
  - Red flag: red background, bold
  - Safety Car: orange with "SC" badge
  - VSC: orange with "VSC" badge
  - Penalty: red-tinted
  - Investigation: yellow-tinted
  - DRS: blue-tinted
- Active state banner at top (current flag status)
- Messages accumulated up to playback time
- "No race control data" if empty
```

### Feature 6: Pit Strategy

```
DATA SOURCE: tyreData (from /features/.../tyre)
COMPONENT: PitStrategy.tsx
VIEW: StrategyView.tsx

Requirements:
- Per-driver horizontal stint bar chart
- Bar color = compound color
- Bar width proportional to stint laps
- Drivers sorted by finishing position
- Pit stop markers between stints
- "No pit data" if empty
- "Not applicable for qualifying" for qual sessions
```

### Feature 7: Driver Sidebar

```
DATA SOURCE: sessionData.drivers + timing positions
COMPONENT: Sidebar.tsx
VIEW: All views (fixed left panel)

Requirements:
- List all drivers for loaded session
- Sorted by race position
- Each entry: position badge + team color + driver code
- Click → select primary driver
- Ctrl+click → select compare driver
- Selected state visually distinct
- Shows on all views
- "Load a session" when no session
```

### Feature 8: Session State + Playback

```
DATA SOURCE: sessionStore + playbackStore
COMPONENTS: TopBar.tsx, PlaybackBar.tsx, SessionPicker.tsx
VIEW: Always visible (top + bottom of app)

TopBar:
- TelemetryX logo/title
- Current session: year, race name, session type
- Status indicator: idle/loading/ready/error
- Session picker trigger

PlaybackBar:
- Play/pause button
- Speed control: 1x, 2x, 4x, 8x, 16x
- Timeline scrubber (draggable)
- Current time display (MM:SS.s)
- Lap indicator: "Lap 15 / 58"

SessionPicker:
- Modal/dropdown with 3 levels: Year → Race → Session
- Populated from real API
- Loading state while fetching
```

---

## PART 8: LAYOUT SPECIFICATIONS

### 8.1 App Shell

```
┌──────────────────────────────────────────────────────────┐
│  TopBar (48px height, fixed)                              │
├────────┬─────────────────────────────────────────────────┤
│        │                                                  │
│ Side   │  Main Content Area                               │
│ bar    │  (switches between views)                        │
│        │                                                  │
│ 200px  │  flex-1                                          │
│ fixed  │                                                  │
│        │                                                  │
│        │                                                  │
├────────┴─────────────────────────────────────────────────┤
│  PlaybackBar (56px height, fixed)                         │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Timing View Layout

```
┌────────────────────────┬────────────────────────────┐
│                        │       Track Map             │
│   Timing Tower         │       (flex-1)              │
│   (400px width)        ├────────────────────────────┤
│                        │  Weather    │  Race Control │
│                        │  (compact)  │  (feed)       │
│                        │  200px h    │  flex-1       │
└────────────────────────┴────────────────────────────┘
```

### 8.3 Telemetry View Layout

```
┌──────────────────────────────────────────────────────┐
│  Speed Chart        (full width, ~120px height)       │
├──────────────────────────────────────────────────────┤
│  Throttle Chart     (full width, ~80px height)        │
├──────────────────────────────────────────────────────┤
│  Brake Chart        (full width, ~80px height)        │
├──────────────────────────────────────────────────────┤
│  Gear Chart         (full width, ~60px height)        │
├──────────────────────────────────────────────────────┤
│  RPM Chart          (full width, ~80px height)        │
├──────────────────────────────────────────────────────┤
│  DRS Chart          (full width, ~40px height)        │
└──────────────────────────────────────────────────────┘
```

### 8.4 Strategy View Layout

```
┌──────────────────────────────────────────────────────┐
│  Stint Bars (per driver, full width, scrollable)      │
│  ════════════════════════════                         │
│  VER: [████ SOFT ████][████████ HARD ████████]        │
│  NOR: [██ SOFT ██][████████████ HARD ████████████]    │
│  ...                                                  │
├────────────────────────┬─────────────────────────────┤
│  Undercut Predictor    │  Strategy Recommendations    │
│  (select 2 drivers)    │  (ML-derived)               │
└────────────────────────┴─────────────────────────────┘
```

---

## PART 9: BUILD ORDER (PHASES)

```
PHASE 0: Scaffold project (Electron + React + Vite + Tailwind)
         → Verify: Electron window opens with dark background

PHASE 1: API client + Types + Session Picker + TopBar
         → Verify: Can select a session, real data loads

PHASE 2: Timing Tower (most critical component)
         → Verify: Shows 20 drivers with real positions/gaps

PHASE 3: Track Map
         → Verify: Track shape renders, cars positioned

PHASE 4: Telemetry Charts
         → Verify: All channels show real data

PHASE 5: Weather + Race Control
         → Verify: Weather values + messages display

PHASE 6: Pit Strategy + Sidebar
         → Verify: Stint bars + driver selection works

PHASE 7: Playback System (brings everything to life)
         → Verify: Play/pause, everything updates together

PHASE 8: Features View + Polish + Package
         → Verify: All views complete, .app built

USER VERIFICATION IS REQUIRED BETWEEN EVERY PHASE.
DO NOT PROCEED TO PHASE N+1 UNTIL PHASE N IS CONFIRMED.
```

---

## PART 10: COMPONENT IMPLEMENTATION PATTERNS

### API Client Pattern

```typescript
// src/api/client.ts
const BASE_URL = 'http://localhost:8000/api/v1'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

// Each method hits a REAL endpoint — no mocks
export const api = {
  getSeasons: () => get<Season[]>('/seasons'),
  getRaces: (year: number) => get<Race[]>(`/seasons/${year}/races`),
  getSessionViz: (year: number, race: string, session: string) =>
    get<SessionVizResponse>(
      `/sessions/${year}/${race}/${session}/viz?include_weather=1&include_race_control=1`
    ),
  // ... other methods
}
```

### Store Pattern

```typescript
// src/stores/sessionStore.ts
import { create } from 'zustand'
import { api } from '../api/client'

export const useSessionStore = create<SessionStore>((set) => ({
  sessionData: null,
  loadingState: 'idle',
  error: null,
  
  loadSession: async (year, race, session) => {
    set({ loadingState: 'loading', error: null })
    try {
      const data = await api.getSessionViz(year, race, session)
      set({ sessionData: data, loadingState: 'ready' })
    } catch (e) {
      set({ loadingState: 'error', error: String(e) })
    }
  },
}))
```

### Component Pattern

```typescript
// src/components/WeatherPanel.tsx
import { useSessionStore } from '../stores/sessionStore'
import { usePlaybackStore } from '../stores/playbackStore'

export function WeatherPanel() {
  const sessionData = useSessionStore(s => s.sessionData)
  const currentTime = usePlaybackStore(s => s.currentTime)
  
  if (!sessionData?.weather?.length) {
    return <div className="text-text-muted">No weather data available</div>
  }
  
  // Find nearest weather reading to current playback time
  const weather = findNearest(sessionData.weather, currentTime)
  
  return (
    <div className="bg-bg-card rounded-md p-3">
      <div className="text-text-secondary text-xs mb-2">WEATHER</div>
      <div className="font-mono text-base">
        {weather.trackTemp}°C Track
      </div>
      {/* ... other fields */}
    </div>
  )
}
```

---

## PART 11: ANTI-PATTERNS (DO NOT DO THESE)

```
❌ DO NOT create mock data services or fixture files
❌ DO NOT add state management beyond Zustand (no Redux, no Context)
❌ DO NOT add CSS-in-JS (no styled-components, no emotion)
❌ DO NOT add component libraries (no MUI, no Chakra, no shadcn)
❌ DO NOT add animation libraries (no framer-motion, no GSAP)
❌ DO NOT create an abstraction layer over fetch
❌ DO NOT add GraphQL or any query library (no Apollo, no urql)
❌ DO NOT create "smart" and "dumb" component hierarchies
❌ DO NOT add unit tests before the component works visually
❌ DO NOT optimize before it works (no memo, no useMemo, no virtualization 
   UNLESS there's a measured performance problem)
❌ DO NOT build all components then test — build one, verify, next
❌ DO NOT declare "done" without user confirmation
```

---

## PART 12: LEGACY QML REFERENCE MAP

When building a component, read its QML equivalent for design reference:

```
COMPONENT              → READ THIS QML FILE
TimingTower.tsx        → ../frontend/ui/qml/components/organisms/TXTimingTower.qml
TrackMap.tsx           → ../frontend/ui/qml/components/organisms/TXTrackMap.qml
TelemetryChart.tsx     → ../frontend/ui/qml/components/organisms/TXLineChart.qml
WeatherPanel.tsx       → ../frontend/ui/qml/views/TimingView.qml (weather section)
RaceControlFeed.tsx    → ../frontend/ui/qml/views/TimingView.qml (race control section)
PitStrategy.tsx        → ../frontend/ui/qml/views/StrategyView.qml
Sidebar.tsx            → ../frontend/ui/qml/Sidebar.qml
TopBar.tsx             → ../frontend/ui/qml/TopBar.qml
PlaybackBar.tsx        → ../frontend/ui/qml/PlaybackBar.qml
SessionPicker.tsx      → ../frontend/ui/qml/main.qml (session modal)
TimingView.tsx         → ../frontend/ui/qml/views/TimingView.qml
TelemetryView.tsx      → ../frontend/ui/qml/views/TelemetryView.qml
StrategyView.tsx       → ../frontend/ui/qml/views/StrategyView.qml
FeaturesView.tsx       → ../frontend/ui/qml/views/FeaturesView.qml
TrackView.tsx          → ../frontend/ui/qml/views/TrackView.qml

Use these as VISUAL REFERENCE only. Do NOT copy QML syntax or patterns.
Understand the layout, columns, colors, and data shown, then build 
the equivalent in React + Tailwind.
```
```

---

