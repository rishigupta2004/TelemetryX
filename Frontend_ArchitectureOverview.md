F1 Strategy Dashboard V1.0 - Frontend Architecture Document
---
1. Executive Summary
Project: TelemetryX F1 Strategy Dashboard  
Version: 1.0  
Objective: Professional Formula 1 playback and analysis platform showcasing ML models  
Scope: Historical race playback (2018-2025), all circuits, all sessions (R/Q/S/SS)  
Target Audience: Portfolio/demo for technical interviews and F1 data enthusiasts
---
2. Technical Stack
Core Framework
| Component | Technology | Justification |
|-----------|------------|---------------|
| Framework | React 18 + Vite | Fast HMR, small bundle size |
| Language | TypeScript 5.x | Type safety for data structures |
| Build Tool | Vite 5.x | Optimized bundling |
| Package Manager | npm 10.x |
UI & Styling
| Component | Technology | Justification |
|-----------|------------|---------------|
| Styling | Tailwind CSS 3.x | Rapid development, consistent design system |
| Icons | Lucide React | Clean, professional SVG icons |
| Animations | Framer Motion | Smooth UI transitions |
| Typography | Inter | Clean, readable, professional |
3D Visualization
| Component | Technology | Justification |
|-----------|------------|---------------|
| 3D Engine | Deck.gl 9.x | WebGL-powered, efficient for moving points |
| Map Base | TUMFTM Track Database | Pre-processed coordinates, MIT-compatible |
| Camera | Deck.gl OrbitView | Interactive orbit controls |
Charts & Telemetry
| Component | Technology | Justification |
|-----------|------------|---------------|
| Charts | Apache ECharts 5.x | Apache 2.0 license, handles 50Hz data well |
| Data Processing | DuckDB-WASM | Client-side parquet queries |
State Management
| Component | Technology | Justification |
|-----------|------------|---------------|
| Global State | Zustand 4.x | Simple, performant, minimal boilerplate |
| Local State | React Hooks | useState, useReducer, useMemo |
| URL State | React Router 6.x | Session deep linking |
Data & API
| Component | Technology | Justification |
|-----------|------------|---------------|
| Data Format | Apache Parquet | Columnar storage for telemetry |
| HTTP Client | Axios | Simple, predictable API |
| Web Workers | Comlink | Offload heavy computations |
Deployment
| Component | Technology | Cost |
|-----------|------------|------|
| Frontend | Vercel (Pro/Enterprise) | Free tier |
| CDN | Vercel Edge Network | Included |
| CI/CD | GitHub Actions | Free |
---
3. Architecture Overview
High-Level Architecture
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        React Application                             │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Router    │  │   Stores    │  │  Services   │  │  Components │ │   │
│  │  │  (Pages)    │  │ (Zustand)   │  │   (API)     │  │   (UI)      │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Deck.gl Canvas Layer                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ TrackLayer  │  │ CarLayer    │  │ CornerLabels│                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ECharts Visualization Layer                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ SpeedTrace  │  │ Throttle    │  │ Degradation │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Static Files (No Server)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STATIC DATA LAYER                                  │
│                                                                             │
│  /public/                                                                  │
│  ├── tracks/                    ← TUMFTM coordinates (JSON)                │
│  │   ├── bahrain.json                                                   │
│  │   ├── monaco.json                                                     │
│  │   └── ... (24 circuits)                                              │
│  ├── sessions/                   ← Parquet files per session               │
│  │   ├── 2024/                                                         │
│  │   │   ├── Bahrain Grand Prix/                                      │
│  │   │   │   ├── R/                                                  │
│  │   │   │   │   ├── laps.parquet                                    │
│  │   │   │   │   ├── telemetry.parquet                               │
│  │   │   │   │   └── positions.parquet                               │
│  │   │   │   └── ...                                                 │
│  │   │   └── ...                                                     │
│  │   └── ...                                                         │
│  └── models/                     ← ML model outputs                        │
│      ├── clustering_results.json                                        │
│      └── undercut_model.json                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
---
4. Component Hierarchy
src/
├── App.tsx                           # Root application
├── main.tsx                          # Entry point
├── styles/
│   └── index.css                     # Tailwind + custom styles
├── types/
│   └── index.ts                      # TypeScript interfaces
├── constants/
│   └── index.ts                      # Constants (tyre colors, etc.)
├── hooks/
│   ├── useRaceController.ts          # Playback state management
│   ├── useSessionData.ts             # Session data loading
│   ├── useTrackGeometry.ts           # Track coordinate loading
│   ├── useTelemetry.ts               # Telemetry data processing
│   └── useWindowSize.ts              # Responsive utilities
├── stores/
│   └── useRaceStore.ts               # Zustand state store
├── services/
│   ├── duckdb.ts                     # DuckDB-WASM parquet queries
│   └── api.ts                        # ML API integration
├── components/
│   ├── layout/
│   │   ├── Layout.tsx                # Main app layout (4 zones)
│   │   ├── Header.tsx                # Session selector + controls
│   │   └── GlassCard.tsx             # Reusable glassmorphism card
│   ├── map/
│   │   ├── Track3D.tsx               # Deck.gl canvas container
│   │   ├── TrackLayer.tsx            # Track ribbon rendering
│   │   ├── CarMarkers.tsx            # Car icon layer
│   │   └── CornerLabels.tsx          # Turn number markers
│   ├── leaderboard/
│   │   ├── Leaderboard.tsx           # Main leaderboard component
│   │   ├── DriverRow.tsx             # Individual driver card
│   │   └── TyreBadge.tsx             # Compound indicator
│   ├── telemetry/
│   │   ├── SpeedChart.tsx            # ECharts speed trace
│   │   ├── ThrottleGauge.tsx         # Radial throttle gauge
│   │   └── BrakeGauge.tsx            # Radial brake gauge
│   ├── analysis/
│   │   ├── SectorAnalysis.tsx        # Sector time breakdown
│   │   ├── TyreDegradation.tsx       # Degradation graph
│   │   └── H2HComparison.tsx         # Head-to-head delta
│   ├── strategy/
│   │   ├── StrategyPanel.tsx         # Strategy overview
│   │   ├── UndercutWidget.tsx        # Undercut prediction
│   │   └── PitWindow.tsx             # Optimal pit timing
│   ├── ml/
│   │   ├── DriverClusters.tsx        # Cluster visualization
│   │   └── ClusterBadge.tsx          # Cluster label display
│   └── ui/
│       ├── Button.tsx                # Styled button component
│       ├── Select.tsx                # Dropdown selector
│       ├── Slider.tsx                # Playback scrubber
│       ├── Toggle.tsx                # On/off switch
│       └── Loading.tsx               # Loading skeleton
├── pages/
│   ├── Home.tsx                      # Session browser page
│   └── Session.tsx                   # Main dashboard page
└── utils/
    ├── format.ts                     # Time/distance formatters
    ├── colors.ts                     # Team/compound colors
    └── interpolation.ts              # Position interpolation
