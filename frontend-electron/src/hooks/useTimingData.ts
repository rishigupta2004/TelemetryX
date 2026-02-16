import { useMemo } from 'react'
import type { Driver, LapRow } from '../types'

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
  sector1: number | null
  sector2: number | null
  sector3: number | null
  sector1Status: 'purple' | 'green' | 'yellow' | 'none'
  sector2Status: 'purple' | 'green' | 'yellow' | 'none'
  sector3Status: 'purple' | 'green' | 'yellow' | 'none'
  lapsCompleted: number
}

interface InternalRow {
  row: TimingRow
  lapsCompleted: number
  lastLapEndSeconds: number | null
  elapsedTime: number | null
  isDNF: boolean
  isDNS: boolean
}

const EPS = 1e-6

function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds - minutes * 60
  return `${minutes}:${remainder.toFixed(3).padStart(6, '0')}`
}

function formatRaceDelta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `+${seconds.toFixed(3)}`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds - minutes * 60
  return `+${minutes}:${remainder.toFixed(3).padStart(6, '0')}`
}

function formatLapDelta(lapsBehind: number): string {
  if (lapsBehind <= 0) return '—'
  return `+${lapsBehind} Lap${lapsBehind > 1 ? 's' : ''}`
}

function pickSectorStatus(
  value: number | null,
  sessionBest: number | null,
  personalBest: number | null
): 'purple' | 'green' | 'yellow' | 'none' {
  if (value == null || !Number.isFinite(value)) return 'none'
  if (sessionBest != null && Math.abs(value - sessionBest) < EPS) return 'purple'
  if (personalBest != null && Math.abs(value - personalBest) < EPS) return 'green'
  return 'yellow'
}

