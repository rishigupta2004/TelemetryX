import type {
  ClusteringResponse,
  CircuitInsightsResponse,
  DriverSummaryResponse,
  FiaDocumentEventsResponse,
  FiaDocumentSeasonsResponse,
  FiaDocumentsResponse,
  IdentityAssetsResponse,
  LapRow,
  PointsFeatureRow,
  Race,
  Season,
  SessionVizResponse,
  SeasonStandingsResponse,
  ProfilesResponse,
  StrategyRecommendationsResponse,
  StrategyRecommendationsWithSource,
  TelemetryResponse,
  TyreStint,
  UndercutEventsResponse,
  UndercutPredictRequest,
  UndercutPredictResponse
} from '../types'
import { API_RETRIES, API_TIMEOUT_MS } from '../lib/constants'

const DEFAULT_BASE_URLS = ['http://localhost:8000/api/v1', 'http://localhost:9010/api/v1']

function isDevMode(): boolean {
  return (import.meta as unknown as { env?: { DEV?: boolean } })?.env?.DEV === true
}

function uniqueUrls(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const normalized = value.trim().replace(/\/+$/, '')
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function resolveBaseUrls(): string[] {
  const viteUrl = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL
  const bridgeUrl = (
    globalThis as unknown as { telemetryx?: { apiBaseUrl?: string | null } }
  )?.telemetryx?.apiBaseUrl
  const runtimeUrl = (globalThis as unknown as { TELEMETRYX_API_BASE_URL?: string }).TELEMETRYX_API_BASE_URL
  const dev = isDevMode()
  if (dev) {
    const urls = uniqueUrls([
      'http://localhost:8000/api/v1',
      viteUrl || '',
      bridgeUrl || '',
      runtimeUrl || ''
    ])
    return urls.filter((url) => !/localhost:9010|127\.0\.0\.1:9010/.test(url))
  }
  return uniqueUrls([viteUrl || '', bridgeUrl || '', runtimeUrl || '', ...DEFAULT_BASE_URLS])
}

const BASE_URLS = resolveBaseUrls()
const ROOT_URLS = BASE_URLS.map((url) => url.replace(/\/api\/v1\/?$/, ''))
let pinnedBaseUrl: string | null = null

export class ApiError extends Error {
  status: number
  path: string
  detail: unknown

  constructor(status: number, path: string, detail: unknown) {
    const detailMsg =
      typeof detail === 'string'
        ? detail
        : typeof (detail as { message?: unknown })?.message === 'string'
          ? String((detail as { message?: unknown }).message)
          : ''
    super(`API error ${status}: ${path}${detailMsg ? ` - ${detailMsg}` : ''}`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.detail = detail
  }
}

async function parseErrorDetail(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  try {
    const payload = await res.json()
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      return (payload as { detail?: unknown }).detail ?? null
    }
    return payload
  } catch {
    return null
  }
}

async function request<T>(path: string, init: RequestInit, retries = 0): Promise<T> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const candidates = pinnedBaseUrl ? [pinnedBaseUrl] : BASE_URLS
    for (const baseUrl of candidates) {
      const controller = new AbortController()
      const timeout = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
      try {
        const res = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal })
        if (!res.ok) {
          throw new ApiError(res.status, path, await parseErrorDetail(res))
        }
        if (!pinnedBaseUrl) pinnedBaseUrl = baseUrl
        return res.json()
      } catch (err) {
        lastErr = err
        if (baseUrl === pinnedBaseUrl) pinnedBaseUrl = null
      } finally {
        globalThis.clearTimeout(timeout)
      }
    }
  }
  throw lastErr ?? new Error(`Request failed: ${path}`)
}

export async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' }, API_RETRIES)
}

export async function getNoRetry<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' }, 0)
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    0
  )
}

function isNotFoundError(err: unknown): boolean {
  return String(err).includes('API error 404')
}