---
5. State Management
Zustand Store Structure
// useRaceStore.ts
interface RaceState {
  // Session Selection
  selectedYear: number | null;
  selectedRace: string | null;
  selectedSession: 'R' | 'Q' | 'S' | 'SS' | null;
  
  // Playback State
  isPlaying: boolean;
  currentTime: number;        // Current playback time (seconds)
  playbackSpeed: number;      // 0.25x, 0.5x, 1x, 2x, 5x
  sessionDuration: number;    // Total session length
  
  // Playback Controls
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  
  // Data State
  isLoading: boolean;
  loadError: string | null;
  loadSession: (year: number, race: string, session: string) => Promise<void>;
  
  // Driver Selection
  selectedDriver: string | null;
  setSelectedDriver: (driver: string | null) => void;
  
  // View State
  activeTab: 'telemetry' | 'analysis' | 'strategy' | 'ml';
  setActiveTab: (tab: string) => void;
  
  // Telemetry Range
  telemetryWindow: number;    // Time window for charts (seconds)
  setTelemetryWindow: (window: number) => void;
}
interface SessionData {
  metadata: {
    year: number;
    raceName: string;
    sessionType: string;
    duration: number;
    totalLaps: number;
  };
  drivers: DriverInfo[];
  laps: LapRecord[];
  telemetry: TelemetryRecord[];
  positions: PositionRecord[];
}
interface DriverInfo {
  driverName: string;
  driverNumber: number;
  teamName: string;
  teamColor: string;
  cluster?: string;           // From ML model
  clusterLabel?: string;
}
Data Flow
User selects session
        │
        ▼
