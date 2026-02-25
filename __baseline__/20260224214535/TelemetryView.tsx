import React, { useEffect, useMemo, useRef, useState } from 'react'
import { UPlotChart } from '../components/UPlotChart'
import { useSessionTime } from '../lib/timeUtils'
import { useDriverStore } from '../stores/driverStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import type { LapRow, TelemetryRow } from '../types'

const lbTs = (rows: TelemetryRow[], t: number) => {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].timestamp < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

const ubTs = (rows: TelemetryRow[], t: number) => {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].timestamp <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

const ubNum = (vals: number[], t: number) => {
  let lo = 0
  let hi = vals.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (vals[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

const lapAtTime = (laps: LapRow[], t: number) => {
  let lo = 0
  let hi = laps.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const lap = laps[mid]
    if (lap.lapStartSeconds <= t && t <= lap.lapEndSeconds) return lap
    if (t < lap.lapStartSeconds) hi = mid - 1
    else lo = mid + 1
  }
  return null
}

const CHARTS: {
  key: 'speed' | 'throttle' | 'brake' | 'gear' | 'rpm' | 'drs';
  title: string;
  h: number;
  y?: [number, number];
  axisLabel: string;
  tickMode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary';
  tickUnit?: string;
  markers?: boolean;
  stepped?: boolean;
}[] = [
  { key: 'speed', title: 'Speed', h: 240, axisLabel: 'Speed (km/h)', tickMode: 'default', tickUnit: 'km/h', markers: true },
  { key: 'throttle', title: 'Throttle', h: 160, y: [0, 105], axisLabel: 'Throttle (%)', tickMode: 'percent' },
  { key: 'brake', title: 'Brake', h: 160, y: [0, 105], axisLabel: 'Brake (%)', tickMode: 'percent' },
  { key: 'gear', title: 'Gear', h: 130, y: [0, 9], axisLabel: 'Gear', tickMode: 'integer', stepped: true },
  { key: 'rpm', title: 'RPM', h: 160, axisLabel: 'Engine Speed (RPM)', tickMode: 'rpm' },
  { key: 'drs', title: 'DRS', h: 90, y: [0, 2], axisLabel: 'DRS State', tickMode: 'binary', stepped: true }
]

type MetricKey = 'speed' | 'throttle' | 'brake' | 'gear' | 'rpm' | 'drs'
type MetricPair = { primary: number[]; compare: number[] }
type Windowed = {
  lapT0: number
  lapT1: number
  fullLapDuration: number
  timestampsAbs: number[]
  timestampsRel: number[]
} & Record<MetricKey, MetricPair>

type BuiltChart = {
  key: MetricKey | 'deltaSpeed'
  title: string
  height: number
  yRange: [number, number]
  yLabel: string
  yTickMode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary'
  yTickUnit?: string
  stepped?: boolean
  timestamps: number[]
  series: { label: string; data: number[]; color: string; width?: number }[]
  subtitle: string
  markers: { x: number; label?: string }[]
  shadingData?: { drs?: number[]; brake?: number[] }
}

const formatMetricValue = (
  value: number,
  mode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary',
  unit?: string
): string => {
  if (mode === 'binary') return value >= 0.5 ? 'ON' : 'OFF'
  if (mode === 'rpm') return `${Math.round(value).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`
  if (mode === 'integer') return `${Math.round(value)}${unit ? ` ${unit}` : ''}`
  if (mode === 'percent') return `${Math.round(value)}%`
  if (Math.abs(value) >= 1000) return `${Math.round(value)}${unit ? ` ${unit}` : ''}`
  return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`
}

const metricSubtitle = (
  primary: number[],
  compare: number[],
  mode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary',
  unit: string | undefined,
  compareCode: string | null
): string => {
  if (!primary.length) return 'No points in current view'

  const cur = primary[primary.length - 1]
  const sum = primary.reduce((acc, v) => acc + v, 0)
  const avg = sum / primary.length

  if (mode === 'binary') {
    const onSamples = primary.reduce((acc, v) => acc + (v >= 0.5 ? 1 : 0), 0)
    const usage = (onSamples / primary.length) * 100
    let text = `Current ${formatMetricValue(cur, mode, unit)} | Active ${usage.toFixed(0)}%`
    if (compareCode && compare.length) {
      const compareOn = compare.reduce((acc, v) => acc + (v >= 0.5 ? 1 : 0), 0)
      const compareUsage = (compareOn / compare.length) * 100
      const delta = usage - compareUsage
      text += ` | vs ${compareCode} ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`
    }
    return text
  }

  const peak = Math.max(...primary)
  let text = `Current ${formatMetricValue(cur, mode, unit)} | Avg ${formatMetricValue(avg, mode, unit)} | Peak ${formatMetricValue(peak, mode, unit)}`
  if (compareCode && compare.length) {
    const cCur = compare[compare.length - 1]
    const delta = cur - cCur
    text += ` | vs ${compareCode} ${delta >= 0 ? '+' : ''}${formatMetricValue(delta, mode, unit)}`
  }
  return text
}

export const TelemetryView = React.memo(function TelemetryView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const fullLaps = useSessionStore((s) => s.laps)

  const telemetryData = useTelemetryStore((s) => s.telemetryData)
  const loadingState = useTelemetryStore((s) => s.loadingState)
  const loadTelemetry = useTelemetryStore((s) => s.loadTelemetry)
  const telemetryWindowStart = useTelemetryStore((s) => s.windowStart)
  const telemetryWindowEnd = useTelemetryStore((s) => s.windowEnd)

  const selectedDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)

  const [selectedLap, setSelectedLap] = useState(1)
  const [followPlayback, setFollowPlayback] = useState(true)
  const previousDriverRef = useRef<string | null>(null)
  const lastFetchRef = useRef<{ year: number; race: string; session: string; t0: number; t1: number } | null>(null)
  const sessionTime = useSessionTime()
  const speed = usePlaybackStore((s) => s.speed)
  const samplingHz = followPlayback ? (speed >= 12 ? 36 : speed >= 8 ? 30 : speed >= 4 ? 24 : 18) : 60
  const sampledSessionTime = Math.round(sessionTime * samplingHz) / samplingHz
  const drivers = sessionData?.drivers || []
  const laps = fullLaps.length ? fullLaps : sessionData?.laps || []

  const lapsByDriver = useMemo(() => {
    const byNum = new Map<number, LapRow[]>()
    const byCode = new Map<string, LapRow[]>()
    for (const lap of laps) {
      ;(byNum.get(lap.driverNumber) ?? (byNum.set(lap.driverNumber, []), byNum.get(lap.driverNumber)!)).push(lap)
      if (lap.driverName) (byCode.get(lap.driverName) ?? (byCode.set(lap.driverName, []), byCode.get(lap.driverName)!)).push(lap)
    }
    const map = new Map<string, LapRow[]>()
    for (const d of drivers) {
      const rows = (byNum.get(d.driverNumber) ?? byCode.get(d.code) ?? []).slice()
      rows.sort((a, b) => a.lapNumber - b.lapNumber || a.lapStartSeconds - b.lapStartSeconds)
      map.set(d.code, rows)
    }
    return map
  }, [drivers, laps])

  const driverLaps = useMemo(() => (selectedDriver ? lapsByDriver.get(selectedDriver) ?? [] : []), [selectedDriver, lapsByDriver])
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

  const lapTimeWindow = useMemo(() => {
    const lap = driverLaps.find((l) => l.lapNumber === selectedLap)
    return lap
      ? {
          lap,
          t0: Math.floor(lap.lapStartSeconds),
          t1: Math.ceil(lap.lapEndSeconds),
          duration: lap.lapTime || lap.lapEndSeconds - lap.lapStartSeconds
        }
      : null
  }, [driverLaps, selectedLap])

  const fetchWindow = useMemo(() => {
    if (!driverLaps.length) return null
    const i = driverLaps.findIndex((lap) => lap.lapNumber === selectedLap)
    if (i < 0) return null
    const from = driverLaps[Math.max(0, i - 1)]
    const to = driverLaps[Math.min(driverLaps.length - 1, i + 2)]
    return { t0: Math.max(0, Math.floor(from.lapStartSeconds) - 1), t1: Math.ceil(to.lapEndSeconds) + 1 }
  }, [driverLaps, selectedLap])

  useEffect(() => {
    if (!selectedDriver && drivers.length) selectPrimary(drivers[0].code)
  }, [drivers, selectedDriver, selectPrimary])

  useEffect(() => {
    if (!drivers.length) return
    if (!selectedDriver || !drivers.some((d) => d.code === selectedDriver)) selectPrimary(drivers[0].code)
    if (compareDriver && !drivers.some((d) => d.code === compareDriver && d.code !== selectedDriver)) selectCompare(null)
  }, [drivers, selectedDriver, compareDriver, selectPrimary, selectCompare])

  useEffect(() => {
    if (lapNumbers.length && !lapNumbers.includes(selectedLap)) setSelectedLap(lapNumbers[0])
  }, [lapNumbers, selectedLap])

  useEffect(() => {
    if (!selectedDriver) {
      previousDriverRef.current = null
      return
    }
    const prev = previousDriverRef.current
    previousDriverRef.current = selectedDriver
    if (prev === selectedDriver || !driverLaps.length) return
    const target = activeLapNumber ?? driverLaps[0].lapNumber
    if (target !== selectedLap) setSelectedLap(target)
  }, [selectedDriver, driverLaps, activeLapNumber, selectedLap])

  useEffect(() => {
    if (followPlayback && activeLapNumber != null && selectedLap !== activeLapNumber) setSelectedLap(activeLapNumber)
  }, [activeLapNumber, followPlayback, selectedLap])

  useEffect(() => {
    if (selectedYear && selectedRace && selectedSession && fetchWindow) {
      const next = {
        year: selectedYear,
        race: selectedRace,
        session: selectedSession,
        t0: fetchWindow.t0,
        t1: fetchWindow.t1
      }
      const prev = lastFetchRef.current
      if (
        prev &&
        prev.year === next.year &&
        prev.race === next.race &&
        prev.session === next.session &&
        prev.t0 === next.t0 &&
        prev.t1 === next.t1
      ) {
        return
      }
      const timer = window.setTimeout(() => {
        lastFetchRef.current = next
        void loadTelemetry(next.year, next.race, next.session, next.t0, next.t1)
      }, 70)
      return () => window.clearTimeout(timer)
    }
  }, [selectedYear, selectedRace, selectedSession, fetchWindow, loadTelemetry])


  const windowedTelemetry = useMemo((): Windowed | null => {
    if (!telemetryData || !selectedDriver || !lapTimeWindow) return null
    const primary = (telemetryData[selectedDriver] || []) as TelemetryRow[]
    const compare = compareDriver ? ((telemetryData[compareDriver] || []) as TelemetryRow[]) : []
    if (!primary.length) return null

    const { t0: lapT0, t1: lapT1 } = lapTimeWindow
    const pRows = primary.slice(lbTs(primary, lapT0), ubTs(primary, lapT1))
    if (!pRows.length) return null
    const cRows = compare.length ? compare.slice(lbTs(compare, lapT0), ubTs(compare, lapT1)) : []

    const timestampsAbs = pRows.map((r) => r.timestamp)
    const timestampsRel = timestampsAbs.map((t) => t - lapT0)

    const align = (field: keyof TelemetryRow) => {
      if (!cRows.length) return [] as number[]
      let j = 0
      return pRows.map((p) => {
        while (j + 1 < cRows.length) {
          const cur = Math.abs(cRows[j].timestamp - p.timestamp)
          const nxt = Math.abs(cRows[j + 1].timestamp - p.timestamp)
          if (nxt <= cur) j += 1
          else break
        }
        return Number(cRows[j][field]) || 0
      })
    }

    return {
      lapT0,
      lapT1,
      fullLapDuration: lapT1 - lapT0,
      timestampsAbs,
      timestampsRel,
      speed: { primary: pRows.map((r) => r.speed), compare: align('speed') },
      throttle: { primary: pRows.map((r) => r.throttle), compare: align('throttle') },
      brake: { primary: pRows.map((r) => Number(r.brake)), compare: align('brake') },
      gear: { primary: pRows.map((r) => r.gear), compare: align('gear') },
      rpm: { primary: pRows.map((r) => r.rpm), compare: align('rpm') },
      drs: { primary: pRows.map((r) => r.drs), compare: align('drs') }
    }
  }, [telemetryData, selectedDriver, compareDriver, lapTimeWindow])

  const chartData = useMemo(() => {
    if (!windowedTelemetry) return null

    const rawEnd = followPlayback
      ? ubNum(
          windowedTelemetry.timestampsAbs,
          Math.min(Math.max(sampledSessionTime, windowedTelemetry.lapT0), windowedTelemetry.lapT1)
        )
      : windowedTelemetry.timestampsAbs.length

    const end = followPlayback ? rawEnd : Math.max(0, rawEnd)
    if (end <= 0) return null

    const pick = (k: MetricKey): MetricPair => ({
      primary: windowedTelemetry[k].primary.slice(0, end),
      compare: windowedTelemetry[k].compare.slice(0, end)
    })

    return {
      lapT0: windowedTelemetry.lapT0,
      lapT1: windowedTelemetry.lapT1,
      fullLapDuration: windowedTelemetry.fullLapDuration,
      timestamps: windowedTelemetry.timestampsRel.slice(0, end),
      speed: pick('speed'),
      throttle: pick('throttle'),
      brake: pick('brake'),
      gear: pick('gear'),
      rpm: pick('rpm'),
      drs: pick('drs')
    }
  }, [windowedTelemetry, followPlayback, sampledSessionTime])

  const builtCharts = useMemo((): BuiltChart[] => {
    if (!chartData || !selectedDriver) return []

    const showPlaybackMarker = sampledSessionTime >= chartData.lapT0 && sampledSessionTime <= chartData.lapT1
    const nowX = sampledSessionTime - chartData.lapT0

    const baseCharts = CHARTS.map((cfg) => {
      const pair = chartData[cfg.key]
      const series = [
        { label: selectedDriver, data: pair.primary, color: '#3cc5bd', width: 2.3 },
        ...(compareDriver && pair.compare.length
          ? [{ label: compareDriver, data: pair.compare, color: '#d7deec', width: 1.9 }]
          : [])
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
          sectorMarkers = [
            { x: s1, label: 'S1' },
            { x: s1 + s2, label: 'S2' },
            { x: chartData.fullLapDuration, label: 'S3' }
          ]
        } else {
          sectorMarkers = [
            { x: chartData.fullLapDuration / 3, label: 'S1' },
            { x: (chartData.fullLapDuration * 2) / 3, label: 'S2' },
            { x: chartData.fullLapDuration * 0.92, label: 'S3' }
          ]
        }
      }

      const playbackMarker = showPlaybackMarker ? [{ x: nowX, label: 'NOW' }] : []

      return {
        key: cfg.key,
        title: cfg.title,
        height: cfg.h,
        yRange: cfg.y,
        yLabel: cfg.axisLabel,
        yTickMode: cfg.tickMode,
        yTickUnit: cfg.tickUnit,
        stepped: cfg.stepped,
        timestamps: chartData.timestamps,
        series,
        subtitle: metricSubtitle(pair.primary, pair.compare, cfg.tickMode, cfg.tickUnit, compareDriver),
        markers: [...sectorMarkers, ...playbackMarker],
        shadingData: { drs: chartData.drs.primary, brake: chartData.brake.primary }
      }
    })

    if (compareDriver && chartData.speed.compare.length) {
      const deltaSpeedData = chartData.speed.primary.map((value, idx) => value - (chartData.speed.compare[idx] ?? 0))
      const maxAbsDelta = Math.max(
        10,
        ...deltaSpeedData.map((value) => Math.abs(value)).filter((value) => Number.isFinite(value))
      )
      baseCharts.push({
        key: 'deltaSpeed',
        title: 'Delta Speed',
        height: 80,
        yRange: [-maxAbsDelta, maxAbsDelta],
        yLabel: 'Delta (km/h)',
        yTickMode: 'default',
        yTickUnit: 'km/h',
        stepped: false,
        timestamps: chartData.timestamps,
        series: [{ label: `${selectedDriver} - ${compareDriver}`, data: deltaSpeedData, color: '#9dd1ff', width: 2 }],
        subtitle: `${selectedDriver} minus ${compareDriver}`,
        markers: showPlaybackMarker ? [{ x: nowX, label: 'NOW' }] : []
      })
    }

    return baseCharts
  }, [chartData, sampledSessionTime, selectedDriver, compareDriver, lapTimeWindow?.lap?.sector1, lapTimeWindow?.lap?.sector2, lapTimeWindow?.lap?.sector3])


  if (!sessionData) return <div className="flex h-full items-center justify-center text-text-muted">No session loaded</div>

  const lapIdx = lapNumbers.indexOf(selectedLap)
  const lapSelectValue = lapNumbers.includes(selectedLap) ? selectedLap : lapNumbers[0] ?? 0

  return (
    <div className="flex h-full flex-col overflow-hidden p-5 xl:p-6">
      <div className="glass-panel flex flex-shrink-0 flex-col gap-2 rounded-t-2xl border-b-0 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">DRIVER:</span>
            <select
              value={selectedDriver || ''}
              onChange={(e) => {
                selectPrimary(e.target.value)
                setFollowPlayback(true)
              }}
            className="rounded border border-border bg-bg-card px-2.5 py-1 text-sm text-text-primary"
          >
              {drivers.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} - {d.driverName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">VS:</span>
            <select
              value={compareDriver || ''}
              onChange={(e) => selectCompare(e.target.value || null)}
            className="rounded border border-border bg-bg-card px-2.5 py-1 text-sm text-text-primary"
          >
              <option value="">None</option>
              {drivers
                .filter((d) => d.code !== selectedDriver)
                .map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} - {d.driverName}
                  </option>
                ))}
            </select>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFollowPlayback((v) => !v)}
              className={`rounded border px-2.5 py-1 text-xs font-mono ${
                followPlayback
                  ? 'border-accent bg-accent/25 text-text-primary'
                  : 'border-border bg-bg-card text-text-secondary'
              }`}
            >
              {followPlayback ? 'SYNC ON' : 'SYNC OFF'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (lapIdx > 0) {
                  setSelectedLap(lapNumbers[lapIdx - 1])
                  setFollowPlayback(false)
                }
              }}
              disabled={lapIdx <= 0}
              className="rounded border border-border bg-bg-card px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              ◀
            </button>

            <select
              value={lapSelectValue}
              onChange={(e) => {
                setSelectedLap(Number(e.target.value))
                setFollowPlayback(false)
              }}
              className="rounded border border-border bg-bg-card px-2.5 py-1 font-mono text-sm text-text-primary"
            >
              {lapNumbers.map((lap) => (
                <option key={lap} value={lap}>
                  Lap {lap}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (lapIdx < lapNumbers.length - 1) {
                  setSelectedLap(lapNumbers[lapIdx + 1])
                  setFollowPlayback(false)
                }
              }}
              disabled={lapIdx >= lapNumbers.length - 1}
              className="rounded border border-border bg-bg-card px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              ▶
            </button>

            {lapTimeWindow && <span className="ml-2 font-mono text-xs text-text-muted">{lapTimeWindow.duration.toFixed(1)}s</span>}
          </div>
        </div>

        <div className="text-[11px] text-text-muted">
          Active lap {activeLapNumber ?? '-'} | Telemetry window {telemetryWindowStart.toFixed(0)}-{telemetryWindowEnd.toFixed(0)}s
          {loadingState === 'loading' ? ' | loading...' : ''}
          {compareDriver && telemetryData && !(telemetryData[compareDriver]?.length ?? 0) ? ` | ${compareDriver} telemetry unavailable` : ''}
        </div>
      </div>

      <div className="glass-panel flex-1 overflow-y-auto rounded-b-2xl border-t-0 px-3 py-3">
        {builtCharts.length ? (
          builtCharts.map((cfg) => (
            <UPlotChart
              key={cfg.key}
              title={cfg.title}
              subtitle={cfg.subtitle}
              timestamps={cfg.timestamps}
              series={cfg.series}
              height={cfg.height}
              yRange={cfg.yRange}
              xRange={[0, chartData?.fullLapDuration ?? 0]}
              xLabel="Lap Time"
              yLabel={cfg.yLabel}
              yTickMode={cfg.yTickMode}
              yTickUnit={cfg.yTickUnit}
              markers={cfg.markers}
              stepped={cfg.stepped}
              shadingData={cfg.shadingData}
            />
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            {loadingState === 'error' ? 'Error loading telemetry' : loadingState === 'loading' ? 'Loading telemetry...' : 'No telemetry data for this lap yet'}
          </div>
        )}
      </div>
    </div>
  )
})
