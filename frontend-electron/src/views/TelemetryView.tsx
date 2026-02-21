import React, { useEffect, useMemo, useRef, useState } from 'react'
import { UPlotChart } from '../components/UPlotChart'
import { useSessionTime } from '../lib/timeUtils'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import type { LapRow, TelemetryRow } from '../types'

const lbTs = (rows: TelemetryRow[], t: number) => { let lo = 0, hi = rows.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].timestamp < t) lo = mid + 1; else hi = mid } return lo }
const ubTs = (rows: TelemetryRow[], t: number) => { let lo = 0, hi = rows.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].timestamp <= t) lo = mid + 1; else hi = mid } return lo }
const ubNum = (vals: number[], t: number) => { let lo = 0, hi = vals.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] <= t) lo = mid + 1; else hi = mid } return lo }
const lapAtTime = (laps: LapRow[], t: number) => { let lo = 0, hi = laps.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1, lap = laps[mid]; if (lap.lapStartSeconds <= t && t <= lap.lapEndSeconds) return lap; if (t < lap.lapStartSeconds) hi = mid - 1; else lo = mid + 1 } return null }

const CHARTS = [
  { key: 'speed', title: 'Speed (km/h)', h: 150, y: [0, 360] as [number, number], label: 'km/h', markers: true },
  { key: 'throttle', title: 'Throttle (%)', h: 90, y: [0, 105] as [number, number], label: '%' },
  { key: 'brake', title: 'Brake', h: 90, y: [0, 105] as [number, number], label: '%' },
  { key: 'gear', title: 'Gear', h: 70, y: [0, 9] as [number, number], label: 'Gear', stepped: true },
  { key: 'rpm', title: 'RPM', h: 90, y: [0, 15000] as [number, number], label: 'RPM' },
  { key: 'drs', title: 'DRS', h: 50, y: [0, 2] as [number, number], label: 'DRS', stepped: true }
] as const

