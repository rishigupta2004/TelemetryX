import { create } from 'zustand'
import { api, toApiErrorInfo } from '../api/client'
import { useDriverStore } from './driverStore'
import { usePlaybackStore } from './playbackStore'
import { useTelemetryStore } from './telemetryStore'
import type { ApiErrorInfo, LapRow, PositionRow, Race, Season, SessionVizResponse, TyreStint } from '../types'

// ── Race-condition guard (same pattern as telemetryStore) ──────────────
let latestSessionRequestId = 0

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
  apiError: ApiErrorInfo | null
  fetchSeasons: () => Promise<void>
  fetchRaces: (year: number) => Promise<void>
  loadSession: (year: number, race: string, session: string) => Promise<void>
  clearSession: () => void
}

// ── Convenience selectors ─────────────────────────────────────────────
export const selectPositions = (state: SessionState): PositionRow[] =>
  state.sessionData?.positions ?? []

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
  apiError: null,

  fetchSeasons: async () => {
    set({ loadingState: 'loading', error: null, apiError: null })
    try {
      const seasons = await api.getSeasons()
      set((state) => ({
        seasons,
        loadingState: state.sessionData ? 'ready' : 'idle'
      }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  fetchRaces: async (year) => {
    set({ loadingState: 'loading', error: null, apiError: null, selectedYear: year, selectedRace: null, selectedSession: null })
    try {
      const races = await api.getRaces(year)
      set((state) => ({
        races,
        loadingState: state.sessionData ? 'ready' : 'idle'
      }))
    } catch (err) {
      const apiError = toApiErrorInfo(err)
      set({ error: apiError.message, apiError, loadingState: 'error' })
    }
  },

  loadSession: async (year, race, session) => {
    // ── Issue 2: race-condition guard via request ID ──────────────
    const requestId = ++latestSessionRequestId

    // ── Issue 4: reset driver selection before loading new data ───
    useDriverStore.getState().clearSelection()
    useTelemetryStore.getState().clearTelemetry()

    set({
      loadingState: 'loading',
      error: null,
      apiError: null,
      selectedYear: year,
      selectedRace: race,
      selectedSession: session,
      laps: [],
      tyreStints: null
    })
    try {
      const data = await api.getSessionViz(year, race, session)

      // Stale response check
      if (requestId !== latestSessionRequestId) return

      const numberToCode = new Map<number, string>()

      for (const lap of data.laps ?? []) {
        const code = lap.driverName
        if (code && lap.driverNumber != null) numberToCode.set(lap.driverNumber, code)
      }

      if (numberToCode.size === 0) {
        try {
          const telemetry = await api.getTelemetry(year, race, session, 0, 120, 1)
          if (requestId !== latestSessionRequestId) return
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

      // ── Playback duration with proper fallback chain ──
      const setDurationFromLaps = (laps: LapRow[]) => {
        if (!laps.length) return false
        const allLapEnds = laps
          .map((lap) => lap.lapEndSeconds)
          .filter((t) => Number.isFinite(t) && t > 0)
        const allLapStarts = laps
          .map((lap) => lap.lapStartSeconds)
          .filter((t) => Number.isFinite(t) && t > 0)
        if (allLapEnds.length && allLapStarts.length) {
          const sessionStartTime = Math.min(...allLapStarts)
          const sessionEndTime = Math.max(...allLapEnds)
          const duration = Math.max(0, sessionEndTime - sessionStartTime)
          if (duration > 0) {
            usePlaybackStore.getState().setDuration(duration, sessionStartTime)
            return true
          }
        }
        return false
      }

      let durationSet = setDurationFromLaps(data.laps ?? [])

      if (!durationSet) {
        const meta = data.metadata

        // Resolve sessionStartTime: raceStartSeconds → timeBounds[0] → 0
        const posBoundsStart = meta.positionsTimeBounds?.[0]
        const telBoundsStart = meta.telemetryTimeBounds?.[0]
        const sessionStartTime =
          meta.raceStartSeconds ??
          (Number.isFinite(posBoundsStart) ? (posBoundsStart as number) : null) ??
          (Number.isFinite(telBoundsStart) ? (telBoundsStart as number) : null) ??
          0

        let rawDuration: number | null = null

        if (Number.isFinite(meta.raceDurationSeconds) && (meta.raceDurationSeconds as number) > 0) {
          rawDuration = meta.raceDurationSeconds as number
        } else if (
          Number.isFinite(meta.raceStartSeconds) &&
          Number.isFinite(meta.raceEndSeconds) &&
          (meta.raceEndSeconds as number) > (meta.raceStartSeconds as number)
        ) {
          rawDuration = (meta.raceEndSeconds as number) - (meta.raceStartSeconds as number)
        } else if (
          meta.positionsTimeBounds &&
          Number.isFinite(meta.positionsTimeBounds[0]) &&
          Number.isFinite(meta.positionsTimeBounds[1]) &&
          meta.positionsTimeBounds[1] > meta.positionsTimeBounds[0]
        ) {
          rawDuration = meta.positionsTimeBounds[1] - meta.positionsTimeBounds[0]
        } else if (
          meta.telemetryTimeBounds &&
          Number.isFinite(meta.telemetryTimeBounds[0]) &&
          Number.isFinite(meta.telemetryTimeBounds[1]) &&
          meta.telemetryTimeBounds[1] > meta.telemetryTimeBounds[0]
        ) {
          rawDuration = meta.telemetryTimeBounds[1] - meta.telemetryTimeBounds[0]
        } else if (Number.isFinite(meta.duration) && meta.duration > 0) {
          rawDuration = meta.duration
        }

        if (rawDuration != null && rawDuration > 0) {
          usePlaybackStore.getState().setDuration(rawDuration, sessionStartTime)
        }
      }

      // Stale response check before committing
      if (requestId !== latestSessionRequestId) return

      // ── Commit viz data immediately for fast first paint ──
      set({
        sessionData: { ...data, drivers: enrichedDrivers },
        laps: data.laps ?? [],
        selectedYear: year,
        selectedRace: race,
        selectedSession: session,
        loadingState: 'ready',
        error: null,
        apiError: null
      })

      if (enrichedDrivers.length > 0) {
        useDriverStore.getState().selectPrimary(enrichedDrivers[0].code)
      }

      // ── Background enrichment: full laps (non-blocking) ──
      api.getLaps(year, race, session)
        .then((fullLaps) => {
          if (requestId !== latestSessionRequestId) return
          const current = get()
          if (
            current.selectedYear !== year ||
            current.selectedRace !== race ||
            current.selectedSession !== session
          ) return
          if (fullLaps && fullLaps.length >= (current.laps?.length ?? 0)) {
            set({ laps: fullLaps })
            // Re-compute playback duration with enriched laps
            setDurationFromLaps(fullLaps)
          }
        })
        .catch((e) => {
          console.warn('Could not load full laps, using viz laps:', e)
        })

      api.getIdentityAssets(year, race, session)
        .then((assets) => {
          if (requestId !== latestSessionRequestId) return
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
          if (requestId !== latestSessionRequestId) return
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
      error: null,
      apiError: null
    })
  }
}))
