import React, { useMemo, useState } from 'react'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { WeatherPanel } from '../components/WeatherPanel'
import { usePlaybackStore } from '../stores/playbackStore'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import type { Driver, LapRow } from '../types'

type LiveDriverState = {
  driverCode: string
  position: number | null
  lapNumber: number | null
  tyreCompound: string | null
  lapTime: number | null
  pitStops: number
}

type DriverLapTimeline = {
  laps: LapRow[]
  starts: number[]
  ends: number[]
  pitStopsPrefix: number[]
}

function filterDriverLaps(laps: LapRow[], driverCode: string, driverNumber: number): LapRow[] {
  return laps.filter((lap) => lap.driverNumber === driverNumber || lap.driverName === driverCode).sort((a, b) => a.lapStartSeconds - b.lapStartSeconds)
}

function upperBound(values: number[], target: number): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (values[mid] <= target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function buildTimeline(driverLaps: LapRow[]): DriverLapTimeline {
  const starts = new Array<number>(driverLaps.length)
  const ends = new Array<number>(driverLaps.length)
  const pitStopsPrefix = new Array<number>(driverLaps.length)
  let stops = 0

  for (let i = 0; i < driverLaps.length; i += 1) {
    const lap = driverLaps[i]
    starts[i] = lap.lapStartSeconds
    ends[i] = lap.lapEndSeconds
    if (i > 0) {
      const prev = String(driverLaps[i - 1].tyreCompound || '').toUpperCase()
      const curr = String(lap.tyreCompound || '').toUpperCase()
      if (prev && curr && prev !== curr) stops += 1
    }
    pitStopsPrefix[i] = stops
  }

  return { laps: driverLaps, starts, ends, pitStopsPrefix }
}

export const TrackView = React.memo(function TrackView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  const sessionTime = sessionStartTime + currentTime

  const driversByCode = useMemo(() => {
    const map = new Map<string, Driver>()
    for (const driver of sessionData?.drivers ?? []) map.set(driver.code, driver)
    return map
  }, [sessionData?.drivers])

  const lapsByDriver = useMemo(() => {
    const laps = sessionData?.laps ?? []
    const drivers = sessionData?.drivers ?? []
    const map = new Map<string, DriverLapTimeline>()
    for (const driver of drivers) {
      const driverLaps = filterDriverLaps(laps, driver.code, driver.driverNumber)
      map.set(driver.code, buildTimeline(driverLaps))
    }
    return map
  }, [sessionData?.drivers, sessionData?.laps])

  const liveState = useMemo(() => {
    const resolve = (driverCode: string | null): LiveDriverState | null => {
      if (!driverCode) return null
      const driver = driversByCode.get(driverCode)
      if (!driver) return null

      const timeline = lapsByDriver.get(driver.code)
      if (!timeline || !timeline.laps.length) return null

      const activeIdx = upperBound(timeline.starts, sessionTime) - 1
      const completedCount = upperBound(timeline.ends, sessionTime)
      const referenceIdx = activeIdx >= 0 ? activeIdx : completedCount > 0 ? completedCount - 1 : 0
      const referenceLap = timeline.laps[referenceIdx]
      const pitStops = completedCount > 0 ? timeline.pitStopsPrefix[completedCount - 1] : 0

      return {
        driverCode,
        position: referenceLap.position ?? null,
        lapNumber: referenceLap.lapNumber ?? null,
        tyreCompound: referenceLap.tyreCompound ?? null,
        lapTime: referenceLap.lapTime ?? null,
        pitStops
      }
    }

    return {
      primary: resolve(primaryDriver),
      compare: resolve(compareDriver)
    }
  }, [driversByCode, lapsByDriver, sessionTime, primaryDriver, compareDriver])

  const positionDelta = useMemo(() => {
    if (!liveState.primary?.position || !liveState.compare?.position) return null
    return liveState.compare.position - liveState.primary.position
  }, [liveState.compare?.position, liveState.primary?.position])

  const renderDriverTile = (label: string, state: LiveDriverState | null) => (
    <div className="glass-panel rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-secondary">{label}</div>
      {!state ? (
        <div className="mt-1 text-xs text-text-muted">Not selected</div>
      ) : (
        <div className="mt-1 space-y-1 text-xs">
          <div className="font-mono text-text-primary">
            {state.driverCode} | P{state.position ?? '-'} | L{state.lapNumber ?? '-'}
          </div>
          <div className="text-text-muted">Tyre {state.tyreCompound || '-'}</div>
          <div className="text-text-muted">Lap time {state.lapTime != null ? `${state.lapTime.toFixed(3)}s` : '-'}</div>
          <div className="text-text-muted">Pit stops {state.pitStops}</div>
        </div>
      )}
    </div>
  )

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 p-5 xl:gap-5 xl:p-6 ${isMapFullscreen ? '' : 'xl:flex-row'}`}>
      <div className={`glass-panel relative min-w-0 rounded-2xl p-2.5 ${isMapFullscreen ? 'h-full min-h-0 flex-1' : 'min-h-[52vh] xl:min-h-0 xl:flex-1'}`}>
        <button
          type="button"
          onClick={() => setIsMapFullscreen((prev) => !prev)}
          className="absolute right-4 top-3 z-20 rounded border border-border bg-bg-secondary/90 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-text-secondary transition hover:border-accent-blue/70 hover:text-text-primary"
        >
          {isMapFullscreen ? 'Exit Full Screen' : 'Full Screen Map'}
        </button>
        <TrackMap />
      </div>

      {!isMapFullscreen && (
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:w-[420px] xl:flex-shrink-0 xl:flex-col">
          {renderDriverTile('Primary Driver', liveState.primary)}
          {renderDriverTile('Compare Driver', liveState.compare)}

          <div className="glass-panel rounded-xl p-3 md:col-span-2 xl:col-span-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-secondary">Delta</div>
            <div className="mt-1 font-mono text-sm text-text-primary">
              {positionDelta == null ? 'No compare delta' : `Compare position delta ${positionDelta > 0 ? '+' : ''}${positionDelta}`}
            </div>
          </div>

          <div className="h-[250px] md:col-span-2 xl:col-span-1">
            <WeatherPanel />
          </div>

          <div className="min-h-[220px] md:col-span-2 xl:min-h-0 xl:flex-1">
            <RaceControlFeed />
          </div>
        </div>
      )}
    </div>
  )
})
