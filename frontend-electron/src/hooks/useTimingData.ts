import { useMemo } from 'react'
import { useCarPositions } from './useCarPositions'
import { useSessionTime30 } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'
import { ubLaps, currentLap } from '../lib/telemetryUtils'
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
  sessionBestLap: number | null
  status: 'loading' | 'ready' | 'empty' | 'error'
  error: string | null
}

const COMPOUND_MAP: Record<string, string> = { S: 'SOFT', M: 'MEDIUM', H: 'HARD', I: 'INTERMEDIATE', W: 'WET' }

const isValidLap = (lap: LapRow) => !!lap.lapTime && lap.lapTime > 0 && lap.isValid !== false && lap.isDeleted !== true

const fmtLap = (s: number | null | undefined): string => {
  if (s == null || !Number.isFinite(s) || s <= 0) return '—'
  const m = Math.floor(s / 60), sec = (s % 60).toFixed(3)
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : sec
}

const fmtDelta = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) return '—'
  if (s === 0) return '+0.000s'
  if (s < 60) return `+${s.toFixed(3)}s`
  const m = Math.floor(s / 60)
  return `+${m}:${(s % 60).toFixed(3).padStart(6, '0')}s`
}

const getSectorColor = (v: number | null, sb: number, pb: number): SectorColor => {
  if (!v || v <= 0) return 'white'
  if (sb === Number.POSITIVE_INFINITY) return 'yellow'
  if (pb === Number.POSITIVE_INFINITY && v <= sb + 0.005) return 'purple'
  if (v <= sb + 0.005) return 'purple'
  if (pb < Number.POSITIVE_INFINITY && v <= pb + 0.005) return 'green'
  return 'yellow'
}

const normCompound = (raw: string | null | undefined): string => {
  if (!raw) return '—'
  const u = raw.toUpperCase()
  return COMPOUND_MAP[u] ?? (u === 'SOFT' || u === 'MEDIUM' || u === 'HARD' || u === 'INTERMEDIATE' || u === 'WET' ? u : '—')
}

const lapDur = (lap: LapRow): number => {
  const t = lap.lapTime ?? 0
  if (Number.isFinite(t) && t > 0) return t
  const d = lap.lapEndSeconds - lap.lapStartSeconds
  return Number.isFinite(d) && d > 0 ? d : 0
}

