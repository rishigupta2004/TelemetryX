import { create } from 'zustand'
import { fetchRaces, fetchSeasons, fetchSession, fetchSessions, fetchLaps, fetchPositions, slugifyRace } from '../api/sessions'
import { usePlaybackStore } from './playbackStore'
import { useDriverStore } from './driverStore'
import type { ApiErrorInfo, Driver, LapRow, Race, Season, SessionInfoResponse, SessionMetadata, SessionResponse } from '../types'
import { toApiErrorInfo } from '../api/client'

let latestSessionRequestId = 0

interface SessionState {
  seasons: Season[]
  races: Race[]
  sessions: string[]
  selectedYear: number | null
  selectedRace: string | null
  selectedSession: string | null
  sessionMeta: SessionMetadata | null
  drivers: Driver[]
  laps: LapRow[]
  sessionData: SessionResponse | null
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  apiError: ApiErrorInfo | null
  fetchSeasons: () => Promise<void>
  fetchRaces: (year: number) => Promise<void>
  fetchSessions: (year: number, race: string) => Promise<void>
  loadSession: (year: number, race: string, session: string) => Promise<void>
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  seasons: [],
  races: [],
  sessions: [],
  selectedYear: null,
  selectedRace: null,
  selectedSession: null,
  sessionMeta: null,
  drivers: [],
  laps: [],
  sessionData: null,
  loadingState: 'idle',
  error: null,
  apiError: null,

  fetchSeasons: async () => {
    set({ loadingState: 'loading', error: null, apiError: null })
    try {
      const seasons = await fetchSeasons()
      set((state) => ({
        seasons,
        loadingState: state.sessionMeta ? 'ready' : 'idle'
      }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  fetchRaces: async (year) => {
    set({ loadingState: 'loading', error: null, apiError: null, selectedYear: year, selectedRace: null, selectedSession: null, sessions: [] })
    try {
      const races = await fetchRaces(year)
      set((state) => ({
        races,
        loadingState: state.sessionMeta ? 'ready' : 'idle'
      }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  fetchSessions: async (year, race) => {
    set({ loadingState: 'loading', error: null, apiError: null, selectedRace: race, selectedSession: null })
    try {
      const data: SessionInfoResponse = await fetchSessions(year, race)
      set((state) => ({
        sessions: data.sessions ?? [],
        loadingState: state.sessionMeta ? 'ready' : 'idle'
      }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  loadSession: async (year, race, session) => {
    const requestId = ++latestSessionRequestId

    useDriverStore.getState().clearSelection()

    set({
      loadingState: 'loading',
      error: null,
      apiError: null,
      selectedYear: year,
      selectedRace: race,
      selectedSession: session,
      sessionMeta: null,
      drivers: [],
      laps: [],
      sessionData: null
    })

    try {
      const data = await fetchSession(year, race, session)
      if (requestId !== latestSessionRequestId) return

      const numberToCode = new Map<number, string>()
      for (const lap of data.laps ?? []) {
        if (lap.driverNumber != null && lap.driverName) numberToCode.set(lap.driverNumber, lap.driverName)
      }

      const enrichedDrivers = (data.drivers ?? []).map((driver) => {
        const mappedCode = numberToCode.get(driver.driverNumber)
        if (mappedCode) return { ...driver, code: mappedCode }
        const parts = driver.driverName.split(' ')
        const lastName = parts[parts.length - 1] || driver.driverName
        return { ...driver, code: lastName.substring(0, 3).toUpperCase() }
      })

      const sessionMeta = data.metadata
      const laps = data.laps ?? []

      set({
        sessionMeta,
        drivers: enrichedDrivers,
        laps,
        sessionData: {
          ...data,
          drivers: enrichedDrivers,
          positions: data.positions ?? [],
          weather: data.weather ?? [],
          raceControl: data.raceControl ?? [],
          trackGeometry: data.trackGeometry ?? null
        },
        loadingState: 'ready',
        error: null,
        apiError: null
      })

      if (enrichedDrivers.length > 0) {
        useDriverStore.getState().selectPrimary(enrichedDrivers[0].code)
      }

      const setDurationFromLaps = (rows: LapRow[]) => {
        if (!rows.length) return false
        const starts = rows.map((lap) => lap.lapStartSeconds).filter((t) => Number.isFinite(t) && t > 0)
        const ends = rows.map((lap) => lap.lapEndSeconds).filter((t) => Number.isFinite(t) && t > 0)
        if (!starts.length || !ends.length) return false
        const sessionStartTime = Math.min(...starts)
        const sessionEndTime = Math.max(...ends)
        const duration = Math.max(0, sessionEndTime - sessionStartTime)
        if (duration <= 0) return false
        usePlaybackStore.getState().setDuration(duration, sessionStartTime)
        return true
      }

      if (!setDurationFromLaps(laps) && sessionMeta?.duration) {
        usePlaybackStore.getState().setDuration(sessionMeta.duration, 0)
      }

      fetchLaps(year, race, session)
        .then((fullLaps) => {
          if (requestId !== latestSessionRequestId) return
          const current = get()
          if (current.selectedYear !== year || current.selectedRace !== race || current.selectedSession !== session) return
          if (fullLaps && fullLaps.length >= current.laps.length) {
            set({ laps: fullLaps })
            setDurationFromLaps(fullLaps)
          }
        })
        .catch(() => {
          // Leave laps as-is
        })

      // Fetch car positions for the track map (separate endpoint, large dataset)
      fetchPositions(year, race, session)
        .then((posRows) => {
          if (requestId !== latestSessionRequestId) return
          const current = get()
          if (current.selectedYear !== year || current.selectedRace !== race || current.selectedSession !== session) return
          if (posRows && posRows.length > 0 && current.sessionData) {
            set({
              sessionData: {
                ...current.sessionData,
                positions: posRows
              }
            })
          }
        })
        .catch(() => {
          // Positions are optional — track map will use timing-based fallback
        })
    } catch (err) {
      if (requestId !== latestSessionRequestId) return
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  clearSession: () => {
    latestSessionRequestId += 1
    const { seasons, races } = get()
    usePlaybackStore.getState().reset()
    useDriverStore.getState().clearSelection()
    set({
      seasons,
      races,
      sessions: [],
      selectedYear: null,
      selectedRace: null,
      selectedSession: null,
      sessionMeta: null,
      drivers: [],
      laps: [],
      sessionData: null,
      loadingState: 'idle',
      error: null,
      apiError: null
    })
  }
}))

export function buildSessionSlug(race: string): string {
  return slugifyRace(race)
}
