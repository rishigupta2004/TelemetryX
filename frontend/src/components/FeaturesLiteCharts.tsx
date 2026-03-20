import { Component, Fragment, ReactNode, useMemo, useState } from 'react'
import { animate } from 'animejs'

type RacePaceSeries = {
  code: string
  color: string
  laps: number[]
  smoothed: number[]
}

type StandingsSeries = {
  code: string
  color: string
  cumulative: number[]
}

type StandingsHeatmapRow = {
  code: string
  color: string
  totalPoints: number
  byRace: number[]
}

type ErrorBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

class ChartErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-[200px] items-center justify-center text-sm text-fg-muted">
          Chart unavailable
        </div>
      )
    }
    return this.props.children
  }
}

const CHART_COLORS = {
  gradient1: { start: '#1e3a5f', end: '#0f172a' },
  gradient2: { start: '#312e81', end: '#1e1b4b' },
  gradient3: { start: '#0f766e', end: '#134e4a' },
  gridLine: 'rgba(100, 116, 139, 0.15)',
  axisLabel: 'rgba(148, 163, 184, 0.85)',
  tooltipBg: 'rgba(15, 23, 42, 0.92)',
  tooltipBorder: 'rgba(71, 85, 105, 0.5)',
  accentGlow: 'rgba(56, 189, 248, 0.3)',
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}

function formatLapTime(val: number): string {
  return val.toFixed(2)
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val))
}

export function RacePaceLiteChart(props: { series: RacePaceSeries[] }) {
  return (
    <ChartErrorBoundary>
      <RacePaceLiteChartInner {...props} />
    </ChartErrorBoundary>
  )
}

