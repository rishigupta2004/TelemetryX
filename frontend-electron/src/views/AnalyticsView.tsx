import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { UPlotChart } from '../components/UPlotChart'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import type { LapRow, TelemetryRow } from '../types'
import { COMPOUND_COLORS } from '../lib/colors'

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--.---'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function validLap(lap: LapRow): boolean {
  const lapTime = Number(lap.lapTime || 0)
  return (
    lapTime >= 45 &&
    lapTime <= 200 &&
    lap.isDeleted !== true &&
    lap.isValid !== false
  )
}

function quantileBucket(value: number, sorted: number[]): number {
  if (!Number.isFinite(value) || !sorted.length) return 2
  const idx = sorted.findIndex((item) => value <= item)
  if (idx < 0) return 4
  return Math.max(0, Math.min(4, Math.floor((idx / sorted.length) * 5)))
}

const HEATMAP_COLORS = ['bg-emerald-500/25', 'bg-lime-500/20', 'bg-amber-500/20', 'bg-orange-500/25', 'bg-rose-500/25']
const MAX_CORNER_BARS = 14

function extractApexRows(rows: TelemetryRow[], maxCorners: number): Array<{ label: string; speed: number; timestamp: number }> {
  if (rows.length < 7) return []
  const picked: Array<{ speed: number; timestamp: number; idx: number; prominence: number }> = []
  let lastAccepted = -9999
  for (let i = 3; i < rows.length - 3; i += 1) {
    const s = Number(rows[i].speed || 0)
    if (!Number.isFinite(s) || s <= 0 || s >= 280) continue
    const prev = Number(rows[i - 1].speed || 0)
    const next = Number(rows[i + 1].speed || 0)
    if (!(s <= prev && s <= next)) continue
    const wingMax = Math.max(
      Number(rows[i - 3].speed || 0),
      Number(rows[i - 2].speed || 0),
      Number(rows[i + 2].speed || 0),
      Number(rows[i + 3].speed || 0)
    )
    const prominence = wingMax - s
    if (prominence < 7) continue
    if (i - lastAccepted < 14) continue
    picked.push({ speed: s, timestamp: rows[i].timestamp, idx: i, prominence })
    lastAccepted = i
  }
  if (!picked.length) return []
  const strongest = [...picked]
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, maxCorners)
    .sort((a, b) => a.timestamp - b.timestamp)
  return strongest.map((row, idx) => ({
    label: `C${idx + 1}`,
    speed: row.speed,
    timestamp: row.timestamp
  }))
}

type AnalyticsPanel = 'lapTime' | 'paceDelta' | 'tyreDeg' | 'sectors' | 'efficiency' | 'cornerSpeed'

