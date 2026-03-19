/** Typed error shape exposed by stores — preserves HTTP status for 404/500 differentiation. */
export interface ApiErrorInfo {
  code: number | null
  message: string
}

export interface Season {
  year: number
  startDate?: string
  endDate?: string
}

export interface Race {
  year?: number
  round?: number
  race_name?: string
  display_name?: string
  name?: string
  slug?: string
  country?: string
  city?: string
  date?: string
  sessions?: string[]
  startDate?: string
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
  pitInTimeFormatted?: string | null
  pitOutTimeFormatted?: string | null
  pitInSeconds?: number | null
  pitOutSeconds?: number | null
  pitInLaneTimeSeconds?: number | null
  pitOutLaneTimeSeconds?: number | null
  sector1: number | null
  sector2: number | null
  sector3: number | null
}

export interface PositionRow {
  timestamp: number
  driverNumber: number
  x: number
  y: number
  sourceTimestamp?: number | null
  quality?: 'ok' | 'stale' | 'invalid' | null
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

export interface SessionInfoResponse {
  year: number
  race: string
  n_sessions: number
  sessions: string[]
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

export type SessionResponse = SessionVizResponse

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

export type FeatureValue = string | number | boolean | null
export type FeatureRow = Record<string, FeatureValue>

export type LapFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
  driver_name: string
  driver_number: number
  lap_number: number
}

export type TyreFeature = TyreStint

export type TelemetryFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
  driver_name: string
  driver_number: number
}

export type ComparisonFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
  driver_name: string
}

export type PositionFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
  driver_name: string
  driver_number: number
}

export type RaceContextFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
}

export type TrafficFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
  driver_name: string
}

export type OvertakeFeature = FeatureRow & {
  year: number
  race_name: string
  session: string
  driver_name: string
}

export type PointsFeature = PointsFeatureRow


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

export interface UndercutEvent {
  year: number
  race_name: string
  session: string
  driver_name: string
  pit_lap: number
  position_before_pit: number
  position_after_pit: number
  position_change: number
  tyre_age: number
  stint_length: number
  compound: string
  compound_ordinal: number
  track_stress: number
  undercut_success: number
}

export interface UndercutEventsResponse {
  status: string
  n_events: number
  returned_events: number
  success_rate: number
  events: UndercutEvent[]
}

export interface StrategyRecommendationItem {
  strategy: string
  avg_finish_position: number
  avg_points: number
  podium_probability?: number | null
  points_probability?: number | null
  avg_pit_stops: number
  compounds?: string[] | null
  pit_laps?: number[] | null
}

export interface StrategyRecommendationsResponse {
  year: number
  race_name: string
  n_simulations: number
  best_strategy: StrategyRecommendationItem
  all_strategies: Record<string, StrategyRecommendationItem>
}

export interface SimulationDistribution {
  mean: number
  p10: number
  p50: number
  p90: number
}

export interface RegulationSimulationStrategyProjection {
  strategy: string
  expected_points: number
  avg_finish_position: number
  podium_probability: number
  avg_pit_stops: number
  confidence: number
  points_band: SimulationDistribution
}

export interface RegulationAssumption {
  mean: number
  std: number
  confidence?: 'high' | 'medium' | 'low' | 'unknown'
  classification?: 'official_fixed' | 'estimated' | 'unknown'
  source_urls?: string[]
}

export interface RegulationDiffRow {
  key: string
  label: string
  unit: string
  baseline: number | string | null
  target: number | string | null
  delta: number | null
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  classification: 'official_fixed' | 'estimated' | 'unknown'
  notes: string[]
  source_urls: string[]
}

export interface RegulationDiff {
  baseline_year: number
  target_year: number
  baseline_generation?: string | null
  target_generation?: string | null
  rows: RegulationDiffRow[]
  source_urls: string[]
}

