import { create } from 'zustand'
import { fetchRaces, fetchSeasons, fetchSession, fetchSessions, fetchLaps, fetchPositions, slugifyRace } from '../api/sessions'
import { usePlaybackStore } from './playbackStore'
import { useDriverStore } from './driverStore'
import type { ApiErrorInfo, Driver, LapRow, Race, Season, SessionInfoResponse, SessionMetadata, SessionResponse } from '../types'
import { isAbortLikeError, toApiErrorInfo } from '../api/client'

// Demo data constants
const DEMO_SEASONS: Season[] = [
  { year: 2024, startDate: '2024-03-01', endDate: '2024-12-01' }
]

const DEMO_RACES_2024: Race[] = [
  { name: 'Monaco Grand Prix', slug: 'monaco-grand-prix', country: 'Monaco', city: 'Monte Carlo', date: '2024-05-26' },
  { name: 'Bahrain Grand Prix', slug: 'bahrain-grand-prix', country: 'Bahrain', city: 'Sakhir', date: '2024-03-02' },
  { name: 'Saudi Arabian Grand Prix', slug: 'saudi-arabian-grand-prix', country: 'Saudi Arabia', city: 'Jeddah', date: '2024-03-09' },
  { name: 'Australian Grand Prix', slug: 'australian-grand-prix', country: 'Australia', city: 'Melbourne', date: '2024-03-24' },
  { name: 'Japanese Grand Prix', slug: 'japanese-grand-prix', country: 'Japan', city: 'Suzuka', date: '2024-04-07' },
  { name: 'Chinese Grand Prix', slug: 'chinese-grand-prix', country: 'China', city: 'Shanghai', date: '2024-04-21' },
  { name: 'Miami Grand Prix', slug: 'miami-grand-prix', country: 'USA', city: 'Miami', date: '2024-05-05' },
  { name: 'Emilia Romagna Grand Prix', slug: 'emilia-romagna-grand-prix', country: 'Italy', city: 'Imola', date: '2024-05-19' },
  { name: 'Canadian Grand Prix', slug: 'canadian-grand-prix', country: 'Canada', city: 'Montreal', date: '2024-06-09' },
  { name: 'Spanish Grand Prix', slug: 'spanish-grand-prix', country: 'Spain', city: 'Barcelona', date: '2024-06-23' },
  { name: 'Austrian Grand Prix', slug: 'austrian-grand-prix', country: 'Austria', city: 'Spielberg', date: '2024-06-30' },
  { name: 'British Grand Prix', slug: 'british-grand-prix', country: 'UK', city: 'Silverstone', date: '2024-07-07' },
  { name: 'Hungarian Grand Prix', slug: 'hungarian-grand-prix', country: 'Hungary', city: 'Budapest', date: '2024-07-21' },
  { name: 'Belgian Grand Prix', slug: 'belgian-grand-prix', country: 'Belgium', city: 'Spa', date: '2024-07-28' },
  { name: 'Dutch Grand Prix', slug: 'dutch-grand-prix', country: 'Netherlands', city: 'Zandvoort', date: '2024-08-25' },
  { name: 'Italian Grand Prix', slug: 'italian-grand-prix', country: 'Italy', city: 'Monza', date: '2024-09-01' },
  { name: 'Azerbaijan Grand Prix', slug: 'azerbaijan-grand-prix', country: 'Azerbaijan', city: 'Baku', date: '2024-09-15' },
  { name: 'Singapore Grand Prix', slug: 'singapore-grand-prix', country: 'Singapore', city: 'Singapore', date: '2024-09-22' },
  { name: 'United States Grand Prix', slug: 'united-states-grand-prix', country: 'USA', city: 'Austin', date: '2024-10-20' },
  { name: 'Mexico City Grand Prix', slug: 'mexico-city-grand-prix', country: 'Mexico', city: 'Mexico City', date: '2024-10-27' },
  { name: 'São Paulo Grand Prix', slug: 'sao-paulo-grand-prix', country: 'Brazil', city: 'São Paulo', date: '2024-11-03' },
  { name: 'Las Vegas Grand Prix', slug: 'las-vegas-grand-prix', country: 'USA', city: 'Las Vegas', date: '2024-11-23' },
  { name: 'Qatar Grand Prix', slug: 'qatar-grand-prix', country: 'Qatar', city: 'Losail', date: '2024-12-01' },
  { name: 'Abu Dhabi Grand Prix', slug: 'abu-dhabi-grand-prix', country: 'UAE', city: 'Yas Island', date: '2024-12-08' }
]

const DEMO_SESSIONS = ['FP1', 'FP2', 'FP3', 'Q', 'R']

let latestSessionRequestId = 0
let latestSeasonsRequestId = 0
let latestRacesRequestId = 0
let latestSessionsRequestId = 0

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

