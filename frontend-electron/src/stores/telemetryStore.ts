import { create } from 'zustand'
import { api, isAbortLikeError } from '../api/client'
import type { TelemetryResponse } from '../types'

let latestTelemetryRequestId = 0
const CHUNK_S = 270

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

const initWorker = () => {
  if (worker.onerror === null) {
    worker.onerror = (e) => {
      console.error('[telemetryStore] Worker error:', e)
    }
  }
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
  return { data, reason }
}

const fetchChunked = async (year: number, race: string, session: string, start: number, end: number, signal?: AbortSignal): Promise<TelemetryResponse> => {
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
  return mergeChunks(chunks)
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
      const data = await fetchChunked(year, race, session, fetchStart, fetchEnd, signal)
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
    worker.postMessage({ type: 'clear' })
    set({ telemetryData: null, loadingState: 'idle', error: null, windowStart: 0, windowEnd: 0, renderedStart: 0, renderedEnd: 0, sessionKey: null })
  }
}))
