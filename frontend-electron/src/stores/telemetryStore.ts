import { create } from 'zustand'
import { api } from '../api/client'
import type { TelemetryResponse } from '../types'

let latestTelemetryRequestId = 0

function mergeTelemetry(existing: TelemetryResponse | null, incoming: TelemetryResponse): TelemetryResponse {
  if (!existing) return incoming

  const merged: TelemetryResponse = {}
  const driverKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)])

  for (const key of driverKeys) {
    const rows = [...(existing[key] ?? []), ...(incoming[key] ?? [])]
    rows.sort((a, b) => a.timestamp - b.timestamp)
    const deduped: typeof rows = []
    let lastTimestamp: number | null = null
    for (const row of rows) {
      if (lastTimestamp !== null && row.timestamp === lastTimestamp) {
        deduped[deduped.length - 1] = row
      } else {
        deduped.push(row)
        lastTimestamp = row.timestamp
      }
    }
    merged[key] = deduped
  }

  return merged
}

interface TelemetryState {
  telemetryData: TelemetryResponse | null
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  windowStart: number
  windowEnd: number
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
  sessionKey: null,

  loadTelemetry: async (year, race, session, t0, t1) => {
    const sessionKey = `${year}|${race}|${session}`
    const requestedStart = Math.max(0, Math.floor(t0))
    const requestedEnd = Math.max(requestedStart, Math.ceil(t1))
    const state = get()

    if (
      state.sessionKey === sessionKey &&
      state.telemetryData &&
      requestedStart >= state.windowStart &&
      requestedEnd <= state.windowEnd
    ) {
      return
    }

    const requestId = ++latestTelemetryRequestId
    const fetchStart = Math.max(0, requestedStart - 8)
    const fetchEnd = requestedEnd + 8

    set({ loadingState: 'loading', error: null, sessionKey })

    try {
      const data = await api.getTelemetry(year, race, session, fetchStart, fetchEnd, 1)
      if (requestId !== latestTelemetryRequestId) return

      const current = get()
      if (current.sessionKey !== sessionKey) return

      const merged = mergeTelemetry(current.sessionKey === sessionKey ? current.telemetryData : null, data)
      const nextStart =
        current.sessionKey === sessionKey && current.telemetryData
          ? Math.min(current.windowStart, fetchStart)
          : fetchStart
      const nextEnd =
        current.sessionKey === sessionKey && current.telemetryData
          ? Math.max(current.windowEnd, fetchEnd)
          : fetchEnd

      set({
        telemetryData: merged,
        loadingState: 'ready',
        windowStart: nextStart,
        windowEnd: nextEnd,
        sessionKey
      })
    } catch (e) {
      if (requestId !== latestTelemetryRequestId) return
      set({ loadingState: 'error', error: String(e), sessionKey })
    }
  },

  clearTelemetry: () => {
    latestTelemetryRequestId += 1
    set({
      telemetryData: null,
      loadingState: 'idle',
      error: null,
      windowStart: 0,
      windowEnd: 0,
      sessionKey: null
    })
  }
}))
