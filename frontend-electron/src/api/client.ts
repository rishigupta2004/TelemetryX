import type {
  ApiErrorInfo,
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
  RegulationSimulationCompareResponse,
  RegulationSimulationResponse,
  RegulationSimulationBacktestResponse,
  StrategyRecommendationsResponse,
  TelemetryResponse,
  TelemetryRow,
  TyreStint,
  UndercutEventsResponse,
  UndercutPredictRequest,
  UndercutPredictResponse
} from '../types'
import { API_RETRIES, API_TIMEOUT_MS, API_CACHE_TTL_MS, API_CACHE_MAX_ENTRIES } from '../lib/constants'
import { getAuthToken } from '../lib/authToken'

const DEFAULT_BASE_URLS = ['http://127.0.0.1:9000/api/v1', 'http://localhost:9000/api/v1']

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

function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`
}

function resolveBaseUrls(): string[] {
  const env = (import.meta as unknown as { env?: { VITE_API_BASE?: string; VITE_API_BASE_URL?: string } })?.env
  const viteBase = env?.VITE_API_BASE || env?.VITE_API_BASE_URL
  const bridgeUrl = (
    globalThis as unknown as { telemetryx?: { apiBaseUrl?: string | null } }
  )?.telemetryx?.apiBaseUrl
  const runtimeUrl = (globalThis as unknown as { TELEMETRYX_API_BASE_URL?: string }).TELEMETRYX_API_BASE_URL
  const dev = isDevMode()
  const urls = dev
    ? uniqueUrls([normalizeApiBase(viteBase || ''), normalizeApiBase(bridgeUrl || ''), normalizeApiBase(runtimeUrl || ''), ...DEFAULT_BASE_URLS])
    : uniqueUrls([normalizeApiBase(viteBase || ''), normalizeApiBase(bridgeUrl || ''), normalizeApiBase(runtimeUrl || ''), ...DEFAULT_BASE_URLS])
  const filtered = urls.filter((url) => !/localhost:9010|127\.0\.0\.1:9010/.test(url))
  return filtered.length ? filtered : DEFAULT_BASE_URLS
}

const BASE_URLS = resolveBaseUrls()
const ROOT_URLS = BASE_URLS.map((url) => url.replace(/\/api\/v1\/?$/, ''))
let pinnedBaseUrl: string | null = null

export function getApiRoot(): string {
  const base = pinnedBaseUrl || BASE_URLS[0] || DEFAULT_BASE_URLS[0]
  return base.replace(/\/api\/v1\/?$/, '')
}

export function getApiBase(): string {
  return pinnedBaseUrl || BASE_URLS[0] || DEFAULT_BASE_URLS[0]
}

// ── Response Cache (in-memory, TTL-based) ──────────────────────────
interface CacheEntry { data: unknown; ts: number }
const _responseCache = new Map<string, CacheEntry>()

// ── Request Deduplication ──────────────────────────────────────────
const _inflightRequests = new Map<string, Promise<unknown>>()

// Paths that should NOT be cached (time-sensitive)
const NO_CACHE_PATTERNS = ['/telemetry', '/positions', '/health']

function isCacheable(path: string): boolean {
  return !NO_CACHE_PATTERNS.some((pattern) => path.includes(pattern))
}

function getCached<T>(path: string): T | null {
  const entry = _responseCache.get(path)
  if (!entry) return null
  if (Date.now() - entry.ts > API_CACHE_TTL_MS) {
    _responseCache.delete(path)
    return null
  }
  return entry.data as T
}

function setCache(path: string, data: unknown): void {
  _responseCache.set(path, { data, ts: Date.now() })
  // Evict oldest entries if over limit
  if (_responseCache.size > API_CACHE_MAX_ENTRIES) {
    const firstKey = _responseCache.keys().next().value
    if (firstKey) _responseCache.delete(firstKey)
  }
}

export class ApiError extends Error {
  status: number
  path: string
  detail: unknown
  code: string | undefined

  constructor(status: number, path: string, detail: unknown) {
    let detailMsg = ''
    let errorCode: string | undefined

    if (detail && typeof detail === 'object' && 'message' in detail) {
      detailMsg = String((detail as { message: unknown }).message)
      errorCode = (detail as { code?: string }).code
    } else if (typeof detail === 'string') {
      detailMsg = detail
    } else if (detail && typeof detail === 'object' && 'message' in detail) {
      detailMsg = String((detail as { message: unknown }).message)
    }

    if (status === 404 && !detailMsg) {
      detailMsg = 'Session not found'
    }

    const detailPrefix = detailMsg ? ` - ${detailMsg}` : ''
    super(`API error ${status}: ${path}${detailPrefix}`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.detail = detail
    this.code = errorCode
  }
}

export function isAbortLikeError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'AbortError' || err.name === 'TimeoutError'
  }
  if (err instanceof Error) {
    const text = `${err.name} ${err.message}`.toLowerCase()
    return text.includes('abort') || text.includes('aborted')
  }
  return false
}

async function parseErrorDetail(res: Response): Promise<{ code?: string; message: string; detail: unknown } | unknown> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  try {
    const payload = await res.json()
    if (payload && typeof payload === 'object') {
      if (payload.error === true && 'message' in payload) {
        return {
          code: typeof payload.code === 'string' ? payload.code : undefined,
          message: String(payload.message),
          detail: payload.detail ?? null
        }
      }
      if ('detail' in payload) {
        return (payload as { detail?: unknown }).detail ?? null
      }
    }
    return payload
  } catch {
    return null
  }
}

async function request<T>(path: string, init: RequestInit, retries = 0, externalSignal?: AbortSignal): Promise<T> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const candidates = pinnedBaseUrl ? [pinnedBaseUrl] : BASE_URLS
    for (const baseUrl of candidates) {
      const controller = new AbortController()
      let didTimeout = false
      const timeout = globalThis.setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, API_TIMEOUT_MS)
      const cleanup: Array<() => void> = []
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort()
        const onAbort = () => controller.abort()
        externalSignal.addEventListener('abort', onAbort)
        cleanup.push(() => externalSignal.removeEventListener('abort', onAbort))
      }
      const token = getAuthToken()
      const headers = new Headers(init.headers || undefined)
      if (token) headers.set('Authorization', `Bearer ${token}`)

      try {
        const res = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal })
        if (!res.ok) {
          throw new ApiError(res.status, path, await parseErrorDetail(res))
        }
        if (!pinnedBaseUrl) pinnedBaseUrl = baseUrl
        const data = await res.json()
        // Cache GET responses
        if (init.method === 'GET' && isCacheable(path)) {
          setCache(path, data)
        }
        return data
      } catch (err) {
        if (didTimeout && isAbortLikeError(err)) {
          lastErr = new Error(`Request timed out after ${API_TIMEOUT_MS}ms`)
        } else {
          lastErr = err
        }
        if (baseUrl === pinnedBaseUrl) pinnedBaseUrl = null
      } finally {
        globalThis.clearTimeout(timeout)
        for (const fn of cleanup) fn()
      }
    }
  }
  throw lastErr ?? new Error(`Request failed: ${path}`)
}

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  // Check cache first - skip cache if we have an abort signal since response may be stale
  if (isCacheable(path) && !signal) {
    const cached = getCached<T>(path)
    if (cached != null) return cached
  }
  // Deduplicate in-flight requests - skip deduplication if we have an abort signal
  if (!signal) {
    const existing = _inflightRequests.get(path)
    if (existing) return existing as Promise<T>
  }

  const promise = request<T>(path, { method: 'GET' }, API_RETRIES, signal)
    .finally(() => _inflightRequests.delete(path))
  if (!signal) {
    _inflightRequests.set(path, promise)
  }
  return promise
}

export async function getNoRetry<T>(path: string): Promise<T> {
  if (isCacheable(path)) {
    const cached = getCached<T>(path)
    if (cached != null) return cached
  }
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

/** Convert any caught error to a typed { code, message } shape for stores. */
export function toApiErrorInfo(err: unknown): ApiErrorInfo {
  if (err instanceof ApiError) {
    let message = err.message
    if (err.status === 404 && !err.code) {
      message = 'Session not found'
    }
    return { code: err.status, message }
  }
  return { code: null, message: String(err) }
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
  getTelemetry: (year: number, race: string, session: string, t0?: number, t1?: number, hz?: number, signal?: AbortSignal) => {
    let path = `/sessions/${year}/${encodeURIComponent(race)}/${session}/telemetry`
    const params: string[] = []
    if (t0 !== undefined) params.push(`t0=${t0}`)
    if (t1 !== undefined) params.push(`t1=${t1}`)
    if (hz !== undefined) params.push(`hz=${hz}`)
    if (params.length) path += `?${params.join('&')}`
    return get<TelemetryResponse>(path, signal)
  },
  getTelemetryByDriverAndLap: (year: number, race: string, session: string, driverCode: string, lapNumber: number) => {
    return get<TelemetryRow[]>(
      `/telemetry/${year}/${encodeURIComponent(race)}/${encodeURIComponent(driverCode)}/laps/${lapNumber}`
    )
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
      `/features/${year}/${encodeURIComponent(race)}/${session}/driver-summary?driver=${encodeURIComponent(driver)}${compare ? `&compare=${encodeURIComponent(compare)}` : ''
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
  getRegulationSimulation: (
    baselineYear: number,
    race: string,
    params?: {
      targetYear?: number
      teamProfile?: 'balanced' | 'aggressive' | 'conservative'
      nSamples?: number
      seed?: number
    }
  ) => {
    const search = new URLSearchParams()
    if (params?.targetYear != null) search.set('target_year', String(params.targetYear))
    if (params?.teamProfile) search.set('team_profile', params.teamProfile)
    if (params?.nSamples != null) search.set('n_samples', String(params.nSamples))
    if (params?.seed != null) search.set('seed', String(params.seed))
    const suffix = search.size ? `?${search.toString()}` : ''
    return getNoRetry<RegulationSimulationResponse>(
      `/models/regulation-simulation/${baselineYear}/${encodeURIComponent(race)}${suffix}`
    )
  },
  getRegulationSimulationCompare: (
    race: string,
    params?: {
      baselineYears?: number[]
      targetYear?: number
      teamProfile?: 'balanced' | 'aggressive' | 'conservative'
      nSamples?: number
      seed?: number
      trackType?: string
      asyncMode?: boolean
    }
  ) => {
    const search = new URLSearchParams()
    const years = Array.isArray(params?.baselineYears) ? params?.baselineYears : []
    for (const year of years) {
      if (Number.isFinite(year)) {
        search.append('baselines', String(Math.trunc(year)))
      }
    }
    if (params?.targetYear != null) search.set('target_year', String(params.targetYear))
    if (params?.teamProfile) search.set('team_profile', params.teamProfile)
    if (params?.nSamples != null) search.set('n_samples', String(params.nSamples))
    if (params?.seed != null) search.set('seed', String(params.seed))
    if (params?.trackType) search.set('track_type', params.trackType)
    if (params?.asyncMode) search.set('async_mode', 'true')
    const suffix = search.size ? `?${search.toString()}` : ''
    return getNoRetry<RegulationSimulationCompareResponse>(
      `/models/regulation-simulation-compare/${encodeURIComponent(race)}${suffix}`
    )
  },
  getSimulationStatus: (jobId: string) => {
    return getNoRetry<{ status: string; result?: RegulationSimulationCompareResponse }>(
      `/models/simulation/status/${encodeURIComponent(jobId)}`
    )
  },
  getFiaDocuments: (year: number, race: string, forceRefresh = false) =>
    get<FiaDocumentsResponse>(
      `/fia-documents/${year}/${encodeURIComponent(race)}?force_refresh=${forceRefresh ? '1' : '0'}`
    ),
  getRegulationSimulationBacktest: (
    params?: {
      baselineYear?: number
      targetYear?: number
      teamProfile?: 'balanced' | 'aggressive' | 'conservative'
      nSamples?: number
    }
  ) => {
    const search = new URLSearchParams()
    if (params?.baselineYear != null) search.set('baseline_year', String(params.baselineYear))
    if (params?.targetYear != null) search.set('target_year', String(params.targetYear))
    if (params?.teamProfile) search.set('team_profile', params.teamProfile)
    if (params?.nSamples != null) search.set('n_samples', String(params.nSamples))
    const suffix = search.size ? `?${search.toString()}` : ''
    return getNoRetry<RegulationSimulationBacktestResponse>(
      `/models/regulation-simulation-backtest${suffix}`
    )
  },
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