export interface RegulationSimulationResponse {
  baseline_year: number
  source_year: number
  target_year: number
  race_name: string
  team_profile: string
  track_type: string
  n_samples: number
  seed: number
  assumptions: Record<string, RegulationAssumption>
  regulation_diff: RegulationDiff
  metrics: {
    lap_time_delta_seconds: SimulationDistribution
    race_time_delta_seconds: SimulationDistribution
    tyre_degradation_delta: SimulationDistribution
    pit_loss_delta_seconds: SimulationDistribution
  }
  strategy_projection: RegulationSimulationStrategyProjection[]
  diagnostics?: {
    elapsed_ms: number
    cache_hit: boolean
    assumption_confidence_score?: number
    fallback_gap_years?: number
    confidence_scale?: number
  }
  notes: string[]
}

export interface RegulationSimulationCompareFailure {
  baseline_year: number
  status_code: number
  detail: unknown
}

export interface RegulationSimulationCompareResponse {
  race_name: string
  target_year: number
  team_profile: string
  n_samples: number
  selected_baselines: number[]
  simulations: RegulationSimulationResponse[]
  failures: RegulationSimulationCompareFailure[]
  diagnostics?: {
    elapsed_ms_total: number
    cache_hit_count: number
    avg_simulation_elapsed_ms?: number | null
  }
  source_urls: string[]
}

export interface BacktestResultRow {
  metric: string
  predicted: number
  actual: number
  error: number
}

export interface BacktestAccuracySummary {
  mae_points: number | null
  mae_position: number | null
  has_comparison: boolean
}

export interface RegulationSimulationBacktestResponse {
  baseline_year: number
  target_year: number
  shift_label: string
  team_profile: string
  n_samples: number
  simulation?: RegulationSimulationResponse
  backtest_results: BacktestResultRow[]
  accuracy_summary: BacktestAccuracySummary
  diagnostics?: {
    elapsed_ms: number
  }
  notes: string[]
}

export interface ClusterDriverRow {
  driver_name: string
  cluster: number
  probabilities?: Record<number, number> | null
}

export type ClusterResult = ClusterDriverRow

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

export interface SeasonDriverStanding {
  position: number
  driverNumber: number | null
  driverName: string
  teamName: string
  points: number
  wins: number
  podiums: number
  starts: number
  bestFinish: number | null
  seasons: number
  bestQuali: number | null
  bestRace: {
    raceName: string
    finish: number
    points: number
    fastestLapTime: number | null
    avgLapTime: number | null
  } | null
  seasonPointsProgression: Array<{
    raceName: string
    finish: number
    points: number
  }>
}

export interface SeasonConstructorStanding {
  position: number
  teamName: string
  points: number
  wins: number
  podiums: number
  starts: number
  bestFinish: number | null
  driverCount: number
}

export interface SeasonStandingsResponse {
  year: number
  roundsCount: number
  lastRace: string
  drivers: SeasonDriverStanding[]
  constructors: SeasonConstructorStanding[]
  sourceFiles: string[]
  generatedAt: number
}

export interface DriverCareerProfile {
  driverNumber: number | null
  driverName: string
  fullName?: string | null
  teamName: string
  driverImage?: string | null
  age: number | null
  nationality?: string | null
  dateOfBirth?: string | null
  wikipediaUrl?: string | null
  starts: number
  seasons: number
  seasonYears: number[]
  poles: number | null
  wins: number
  podiums: number
  points: number
  championships: number
  bestFinish: number | null
  bestQuali: number | null
  achievements: string[]
  records: string[]
  bestRace: {
    raceName: string
    year: number
    finish: number
    points: number
  } | null
  bestMoments: string[]
}

export interface TeamCareerProfile {
  teamName: string
  teamImage?: string | null
  seasons: number
  seasonYears: number[]
  starts: number
  wins: number
  podiums: number
  points: number
  championships: number
  bestFinish: number | null
  records: string[]
}

export interface ProfilesResponse {
  drivers: DriverCareerProfile[]
  teams: TeamCareerProfile[]
  generatedAt: number
  availableYears: number[]
}

export interface CircuitInsightsResponse {
  year: number
  race: string
  circuitName: string | null
  country: string | null
  layoutYear: number | null
  trackWidth: number | null
  cornerCount: number
  drsZoneCount: number
  sectorCount: number
  pointCount: number
  facts: Record<string, string>
  source: string
  sourceUrl: string | null
  generatedAt: number
}