function RacePaceLiteChartInner({ series }: { series: RacePaceSeries[] }) {
  const [hover, setHover] = useState<{
    x: number
    y: number
    screenX: number
    screenY: number
    code: string
    lap: number
    value: number
    color: string
  } | null>(null)

  const view = useMemo(() => {
    if (!series.length) return null

    const allLaps = series.flatMap((item) => item.laps)
    const allVals = series.flatMap((item) => item.smoothed)
    if (!allLaps.length || !allVals.length) return null

    const xMin = Math.min(...allLaps)
    const xMax = Math.max(...allLaps)
    const yMin = Math.min(...allVals)
    const yMax = Math.max(...allVals)

    const left = 52
    const right = 16
    const top = 20
    const bottom = 32
    const width = 980
    const height = 400
    const innerW = width - left - right
    const innerH = height - top - bottom

    const paths = series.map((item) => {
      const d = item.laps
        .map((lap, idx) => {
          const x = left + normalize(lap, xMin, xMax) * innerW
          const y = top + (1 - normalize(item.smoothed[idx], yMin, yMax)) * innerH
          return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
        })
        .join(' ')
      return { code: item.code, color: item.color, d }
    })

    const gradients = series.map((item) => {
      const points = item.laps.map((lap, idx) => ({
        x: left + normalize(lap, xMin, xMax) * innerW,
        y: top + (1 - normalize(item.smoothed[idx], yMin, yMax)) * innerH,
      }))
      return { code: item.code, color: item.color, points }
    })

    const pointSets = series.map((item) => ({
      code: item.code,
      color: item.color,
      points: item.laps.map((lap, idx) => ({
        x: left + normalize(lap, xMin, xMax) * innerW,
        y: top + (1 - normalize(item.smoothed[idx], yMin, yMax)) * innerH,
        lap,
        value: item.smoothed[idx]
      }))
    }))

    return { xMin, xMax, yMin, yMax, width, height, left, top, innerW, innerH, paths, pointSets, gradients }
  }, [series])

  if (!view) return <div className="flex h-[360px] items-center justify-center text-sm text-text-muted">No race-pace data</div>

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!view) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * view.width
    const py = ((event.clientY - rect.top) / rect.height) * view.height
    let best: typeof hover | null = null
    let bestD2 = Number.POSITIVE_INFINITY
    for (const set of view.pointSets) {
      for (const point of set.points) {
        const dx = point.x - px
        const dy = point.y - py
        const d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
          bestD2 = d2
          best = {
            x: point.x,
            y: point.y,
            screenX: event.clientX - rect.left,
            screenY: event.clientY - rect.top,
            code: set.code,
            lap: point.lap,
            value: point.value,
            color: set.color
          }
        }
      }
    }
    if (best && bestD2 <= 16 * 16) setHover(best)
    else setHover(null)
  }

  const activeCode = hover?.code ?? null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        className="h-[400px] w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="racePaceChartBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c1222" />
            <stop offset="50%" stopColor="#0a0f1a" />
            <stop offset="100%" stopColor="#070b12" />
          </linearGradient>
          {view.gradients.map((grad, idx) => (
            <linearGradient key={grad.code} id={`racePaceGrad${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={grad.color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={grad.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect x="0" y="0" width={view.width} height={view.height} fill="url(#racePaceChartBg)" />
        
        {[0.25, 0.5, 0.75].map((tick) => (
          <line 
            key={`h-${tick}`}
            x1={view.left} 
            y1={view.top + view.innerH * (1 - tick)} 
            x2={view.left + view.innerW} 
            y2={view.top + view.innerH * (1 - tick)} 
            stroke={CHART_COLORS.gridLine} 
            strokeDasharray="4,4"
          />
        ))}
        {[0.25, 0.5, 0.75].map((tick) => (
          <line 
            key={`v-${tick}`}
            x1={view.left + view.innerW * tick} 
            y1={view.top} 
            x2={view.left + view.innerW * tick} 
            y2={view.top + view.innerH} 
            stroke={CHART_COLORS.gridLine} 
            strokeDasharray="4,4"
          />
        ))}
        
        <line x1={view.left} y1={view.top + view.innerH} x2={view.left + view.innerW} y2={view.top + view.innerH} stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" />
        <line x1={view.left} y1={view.top} x2={view.left} y2={view.top + view.innerH} stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" />
        
        {view.paths.map((path) => {
          const isActive = activeCode === path.code
          const gradIdx = series.findIndex(s => s.code === path.code)
          return (
            <g key={path.code}>
              <path
                d={path.d}
                fill="none"
                stroke={`url(#racePaceGrad${gradIdx})`}
                strokeWidth={isActive ? 14 : 8}
                opacity={isActive ? 0.15 : 0.05}
                strokeLinecap="round"
              />
              <path
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth={isActive ? 2.8 : 2}
                opacity={activeCode && activeCode !== path.code ? 0.18 : 0.95}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={isActive ? 'url(#glow)' : 'none'}
                style={{ transition: 'opacity 0.2s ease, stroke-width 0.2s ease' }}
              />
            </g>
          )
        })}
        
        {hover && (
          <>
            <circle cx={hover.x} cy={hover.y} r={12} fill={hover.color} fillOpacity="0.15" />
            <circle cx={hover.x} cy={hover.y} r={6} fill={hover.color} stroke="#f1f5f9" strokeWidth="1.5" filter="url(#glow)" />
            <circle cx={hover.x} cy={hover.y} r={16} fill="none" stroke={hover.color} strokeWidth="1" strokeOpacity="0.4" />
          </>
        )}
        
        <text x={view.left + 6} y={14} fill={CHART_COLORS.axisLabel} fontSize="11" fontWeight="500">Lap Time (s)</text>
        <text x={view.left + view.innerW - 32} y={view.top + view.innerH + 22} fill={CHART_COLORS.axisLabel} fontSize="11" fontWeight="500">Lap</text>
        
        <text x={view.left + 4} y={view.top + 14} fill={CHART_COLORS.axisLabel} fontSize="10" opacity="0.7">{formatLapTime(view.yMax)}</text>
        <text x={view.left + 4} y={view.top + view.innerH - 2} fill={CHART_COLORS.axisLabel} fontSize="10" opacity="0.7">{formatLapTime(view.yMin)}</text>
        <text x={view.left} y={view.top + view.innerH + 18} fill={CHART_COLORS.axisLabel} fontSize="10" opacity="0.7">{Math.round(view.xMin)}</text>
        <text x={view.left + view.innerW - 16} y={view.top + view.innerH + 18} fill={CHART_COLORS.axisLabel} fontSize="10" opacity="0.7">{Math.round(view.xMax)}</text>
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm"
          style={{ 
            left: Math.min(hover.screenX + 16, view.width - 150), 
            top: Math.max(hover.screenY - 36, 8),
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 20px ${hover.color}25`
          }}
        >
          <div className="flex items-center gap-2 font-mono font-semibold text-fg-primary">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hover.color, boxShadow: `0 0 8px ${hover.color}` }} />
            {hover.code} · Lap {hover.lap}
          </div>
          <div className="mt-1 font-mono text-fg-secondary">{formatLapTime(hover.value)}s</div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {series.map((item, idx) => {
          const isActive = activeCode === item.code
          return (
            <span 
              key={item.code} 
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-all duration-200 ${
                isActive 
                  ? 'border-white/20 bg-white/10 shadow-lg' 
                  : 'border-white/5 bg-black/20 text-fg-muted hover:border-white/15 hover:bg-black/30'
              }`}
            >
              <span 
                className="h-2 w-2 rounded-full" 
                style={{ 
                  backgroundColor: item.color,
                  boxShadow: isActive ? `0 0 8px ${item.color}` : 'none'
                }} 
              />
              <span className={isActive ? 'text-fg-primary font-medium' : ''}>{item.code}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function SeasonStandingsLiteChart(props: { drivers: StandingsSeries[]; raceCount: number }) {
  return (
    <ChartErrorBoundary>
      <SeasonStandingsLiteChartInner {...props} />
    </ChartErrorBoundary>
  )
}

function SeasonStandingsLiteChartInner({ drivers, raceCount }: { drivers: StandingsSeries[]; raceCount: number }) {
  const [hover, setHover] = useState<{
    x: number
    y: number
    screenX: number
    screenY: number
    code: string
    race: number
    points: number
    color: string
  } | null>(null)

  const view = useMemo(() => {
    if (!drivers.length) return null

    const yValues = drivers.flatMap((d) => d.cumulative)
    if (!yValues.length) return null

    const xMin = 1
    const xMax = Math.max(1, raceCount)
    const yMin = 0
    const yMax = Math.max(1, ...yValues)

    const left = 52
    const right = 16
    const top = 20
    const bottom = 32
    const width = 980
    const height = 360
    const innerW = width - left - right
    const innerH = height - top - bottom

    const paths = drivers.map((driver) => {
      const d = driver.cumulative
        .map((value, idx) => {
          const raceIndex = idx + 1
          const x = left + normalize(raceIndex, xMin, xMax) * innerW
          const y = top + (1 - normalize(value, yMin, yMax)) * innerH
          return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
        })
        .join(' ')
      return { code: driver.code, color: driver.color, d }
    })

    const gradients = drivers.map((driver, idx) => ({
      code: driver.code,
      color: driver.color,
      id: `standingsGrad${idx}`
    }))

    const pointSets = drivers.map((driver) => ({
      code: driver.code,
      color: driver.color,
      points: driver.cumulative.map((value, idx) => ({
        x: left + normalize(idx + 1, xMin, xMax) * innerW,
        y: top + (1 - normalize(value, yMin, yMax)) * innerH,
        race: idx + 1,
        points: value
      }))
    }))

    return { xMin, xMax, yMin, yMax, width, height, left, top, innerW, innerH, paths, pointSets, gradients }
  }, [drivers, raceCount])

  if (!view) return <div className="flex h-[340px] items-center justify-center text-sm text-text-muted">No standings data</div>

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!view) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * view.width
    const py = ((event.clientY - rect.top) / rect.height) * view.height
    let best: typeof hover | null = null
    let bestD2 = Number.POSITIVE_INFINITY
    for (const set of view.pointSets) {
      for (const point of set.points) {
        const dx = point.x - px
        const dy = point.y - py
        const d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
          bestD2 = d2
          best = {
            x: point.x,
            y: point.y,
            screenX: event.clientX - rect.left,
            screenY: event.clientY - rect.top,
            code: set.code,
            race: point.race,
            points: point.points,
            color: set.color
          }
        }
      }
    }
    if (best && bestD2 <= 16 * 16) setHover(best)
    else setHover(null)
  }

  const activeCode = hover?.code ?? null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        className="h-[360px] w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="standingsChartBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c1222" />
            <stop offset="50%" stopColor="#0a0f1a" />
            <stop offset="100%" stopColor="#070b12" />
          </linearGradient>
          {view.gradients.map((grad, idx) => (
            <linearGradient key={grad.code} id={`standingsGrad${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={grad.color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={grad.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
          <filter id="standingsGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect x="0" y="0" width={view.width} height={view.height} fill="url(#standingsChartBg)" />
        
        {[0.25, 0.5, 0.75].map((tick) => (
          <line 
            key={`h-${tick}`}
            x1={view.left} 
            y1={view.top + view.innerH * (1 - tick)} 
            x2={view.left + view.innerW} 
            y2={view.top + view.innerH * (1 - tick)} 
            stroke={CHART_COLORS.gridLine} 
            strokeDasharray="4,4"
          />
        ))}
        
        <line x1={view.left} y1={view.top + view.innerH} x2={view.left + view.innerW} y2={view.top + view.innerH} stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" />
        <line x1={view.left} y1={view.top} x2={view.left} y2={view.top + view.innerH} stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" />
        
        {view.paths.map((path, idx) => {
          const isActive = activeCode === path.code
          return (
            <g key={path.code}>
              <path
                d={path.d}
                fill="none"
                stroke={`url(#standingsGrad${idx})`}
                strokeWidth={isActive ? 12 : 6}
                opacity={isActive ? 0.2 : 0.08}
                strokeLinecap="round"
              />
              <path
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth={isActive ? 2.6 : 1.8}
                opacity={activeCode && activeCode !== path.code ? 0.2 : 0.92}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={isActive ? 'url(#standingsGlow)' : 'none'}
              />
            </g>
          )
        })}
        
        {hover && (
          <>
            <circle cx={hover.x} cy={hover.y} r={12} fill={hover.color} fillOpacity="0.15" />
            <circle cx={hover.x} cy={hover.y} r={5} fill={hover.color} stroke="#f1f5f9" strokeWidth="1.5" filter="url(#standingsGlow)" />
            <circle cx={hover.x} cy={hover.y} r={14} fill="none" stroke={hover.color} strokeWidth="1" strokeOpacity="0.4" />
          </>
        )}
        
        <text x={view.left + 6} y={14} fill={CHART_COLORS.axisLabel} fontSize="11" fontWeight="500">Cumulative Points</text>
        <text x={view.left + view.innerW - 48} y={view.top + view.innerH + 22} fill={CHART_COLORS.axisLabel} fontSize="11" fontWeight="500">Race Index</text>
        
        <text x={view.left + 4} y={view.top + view.innerH - 4} fill={CHART_COLORS.axisLabel} fontSize="10" opacity="0.7">0</text>
        <text x={view.left + 4} y={view.top + 14} fill={CHART_COLORS.axisLabel} fontSize="10" opacity="0.7">{Math.round(view.yMax)}</text>
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm"
          style={{ 
            left: Math.min(hover.screenX + 16, view.width - 160), 
            top: Math.max(hover.screenY - 36, 8),
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 20px ${hover.color}25`
          }}
        >
          <div className="flex items-center gap-2 font-mono font-semibold text-fg-primary">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hover.color, boxShadow: `0 0 8px ${hover.color}` }} />
            {hover.code} · R{hover.race}
          </div>
          <div className="mt-1 font-mono text-fg-secondary">{hover.points.toFixed(1)} pts</div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {drivers.map((driver, idx) => {
          const isActive = activeCode === driver.code
          return (
            <span 
              key={driver.code} 
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-all duration-200 ${
                isActive 
                  ? 'border-white/20 bg-white/10 shadow-lg' 
                  : 'border-white/5 bg-black/20 text-fg-muted hover:border-white/15 hover:bg-black/30'
              }`}
            >
              <span 
                className="h-2 w-2 rounded-full" 
                style={{ 
                  backgroundColor: driver.color,
                  boxShadow: isActive ? `0 0 8px ${driver.color}` : 'none'
                }} 
              />
              <span className={isActive ? 'text-fg-primary font-medium' : ''}>{driver.code}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function StandingsHeatmapLiteChart(props: { raceNames: string[]; drivers: StandingsHeatmapRow[] }) {
  return (
    <ChartErrorBoundary>
      <StandingsHeatmapLiteChartInner {...props} />
    </ChartErrorBoundary>
  )
}

function StandingsHeatmapLiteChartInner({ raceNames, drivers }: { raceNames: string[]; drivers: StandingsHeatmapRow[] }) {
  if (!raceNames.length || !drivers.length) {
    return <div className="flex h-[300px] items-center justify-center text-sm text-text-muted">No standings heatmap data</div>
  }

  const maxPoint = Math.max(1, ...drivers.flatMap((driver) => driver.byRace.map((v) => Number(v) || 0)))
  const [hover, setHover] = useState<{ driver: string; race: string; points: number; color: string } | null>(null)

  const color = (value: number) => {
    const t = clamp01(value / maxPoint)
    const r = Math.round(15 + t * 45)
    const g = Math.round(23 + t * 65)
    const b = Math.round(45 + t * 85)
    return `rgb(${r}, ${g}, ${b})`
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border border-white/5 bg-[#080b14] p-3 shadow-inner">
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `100px repeat(${raceNames.length}, minmax(38px, 1fr))`,
          minWidth: `${100 + raceNames.length * 42}px`,
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted pl-1">Driver</div>
        {raceNames.map((_race, idx) => (
          <div key={`h-head-${idx}`} className="text-center text-[10px] font-medium text-fg-muted/70">R{idx + 1}</div>
        ))}

        {drivers.map((driver) => (
          <Fragment key={`h-row-${driver.code}`}>
            <div className="flex items-center gap-2 pl-1 text-[11px] font-mono font-medium text-fg-primary">
              <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: driver.color, boxShadow: `0 0 6px ${driver.color}80` }} />
              <span>{driver.code}</span>
              <span className="text-fg-muted/60 text-[10px]">({driver.totalPoints.toFixed(0)})</span>
            </div>
            {driver.byRace.map((value, idx) => {
              const n = Number(value) || 0
              const raceLabel = raceNames[idx] || `R${idx + 1}`
              const cellColor = color(n)
              const isHighlighted = hover?.driver === driver.code && hover?.race === raceLabel
              return (
                <div
                  key={`h-${driver.code}-${idx}`}
                  className={`flex h-8 items-center justify-center rounded-md text-[11px] font-mono font-medium transition-all duration-150 cursor-pointer ${
                    isHighlighted ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-transparent scale-105 z-10' : ''
                  }`}
                  style={{ 
                    backgroundColor: cellColor,
                    color: n > maxPoint * 0.6 ? '#f1f5f9' : '#cbd5e1',
                    textShadow: n > maxPoint * 0.5 ? '0 1px 2px rgba(0,0,0,0.4)' : 'none'
                  }}
                  onMouseEnter={() => setHover({ driver: driver.code, race: raceLabel, points: n, color: cellColor })}
                  onMouseLeave={() => setHover(null)}
                  title={`${driver.code} | ${raceLabel} | ${n.toFixed(0)} pts`}
                >
                  {n > 0 ? n.toFixed(0) : '-'}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      {hover && (
        <div 
          className="pointer-events-none absolute z-50 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm"
          style={{ 
            right: 12, 
            top: 12,
            boxShadow: `0 4px 20px rgba(0,0,0,0.5)`
          }}
        >
          <div className="font-mono font-semibold text-fg-primary">{hover.driver} · {hover.race}</div>
          <div className="mt-1 font-mono text-fg-secondary">{hover.points.toFixed(0)} pts</div>
        </div>
      )}
    </div>
  )
}
