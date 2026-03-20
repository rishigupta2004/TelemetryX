import React, { useMemo, useState } from 'react'
import { useFeaturesStore } from '../stores/featuresStore'
import { useSessionStore } from '../stores/sessionStore'
import { buildPaceSeries, movingAverage, median } from '../lib/featuresUtils'
import { TelemetryView } from './TelemetryView'

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function buildBoxStats(values: number[]) {
  if (values.length < 3) return null
  const s = [...values].sort((a, b) => a - b)
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75)
  const iqr = q3 - q1
  const mean = s.reduce((a, b) => a + b, 0) / s.length
  const med = quantile(s, 0.5)
  const wLo = Math.max(s[0], q1 - 1.5 * iqr)
  const wHi = Math.min(s[s.length - 1], q3 + 1.5 * iqr)
  const outliers = s.filter(v => v < wLo || v > wHi)
  return { q1, q3, mean, med, wLo, wHi, outliers }
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '—'
  return seconds.toFixed(3)
}

export function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<'racepace' | 'telemetry'>('racepace')

  const sessionData = useSessionStore((s) => s.sessionData)
  const featuresStore = useFeaturesStore()
  const lapFeatures = featuresStore.lap
  const tyreFeatures = featuresStore.tyre

  const drivers = sessionData?.drivers ?? []

  const boxPlotData = useMemo(() => {
    if (!lapFeatures?.length || !drivers.length) return []

    const validLaps = lapFeatures.filter((lap) => {
      const time = Number(lap.lap_time ?? lap.lapTime ?? 0)
      return Number.isFinite(time) && time > 40 && time < 200 && lap.is_valid !== false
    })

    if (!validLaps.length) return []

    const byDriver = new Map<string, number[]>()

    for (const lap of validLaps) {
      const time = Number(lap.lap_time ?? lap.lapTime ?? 0)
      if (!Number.isFinite(time)) continue

      const driver = drivers.find(d => d.driverNumber === lap.driver_number)
      const code = driver?.code ?? String(lap.driver_name ?? lap.driver_number)

      const arr = byDriver.get(code) ?? []
      arr.push(time)
      byDriver.set(code, arr)
    }

    const results: Array<{
      code: string
      teamColor: string
      q1: number
      q3: number
      mean: number
      med: number
      wLo: number
      wHi: number
      outliers: number[]
      meanStr: string
      tyreStrategy: string
    }> = []

    for (const [code, times] of byDriver) {
      if (times.length < 3) continue

      const smoothed = movingAverage(times, 3)
      const stats = buildBoxStats(smoothed)
      if (!stats) continue

      const driver = drivers.find(d => d.code === code)
      const teamColor = driver?.teamColor ?? '#9fb3d4'

      const tyreStints = tyreFeatures?.filter(
        t => {
          const tDriver = drivers.find(d => d.driverNumber === t.driver_number)
          return (tDriver?.code ?? String(t.driver_name ?? '')) === code
        }
      ).sort((a, b) => a.stint_number - b.stint_number) ?? []

      const tyreStrategy = tyreStints
        .map(s => {
          const c = String(s.tyre_compound ?? '').toUpperCase()
          if (c.includes('SOFT')) return 'S'
          if (c.includes('MEDIUM')) return 'M'
          if (c.includes('HARD')) return 'H'
          if (c.includes('INTER')) return 'I'
          if (c.includes('WET')) return 'W'
          return '?'
        })
        .join('-')

      results.push({
        code,
        teamColor,
        q1: stats.q1,
        q3: stats.q3,
        mean: stats.mean,
        med: stats.med,
        wLo: stats.wLo,
        wHi: stats.wHi,
        outliers: stats.outliers,
        meanStr: formatTime(stats.mean),
        tyreStrategy: tyreStrategy || '—'
      })
    }

    return results.sort((a, b) => a.mean - b.mean)
  }, [lapFeatures, tyreFeatures, drivers])

  const paceSeries = useMemo(() => {
    if (!sessionData?.laps?.length) return []
    return buildPaceSeries(sessionData)
  }, [sessionData])

  const hasRacePaceData = boxPlotData.length > 0

  const renderRacePaceTab = () => {
    if (featuresStore.loading && !hasRacePaceData) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="animate-pulse bg-bg-secondary rounded-md w-full max-w-md h-48" />
        </div>
      )
    }

    if (!hasRacePaceData) {
      return (
        <div className="h-full flex items-center justify-center text-fg-secondary text-sm">
          Load a race session to see race pace analysis
        </div>
      )
    }

    const numDrivers = boxPlotData.length
    const chartHeight = 260
    const chartWidth = 900
    const padding = { top: 20, right: 20, bottom: 50, left: 60 }
    const plotWidth = chartWidth - padding.left - padding.right
    const plotHeight = chartHeight - padding.top - padding.bottom

    const allValues = boxPlotData.flatMap(d => [d.wLo, d.wHi, d.q1, d.q3, d.med, d.mean]).filter(Number.isFinite)
    const yMin = Math.min(...allValues) - 2
    const yMax = Math.max(...allValues) + 2
    const yRange = yMax - yMin

    const bandWidth = plotWidth / numDrivers

    const yScale = (v: number) => padding.top + plotHeight - ((v - yMin) / yRange) * plotHeight

    const boxPlotSvg = (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id="plotArea">
            <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>

        {[90, 95, 100, 105, 110, 115, 120].map(tick => {
          const y = yScale(tick)
          if (y < padding.top || y > padding.top + plotHeight) return null
          return (
            <g key={tick}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#3a3a3a" strokeWidth={0.5} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#888">{tick}</text>
            </g>
          )
        })}

        <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" fontSize={11} fill="#888">Smoothed Laptime (s)</text>

        {boxPlotData.map((driver, i) => {
          const x = padding.left + i * bandWidth + bandWidth / 2
          const w = bandWidth * 0.6
          const color = driver.teamColor

          const whiskerLoY = yScale(driver.wLo)
          const whiskerHiY = yScale(driver.wHi)
          const q1Y = yScale(driver.q1)
          const q3Y = yScale(driver.q3)
          const medY = yScale(driver.med)
          const meanY = yScale(driver.mean)

          return (
            <g key={driver.code}>
              <line x1={x} y1={whiskerLoY} x2={x} y2={whiskerHiY} stroke={color} strokeWidth={1.5} />
              <line x1={x - w/4} y1={whiskerLoY} x2={x + w/4} y2={whiskerLoY} stroke={color} strokeWidth={1.5} />
              <line x1={x - w/4} y1={whiskerHiY} x2={x + w/4} y2={whiskerHiY} stroke={color} strokeWidth={1.5} />

              <rect
                x={x - w/2}
                y={q3Y}
                width={w}
                height={q1Y - q3Y}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={1.5}
              />

              <line x1={x - w/2} y1={medY} x2={x + w/2} y2={medY} stroke={color} strokeWidth={2.5} />

              <line
                x1={x - w/3} y1={meanY} x2={x + w/3} y2={meanY}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="4 2"
                opacity={0.7}
              />

              <text x={x} y={chartHeight - 28} textAnchor="middle" fontSize={12} fontWeight="bold" fill={color}>
                {driver.code}
              </text>
              <text x={x} y={chartHeight - 14} textAnchor="middle" fontSize={10} fill="#888">
                {driver.meanStr}
              </text>
              <text x={x} y={chartHeight - 2} textAnchor="middle" fontSize={9} fill="#555">
                {driver.tyreStrategy}
              </text>
            </g>
          )
        })}
      </svg>
    )

    const lineChartHeight = 220
    const lineChartWidth = 900
    const linePadding = { top: 10, right: 20, bottom: 35, left: 60 }
    const linePlotWidth = lineChartWidth - linePadding.left - linePadding.right
    const linePlotHeight = lineChartHeight - linePadding.top - linePadding.bottom

    const maxLap = Math.max(...paceSeries.map(s => Math.max(...s.laps)), 1)
    const allTimes = paceSeries.flatMap(s => s.smoothed).filter(Number.isFinite)
    const lineYMin = Math.min(...allTimes) - 2
    const lineYMax = Math.max(...allTimes) + 2
    const lineYRange = lineYMax - lineYMin

    const lineXScale = (lap: number) => linePadding.left + ((lap - 1) / (maxLap - 1 || 1)) * linePlotWidth
    const lineYScale = (t: number) => linePadding.top + linePlotHeight - ((t - lineYMin) / lineYRange) * linePlotHeight

    const [hoverData, setHoverData] = useState<{ lap: number; code: string; time: number; x: number; y: number } | null>(null)

    const lineChartSvg = (
      <svg
        viewBox={`0 0 ${lineChartWidth} ${lineChartHeight}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverData(null)}
      >
        {[90, 95, 100, 105, 110, 115, 120].map(tick => {
          const y = lineYScale(tick)
          if (y < linePadding.top || y > linePadding.top + linePlotHeight) return null
          return (
            <g key={tick}>
              <line x1={linePadding.left} y1={y} x2={lineChartWidth - linePadding.right} y2={y} stroke="#3a3a3a" strokeWidth={0.5} />
              <text x={linePadding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#888">{tick}</text>
            </g>
          )
        })}

        {paceSeries.map(series => {
          const points: string[] = []
          series.laps.forEach((lap, i) => {
            const t = series.smoothed[i]
            if (!Number.isFinite(t)) return
            const x = lineXScale(lap)
            const y = lineYScale(t)
            points.push(`${x},${y}`)
          })
          if (!points.length) return null

          return (
            <polyline
              key={series.code}
              points={points.join(' ')}
              fill="none"
              stroke={series.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        {paceSeries.map(series =>
          series.laps.map((lap, i) => {
            const t = series.smoothed[i]
            if (!Number.isFinite(t)) return null
            const x = lineXScale(lap)
            const y = lineYScale(t)
            return (
              <circle
                key={`${series.code}-${lap}`}
                cx={x}
                cy={y}
                r={4}
                fill={series.color}
                className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                onMouseEnter={() => setHoverData({ lap, code: series.code, time: t, x, y })}
              />
            )
          })
        )}

        <text x={lineChartWidth / 2} y={lineChartHeight - 2} textAnchor="middle" fontSize={11} fill="#888">Lap</text>
        <text x={15} y={lineChartHeight / 2} textAnchor="middle" fontSize={11} fill="#888" transform={`rotate(-90, 15, ${lineChartHeight / 2})`}>
          Laptime (s)
        </text>

        {hoverData && (
          <g>
            <line
              x1={hoverData.x}
              y1={linePadding.top}
              x2={hoverData.x}
              y2={linePadding.top + linePlotHeight}
              stroke="#fff"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.8}
            />
            <rect
              x={hoverData.x + 10}
              y={hoverData.y - 25}
              width={90}
              height={40}
              fill="#222"
              rx={4}
              stroke="#444"
            />
            <text x={hoverData.x + 16} y={hoverData.y - 8} fontSize={11} fill="#fff" fontWeight="bold">
              {hoverData.code} Lap {hoverData.lap}
            </text>
            <text x={hoverData.x + 16} y={hoverData.y + 8} fontSize={10} fill="#ccc">
              {hoverData.time.toFixed(3)}s
            </text>
          </g>
        )}

        <g transform={`translate(${linePadding.left}, ${lineChartHeight - 22})`}>
          {paceSeries.map((s, i) => (
            <g key={s.code} transform={`translate(${i * 70}, 0)`}>
              <circle cx={6} cy={6} r={5} fill={s.color} />
              <text x={16} y={10} fontSize={10} fill="#ccc">{s.code}</text>
            </g>
          ))}
        </g>
      </svg>
    )

    return (
      <div className="flex flex-col h-full gap-2">
        <div className="flex-shrink-0" style={{ height: '40%', minHeight: '200px' }}>
          {boxPlotSvg}
        </div>
        <div className="flex-1 min-h-0">
          {lineChartSvg}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="rounded-md border border-border bg-bg-surface px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary">Analytics</div>
          <div className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('racepace')}
            className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              activeTab === 'racepace'
                ? 'border-accent bg-accent/10 text-fg-primary'
                : 'border-border bg-bg-secondary text-fg-secondary'
            }`}
          >
            Race Pace
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              activeTab === 'telemetry'
                ? 'border-accent bg-accent/10 text-fg-primary'
                : 'border-border bg-bg-secondary text-fg-secondary'
            }`}
          >
            Telemetry Comparison
          </button>
        </div>
      </div>

      <div className="bg-bg-surface rounded-md border border-border flex-1 overflow-hidden p-2">
        {activeTab === 'racepace' ? renderRacePaceTab() : <TelemetryView active={activeTab === 'telemetry'} />}
      </div>
    </div>
  )
}

export default AnalyticsView
