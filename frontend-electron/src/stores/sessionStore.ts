import { create } from 'zustand'
import { api } from '../api/client'
import type { LapRow, Race, Season, SessionVizResponse } from '../types'

interface SessionState {
  seasons: Season[]
  races: Race[]
  selectedYear: number | null
  selectedRace: string | null
  selectedSession: string | null
  sessionData: SessionVizResponse | null
  laps: LapRow[]
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  fetchSeasons: () => Promise<void>
  fetchRaces: (year: number) => Promise<void>
  loadSession: (year: number, race: string, session: string) => Promise<void>
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  seasons: [],
  races: [],
  selectedYear: null,
  selectedRace: null,
  selectedSession: null,
  sessionData: null,
  laps: [],
  loadingState: 'idle',
  error: null,

  fetchSeasons: async () => {
    set({ loadingState: 'loading', error: null })
    try {
      const seasons = await api.getSeasons()
      set((state) => ({
        seasons,
        loadingState: state.sessionData ? 'ready' : 'idle'
      }))
    } catch (err) {
      set({ error: String(err), loadingState: 'error' })
    }
  },

  fetchRaces: async (year) => {
    set({ loadingState: 'loading', error: null, selectedYear: year, selectedRace: null, selectedSession: null })
    try {
      const races = await api.getRaces(year)
      set((state) => ({
        races,
        loadingState: state.sessionData ? 'ready' : 'idle'
      }))
    } catch (err) {
      set({ error: String(err), loadingState: 'error' })
    }
  },

  loadSession: async (year, race, session) => {
    set({
      loadingState: 'loading',
      error: null,
      selectedYear: year,
      selectedRace: race,
      selectedSession: session,
      laps: []
    })
    try {
      const sessionData = await api.getSessionViz(year, race, session)
      const laps = await api.getLaps(year, race, session)
      const numberToCode = new Map<number, string>()

      for (const lap of sessionData.laps ?? []) {
        const code = lap.driverName
        if (code && lap.driverNumber != null) numberToCode.set(lap.driverNumber, code)
      }
      for (const lap of laps ?? []) {
        const code = lap.driverName
        if (code && lap.driverNumber != null) numberToCode.set(lap.driverNumber, code)
      }

      if (numberToCode.size === 0) {
        try {
          const telemetry = await api.getTelemetry(year, race, session, 0, 120, 1)
          for (const [code, rows] of Object.entries(telemetry)) {
            const first = rows?.[0]
            if (first?.driverNumber != null) numberToCode.set(first.driverNumber, code)
          }
        } catch {
          // No-op: fallback naming below handles missing mappings.
        }
      }

      const enrichedDrivers = (sessionData.drivers ?? []).map((driver) => {
        const mappedCode = numberToCode.get(driver.driverNumber)
        if (mappedCode) return { ...driver, code: mappedCode }
        const parts = driver.driverName.split(' ')
        const lastName = parts[parts.length - 1] || driver.driverName
        return { ...driver, code: lastName.substring(0, 3).toUpperCase() }
      })

      set({
        sessionData: { ...sessionData, drivers: enrichedDrivers },
        laps,
        selectedYear: year,
        selectedRace: race,
        selectedSession: session,
        loadingState: 'ready',
        error: null
      })
    } catch (err) {
      set({ error: String(err), loadingState: 'error' })
    }
  },

  clearSession: () => {
    const { seasons, races } = get()
    set({
      seasons,
      races,
      selectedYear: null,
      selectedRace: null,
      selectedSession: null,
      sessionData: null,
      laps: [],
      loadingState: 'idle',
      error: null
    })
  }
}))
