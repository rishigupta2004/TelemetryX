import { create } from 'zustand'
import { api } from '../api/client'
import { useDriverStore } from './driverStore'
import { usePlaybackStore } from './playbackStore'
import { useTelemetryStore } from './telemetryStore'
import type { LapRow, Race, Season, SessionVizResponse, TyreStint } from '../types'

interface SessionState {
  seasons: Season[]
  races: Race[]
  selectedYear: number | null
  selectedRace: string | null
  selectedSession: string | null
  sessionData: SessionVizResponse | null
  laps: LapRow[]
  tyreStints: TyreStint[] | null
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
  tyreStints: null,
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
    const state = get()
    if (state.loadingState === 'loading') return

    useDriverStore.getState().clearSelection()
    useTelemetryStore.getState().clearTelemetry()

    set({
      loadingState: 'loading',
      error: null,
      selectedYear: year,
      selectedRace: race,
      selectedSession: session,
      laps: [],
      tyreStints: null
    })
    try {
      const data = await api.getSessionViz(year, race, session)

      try {
        const fullLaps = await api.getLaps(year, race, session)
        if (fullLaps && fullLaps.length > (data.laps?.length ?? 0)) {
          data.laps = fullLaps
        }
      } catch (e) {
        console.warn('Could not load full laps, using viz laps:', e)
      }

      const numberToCode = new Map<number, string>()

      for (const lap of data.laps ?? []) {
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

      const enrichedDrivers = (data.drivers ?? []).map((driver) => {
        const mappedCode = numberToCode.get(driver.driverNumber)
        if (mappedCode) return { ...driver, code: mappedCode }
        const parts = driver.driverName.split(' ')
        const lastName = parts[parts.length - 1] || driver.driverName
        return { ...driver, code: lastName.substring(0, 3).toUpperCase() }
      })

      if ((data.laps?.length ?? 0) > 0) {
        const allLapEnds = data.laps
          .map((lap) => lap.lapEndSeconds)
          .filter((t) => Number.isFinite(t) && t > 0)
        const allLapStarts = data.laps
          .map((lap) => lap.lapStartSeconds)
          .filter((t) => Number.isFinite(t) && t > 0)
        if (allLapEnds.length && allLapStarts.length) {
          const sessionStartTime = Math.min(...allLapStarts)
          const sessionEndTime = Math.max(...allLapEnds)
          const duration = Math.max(0, sessionEndTime - sessionStartTime)
          usePlaybackStore.getState().setDuration(duration, sessionStartTime)
        }
      }

      set({
        sessionData: { ...data, drivers: enrichedDrivers },
        laps: data.laps ?? [],
        selectedYear: year,
        selectedRace: race,
        selectedSession: session,
        loadingState: 'ready',
        error: null
      })

      if (enrichedDrivers.length > 0) {
        useDriverStore.getState().selectPrimary(enrichedDrivers[0].code)
      }

      api.getIdentityAssets(year, race, session)
        .then((assets) => {
          if (!assets?.enabled || !assets.drivers?.length) return
          const byNumber = new Map(
            assets.drivers
              .filter((item) => item.driverNumber != null)
              .map((item) => [Number(item.driverNumber), item])
          )
          const current = get()
          if (
            current.selectedYear !== year ||
            current.selectedRace !== race ||
            current.selectedSession !== session ||
            !current.sessionData
          ) {
            return
          }
          const updatedDrivers = current.sessionData.drivers.map((driver) => {
            const match = byNumber.get(driver.driverNumber)
            if (!match) return driver
            return {
              ...driver,
              driverImage: match.driverImage ?? driver.driverImage ?? null,
              teamImage: match.teamImage ?? driver.teamImage ?? null
            }
          })
          set({
            sessionData: {
              ...current.sessionData,
              drivers: updatedDrivers
            }
          })
        })
        .catch((err) => {
          console.warn('Identity image enrichment unavailable:', err)
        })

      api.getTyreStints(year, race, session)
        .then((stints) => {
          const current = get()
          if (
            current.selectedYear === year &&
            current.selectedRace === race &&
            current.selectedSession === session
          ) {
            set({ tyreStints: stints })
          }
        })
        .catch((err) => {
          console.warn('Tyre data not available:', err)
        })
    } catch (err) {
      set({ error: String(err), loadingState: 'error' })
    }
  },

  clearSession: () => {
    const { seasons, races } = get()
    usePlaybackStore.getState().reset()
    useDriverStore.getState().clearSelection()
    useTelemetryStore.getState().clearTelemetry()
    set({
      seasons,
      races,
      selectedYear: null,
      selectedRace: null,
      selectedSession: null,
      sessionData: null,
      laps: [],
      tyreStints: null,
      loadingState: 'idle',
      error: null
    })
  }
}))
