import { create } from 'zustand'
import { api } from '../api/client'
import type { TelemetryResponse } from '../types'

let latestTelemetryRequestId = 0
const TELEMETRY_CHUNK_S = 270

// Instantiate the worker
const worker = new Worker(new URL('../workers/telemetry.worker.ts', import.meta.url), { type: 'module' })

let messageIdSeq = 0
const pendingResolves = new Map<number, { resolve: (data: TelemetryResponse) => void; reject: (err: Error) => void; timer: number }>()
const WORKER_REQUEST_TIMEOUT_MS = 10000

worker.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'result') {
    const pending = pendingResolves.get(e.data.msgId)
    if (pending) {
      pendingResolves.delete(e.data.msgId)
      window.clearTimeout(pending.timer)
      pending.resolve(e.data.data)
    }
  }
}

function processInWorker(sessionKey: string, data: TelemetryResponse | null, t0: number, t1: number): Promise<TelemetryResponse> {
  return new Promise((resolve, reject) => {
    const msgId = ++messageIdSeq
    const timer = window.setTimeout(() => {
      const pending = pendingResolves.get(msgId)
      if (!pending) return
      pendingResolves.delete(msgId)
      pending.reject(new Error('Telemetry worker timeout'))
    }, WORKER_REQUEST_TIMEOUT_MS)
    pendingResolves.set(msgId, { resolve, reject, timer })
    worker.postMessage({
      type: 'process',
      msgId,
      sessionKey,
      data,
      t0,
      t1
    })
  })
}

function mergeTelemetryChunks(chunks: TelemetryResponse[]): TelemetryResponse {
  const merged: TelemetryResponse = {}
  for (const chunk of chunks) {
    for (const [driver, rows] of Object.entries(chunk || {})) {
      const current = merged[driver]
      if (!current) {
        merged[driver] = rows.slice()
        continue
      }
      current.push(...rows)
    }
  }
  for (const rows of Object.values(merged)) {
    rows.sort((a, b) => a.timestamp - b.timestamp)
  }
  return merged
}

async function fetchTelemetryChunked(
  year: number,
  race: string,
  session: string,
  fetchStart: number,
  fetchEnd: number
): Promise<TelemetryResponse> {
  const chunks: TelemetryResponse[] = []
  let cursor = fetchStart
  while (cursor < fetchEnd) {
    const chunkEnd = Math.min(fetchEnd, cursor + TELEMETRY_CHUNK_S)
    const data = await api.getTelemetry(year, race, session, cursor, chunkEnd, 1)
    chunks.push(data)
    if (chunkEnd >= fetchEnd) break
    cursor = chunkEnd
  }
  return mergeTelemetryChunks(chunks)
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
  loadTelemetry: (year: number, race: string, session: string, t0: number, t1: number) => Promise<void>
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

  loadTelemetry: async (year, race, session, t0, t1) => {
    const sessionKey = `${year}|${race}|${session}`
    const requestedStart = Math.max(0, Math.floor(t0))
    const requestedEnd = Math.max(requestedStart, Math.ceil(t1))
    const state = get()

    const requestId = ++latestTelemetryRequestId
    const fetchStart = Math.max(0, requestedStart - 8)
    const fetchEnd = requestedEnd + 8

    const isSessionChange = state.sessionKey !== sessionKey
    const needsFetch = isSessionChange || !state.telemetryData || requestedStart < state.windowStart || requestedEnd > state.windowEnd
    const sameRenderedWindow =
      !isSessionChange &&
      state.telemetryData != null &&
      state.loadingState === 'ready' &&
      state.renderedStart === fetchStart &&
      state.renderedEnd === fetchEnd

    if (sameRenderedWindow) {
      return
    }

    if (!needsFetch) {
      // Just slice the existing data via worker
      const workerResult = await processInWorker(sessionKey, null, fetchStart, fetchEnd)

      if (requestId !== latestTelemetryRequestId) return

      set({
        telemetryData: workerResult,
        loadingState: 'ready',
        renderedStart: fetchStart,
        renderedEnd: fetchEnd,
        sessionKey
      })
      return
    }

    if (isSessionChange) {
      set({
        telemetryData: null,
        loadingState: 'loading',
        error: null,
        windowStart: 0,
        windowEnd: 0,
        renderedStart: 0,
        renderedEnd: 0,
        sessionKey
      })
      worker.postMessage({ type: 'clear' })
    } else {
      set({
        loadingState: state.telemetryData ? 'ready' : 'loading',
        error: null,
        sessionKey
      })
    }

    try {
      const data = await fetchTelemetryChunked(year, race, session, fetchStart, fetchEnd)
      if (requestId !== latestTelemetryRequestId) return

      const current = get()
      if (current.sessionKey !== sessionKey) return

      const nextStart =
        current.sessionKey === sessionKey && current.telemetryData
          ? Math.min(current.windowStart, fetchStart)
          : fetchStart
      const nextEnd =
        current.sessionKey === sessionKey && current.telemetryData
          ? Math.max(current.windowEnd, fetchEnd)
          : fetchEnd

      const workerResult = await processInWorker(sessionKey, data, fetchStart, fetchEnd)

      if (requestId !== latestTelemetryRequestId) return

      set({
        telemetryData: workerResult,
        loadingState: 'ready',
        windowStart: nextStart,
        windowEnd: nextEnd,
        renderedStart: fetchStart,
        renderedEnd: fetchEnd,
        sessionKey
      })
    } catch (e) {
      if (requestId !== latestTelemetryRequestId) return
      const current = get()
      set({ loadingState: current.telemetryData ? 'ready' : 'error', error: String(e), sessionKey })
    }
  },

  clearTelemetry: () => {
    latestTelemetryRequestId += 1
    for (const pending of pendingResolves.values()) {
      window.clearTimeout(pending.timer)
      pending.reject(new Error('Telemetry cleared'))
    }
    pendingResolves.clear()
    worker.postMessage({ type: 'clear' })
    set({
      telemetryData: null,
      loadingState: 'idle',
      error: null,
      windowStart: 0,
      windowEnd: 0,
      renderedStart: 0,
      renderedEnd: 0,
      sessionKey: null
    })
  }
}))
