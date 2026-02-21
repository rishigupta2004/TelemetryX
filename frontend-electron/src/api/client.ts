import type {
  ClusteringResponse,
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
  StrategyRecommendationsResponse,
  StrategyRecommendationsWithSource,
  TelemetryResponse,
  TyreStint,
  UndercutPredictRequest,
  UndercutPredictResponse
} from '../types'

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1'
const REQUEST_TIMEOUT_MS = 15000
const GET_RETRIES = 1

function resolveBaseUrl(): string {
  const viteUrl = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL
  if (viteUrl && viteUrl.trim()) return viteUrl.replace(/\/+$/, '')

  const runtimeUrl = (globalThis as unknown as { TELEMETRYX_API_BASE_URL?: string }).TELEMETRYX_API_BASE_URL
  if (runtimeUrl && runtimeUrl.trim()) return runtimeUrl.replace(/\/+$/, '')

  return DEFAULT_BASE_URL
}

const BASE_URL = resolveBaseUrl()
const ROOT_URL = BASE_URL.replace(/\/api\/v1\/?$/, '')

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
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal })
      if (!res.ok) {
        throw new ApiError(res.status, path, await parseErrorDetail(res))
      }
      return res.json()
    } catch (err) {
      lastErr = err
      if (attempt >= retries) break
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }
  throw lastErr ?? new Error(`Request failed: ${path}`)
}

export async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' }, GET_RETRIES)
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
  getBaseUrl: () => BASE_URL,
  getHealth: async () => {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(`${ROOT_URL}/health`, { method: 'GET', signal: controller.signal })
      if (!res.ok) throw new ApiError(res.status, '/health', await parseErrorDetail(res))
      return (await res.json()) as { status: string }
    } finally {
      globalThis.clearTimeout(timeout)
    }
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
        const data = await get<StrategyRecommendationsResponse>(
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
  predictUndercut: (payload: UndercutPredictRequest) =>
    post<UndercutPredictResponse>('/models/undercut/predict', payload)
}
