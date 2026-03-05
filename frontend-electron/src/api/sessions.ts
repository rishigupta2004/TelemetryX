import { get } from './client'
import type { LapRow, Race, Season, SessionInfoResponse, SessionResponse } from '../types'

export function slugifyRace(race: string): string {
  return race.trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export async function fetchSeasons(): Promise<Season[]> {
  return get<Season[]>('/seasons')
}

export async function fetchRaces(year: number): Promise<Race[]> {
  return get<Race[]>(`/races/${year}`)
}

export async function fetchSessions(year: number, race: string): Promise<SessionInfoResponse> {
  const slug = slugifyRace(race)
  return get<SessionInfoResponse>(`/features/${year}/${encodeURIComponent(slug)}`)
}

export async function fetchSession(year: number, race: string, session: string): Promise<SessionResponse> {
  const slug = slugifyRace(race)
  return get<SessionResponse>(`/sessions/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}`)
}

export async function fetchLaps(year: number, race: string, session: string): Promise<LapRow[]> {
  const slug = slugifyRace(race)
  return get<LapRow[]>(`/sessions/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/laps`)
}

export async function fetchPositions(year: number, race: string, session: string): Promise<any[]> {
  const slug = slugifyRace(race)
  return get<any[]>(`/sessions/${year}/${encodeURIComponent(slug)}/${encodeURIComponent(session)}/positions?hz=2`)
}
