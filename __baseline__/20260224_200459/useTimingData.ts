import { useMemo } from 'react'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { Driver, LapRow } from '../types'

type SectorColor = 'purple' | 'green' | 'yellow' | 'white'

export interface TimingRow {
  position: number
  driverCode: string
  driverName: string
  driverNumber: number
  teamColor: string
  teamName: string
  driverImage?: string | null
  teamImage?: string | null
  gap: string
  interval: string
  lastLap: string
  bestLap: string
  bestLapTime: number | null
  tyreCompound: string
  pits: number
  sector1: number | null
  sector2: number | null
  sector3: number | null
  s1Color: SectorColor
  s2Color: SectorColor
  s3Color: SectorColor
  status: 'racing' | 'pit' | 'out' | 'dnf' | 'dns'
  currentLap: number
  currentSector: 1 | 2 | 3
  lapsCompleted: number
  lapProgress: number
  lapDistance: number
  lapTimeRef: number
}

export interface UseTimingDataResult {
  rows: TimingRow[]
  status: 'loading' | 'ready' | 'empty' | 'error'
  error: string | null
}

interface ElapsedInfo {
  totalTime: number
  lapsCompleted: number
}

interface DriverLapBundle {
  driver: Driver
  laps: LapRow[]
  prefixElapsedTime: number[]
  prefixValidCount: number[]
  prefixPitCount: number[]
  prefixBestLap: Array<number | null>
  prefixBestS1: number[]
  prefixBestS2: number[]
  prefixBestS3: number[]
}

interface TimingIndex {
  allLapsByEnd: LapRow[]
  sessionBestS1ByEnd: number[]
  sessionBestS2ByEnd: number[]
  sessionBestS3ByEnd: number[]
  driverBundles: DriverLapBundle[]
  lapsByDriverNumber: Map<number, LapRow[]>
  elapsedByDriverNumber: Map<number, number[]>
  leaderMaxLap: number
}

const COMPOUND_MAP: Record<string, string> = {
  S: 'SOFT',
  M: 'MEDIUM',
  H: 'HARD',
  I: 'INTERMEDIATE',
  W: 'WET'
}

function isValidLap(lap: LapRow): boolean {
  return !!lap.lapTime && lap.lapTime > 0 && lap.isValid !== false && lap.isDeleted !== true
}

function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs
}

function formatDelta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0.001) return '+0.000s'
  if (seconds < 60) return `+${seconds.toFixed(3)}s`
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3).padStart(6, '0')
  return `+${mins}:${secs}s`
}

function getSectorColor(value: number | null, sessionBest: number, personalBest: number): SectorColor {
  if (!value || value <= 0) return 'white'
  if (sessionBest === Number.POSITIVE_INFINITY) return 'yellow'
  if (personalBest === Number.POSITIVE_INFINITY && value <= sessionBest + 0.005) return 'purple'
  if (value <= sessionBest + 0.005) return 'purple'
  if (personalBest < Number.POSITIVE_INFINITY && value <= personalBest + 0.005) return 'green'
  return 'yellow'
}

function normalizeCompound(raw: string | null | undefined): string {
  if (!raw) return '—'
  const upper = raw.toUpperCase()
  if (COMPOUND_MAP[upper]) return COMPOUND_MAP[upper]
  if (upper === 'SOFT' || upper === 'MEDIUM' || upper === 'HARD' || upper === 'INTERMEDIATE' || upper === 'WET') {
    return upper
  }
  return '—'
}