SessionBrowser → useRaceStore.loadSession()
                        │
                        ▼
              DuckDB-WASM loads parquet
                        │
                        ▼
              SessionData → RaceController
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Deck.gl         Leaderboard      Charts
   (positions)     (laps sorted)    (telemetry)
        │               │               │
        └───────────────┴───────────────┘
                        │
                        ▼
              User interacts (play/seek)
                        │
                        ▼
              RaceController updates currentTime
                        │
                        ▼
              All components re-render at 60fps
---
6. Key Technical Implementations
6.1 Track Geometry (TUMFTM Integration)
// types/track.ts
interface TrackGeometry {
  name: string;
  country: string;
  centerline: [number, number][];      // x, y coordinates (meters)
  trackWidth: number;                  // Average width (meters)
  corners: Corner[];
  drsZones: DRSZone[];
  startPosition: [number, number];     // Grid position
  pitEntry: [number, number];
  pitExit: [number, number];
}
interface Corner {
  name: string;        // "T1", "T2", etc.
  index: number;       // Index along centerline
  apex: [number, number];
  angle: number;       // Turn angle in degrees
}
interface DRSZone {
  startIndex: number;
  endIndex: number;
  detectionPoint: number;
}
// Load track geometry
function useTrackGeometry(trackName: string) {
  const [geometry, setGeometry] = useState<TrackGeometry | null>(null);
  
  useEffect(() => {
    fetch(`/tracks/${trackName.toLowerCase().replace(/ /g, '-')}.json`)
      .then(res => res.json())
      .then(data => setGeometry(data));
  }, [trackName]);
  
  return geometry;
}
6.2 Deck.gl Track Rendering
// components/map/Track3D.tsx
import { DeckGL } from '@deck.gl/react';
import { PathLayer, IconLayer, TextLayer } from '@deck.gl/layers';
function Track3D({ 
  track, 
  positions, 
  currentTime,
  selectedDriver 
}: Track3DProps) {
  // Interpolate car positions for smooth animation
  const interpolatedPositions = useMemo(() => {
    return positions.map(driver => ({
      ...driver,
      position: interpolatePosition(driver.positions, currentTime)
    }));
  }, [positions, currentTime]);
  
  const layers = [
    // Track ribbon with gradient based on sector times
    new PathLayer({
      id: 'track',
      data: [track],
      getPath: d => d.centerline,
      getColor: [60, 60, 60],
      getWidth: track.trackWidth,
      widthMinPixels: 2
    }),
    
    // DRS zones highlight
    new PathLayer({
      id: 'drs-zones',
      data: track.drsZones,
      getPath: d => track.centerline.slice(d.startIndex, d.endIndex),
      getColor: [0, 255, 255, 100],  // Cyan highlight
      getWidth: track.trackWidth + 2
    }),
    
    // Car markers
    new IconLayer({
      id: 'cars',
      data: interpolatedPositions,
      getIcon: d => ({
        url: `/icons/car-${d.teamColor}.svg`,
        width: 32,
        height: 32,
        anchorX: 16,
        anchorY: 16
      }),
      getPosition: d => projectToLngLat(d.position),  // Convert to lat/lng
      getSize: d => d.driverName === selectedDriver ? 40 : 32,
      sizeScale: 1,
      pickable: true
    }),
    
    // Corner labels
    new TextLayer({
      id: 'corners',
      data: track.corners,
      getPosition: d => projectToLngLat(d.apex),
      getText: d => d.name,
      getSize: 14,
      getColor: [255, 255, 255, 180],
      getAlignmentBaseline: 'center'
    })
  ];
  
  return (
    <DeckGL
      initialViewState={{
        longitude: track.centerline[0][0],
        latitude: track.centerline[0][1],
        zoom: 14,
        pitch: 45,
        bearing: 0
      }}
      controller={true}
      layers={layers}
      getTooltip={({object}) => object && {
        html: `<div>${object.driverName}</div>`
      }}
    />
  );
}
6.3 Playback Engine
// hooks/useRaceController.ts
interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
}
function useRaceController(sessionData: SessionData | null) {
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    playbackSpeed: 1
  });
  
  const animationRef = useRef<number>();
  const lastFrameTime = useRef<number>();
  
  // Playback loop using requestAnimationFrame
  const tick = useCallback((timestamp: number) => {
    if (!lastFrameTime.current) {
      lastFrameTime.current = timestamp;
    }
    
    const delta = (timestamp - lastFrameTime.current) / 1000;  // seconds
    lastFrameTime.current = timestamp;
    
    setState(prev => {
      if (!prev.isPlaying || !sessionData) return prev;
      
      const newTime = prev.currentTime + (delta * prev.playbackSpeed);
      
      // Loop or stop at end
      if (newTime >= sessionData.metadata.duration) {
        return { ...prev, isPlaying: false, currentTime: sessionData.metadata.duration };
      }
      
      return { ...prev, currentTime: newTime };
    });
    
    if (state.isPlaying) {
      animationRef.current = requestAnimationFrame(tick);
    }
  }, [sessionData, state.isPlaying]);
  
  // Start/stop animation
  useEffect(() => {
    if (state.isPlaying) {
      animationRef.current = requestAnimationFrame(tick);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastFrameTime.current = undefined;
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isPlaying, tick]);
  
  const play = () => setState(prev => ({ ...prev, isPlaying: true }));
  const pause = () => setState(prev => ({ ...prev, isPlaying: false }));
  const seek = (time: number) => {
    setState(prev => ({ ...prev, currentTime: Math.max(0, Math.min(time, sessionData?.metadata.duration || 0)) }));
  };
  const setSpeed = (speed: number) => setState(prev => ({ ...prev, playbackSpeed: speed }));
  
  return {
    ...state,
    play,
    pause,
    seek,
    setSpeed,
    duration: sessionData?.metadata.duration || 0
  };
}
6.4 ECharts Telemetry
// components/telemetry/SpeedChart.tsx
import ReactECharts from 'echarts-for-react';
function SpeedChart({ 
  telemetry, 
  currentTime, 
  timeWindow = 10  // Show 10 seconds of history
}: SpeedChartProps) {
  // Filter data for current time window
  const chartData = useMemo(() => {
    if (!telemetry) return [];
    
    const startTime = currentTime - timeWindow;
    return telemetry
      .filter(d => d.timestamp >= startTime && d.timestamp <= currentTime)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [telemetry, currentTime, timeWindow]);
  
  // Group by driver for multi-line display
  const series = useMemo(() => {
    const drivers = new Set(chartData.map(d => d.driverName));
    return Array.from(drivers).map(driver => ({
      name: driver,
      type: 'line',
      data: chartData
        .filter(d => d.driverName === driver)
        .map(d => [d.timestamp, d.speed]),
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: 2
      },
      emphasis: {
        focus: 'series'
      }
    }));
  }, [chartData]);
  
  const option = {
    animation: false,  // Disable for performance
    grid: {
      left: 50,
      right: 20,
      top: 20,
      bottom: 30
    },
    xAxis: {
      type: 'value',
      min: currentTime - timeWindow,
      max: currentTime,
      axisLabel: {
        formatter: (value: number) => formatTime(value)
      }
    },
    yAxis: {
      type: 'value',
      name: 'Speed (km/h)',
      min: 0,
      max: 350
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        // Custom tooltip
      }
    },
    series
  };
  
  return <ReactECharts option={option} style={{ height: '200px' }} />;
}
---
7. Data Processing Pipeline
7.1 Parquet Loading with DuckDB-WASM
// services/duckdb.ts
import { DuckDB } from '@duckdb/duckdb-wasm';
let db: DuckDB | null = null;
let conn: any = null;
async function initDuckDB() {
  if (db) return db;
  
  const JSDELIVR_BUNDLES = {
    mvp: {
      mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-mvp.wasm',
      mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser.mvp.worker.js',
    },
    eh: {
      mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-eh.wasm',
      mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser.eh.worker.js',
    },
  };
  
  const bundle = JSDELIVR_BUNDLES.mvp;
  db = new DuckDB();
  await db.instantiate(bundle.mainModule, bundle.mainWorker);
  conn = await db.connect();
  
  return db;
}
async function queryLapData(year: number, race: string, session: string) {
  const db = await initDuckDB();
  const path = `/sessions/${year}/${race}/${session}/laps.parquet`;
  
  await conn.query(`
    CREATE TABLE laps AS SELECT * FROM parquet_scan('${path}')
  `);
  
  const result = await conn.query(`
    SELECT 
      driver_name,
      driver_number,
      lap_number,
      position,
      lap_time_seconds,
      tyre_compound,
      tyre_age_laps,
      sector_1_time,
      sector_2_time,
      sector_3_time,
      is_valid_lap
    FROM laps
    ORDER BY lap_number
  `);
  
  return result.toArray().map(row => ({
    driverName: row.driver_name,
    driverNumber: row.driver_number,
    lapNumber: row.lap_number,
    position: row.position,
    lapTime: row.lap_time_seconds,
    tyreCompound: row.tyre_compound,
    tyreAge: row.tyre_age_laps,
    sector1: row.sector_1_time,
    sector2: row.sector_2_time,
    sector3: row.sector_3_time,
    isValid: row.is_valid_lap
  }));
}
---
8. UI Design System
Color Palette
// constants/colors.ts
export const COLORS = {
  // Backgrounds
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceHover: '#242424',
  
  // Accents
  primary: '#e10600',        // F1 Red
  primaryLight: '#ff4d4d',
  secondary: '#1c1c1e',
  
  // Status
  green: '#34c759',
  yellow: '#ffcc00',
  red: '#ff3b30',
  orange: '#ff9500',
  
  // Tyre Compounds
  soft: '#ff3333',           // Red
  medium: '#f2f520',         // Yellow
  hard: '#ffffff',           // White
  intermediate: '#43d13e',   // Green
  wet: '#0066ff',            // Blue
  
  // Track Status
  green: '#34c759',
  yellow: '#ffcc00',
  red: '#ff3b30',
  sc: '#ff9500',             // Safety Car
  vsc: '#af52de',            // VSC
  
  // Text
  text: '#ffffff',
  textSecondary: '#8e8e93',
  textMuted: '#48484a'
};
export const TEAM_COLORS: Record<string, string> = {
  'Ferrari': '#e8002d',
  'Mercedes': '#00d2be',
  'Red Bull Racing': '#1e41ff',
  'McLaren': '#ff8000',
  'Aston Martin': '#006e62',
  'Alpine': '#0093cc',
  'Williams': '#64c4ff',
  'RB': '#6692ff',
  'Sauber': '#52e252',
  'Haas': '#b6babd',
  'Williams': '#64c4ff'
};
Typography
/* styles/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
:root {
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
body {
  font-family: var(--font-primary);
  background-color: #0a0a0a;
  color: #ffffff;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/* Glassmorphism utility */