export const api = {
  getBaseUrl: () => BASE_URLS[0],
  getHealth: async () => {
    let lastErr: unknown = null
    for (const rootUrl of ROOT_URLS) {
      const controller = new AbortController()
      const timeout = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
      try {
        const res = await fetch(`${rootUrl}/health`, { method: 'GET', signal: controller.signal })
        if (!res.ok) throw new ApiError(res.status, '/health', await parseErrorDetail(res))
        return (await res.json()) as { status: string }
      } catch (err) {
        lastErr = err
      } finally {
        globalThis.clearTimeout(timeout)
      }
    }
    throw lastErr ?? new Error('Health request failed')
  },
  getSeasons: () => get<Season[]>('/seasons'),
  getRaces: (year: number) => get<Race[]>(`/seasons/${year}/races`),
  getSessionViz: (year: number, race: string, session: string) =>
    get<SessionVizResponse>(
      `/sessions/${year}/${encodeURIComponent(race)}/${session}/viz?include_positions=1&include_weather=1&include_race_control=1`
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
  },
  getTyreStints: (year: number, race: string, session: string) =>
    get<TyreStint[]>(
      `/features/${year}/${encodeURIComponent(race)}/${session}/tyre`
    ),
  getPointsFeatures: (year: number, race: string, session = 'R') =>
    get<PointsFeatureRow[]>(
      `/features/${year}/${encodeURIComponent(race)}/${session}/points`
    ),
  getIdentityAssets: (year: number, race: string, session: string, forceRefresh = false) =>
    get<IdentityAssetsResponse>(
      `/assets/identity/${year}/${encodeURIComponent(race)}/${session}?force_refresh=${forceRefresh ? '1' : '0'}`
    ),
  getDriverSummary: (year: number, race: string, session: string, driver: string, compare?: string) =>
    get<DriverSummaryResponse>(
      `/features/${year}/${encodeURIComponent(race)}/${session}/driver-summary?driver=${encodeURIComponent(driver)}${
        compare ? `&compare=${encodeURIComponent(compare)}` : ''
      }`
    ),
  getClustering: (probabilities = false) =>
    get<ClusteringResponse>(`/models/clustering?probabilities=${probabilities ? '1' : '0'}`),
  getUndercutSummary: () => getNoRetry<{ status: string; n_events: number; model: string }>('/models/undercut'),
  getUndercutEvents: (params?: { year?: number; raceName?: string; successOnly?: boolean; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.year != null) search.set('year', String(params.year))
    if (params?.raceName) search.set('race_name', params.raceName)
    if (params?.successOnly) search.set('success_only', '1')
    if (params?.limit != null) search.set('limit', String(params.limit))
    const suffix = search.size ? `?${search.toString()}` : ''
    return getNoRetry<UndercutEventsResponse>(`/models/undercut/events${suffix}`)
  },
  getStrategyRecommendations: (year: number, race: string) =>
    get<StrategyRecommendationsResponse>(`/models/strategy-recommendations/${year}/${encodeURIComponent(race)}`),
  getStrategyRecommendationsWithFallback: async (
    year: number,
    race: string,
    fallbackYears: number[]
  ): Promise<StrategyRecommendationsWithSource> => {
    const candidates: number[] = []
    const pushYear = (value: number) => {
      const n = Number(value)
      if (!Number.isFinite(n)) return
      const y = Math.trunc(n)
      if (!candidates.includes(y)) candidates.push(y)
    }
    pushYear(year)
    for (const y of fallbackYears) pushYear(y)

    let lastNotFound: unknown = null
    for (const y of candidates) {
      try {
        const data = await getNoRetry<StrategyRecommendationsResponse>(
          `/models/strategy-recommendations/${y}/${encodeURIComponent(race)}`
        )
        return { sourceYear: y, data }
      } catch (err) {
        if (isNotFoundError(err)) {
          lastNotFound = err
          continue
        }
        throw err
      }
    }
    throw lastNotFound ?? new Error('No strategy recommendations available')
  },
  getFiaDocuments: (year: number, race: string, forceRefresh = false) =>
    get<FiaDocumentsResponse>(
      `/fia-documents/${year}/${encodeURIComponent(race)}?force_refresh=${forceRefresh ? '1' : '0'}`
    ),
  getFiaDocumentSeasons: (forceRefresh = false) =>
    get<FiaDocumentSeasonsResponse>(`/fia-documents/seasons?force_refresh=${forceRefresh ? '1' : '0'}`),
  getFiaDocumentEvents: (year: number) =>
    get<FiaDocumentEventsResponse>(`/fia-documents/${year}`),
  getSeasonStandings: (year: number, refresh = false) =>
    get<SeasonStandingsResponse>(`/insights/${year}/standings?refresh=${refresh ? '1' : '0'}`),
  getProfiles: (refresh = false) =>
    get<ProfilesResponse>(`/insights/profiles?refresh=${refresh ? '1' : '0'}`),
  getCircuitInsights: (year: number, race: string, refresh = false) =>
    get<CircuitInsightsResponse>(
      `/insights/${year}/${encodeURIComponent(race)}/circuit?refresh=${refresh ? '1' : '0'}`
    ),
  predictUndercut: (payload: UndercutPredictRequest) =>
    post<UndercutPredictResponse>('/models/undercut/predict', payload)
}