const buildIndex = (drivers: Driver[], allLaps: LapRow[]) => {
  const byNum = new Map<number, LapRow[]>()
  const byCode = new Map<string, LapRow[]>()

  for (const lap of allLaps) {
    const arr = byNum.get(lap.driverNumber) ?? []; arr.push(lap); byNum.set(lap.driverNumber, arr)
    if (lap.driverName) { const c = byCode.get(lap.driverName) ?? []; c.push(lap); byCode.set(lap.driverName, c) }
  }

  const bundles = drivers.map(driver => {
    const laps = (byNum.get(driver.driverNumber) ?? byCode.get(driver.code) ?? []).slice()
    laps.sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)

    const pValid = new Array(laps.length), pPit = new Array(laps.length), pElapsed = new Array(laps.length)
    const pBestLap = new Array(laps.length), pBestS1 = new Array(laps.length), pBestS2 = new Array(laps.length), pBestS3 = new Array(laps.length)

    let validCnt = 0, pitCnt = 0, elapsed = 0, bestLap: number | null = null, bestS1 = Number.POSITIVE_INFINITY, bestS2 = Number.POSITIVE_INFINITY, bestS3 = Number.POSITIVE_INFINITY

    for (let i = 0; i < laps.length; i++) {
      const lap = laps[i]
      if (isValidLap(lap)) validCnt++
      if (i > 0) {
        if ((lap as any).isPitOutLap) pitCnt++
        else { const pc = normCompound(laps[i - 1].tyreCompound), cc = normCompound(lap.tyreCompound); if (pc !== '—' && cc !== '—' && pc !== cc) pitCnt++ }
      }
      if ((lap.lapTime ?? 0) > 0 && isValidLap(lap)) bestLap = bestLap == null ? lap.lapTime as number : Math.min(bestLap, lap.lapTime as number)
      elapsed += lapDur(lap)
      if ((lap.sector1 ?? 0) > 0) bestS1 = Math.min(bestS1, lap.sector1 as number)
      if ((lap.sector2 ?? 0) > 0) bestS2 = Math.min(bestS2, lap.sector2 as number)
      if ((lap.sector3 ?? 0) > 0) bestS3 = Math.min(bestS3, lap.sector3 as number)

      pValid[i] = validCnt; pPit[i] = pitCnt; pElapsed[i] = elapsed; pBestLap[i] = bestLap
      pBestS1[i] = bestS1; pBestS2[i] = bestS2; pBestS3[i] = bestS3
    }

    return { driver, laps, prefixValidCount: pValid, prefixPitCount: pPit, prefixElapsedTime: pElapsed, prefixBestLap: pBestLap, prefixBestS1: pBestS1, prefixBestS2: pBestS2, prefixBestS3: pBestS3 }
  })

  const allByEnd = allLaps.slice().sort((a, b) => a.lapEndSeconds - b.lapEndSeconds)
  const sbS1 = new Array(allByEnd.length), sbS2 = new Array(allByEnd.length), sbS3 = new Array(allByEnd.length)
  let sb1 = Number.POSITIVE_INFINITY, sb2 = Number.POSITIVE_INFINITY, sb3 = Number.POSITIVE_INFINITY

  for (let i = 0; i < allByEnd.length; i++) {
    const lap = allByEnd[i]
    if ((lap.sector1 ?? 0) > 0) sb1 = Math.min(sb1, lap.sector1 as number)
    if ((lap.sector2 ?? 0) > 0) sb2 = Math.min(sb2, lap.sector2 as number)
    if ((lap.sector3 ?? 0) > 0) sb3 = Math.min(sb3, lap.sector3 as number)
    sbS1[i] = sb1; sbS2[i] = sb2; sbS3[i] = sb3
  }

  const lapsLookup = new Map<number, LapRow[]>(), elapsedLookup = new Map<number, number[]>()
  for (const b of bundles) { lapsLookup.set(b.driver.driverNumber, b.laps); elapsedLookup.set(b.driver.driverNumber, b.prefixElapsedTime) }

  return { allLapsByEnd: allByEnd, sessionBestS1ByEnd: sbS1, sessionBestS2ByEnd: sbS2, sessionBestS3ByEnd: sbS3, driverBundles: bundles, lapsByDriverNumber: lapsLookup, elapsedByDriverNumber: elapsedLookup, leaderMaxLap: Math.max(0, ...allLaps.map(l => l.lapNumber ?? 0)) }
}