.glass-card {
  background: rgba(26, 26, 26, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #1a1a1a;
}
::-webkit-scrollbar-thumb {
  background: #48484a;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #636366;
}
---
9. Performance Optimization Strategy
Rendering Performance
| Technique | Implementation |
|-----------|---------------|
| Memoization | useMemo, React.memo for expensive computations |
| Virtual Scrolling | Only render visible leaderboard rows |
| Layer Culling | Don't render Deck.gl layers outside view |
| Data Downsampling | For telemetry charts, render max 1000 points |
| RequestAnimationFrame | Smooth playback at 60fps |
| Web Workers | Offload DuckDB queries and data processing |
Bundle Optimization
| Technique | Implementation |
|-----------|---------------|
| Code Splitting | Lazy load route components |
| Tree Shaking | Remove unused exports |
| Dynamic Imports | Load Deck.gl/ECharts on demand |
| Asset Compression | Vercel automatic gzip/brotli |
60fps Playback Target
Frame Budget: 16.67ms per frame
├── React Render:     ~4ms  (Component updates)
├── Deck.gl Render:   ~8ms  (WebGL draw calls)
├── ECharts Render:   ~2ms  (Canvas updates)
└── JavaScript:       ~2ms  (State updates, calculations)
---
10. API Integration
ML Model Endpoints
// services/api.ts
import axios from 'axios';
const API_BASE = '/api/v1';
export const api = {
  // Get driver cluster
  async getDriverCluster(driverName: string) {
    const response = await axios.get(`${API_BASE}/models/clustering`, {
      params: { driver: driverName }
    });
    return response.data;
  },
  
  // Get undercut prediction
  async predictUndercut(params: UndercutParams) {
    const response = await axios.get(`${API_BASE}/models/undercut/predict`, { params });
    return response.data;
  },
  
  // Get strategy analysis
  async getStrategyAnalysis() {
    const response = await axios.get(`${API_BASE}/models/strategy`);
    return response.data;
  },
  
  // List available models
  async listModels() {
    const response = await axios.get(`${API_BASE}/models/list`);
    return response.data;
  }
};
---
11. Folder Structure Summary
telemetryx-dashboard/
├── public/
│   ├── tracks/                    # TUMFTM track coordinates (24 circuits)
│   │   ├── bahrain.json
│   │   ├── monaco.json
│   │   └── ...
│   └── icons/                     # SVG icons
│       ├── car-red.svg
│       └── ...
├── src/
│   ├── components/                # React components
│   │   ├── map/                   # Deck.gl visualization
│   │   ├── leaderboard/           # Driver standings
│   │   ├── telemetry/             # Charts and gauges
│   │   ├── analysis/              # Data analysis
│   │   ├── strategy/              # Strategy widgets
│   │   ├── ml/                    # ML model displays
│   │   └── ui/                    # Reusable UI
│   ├── hooks/                     # Custom React hooks
│   ├── stores/                    # Zustand stores
│   ├── services/                  # API and data services
│   ├── types/                     # TypeScript definitions
│   ├── utils/                     # Helper functions
│   ├── constants/                 # Constants and enums
│   └── styles/                    # CSS and Tailwind
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
---
12. Deployment Strategy
Vercel Deployment
# vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/tracks/(.*).json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/sessions/(.*).parquet",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
Performance Budgets
| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1s | Lighthouse |
| Time to Interactive | < 2s | Lighthouse |
| Bundle Size (initial) | < 500KB | Vercel Analytics |
| Frame Rate | 60fps | Chrome DevTools |
| LCP | < 2.5s | Lighthouse |
---
13. Implementation Timeline
| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | Day 1-2 | Project setup, Session Browser |
| Phase 2 | Day 3-4 | Track geometry, Deck.gl integration |
| Phase 3 | Day 5-6 | Playback engine, state management |
| Phase 4 | Day 7 | Leaderboard UI |
| Phase 5 | Day 8-9 | Telemetry charts |
| Phase 6 | Day 10-11 | ML integration |
| Phase 7 | Day 12-14 | Polish, responsive, deploy |
Total Estimated Time: 14 days (part-time)
---
14. Known Limitations & Future Improvements
V1.0 Limitations
- No live data (historical playback only)
- No mobile optimization (desktop-focused)
- Limited to TUMFTM track database circuits
- No offline support
Future Improvements (V2.0+)
- Live data integration (WebSocket)
- Mobile responsive design
- Custom track definitions
- Offline PWA support
- Real-time collaboration
- Export to PDF/CSV