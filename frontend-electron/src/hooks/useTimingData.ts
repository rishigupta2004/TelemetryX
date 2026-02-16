import { useMemo } from 'react'
import { useSessionTime } from '../lib/timeUtils'
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
  lapTimeRef: number
}

interface ElapsedInfo {
  totalTime: number
  lapsCompleted: number
  lastLapEnd: number
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

function getSectorColor(
  value: number | null,
  sessionBest: number,
  personalBest: number
): SectorColor {
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

function minOrInfinity(values: number[]): number {
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY
}

function getElapsedAtPosition(
  allLaps: LapRow[],
  driverCode: string,
  driverNumber: number,
  sessionTime: number
): ElapsedInfo {
  const driverLaps = allLaps
    .filter((lap) => lap.driverName === driverCode || lap.driverNumber === driverNumber)
    .filter((lap) => lap.lapEndSeconds <= sessionTime)
    .sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)

  if (!driverLaps.length) return { totalTime: 0, lapsCompleted: 0, lastLapEnd: 0 }

  const totalTime = driverLaps.reduce((sum, lap) => sum + (lap.lapTime || 0), 0)
  const lapsCompleted = driverLaps.length
  const lastLapEnd = driverLaps[driverLaps.length - 1].lapEndSeconds

  const allDriverLaps = allLaps
    .filter((lap) => lap.driverName === driverCode || lap.driverNumber === driverNumber)
    .sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)
  const currentLap = allDriverLaps.find(
    (lap) => lap.lapStartSeconds <= sessionTime && sessionTime < lap.lapEndSeconds
  )

  const partialTime = currentLap ? Math.max(0, sessionTime - currentLap.lapStartSeconds) : 0
  return { totalTime: totalTime + partialTime, lapsCompleted, lastLapEnd }
}

