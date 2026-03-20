import { create } from 'zustand'
import { api, isAbortLikeError } from '../api/client'
import type { TelemetryResponse } from '../types'

let latestTelemetryRequestId = 0
const CHUNK_S = 270
const MAX_RAW_CACHE_ENTRIES = 24

const worker = new Worker(new URL('../workers/telemetry.worker.ts', import.meta.url), { type: 'module' })

let msgIdSeq = 0
const pending = new Map<number, { resolve: (d: TelemetryResponse) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
const TIMEOUT_MS = 10000

worker.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'result') {
    const p = pending.get(e.data.msgId)
    if (p) {
      pending.delete(e.data.msgId)
      clearTimeout(p.timer)
      p.resolve(e.data.data)
    }
  }
}

worker.onerror = (e) => {
  console.error('[telemetryStore] Worker error:', e)
}

const cleanupWorker = () => {
  for (const p of pending.values()) {
    clearTimeout(p.timer)
    p.reject(new Error('Worker terminated'))
  }
  pending.clear()
  worker.terminate()
}

const runWorker = (key: string, data: TelemetryResponse | null, t0: number, t1: number): Promise<TelemetryResponse> => {
  return new Promise((resolve, reject) => {
    const id = ++msgIdSeq
    const timer = setTimeout(() => {
      const p = pending.get(id)
      if (p) { pending.delete(id); p.reject(new Error('Telemetry worker timeout')) }
    }, TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ type: 'process', msgId: id, sessionKey: key, data, t0, t1 })
  })
}

const mergeChunks = (chunks: TelemetryResponse[]): TelemetryResponse => {
  const merged: TelemetryResponse = {}
  for (const chunk of chunks) {
    for (const [driver, rows] of Object.entries(chunk || {})) {
      const cur = merged[driver]
      if (!cur) { merged[driver] = rows.slice(); continue }
      cur.push(...rows)
    }
  }
  for (const rows of Object.values(merged)) rows.sort((a, b) => a.timestamp - b.timestamp)
  return merged
}

const rawTelemetryCache = new Map<string, TelemetryResponse>()

const cacheSetRaw = (key: string, value: TelemetryResponse): void => {
  rawTelemetryCache.set(key, value)
  if (rawTelemetryCache.size > MAX_RAW_CACHE_ENTRIES) {
    const first = rawTelemetryCache.keys().next().value
    if (first) rawTelemetryCache.delete(first)
  }
}

type Payload = TelemetryResponse | { telemetry?: TelemetryResponse; telemetryUnavailableReason?: string }

const normPayload = (p: unknown): { data: TelemetryResponse; reason: string | null } => {
  if (!p || typeof p !== 'object') return { data: {}, reason: 'Telemetry payload missing' }
  const obj = p as Record<string, unknown>
  const reason = typeof obj.telemetryUnavailableReason === 'string' ? obj.telemetryUnavailableReason : null
  const base = obj.telemetry && typeof obj.telemetry === 'object' ? obj.telemetry as Record<string, unknown> : obj
  const data: TelemetryResponse = {}
  for (const [k, v] of Object.entries(base)) {
    if (Array.isArray(v)) data[k] = v as TelemetryResponse[string]
  }
  if (!Object.keys(data).length && typeof base === 'object' && base != null) {
    const raw = base as Record<string, unknown>
    const keyLookup = (name: string) => raw[name] ?? raw[name.toLowerCase()] ?? raw[name.toUpperCase()]
    const time = keyLookup('time') ?? keyLookup('timestamp')
    const speed = keyLookup('speed')
    const throttle = keyLookup('throttle')
    const brake = keyLookup('brake')
    const rpm = keyLookup('rpm')
    const gear = keyLookup('gear')
    const drs = keyLookup('drs')
    if (Array.isArray(time) && (Array.isArray(speed) || Array.isArray(throttle) || Array.isArray(brake))) {
      const rows: TelemetryResponse[string] = []
      for (let i = 0; i < time.length; i += 1) {
        const ts = Number(time[i])
        if (!Number.isFinite(ts)) continue
        rows.push({
          driverNumber: 0,
          driverName: 'PRIMARY',
          timestamp: ts,
          speed: Number((speed as unknown[] | undefined)?.[i] ?? 0),
          throttle: Number((throttle as unknown[] | undefined)?.[i] ?? 0),
          brake: Number((brake as unknown[] | undefined)?.[i] ?? 0),
          rpm: Number((rpm as unknown[] | undefined)?.[i] ?? 0),
          gear: Number((gear as unknown[] | undefined)?.[i] ?? 0),
          drs: Number((drs as unknown[] | undefined)?.[i] ?? 0),
          ersDeploy: null,
          ersHarvest: null,
        })
      }
      if (rows.length) data.PRIMARY = rows
    }
  }
  return { data, reason }
}

// FIX: helper to check if a TelemetryResponse has any actual rows
const hasAnyRows = (tel: TelemetryResponse): boolean => {
  for (const rows of Object.values(tel)) {
    if (Array.isArray(rows) && rows.length > 0) return true
  }
  return false
}

const fetchChunked = async (year: number, race: string, session: string, start: number, end: number, signal?: AbortSignal): Promise<TelemetryResponse> => {
  const fetchKey = `${year}|${race}|${session}|${start}|${end}`
  const cached = rawTelemetryCache.get(fetchKey)
  if (cached) return cached
  const chunks: TelemetryResponse[] = []
  let cursor = start
  while (cursor < end) {
    const chunkEnd = Math.min(end, cursor + CHUNK_S)
    const raw = await api.getTelemetry(year, race, session, cursor, chunkEnd, 1, signal) as Payload
    const normalized = normPayload(raw)
    if (normalized.reason && !Object.keys(normalized.data).length) throw new Error(`Telemetry unavailable: ${normalized.reason}`)
    chunks.push(normalized.data)
    if (chunkEnd >= end) break
    cursor = chunkEnd
  }
  const merged = mergeChunks(chunks)
  cacheSetRaw(fetchKey, merged)
  return merged
}