type MetricKey = (typeof CHARTS)[number]['key']
type MetricPair = { primary: number[]; compare: number[] }
type Windowed = { lapT0: number; lapT1: number; fullLapDuration: number; timestampsAbs: number[]; timestampsRel: number[] } & Record<MetricKey, MetricPair>

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
  const sessionTime = useSessionTime()

  const drivers = sessionData?.drivers || []
  const laps = fullLaps.length ? fullLaps : sessionData?.laps || []

  const lapsByDriver = useMemo(() => {
    const byNum = new Map<number, LapRow[]>(), byCode = new Map<string, LapRow[]>()
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
    const active = lapAtTime(driverLaps, sessionTime)
    if (active) return active.lapNumber
    for (let i = driverLaps.length - 1; i >= 0; i -= 1) if (driverLaps[i].lapEndSeconds <= sessionTime) return driverLaps[i].lapNumber
    return driverLaps[0].lapNumber
  }, [driverLaps, sessionTime])

  const lapTimeWindow = useMemo(() => {
    const lap = driverLaps.find((l) => l.lapNumber === selectedLap)
    return lap ? { t0: Math.floor(lap.lapStartSeconds), t1: Math.ceil(lap.lapEndSeconds), duration: lap.lapTime || lap.lapEndSeconds - lap.lapStartSeconds } : null
  }, [driverLaps, selectedLap])

  const fetchWindow = useMemo(() => {
    if (!driverLaps.length) return null
    const i = driverLaps.findIndex((lap) => lap.lapNumber === selectedLap)
    if (i < 0) return null
    const from = driverLaps[Math.max(0, i - 1)], to = driverLaps[Math.min(driverLaps.length - 1, i + 2)]
    return { t0: Math.max(0, Math.floor(from.lapStartSeconds) - 1), t1: Math.ceil(to.lapEndSeconds) + 1 }
  }, [driverLaps, selectedLap])

  useEffect(() => { if (!selectedDriver && drivers.length) selectPrimary(drivers[0].code) }, [drivers, selectedDriver, selectPrimary])

  useEffect(() => {
    if (!drivers.length) return
    if (!selectedDriver || !drivers.some((d) => d.code === selectedDriver)) selectPrimary(drivers[0].code)
    if (compareDriver && !drivers.some((d) => d.code === compareDriver && d.code !== selectedDriver)) selectCompare(null)
  }, [drivers, selectedDriver, compareDriver, selectPrimary, selectCompare])

  useEffect(() => { if (lapNumbers.length && !lapNumbers.includes(selectedLap)) setSelectedLap(lapNumbers[0]) }, [lapNumbers, selectedLap])

  useEffect(() => {
    if (!selectedDriver) return void (previousDriverRef.current = null)
    const prev = previousDriverRef.current
    previousDriverRef.current = selectedDriver
    if (prev === selectedDriver || !driverLaps.length) return
    const target = activeLapNumber ?? driverLaps[0].lapNumber
    if (target !== selectedLap) setSelectedLap(target)
  }, [selectedDriver, driverLaps, activeLapNumber, selectedLap])

  useEffect(() => { if (followPlayback && activeLapNumber != null && selectedLap !== activeLapNumber) setSelectedLap(activeLapNumber) }, [activeLapNumber, followPlayback, selectedLap])
  useEffect(() => { if (selectedYear && selectedRace && selectedSession && fetchWindow) void loadTelemetry(selectedYear, selectedRace, selectedSession, fetchWindow.t0, fetchWindow.t1) }, [selectedYear, selectedRace, selectedSession, fetchWindow, loadTelemetry])

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
          const cur = Math.abs(cRows[j].timestamp - p.timestamp), nxt = Math.abs(cRows[j + 1].timestamp - p.timestamp)
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
    const end = ubNum(windowedTelemetry.timestampsAbs, Math.min(sessionTime, windowedTelemetry.lapT1))
    if (end <= 0) return null
    const pick = (k: MetricKey): MetricPair => ({ primary: windowedTelemetry[k].primary.slice(0, end), compare: windowedTelemetry[k].compare.slice(0, end) })
    return { fullLapDuration: windowedTelemetry.fullLapDuration, timestamps: windowedTelemetry.timestampsRel.slice(0, end), speed: pick('speed'), throttle: pick('throttle'), brake: pick('brake'), gear: pick('gear'), rpm: pick('rpm'), drs: pick('drs') }
  }, [windowedTelemetry, sessionTime])

  if (!sessionData) return <div className="flex h-full items-center justify-center text-text-muted">No session loaded</div>

  const lapIdx = lapNumbers.indexOf(selectedLap)
  const makeSeries = (a: number[], b: number[]) => [{ label: selectedDriver || 'DRV', data: a, color: '#3cc5bd', width: 2.3 }, ...(compareDriver && b.length ? [{ label: compareDriver, data: b, color: '#d7deec', width: 1.9 }] : [])]
  const lapSelectValue = lapNumbers.includes(selectedLap) ? selectedLap : lapNumbers[0] ?? 0
  const speedMarkers = chartData ? [{ x: chartData.fullLapDuration / 3, label: 'S1' }, { x: (chartData.fullLapDuration * 2) / 3, label: 'S2' }, { x: chartData.fullLapDuration * 0.92, label: 'S3' }] : []

  return (
    <div className="flex h-full flex-col overflow-hidden p-5 xl:p-6">
      <div className="glass-panel flex flex-shrink-0 flex-wrap items-center gap-3 rounded-t-2xl border-b-0 px-4 py-3">
        <div className="flex items-center gap-2"><span className="text-xs text-text-secondary">DRIVER:</span><select value={selectedDriver || ''} onChange={(e) => { selectPrimary(e.target.value); setFollowPlayback(true) }} className="rounded-lg border border-border/70 bg-[#12284abf] px-2.5 py-1 text-sm text-text-primary">{drivers.map((d) => <option key={d.code} value={d.code}>{d.code} - {d.driverName}</option>)}</select></div>
        <div className="flex items-center gap-2"><span className="text-xs text-text-secondary">VS:</span><select value={compareDriver || ''} onChange={(e) => selectCompare(e.target.value || null)} className="rounded-lg border border-border/70 bg-[#12284abf] px-2.5 py-1 text-sm text-text-primary"><option value="">None</option>{drivers.filter((d) => d.code !== selectedDriver).map((d) => <option key={d.code} value={d.code}>{d.code} - {d.driverName}</option>)}</select></div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setFollowPlayback((v) => !v)} className={`rounded-lg border px-2.5 py-1 text-xs font-mono ${followPlayback ? 'border-accent-blue bg-accent-blue/25 text-text-primary' : 'border-border bg-[#10223dba] text-text-secondary'}`}>{followPlayback ? 'SYNC ON' : 'SYNC OFF'}</button>
          <button type="button" onClick={() => { if (lapIdx > 0) { setSelectedLap(lapNumbers[lapIdx - 1]); setFollowPlayback(false) } }} disabled={lapIdx <= 0} className="rounded-lg border border-border bg-[#10223dba] px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30">◀</button>
          <select value={lapSelectValue} onChange={(e) => { setSelectedLap(Number(e.target.value)); setFollowPlayback(false) }} className="rounded-lg border border-border bg-[#10223dba] px-2.5 py-1 font-mono text-sm text-text-primary">{lapNumbers.map((lap) => <option key={lap} value={lap}>Lap {lap}</option>)}</select>
          <button type="button" onClick={() => { if (lapIdx < lapNumbers.length - 1) { setSelectedLap(lapNumbers[lapIdx + 1]); setFollowPlayback(false) } }} disabled={lapIdx >= lapNumbers.length - 1} className="rounded-lg border border-border bg-[#10223dba] px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30">▶</button>
          {lapTimeWindow && <span className="ml-2 font-mono text-xs text-text-muted">{lapTimeWindow.duration.toFixed(1)}s</span>}
        </div>

        <div className="w-full text-[11px] text-text-muted md:w-auto">Active lap {activeLapNumber ?? '-'} | Telemetry window {telemetryWindowStart.toFixed(0)}-{telemetryWindowEnd.toFixed(0)}s{loadingState === 'loading' ? ' | refreshing...' : ''}</div>
      </div>

      <div className="glass-panel flex-1 space-y-2 overflow-y-auto rounded-b-2xl border-t-0 px-3 py-3">
        {chartData ? CHARTS.map((cfg) => (
          <UPlotChart
            key={cfg.key}
            title={cfg.title}
            timestamps={chartData.timestamps}
            series={makeSeries(chartData[cfg.key].primary, chartData[cfg.key].compare)}
            height={cfg.h}
            yRange={cfg.y}
            xRange={[0, chartData.fullLapDuration]}
            yLabel={cfg.label}
            markers={cfg.markers ? speedMarkers : undefined}
            stepped={cfg.stepped}
          />
        )) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">{loadingState === 'error' ? 'Error loading telemetry' : 'No telemetry data for this lap yet'}</div>
        )}
      </div>
    </div>
  )
})