export function useTimingData(laps: LapRow[], drivers: Driver[], totalLaps?: number | null): TimingRow[] {
  return useMemo(() => {
    if (!drivers.length && !laps.length) return []

    const driversByNumber = new Map<number, Driver>()
    for (const driver of drivers) {
      driversByNumber.set(driver.driverNumber, driver)
    }

    const lapsByDriver = new Map<number, LapRow[]>()
    for (const lap of laps) {
      const driverNumber = lap.driverNumber
      if (driverNumber == null) continue
      if (!lapsByDriver.has(driverNumber)) lapsByDriver.set(driverNumber, [])
      lapsByDriver.get(driverNumber)!.push(lap)
    }

    const allDriverNumbers = new Set<number>()
    for (const key of driversByNumber.keys()) allDriverNumbers.add(key)
    for (const key of lapsByDriver.keys()) allDriverNumbers.add(key)

    const allCompletedLaps = laps.filter((lap) => lap.lapTime != null && lap.lapTime > 0)

    const sessionBestS1 = allCompletedLaps.reduce<number | null>((min, lap) => {
      if (lap.sector1 == null) return min
      return min == null ? lap.sector1 : Math.min(min, lap.sector1)
    }, null)
    const sessionBestS2 = allCompletedLaps.reduce<number | null>((min, lap) => {
      if (lap.sector2 == null) return min
      return min == null ? lap.sector2 : Math.min(min, lap.sector2)
    }, null)
    const sessionBestS3 = allCompletedLaps.reduce<number | null>((min, lap) => {
      if (lap.sector3 == null) return min
      return min == null ? lap.sector3 : Math.min(min, lap.sector3)
    }, null)

    const internalRows: InternalRow[] = Array.from(allDriverNumbers).map((driverNumber) => {
      const driverLaps = [...(lapsByDriver.get(driverNumber) ?? [])].sort((a, b) => {
        const lapDiff = (a.lapNumber ?? 0) - (b.lapNumber ?? 0)
        if (lapDiff !== 0) return lapDiff
        return (a.lapEndSeconds ?? 0) - (b.lapEndSeconds ?? 0)
      })

      const completedLaps = driverLaps.filter((lap) => lap.lapTime != null && lap.lapTime > 0)
      const lastCompletedLap = completedLaps[completedLaps.length - 1] ?? null
      const lastKnownLap = driverLaps[driverLaps.length - 1] ?? null

      const lapsCompleted = lastCompletedLap?.lapNumber ?? 0
      const bestLapTime = completedLaps.reduce<number | null>((min, lap) => {
        if (lap.lapTime == null || lap.lapTime <= 0) return min
        return min == null ? lap.lapTime : Math.min(min, lap.lapTime)
      }, null)

      const personalBestS1 = completedLaps.reduce<number | null>((min, lap) => {
        if (lap.sector1 == null) return min
        return min == null ? lap.sector1 : Math.min(min, lap.sector1)
      }, null)
      const personalBestS2 = completedLaps.reduce<number | null>((min, lap) => {
        if (lap.sector2 == null) return min
        return min == null ? lap.sector2 : Math.min(min, lap.sector2)
      }, null)
      const personalBestS3 = completedLaps.reduce<number | null>((min, lap) => {
        if (lap.sector3 == null) return min
        return min == null ? lap.sector3 : Math.min(min, lap.sector3)
      }, null)

      const driverInfo = driversByNumber.get(driverNumber)
      const displayName = lastCompletedLap?.driverName ?? driverInfo?.driverName ?? String(driverNumber)

      const lastLapEndSeconds =
        lastCompletedLap?.lapEndSeconds != null && Number.isFinite(lastCompletedLap.lapEndSeconds)
          ? lastCompletedLap.lapEndSeconds
          : null
      const sumLapTime = completedLaps.reduce((acc, lap) => acc + (lap.lapTime ?? 0), 0)
      const elapsedTime = lastLapEndSeconds ?? (sumLapTime > 0 ? sumLapTime : null)

      const row: TimingRow = {
        position: 0,
        driverCode: driverInfo?.code ?? String(driverNumber),
        driverName: displayName,
        driverNumber,
        teamColor: driverInfo?.teamColor ?? '#666666',
        teamName: driverInfo?.teamName ?? 'Unknown',
        gap: lapsCompleted > 0 ? '—' : 'DNF',
        interval: '—',
        lastLap: lastCompletedLap?.lapTimeFormatted ?? formatLapTime(lastCompletedLap?.lapTime),
        bestLap: bestLapTime == null ? '—' : formatLapTime(bestLapTime),
        bestLapTime,
        tyreCompound: lastCompletedLap?.tyreCompound ?? lastKnownLap?.tyreCompound ?? '—',
        sector1: lastCompletedLap?.sector1 ?? null,
        sector2: lastCompletedLap?.sector2 ?? null,
        sector3: lastCompletedLap?.sector3 ?? null,
        sector1Status: pickSectorStatus(lastCompletedLap?.sector1 ?? null, sessionBestS1, personalBestS1),
        sector2Status: pickSectorStatus(lastCompletedLap?.sector2 ?? null, sessionBestS2, personalBestS2),
        sector3Status: pickSectorStatus(lastCompletedLap?.sector3 ?? null, sessionBestS3, personalBestS3),
        lapsCompleted
      }

      return { row, lapsCompleted, lastLapEndSeconds, elapsedTime, isDNF: false, isDNS: false }
    })

    const leader = internalRows.find((entry) => entry.lapsCompleted > 0) ?? null
    const leaderLaps = leader?.lapsCompleted ?? 0
    const hasTotalLaps = totalLaps != null && Number.isFinite(totalLaps) && totalLaps > 0

    // FIA-style not-classified approximation with available lap data:
    // 1) DNS: 0 completed laps
    // 2) DNF: <90% distance or retired 3+ laps down before total laps.
    for (const entry of internalRows) {
      if (entry.lapsCompleted === 0) {
        entry.isDNS = true
        entry.isDNF = true
        continue
      }
      const lapsBehindLeader = Math.max(0, leaderLaps - entry.lapsCompleted)
      const belowNinetyPercent = hasTotalLaps ? entry.lapsCompleted < (totalLaps as number) * 0.9 : false
      const retiredThreePlusBehind =
        hasTotalLaps && entry.lapsCompleted < (totalLaps as number) && lapsBehindLeader >= 3
      entry.isDNF = belowNinetyPercent || retiredThreePlusBehind
    }

    // Final race classification sorting:
    // classified first, then DNF/DNS by laps completed.
    internalRows.sort((a, b) => {
      if (a.isDNF !== b.isDNF) return a.isDNF ? 1 : -1
      if (a.lapsCompleted !== b.lapsCompleted) return b.lapsCompleted - a.lapsCompleted
      if (a.lapsCompleted === 0 && b.lapsCompleted === 0) return a.row.driverNumber - b.row.driverNumber

      const aEnd = a.lastLapEndSeconds ?? Number.MAX_SAFE_INTEGER
      const bEnd = b.lastLapEndSeconds ?? Number.MAX_SAFE_INTEGER
      if (aEnd !== bEnd) return aEnd - bEnd

      const aBest = a.row.bestLapTime ?? Number.MAX_SAFE_INTEGER
      const bBest = b.row.bestLapTime ?? Number.MAX_SAFE_INTEGER
      if (aBest !== bBest) return aBest - bBest

      return a.row.driverNumber - b.row.driverNumber
    })

    const classifiedLeader = internalRows.find((entry) => !entry.isDNF && entry.lapsCompleted > 0) ?? null

    return internalRows.map((entry, idx) => {
      const row = entry.row
      row.position = idx + 1

      if (!classifiedLeader || entry.isDNF) {
        row.gap = entry.isDNS ? 'DNS' : 'DNF'
        row.interval = '—'
        if (entry.isDNS) {
          row.lastLap = '—'
          row.bestLap = '—'
          row.sector1 = null
          row.sector2 = null
          row.sector3 = null
          row.sector1Status = 'none'
          row.sector2Status = 'none'
          row.sector3Status = 'none'
        }
        return row
      }

      if (entry.row.driverNumber === classifiedLeader.row.driverNumber) {
        row.gap = 'LEADER'
        row.interval = '—'
      } else {
        const lapsBehindLeader = classifiedLeader.lapsCompleted - entry.lapsCompleted
        if (lapsBehindLeader > 0) {
          row.gap = formatLapDelta(lapsBehindLeader)
        } else {
          row.gap = formatRaceDelta(
            entry.elapsedTime != null && classifiedLeader.elapsedTime != null
              ? entry.elapsedTime - classifiedLeader.elapsedTime
              : null
          )
        }

        const ahead = internalRows[idx - 1]
        if (!ahead || ahead.lapsCompleted === 0) {
          row.interval = '—'
        } else {
          const lapsBehindAhead = ahead.lapsCompleted - entry.lapsCompleted
          if (lapsBehindAhead > 0) {
            row.interval = formatLapDelta(lapsBehindAhead)
          } else {
            row.interval = formatRaceDelta(
              entry.elapsedTime != null && ahead.elapsedTime != null ? entry.elapsedTime - ahead.elapsedTime : null
            )
          }
        }
      }

      return row
    })
  }, [laps, drivers, totalLaps])
}