export const useTimingData = (): UseTimingDataResult => {
  const sessionData = useSessionStore(s => s.sessionData)
  const lapsFromStore = useSessionStore(s => s.laps)
  const loadingState = useSessionStore(s => s.loadingState)
  const sessionError = useSessionStore(s => s.error)
  const sessionTime = useSessionTime30()
  const carPositions = useCarPositions()
  const roundedSessionTime = Math.round(sessionTime * 30) / 30

  const index = useMemo(() => {
    if (!sessionData?.drivers?.length) return null
    const allLaps = lapsFromStore.length ? lapsFromStore : sessionData.laps
    if (!allLaps.length) return null
    return buildIndex(sessionData.drivers, allLaps)
  }, [sessionData?.drivers, sessionData?.laps, lapsFromStore])

  const carPosByNum = useMemo(() => {
    const m = new Map<number, { progress: number; currentLap: number; isInPit: boolean }>()
    for (const car of carPositions) m.set(car.driverNumber, { progress: car.progress, currentLap: car.currentLap, isInPit: car.isInPit })
    return m
  }, [carPositions])

  const rows = useMemo(() => {
    if (!sessionData?.drivers?.length || !index) return []

    const lastEndByDriver = new Map<number, number | null>()
    const completedByDriver = new Map<number, number>()
    const t = roundedSessionTime
    const completedExclusive = ubLaps(index.allLapsByEnd, t)
    const compIdx = completedExclusive - 1
    const sessionBestS1 = compIdx >= 0 ? index.sessionBestS1ByEnd[compIdx] : Number.POSITIVE_INFINITY
    const sessionBestS2 = compIdx >= 0 ? index.sessionBestS2ByEnd[compIdx] : Number.POSITIVE_INFINITY
    const sessionBestS3 = compIdx >= 0 ? index.sessionBestS3ByEnd[compIdx] : Number.POSITIVE_INFINITY

    const rows: TimingRow[] = index.driverBundles.map(({ driver, laps, prefixValidCount, prefixPitCount, prefixBestLap, prefixBestS1, prefixBestS2, prefixBestS3 }) => {
      if (!laps.length) {
        lastEndByDriver.set(driver.driverNumber, null)
        completedByDriver.set(driver.driverNumber, 0)
        return { position: 99, driverCode: driver.code || '???', driverName: driver.driverName || '', driverNumber: driver.driverNumber, teamColor: driver.teamColor || '#666666', teamName: driver.teamName || 'Unknown', driverImage: driver.driverImage ?? null, teamImage: driver.teamImage ?? null, gap: '—', interval: '—', lastLap: '—', bestLap: '—', bestLapTime: null, tyreCompound: '—', pits: 0, sector1: null, sector2: null, sector3: null, s1Color: 'white', s2Color: 'white', s3Color: 'white', status: 'dns', currentLap: 0, currentSector: 1, lapsCompleted: 0, lapProgress: 0, lapDistance: 0, lapTimeRef: 90 }
      }

      const lastLapEnd = laps[laps.length - 1].lapEndSeconds
      const completedCount = ubLaps(laps, t)
      const lastCompleted = completedCount > 0 ? laps[completedCount - 1] : null
      const currentInProgress = currentLap(laps, t)
      const currLapData = currentInProgress || lastCompleted || laps[0]
      lastEndByDriver.set(driver.driverNumber, lastCompleted?.lapEndSeconds ?? null)
      completedByDriver.set(driver.driverNumber, lastCompleted?.lapNumber ?? Math.max(0, (currLapData?.lapNumber ?? 1) - 1))

      const lapStart = currLapData.lapStartSeconds, lapEnd = currLapData.lapEndSeconds
      const lapTimeRef = currLapData.lapTime || lastCompleted?.lapTime || 90
      const rawDur = Math.max(0, lapEnd - lapStart)
      const lapDur2 = rawDur > 1 ? rawDur : Math.max(1, lapTimeRef)
      const lapProgress = Math.max(0, Math.min(1, (t - lapStart) / lapDur2))

      let s1: number | null = null, s2: number | null = null, s3: number | null = null
      if (currentInProgress) {
        const s1t = currentInProgress.sector1, s2t = currentInProgress.sector2
        const s1f = (s1t && s1t > 0 && lapDur2 > 0) ? s1t / lapDur2 : 0.33
        const s2f = s1f + ((s2t && s2t > 0 && lapDur2 > 0) ? s2t / lapDur2 : 0.33)
        if (lapProgress > s1f) s1 = currentInProgress.sector1
        if (lapProgress > s2f) s2 = currentInProgress.sector2
      }

      if (lastCompleted) {
        const since = t - lastCompleted.lapEndSeconds
        if (since >= 0 && since < 5) { s1 = lastCompleted.sector1; s2 = lastCompleted.sector2; s3 = lastCompleted.sector3 }
        else if (since >= 5 && since < 8 && !s1) s3 = lastCompleted.sector3
      }

      let currentSector: 1 | 2 | 3 = 1
      if (lapProgress > 0.33 && lapProgress <= 0.66) currentSector = 2
      if (lapProgress > 0.66) currentSector = 3

      const cIdx = completedCount - 1
      const bestLapTime = cIdx >= 0 ? prefixBestLap[cIdx] : null
      const pBestS1 = cIdx >= 0 ? prefixBestS1[cIdx] : Number.POSITIVE_INFINITY
      const pBestS2 = cIdx >= 0 ? prefixBestS2[cIdx] : Number.POSITIVE_INFINITY
      const pBestS3 = cIdx >= 0 ? prefixBestS3[cIdx] : Number.POSITIVE_INFINITY
      const pitCount = cIdx >= 0 ? prefixPitCount[cIdx] : 0
      let lapDist = Math.max(Math.max(0, currLapData.lapNumber - 1), completedCount) + lapProgress
      const carPos = carPosByNum.get(driver.driverNumber)
      let derivedLap = currLapData.lapNumber

      if (!currentInProgress && lastCompleted && t > lastCompleted.lapEndSeconds) derivedLap = lastCompleted.lapNumber + 1
      if (carPos && Number.isFinite(carPos.currentLap) && carPos.currentLap > 0) derivedLap = carPos.currentLap
      if (carPos) {
        const carLap = derivedLap
        const carDist = Math.max(0, carLap - 1) + Math.max(0, Math.min(1, carPos.progress))
        if (Number.isFinite(carDist)) lapDist = carDist
      }

      let compound = '—'
      if (currentInProgress?.tyreCompound) compound = normCompound(currentInProgress.tyreCompound)
      else if (lastCompleted?. tyreCompound) compound = normCompound(lastCompleted. tyreCompound)
      else if (laps[0]?. tyreCompound) compound = normCompound(laps[0]. tyreCompound)

      let status: TimingRow['status'] = 'racing'
      const dnsThresh = (index.leaderMaxLap ?? 0) <= 1 ? 120 : 8
      if (completedCount === 0 && !currentInProgress && laps[0] && t > laps[0].lapStartSeconds + dnsThresh) status = 'dns'
      else if (completedCount > 0 && !currentInProgress) {
        const stallThresh = Math.max(30, lapDur(lastCompleted ?? currLapData) * 0.5)
        if (t - lastLapEnd > stallThresh) status = 'dnf'
      } else if (lapDur2 > 120 && lapProgress > 0.8) status = 'pit'

      if (carPos?.isInPit && status === 'racing') status = 'pit'
      if (status === 'dnf' || status === 'dns') lapDist = -1

      return {
        position: currLapData.position || 99,
        driverCode: driver.code || currLapData.driverName || '???',
        driverName: driver.driverName || '',
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#666666',
        teamName: driver.teamName || 'Unknown',
        driverImage: driver.driverImage ?? null,
        teamImage: driver.teamImage ?? null,
        gap: '—', interval: '—',
        lastLap: fmtLap(lastCompleted?.lapTime),
        bestLap: fmtLap(bestLapTime),
        bestLapTime,
        tyreCompound: compound,
        pits: pitCount,
        sector1: s1, sector2: s2, sector3: s3,
        s1Color: getSectorColor(s1, sessionBestS1, pBestS1),
        s2Color: getSectorColor(s2, sessionBestS2, pBestS2),
        s3Color: getSectorColor(s3, sessionBestS3, pBestS3),
        status,
        currentLap: derivedLap,
        currentSector,
        lapsCompleted: completedCount,
        lapProgress,
        lapDistance: lapDist,
        lapTimeRef
      }
    })

    rows.sort((a, b) => {
      const aR = a.status === 'dnf' || a.status === 'dns' || a.status === 'out'
      const bR = b.status === 'dnf' || b.status === 'dns' || b.status === 'out'
      if (a.status === 'dns' && b.status !== 'dns') return 1
      if (b.status === 'dns' && a.status !== 'dns') return -1
      if (aR && !bR) return 1
      if (bR && !aR) return -1
      if (aR && bR) return b.lapsCompleted - a.lapsCompleted || a.driverNumber - b.driverNumber
      if (Math.abs(a.lapDistance - b.lapDistance) > 1e-6) return b.lapDistance - a.lapDistance
      return a.driverNumber - b.driverNumber
    })

    for (let i = 0; i < rows.length; i++) rows[i].position = i + 1

    if (rows.length && (rows[0].status === 'racing' || rows[0].status === 'pit')) {
      const leaderDist = rows[0].lapDistance
      rows[0].gap = 'LEADER'; rows[0].interval = '—'

      const lapSec = (row: TimingRow) => {
        const laps = index.lapsByDriverNumber.get(row.driverNumber) ?? []
        if (!laps.length) return Number.NaN
        const cIdx = Math.min(laps.length - 1, Math.max(0, row.currentLap - 2))
        const latest = laps[cIdx]
        if (latest && isValidLap(latest) && latest.lapTime && latest.lapTime > 0) return latest.lapTime
        const validLaps = laps.filter(l => isValidLap(l) && l.lapTime && l.lapTime > 0)
        if (validLaps.length) return validLaps.reduce((a, b) => a + (b.lapTime ?? 0), 0) / validLaps.length
        const dur = lapDur(laps[Math.max(0, Math.min(laps.length - 1, row.currentLap - 1))])
        return Number.isFinite(dur) && dur > 0 ? dur : Math.max(1, row.lapTimeRef)
      }

      const leaderLapSec = lapSec(rows[0])

      for (let i = 1; i < rows.length; i++) {
        if (rows[i].status === 'dns') { rows[i].gap = 'DNS'; rows[i].interval = '—'; continue }
        if (rows[i].status === 'dnf' || rows[i].status === 'out') { rows[i].gap = 'DNF'; rows[i].interval = '—'; continue }

        const drvDist = rows[i].lapDistance
        const aheadDist = rows[i - 1].lapDistance
        const drvComp = completedByDriver.get(rows[i].driverNumber) ?? Math.max(0, rows[i].currentLap - 1)
        const aheadComp = completedByDriver.get(rows[i - 1].driverNumber) ?? Math.max(0, rows[i - 1].currentLap - 1)
        const aheadLapSec = lapSec(rows[i - 1])
        const drvEnd = lastEndByDriver.get(rows[i].driverNumber) ?? null

        const toLeader = leaderDist - drvDist
        const toAhead = aheadDist - drvDist
        const lapDiffLeader = (completedByDriver.get(rows[0].driverNumber) ?? Math.max(0, rows[0].currentLap - 1)) - drvComp
        const lapDiffAhead = aheadComp - drvComp
        const lappedLeader = lapDiffLeader >= 1 && toLeader >= 0.75
        const lappedAhead = lapDiffAhead >= 1 && toAhead >= 0.75

        if (lappedLeader) rows[i].gap = `+${lapDiffLeader}L`
        else {
          let gapTime = Number.NaN
          const lEnd = lastEndByDriver.get(rows[0].driverNumber) ?? null
          if (lEnd != null && drvEnd != null && drvComp === (completedByDriver.get(rows[0].driverNumber) ?? Math.max(0, rows[0].currentLap - 1))) {
            const crossGap = drvEnd - lEnd
            const progDelta = (rows[0].lapProgress - rows[i].lapProgress) * leaderLapSec
            if (crossGap >= 0 && Number.isFinite(progDelta)) gapTime = crossGap + progDelta
            else if (crossGap >= 0) gapTime = crossGap
          }
          if (!Number.isFinite(gapTime) || gapTime < 0) {
            if (Number.isFinite(leaderLapSec) && leaderLapSec > 0 && toLeader >= 0) gapTime = toLeader * leaderLapSec
          }
          rows[i].gap = Number.isFinite(gapTime) && gapTime >= 0 ? fmtDelta(gapTime) : '—'
        }

        if (lappedAhead) rows[i].interval = `+${lapDiffAhead}L`
        else {
          let intTime = Number.NaN
          const aEnd = lastEndByDriver.get(rows[i - 1].driverNumber) ?? null
          if (aEnd != null && drvEnd != null && drvComp === aheadComp) {
            const crossInt = drvEnd - aEnd
            const progDelta = (rows[i - 1].lapProgress - rows[i].lapProgress) * aheadLapSec
            if (crossInt >= 0 && Number.isFinite(progDelta)) intTime = crossInt + progDelta
            else if (crossInt >= 0) intTime = crossInt
          }
          if (!Number.isFinite(intTime) || intTime < 0) {
            if (Number.isFinite(aheadLapSec) && aheadLapSec > 0 && toAhead >= 0) intTime = toAhead * aheadLapSec
          }
          rows[i].interval = Number.isFinite(intTime) && intTime >= 0 ? fmtDelta(intTime) : '—'
        }
      }
    }

    return rows
  }, [index, roundedSessionTime, sessionData?.drivers, carPosByNum])

  const sessionBestLap = useMemo(() => {
    let min: number | null = null
    for (const row of rows) {
      if (row.bestLapTime == null) continue
      min = min == null ? row.bestLapTime : Math.min(min, row.bestLapTime)
    }
    return min
  }, [rows])

  return useMemo(() => {
    if (loadingState === 'error') return { rows, sessionBestLap, status: 'error', error: sessionError || 'Failed to load timing data' }
    if (loadingState === 'loading' && !rows.length) return { rows, sessionBestLap, status: 'loading', error: null }
    if (!rows.length) return { rows, sessionBestLap, status: 'empty', error: null }
    return { rows, sessionBestLap, status: 'ready', error: null }
  }, [loadingState, rows, sessionError, sessionBestLap])
}