function upperBoundLapEnd(laps: LapRow[], t: number): number {
  let lo = 0
  let hi = laps.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (laps[mid].lapEndSeconds <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

function findCurrentLap(laps: LapRow[], t: number): LapRow | null {
  let lo = 0
  let hi = laps.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const lap = laps[mid]
    if (lap.lapStartSeconds <= t && t < lap.lapEndSeconds) return lap
    if (t < lap.lapStartSeconds) hi = mid - 1
    else lo = mid + 1
  }
  return null
}

function getElapsedAtPosition(driverLaps: LapRow[], prefixElapsedTime: number[], sessionTime: number): ElapsedInfo {
  if (!driverLaps.length) return { totalTime: 0, lapsCompleted: 0 }

  const completedIdx = upperBoundLapEnd(driverLaps, sessionTime)
  if (completedIdx <= 0) return { totalTime: 0, lapsCompleted: 0 }

  const totalTime = prefixElapsedTime[Math.min(prefixElapsedTime.length - 1, completedIdx - 1)] ?? 0

  const currentLap = findCurrentLap(driverLaps, sessionTime)
  const partialTime = currentLap ? Math.max(0, sessionTime - currentLap.lapStartSeconds) : 0
  return { totalTime: totalTime + partialTime, lapsCompleted: completedIdx }
}

function buildTimingIndex(drivers: Driver[], allLaps: LapRow[]): TimingIndex {
  const lapsByDriverNumber = new Map<number, LapRow[]>()
  const lapsByDriverCode = new Map<string, LapRow[]>()

  for (const lap of allLaps) {
    const byNum = lapsByDriverNumber.get(lap.driverNumber) ?? []
    byNum.push(lap)
    lapsByDriverNumber.set(lap.driverNumber, byNum)

    if (lap.driverName) {
      const byCode = lapsByDriverCode.get(lap.driverName) ?? []
      byCode.push(lap)
      lapsByDriverCode.set(lap.driverName, byCode)
    }
  }

  const driverBundles: DriverLapBundle[] = drivers.map((driver) => {
    const laps = (lapsByDriverNumber.get(driver.driverNumber) ?? lapsByDriverCode.get(driver.code) ?? []).slice()
    laps.sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)

    const prefixValidCount: number[] = new Array(laps.length)
    const prefixPitCount: number[] = new Array(laps.length)
    const prefixElapsedTime: number[] = new Array(laps.length)
    const prefixBestLap: Array<number | null> = new Array(laps.length)
    const prefixBestS1: number[] = new Array(laps.length)
    const prefixBestS2: number[] = new Array(laps.length)
    const prefixBestS3: number[] = new Array(laps.length)

    let validCount = 0
    let pitCount = 0
    let elapsedTime = 0
    let bestLap: number | null = null
    let bestS1 = Number.POSITIVE_INFINITY
    let bestS2 = Number.POSITIVE_INFINITY
    let bestS3 = Number.POSITIVE_INFINITY

    for (let i = 0; i < laps.length; i += 1) {
      const lap = laps[i]
      if (isValidLap(lap)) validCount += 1
      if (i > 0) {
        const prevComp = normalizeCompound(laps[i - 1].tyreCompound)
        const curComp = normalizeCompound(lap.tyreCompound)
        if (prevComp !== '—' && curComp !== '—' && prevComp !== curComp) pitCount += 1
      }
      if ((lap.lapTime || 0) > 0 && isValidLap(lap)) {
        bestLap = bestLap == null ? (lap.lapTime as number) : Math.min(bestLap, lap.lapTime as number)
      }
      elapsedTime += lap.lapTime || 0
      if ((lap.sector1 || 0) > 0) bestS1 = Math.min(bestS1, lap.sector1 as number)
      if ((lap.sector2 || 0) > 0) bestS2 = Math.min(bestS2, lap.sector2 as number)
      if ((lap.sector3 || 0) > 0) bestS3 = Math.min(bestS3, lap.sector3 as number)

      prefixValidCount[i] = validCount
      prefixPitCount[i] = pitCount
      prefixElapsedTime[i] = elapsedTime
      prefixBestLap[i] = bestLap
      prefixBestS1[i] = bestS1
      prefixBestS2[i] = bestS2
      prefixBestS3[i] = bestS3
    }

    return {
      driver,
      laps,
      prefixElapsedTime,
      prefixValidCount,
      prefixPitCount,
      prefixBestLap,
      prefixBestS1,
      prefixBestS2,
      prefixBestS3
    }
  })

  const allLapsByEnd = allLaps.slice().sort((a, b) => a.lapEndSeconds - b.lapEndSeconds)
  const sessionBestS1ByEnd: number[] = new Array(allLapsByEnd.length)
  const sessionBestS2ByEnd: number[] = new Array(allLapsByEnd.length)
  const sessionBestS3ByEnd: number[] = new Array(allLapsByEnd.length)
  let sessionBestS1 = Number.POSITIVE_INFINITY
  let sessionBestS2 = Number.POSITIVE_INFINITY
  let sessionBestS3 = Number.POSITIVE_INFINITY
  for (let i = 0; i < allLapsByEnd.length; i += 1) {
    const lap = allLapsByEnd[i]
    if ((lap.sector1 || 0) > 0) sessionBestS1 = Math.min(sessionBestS1, lap.sector1 as number)
    if ((lap.sector2 || 0) > 0) sessionBestS2 = Math.min(sessionBestS2, lap.sector2 as number)
    if ((lap.sector3 || 0) > 0) sessionBestS3 = Math.min(sessionBestS3, lap.sector3 as number)
    sessionBestS1ByEnd[i] = sessionBestS1
    sessionBestS2ByEnd[i] = sessionBestS2
    sessionBestS3ByEnd[i] = sessionBestS3
  }

  const driverLapsLookup = new Map<number, LapRow[]>()
  const driverElapsedLookup = new Map<number, number[]>()
  for (const bundle of driverBundles) {
    driverLapsLookup.set(bundle.driver.driverNumber, bundle.laps)
    driverElapsedLookup.set(bundle.driver.driverNumber, bundle.prefixElapsedTime)
  }

  const leaderMaxLap = Math.max(...allLaps.map((lap) => lap.lapNumber || 0))

  return {
    allLapsByEnd,
    sessionBestS1ByEnd,
    sessionBestS2ByEnd,
    sessionBestS3ByEnd,
    driverBundles,
    lapsByDriverNumber: driverLapsLookup,
    elapsedByDriverNumber: driverElapsedLookup,
    leaderMaxLap
  }
}

