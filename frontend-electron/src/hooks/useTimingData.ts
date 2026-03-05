import { useMemo } from 'react'
import { useCarPositions } from './useCarPositions'
import { useSessionTime30 } from '../lib/timeUtils'
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

function computeAverageValidLapTime(laps: LapRow[]): number | null {
  let sum = 0
  let count = 0
  for (const lap of laps) {
    if (isValidLap(lap) && lap.lapTime != null && lap.lapTime > 0) {
      sum += lap.lapTime
      count += 1
    }
  }
  return count > 0 ? sum / count : null
}

function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs
}

function formatDelta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds === 0) return '+0.000s'
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

function lapDurationSeconds(lap: LapRow): number {
  const lapTime = lap.lapTime ?? 0
  if (Number.isFinite(lapTime) && lapTime > 0) return lapTime
  const derived = lap.lapEndSeconds - lap.lapStartSeconds
  if (Number.isFinite(derived) && derived > 0) return derived
  return 0
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
        // Detect pitstops: use isPitOutLap flag if available (catches same-compound pits),
        // otherwise fall back to tyre compound change detection
        if ((lap as any).isPitOutLap === true) {
          pitCount += 1
        } else {
          const prevComp = normalizeCompound(laps[i - 1].tyreCompound)
          const curComp = normalizeCompound(lap.tyreCompound)
          if (prevComp !== '—' && curComp !== '—' && prevComp !== curComp) pitCount += 1
        }
      }
      if ((lap.lapTime || 0) > 0 && isValidLap(lap)) {
        bestLap = bestLap == null ? (lap.lapTime as number) : Math.min(bestLap, lap.lapTime as number)
      }
      elapsedTime += lapDurationSeconds(lap)
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
  const sessionTime = useSessionTime30()
  const carPositions = useCarPositions()
  // Round to 30Hz to limit timing tower re-computation (30 times/sec vs 60fps)
  const roundedSessionTime = Math.round(sessionTime * 30) / 30
  const sampledSessionTime = roundedSessionTime

  const index = useMemo(() => {
    if (!sessionData?.drivers?.length) return null
    const allLaps = lapsFromStore.length ? lapsFromStore : sessionData.laps
    if (!allLaps.length) return null
    return buildTimingIndex(sessionData.drivers, allLaps)
  }, [sessionData?.drivers, sessionData?.laps, lapsFromStore])

  const carPositionByNumber = useMemo(() => {
    const map = new Map<number, { progress: number; currentLap: number; isInPit: boolean }>()
    for (const car of carPositions) {
      map.set(car.driverNumber, {
        progress: car.progress,
        currentLap: car.currentLap,
        isInPit: car.isInPit
      })
    }
    return map
  }, [carPositions])

  const rows = useMemo(() => {
    if (!sessionData?.drivers?.length || !index) return []

    const lastCompletedEndByDriver = new Map<number, number | null>()
    const completedLapByDriver = new Map<number, number>()

    const effectiveSessionTime = sampledSessionTime
    const completedExclusive = upperBoundLapEnd(index.allLapsByEnd, effectiveSessionTime)
    const completedIdx = completedExclusive - 1
    const sessionBestS1 = completedIdx >= 0 ? index.sessionBestS1ByEnd[completedIdx] : Number.POSITIVE_INFINITY
    const sessionBestS2 = completedIdx >= 0 ? index.sessionBestS2ByEnd[completedIdx] : Number.POSITIVE_INFINITY
    const sessionBestS3 = completedIdx >= 0 ? index.sessionBestS3ByEnd[completedIdx] : Number.POSITIVE_INFINITY

    const rows: TimingRow[] = index.driverBundles.map(({ driver, laps, prefixValidCount, prefixPitCount, prefixBestLap, prefixBestS1, prefixBestS2, prefixBestS3 }) => {
      if (!laps.length) {
        lastCompletedEndByDriver.set(driver.driverNumber, null)
        completedLapByDriver.set(driver.driverNumber, 0)
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

      const lastLapEnd = laps[laps.length - 1].lapEndSeconds

      const completedCount = upperBoundLapEnd(laps, effectiveSessionTime)
      const lastCompletedLap = completedCount > 0 ? laps[completedCount - 1] : null
      const currentInProgressLap = findCurrentLap(laps, effectiveSessionTime)
      const currentLapData = currentInProgressLap || lastCompletedLap || laps[0]
      lastCompletedEndByDriver.set(driver.driverNumber, lastCompletedLap?.lapEndSeconds ?? null)
      completedLapByDriver.set(driver.driverNumber, lastCompletedLap?.lapNumber ?? Math.max(0, (currentLapData?.lapNumber ?? 1) - 1))

      const lapStart = currentLapData.lapStartSeconds
      const lapEnd = currentLapData.lapEndSeconds
      const lapTimeRef = currentLapData.lapTime || lastCompletedLap?.lapTime || 90
      const rawLapDuration = Math.max(0, lapEnd - lapStart)
      const lapDuration = rawLapDuration > 1 ? rawLapDuration : Math.max(1, lapTimeRef)
      const lapProgress = Math.max(0, Math.min(1, (effectiveSessionTime - lapStart) / lapDuration))

      let displayS1: number | null = null
      let displayS2: number | null = null
      let displayS3: number | null = null
      if (currentInProgressLap) {
        // Use actual sector timing ratios when available instead of hardcoded 0.33/0.66
        const s1Time = currentInProgressLap.sector1
        const s2Time = currentInProgressLap.sector2
        const s1Frac = (s1Time && s1Time > 0 && lapDuration > 0) ? s1Time / lapDuration : 0.33
        const s2Frac = s1Frac + ((s2Time && s2Time > 0 && lapDuration > 0) ? s2Time / lapDuration : 0.33)
        if (lapProgress > s1Frac) displayS1 = currentInProgressLap.sector1
        if (lapProgress > s2Frac) displayS2 = currentInProgressLap.sector2
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
      // Use completedCount (all laps ended before sessionTime) for classification,
      // not prefixValidCount which only counts valid laps — DNF sort needs total laps
      const lapsCompleted = completedCount
      let lapDistance = Math.max(Math.max(0, currentLapData.lapNumber - 1), completedCount) + lapProgress
      const carPos = carPositionByNumber.get(driver.driverNumber)
      let derivedLapNumber = currentLapData.lapNumber
      // If we only have the last completed lap (no in-progress), the driver is ON the next lap
      if (!currentInProgressLap && lastCompletedLap && effectiveSessionTime > lastCompletedLap.lapEndSeconds) {
        derivedLapNumber = lastCompletedLap.lapNumber + 1
      }
      // Car position data overrides if available
      if (carPos && Number.isFinite(carPos.currentLap) && carPos.currentLap > 0) {
        derivedLapNumber = carPos.currentLap
      }
      if (carPos) {
        const carLap = derivedLapNumber
        const carDistance = Math.max(0, carLap - 1) + Math.max(0, Math.min(1, carPos.progress))
        if (Number.isFinite(carDistance)) lapDistance = carDistance
      }

      let compound = '—'
      if (currentInProgressLap?.tyreCompound) compound = normalizeCompound(currentInProgressLap.tyreCompound)
      else if (lastCompletedLap?.tyreCompound) compound = normalizeCompound(lastCompletedLap.tyreCompound)
      else if (laps[0]?.tyreCompound) compound = normalizeCompound(laps[0].tyreCompound)

      let status: TimingRow['status'] = 'racing'

      // DNS/DNF detection guards:
      // - Only mark DNS if enough session time has passed AND driver has had no laps
      // - At Lap 1 (leaderMaxLap <= 1), don't mark DNS until at least 120s have passed
      //   (before that, all drivers appear stationary which would false-positive as DNS)
      const minDNSThreshold = (index.leaderMaxLap ?? 0) <= 1 ? 120 : 8
      if (completedCount === 0 && !currentInProgressLap && laps[0] &&
        effectiveSessionTime > laps[0].lapStartSeconds + minDNSThreshold) {
        status = 'dns'
      } else if (completedCount > 0 && !currentInProgressLap) {
        const lastLapDuration = lapDurationSeconds(lastCompletedLap ?? currentLapData)
        // Use a generous threshold to avoid false-flagging slow laps or safety car periods
        const stallThreshold = Math.max(30, lastLapDuration * 0.5)
        if (effectiveSessionTime - lastLapEnd > stallThreshold) {
          status = 'dnf'
        }
      } else if (lapDuration > 120 && lapProgress > 0.8) status = 'pit'

      if (carPos?.isInPit && status === 'racing') {
        status = 'pit'
      }

      if (status === 'dnf' || status === 'dns') lapDistance = -1

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
        currentLap: derivedLapNumber,
        currentSector,
        lapsCompleted,
        lapProgress,
        lapDistance,
        lapTimeRef
      }
    })

    rows.sort((a, b) => {
      const aRetired = a.status === 'dnf' || a.status === 'dns' || a.status === 'out'
      const bRetired = b.status === 'dnf' || b.status === 'dns' || b.status === 'out'
      // DNS always last
      if (a.status === 'dns' && b.status !== 'dns') return 1
      if (b.status === 'dns' && a.status !== 'dns') return -1
      // DNF/OUT after racing drivers
      if (aRetired && !bRetired) return 1
      if (bRetired && !aRetired) return -1
      // Both retired: more laps completed = higher
      if (aRetired && bRetired) {
        if (a.lapsCompleted !== b.lapsCompleted) return b.lapsCompleted - a.lapsCompleted
        return a.driverNumber - b.driverNumber
      }
      // Both racing: more distance = higher position
      if (Math.abs(a.lapDistance - b.lapDistance) > 1e-6) return b.lapDistance - a.lapDistance
      // Tie-break by stale position, then driver number
      if (a.position !== b.position) return a.position - b.position
      return a.driverNumber - b.driverNumber
    })

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 1) {
        rows[i].position = i + 1
      }
    }

    if (rows.length > 0 && (rows[0].status === 'racing' || rows[0].status === 'pit')) {
      const leaderDistance = rows[0].lapDistance
      rows[0].gap = 'LEADER'
      rows[0].interval = '—'

      const leaderCompletedEnd = lastCompletedEndByDriver.get(rows[0].driverNumber) ?? null
      const leaderCompletedLap = completedLapByDriver.get(rows[0].driverNumber) ?? Math.max(0, rows[0].currentLap - 1)

      // Get a reference lap time for distance→time conversion
      const lapSecondsForRow = (row: TimingRow) => {
        const driverLaps = index.lapsByDriverNumber.get(row.driverNumber) ?? []
        if (!driverLaps.length) return Number.NaN
        // Use latest completed lap time for most accurate real-time gap
        const completedIdx = Math.min(driverLaps.length - 1, Math.max(0, row.currentLap - 2))
        const latestLap = driverLaps[completedIdx]
        if (latestLap && isValidLap(latestLap) && latestLap.lapTime && latestLap.lapTime > 0) {
          return latestLap.lapTime
        }
        // Fall back to average
        const avgLapTime = computeAverageValidLapTime(driverLaps)
        if (avgLapTime != null && avgLapTime > 0) return avgLapTime
        const idx = Math.max(0, Math.min(driverLaps.length - 1, row.currentLap - 1))
        const lap = driverLaps[idx]
        const dur = lapDurationSeconds(lap)
        return Number.isFinite(dur) && dur > 0 ? dur : Math.max(1, row.lapTimeRef)
      }

      const leaderLapSeconds = lapSecondsForRow(rows[0])

      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].status === 'dns') {
          rows[i].gap = 'DNS'
          rows[i].interval = '—'
          continue
        }
        if (rows[i].status === 'dnf' || rows[i].status === 'out') {
          rows[i].gap = 'DNF'
          rows[i].interval = '—'
          continue
        }

        const driverDistance = rows[i].lapDistance
        const aheadDistance = rows[i - 1].lapDistance
        const driverCompletedLap = completedLapByDriver.get(rows[i].driverNumber) ?? Math.max(0, rows[i].currentLap - 1)
        const aheadCompletedLap = completedLapByDriver.get(rows[i - 1].driverNumber) ?? Math.max(0, rows[i - 1].currentLap - 1)
        const aheadLapSeconds = lapSecondsForRow(rows[i - 1])
        const driverCompletedEnd = lastCompletedEndByDriver.get(rows[i].driverNumber) ?? null

        // --- Live distance delta (changes every tick for real-time feel) ---
        const distDeltaToLeader = leaderDistance - driverDistance
        const distDeltaToAhead = aheadDistance - driverDistance

        // Full lap difference: only show +NL when BOTH completed laps differ AND
        // the distance gap is also >= 0.75 laps — prevents the transient +1L flash
        // at the lap boundary when the leader crosses before others update
        const fullLapsBehindLeader = leaderCompletedLap - driverCompletedLap
        const fullLapsBehindAhead = aheadCompletedLap - driverCompletedLap
        const trulyLappedByLeader = fullLapsBehindLeader >= 1 && distDeltaToLeader >= 0.75
        const trulyLappedByAhead = fullLapsBehindAhead >= 1 && distDeltaToAhead >= 0.75

        // --- Gap to leader ---
        if (trulyLappedByLeader) {
          // Truly lapped: use completed lap difference (not distance-based which fluctuates)
          rows[i].gap = `+${fullLapsBehindLeader}L`
        } else {
          // Same lap (or within 1 lap) — show live time gap
          let timeGap = Number.NaN
          // If both crossed the same completed lap, use actual crossing difference as base
          if (leaderCompletedEnd != null && driverCompletedEnd != null && driverCompletedLap === leaderCompletedLap) {
            const crossingGap = driverCompletedEnd - leaderCompletedEnd
            // Blend crossing gap with live distance progress for smooth real-time updates
            const progressDelta = (rows[0].lapProgress - rows[i].lapProgress)
            const progressTimeDelta = progressDelta * leaderLapSeconds
            // Weight: use crossing time + progress-based delta within current lap
            if (crossingGap >= 0 && Number.isFinite(progressTimeDelta)) {
              timeGap = crossingGap + progressTimeDelta
            } else if (crossingGap >= 0) {
              timeGap = crossingGap
            }
          }
          // Fallback: pure distance-based gap
          if (!Number.isFinite(timeGap) || timeGap < 0) {
            if (Number.isFinite(leaderLapSeconds) && leaderLapSeconds > 0 && distDeltaToLeader >= 0) {
              timeGap = distDeltaToLeader * leaderLapSeconds
            }
          }
          rows[i].gap = Number.isFinite(timeGap) && timeGap >= 0 ? formatDelta(timeGap) : '—'
        }

        // --- Interval to car ahead ---
        if (trulyLappedByAhead) {
          rows[i].interval = `+${fullLapsBehindAhead}L`
        } else {
          let intervalTime = Number.NaN
          const aheadCompletedEnd = lastCompletedEndByDriver.get(rows[i - 1].driverNumber) ?? null
          if (aheadCompletedEnd != null && driverCompletedEnd != null && driverCompletedLap === aheadCompletedLap) {
            const crossingInterval = driverCompletedEnd - aheadCompletedEnd
            const progressDelta = (rows[i - 1].lapProgress - rows[i].lapProgress)
            const progressTimeDelta = progressDelta * aheadLapSeconds
            if (crossingInterval >= 0 && Number.isFinite(progressTimeDelta)) {
              intervalTime = crossingInterval + progressTimeDelta
            } else if (crossingInterval >= 0) {
              intervalTime = crossingInterval
            }
          }
          if (!Number.isFinite(intervalTime) || intervalTime < 0) {
            if (Number.isFinite(aheadLapSeconds) && aheadLapSeconds > 0 && distDeltaToAhead >= 0) {
              intervalTime = distDeltaToAhead * aheadLapSeconds
            }
          }
          rows[i].interval = Number.isFinite(intervalTime) && intervalTime >= 0 ? formatDelta(intervalTime) : '—'
        }
      }
    }


    return rows
  }, [index, sampledSessionTime, sessionData?.drivers, carPositionByNumber])

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
