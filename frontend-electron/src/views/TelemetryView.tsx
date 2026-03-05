import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UPlotChart } from '../components/UPlotChart'
import { useSessionTime } from '../lib/timeUtils'
import { useDriverStore } from '../stores/driverStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import {
  lbTs,
  ubTs,
  ubNum,
  lapAtTime,
  formatMetricValue,
  formatLapTime,
  formatDelta,
  metricSubtitle,
  CHANNELS,
} from '../lib/telemetryUtils'
import type {
  BuiltChart,
  ChannelKey,
  MetricKey,
  MetricPair,
  Windowed,
} from '../lib/telemetryUtils'
import type { LapRow, TelemetryRow } from '../types'

// Baseline fallback height for the chart area
const DEFAULT_CHART_HEIGHT = 500
const CHANNEL_KEYS = CHANNELS.map((c) => c.key)
type ChannelSelection = ChannelKey | 'deltaSpeed'

// Windowed fetch constants
const HALF_WINDOW = 60 // ±60s of data centered on current time (fallback only)

export const TelemetryView = React.memo(function TelemetryView({ active = true }: { active?: boolean }) {
  const activeRef = useRef(active)
  activeRef.current = active
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
  const [stackedChannels, setStackedChannels] = useState<ChannelKey[]>(['speed', 'throttle', 'brake', 'rpm', 'gear', 'drs'])
  const [cursorByKey, setCursorByKey] = useState<Record<string, { x: number | null; values: number[] }>>({})
  const previousDriverRef = useRef<string | null>(null)
  const lastFetchRef = useRef<{ year: number; race: string; session: string; t0: number; t1: number } | null>(null)
  // Ref tracking the currently-fetched window bounds for inner-buffer logic
  const windowBoundsRef = useRef<{ t0: number; t1: number } | null>(null)
  const sessionTime = useSessionTime()
  const speed = usePlaybackStore((s) => s.speed)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const samplingHz = followPlayback ? (speed >= 12 ? 36 : speed >= 8 ? 30 : speed >= 4 ? 24 : 18) : 60
  const sampledSessionTime = Math.round(sessionTime * samplingHz) / samplingHz
  const drivers = sessionData?.drivers || []
  const laps = fullLaps.length ? fullLaps : sessionData?.laps || []

  // 60fps cursor fraction — updated via rAF subscription to playbackStore, no React state updates
  const cursorFractionRef = useRef<number | null>(null)

  // Container-measured chart height (replaces the broken height={-1})
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(DEFAULT_CHART_HEIGHT)
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    const measure = () => {
      const h = el.getBoundingClientRect().height
      if (h > 50) setChartHeight(Math.max(160, Math.floor(h)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const compareTopHeight = Math.max(220, Math.round(chartHeight * 0.55))
  const butterflyHeight = Math.max(150, Math.round(chartHeight * 0.25))
  const deltaHeight = Math.max(120, Math.round(chartHeight * 0.2))

  const chartWindowRef = useRef<{ lapT0: number; lapT1: number; distMax: number; timestampsAbs: number[]; distance: number[] }>({
    lapT0: 0, lapT1: 0, distMax: 0, timestampsAbs: [], distance: []
  })

  // Subscribe to playback store at 60fps to update cursor position
  // Only runs when the view is active (visible) to avoid wasting CPU
  useEffect(() => {
    if (!active) return
    let rafId: number | null = null
    const update = () => {
      if (!activeRef.current) return  // bail if deactivated mid-frame
      const state = usePlaybackStore.getState()
      const t = state.sessionStartTime + state.currentTime
      const w = chartWindowRef.current
      if (w.lapT0 >= w.lapT1 || w.distMax <= 0 || !w.timestampsAbs.length) {
        cursorFractionRef.current = null
        rafId = requestAnimationFrame(update)
        return
      }
      // Map session time → distance → fraction
      const times = w.timestampsAbs
      const dist = w.distance
      let d = 0
      if (t <= times[0]) {
        d = dist[0]
      } else if (t >= times[times.length - 1]) {
        d = dist[dist.length - 1]
      } else {
        const idx = ubNum(times, t)
        const i1 = Math.max(1, Math.min(times.length - 1, idx))
        const i0 = i1 - 1
        const ratio = times[i1] > times[i0] ? (t - times[i0]) / (times[i1] - times[i0]) : 0
        d = dist[i0] + (dist[i1] - dist[i0]) * Math.max(0, Math.min(1, ratio))
      }
      const frac = w.distMax > 0 ? d / w.distMax : 0
      if (t >= w.lapT0 && t <= w.lapT1) {
        cursorFractionRef.current = frac
      } else {
        cursorFractionRef.current = null
      }
      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      cursorFractionRef.current = null
    }
  }, [active])

  const lapsByDriver = useMemo(() => {
    const byNum = new Map<number, LapRow[]>()
    const byCode = new Map<string, LapRow[]>()
    for (const lap of laps) {
      ; (byNum.get(lap.driverNumber) ?? (byNum.set(lap.driverNumber, []), byNum.get(lap.driverNumber)!)).push(lap)
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

  // Windowed fetch: always load full lap window for the selected lap
  const fetchWindow = useMemo(() => {
    if (!driverLaps.length) return null
    if (lapTimeWindow) {
      const newWindow = { t0: lapTimeWindow.t0, t1: lapTimeWindow.t1 }
      windowBoundsRef.current = newWindow
      return newWindow
    }
    // Fallback: use a centered window if lap timing data is missing
    const t = sampledSessionTime
    const t0 = Math.max(0, Math.floor(t - HALF_WINDOW))
    const t1 = Math.ceil(t + HALF_WINDOW)
    const newWindow = { t0, t1 }
    windowBoundsRef.current = newWindow
    return newWindow
  }, [driverLaps, sampledSessionTime, lapTimeWindow])

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
      windowBoundsRef.current = null
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

  // Telemetry fetch effect — uses the inner-buffer fetchWindow
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
    const distance: number[] = new Array(pRows.length)
    distance[0] = 0
    for (let i = 1; i < pRows.length; i += 1) {
      const dt = Math.max(0, timestampsAbs[i] - timestampsAbs[i - 1])
      const v0 = Number(pRows[i - 1].speed || 0)
      const v1 = Number(pRows[i].speed || 0)
      const vAvg = (v0 + v1) / 2
      const meters = (vAvg / 3.6) * dt
      distance[i] = distance[i - 1] + (Number.isFinite(meters) ? Math.max(0, meters) : 0)
    }

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
      distance,
      speed: { primary: pRows.map((r) => r.speed), compare: align('speed') },
      throttle: { primary: pRows.map((r) => r.throttle), compare: align('throttle') },
      brake: { primary: pRows.map((r) => Number(r.brake)), compare: align('brake') },
      gear: { primary: pRows.map((r) => r.gear), compare: align('gear') },
      rpm: { primary: pRows.map((r) => r.rpm), compare: align('rpm') },
      drs: { primary: pRows.map((r) => r.drs), compare: align('drs') }
    }
  }, [telemetryData, selectedDriver, compareDriver, lapTimeWindow])

  // Live telemetry: current values at sessionTime (no history)
  const liveTelemetry = useMemo((): { primary: Partial<TelemetryRow>; compare: Partial<TelemetryRow> } | null => {
    if (!telemetryData || !selectedDriver) return null
    const primaryRows = telemetryData[selectedDriver] as TelemetryRow[]
    const compareRows = compareDriver ? (telemetryData[compareDriver] as TelemetryRow[]) : []

    if (!primaryRows?.length) return null

    // Find the row closest to current sessionTime
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
      compare: closestCompare || {}
    }
  }, [telemetryData, selectedDriver, compareDriver, sampledSessionTime])

  // Keep chartWindowRef in sync for the 60fps cursor computation
  useEffect(() => {
    if (windowedTelemetry) {
      chartWindowRef.current = {
        lapT0: windowedTelemetry.lapT0,
        lapT1: windowedTelemetry.lapT1,
        distMax: windowedTelemetry.distance[windowedTelemetry.distance.length - 1] ?? 0,
        timestampsAbs: windowedTelemetry.timestampsAbs,
        distance: windowedTelemetry.distance
      }
    }
  }, [windowedTelemetry])

  const chartData = useMemo(() => {
    if (!windowedTelemetry) return null

    const totalPoints = windowedTelemetry.timestampsAbs.length
    if (totalPoints === 0) return null

    // Always show the FULL lap data — the playback cursor line shows current position.
    // Progressive slicing caused a "vertical line" rendering when only 1-2 points were visible.
    const end = totalPoints

    const pick = (k: MetricKey): MetricPair => ({
      primary: windowedTelemetry[k].primary.slice(0, end),
      compare: windowedTelemetry[k].compare.slice(0, end)
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
      drs: pick('drs')
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

      // Channel visibility: skip channels where all primary values are null or zero
      const hasData = pair.primary.some((v) => Number.isFinite(v))
      if (!hasData) return null

      const series = [
        { label: selectedDriver, data: pair.primary, color: primaryColor, width: 2 },
        ...(compareDriver && pair.compare.length
          ? [{ label: compareDriver, data: pair.compare, color: compareColor, width: 2 }]
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
          const t1 = chartData.lapT0 + s1
          const t2 = chartData.lapT0 + s1 + s2
          const t3 = chartData.lapT0 + chartData.fullLapDuration
          sectorMarkers = [
            { x: distanceAtTime(t1), label: 'S1' },
            { x: distanceAtTime(t2), label: 'S2' },
            { x: distanceAtTime(t3), label: 'S3' }
          ]
        } else {
          sectorMarkers = [
            { x: distanceMax / 3, label: 'S1' },
            { x: (distanceMax * 2) / 3, label: 'S2' },
            { x: distanceMax * 0.92, label: 'S3' }
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
        shadingData: { drs: chartData.drs.primary, brake: chartData.brake.primary }
      }
      return chart
    })

    // Filter out null (hidden) channels
    const result: BuiltChart[] = mappedCharts.filter((c): c is BuiltChart => c != null)

    if (compareDriver && chartData.speed.compare.length) {
      const deltaSpeedData = chartData.speed.primary.map((value, idx) => value - (chartData.speed.compare[idx] ?? 0))
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
        series: [{ label: `${selectedDriver} - ${compareDriver}`, data: deltaSpeedData, color: '#f5c46a', width: 2.2 }],
        subtitle: `${selectedDriver} minus ${compareDriver}`,
        markers: []
      })
    }

    return result
  }, [chartData, selectedDriver, compareDriver, drivers, lapTimeWindow?.lap?.sector1, lapTimeWindow?.lap?.sector2, lapTimeWindow?.lap?.sector3])

  const handleCursor = useCallback(
    (key: string) =>
      (payload: { idx: number | null; x: number | null; values: number[] }) => {
        setCursorByKey((prev) => ({
          ...prev,
          [key]: { x: payload.x, values: payload.values }
        }))
      },
    []
  )

  // Click-to-seek: map distance X → timestamp → playback seek
  const handleSeek = useCallback(
    (dataX: number) => {
      if (!chartData) return
      const times = chartData.timestampsAbs
      const dist = chartData.distance
      if (!times.length || !dist.length) return
      // Binary search distance → timestamp
      let lo = 0
      let hi = dist.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (dist[mid] < dataX) lo = mid + 1
        else hi = mid
      }
      const i = lo
      const t = times[Math.min(i, times.length - 1)]
      if (Number.isFinite(t)) {
        usePlaybackStore.getState().seek(t - sessionStartTime)
      }
    },
    [chartData, sessionStartTime]
  )



  const findSectorDurations = (driverCode: string) => {
    const driverRows = lapsByDriver.get(driverCode) ?? []
    if (!driverRows.length) return null
    const lapRow = driverRows.find((l) => l.lapNumber === selectedLap)
    if (!lapRow) return null
    const s1 = Number(lapRow.sector1)
    const s2 = Number(lapRow.sector2)
    const s3 = Number(lapRow.sector3)
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || !Number.isFinite(s3)) return null
    return { s1, s2, s3 }
  }

  const primarySectors = useMemo(() => (selectedDriver ? findSectorDurations(selectedDriver) : null), [selectedDriver, selectedLap, lapsByDriver])
  const compareSectors = useMemo(() => (compareDriver ? findSectorDurations(compareDriver) : null), [compareDriver, selectedLap, lapsByDriver])

  const sectorRows = useMemo(() => {
    if (!primarySectors) return [] as Array<{ label: string; primary: number; compare: number | null; delta: number | null }>
    const rows = [
      { label: 'S1', primary: primarySectors.s1, compare: compareSectors?.s1 ?? null },
      { label: 'S2', primary: primarySectors.s2, compare: compareSectors?.s2 ?? null },
      { label: 'S3', primary: primarySectors.s3, compare: compareSectors?.s3 ?? null }
    ]
    return rows.map((row) => ({
      ...row,
      delta: row.compare != null ? row.primary - row.compare : null
    }))
  }, [primarySectors, compareSectors])

  const deltaSeries = useMemo(() => {
    if (!chartData || !compareDriver) return null
    const primarySpeed = chartData.speed.primary
    const compareSpeed = chartData.speed.compare
    if (!primarySpeed.length || !compareSpeed.length) return null
    const delta = primarySpeed.map((v, i) => (v ?? 0) - (compareSpeed[i] ?? 0))
    return {
      timestamps: chartData.distance,
      delta
    }
  }, [chartData, compareDriver])

  const butterflySeries = useMemo(() => {
    if (!chartData || !compareDriver || !selectedDriver) return null
    const primaryThrottle = chartData.throttle.primary
    const primaryBrake = chartData.brake.primary
    const compareThrottle = chartData.throttle.compare
    const compareBrake = chartData.brake.compare
    if (!primaryThrottle.length || !primaryBrake.length || !compareThrottle.length || !compareBrake.length) return null
    const primaryColor = drivers.find((d) => d.code === selectedDriver)?.teamColor || '#82cfff'
    const compareColor = drivers.find((d) => d.code === compareDriver)?.teamColor || '#a6b0bf'
    return {
      timestamps: chartData.distance,
      series: [
        { label: `${selectedDriver} Throttle`, data: primaryThrottle, color: primaryColor, width: 2 },
        { label: `${selectedDriver} Brake`, data: primaryBrake, color: '#e10600', width: 2 },
        { label: `${compareDriver} Throttle`, data: compareThrottle.map((v) => -v), color: compareColor, width: 2 },
        { label: `${compareDriver} Brake`, data: compareBrake.map((v) => -v), color: '#ff6b6b', width: 2 }
      ]
    }
  }, [chartData, compareDriver, selectedDriver, drivers])

  const miniMapPoints = useMemo(() => {
    if (!chartData || !chartData.distance.length) return [] as number[]
    const values = chartData.speed.primary
    if (!values.length) return []
    const max = Math.max(1, ...values.filter((v) => Number.isFinite(v)))
    return values.map((v) => (Number.isFinite(v) ? v / max : 0))
  }, [chartData])
  if (!sessionData) return <div className="flex h-full items-center justify-center text-fg-muted">No session loaded</div>

  const lapIdx = lapNumbers.indexOf(selectedLap)
  const lapSelectValue = lapNumbers.includes(selectedLap) ? selectedLap : lapNumbers[0] ?? 0


  const primaryDriverObj = drivers.find((d) => d.code === selectedDriver)
  const compareDriverObj = compareDriver ? drivers.find((d) => d.code === compareDriver) : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Dense top header bar */}
      <div className="flex flex-shrink-0 flex-col gap-1 border-b border-border-hard bg-bg-surface px-2 py-1">

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-fg-muted font-bold tracking-widest uppercase">DRIVER</span>
            <select
              value={selectedDriver || ''}
              onChange={(e) => {
                selectPrimary(e.target.value)
                setFollowPlayback(true)
              }}
              className="rounded-[2px] border border-border-hard bg-bg-inset px-1.5 py-0.5 text-[11px] font-mono text-fg-primary"
            >
              {drivers.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} - {d.driverName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-fg-muted font-bold tracking-widest uppercase">VS</span>
            <select
              value={compareDriver || ''}
              onChange={(e) => selectCompare(e.target.value || null)}
              className="rounded-[2px] border border-border-hard bg-bg-inset px-1.5 py-0.5 text-[11px] font-mono text-fg-primary"
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

          <div className="flex items-center gap-1.5">
            {primaryDriverObj && (
              <div
                className="flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold border"
                style={{
                  backgroundColor: `${primaryDriverObj.teamColor}20` || '#44444420',
                  borderColor: primaryDriverObj.teamColor || '#444',
                  color: primaryDriverObj.teamColor || '#fff',
                }}
              >
                <span className="font-mono opacity-80 uppercase text-[9px]">PRI</span>
                <span style={{ fontFamily: 'var(--font-display)' }}>{primaryDriverObj.code}</span>
              </div>
            )}
            {compareDriverObj && (
              <div
                className="flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold border"
                style={{
                  backgroundColor: `${compareDriverObj.teamColor}10` || '#88888810',
                  borderColor: `${compareDriverObj.teamColor}80` || '#88888880',
                  color: compareDriverObj.teamColor || '#bbb'
                }}
              >
                <span className="font-mono opacity-80 uppercase text-[9px]">CMP</span>
                <span style={{ fontFamily: 'var(--font-display)' }}>{compareDriverObj.code}</span>
              </div>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFollowPlayback((v) => !v)}
              className={`rounded-[2px] border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${followPlayback
                ? 'border-blue-sel bg-blue-sel/10 text-blue-sel'
                : 'border-border-hard bg-bg-surface text-fg-muted hover:text-fg-primary'
                }`}
            >
              SYNC {followPlayback ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (lapIdx > 0) {
                    setSelectedLap(lapNumbers[lapIdx - 1])
                    setFollowPlayback(false)
                  }
                }}
                disabled={lapIdx <= 0}
                className="rounded-l-[2px] border border-r-0 border-border-hard bg-bg-inset px-1.5 py-0.5 text-[11px] text-fg-secondary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-30"
              >
                ◀
              </button>
              <select
                value={lapSelectValue}
                onChange={(e) => {
                  setSelectedLap(Number(e.target.value))
                  setFollowPlayback(false)
                }}
                className="border-y border-border-hard bg-bg-inset px-2 py-0.5 font-mono text-[11px] text-fg-primary outline-none"
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
                className="rounded-r-[2px] border border-l-0 border-border-hard bg-bg-inset px-1.5 py-0.5 text-[11px] text-fg-secondary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-30"
              >
                ▶
              </button>
            </div>

            {lapTimeWindow && <span className="ml-[2px] font-mono text-[10px] text-fg-muted">{lapTimeWindow.duration.toFixed(1)}s</span>}
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-fg-muted font-mono">
          <span>
            ACTIVE LAP: {activeLapNumber ?? '-'} &nbsp;|&nbsp;
            WINDOW: {telemetryWindowStart.toFixed(0)}-{telemetryWindowEnd.toFixed(0)}s
            {loadingState === 'loading' ? ' | LOADING...' : ''}
            {compareDriver && telemetryData && !(telemetryData[compareDriver]?.length ?? 0) ? ` | ${compareDriver} NO DATA` : ''}
          </span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-base">
        {builtCharts.length > 0 ? (
          <div ref={chartContainerRef} className="flex-1 overflow-y-hidden w-full bg-bg-surface flex flex-col">
            {builtCharts
              .filter(chart => stackedChannels.includes(chart.key as ChannelKey))
              .map((chart, idx, arr) => {
                const isLast = idx === arr.length - 1
                // Dynamic height calculation: total container height divided by number of channels
                // Minimal padding subtracted for borders
                const dynamicHeight = Math.max(80, Math.floor((chartHeight - (arr.length - 1)) / arr.length))

                return (
                  <div key={chart.key} className={isLast ? '' : 'border-b border-border-micro'}>
                    <UPlotChart
                      title={chart.title}
                      timestamps={chart.timestamps}
                      series={chart.series}
                      height={dynamicHeight}
                      yRange={chart.yRange}
                      xRange={[0, chartData?.distance?.[chartData.distance.length - 1] ?? 0]}
                      xLabel={isLast ? "Distance" : ""}
                      xTickMode="distance"
                      xTickUnit="m"
                      yLabel={chart.yLabel}
                      yTickMode={chart.yTickMode}
                      yTickUnit={chart.yTickUnit}
                      markers={chart.markers}
                      stepped={chart.stepped}
                      shadingData={chart.shadingData}
                      frame={false}
                      showHeader={true}
                      onCursor={handleCursor(String(chart.key))}
                      playbackCursorRef={cursorFractionRef}
                      onSeek={handleSeek}
                    />
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-mono tracking-widest uppercase text-fg-muted">
            {loadingState === 'error' ? 'ERROR LOADING TELEMETRY' : loadingState === 'loading' ? `LOADING OVERLAY DATA FOR LAP ${selectedLap}...` : 'NO TELEMETRY STREAM FOR THIS LAP YET'}
          </div>
        )}
      </div>
    </div>
  )
})