export const useSelectedYear = () => useSessionStore(s => s.selectedYear)
export const useSelectedRace = () => useSessionStore(s => s.selectedRace)
export const useSelectedSession = () => useSessionStore(s => s.selectedSession)

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
  autoLoadDemo: () => Promise<void>
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
    const requestId = ++latestSeasonsRequestId
    set({ loadingState: 'loading', error: null, apiError: null })
    try {
      const seasons = await fetchSeasons()
      if (requestId !== latestSeasonsRequestId) return
      set(s => ({ seasons, loadingState: s.sessionMeta ? 'ready' : 'idle' }))
    } catch (err) {
      if (requestId !== latestSeasonsRequestId) return
      if (isAbortLikeError(err)) {
        set(s => ({ loadingState: s.sessionMeta ? 'ready' : 'idle', error: null, apiError: null }))
        return
      }
      const apiError = toApiErrorInfo(err)
      const isNetworkError = apiError.code === null && /fetch|network|connection/i.test(apiError.message)
      if (isNetworkError) {
        console.log('API unreachable, falling back to demo data')
        set({ seasons: DEMO_SEASONS, loadingState: 'ready', error: null, apiError: null })
      } else {
        set({ error: apiError.message, apiError, loadingState: 'error' })
      }
    }
  },

  fetchRaces: async (year) => {
    const requestId = ++latestRacesRequestId
    set({ loadingState: 'loading', error: null, apiError: null, selectedYear: year, selectedRace: null, selectedSession: null, sessions: [] })
    try {
      const races = await fetchRaces(year)
      if (requestId !== latestRacesRequestId) return
      set(s => ({ races, loadingState: s.sessionMeta ? 'ready' : 'idle' }))
    } catch (err) {
      if (requestId !== latestRacesRequestId) return
      if (isAbortLikeError(err)) {
        set(s => ({ loadingState: s.sessionMeta ? 'ready' : 'idle', error: null, apiError: null }))
        return
      }
      const apiError = toApiErrorInfo(err)
      const isNetworkError = apiError.code === null && /fetch|network|connection/i.test(apiError.message)
      if (isNetworkError) {
        console.log('API unreachable, falling back to demo data')
        set({ races: DEMO_RACES_2024, loadingState: 'ready', error: null, apiError: null })
      } else {
        set({ error: apiError.message, apiError, loadingState: 'error' })
      }
    }
  },

  fetchSessions: async (year, race) => {
    const requestId = ++latestSessionsRequestId
    set({ loadingState: 'loading', error: null, apiError: null, selectedRace: race, selectedSession: null })
    try {
      const data = await fetchSessions(year, race)
      if (requestId !== latestSessionsRequestId) return
      set(s => ({ sessions: data.sessions ?? [], loadingState: s.sessionMeta ? 'ready' : 'idle' }))
    } catch (err) {
      if (requestId !== latestSessionsRequestId) return
      if (isAbortLikeError(err)) {
        set(s => ({ loadingState: s.sessionMeta ? 'ready' : 'idle', error: null, apiError: null }))
        return
      }
      const apiError = toApiErrorInfo(err)
      const isNetworkError = apiError.code === null && /fetch|network|connection/i.test(apiError.message)
      if (isNetworkError) {
        console.log('API unreachable, falling back to demo data')
        set({ sessions: DEMO_SESSIONS, loadingState: 'ready', error: null, apiError: null })
      } else {
        set({ error: apiError.message, apiError, loadingState: 'error' })
      }
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

    console.log('[SESSION STORE] loadSession called:', year, race, session)

    try {
      console.log('[SESSION STORE] Calling fetchSession...')
      const data = await fetchSession(year, race, session)
      console.log('[SESSION STORE] fetchSession returned, drivers:', data.drivers?.length, 'laps:', data.laps?.length)
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

      console.log('[SESSION STORE] set drivers:', enrichedDrivers.length)
      console.log('[SESSION STORE] set laps:', laps.length)
      console.log('[SESSION STORE] set sessionData:', !!data)

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

  autoLoadDemo: async () => {
    const isDemo = (import.meta as unknown as { env?: { VITE_DEMO_MODE?: string } })?.env?.VITE_DEMO_MODE === 'true'
    if (!isDemo) return
    
    console.log('[DEMO] Auto-loading Monaco 2024 Race...')
    const year = 2024
    const race = 'monaco-grand-prix'
    const session = 'R'
    
    set({
      seasons: DEMO_SEASONS,
      races: DEMO_RACES_2024,
      sessions: DEMO_SESSIONS,
      selectedYear: year,
      selectedRace: race,
      selectedSession: session
    })
    
    await get().loadSession(year, race, session)
  },

  clearSession: () => {
    latestSessionRequestId++
    latestSeasonsRequestId++
    latestRacesRequestId++
    latestSessionsRequestId++
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
