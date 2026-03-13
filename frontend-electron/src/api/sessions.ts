import { get } from './client'
import type { LapRow, Race, Season, SessionInfoResponse, SessionResponse } from '../types'

export function normalizeKey(value: string): string {
  if (value == null) return ''
  let text = value.replace(/-/g, ' ').replace(/_/g, ' ').trim()
  text = text.normalize('NFKD')
  text = Array.from(text).filter((ch) => !/\p{M}/u.test(ch)).join('')
  text = text.replace(/\s+/g, ' ').trim().toLowerCase()
  return text
}

export function slugifyRace(race: string): string {
  return normalizeKey(race).replace(/\s+/g, '-')
}

const SESSION_DISPLAY_TO_CODE: Record<string, string> = {
  'Race': 'R',
  'Qualifying': 'Q',
  'Sprint Qualifying': 'SQ',
  'Sprint': 'S',
  'Sprint Race': 'SR',
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
}

export function sessionDisplayToCode(display: string): string {
  return SESSION_DISPLAY_TO_CODE[display] ?? display
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