export function useTimingData(): UseTimingDataResult {
  const sessionData = useSessionStore((s) => s.sessionData)
  const lapsFromStore = useSessionStore((s) => s.laps)
  const loadingState = useSessionStore((s) => s.loadingState)
  const sessionError = useSessionStore((s) => s.error)
  const sessionTime = useSessionTime()
  const speed = usePlaybackStore((s) => s.speed)
  const samplingHz = speed >= 12 ? 30 : speed >= 8 ? 24 : speed >= 4 ? 20 : 15
  const sampledSessionTime = Math.round(sessionTime * samplingHz) / samplingHz

  const index = useMemo(() => {
    if (!sessionData?.drivers?.length) return null
    const allLaps = lapsFromStore.length ? lapsFromStore : sessionData.laps
    if (!allLaps.length) return null
    return buildTimingIndex(sessionData.drivers, allLaps)
  }, [sessionData?.drivers, sessionData?.laps, lapsFromStore])

  const rows = useMemo(() => {
    if (!sessionData?.drivers?.length || !index) return []

    const effectiveSessionTime = sampledSessionTime
    const completedExclusive = upperBoundLapEnd(index.allLapsByEnd, effectiveSessionTime)
    const completedIdx = completedExclusive - 1
    const sessionBestS1 = completedIdx >= 0 ? index.sessionBestS1ByEnd[completedIdx] : Number.POSITIVE_INFINITY
    const sessionBestS2 = completedIdx >= 0 ? index.sessionBestS2ByEnd[completedIdx] : Number.POSITIVE_INFINITY
    const sessionBestS3 = completedIdx >= 0 ? index.sessionBestS3ByEnd[completedIdx] : Number.POSITIVE_INFINITY

    const rows: TimingRow[] = index.driverBundles.map(({ driver, laps, prefixValidCount, prefixPitCount, prefixBestLap, prefixBestS1, prefixBestS2, prefixBestS3 }) => {
      if (!laps.length) {
        return {
          position: 99,
          driverCode: driver.code || '???',
          driverName: driver.driverName || '',
          driverNumber: driver.driverNumber,
          teamColor: driver.teamColor || '#666666',
          teamName: driver.teamName || 'Unknown',
          driverImage: driver.driverImage || null,
          teamImage: driver.teamImage || null,
          gap: '—',
          interval: '—',
          lastLap: '—',
          bestLap: '—',
          bestLapTime: null,
          tyreCompound: '—',
          pits: 0,
          sector1: null,
          sector2: null,
          sector3: null,
          s1Color: 'white',
          s2Color: 'white',
          s3Color: 'white',
          status: 'dns',
          currentLap: 0,
          currentSector: 1,
          lapsCompleted: 0,
          lapProgress: 0,
          lapDistance: 0,
          lapTimeRef: 90
        }
      }

      const firstLapStart = laps[0].lapStartSeconds
      const lastLapEnd = laps[laps.length - 1].lapEndSeconds

      const completedCount = upperBoundLapEnd(laps, effectiveSessionTime)
      const lastCompletedLap = completedCount > 0 ? laps[completedCount - 1] : null
      const currentInProgressLap = findCurrentLap(laps, effectiveSessionTime)
      const currentLapData = currentInProgressLap || lastCompletedLap || laps[0]

      const lapStart = currentLapData.lapStartSeconds
      const lapEnd = currentLapData.lapEndSeconds
      const lapDuration = Math.max(1, lapEnd - lapStart)
      const lapProgress = Math.max(0, Math.min(1, (effectiveSessionTime - lapStart) / lapDuration))

      let displayS1: number | null = null
      let displayS2: number | null = null
      let displayS3: number | null = null
      if (currentInProgressLap) {
        if (lapProgress > 0.33) displayS1 = currentInProgressLap.sector1
        if (lapProgress > 0.66) displayS2 = currentInProgressLap.sector2
      }

      if (lastCompletedLap) {
        const timeSinceCompletion = effectiveSessionTime - lastCompletedLap.lapEndSeconds
        if (timeSinceCompletion >= 0 && timeSinceCompletion < 5) {
          displayS1 = lastCompletedLap.sector1
          displayS2 = lastCompletedLap.sector2
          displayS3 = lastCompletedLap.sector3
        } else if (timeSinceCompletion >= 5 && timeSinceCompletion < 8 && !displayS1) {
          displayS3 = lastCompletedLap.sector3
        }
      }

      let currentSector: 1 | 2 | 3 = 1
      if (lapProgress > 0.33 && lapProgress <= 0.66) currentSector = 2
      if (lapProgress > 0.66) currentSector = 3

      const completedIdx = completedCount - 1
      const bestLapTime = completedIdx >= 0 ? prefixBestLap[completedIdx] : null
      const personalBestS1 = completedIdx >= 0 ? prefixBestS1[completedIdx] : Number.POSITIVE_INFINITY
      const personalBestS2 = completedIdx >= 0 ? prefixBestS2[completedIdx] : Number.POSITIVE_INFINITY
      const personalBestS3 = completedIdx >= 0 ? prefixBestS3[completedIdx] : Number.POSITIVE_INFINITY
      const pitCount = completedIdx >= 0 ? prefixPitCount[completedIdx] : 0
      const lapsCompleted = completedIdx >= 0 ? prefixValidCount[completedIdx] : 0
      const lapDistance = Math.max(Math.max(0, currentLapData.lapNumber - 1), lapsCompleted) + lapProgress

      let compound = '—'
      if (currentInProgressLap?.tyreCompound) compound = normalizeCompound(currentInProgressLap.tyreCompound)
      else if (lastCompletedLap?.tyreCompound) compound = normalizeCompound(lastCompletedLap.tyreCompound)
      else if (laps[0]?.tyreCompound) compound = normalizeCompound(laps[0].tyreCompound)

      let status: TimingRow['status'] = 'racing'
      if (effectiveSessionTime < firstLapStart - 10) status = 'dns'
      else if (lapsCompleted > 0 && effectiveSessionTime > lastLapEnd + 30 && currentLapData.lapNumber < index.leaderMaxLap - 2) {
        status = 'dnf'
      } else if (lapDuration > 120 && lapProgress > 0.8) status = 'pit'

      return {
        position: currentLapData.position || 99,
        driverCode: driver.code || currentLapData.driverName || '???',
        driverName: driver.driverName || '',
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#666666',
        teamName: driver.teamName || 'Unknown',
        driverImage: driver.driverImage || null,
        teamImage: driver.teamImage || null,
        gap: '—',
        interval: '—',
        lastLap: formatLapTime(lastCompletedLap?.lapTime),
        bestLap: formatLapTime(bestLapTime),
        bestLapTime,
        tyreCompound: compound,
        pits: pitCount,
        sector1: displayS1,
        sector2: displayS2,
        sector3: displayS3,
        s1Color: getSectorColor(displayS1, sessionBestS1, personalBestS1),
        s2Color: getSectorColor(displayS2, sessionBestS2, personalBestS2),
        s3Color: getSectorColor(displayS3, sessionBestS3, personalBestS3),
        status,
        currentLap: currentLapData.lapNumber,
        currentSector,
        lapsCompleted,
        lapProgress,
        lapDistance,
        lapTimeRef: currentLapData.lapTime || lastCompletedLap?.lapTime || 90
      }
    })

    rows.sort((a, b) => {
      if (a.status === 'dns' && b.status !== 'dns') return 1
      if (b.status === 'dns' && a.status !== 'dns') return -1
      if (a.status === 'dnf' && b.status !== 'dnf') return 1
      if (b.status === 'dnf' && a.status !== 'dnf') return -1
      if (Math.abs(a.lapDistance - b.lapDistance) > 1e-6) return b.lapDistance - a.lapDistance
      if (a.position !== b.position) return a.position - b.position
      return a.driverNumber - b.driverNumber
    })

    if (rows.length > 0 && (rows[0].status === 'racing' || rows[0].status === 'pit')) {
      const leaderLaps = index.lapsByDriverNumber.get(rows[0].driverNumber) ?? []
      const leaderElapsed = getElapsedAtPosition(
        leaderLaps,
        index.elapsedByDriverNumber.get(rows[0].driverNumber) ?? [],
        effectiveSessionTime
      )
      const leaderDistance = rows[0].lapDistance
      rows[0].gap = 'LEADER'
      rows[0].interval = '—'

      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].status !== 'racing' && rows[i].status !== 'pit') {
          rows[i].gap = '—'
          rows[i].interval = '—'
          continue
        }

        const driverLaps = index.lapsByDriverNumber.get(rows[i].driverNumber) ?? []
        const driverElapsed = getElapsedAtPosition(
          driverLaps,
          index.elapsedByDriverNumber.get(rows[i].driverNumber) ?? [],
          effectiveSessionTime
        )
        const driverDistance = rows[i].lapDistance
        const aheadDistance = rows[i - 1].lapDistance
        const lapDeltaToLeader = leaderDistance - driverDistance
        const lapDeltaToAhead = aheadDistance - driverDistance
        const timeGapToLeader = Math.max(0, driverElapsed.totalTime - leaderElapsed.totalTime)
        const aheadLaps = index.lapsByDriverNumber.get(rows[i - 1].driverNumber) ?? []
        const aheadElapsed = getElapsedAtPosition(
          aheadLaps,
          index.elapsedByDriverNumber.get(rows[i - 1].driverNumber) ?? [],
          effectiveSessionTime
        )
        const intervalToAhead = Math.max(0, driverElapsed.totalTime - aheadElapsed.totalTime)

        if (lapDeltaToLeader >= 0.98) rows[i].gap = `+${Math.max(1, Math.floor(lapDeltaToLeader + 1e-6))}L`
        else rows[i].gap = formatDelta(timeGapToLeader)

        if (lapDeltaToAhead >= 0.98) rows[i].interval = `+${Math.max(1, Math.floor(lapDeltaToAhead + 1e-6))}L`
        else rows[i].interval = formatDelta(intervalToAhead)
      }
    }

    return rows
  }, [index, sampledSessionTime, sessionData?.drivers])

  return useMemo(() => {
    if (loadingState === 'error') {
      return {
        rows,
        status: 'error',
        error: sessionError || 'Failed to load timing data'
      }
    }
    if (loadingState === 'loading' && rows.length === 0) {
      return {
        rows,
        status: 'loading',
        error: null
      }
    }
    if (rows.length === 0) {
      return {
        rows,
        status: 'empty',
        error: null
      }
    }
    return {
      rows,
      status: 'ready',
      error: null
    }
  }, [loadingState, rows, sessionError])
}
