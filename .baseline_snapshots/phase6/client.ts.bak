import type { LapRow, Race, Season, SessionVizResponse, TelemetryResponse } from '../types'

const BASE_URL = 'http://localhost:8000/api/v1'

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  getSeasons: () => get<Season[]>('/seasons'),
  getRaces: (year: number) => get<Race[]>(`/seasons/${year}/races`),
  getSessionViz: (year: number, race: string, session: string) =>
    get<SessionVizResponse>(
      `/sessions/${year}/${encodeURIComponent(race)}/${session}/viz?include_weather=1&include_race_control=1`
    ),
  getLaps: (year: number, race: string, session: string) =>
    get<LapRow[]>(`/sessions/${year}/${encodeURIComponent(race)}/${session}/laps`),
  getTelemetry: (year: number, race: string, session: string, t0?: number, t1?: number, hz?: number) => {
    let path = `/sessions/${year}/${encodeURIComponent(race)}/${session}/telemetry`
    const params: string[] = []
    if (t0 !== undefined) params.push(`t0=${t0}`)
    if (t1 !== undefined) params.push(`t1=${t1}`)
    if (hz !== undefined) params.push(`hz=${hz}`)
    if (params.length) path += `?${params.join('&')}`
    return get<TelemetryResponse>(path)
  }
}