export const AnalyticsView = React.memo(function AnalyticsView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const lapsStore = useSessionStore((s) => s.laps)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const telemetryData = useTelemetryStore((s) => s.telemetryData)
  const loadTelemetry = useTelemetryStore((s) => s.loadTelemetry)
  const [activePanel, setActivePanel] = useState<AnalyticsPanel>('lapTime')
  const [panelHeight, setPanelHeight] = useState(520)
  const panelRef = useRef<HTMLDivElement>(null)
  const [cursorInfo, setCursorInfo] = useState<{ x: null | number; values: number[]; labels: string[] } | null>(null)

  if (!sessionData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '13px'
      }}>
        Select a session to begin
      </div>
    )
  }

  const laps = lapsStore.length ? lapsStore : sessionData?.laps ?? []
  const drivers = sessionData?.drivers ?? []

  const lapsByCode = useMemo(() => {
    const byCode = new Map<string, LapRow[]>()
    const codeByNumber = new Map<number, string>()
    const codeByName = new Map<string, string>()
    for (const driver of drivers) {
      codeByNumber.set(driver.driverNumber, driver.code)
      codeByName.set(String(driver.driverName || '').toUpperCase(), driver.code)
      codeByName.set(String(driver.code || '').toUpperCase(), driver.code)
    }
    for (const lap of laps) {
      const key =
        codeByNumber.get(lap.driverNumber) ||
        codeByName.get(String(lap.driverName || '').toUpperCase()) ||
        String(lap.driverName || '').toUpperCase()
      if (!key) continue
      const list = byCode.get(key) ?? []
      list.push(lap)
      byCode.set(key, list)
    }
    for (const [key, rows] of byCode.entries()) {
      rows.sort((a, b) => a.lapNumber - b.lapNumber)
      byCode.set(key, rows)
    }
    return byCode
  }, [drivers, laps])

  const maxLap = useMemo(() => Math.max(1, ...laps.map((lap) => lap.lapNumber || 0)), [laps])
  const lapAxis = useMemo(() => Array.from({ length: maxLap }, (_, i) => i + 1), [maxLap])

  const topCodes = useMemo(() => {
    if (!drivers.length) return []
    const finalPos = drivers
      .map((driver) => {
        const dLaps = lapsByCode.get(driver.code) ?? []
        const last = dLaps[dLaps.length - 1]
        return { code: driver.code, pos: last?.position ?? 99 }
      })
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 8)
    return finalPos.map((row) => row.code)
  }, [drivers, lapsByCode])

  const lapProgressionSeries = useMemo(() => {
    return topCodes.map((code) => {
      const rows = lapsByCode.get(code) ?? []
      const byLap = new Map<number, number>()
      for (const lap of rows) {
        if (!validLap(lap)) continue
        byLap.set(lap.lapNumber, Number(lap.lapTime || NaN))
      }
      const data = lapAxis.map((lapNum) => byLap.get(lapNum) ?? Number.NaN)
      const color = drivers.find((d) => d.code === code)?.teamColor || '#9fb3d4'
      return { label: code, data, color }
    })
  }, [topCodes, lapsByCode, lapAxis, drivers])

  const fieldMedianByLap = useMemo(() => {
    const out = new Map<number, number>()
    for (const lapNum of lapAxis) {
      const values: number[] = []
      for (const rows of lapsByCode.values()) {
        const lap = rows.find((row) => row.lapNumber === lapNum)
        if (lap && validLap(lap)) values.push(Number(lap.lapTime || 0))
      }
      values.sort((a, b) => a - b)
      if (values.length) out.set(lapNum, values[Math.floor(values.length / 2)])
    }
    return out
  }, [lapAxis, lapsByCode])

  const selectedCode = primaryDriver || topCodes[0] || null

  const paceDelta = useMemo(() => {
    if (!selectedCode) return []
    const rows = lapsByCode.get(selectedCode) ?? []
    const byLap = new Map(rows.map((lap) => [lap.lapNumber, lap]))
    return lapAxis.map((lapNum) => {
      const lap = byLap.get(lapNum)
      const med = fieldMedianByLap.get(lapNum)
      if (!lap || !med || !validLap(lap)) return Number.NaN
      return Number(lap.lapTime || 0) - med
    })
  }, [selectedCode, lapsByCode, lapAxis, fieldMedianByLap])

  const tyreDegradationSeries = useMemo(() => {
    if (!selectedCode) return [] as Array<{ label: string; data: number[]; color: string }>
    const rows = (lapsByCode.get(selectedCode) ?? []).filter(validLap)
    const compounds = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET']
    return compounds.map((compound) => {
      const data = lapAxis.map((lapNum) => {
        const lap = rows.find((item) => item.lapNumber === lapNum)
        if (!lap) return Number.NaN
        const key = String(lap.tyreCompound || '').toUpperCase()
        const normalized = key[0] === 'S' ? 'SOFT' : key[0] === 'M' ? 'MEDIUM' : key[0] === 'H' ? 'HARD' : key[0] === 'I' ? 'INTERMEDIATE' : key[0] === 'W' ? 'WET' : key
        if (normalized !== compound) return Number.NaN
        return Number(lap.lapTime || NaN)
      })
      return { label: compound, data, color: COMPOUND_COLORS[compound] ?? '#a0a0a0' }
    })
  }, [selectedCode, lapsByCode, lapAxis])

  const miniSectorHeatmap = useMemo(() => {
    const rows = topCodes.map((code) => {
      const dLaps = (lapsByCode.get(code) ?? []).filter(validLap)
      const avg = (items: Array<number | null>) => {
        const vals = items.filter((v): v is number => Number.isFinite(v as number) && (v as number) > 0)
        if (!vals.length) return Number.NaN
        return vals.reduce((a, b) => a + b, 0) / vals.length
      }
      return {
        code,
        s1: avg(dLaps.map((lap) => lap.sector1)),
        s2: avg(dLaps.map((lap) => lap.sector2)),
        s3: avg(dLaps.map((lap) => lap.sector3))
      }
    })
    const s1Sorted = rows.map((r) => r.s1).filter(Number.isFinite).sort((a, b) => a - b)
    const s2Sorted = rows.map((r) => r.s2).filter(Number.isFinite).sort((a, b) => a - b)
    const s3Sorted = rows.map((r) => r.s3).filter(Number.isFinite).sort((a, b) => a - b)
    return rows.map((row) => ({
      ...row,
      b1: quantileBucket(row.s1, s1Sorted),
      b2: quantileBucket(row.s2, s2Sorted),
      b3: quantileBucket(row.s3, s3Sorted)
    }))
  }, [topCodes, lapsByCode])

  const efficiency = useMemo(() => {
    const entries = Object.entries(telemetryData || {})
    return entries
      .map(([code, rows]) => {
        const points = (rows || []) as TelemetryRow[]
        if (!points.length) return null
        const throttleAvg = points.reduce((sum, r) => sum + Number(r.throttle || 0), 0) / points.length
        const brakeAvg = points.reduce((sum, r) => sum + Number(r.brake || 0), 0) / points.length
        const speedAvg = points.reduce((sum, r) => sum + Number(r.speed || 0), 0) / points.length
        const score = Math.max(0, Math.min(100, throttleAvg * 0.55 + (100 - brakeAvg) * 0.35 + (speedAvg / 360) * 100 * 0.1))
        return { code, throttleAvg, brakeAvg, score }
      })
      .filter((row): row is { code: string; throttleAvg: number; brakeAvg: number; score: number } => !!row)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [telemetryData])

  const compareDelta = useMemo(() => {
    if (!selectedCode || !compareDriver) return null
    const a = (lapsByCode.get(selectedCode) ?? []).filter(validLap)
    const b = (lapsByCode.get(compareDriver) ?? []).filter(validLap)
    const byLapB = new Map(b.map((lap) => [lap.lapNumber, lap]))
    const deltas = a
      .map((lap) => {
        const other = byLapB.get(lap.lapNumber)
        if (!other) return null
        return Number(lap.lapTime || 0) - Number(other.lapTime || 0)
      })
      .filter((v): v is number => v != null)
    if (!deltas.length) return null
    const avg = deltas.reduce((x, y) => x + y, 0) / deltas.length
    return avg
  }, [selectedCode, compareDriver, lapsByCode])

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession || !selectedCode) return
    const existingRows = telemetryData?.[selectedCode]
    if (existingRows && existingRows.length > 32) return
    const duration = Math.max(120, Math.ceil(sessionData?.metadata?.duration || 7200))
    void loadTelemetry(selectedYear, selectedRace, selectedSession, 0, duration)
  }, [selectedYear, selectedRace, selectedSession, selectedCode, telemetryData, loadTelemetry, sessionData?.metadata?.duration])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height || 0
      if (h > 0) setPanelHeight(Math.max(320, Math.floor(h) - 8))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setCursorInfo(null)
  }, [activePanel])

  const cornerSpeedRows = useMemo(() => {
    if (!selectedCode) return []
    const rows = (telemetryData?.[selectedCode] || []) as TelemetryRow[]
    if (!rows.length) return []
    const bestLap = (lapsByCode.get(selectedCode) ?? [])
      .filter(validLap)
      .sort((a, b) => Number(a.lapTime || 1e9) - Number(b.lapTime || 1e9))[0]
    if (!bestLap) return []
    const lapRows = rows.filter((row) => row.timestamp >= bestLap.lapStartSeconds && row.timestamp <= bestLap.lapEndSeconds)
    return extractApexRows(lapRows, MAX_CORNER_BARS)
  }, [selectedCode, telemetryData, lapsByCode])

  const handleCursor = useCallback(
    (labels: string[]) =>
      (payload: { x: number | null; values: number[] }) => {
        setCursorInfo({ x: payload.x, values: payload.values, labels })
      },
    []
  )

  const cursorText = useMemo(() => {
    if (!cursorInfo || cursorInfo.x == null) return null
    const lapLabel = `Lap ${Math.round(cursorInfo.x)}`
    const formatValue = (value: number) => {
      if (!Number.isFinite(value)) return '—'
      if (activePanel === 'paceDelta') return `${value >= 0 ? '+' : ''}${value.toFixed(3)}s`
      return formatTime(value)
    }
    const valueText = cursorInfo.labels
      .map((label, idx) => `${label}: ${formatValue(cursorInfo.values[idx])}`)
      .join(' | ')
    return `${lapLabel} · ${valueText}`
  }, [cursorInfo, activePanel])

  if (!sessionData || !laps.length) {
    return <EmptyState title="No analytics data" detail="Load a session with lap data to view analytics" />
  }

  const renderPanel = () => {
    switch (activePanel) {
      case 'lapTime':
        return (
          <UPlotChart
            title="Lap Time"
            timestamps={lapAxis}
            series={lapProgressionSeries}
            height={panelHeight}
            xRange={[1, maxLap]}
            xLabel="Lap"
            xTickMode="integer"
            yLabel="Lap Time (s)"
            yTickMode="default"
            yTickUnit="s"
            frame={false}
            showHeader={false}
            onCursor={handleCursor(lapProgressionSeries.map((s) => s.label))}
          />
        )
      case 'paceDelta':
        return (
          <UPlotChart
            title="Pace Delta"
            timestamps={lapAxis}
            series={[{ label: selectedCode || 'Driver', data: paceDelta, color: '#c7d0db', width: 2 }]}
            height={panelHeight}
            xRange={[1, maxLap]}
            xLabel="Lap"
            xTickMode="integer"
            yLabel="Delta (s)"
            yTickMode="default"
            yTickUnit="s"
            frame={false}
            showHeader={false}
            onCursor={handleCursor([selectedCode || 'Driver'])}
          />
        )
      case 'tyreDeg':
        return (
          <UPlotChart
            title="Tyre Degradation"
            timestamps={lapAxis}
            series={tyreDegradationSeries}
            height={panelHeight}
            xRange={[1, maxLap]}
            xLabel="Lap"
            xTickMode="integer"
            yLabel="Lap Time (s)"
            yTickMode="default"
            yTickUnit="s"
            frame={false}
            showHeader={false}
            onCursor={handleCursor(tyreDegradationSeries.map((s) => s.label))}
          />
        )
      case 'sectors':
        return (
          <div className="h-full overflow-auto">
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-fg-secondary">Mini-Sector Heatmap</div>
            <div className="space-y-1">
              {miniSectorHeatmap.map((row) => (
                <div key={row.code} className="grid grid-cols-[46px_1fr_1fr_1fr] items-center gap-1 text-[11px]">
                  <div className="font-mono text-fg-primary">{row.code}</div>
                  <div className={`rounded px-1.5 py-1 text-center ${HEATMAP_COLORS[row.b1]}`}>S1 {formatTime(row.s1)}</div>
                  <div className={`rounded px-1.5 py-1 text-center ${HEATMAP_COLORS[row.b2]}`}>S2 {formatTime(row.s2)}</div>
                  <div className={`rounded px-1.5 py-1 text-center ${HEATMAP_COLORS[row.b3]}`}>S3 {formatTime(row.s3)}</div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'efficiency':
        return (
          <div className="h-full overflow-auto">
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-fg-secondary">Throttle / Brake Efficiency</div>
            {efficiency.length === 0 ? (
              <div className="text-xs text-fg-muted">Load telemetry in Telemetry view to populate efficiency ranking.</div>
            ) : (
              <div className="space-y-1.5">
                {efficiency.map((row) => (
                  <div key={row.code} className="grid grid-cols-[40px_1fr_56px] items-center gap-2 text-[11px]">
                    <div className="font-mono text-fg-primary">{row.code}</div>
                    <div className="h-2 rounded bg-white/10">
                      <div className="h-2 rounded bg-white/70" style={{ width: `${row.score}%` }} />
                    </div>
                    <div className="text-right font-mono text-fg-secondary">{row.score.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case 'cornerSpeed':
        return (
          <div className="h-full overflow-auto">
            <div className="mb-1 text-xs uppercase tracking-[0.14em] text-fg-secondary">Corner Speed Analysis</div>
            {cornerSpeedRows.length === 0 ? (
              <div className="text-xs text-fg-muted">Telemetry corner samples unavailable yet for this selection.</div>
            ) : (
              <div className="space-y-1.5">
                {cornerSpeedRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[34px_1fr_56px] items-center gap-2 text-[11px]">
                    <div className="font-mono text-fg-primary">{row.label}</div>
                    <div className="h-2 rounded bg-white/10">
                      <div
                        className="h-2 rounded bg-amber-300/80"
                        style={{ width: `${Math.max(8, Math.min(100, (row.speed / 330) * 100))}%` }}
                      />
                    </div>
                    <div className="text-right font-mono text-fg-secondary">{row.speed.toFixed(1)} km/h</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const tabs: Array<{ key: AnalyticsPanel; label: string }> = [
    { key: 'lapTime', label: 'Lap Time' },
    { key: 'paceDelta', label: 'Pace Delta' },
    { key: 'tyreDeg', label: 'Tyre Deg' },
    { key: 'sectors', label: 'Sectors' },
    { key: 'efficiency', label: 'Efficiency' },
    { key: 'cornerSpeed', label: 'Corner Speed' }
  ]

  const activeLegend = useMemo(() => {
    if (activePanel === 'lapTime') return lapProgressionSeries
    if (activePanel === 'tyreDeg') return tyreDegradationSeries
    return []
  }, [activePanel, lapProgressionSeries, tyreDegradationSeries])

  const sessionLabel = sessionData
    ? `${sessionData.metadata.year} ${sessionData.metadata.raceName} · ${sessionData.metadata.sessionType}`
    : 'Analytics'

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="bg-bg-surface border border-border rounded-md flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary">Analytics</div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePanel(tab.key)}
              className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${activePanel === tab.key ? 'border-accent bg-accent/10 text-fg-primary' : 'border-border bg-bg-secondary text-fg-secondary'
                }`}
            >
              {tab.label}
            </button>
          ))}
          {activeLegend.map((series) => (
            <div key={series.label} className="flex flex-shrink-0 items-center gap-1.5 text-[10px] text-fg-secondary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
              <span className="font-mono text-fg-primary">{series.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-fg-muted">
          <span className="rounded-md border border-border bg-bg-inset px-2 py-0.5 font-mono">{sessionLabel}</span>
          <span className="rounded-md border border-border bg-bg-inset px-2 py-0.5 font-mono">
            Driver {selectedCode || '-'} {compareDriver ? `| ${compareDriver}` : ''}
          </span>
          {compareDelta != null && (
            <span className="rounded-md border border-border bg-bg-inset px-2 py-0.5 font-mono">
              Avg Δ {compareDelta >= 0 ? '+' : ''}{compareDelta.toFixed(3)}s
            </span>
          )}
          {cursorText && (
            <span className="rounded-md border border-border bg-bg-inset px-2 py-0.5 font-mono">
              {cursorText}
            </span>
          )}
        </div>
      </div>

      <div className="bg-bg-surface rounded-md border border-border flex-1 overflow-hidden">
        <div ref={panelRef} className="h-full w-full p-3">
          {renderPanel()}
        </div>
      </div>
    </div>
  )
})

export default AnalyticsView
