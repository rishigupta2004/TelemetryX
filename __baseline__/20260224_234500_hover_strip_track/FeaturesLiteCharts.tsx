import { Fragment, useMemo } from 'react'

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
  byRace: number[]
  totalPoints: number
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function normalize(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  if (Math.abs(max - min) < 1e-9) return 0
  return clamp01((n - min) / (max - min))
}

function formatLapTime(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value < 60) return `${value.toFixed(3)}s`
  const mins = Math.floor(value / 60)
  const secs = value % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

export function RacePaceLiteChart({ series }: { series: RacePaceSeries[] }) {
  const view = useMemo(() => {
    if (!series.length) return null

    const allLaps = series.flatMap((item) => item.laps)
    const allVals = series.flatMap((item) => item.smoothed)
    if (!allLaps.length || !allVals.length) return null

    const xMin = Math.min(...allLaps)
    const xMax = Math.max(...allLaps)
    const yMin = Math.min(...allVals)
    const yMax = Math.max(...allVals)

    const left = 42
    const right = 12
    const top = 14
    const bottom = 24
    const width = 980
    const height = 420
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

    return { xMin, xMax, yMin, yMax, width, height, left, top, innerW, innerH, paths }
  }, [series])

  if (!view) return <div className="flex h-[360px] items-center justify-center text-sm text-text-muted">No race-pace data</div>

  return (
    <div>
      <svg viewBox={`0 0 ${view.width} ${view.height}`} className="h-[420px] w-full">
        <rect x="0" y="0" width={view.width} height={view.height} fill="#0e1014" />
        <line x1={view.left} y1={view.top + view.innerH} x2={view.left + view.innerW} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        <line x1={view.left} y1={view.top} x2={view.left} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        {view.paths.map((path) => (
          <path key={path.code} d={path.d} fill="none" stroke={path.color} strokeWidth="2.4" opacity="0.92" vectorEffect="non-scaling-stroke" />
        ))}
        <text x={view.left + 4} y={12} fill="rgba(226,232,240,0.9)" fontSize="11">Lap Time (s)</text>
        <text x={view.left + view.innerW - 40} y={view.top + view.innerH + 18} fill="rgba(226,232,240,0.9)" fontSize="11">Lap</text>
        <text x={view.left + 2} y={view.top + 12} fill="rgba(232,238,246,0.9)" fontSize="11">{formatLapTime(view.yMax)}</text>
        <text x={view.left + 2} y={view.top + view.innerH - 2} fill="rgba(232,238,246,0.9)" fontSize="11">{formatLapTime(view.yMin)}</text>
        <text x={view.left} y={view.top + view.innerH + 16} fill="rgba(232,238,246,0.9)" fontSize="11">{Math.round(view.xMin)}</text>
        <text x={view.left + view.innerW - 18} y={view.top + view.innerH + 16} fill="rgba(232,238,246,0.9)" fontSize="11">{Math.round(view.xMax)}</text>
      </svg>

      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
        {series.map((item) => (
          <span key={item.code} className="inline-flex items-center gap-1 rounded border border-white/10 bg-black/25 px-1.5 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.code}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SeasonStandingsLiteChart({ drivers, raceCount }: { drivers: StandingsSeries[]; raceCount: number }) {
  const view = useMemo(() => {
    if (!drivers.length) return null

    const yValues = drivers.flatMap((d) => d.cumulative)
    if (!yValues.length) return null

    const xMin = 1
    const xMax = Math.max(1, raceCount)
    const yMin = 0
    const yMax = Math.max(1, ...yValues)

    const left = 44
    const right = 12
    const top = 14
    const bottom = 24
    const width = 980
    const height = 380
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

    return { xMin, xMax, yMin, yMax, width, height, left, top, innerW, innerH, paths }
  }, [drivers, raceCount])

  if (!view) return <div className="flex h-[340px] items-center justify-center text-sm text-text-muted">No standings data</div>

  return (
    <div>
      <svg viewBox={`0 0 ${view.width} ${view.height}`} className="h-[380px] w-full">
        <rect x="0" y="0" width={view.width} height={view.height} fill="#0e1014" />
        <line x1={view.left} y1={view.top + view.innerH} x2={view.left + view.innerW} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        <line x1={view.left} y1={view.top} x2={view.left} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        {view.paths.map((path) => (
          <path key={path.code} d={path.d} fill="none" stroke={path.color} strokeWidth="2.4" opacity="0.92" vectorEffect="non-scaling-stroke" />
        ))}
        <text x={view.left + 4} y={12} fill="rgba(226,232,240,0.9)" fontSize="11">Cumulative Points</text>
        <text x={view.left + view.innerW - 54} y={view.top + view.innerH + 18} fill="rgba(226,232,240,0.9)" fontSize="11">Race Index</text>
      </svg>

      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
        {drivers.map((driver) => (
          <span key={driver.code} className="inline-flex items-center gap-1 rounded border border-white/10 bg-black/25 px-1.5 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: driver.color }} />
            {driver.code}
          </span>
        ))}
      </div>
    </div>
  )
}

export function StandingsHeatmapLiteChart({ raceNames, drivers }: { raceNames: string[]; drivers: StandingsHeatmapRow[] }) {
  if (!raceNames.length || !drivers.length) {
    return <div className="flex h-[300px] items-center justify-center text-sm text-text-muted">No standings heatmap data</div>
  }

  const maxPoint = Math.max(1, ...drivers.flatMap((driver) => driver.byRace.map((v) => Number(v) || 0)))

  const color = (value: number) => {
    const t = clamp01(value / maxPoint)
    const r = Math.round(28 + t * 90)
    const g = Math.round(30 + t * 88)
    const b = Math.round(34 + t * 95)
    return `rgb(${r}, ${g}, ${b})`
  }

  return (
    <div className="overflow-x-auto rounded border border-white/10 bg-[#0e1014] p-2">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `110px repeat(${raceNames.length}, minmax(36px, 1fr))`,
          minWidth: `${110 + raceNames.length * 40}px`,
        }}
      >
        <div className="text-[11px] text-text-muted">Driver</div>
        {raceNames.map((_race, idx) => (
          <div key={`h-head-${idx}`} className="text-center text-[11px] text-text-muted">R{idx + 1}</div>
        ))}

        {drivers.map((driver) => (
          <Fragment key={`h-row-${driver.code}`}>
            <div className="flex items-center gap-1 text-[11px] font-mono text-text-primary">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: driver.color }} />
              <span>{driver.code}</span>
              <span className="text-text-muted">({driver.totalPoints.toFixed(0)})</span>
            </div>
            {driver.byRace.map((value, idx) => {
              const n = Number(value) || 0
              return (
                <div
                  key={`h-${driver.code}-${idx}`}
                  className="flex h-7 items-center justify-center rounded text-[11px] font-mono text-[#e2e8f0]"
                  style={{ backgroundColor: color(n) }}
                  title={`${driver.code} | ${raceNames[idx] || `R${idx + 1}`} | ${n.toFixed(0)} pts`}
                >
                  {n > 0 ? n.toFixed(0) : '-'}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
