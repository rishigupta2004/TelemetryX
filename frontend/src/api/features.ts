import { get } from './client'
import type {
  ComparisonFeature,
  LapFeature,
  OvertakeFeature,
  PointsFeature,
  PositionFeature,
  RaceContextFeature,
  TelemetryFeature,
  TrafficFeature,
  TyreFeature
} from '../types'
import { slugifyRace } from './sessions'

export async function fetchLapFeatures(year: number, race: string, session: string): Promise<LapFeature[]> {
  const slug = slugifyRace(race)
  return get<LapFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/lap`)
}

export async function fetchTyreFeatures(year: number, race: string, session: string): Promise<TyreFeature[]> {
  const slug = slugifyRace(race)
  return get<TyreFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/tyre`)
}

export async function fetchTelemetryFeatures(year: number, race: string, session: string): Promise<TelemetryFeature[]> {
  const slug = slugifyRace(race)
  return get<TelemetryFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/telemetry`)
}

export async function fetchComparisonFeatures(year: number, race: string, session: string): Promise<ComparisonFeature[]> {
  const slug = slugifyRace(race)
  return get<ComparisonFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/comparison`)
}

export async function fetchPositionFeatures(year: number, race: string, session: string): Promise<PositionFeature[]> {
  const slug = slugifyRace(race)
  return get<PositionFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/position`)
}

export async function fetchRaceContextFeatures(year: number, race: string, session: string): Promise<RaceContextFeature[]> {
  const slug = slugifyRace(race)
  return get<RaceContextFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/race-context`)
}

export async function fetchTrafficFeatures(year: number, race: string, session: string): Promise<TrafficFeature[]> {
  const slug = slugifyRace(race)
  return get<TrafficFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/traffic`)
}

export async function fetchOvertakesFeatures(year: number, race: string, session: string): Promise<OvertakeFeature[]> {
  const slug = slugifyRace(race)
  return get<OvertakeFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/overtakes`)
}

export async function fetchPointsFeatures(year: number, race: string, session: string): Promise<PointsFeature[]> {
  const slug = slugifyRace(race)
  return get<PointsFeature[]>(`/features/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/points`)
}
