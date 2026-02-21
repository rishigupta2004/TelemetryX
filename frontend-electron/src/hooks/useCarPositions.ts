import { useMemo, useRef } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { Driver, LapRow, PositionRow } from '../types'

export interface CarPosition { driverCode: string; driverNumber: number; teamColor: string; progress: number; currentLap: number; position: number; x: number | null; y: number | null; hasLivePosition: boolean }
type DriverIndex = { driver: Driver; laps: LapRow[]; lapStarts: number[]; positions: PositionRow[]; posTimes: number[]; firstStart: number; lastEnd: number; driverMaxLap: number; raceMaxLap: number }
const ub = (arr: number[], v: number) => { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= v) lo = mid + 1; else hi = mid } return lo }

export function useCarPositions(): CarPosition[] {
  const sessionData = useSessionStore((s) => s.sessionData)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const sessionTime = sessionStartTime + currentTime
  const prevTimeRef = useRef<number | null>(null)
  const lapHintRef = useRef(new Map<number, number>())
  const posHintRef = useRef(new Map<number, number>())

  const indexed = useMemo(() => {
    if (!sessionData?.drivers?.length || !sessionData?.laps?.length) return [] as DriverIndex[]
    const posByNum = new Map<number, PositionRow[]>(), lapsByNum = new Map<number, LapRow[]>(), lapsByCode = new Map<string, LapRow[]>()
    for (const row of sessionData.positions ?? []) {
      if (!Number.isFinite(row?.driverNumber) || !Number.isFinite(row?.timestamp) || !Number.isFinite(row?.x) || !Number.isFinite(row?.y)) continue
      ;(posByNum.get(row.driverNumber) ?? (posByNum.set(row.driverNumber, []), posByNum.get(row.driverNumber)!)).push(row)
    }
    for (const rows of posByNum.values()) rows.sort((a, b) => a.timestamp - b.timestamp)
    for (const lap of sessionData.laps) {
      ;(lapsByNum.get(lap.driverNumber) ?? (lapsByNum.set(lap.driverNumber, []), lapsByNum.get(lap.driverNumber)!)).push(lap)
      ;(lapsByCode.get(lap.driverName) ?? (lapsByCode.set(lap.driverName, []), lapsByCode.get(lap.driverName)!)).push(lap)
    }
    for (const laps of [...lapsByNum.values(), ...lapsByCode.values()]) laps.sort((a, b) => a.lapStartSeconds - b.lapStartSeconds || a.lapNumber - b.lapNumber)
    const raceMaxLap = Math.max(...sessionData.laps.map((l) => l.lapNumber))
    return sessionData.drivers.map((driver) => {
      const laps = lapsByNum.get(driver.driverNumber) ?? lapsByCode.get(driver.code) ?? []
      const positions = posByNum.get(driver.driverNumber) ?? []
      return { driver, laps, lapStarts: laps.map((l) => l.lapStartSeconds), positions, posTimes: positions.map((p) => p.timestamp), firstStart: laps[0]?.lapStartSeconds ?? 0, lastEnd: laps[laps.length - 1]?.lapEndSeconds ?? 0, driverMaxLap: laps[laps.length - 1]?.lapNumber ?? 0, raceMaxLap }
    })
  }, [sessionData?.drivers, sessionData?.laps, sessionData?.positions])

  return useMemo(() => {
    if (!indexed.length) return []
    const rewound = prevTimeRef.current != null && sessionTime < prevTimeRef.current
    if (rewound) { lapHintRef.current.clear(); posHintRef.current.clear() }
    prevTimeRef.current = sessionTime
    const out: CarPosition[] = []

    for (const { driver, laps, lapStarts, positions, posTimes, firstStart, lastEnd, driverMaxLap, raceMaxLap } of indexed) {
      if (!laps.length || sessionTime < firstStart - 20 || (sessionTime > lastEnd + 30 && driverMaxLap < raceMaxLap - 1)) continue
      let li = lapHintRef.current.get(driver.driverNumber) ?? 0
      li = rewound ? Math.max(0, ub(lapStarts, sessionTime) - 1) : Math.max(0, Math.min(li, laps.length - 1))
      while (!rewound && li + 1 < laps.length && lapStarts[li + 1] <= sessionTime) li += 1
      while (li > 0 && lapStarts[li] > sessionTime) li -= 1
      lapHintRef.current.set(driver.driverNumber, li)
      const lap = laps[li], d = lap.lapEndSeconds - lap.lapStartSeconds
      const progress = sessionTime <= lap.lapEndSeconds ? Math.max(0, Math.min(0.999, d > 0 ? (sessionTime - lap.lapStartSeconds) / d : 0)) : 0.999

      let x: number | null = null, y: number | null = null
      if (positions.length) {
        let pi = posHintRef.current.get(driver.driverNumber) ?? 0
        pi = rewound ? ub(posTimes, sessionTime) : Math.max(0, Math.min(pi, positions.length))
        while (!rewound && pi < positions.length && posTimes[pi] <= sessionTime) pi += 1
        while (pi > 0 && posTimes[pi - 1] > sessionTime) pi -= 1
        posHintRef.current.set(driver.driverNumber, pi)
        if (pi <= 0) { x = positions[0].x; y = positions[0].y }
        else if (pi >= positions.length) { const tail = positions[positions.length - 1]; x = tail.x; y = tail.y }
        else { const a = positions[pi - 1], b = positions[pi], dt = b.timestamp - a.timestamp, t = !Number.isFinite(dt) || dt <= 1e-6 ? 0 : Math.max(0, Math.min(1, (sessionTime - a.timestamp) / dt)); x = a.x + (b.x - a.x) * t; y = a.y + (b.y - a.y) * t }
      }
      out.push({ driverCode: driver.code, driverNumber: driver.driverNumber, teamColor: driver.teamColor || '#fff', progress, currentLap: lap.lapNumber, position: lap.position || 99, x, y, hasLivePosition: x != null && y != null })
    }
    return out
  }, [indexed, sessionTime])
}
