import { useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import { useDriverStore } from '../stores/driverStore'
import {
  lbTs,
  ubTs,
  lapAtTime,
  CHANNELS,
  metricSubtitle,
} from '../lib/telemetryUtils'
import type {
  BuiltChart,
  ChannelKey,
  MetricKey,
  MetricPair,
  Windowed,
} from '../lib/telemetryUtils'
import type { LapRow, TelemetryRow } from '../types'
import { ubNum } from '../lib/telemetryUtils'

const MAX_TELEMETRY_POINTS = 3000
const HALF_WINDOW = 60
const WINDOW_BUCKET_SECONDS = 15

export interface LapTimeWindow {
  lap: LapRow
  t0: number
  t1: number
  duration: number
}

export interface UseTelemetryDataResult {
  windowedTelemetry: Windowed | null
  liveTelemetry: { primary: Partial<TelemetryRow>; compare: Partial<TelemetryRow> } | null
  fetchWindow: { t0: number; t1: number } | null
  lapTimeWindow: LapTimeWindow | null
  lapsByDriver: Map<string, LapRow[]>
  driverLaps: LapRow[]
  lapNumbers: number[]
  activeLapNumber: number | null
  effectiveLapNumber: number | null
  telemetryWindowStart: number
  telemetryWindowEnd: number
}

export function useTelemetryData(
  sampledSessionTime: number,
  selectedLap: number,
  selectedDriver: string | null,
  compareDriver: string | null
): UseTelemetryDataResult {
  const sessionData = useSessionStore((s) => s.sessionData)
  const fullLaps = useSessionStore((s) => s.laps)
  const telemetryData = useTelemetryStore((s) => s.telemetryData)
  const telemetryWindowStart = useTelemetryStore((s) => s.windowStart)
  const telemetryWindowEnd = useTelemetryStore((s) => s.windowEnd)

  const drivers = sessionData?.drivers || []
  const laps = fullLaps.length ? fullLaps : sessionData?.laps || []

  const telemetryByCode = useMemo(() => {
    const byCode = new Map<string, TelemetryRow[]>()
    if (!telemetryData || !drivers.length) return byCode

    const rowsByKey = telemetryData as Record<string, TelemetryRow[] | undefined>
    const rowsEntries = Object.entries(rowsByKey).map(([key, rows]) => [key, rows ?? []] as const)

    const lookup = (key: string): TelemetryRow[] | null => {
      const exact = rowsByKey[key]
      if (Array.isArray(exact) && exact.length) return exact
      const upper = rowsByKey[key.toUpperCase()]
      if (Array.isArray(upper) && upper.length) return upper
      const lower = rowsByKey[key.toLowerCase()]
      if (Array.isArray(lower) && lower.length) return lower
      return null
    }

    for (const driver of drivers) {
      const candidates = [
        driver.code,
        driver.code.toUpperCase(),
        String(driver.driverNumber),
        String(driver.driverName || ''),
        String(driver.driverName || '').toUpperCase(),
      ].filter(Boolean)

      let resolved: TelemetryRow[] | null = null
      for (const candidate of candidates) {
        const rows = lookup(candidate)
        if (rows && rows.length) {
          resolved = rows
          break
        }
      }

      if (!resolved) {
        for (const [, rows] of rowsEntries) {
          if (!rows.length) continue
          const first = rows[0]
          const rowNumber = Number(first.driverNumber)
          const rowName = String(first.driverName || '').toUpperCase()
          if (
            (Number.isFinite(rowNumber) && rowNumber === driver.driverNumber) ||
            rowName === driver.code.toUpperCase() ||
            rowName === String(driver.driverName || '').toUpperCase()
          ) {
            resolved = rows
            break
          }
        }
      }

      if (resolved) byCode.set(driver.code, resolved)
    }

    return byCode
  }, [telemetryData, drivers])

  const lapsByDriver = useMemo(() => {
    const byNum = new Map<number, LapRow[]>()
    const byCode = new Map<string, LapRow[]>()
    for (const lap of laps) {
      ;(byNum.get(lap.driverNumber) ?? (byNum.set(lap.driverNumber, []), byNum.get(lap.driverNumber)!)).push(lap)
      if (lap.driverName)
        (byCode.get(lap.driverName) ?? (byCode.set(lap.driverName, []), byCode.get(lap.driverName)!)).push(lap)
    }
    const map = new Map<string, LapRow[]>()
    for (const d of drivers) {
      const rows = (byNum.get(d.driverNumber) ?? byCode.get(d.code) ?? []).slice()
      rows.sort((a, b) => a.lapNumber - b.lapNumber || a.lapStartSeconds - b.lapStartSeconds)
      map.set(d.code, rows)
    }
    return map
  }, [drivers, laps])

  const driverLaps = useMemo(
    () => (selectedDriver ? lapsByDriver.get(selectedDriver) ?? [] : []),
    [selectedDriver, lapsByDriver]
  )
  const lapNumbers = useMemo(() => driverLaps.map((lap) => lap.lapNumber), [driverLaps])

  const activeLapNumber = useMemo(() => {
    if (!driverLaps.length) return null
    const active = lapAtTime(driverLaps, sampledSessionTime)
    if (active) return active.lapNumber
    for (let i = driverLaps.length - 1; i >= 0; i -= 1) {
      if (driverLaps[i].lapEndSeconds <= sampledSessionTime) return driverLaps[i].lapNumber
    }
    return driverLaps[0].lapNumber
  }, [driverLaps, sampledSessionTime])

  const lapTimeWindow = useMemo((): LapTimeWindow | null => {
    if (!selectedDriver) return null
    const telemetryRows = telemetryByCode.get(selectedDriver) ?? []
    const hasDataForLap = (lap: LapRow): boolean => {
      if (!telemetryRows.length) return true
      const lo = lbTs(telemetryRows, lap.lapStartSeconds)
      const hi = ubTs(telemetryRows, lap.lapEndSeconds)
      return hi - lo > 4
    }
    let lap = driverLaps.find((l) => l.lapNumber === selectedLap) || null
    if (lap && hasDataForLap(lap)) {
      return {
        lap,
        t0: Math.floor(lap.lapStartSeconds),
        t1: Math.ceil(lap.lapEndSeconds),
        duration: lap.lapTime || lap.lapEndSeconds - lap.lapStartSeconds,
      }
    }
    const candidates = driverLaps.filter(hasDataForLap)
    if (!candidates.length) return lap ? {
      lap,
      t0: Math.floor(lap.lapStartSeconds),
      t1: Math.ceil(lap.lapEndSeconds),
      duration: lap.lapTime || lap.lapEndSeconds - lap.lapStartSeconds,
    } : null
    if (!lap) lap = candidates[0]
    const nearest = candidates.reduce((best, item) =>
      Math.abs(item.lapNumber - lap.lapNumber) < Math.abs(best.lapNumber - lap.lapNumber) ? item : best
    )
    return lap
      ? {
          lap: nearest,
          t0: Math.floor(nearest.lapStartSeconds),
          t1: Math.ceil(nearest.lapEndSeconds),
          duration: nearest.lapTime || nearest.lapEndSeconds - nearest.lapStartSeconds,
        }
      : null
  }, [driverLaps, selectedLap, selectedDriver, telemetryByCode])

  const fetchWindow = useMemo(() => {
    if (!driverLaps.length) return null
    if (lapTimeWindow) {
      return { t0: lapTimeWindow.t0, t1: lapTimeWindow.t1 }
    }
    const bucketCenter = Math.floor(sampledSessionTime / WINDOW_BUCKET_SECONDS) * WINDOW_BUCKET_SECONDS
    const t0 = Math.max(0, Math.floor(bucketCenter - HALF_WINDOW))
    const t1 = Math.ceil(bucketCenter + HALF_WINDOW)
    return { t0, t1 }
  }, [driverLaps, sampledSessionTime, lapTimeWindow])

  const windowedTelemetry = useMemo((): Windowed | null => {
    if (!selectedDriver || !lapTimeWindow) return null
    const primary = telemetryByCode.get(selectedDriver) ?? []
    const compare = compareDriver ? telemetryByCode.get(compareDriver) ?? [] : []
    if (!primary.length) return null

    const { t0: lapT0, t1: lapT1 } = lapTimeWindow
    const pRows = primary.slice(lbTs(primary, lapT0), ubTs(primary, lapT1))
    if (!pRows.length) return null
    const cRows = compare.length ? compare.slice(lbTs(compare, lapT0), ubTs(compare, lapT1)) : []

    let timestampsAbs = pRows.map((r) => r.timestamp)
    let distance: number[]

    const needsDownsampling = timestampsAbs.length > MAX_TELEMETRY_POINTS
    if (needsDownsampling) {
      const step = timestampsAbs.length / MAX_TELEMETRY_POINTS
      const downsampled: typeof pRows = []
      for (let i = 0; i < MAX_TELEMETRY_POINTS; i++) {
        downsampled.push(pRows[Math.floor(i * step)])
      }
      timestampsAbs = downsampled.map((r) => r.timestamp)
    }

    distance = new Array(timestampsAbs.length)
    distance[0] = 0
    const sourceRows = needsDownsampling
      ? pRows
          .filter((_, i) => {
            const step = pRows.length / MAX_TELEMETRY_POINTS
            return i % Math.floor(step) === 0
          })
          .slice(0, MAX_TELEMETRY_POINTS)
      : pRows
    for (let i = 1; i < sourceRows.length; i += 1) {
      const dt = Math.max(0, timestampsAbs[i] - timestampsAbs[i - 1])
      const v0 = Number(sourceRows[i - 1].speed || 0)
      const v1 = Number(sourceRows[i].speed || 0)
      const vAvg = (v0 + v1) / 2
      const meters = (vAvg / 3.6) * dt
      distance[i] = distance[i - 1] + (Number.isFinite(meters) ? Math.max(0, meters) : 0)
    }
    if (distance.length > timestampsAbs.length) {
      distance = distance.slice(0, timestampsAbs.length)
    }

    const align = (field: keyof TelemetryRow, sourceRows: typeof pRows) => {
      if (!cRows.length) return [] as number[]
      let j = 0
      return sourceRows.map((p) => {
        while (j + 1 < cRows.length) {
          const cur = Math.abs(cRows[j].timestamp - p.timestamp)
          const nxt = Math.abs(cRows[j + 1].timestamp - p.timestamp)
          if (nxt <= cur) j += 1
          else break
        }
        return Number(cRows[j]?.[field]) || 0
      })
    }

    const alignedPrimary = (key: MetricKey) => sourceRows.map((r) => r[key] as number)
    const alignedCompare = (key: MetricKey) => align(key, sourceRows)

    return {
      lapT0,
      lapT1,
      fullLapDuration: lapT1 - lapT0,
      timestampsAbs,
      timestampsRel: timestampsAbs.map((t) => t - lapT0),
      distance,
      speed: { primary: alignedPrimary('speed'), compare: alignedCompare('speed') },
      throttle: { primary: alignedPrimary('throttle'), compare: alignedCompare('throttle') },
      brake: { primary: alignedPrimary('brake'), compare: alignedCompare('brake') },
      gear: { primary: alignedPrimary('gear'), compare: alignedCompare('gear') },
      rpm: { primary: alignedPrimary('rpm'), compare: alignedCompare('rpm') },
      drs: { primary: alignedPrimary('drs'), compare: alignedCompare('drs') },
    }
  }, [telemetryByCode, selectedDriver, compareDriver, lapTimeWindow])

  const liveTelemetry = useMemo((): { primary: Partial<TelemetryRow>; compare: Partial<TelemetryRow> } | null => {
    if (!selectedDriver) return null
    const primaryRows = telemetryByCode.get(selectedDriver) ?? []
    const compareRows = compareDriver ? telemetryByCode.get(compareDriver) ?? [] : []

    if (!primaryRows?.length) return null

    const t = sampledSessionTime
    let closestPrimary = primaryRows[0]
    let minDiff = Math.abs(primaryRows[0].timestamp - t)

    for (let i = 1; i < primaryRows.length; i++) {
      const diff = Math.abs(primaryRows[i].timestamp - t)
      if (diff < minDiff) {
        minDiff = diff
        closestPrimary = primaryRows[i]
      }
    }

    let closestCompare: TelemetryRow | null = null
    if (compareRows?.length) {
      let minCompareDiff = Math.abs(compareRows[0].timestamp - t)
      closestCompare = compareRows[0]
      for (let i = 1; i < compareRows.length; i++) {
        const diff = Math.abs(compareRows[i].timestamp - t)
        if (diff < minCompareDiff) {
          minCompareDiff = diff
          closestCompare = compareRows[i]
        }
      }
    }

    return {
      primary: closestPrimary || {},
      compare: closestCompare || {},
    }
  }, [telemetryByCode, selectedDriver, compareDriver, sampledSessionTime])

  return {
    windowedTelemetry,
    liveTelemetry,
    fetchWindow,
    lapTimeWindow,
    lapsByDriver,
    driverLaps,
    lapNumbers,
    activeLapNumber,
    effectiveLapNumber: lapTimeWindow?.lap.lapNumber ?? null,
    telemetryWindowStart,
    telemetryWindowEnd,
  }
}

export interface ChartDataResult {
  chartData: {
    lapT0: number
    lapT1: number
    fullLapDuration: number
    timestampsAbs: number[]
    distance: number[]
    speed: MetricPair
    throttle: MetricPair
    brake: MetricPair
    gear: MetricPair
    rpm: MetricPair
    drs: MetricPair
  } | null
  builtCharts: BuiltChart[]
}

export function useTelemetryCharts(
  windowedTelemetry: Windowed | null,
  selectedDriver: string | null,
  compareDriver: string | null,
  drivers: { code: string; teamColor: string }[],
  lapTimeWindow: LapTimeWindow | null
): ChartDataResult {
  const chartData = useMemo(() => {
    if (!windowedTelemetry) return null

    const totalPoints = windowedTelemetry.timestampsAbs.length
    if (totalPoints === 0) return null

    const end = totalPoints

    const pick = (k: MetricKey): MetricPair => ({
      primary: windowedTelemetry[k].primary.slice(0, end),
      compare: windowedTelemetry[k].compare.slice(0, end),
    })

    return {
      lapT0: windowedTelemetry.lapT0,
      lapT1: windowedTelemetry.lapT1,
      fullLapDuration: windowedTelemetry.fullLapDuration,
      timestampsAbs: windowedTelemetry.timestampsAbs.slice(0, end),
      distance: windowedTelemetry.distance.slice(0, end),
      speed: pick('speed'),
      throttle: pick('throttle'),
      brake: pick('brake'),
      gear: pick('gear'),
      rpm: pick('rpm'),
      drs: pick('drs'),
    }
  }, [windowedTelemetry])

  const builtCharts = useMemo((): BuiltChart[] => {
    if (!chartData || !selectedDriver) return []

    const distanceMax = chartData.distance[chartData.distance.length - 1] ?? 0
    const distanceAtTime = (tAbs: number) => {
      const times = chartData.timestampsAbs
      const dist = chartData.distance
      if (!times.length || !dist.length) return 0
      if (tAbs <= times[0]) return dist[0]
      if (tAbs >= times[times.length - 1]) return dist[dist.length - 1]
      const idx = ubNum(times, tAbs)
      const i1 = Math.max(1, Math.min(times.length - 1, idx))
      const i0 = i1 - 1
      const t0 = times[i0]
      const t1 = times[i1]
      const d0 = dist[i0]
      const d1 = dist[i1]
      const ratio = t1 > t0 ? (tAbs - t0) / (t1 - t0) : 0
      return d0 + (d1 - d0) * Math.max(0, Math.min(1, ratio))
    }

    const driverObj = drivers.find((d) => d.code === selectedDriver)
    const primaryColor = driverObj?.teamColor || '#82cfff'
    const compareObj = compareDriver ? drivers.find((d) => d.code === compareDriver) : null
    const compareColor = compareObj?.teamColor || '#a6b0bf'

    const mappedCharts = CHANNELS.map((cfg) => {
      const pair = chartData[cfg.key]

      const hasData = pair.primary.some((v) => Number.isFinite(v))
      if (!hasData) return null

      const series = [
        { label: selectedDriver, data: pair.primary, color: primaryColor, width: 2 },
        ...(compareDriver && pair.compare.length
          ? [{ label: compareDriver, data: pair.compare, color: compareColor, width: 2 }]
          : []),
      ]

      let sectorMarkers: { x: number; label?: string }[] = []
      if (cfg.markers) {
        const s1 = Number(lapTimeWindow?.lap?.sector1)
        const s2 = Number(lapTimeWindow?.lap?.sector2)
        const s3 = Number(lapTimeWindow?.lap?.sector3)
        const sum = s1 + s2 + s3
        const hasSectors =
          Number.isFinite(s1) &&
          Number.isFinite(s2) &&
          Number.isFinite(s3) &&
          s1 > 0 &&
          s2 > 0 &&
          s3 > 0 &&
          Math.abs(sum - chartData.fullLapDuration) <= Math.max(1.8, chartData.fullLapDuration * 0.12)
        if (hasSectors) {
          const t1 = chartData.lapT0 + s1
          const t2 = chartData.lapT0 + s1 + s2
          const t3 = chartData.lapT0 + chartData.fullLapDuration
          sectorMarkers = [
            { x: distanceAtTime(t1), label: 'S1' },
            { x: distanceAtTime(t2), label: 'S2' },
            { x: distanceAtTime(t3), label: 'S3' },
          ]
        } else {
          sectorMarkers = [
            { x: distanceMax / 3, label: 'S1' },
            { x: (distanceMax * 2) / 3, label: 'S2' },
            { x: distanceMax * 0.92, label: 'S3' },
          ]
        }
      }

      const chart: BuiltChart = {
        key: cfg.key,
        title: cfg.title,
        yRange: cfg.y,
        yLabel: cfg.axisLabel,
        yTickMode: cfg.tickMode,
        yTickUnit: cfg.tickUnit,
        stepped: cfg.stepped,
        timestamps: chartData.distance,
        series,
        subtitle: metricSubtitle(pair.primary, pair.compare, cfg.tickMode, cfg.tickUnit, compareDriver),
        markers: sectorMarkers,
        shadingData: { drs: chartData.drs.primary, brake: chartData.brake.primary },
      }
      return chart
    })

    const result: BuiltChart[] = mappedCharts.filter((c): c is BuiltChart => c != null)

    if (compareDriver && chartData.speed.compare.length) {
      const deltaSpeedData = chartData.speed.primary.map(
        (value, idx) => value - (chartData.speed.compare[idx] ?? 0)
      )
      const maxAbsDelta = Math.max(
        10,
        ...deltaSpeedData.map((value) => Math.abs(value)).filter((value) => Number.isFinite(value))
      )
      result.push({
        key: 'deltaSpeed',
        title: 'Delta Speed',
        yRange: [-maxAbsDelta, maxAbsDelta],
        yLabel: 'Delta (km/h)',
        yTickMode: 'default',
        yTickUnit: 'km/h',
        stepped: false,
        timestamps: chartData.distance,
        series: [
          {
            label: `${selectedDriver} - ${compareDriver}`,
            data: deltaSpeedData,
            color: '#f5c46a',
            width: 2.2,
          },
        ],
        subtitle: `${selectedDriver} minus ${compareDriver}`,
        markers: [],
      })
    }

    return result
  }, [chartData, selectedDriver, compareDriver, drivers, lapTimeWindow])

  return { chartData, builtCharts }
}