export function useTimingData(): TimingRow[] {
  const sessionData = useSessionStore((s) => s.sessionData)
  const lapsFromStore = useSessionStore((s) => s.laps)
  const sessionTime = useSessionTime()
  const roundedSessionTime = Math.round(sessionTime)

  return useMemo(() => {
    if (!sessionData?.drivers?.length) return []

    const drivers = sessionData.drivers
    const allLaps = lapsFromStore.length ? lapsFromStore : sessionData.laps
    if (!allLaps.length) return []
    const sessionTime = roundedSessionTime

    const leaderMaxLap = Math.max(...allLaps.map((lap) => lap.lapNumber || 0))

    const completedLapsAll = allLaps.filter((lap) => lap.lapEndSeconds <= sessionTime)
    const allS1 = completedLapsAll.map((lap) => lap.sector1).filter((v): v is number => !!v && v > 0)
    const allS2 = completedLapsAll.map((lap) => lap.sector2).filter((v): v is number => !!v && v > 0)
    const allS3 = completedLapsAll.map((lap) => lap.sector3).filter((v): v is number => !!v && v > 0)
    const sessionBestS1 = allS1.length > 0 ? Math.min(...allS1) : Number.POSITIVE_INFINITY
    const sessionBestS2 = allS2.length > 0 ? Math.min(...allS2) : Number.POSITIVE_INFINITY
    const sessionBestS3 = allS3.length > 0 ? Math.min(...allS3) : Number.POSITIVE_INFINITY

    const rows: TimingRow[] = drivers.map((driver: Driver) => {
      const driverLaps = allLaps
        .filter((lap) => lap.driverName === driver.code || lap.driverNumber === driver.driverNumber)
        .sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)

      if (!driverLaps.length) {
        return {
          position: 99,
          driverCode: driver.code || '???',
          driverName: driver.driverName || '',
          driverNumber: driver.driverNumber,
          teamColor: driver.teamColor || '#666666',
          teamName: driver.teamName || 'Unknown',
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
          lapTimeRef: 90
        }
      }

      const firstLapStart = driverLaps[0].lapStartSeconds
      const lastLapEnd = driverLaps[driverLaps.length - 1].lapEndSeconds
      const completedLaps = driverLaps.filter((lap) => lap.lapEndSeconds <= sessionTime && isValidLap(lap))
      const completedDriverLaps = driverLaps.filter((lap) => lap.lapEndSeconds <= sessionTime)
      const lastCompletedLap = completedDriverLaps.length ? completedDriverLaps[completedDriverLaps.length - 1] : null
      const currentInProgressLap = driverLaps.find(
        (lap) => lap.lapStartSeconds <= sessionTime && sessionTime < lap.lapEndSeconds
      )
      const currentLapData = currentInProgressLap || lastCompletedLap || driverLaps[0]

      const lapStart = currentLapData.lapStartSeconds
      const lapEnd = currentLapData.lapEndSeconds
      const lapDuration = Math.max(1, lapEnd - lapStart)
      const lapProgress = lapDuration > 0 ? Math.max(0, Math.min(1, (sessionTime - lapStart) / lapDuration)) : 0

      let displayS1: number | null = null
      let displayS2: number | null = null
      let displayS3: number | null = null
      if (currentInProgressLap) {
        if (lapProgress > 0.33) displayS1 = currentInProgressLap.sector1
        if (lapProgress > 0.66) displayS2 = currentInProgressLap.sector2
      }

      if (lastCompletedLap) {
        const timeSinceCompletion = sessionTime - lastCompletedLap.lapEndSeconds
        if (timeSinceCompletion >= 0 && timeSinceCompletion < 5) {
          displayS1 = lastCompletedLap.sector1
          displayS2 = lastCompletedLap.sector2
          displayS3 = lastCompletedLap.sector3
        } else if (timeSinceCompletion >= 5 && timeSinceCompletion < 8) {
          if (!displayS1) displayS3 = lastCompletedLap.sector3
        }
      }

      let currentSector: 1 | 2 | 3 = 1
      if (lapProgress > 0.33 && lapProgress <= 0.66) currentSector = 2
      if (lapProgress > 0.66) currentSector = 3

      const validTimes = completedLaps.map((lap) => lap.lapTime || 0).filter((time) => time > 0)
      const bestLapTime = validTimes.length ? Math.min(...validTimes) : null
      const driverCompletedLaps = completedLapsAll.filter(
        (lap) => lap.driverName === driver.code || lap.driverNumber === driver.driverNumber
      )
      const personalBestS1 = minOrInfinity(
        driverCompletedLaps.filter((lap) => (lap.sector1 || 0) > 0).map((lap) => lap.sector1 as number)
      )
      const personalBestS2 = minOrInfinity(
        driverCompletedLaps.filter((lap) => (lap.sector2 || 0) > 0).map((lap) => lap.sector2 as number)
      )
      const personalBestS3 = minOrInfinity(
        driverCompletedLaps.filter((lap) => (lap.sector3 || 0) > 0).map((lap) => lap.sector3 as number)
      )

      let pitCount = 0
      const completedSorted = driverLaps
        .filter((lap) => lap.lapEndSeconds <= sessionTime)
        .sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)
      for (let i = 1; i < completedSorted.length; i++) {
        const prevComp = normalizeCompound(completedSorted[i - 1].tyreCompound)
        const curComp = normalizeCompound(completedSorted[i].tyreCompound)
        if (prevComp !== '—' && curComp !== '—' && prevComp !== curComp) pitCount++
      }

      let compound = '—'
      if (currentInProgressLap?.tyreCompound) compound = normalizeCompound(currentInProgressLap.tyreCompound)
      else if (lastCompletedLap?.tyreCompound) compound = normalizeCompound(lastCompletedLap.tyreCompound)
      else if (driverLaps[0]?.tyreCompound) compound = normalizeCompound(driverLaps[0].tyreCompound)

      let status: TimingRow['status'] = 'racing'
      if (sessionTime < firstLapStart - 10) status = 'dns'
      else if (sessionTime > lastLapEnd + 30 && currentLapData.lapNumber < leaderMaxLap - 2) status = 'dnf'
      else if (lapDuration > 120 && lapProgress > 0.8) status = 'pit'

      return {
        position: currentLapData.position || 99,
        driverCode: driver.code || currentLapData.driverName || '???',
        driverName: driver.driverName || '',
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#666666',
        teamName: driver.teamName || 'Unknown',
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
        lapsCompleted: completedLaps.length,
        lapProgress,
        lapTimeRef: currentLapData.lapTime || lastCompletedLap?.lapTime || 90
      }
    })

    rows.sort((a, b) => {
      if (a.status === 'dns' && b.status !== 'dns') return 1
      if (b.status === 'dns' && a.status !== 'dns') return -1
      if (a.status === 'dnf' && b.status !== 'dnf') return 1
      if (b.status === 'dnf' && a.status !== 'dnf') return -1
      return a.position - b.position
    })

    if (rows.length > 0 && (rows[0].status === 'racing' || rows[0].status === 'pit')) {
      const leaderElapsed = getElapsedAtPosition(allLaps, rows[0].driverCode, rows[0].driverNumber, sessionTime)
      const leaderDistance = rows[0].lapsCompleted + rows[0].lapProgress
      const leaderLapSec = rows[0].lapTimeRef || 90
      rows[0].gap = 'LEADER'
      rows[0].interval = '—'

      for (let i = 1; i < rows.length; i++) {
        if (rows[i].status !== 'racing' && rows[i].status !== 'pit') {
          rows[i].gap = '—'
          rows[i].interval = '—'
          continue
        }

        const driverElapsed = getElapsedAtPosition(allLaps, rows[i].driverCode, rows[i].driverNumber, sessionTime)
        const driverDistance = rows[i].lapsCompleted + rows[i].lapProgress
        const aheadDistance = rows[i - 1].lapsCompleted + rows[i - 1].lapProgress
        const gapToLeader = (leaderDistance - driverDistance) * leaderLapSec
        const interval = (aheadDistance - driverDistance) * leaderLapSec

        if (gapToLeader > 0.001) {
          rows[i].gap = `+${gapToLeader.toFixed(3)}`
        } else if (leaderElapsed.lapsCompleted > driverElapsed.lapsCompleted) {
          const lapDiff = leaderElapsed.lapsCompleted - driverElapsed.lapsCompleted
          rows[i].gap = `+${lapDiff} LAP${lapDiff > 1 ? 'S' : ''}`
        } else {
          rows[i].gap = '+0.000'
        }

        if (interval > 0.001) {
          rows[i].interval = `+${interval.toFixed(3)}`
        } else {
          rows[i].interval = '+0.000'
        }

      }
    }

    return rows
  }, [sessionData, lapsFromStore, roundedSessionTime])
}
