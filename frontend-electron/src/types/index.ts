export interface Season {
  year: number
}

export interface Race {
  name: string
  sessions: string[]
  startDate: string
}

export interface Driver {
  driverName: string
  driverNumber: number
  teamName: string
  teamColor: string
  code: string
}

export interface LapRow {
  driverName: string
  driverNumber: number
  lapNumber: number
  lapTime: number | null
  lapTimeFormatted: string | null
  lapStartSeconds: number
  lapEndSeconds: number
  lapStartTime: number
  position: number
  tyreCompound: string
  isValid: boolean
  isDeleted: boolean
  sector1: number | null
  sector2: number | null
  sector3: number | null
}

export interface PositionRow {
  timestamp: number
  driverNumber: number
  x: number
  y: number
}

export interface WeatherRow {
  timestamp: number
  airTemp: number
  trackTemp: number
  humidity: number
  pressure: number
  windDirection: number
  windSpeed: number
  rainfall: number
}

export interface RaceControlMessage {
  timestamp: number
  time: string
  category: string
  message: string
  flag: string
  scope: string
  sector: number | null
  racingNumber: number | null
  lap: number | null
}

export interface SessionMetadata {
  year: number
  raceName: string
  sessionType: string
  duration: number
  totalLaps: number
  telemetryAvailable: boolean
  telemetryUnavailableReason: string | null
  positionsTimeBounds: [number, number] | null
  telemetryTimeBounds: [number, number] | null
  raceStartSeconds: number | null
  raceEndSeconds: number | null
  raceDurationSeconds: number | null
  sourceVersion: string | null
}

export interface TrackGeometry {
  name: string | null
  country: string | null
  source: string | null
  layoutYear: number | null
  centerline: unknown[]
  pitLaneCenterline: unknown[]
  corners: unknown[]
  sectors: unknown[]
  sectorTimingPoints: unknown[]
  drsZones: unknown[]
  drsDetectionPoints: unknown[]
  marshalPanels: unknown[]
  startPosition: unknown | null
  pitEntry: unknown | null
  pitExit: unknown | null
  trackWidth: number | null
  geojson: unknown | null
}

export interface SessionVizResponse {
  metadata: SessionMetadata
  drivers: Driver[]
  laps: LapRow[]
  positions: PositionRow[]
  weather: WeatherRow[]
  raceControl: RaceControlMessage[]
  trackGeometry: TrackGeometry | null
}

export interface TelemetryRow {
  driverNumber: number
  driverName: string
  timestamp: number
  speed: number
  throttle: number
  brake: number
  rpm: number
  gear: number
  drs: number
  ersDeploy: number | null
  ersHarvest: number | null
}

export interface TelemetryResponse {
  [driverCode: string]: TelemetryRow[]
}