interface TelemetryState {
  telemetryData: TelemetryResponse | null
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  windowStart: number
  windowEnd: number
  renderedStart: number
  renderedEnd: number
  sessionKey: string | null
  loadTelemetry: (year: number, race: string, session: string, t0: number, t1: number, signal?: AbortSignal) => Promise<void>
  clearTelemetry: () => void
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  telemetryData: null,
  loadingState: 'idle',
  error: null,
  windowStart: 0,
  windowEnd: 0,
  renderedStart: 0,
  renderedEnd: 0,
  sessionKey: null,

  loadTelemetry: async (year, race, session, t0, t1, signal) => {
    const sessionKey = `${year}|${race}|${session}`

    const reqStart = Math.max(0, Math.floor(t0))
    const reqEnd = Math.max(reqStart, Math.ceil(t1))
    const state = get()
    const reqId = ++latestTelemetryRequestId
    const fetchStart = Math.max(0, reqStart - 8)
    const fetchEnd = reqEnd + 8
    const isSessionChange = state.sessionKey !== sessionKey
    const needsFetch = isSessionChange || !state.telemetryData || reqStart < state.windowStart || reqEnd > state.windowEnd
    const sameRendered = !isSessionChange && state.telemetryData && state.loadingState === 'ready' && state.renderedStart === fetchStart && state.renderedEnd === fetchEnd

    if (sameRendered) return

    if (!needsFetch) {
      const workerResult = await runWorker(sessionKey, null, fetchStart, fetchEnd)
      if (reqId !== latestTelemetryRequestId) return
      set({ telemetryData: workerResult, loadingState: 'ready', renderedStart: fetchStart, renderedEnd: fetchEnd, sessionKey })
      return
    }

    if (isSessionChange) {
      set({ telemetryData: null, loadingState: 'loading', error: null, windowStart: 0, windowEnd: 0, renderedStart: 0, renderedEnd: 0, sessionKey })
      worker.postMessage({ type: 'clear' })
    } else {
      set({ loadingState: state.telemetryData ? 'ready' : 'loading', error: null, sessionKey })
    }

    try {
      let data = await fetchChunked(year, race, session, fetchStart, fetchEnd, signal)
      if (reqId !== latestTelemetryRequestId) return

      // ─── EMPTY-WINDOW RECOVERY ─────────────────────────────────────────────────
      // When the client first opens telemetry it requests t0=0,t1~=120s.
      // FastF1 stores session_time_seconds as ABSOLUTE session time (e.g. race
      // starts at t=300s after session open). The backend has shift logic but it
      // only fires when race_time_offset>1000 which is wrong (lap 1 ends at ~90s
      // so MIN(session_time_seconds WHERE lap=1) ≈ 90, not 1000).
      //
      // FIX: if the first fetch returns 0 rows for a new session, retry with a
      // much wider window [0, 600] to guarantee we land somewhere in the data.
      if (isSessionChange && !hasAnyRows(data)) {
        const RECOVERY_END = Math.max(fetchEnd + 300, 600)
        try {
          const wider = await fetchChunked(year, race, session, 0, RECOVERY_END, signal)
          if (reqId !== latestTelemetryRequestId) return
          if (hasAnyRows(wider)) {
            data = wider
          }
        } catch {
          // Ignore recovery failure; will fall through with empty data
        }
      }

      // Second recovery pass: try the full first hour of data
      if (isSessionChange && !hasAnyRows(data)) {
        try {
          const fullRange = await fetchChunked(year, race, session, 0, 3600, signal)
          if (reqId !== latestTelemetryRequestId) return
          if (hasAnyRows(fullRange)) {
            data = fullRange
          }
        } catch {
          // Ignore
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      if (reqId !== latestTelemetryRequestId) return
      const current = get()
      if (current.sessionKey !== sessionKey) return

      const nextStart = current.sessionKey === sessionKey && current.telemetryData ? Math.min(current.windowStart, fetchStart) : fetchStart
      const nextEnd = current.sessionKey === sessionKey && current.telemetryData ? Math.max(current.windowEnd, fetchEnd) : fetchEnd

      const workerResult = await runWorker(sessionKey, data, fetchStart, fetchEnd)
      if (reqId !== latestTelemetryRequestId) return

      set({ telemetryData: workerResult, loadingState: 'ready', windowStart: nextStart, windowEnd: nextEnd, renderedStart: fetchStart, renderedEnd: fetchEnd, sessionKey })
    } catch (e) {
      if (reqId !== latestTelemetryRequestId) return
      if (isAbortLikeError(e)) {
        set((s) => ({ loadingState: s.telemetryData ? 'ready' : 'idle', error: null, sessionKey }))
        return
      }
      set({ loadingState: 'error', error: String(e), sessionKey })
    }
  },

  clearTelemetry: () => {
    latestTelemetryRequestId++
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Telemetry cleared')) }
    pending.clear()
    rawTelemetryCache.clear()
    worker.postMessage({ type: 'clear' })
    set({ telemetryData: null, loadingState: 'idle', error: null, windowStart: 0, windowEnd: 0, renderedStart: 0, renderedEnd: 0, sessionKey: null })
  }
}))
