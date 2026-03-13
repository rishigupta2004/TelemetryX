import { create } from 'zustand'
import { fetchRaces, fetchSeasons, fetchSession, fetchSessions, fetchLaps, fetchPositions, slugifyRace } from '../api/sessions'
import { usePlaybackStore } from './playbackStore'
import { useDriverStore } from './driverStore'
import type { ApiErrorInfo, Driver, LapRow, Race, Season, SessionInfoResponse, SessionMetadata, SessionResponse } from '../types'
import { toApiErrorInfo } from '../api/client'

let latestSessionRequestId = 0

const selectSessionMeta = (s: SessionState) => s.sessionMeta
const selectDrivers = (s: SessionState) => s.drivers
const selectLaps = (s: SessionState) => s.laps
const selectSessionData = (s: SessionState) => s.sessionData
const selectLoadingState = (s: SessionState) => s.loadingState
const selectError = (s: SessionState) => s.error
const selectSeasons = (s: SessionState) => s.seasons
const selectRaces = (s: SessionState) => s.races
const selectSessions = (s: SessionState) => s.sessions

export const useSessionSelectors = () => useSessionStore(selectSessionMeta)
export const useDrivers = () => useSessionStore(selectDrivers)
export const useLaps = () => useSessionStore(selectLaps)
export const useSessionData = () => useSessionStore(selectSessionData)
export const useLoadingState = () => useSessionStore(selectLoadingState)
export const useSessionError = () => useSessionStore(selectError)
export const useSeasons = () => useSessionStore(selectSeasons)
export const useRaces = () => useSessionStore(selectRaces)
export const useSessions = () => useSessionStore(selectSessions)

export const useSessionSelection = () => useSessionStore(
  (s) => ({ year: s.selectedYear, race: s.selectedRace, session: s.selectedSession })
)

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
      set(s => ({ seasons, loadingState: s.sessionMeta ? 'ready' : 'idle' }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  fetchRaces: async (year) => {
    set({ loadingState: 'loading', error: null, apiError: null, selectedYear: year, selectedRace: null, selectedSession: null, sessions: [] })
    try {
      const races = await fetchRaces(year)
      set(s => ({ races, loadingState: s.sessionMeta ? 'ready' : 'idle' }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  fetchSessions: async (year, race) => {
    set({ loadingState: 'loading', error: null, apiError: null, selectedRace: race, selectedSession: null })
    try {
      const data: SessionInfoResponse = await fetchSessions(year, race)
      set(s => ({ sessions: data.sessions ?? [], loadingState: s.sessionMeta ? 'ready' : 'idle' }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  loadSession: async (year, race, session) => {
    const requestId = ++latestSessionRequestId
    useDriverStore.getState().clearSelection()

    set({
      loadingState: 'loading', error: null, apiError: null,
      selectedYear: year, selectedRace: race, selectedSession: session,
      sessionMeta: null, drivers: [], laps: [], sessionData: null
    })

    try {
      const data = await fetchSession(year, race, session)
      if (requestId !== latestSessionRequestId) return

      const numToCode = new Map<number, string>()
      for (const lap of data.laps ?? []) {
        if (lap.driverNumber != null && lap.driverName) numToCode.set(lap.driverNumber, lap.driverName)
      }

      const enrichedDrivers = (data.drivers ?? []).map(d => {
        const mapped = numToCode.get(d.driverNumber)
        if (mapped) return { ...d, code: mapped }
        const lastName = d.driverName.split(' ').pop() || d.driverName
        return { ...d, code: lastName.substring(0, 3).toUpperCase() }
      })

      const sessionMeta = data.metadata
      const laps = data.laps ?? []

      set({
        sessionMeta,
        drivers: enrichedDrivers,
        laps,
        sessionData: { ...data, drivers: enrichedDrivers, positions: data.positions ?? [], weather: data.weather ?? [], raceControl: data.raceControl ?? [], trackGeometry: data.trackGeometry ?? null },
        loadingState: 'ready', error: null, apiError: null
      })

      if (enrichedDrivers.length) useDriverStore.getState().selectPrimary(enrichedDrivers[0].code)

      const setDur = (rows: LapRow[]) => {
        if (!rows.length) return false
        const starts = rows.map(l => l.lapStartSeconds).filter(t => Number.isFinite(t) && t > 0)
        const ends = rows.map(l => l.lapEndSeconds).filter(t => Number.isFinite(t) && t > 0)
        if (!starts.length || !ends.length) return false
        const dur = Math.max(0, Math.max(...ends) - Math.min(...starts))
        if (dur <= 0) return false
        usePlaybackStore.getState().setDuration(dur, Math.min(...starts))
        return true
      }

      if (!setDur(laps) && sessionMeta?.duration) usePlaybackStore.getState().setDuration(sessionMeta.duration, 0)

      fetchLaps(year, race, session).then(fullLaps => {
        if (requestId !== latestSessionRequestId) return
        const cur = get()
        if (cur.selectedYear !== year || cur.selectedRace !== race || cur.selectedSession !== session) return
        if (fullLaps && fullLaps.length >= cur.laps.length) {
          set({ laps: fullLaps })
          setDur(fullLaps)
        }
      }).catch(() => {})

      fetchPositions(year, race, session).then(posRows => {
        if (requestId !== latestSessionRequestId) return
        const cur = get()
        if (cur.selectedYear !== year || cur.selectedRace !== race || cur.selectedSession !== session) return
        if (posRows?.length && cur.sessionData) {
          set({ sessionData: { ...cur.sessionData, positions: posRows } })
        }
      }).catch(() => {})
    } catch (err) {
      if (requestId !== latestSessionRequestId) return
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  clearSession: () => {
    latestSessionRequestId++
    const { seasons, races } = get()
    usePlaybackStore.getState().reset()
    useDriverStore.getState().clearSelection()
    set({
      seasons, races, sessions: [], selectedYear: null, selectedRace: null,
      selectedSession: null, sessionMeta: null, drivers: [], laps: [],
      sessionData: null, loadingState: 'idle', error: null, apiError: null
    })
  }
}))

export const buildSessionSlug = (race: string) => slugifyRace(race)
