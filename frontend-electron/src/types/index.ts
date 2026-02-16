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

export interface TyreStint {
  year: number
  race_name: string
  session: string
  driver_name: string
  driver_number: number
  stint_number: number
  tyre_compound: string
  tyre_age_at_stint_start: number
  tyre_age_at_stint_end: number
  tyre_laps_in_stint: number
  tyre_degradation_rate: number
  pit_stop_count: number
  first_lap: number
  last_lap: number
  estimated_tyre_temp: number
  grip_level: number
  traffic_density: number
  position: number
  is_overtake_lap: number
  tyre_gap_ahead: number
  tyre_gap_behind: number
  tyre_life_remaining: number
  optimal_pit_window: number
  tyre_strategy_sequence: string
}
