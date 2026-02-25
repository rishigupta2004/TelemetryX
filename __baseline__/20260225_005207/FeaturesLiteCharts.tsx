import { Fragment, useMemo, useState } from 'react'

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

    return { xMin, xMax, yMin, yMax, width, height, left, top, innerW, innerH, paths, pointSets }
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
    if (best && bestD2 <= 14 * 14) setHover(best)
    else setHover(null)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        className="h-[420px] w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect x="0" y="0" width={view.width} height={view.height} fill="#0e1014" />
        <line x1={view.left} y1={view.top + view.innerH} x2={view.left + view.innerW} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        <line x1={view.left} y1={view.top} x2={view.left} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        {view.paths.map((path) => (
          <path key={path.code} d={path.d} fill="none" stroke={path.color} strokeWidth="2.4" opacity="0.92" vectorEffect="non-scaling-stroke" />
        ))}
        {hover && (
          <>
            <circle cx={hover.x} cy={hover.y} r={4.5} fill={hover.color} stroke="#eef2f7" strokeWidth="1.2" />
            <circle cx={hover.x} cy={hover.y} r={9} fill="none" stroke="rgba(238,242,247,0.3)" strokeWidth="1" />
          </>
        )}
        <text x={view.left + 4} y={12} fill="rgba(226,232,240,0.9)" fontSize="11">Lap Time (s)</text>
        <text x={view.left + view.innerW - 40} y={view.top + view.innerH + 18} fill="rgba(226,232,240,0.9)" fontSize="11">Lap</text>
        <text x={view.left + 2} y={view.top + 12} fill="rgba(232,238,246,0.9)" fontSize="11">{formatLapTime(view.yMax)}</text>
        <text x={view.left + 2} y={view.top + view.innerH - 2} fill="rgba(232,238,246,0.9)" fontSize="11">{formatLapTime(view.yMin)}</text>
        <text x={view.left} y={view.top + view.innerH + 16} fill="rgba(232,238,246,0.9)" fontSize="11">{Math.round(view.xMin)}</text>
        <text x={view.left + view.innerW - 18} y={view.top + view.innerH + 16} fill="rgba(232,238,246,0.9)" fontSize="11">{Math.round(view.xMax)}</text>
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute rounded border border-white/10 bg-black/70 px-2 py-1 text-[11px] text-text-primary"
          style={{ left: Math.min(hover.screenX + 12, view.width - 140), top: Math.max(hover.screenY - 28, 6) }}
        >
          <div className="font-mono">{hover.code} · Lap {hover.lap}</div>
          <div className="text-text-muted">{formatLapTime(hover.value)}</div>
        </div>
      )}

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

    return { xMin, xMax, yMin, yMax, width, height, left, top, innerW, innerH, paths, pointSets }
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
    if (best && bestD2 <= 14 * 14) setHover(best)
    else setHover(null)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        className="h-[380px] w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect x="0" y="0" width={view.width} height={view.height} fill="#0e1014" />
        <line x1={view.left} y1={view.top + view.innerH} x2={view.left + view.innerW} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        <line x1={view.left} y1={view.top} x2={view.left} y2={view.top + view.innerH} stroke="rgba(200,210,220,0.2)" />
        {view.paths.map((path) => (
          <path key={path.code} d={path.d} fill="none" stroke={path.color} strokeWidth="2.4" opacity="0.92" vectorEffect="non-scaling-stroke" />
        ))}
        {hover && (
          <>
            <circle cx={hover.x} cy={hover.y} r={4.5} fill={hover.color} stroke="#eef2f7" strokeWidth="1.2" />
            <circle cx={hover.x} cy={hover.y} r={9} fill="none" stroke="rgba(238,242,247,0.3)" strokeWidth="1" />
          </>
        )}
        <text x={view.left + 4} y={12} fill="rgba(226,232,240,0.9)" fontSize="11">Cumulative Points</text>
        <text x={view.left + view.innerW - 54} y={view.top + view.innerH + 18} fill="rgba(226,232,240,0.9)" fontSize="11">Race Index</text>
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute rounded border border-white/10 bg-black/70 px-2 py-1 text-[11px] text-text-primary"
          style={{ left: Math.min(hover.screenX + 12, view.width - 160), top: Math.max(hover.screenY - 28, 6) }}
        >
          <div className="font-mono">{hover.code} · R{hover.race}</div>
          <div className="text-text-muted">{hover.points.toFixed(1)} pts</div>
        </div>
      )}

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
  const [hover, setHover] = useState<{ driver: string; race: string; points: number } | null>(null)

  const color = (value: number) => {
    const t = clamp01(value / maxPoint)
    const r = Math.round(28 + t * 90)
    const g = Math.round(30 + t * 88)
    const b = Math.round(34 + t * 95)
    return `rgb(${r}, ${g}, ${b})`
  }

  return (
    <div className="relative overflow-x-auto rounded border border-white/10 bg-[#0e1014] p-2">
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
              const raceLabel = raceNames[idx] || `R${idx + 1}`
              return (
                <div
                  key={`h-${driver.code}-${idx}`}
                  className="flex h-7 items-center justify-center rounded text-[11px] font-mono text-[#e2e8f0]"
                  style={{ backgroundColor: color(n) }}
                  onMouseEnter={() => setHover({ driver: driver.code, race: raceLabel, points: n })}
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
        <div className="pointer-events-none absolute right-3 top-3 rounded border border-white/10 bg-black/70 px-2 py-1 text-[11px] text-text-primary">
          <div className="font-mono">{hover.driver} · {hover.race}</div>
          <div className="text-text-muted">{hover.points.toFixed(0)} pts</div>
        </div>
      )}
    </div>
  )
}
