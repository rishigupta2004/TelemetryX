// Session Types
export type SessionType = 'R' | 'Q' | 'S' | 'SS';

// Session Data Types
export interface SessionMetadata {
  year: number;
  raceName: string;
  sessionType: SessionType;
  duration: number;
  totalLaps: number;
}

export interface SessionData {
  metadata: SessionMetadata;
  drivers: DriverInfo[];
  laps: LapRecord[];
  telemetry: TelemetryRecord[];
  positions: PositionRecord[];
}

export interface Corner {
  name: string;
  index: number;
  apex: [number, number];
  angle: number;
}

export interface DRSZone {
  startIndex: number;
  endIndex: number;
  detectionPoint: number;
}

export interface DriverInfo {
  driverName: string;
  driverNumber: number;
  teamName: string;
  teamColor: string;
  cluster?: string;
  clusterLabel?: string;
}

export interface LapRecord {
  driverName: string;
  driverNumber: number;
  lapNumber: number;
  position: number;
  lapTime: number;
  tyreCompound: string;
  tyreAge: number;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  isValid: boolean;
}

export interface TelemetryRecord {
  driverNumber: number;
  timestamp: number;
  speed: number;
  throttle: number;
  brake: boolean;
  drs: number;
  gear: number | null;
}

export interface PositionRecord {
  driverNumber: number;
  timestamp: number;
  x: number;
  y: number;
  z?: number;
}

// Playback State Types
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  duration: number;
}

export interface SelectedSession {
  year: number;
  race: string;
  session: SessionType;
}

// API Response Types
export interface DriverCluster {
  driverName: string;
  cluster: number;
  clusterLabel: string;
  probabilities?: Record<number, number>;
}

export interface UndercutPrediction {
  prediction: 'SUCCESS' | 'FAILURE';
  successProbability: number;
  confidence: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export interface StrategyAnalysis {
  commonStrategies: string[];
  winningCompounds: string[];
  avgPitStops: number;
}

// UI State Types
export interface ActiveTab {
  id: 'telemetry' | 'analysis' | 'strategy' | 'ml';
  label: string;
}

export const ACTIVE_TABS: ActiveTab[] = [
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'ml', label: 'ML Models' },
];

// Filter Types
export interface DriverFilter {
  showAll: boolean;
  selectedDrivers: string[];
  showDriversWithTyreIssue: boolean;
  tyreCompoundFilter: string[];
}

// Chart Data Types
export interface SpeedTraceData {
  timestamp: number;
  speed: number;
  driverName: string;
}

export interface SectorData {
  driverName: string;
  s1: number;
  s2: number;
  s3: number;
  lapTime: number;
}
