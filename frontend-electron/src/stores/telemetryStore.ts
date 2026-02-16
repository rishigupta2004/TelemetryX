import { create } from 'zustand'
import { api } from '../api/client'
import type { TelemetryResponse } from '../types'

interface TelemetryState {
  telemetryData: TelemetryResponse | null
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  windowStart: number
  windowEnd: number
  loadTelemetry: (year: number, race: string, session: string, t0: number, t1: number) => Promise<void>
  clearTelemetry: () => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetryData: null,
  loadingState: 'idle',
  error: null,
  windowStart: 0,
  windowEnd: 0,

  loadTelemetry: async (year, race, session, t0, t1) => {
    set({ loadingState: 'loading', error: null })
    try {
      const data = await api.getTelemetry(year, race, session, t0, t1, 1)
      set({
        telemetryData: data,
        loadingState: 'ready',
        windowStart: t0,
        windowEnd: t1
      })
    } catch (e) {
      set({ loadingState: 'error', error: String(e) })
    }
  },

  clearTelemetry: () => set({ telemetryData: null, loadingState: 'idle', error: null })
}))
