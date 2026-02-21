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
  driverImage?: string | null
  teamImage?: string | null
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

export interface PointsFeatureRow {
  driver_name: string
  final_position: number
  total_laps: number
  points: number
  year: number
  race_name: string
  session: string
}

export interface IdentityAssetDriver {
  driverNumber: number | null
  driverName: string
  teamName: string
  driverImage: string | null
  teamImage: string | null
}

export interface IdentityAssetsResponse {
  year: number
  race: string
  session: string
  enabled: boolean
  reason: string | null
  source?: string
  n_driver_images?: number
  n_team_images?: number
  drivers: IdentityAssetDriver[]
}

export interface DriverSummaryResponse {
  driver: string
  compare: string
  available?: boolean
  reason?: string | null
  lap_analysis: {
    lap_number: number | null
    position: number | null
    last_lap_time: string | null
    sector_times: Array<number | null>
    is_valid: boolean | null
    lap_quality_score: number | null
    lap_delta_to_leader: number | null
    track_status_at_lap: string | null
    tyre_compound: string | null
    tyre_age_laps: number | null
    personal_best: number | null
    session_best: number | null
  }
  driver_performance: {
    start_position: number | null
    end_position: number | null
    position_change: number | null
    laps_led: number | null
    best_position: number | null
    worst_position: number | null
    points: number | null
    overtakes_made: number | null
    positions_lost_defensive: number | null
  }
  tyre_analysis: {
    stint_number: number | null
    stint_length: number | null
    current_compound: string | null
    tyre_age: number | null
    tyre_degradation_rate: number | null
    tyre_life_remaining: number | null
    pit_stop_count: number | null
    tyre_strategy_sequence: string | null
  }
  telemetry_analysis: {
    speed_max: number | null
    speed_avg: number | null
    throttle_avg: number | null
    brake_avg: number | null
    drs_usage_pct: number | null
    gear_changes: number | null
  }
  race_context: {
    track_status: string | null
    weather: string | null
    air_temp: number | null
    track_temp: number | null
    wind_speed: number | null
    wind_direction: number | null
    humidity: number | null
    rainfall: number | null
  }
  strategic_analysis: {
    current_lap: number | null
    current_position: number | null
    stint_length: number | null
    optimal_pit_window: number | null
    traffic_time_lost: number | null
    tyre_degradation_rate: number | null
    tyre_life_remaining: number | null
  }
  comparison?: {
    pace_delta_seconds: number | null
    head_to_head_winner: string | null
  }
}

export interface UndercutPredictRequest {
  position_before_pit: number
  tyre_age: number
  stint_length: number
  compound: string
  track_temp?: number
  pit_lap?: number
  race_name?: string
}

export interface UndercutPredictResponse {
  prediction: string
  success_probability: number
  confidence: string
  summary: string
  strategy_call: string
  recommendations: string[]
}

export interface StrategyRecommendationItem {
  strategy: string
  avg_finish_position: number
  avg_points: number
  podium_probability: number
  points_probability: number
  avg_pit_stops: number
  compounds?: string[]
  pit_laps?: number[]
}

export interface StrategyRecommendationsResponse {
  year: number
  race_name: string
  n_simulations: number
  best_strategy: StrategyRecommendationItem
  all_strategies: Record<string, StrategyRecommendationItem>
}

export interface StrategyRecommendationsWithSource {
  sourceYear: number
  data: StrategyRecommendationsResponse
}

export interface ClusterDriverRow {
  driver_name: string
  cluster: number
  probabilities?: Record<number, number> | null
}

export interface ClusteringResponse {
  status: string
  n_drivers: number
  n_clusters: number
  silhouette_score: number
  cluster_labels: Record<string, string>
  clusters: ClusterDriverRow[]
}

export type FiaDocumentCategory =
  | 'stewards_decision'
  | 'race_director_note'
  | 'technical_directive'
  | 'classification'
  | 'scrutineering'
  | 'entry_list'
  | 'other'

export interface FiaDocumentItem {
  key: number
  doc_number: number
  title: string
  category: FiaDocumentCategory
  published_raw: string
  published_at: string | null
  published_epoch: number | null
  timezone: string | null
  url: string
  filename: string
}

export interface FiaDocumentsResponse {
  year: number
  requested_race: string
  event_name: string
  season_path: string
  event_path: string
  source: string
  fetched_at: string
  total_documents: number
  category_counts: Record<string, number>
  latest_published_at: string | null
  documents: FiaDocumentItem[]
}

export interface FiaDocumentEvent {
  name: string
  path: string
}

export interface FiaDocumentSeason {
  year: number
  path: string | null
}

export interface FiaDocumentSeasonsResponse {
  n_seasons: number
  seasons: FiaDocumentSeason[]
  source: string
  fetched_at: string
}

export interface FiaDocumentEventsResponse {
  year: number
  season_path: string
  n_events: number
  events: FiaDocumentEvent[]
  source: string
  fetched_at: string
}
