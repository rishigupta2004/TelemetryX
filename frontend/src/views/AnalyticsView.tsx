import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { buildPaceSeries, buildTyreTimeline, movingAverage, median, quantile, tyreColor, linearSlope } from '../lib/featuresUtils'
import type { PaceSeries, TyreStintRow } from '../lib/featuresUtils'
import type { LapRow, Driver } from '../types'

// ─── types ───────────────────────────────────────────────────────────────────

interface BoxStats {
  code: string
  color: string
  q1: number
  q3: number
  median: number
  mean: number
  whiskerLo: number
  whiskerHi: number
  outliers: number[]
  laps: number[]
  times: number[]
}

const ChartDefs = () => (
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
)

interface SectorData {
  code: string
  color: string
  avgS1: number
  avgS2: number
  avgS3: number
  bestS1: number
  bestS2: number
  bestS3: number
  avgTotal: number
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildBoxStats(series: PaceSeries[]): BoxStats[] {
  return series
    .map((s) => {
      const vals = s.times.filter((v) => Number.isFinite(v) && v > 40 && v < 200)
      if (vals.length < 3) return null
      const sorted = [...vals].sort((a, b) => a - b)
      const q1v = quantile(sorted, 0.25)
      const q3v = quantile(sorted, 0.75)
      const iqr = q3v - q1v
      const loFence = q1v - 1.5 * iqr
      const hiFence = q3v + 1.5 * iqr
      const inliers = sorted.filter((v) => v >= loFence && v <= hiFence)
      const outliers = sorted.filter((v) => v < loFence || v > hiFence)
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      return {
        code: s.code,
        color: s.color,
        q1: q1v,
        q3: q3v,
        median: median(vals),
        mean,
        whiskerLo: inliers.length ? Math.min(...inliers) : q1v,
        whiskerHi: inliers.length ? Math.max(...inliers) : q3v,
        outliers,
        laps: s.laps,
        times: s.smoothed,
      }
    })
    .filter((x): x is BoxStats => x !== null)
    .sort((a, b) => a.median - b.median)
}

function buildSectorData(laps: LapRow[], drivers: Driver[]): SectorData[] {
  const numberToDriver = new Map<number, Driver>()
  for (const d of drivers) numberToDriver.set(d.driverNumber, d)

  const buckets = new Map<string, { s1: number[]; s2: number[]; s3: number[]; color: string }>()

  for (const lap of laps) {
    const driver = numberToDriver.get(lap.driverNumber)
    const code = driver?.code || String(lap.driverName || lap.driverNumber)
    if (!code) continue

    const s1 = Number(lap.sector1)
    const s2 = Number(lap.sector2)
    const s3 = Number(lap.sector3)

    // Filter out outlier sector times
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || !Number.isFinite(s3)) continue
    if (s1 <= 0 || s2 <= 0 || s3 <= 0 || s1 > 120 || s2 > 120 || s3 > 120) continue

    let bucket = buckets.get(code)
    if (!bucket) {
      bucket = { s1: [], s2: [], s3: [], color: driver?.teamColor || '#8aa7d1' }
      buckets.set(code, bucket)
    }
    bucket.s1.push(s1)
    bucket.s2.push(s2)
    bucket.s3.push(s3)
  }

  const out: SectorData[] = []
  for (const [code, data] of buckets) {
    if (data.s1.length < 3) continue
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const best = (arr: number[]) => Math.min(...arr)
    out.push({
      code,
      color: data.color,
      avgS1: avg(data.s1),
      avgS2: avg(data.s2),
      avgS3: avg(data.s3),
      bestS1: best(data.s1),
      bestS2: best(data.s2),
      bestS3: best(data.s3),
      avgTotal: avg(data.s1) + avg(data.s2) + avg(data.s3),
    })
  }
  return out.sort((a, b) => a.avgTotal - b.avgTotal)
}

function fmtTime(s: number) {
  if (!Number.isFinite(s) || s <= 0) return '—'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(3).padStart(6, '0')
  return `${m}:${sec}`
}

function fmtSeconds(s: number) {
  if (!Number.isFinite(s) || s <= 0) return '—'
  return s.toFixed(3)
}

// ─── Info Tooltip ────────────────────────────────────────────────────────────

function InfoTooltip({ title, children }: { title: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative z-50 inline-flex flex-shrink-0 items-center ml-2" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <svg className="w-3.5 h-3.5 text-slate-500 hover:text-white cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {show && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 z-[100] p-3 border border-white/10 rounded-lg shadow-2xl backdrop-blur-md bg-[#0a0b0f]/95 pointer-events-none">
          <div className="text-[11px] font-bold text-white mb-1.5 tracking-wider uppercase">{title}</div>
          <div className="text-[10px] text-slate-300 leading-relaxed font-sans normal-case tracking-normal">{children}</div>
        </div>
      )}
    </div>
  )
}

// ─── BoxPlot SVG ─────────────────────────────────────────────────────────────

function BoxPlotChart({ stats }: { stats: BoxStats[] }) {
  const [hovered, setHovered] = useState<string | null>(null)

  const allVals = stats.flatMap((s) => [s.whiskerLo, s.whiskerHi, ...s.outliers])
  const yMin = allVals.length ? Math.min(...allVals) - 0.5 : 80
  const yMax = allVals.length ? Math.max(...allVals) + 0.5 : 100

  const W = 900, H = 340
  const padL = 56, padR = 16, padT = 16, padB = 40
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const ySpan = Math.max(0.01, yMax - yMin)

  const py = (v: number) => padT + (1 - (v - yMin) / ySpan) * innerH
  const bw = Math.max(12, Math.min(40, (innerW / Math.max(1, stats.length)) * 0.55))
  const cx = (i: number) => padL + (i + 0.5) * (innerW / Math.max(1, stats.length))

  const yTicks = 5
  const tickVals = Array.from({ length: yTicks }, (_, i) => yMin + (yMax - yMin) * (i / (yTicks - 1)))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[340px]">
        <ChartDefs />
        <rect x={0} y={0} width={W} height={H} fill="#0a0b0f" />
        {tickVals.map((tv) => (
          <g key={tv}>
            <line x1={padL} y1={py(tv)} x2={padL + innerW} y2={py(tv)}
              stroke="rgba(100,116,139,0.15)" strokeWidth={1} />
            <text x={padL - 6} y={py(tv) + 4} fill="rgba(148,163,184,0.8)"
              fontSize={10} textAnchor="end">{fmtTime(tv)}</text>
          </g>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH}
          stroke="rgba(100,116,139,0.4)" strokeWidth={1.5} />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH}
          stroke="rgba(100,116,139,0.4)" strokeWidth={1.5} />

        {stats.map((s, i) => {
          const x = cx(i)
          const isH = hovered === s.code
          const alpha = hovered && !isH ? 0.3 : 1
          return (
            <g key={s.code} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(s.code)}
              onMouseLeave={() => setHovered(null)}>
              <line x1={x} y1={py(s.whiskerLo)} x2={x} y2={py(s.q1)}
                stroke={s.color} strokeWidth={1.5} opacity={alpha} />
              <line x1={x} y1={py(s.q3)} x2={x} y2={py(s.whiskerHi)}
                stroke={s.color} strokeWidth={1.5} opacity={alpha} />
              <line x1={x - bw * 0.25} y1={py(s.whiskerLo)} x2={x + bw * 0.25} y2={py(s.whiskerLo)}
                stroke={s.color} strokeWidth={1.5} opacity={alpha} />
              <line x1={x - bw * 0.25} y1={py(s.whiskerHi)} x2={x + bw * 0.25} y2={py(s.whiskerHi)}
                stroke={s.color} strokeWidth={1.5} opacity={alpha} />
              <rect x={x - bw / 2} y={py(s.q3)} width={bw} height={Math.max(1, py(s.q1) - py(s.q3))}
                fill={`${s.color}22`} stroke={s.color} strokeWidth={isH ? 2 : 1.5} opacity={alpha} />
              <line x1={x - bw / 2} y1={py(s.median)} x2={x + bw / 2} y2={py(s.median)}
                stroke={s.color} strokeWidth={isH ? 3 : 2} opacity={alpha} />
              <line x1={x - bw / 2} y1={py(s.mean)} x2={x + bw / 2} y2={py(s.mean)}
                stroke={s.color} strokeWidth={1} strokeDasharray="4,3" opacity={alpha * 0.7} />
              {s.outliers.map((ov, oi) => (
                <circle key={oi} cx={x} cy={py(ov)} r={3}
                  fill="none" stroke={s.color} strokeWidth={1} opacity={alpha * 0.6} />
              ))}
              <text x={x} y={padT + innerH + 22} fill={isH ? '#fff' : 'rgba(148,163,184,0.8)'}
                fontSize={10} textAnchor="middle" fontWeight={isH ? 700 : 400}>{s.code}</text>
            </g>
          )
        })}
      </svg>
      {hovered && (() => {
        const s = stats.find((x) => x.code === hovered)
        if (!s) return null
        return (
          <div className="absolute top-4 right-4 bg-bg-surface/90 backdrop-blur-md border border-border-hard rounded-lg p-3 text-[11px] font-mono shadow-2xl pointer-events-none z-10 transition-all duration-200">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-micro">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-bold text-fg-primary text-[12px] uppercase">{s.code}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between gap-4 text-fg-secondary"><span>Median:</span><span className="text-fg-primary font-bold">{fmtTime(s.median)}</span></div>
              <div className="flex justify-between gap-4 text-fg-secondary"><span>Mean:</span><span className="text-fg-primary font-bold">{fmtTime(s.mean)}</span></div>
              <div className="flex justify-between gap-4 text-fg-muted mt-1 pt-1 border-t border-border-micro"><span>Q1:</span><span>{fmtTime(s.q1)}</span></div>
              <div className="flex justify-between gap-4 text-fg-muted"><span>Q3:</span><span>{fmtTime(s.q3)}</span></div>
              {s.outliers.length > 0 && (
                <div className="flex justify-between gap-4 text-fg-muted mt-1 pt-1 border-t border-border-micro"><span>Outliers:</span><span className="text-amber-warn">{s.outliers.length}</span></div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Pace lines SVG ──────────────────────────────────────────────────────────

function PaceLineChart({ series }: { series: PaceSeries[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null)

  const allLaps = series.flatMap((s) => s.laps)
  const allVals = series.flatMap((s) => s.smoothed).filter((v) => Number.isFinite(v) && v > 0)
  if (!allLaps.length || !allVals.length) {
    return <div className="flex items-center justify-center h-[240px] text-sm text-slate-500">No lap data</div>
  }

  const xMin = Math.min(...allLaps), xMax = Math.max(...allLaps)
  const yMin = Math.min(...allVals) - 0.3, yMax = Math.max(...allVals) + 0.3

  const W = 900, H = 240
  const padL = 56, padR = 16, padT = 12, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const px = (v: number) => padL + ((v - xMin) / Math.max(1, xMax - xMin)) * innerW
  const py = (v: number) => padT + (1 - (v - yMin) / Math.max(0.001, yMax - yMin)) * innerH

  const path = (s: PaceSeries) =>
    s.laps.map((lap, i) => {
      const v = s.smoothed[i]
      if (!Number.isFinite(v)) return ''
      return `${i === 0 ? 'M' : 'L'}${px(lap).toFixed(1)},${py(v).toFixed(1)}`
    }).filter(Boolean).join(' ')

  return (
    <div className="relative"
      onMouseLeave={() => { setHovered(null); setTip(null) }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const mx = ((e.clientX - rect.left) / rect.width) * W
          const my = ((e.clientY - rect.top) / rect.height) * H
          let best: string | null = null, bestD = Infinity
          for (const s of series) {
            for (let i = 0; i < s.laps.length; i++) {
              const v = s.smoothed[i]
              if (!Number.isFinite(v)) continue
              const dx = px(s.laps[i]) - mx, dy = py(v) - my
              const d = dx * dx + dy * dy
              if (d < bestD) { bestD = d; best = s.code }
            }
          }
          if (best && bestD < 400) {
            setHovered(best)
            setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: best })
          } else {
            setHovered(null); setTip(null)
          }
        }}>
        <ChartDefs />
        <rect x={0} y={0} width={W} height={H} fill="#0a0b0f" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} y1={padT + innerH * (1 - f)} x2={padL + innerW} y2={padT + innerH * (1 - f)}
            stroke="rgba(100,116,139,0.12)" strokeWidth={1} />
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH}
          stroke="rgba(100,116,139,0.35)" strokeWidth={1.5} />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH}
          stroke="rgba(100,116,139,0.35)" strokeWidth={1.5} />
        {series.map((s) => {
          const isH = hovered === s.code
          const op = hovered && !isH ? 0.2 : 0.9
          return (
            <path key={s.code} d={path(s)} fill="none"
              stroke={s.color} strokeWidth={isH ? 3 : 1.8}
              filter={isH ? "url(#glow)" : "none"}
              opacity={op} strokeLinecap="round" strokeLinejoin="round" />
          )
        })}
        <text x={padL} y={padT + innerH + 20} fill="rgba(148,163,184,0.7)" fontSize={10}>Lap {Math.round(xMin)}</text>
        <text x={padL + innerW} y={padT + innerH + 20} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="end">Lap {Math.round(xMax)}</text>
        <text x={padL - 6} y={padT + 8} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="end">{fmtTime(yMax)}</text>
        <text x={padL - 6} y={padT + innerH} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="end">{fmtTime(yMin)}</text>
      </svg>
      {tip && (
        <div className="absolute pointer-events-none bg-bg-surface/90 backdrop-blur-md border border-border-hard rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-bold shadow-xl flex items-center gap-2 z-10 transition-all duration-75"
          style={{ left: tip.x + 16, top: Math.max(8, tip.y - 12) }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: series.find(s => s.code === tip.label)?.color }} />
          <span className="text-fg-primary">{tip.label}</span>
        </div>
      )}
    </div>
  )
}

// ─── Race Pace tab ────────────────────────────────────────────────────────────

function RacePaceTab() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)

  const series = useMemo(() => {
    const data = sessionData ? { ...sessionData, laps: laps.length ? laps : sessionData.laps ?? [] } : null
    return buildPaceSeries(data)
  }, [sessionData, laps])

  const boxStats = useMemo(() => buildBoxStats(series), [series])

  if (!sessionData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        No session loaded
      </div>
    )
  }

  if (!series.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        No lap data available for this session
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Box plot */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-2 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Lap Time Distribution
          <InfoTooltip title="Lap Time Distribution">
            A box plot showing the consistency and spread of each driver's lap times. A narrower box means more consistent pace. The median line shows the typical race pace, while outlying dots represent pit laps, traffic, or safety cars.
          </InfoTooltip>
        </div>
        <div className="text-[10px] text-slate-500 mb-3">
          IQR box · median solid · mean dashed · outliers ○
        </div>
        <BoxPlotChart stats={boxStats} />
      </div>

      {/* Pace lines */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-2 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Race Pace (smoothed)
          <InfoTooltip title="Smoothed Race Pace">
            Lap-by-lap pace using a moving average to smooth out minor fluctuations. Lower lines indicate faster pace. Use this to identify when drivers hit the tyre cliff or start losing time on aging rubber. Hover over the lines to see exact values.
          </InfoTooltip>
        </div>
        <PaceLineChart series={series} />
        {/* legend */}
        <div className="flex flex-wrap gap-2 mt-2">
          {series.map((s) => (
            <span key={s.code} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.code}
            </span>
          ))}
        </div>
      </div>

      {/* Summary table */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Summary
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-white/8">
                {['Driver', 'Median', 'Mean', 'Q1', 'Q3', 'Laps'].map((h) => (
                  <th key={h} className="py-1 px-2 text-left text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boxStats.map((s) => (
                <tr key={s.code} className="border-b border-white/4 hover:bg-white/3">
                  <td className="py-1.5 px-2 font-bold" style={{ color: s.color }}>{s.code}</td>
                  <td className="py-1.5 px-2 text-slate-200">{fmtTime(s.median)}</td>
                  <td className="py-1.5 px-2 text-slate-300">{fmtTime(s.mean)}</td>
                  <td className="py-1.5 px-2 text-slate-400">{fmtTime(s.q1)}</td>
                  <td className="py-1.5 px-2 text-slate-400">{fmtTime(s.q3)}</td>
                  <td className="py-1.5 px-2 text-slate-500">{s.laps.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tyre Degradation tab ────────────────────────────────────────────────────

function TyreDegTab() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)
  const [hovered, setHovered] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; label: string; lap: number; time: number } | null>(null)

  const tyreTimeline = useMemo(() => {
    if (!sessionData?.drivers) return []
    const lapData = laps.length ? laps : sessionData.laps ?? []
    return buildTyreTimeline(lapData, sessionData.drivers.map((d) => ({
      code: d.code, driverNumber: d.driverNumber, teamColor: d.teamColor || '#8aa7d1'
    })))
  }, [sessionData, laps])

  // Compute tyre wear curve per compound
  const degradationData = useMemo(() => {
    if (!sessionData?.drivers) return { byCompound: new Map<string, { lapInStint: number[]; times: number[]; smoothed: number[] }>() }
    const lapData = laps.length ? laps : sessionData.laps ?? []
    const numberToDriver = new Map<number, Driver>()
    for (const d of sessionData.drivers) numberToDriver.set(d.driverNumber, d)

    // Group laps by compound & stint-relative lap
    const byCompound = new Map<string, { lapInStint: number[]; times: number[] }>()
    const byDriver = new Map<number, LapRow[]>()
    for (const lap of lapData) {
      const rows = byDriver.get(lap.driverNumber) ?? []
      rows.push(lap)
      byDriver.set(lap.driverNumber, rows)
    }

    for (const [, driverLaps] of byDriver) {
      const sorted = [...driverLaps]
        .filter((r) => Number.isFinite(r.lapNumber) && r.lapNumber > 0)
        .sort((a, b) => a.lapNumber - b.lapNumber)

      let stintStart = 0
      let prevCompound = ''
      for (let i = 0; i < sorted.length; i++) {
        const compound = String(sorted[i].tyreCompound || 'UNKNOWN').toUpperCase()
        if (compound !== prevCompound) {
          stintStart = sorted[i].lapNumber
          prevCompound = compound
        }
        const lapTime = Number(sorted[i].lapTime)
        if (!Number.isFinite(lapTime) || lapTime <= 40 || lapTime >= 200) continue
        const stintLap = sorted[i].lapNumber - stintStart + 1

        let data = byCompound.get(compound)
        if (!data) {
          data = { lapInStint: [], times: [] }
          byCompound.set(compound, data)
        }
        data.lapInStint.push(stintLap)
        data.times.push(lapTime)
      }
    }

    // For each compound, bin by stint lap and average
    const result = new Map<string, { lapInStint: number[]; times: number[]; smoothed: number[] }>()
    for (const [compound, data] of byCompound) {
      const maxLap = Math.min(30, Math.max(...data.lapInStint))
      const avgLaps: number[] = []
      const avgTimes: number[] = []
      for (let lap = 1; lap <= maxLap; lap++) {
        const timesAtLap = data.times.filter((_, i) => data.lapInStint[i] === lap)
        if (timesAtLap.length >= 2) {
          avgLaps.push(lap)
          avgTimes.push(timesAtLap.reduce((a, b) => a + b, 0) / timesAtLap.length)
        }
      }
      if (avgLaps.length >= 3) {
        result.set(compound, { lapInStint: avgLaps, times: avgTimes, smoothed: movingAverage(avgTimes, 3) })
      }
    }

    return { byCompound: result }
  }, [sessionData, laps])

  const totalLaps = useMemo(() => {
    if (!tyreTimeline.length) return 0
    return Math.max(...tyreTimeline.flatMap((t) => t.stints.map((s) => s.endLap)))
  }, [tyreTimeline])

  if (!sessionData) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No session loaded</div>
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Tyre Strategy Timeline */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-3 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Tyre Strategy Timeline
          <InfoTooltip title="Strategy Timeline">
            Visualizes every driver's pit stop strategy throughout the race. Different colors represent tyre compounds (Soft, Medium, Hard, Intermediate, Wet). The width of each bar corresponds to the stint length.
          </InfoTooltip>
        </div>
        {tyreTimeline.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">No tyre data available</div>
        ) : (
          <div className="space-y-1">
            {tyreTimeline.map((row) => (
              <div key={row.code} className="flex items-center gap-2">
                <div className="w-10 text-[10px] font-bold text-slate-300 text-right font-mono">{row.code}</div>
                <div className="flex-1 h-5 relative rounded overflow-hidden bg-white/5">
                  {row.stints.map((stint, si) => {
                    const left = totalLaps > 0 ? ((stint.startLap - 1) / totalLaps) * 100 : 0
                    const width = totalLaps > 0 ? (stint.laps / totalLaps) * 100 : 0
                    return (
                      <div
                        key={si}
                        className="absolute top-0 h-full flex items-center justify-center text-[8px] font-bold text-black/80"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.5)}%`,
                          backgroundColor: tyreColor(stint.compound),
                          borderRight: si < row.stints.length - 1 ? '1px solid rgba(0,0,0,0.3)' : 'none',
                        }}
                        title={`${stint.compound}: Laps ${stint.startLap}-${stint.endLap} (${stint.laps} laps)`}
                      >
                        {stint.laps >= 3 ? stint.compound.charAt(0) : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {/* Legend */}
            <div className="flex gap-3 mt-2 pt-2 border-t border-white/5">
              {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map((c) => (
                <span key={c} className="flex items-center gap-1 text-[9px] text-slate-500">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: tyreColor(c) }} />
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tyre Degradation Curve */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-2 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Tyre Degradation Curve
          <InfoTooltip title="Degradation Curve">
            Averaged lap times plotted against the relative lap number within a stint. Shows the characteristic degradation profile for each tyre compound. The slope (e.g., +0.050s/lap) quantifies the average time lost per lap due to tyre wear.
          </InfoTooltip>
        </div>
        <div className="text-[10px] text-slate-500 mb-3">
          Average lap time by stint-relative lap per compound
        </div>
        {degradationData.byCompound.size === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">Insufficient data for degradation curves</div>
        ) : (() => {
          const compounds = Array.from(degradationData.byCompound.entries())
          const allTimes = compounds.flatMap(([, d]) => d.smoothed)
          const allLaps = compounds.flatMap(([, d]) => d.lapInStint)
          const xMin = 1, xMax = Math.max(...allLaps)
          const yMin = Math.min(...allTimes) - 0.3, yMax = Math.max(...allTimes) + 0.3
          const W = 900, H = 260
          const padL = 56, padR = 16, padT = 12, padB = 28
          const innerW = W - padL - padR, innerH = H - padT - padB

          const px = (v: number) => padL + ((v - xMin) / Math.max(1, xMax - xMin)) * innerW
          const py = (v: number) => padT + (1 - (v - yMin) / Math.max(0.001, yMax - yMin)) * innerH

          return (
            <div className="relative" onMouseLeave={() => { setHovered(null); setTip(null) }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px]"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const mx = ((e.clientX - rect.left) / rect.width) * W
                  const my = ((e.clientY - rect.top) / rect.height) * H
                  let best: string | null = null, bestD = Infinity, bestLap = 0, bestTime = 0
                  for (const [compound, data] of compounds) {
                    for (let i = 0; i < data.lapInStint.length; i++) {
                      const dx = px(data.lapInStint[i]) - mx, dy = py(data.smoothed[i]) - my
                      const dist = dx * dx + dy * dy
                      if (dist < bestD) { bestD = dist; best = compound; bestLap = data.lapInStint[i]; bestTime = data.smoothed[i] }
                    }
                  }
                  if (best && bestD < 400) {
                    setHovered(best)
                    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: best, lap: bestLap, time: bestTime })
                  } else {
                    setHovered(null); setTip(null)
                  }
                }}>
                <rect x={0} y={0} width={W} height={H} fill="#0a0b0f" />
                {[0.25, 0.5, 0.75].map((f) => (
                  <line key={f} x1={padL} y1={padT + innerH * (1 - f)} x2={padL + innerW} y2={padT + innerH * (1 - f)}
                    stroke="rgba(100,116,139,0.12)" strokeWidth={1} />
                ))}
                <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="rgba(100,116,139,0.35)" strokeWidth={1.5} />
                <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="rgba(100,116,139,0.35)" strokeWidth={1.5} />
                {compounds.map(([compound, data]) => {
                  const isH = hovered === compound
                  const op = hovered && !isH ? 0.2 : 0.9
                  const d = data.lapInStint.map((lap, i) => {
                    const v = data.smoothed[i]
                    return `${i === 0 ? 'M' : 'L'}${px(lap).toFixed(1)},${py(v).toFixed(1)}`
                  }).join(' ')
                  return (
                    <path key={compound} d={d} fill="none"
                      stroke={tyreColor(compound)} strokeWidth={isH ? 3.5 : 2.5}
                      opacity={op} strokeLinecap="round" strokeLinejoin="round" />
                  )
                })}
                <text x={padL + innerW / 2} y={padT + innerH + 22} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="middle">Lap in Stint</text>
                <text x={padL - 6} y={padT + 8} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="end">{fmtTime(yMax)}</text>
                <text x={padL - 6} y={padT + innerH} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="end">{fmtTime(yMin)}</text>
              </svg>
              {tip && (
                <div className="absolute pointer-events-none bg-bg-surface/90 backdrop-blur-md border border-border-hard rounded-lg p-2.5 text-[11px] font-mono shadow-xl z-20 flex flex-col gap-1.5 transition-all duration-75"
                  style={{ left: tip.x + 16, top: Math.max(8, tip.y - 20) }}>
                  <div className="flex items-center gap-2 border-b border-border-micro pb-1.5 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tyreColor(tip.label) }} />
                    <span className="font-bold text-fg-primary text-[12px] uppercase">{tip.label}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-fg-secondary"><span>Stint Lap:</span><span className="text-fg-primary font-bold">{tip.lap}</span></div>
                  <div className="flex justify-between gap-4 text-fg-secondary"><span>Avg Pace:</span><span className="text-fg-primary font-bold">{fmtTime(tip.time)}</span></div>
                </div>
              )}
              <div className="flex gap-3 mt-2">
                {compounds.map(([compound, data]) => {
                  const slope = linearSlope(data.lapInStint, data.smoothed)
                  return (
                    <span key={compound} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: tyreColor(compound) }} />
                      {compound.charAt(0) + compound.slice(1).toLowerCase()}
                      <span className="text-slate-600 ml-1">({slope > 0 ? '+' : ''}{slope.toFixed(3)}s/lap)</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Sector Comparison tab ───────────────────────────────────────────────────

function SectorComparisonTab() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)

  const sectorData = useMemo(() => {
    if (!sessionData?.drivers) return []
    const lapData = laps.length ? laps : sessionData.laps ?? []
    return buildSectorData(lapData, sessionData.drivers)
  }, [sessionData, laps])

  if (!sessionData) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No session loaded</div>
  }

  if (!sectorData.length) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No sector data available</div>
  }

  // Find best in each sector
  const bestS1 = Math.min(...sectorData.map((d) => d.bestS1))
  const bestS2 = Math.min(...sectorData.map((d) => d.bestS2))
  const bestS3 = Math.min(...sectorData.map((d) => d.bestS3))

  // Stacked bar chart data
  const maxTotal = Math.max(...sectorData.map((d) => d.avgTotal))
  const minTotal = Math.min(...sectorData.map((d) => d.avgTotal))

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Sector breakdown stacked bar */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-3 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Average Sector Breakdown
          <InfoTooltip title="Sector Composition">
            Breaks down the average total lap time into Sector 1, 2, and 3 percentages. Helps identify where a driver or car is gaining or losing the most time relative to their own average lap. Hover over sections to see raw times.
          </InfoTooltip>
        </div>
        <div className="space-y-1.5">
          {sectorData.slice(0, 20).map((d) => {
            const total = d.avgTotal
            const s1Pct = (d.avgS1 / total) * 100
            const s2Pct = (d.avgS2 / total) * 100
            const s3Pct = (d.avgS3 / total) * 100
            const barWidth = minTotal > 0 ? (minTotal / total) * 100 : 80
            return (
              <div key={d.code} className="flex items-center gap-2 group">
                <div className="w-10 text-[10px] font-bold text-right font-mono transition-colors group-hover:text-white" style={{ color: d.color }}>{d.code}</div>
                <div className="flex-1 relative">
                  <div className="flex h-5 rounded overflow-hidden shadow-inner bg-black/40" style={{ width: `${barWidth}%` }}>
                    <div className="h-full flex items-center justify-center text-[7px] font-bold text-black/80 transition-all hover:brightness-125"
                      style={{ width: `${s1Pct}%`, backgroundColor: '#a855f7', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}
                      title={`S1: ${fmtSeconds(d.avgS1)}s`}>
                      {s1Pct > 15 ? `S1` : ''}
                    </div>
                    <div className="h-full flex items-center justify-center text-[7px] font-bold text-black/80 transition-all hover:brightness-125 border-l border-black/10"
                      style={{ width: `${s2Pct}%`, backgroundColor: '#f59e0b', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}
                      title={`S2: ${fmtSeconds(d.avgS2)}s`}>
                      {s2Pct > 15 ? `S2` : ''}
                    </div>
                    <div className="h-full flex items-center justify-center text-[7px] font-bold text-black/80 transition-all hover:brightness-125 border-l border-black/10"
                      style={{ width: `${s3Pct}%`, backgroundColor: '#06b6d4', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}
                      title={`S3: ${fmtSeconds(d.avgS3)}s`}>
                      {s3Pct > 15 ? `S3` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 w-16 text-right group-hover:text-fg-primary transition-colors">{fmtTime(total)}</div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-[#a855f7]" /> Sector 1
          </span>
          <span className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-[#f59e0b]" /> Sector 2
          </span>
          <span className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-[#06b6d4]" /> Sector 3
          </span>
        </div>
      </div>

      {/* Sector times table */}
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-2 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Sector Times Comparison
          <InfoTooltip title="Sector Times">
            Compare average and absolute best sector times for each driver. The overall fastest times in each sector are highlighted in color.
          </InfoTooltip>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-white/8">
                {['Driver', 'Avg S1', 'Avg S2', 'Avg S3', 'Best S1', 'Best S2', 'Best S3', 'Avg Total'].map((h) => (
                  <th key={h} className="py-1 px-2 text-left text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectorData.map((d) => (
                <tr key={d.code} className="border-b border-white/4 hover:bg-white/3">
                  <td className="py-1.5 px-2 font-bold" style={{ color: d.color }}>{d.code}</td>
                  <td className="py-1.5 px-2 text-slate-300">{fmtSeconds(d.avgS1)}</td>
                  <td className="py-1.5 px-2 text-slate-300">{fmtSeconds(d.avgS2)}</td>
                  <td className="py-1.5 px-2 text-slate-300">{fmtSeconds(d.avgS3)}</td>
                  <td className={`py-1.5 px-2 ${d.bestS1 === bestS1 ? 'text-purple-400 font-bold' : 'text-slate-400'}`}>{fmtSeconds(d.bestS1)}</td>
                  <td className={`py-1.5 px-2 ${d.bestS2 === bestS2 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>{fmtSeconds(d.bestS2)}</td>
                  <td className={`py-1.5 px-2 ${d.bestS3 === bestS3 ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>{fmtSeconds(d.bestS3)}</td>
                  <td className="py-1.5 px-2 text-slate-200">{fmtTime(d.avgTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Position Changes tab ────────────────────────────────────────────────────

function PositionChangesTab() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)
  const [hovered, setHovered] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; label: string; lap: number; pos: number } | null>(null)

  const positionData = useMemo(() => {
    if (!sessionData?.drivers) return []
    const lapData = laps.length ? laps : sessionData.laps ?? []
    const numberToDriver = new Map<number, Driver>()
    for (const d of sessionData.drivers) numberToDriver.set(d.driverNumber, d)

    const byDriver = new Map<string, { laps: number[]; positions: number[]; color: string }>()
    for (const lap of lapData) {
      const driver = numberToDriver.get(lap.driverNumber)
      const code = driver?.code || String(lap.driverName || lap.driverNumber)
      const pos = Number(lap.position)
      if (!Number.isFinite(pos) || pos <= 0 || pos > 25) continue

      let entry = byDriver.get(code)
      if (!entry) {
        entry = { laps: [], positions: [], color: driver?.teamColor || '#8aa7d1' }
        byDriver.set(code, entry)
      }
      entry.laps.push(lap.lapNumber)
      entry.positions.push(pos)
    }

    return Array.from(byDriver.entries())
      .map(([code, data]) => ({
        code,
        color: data.color,
        laps: data.laps,
        positions: data.positions,
        finalPos: data.positions[data.positions.length - 1] ?? 99,
      }))
      .sort((a, b) => a.finalPos - b.finalPos)
  }, [sessionData, laps])

  if (!sessionData) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No session loaded</div>
  }

  if (!positionData.length) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No position data available</div>
  }

  const allLaps = positionData.flatMap((d) => d.laps)
  const xMin = Math.min(...allLaps), xMax = Math.max(...allLaps)
  const numDrivers = positionData.length
  const yMin = 0.5, yMax = Math.min(numDrivers + 0.5, 21)

  const W = 900, H = 400
  const padL = 40, padR = 40, padT = 12, padB = 28
  const innerW = W - padL - padR, innerH = H - padT - padB

  const px = (v: number) => padL + ((v - xMin) / Math.max(1, xMax - xMin)) * innerW
  const py = (v: number) => padT + ((v - yMin) / Math.max(0.5, yMax - yMin)) * innerH

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="rounded-xl border border-white/8 bg-[#0d0e12] p-3">
        <div className="mb-2 flex items-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Position Changes Through Race
          <InfoTooltip title="Position Timeline">
            A lap-by-lap line chart showing position changes. Watch for overcuts/undercuts during pit windows and on-track overtakes. Hover over the chart to trace a specific driver's progression.
          </InfoTooltip>
        </div>
        <div className="relative" onMouseLeave={() => { setHovered(null); setTip(null) }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[400px]"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const mx = ((e.clientX - rect.left) / rect.width) * W
              const my = ((e.clientY - rect.top) / rect.height) * H
              let best: string | null = null, bestD = Infinity, bestLap = 0, bestPos = 0
              for (const d of positionData) {
                for (let i = 0; i < d.laps.length; i++) {
                  const dx = px(d.laps[i]) - mx, dy = py(d.positions[i]) - my
                  const dist = dx * dx + dy * dy
                  if (dist < bestD) { bestD = dist; best = d.code; bestLap = d.laps[i]; bestPos = d.positions[i] }
                }
              }
              if (best && bestD < 400) {
                setHovered(best)
                setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: best, lap: bestLap, pos: bestPos })
              } else {
                setHovered(null); setTip(null)
              }
            }}>
            <rect x={0} y={0} width={W} height={H} fill="#0a0b0f" />
            {/* Grid lines for each position */}
            {Array.from({ length: Math.min(numDrivers, 20) }, (_, i) => i + 1).map((pos) => (
              <g key={pos}>
                <line x1={padL} y1={py(pos)} x2={padL + innerW} y2={py(pos)}
                  stroke="rgba(100,116,139,0.08)" strokeWidth={1} />
                <text x={padL - 6} y={py(pos) + 3.5} fill="rgba(148,163,184,0.5)" fontSize={9} textAnchor="end">P{pos}</text>
              </g>
            ))}
            {positionData.map((d) => {
              const isH = hovered === d.code
              const op = hovered && !isH ? 0.15 : 0.85
              const pathD = d.laps.map((lap, i) =>
                `${i === 0 ? 'M' : 'L'}${px(lap).toFixed(1)},${py(d.positions[i]).toFixed(1)}`
              ).join(' ')
              return (
                <g key={d.code} onMouseEnter={() => setHovered(d.code)}>
                  <path d={pathD} fill="none"
                    stroke={d.color} strokeWidth={isH ? 3 : 1.8}
                    opacity={op} strokeLinecap="round" strokeLinejoin="round" />
                  {/* Label at end */}
                  <text
                    x={px(d.laps[d.laps.length - 1]) + 8}
                    y={py(d.positions[d.positions.length - 1]) + 3.5}
                    fill={isH ? '#fff' : d.color}
                    fontSize={9} fontWeight={isH ? 700 : 500}
                    opacity={op}
                  >{d.code}</text>
                </g>
              )
            })}
            <text x={padL + innerW / 2} y={padT + innerH + 22} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="middle">Lap</text>
          </svg>
          {tip && (
            <div className="absolute pointer-events-none bg-bg-surface/90 backdrop-blur-md border border-border-hard rounded-lg p-2.5 text-[11px] font-mono shadow-xl z-20 flex flex-col gap-1.5 transition-all duration-75"
              style={{ left: tip.x + 16, top: Math.max(8, tip.y - 20) }}>
              <div className="flex items-center gap-2 border-b border-border-micro pb-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: positionData.find(d => d.code === tip.label)?.color }} />
                <span className="font-bold text-fg-primary text-[12px] uppercase">{tip.label}</span>
              </div>
              <div className="flex justify-between gap-4 text-fg-secondary"><span>Lap:</span><span className="text-fg-primary font-bold">{tip.lap}</span></div>
              <div className="flex justify-between gap-4 text-fg-secondary"><span>Position:</span><span className="text-fg-primary font-bold">P{tip.pos}</span></div>
            </div>
          )}
        </div>

        {/* Gain/loss summary */}
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Positions Gained/Lost</div>
          <div className="flex flex-wrap gap-2">
            {positionData
              .filter((d) => d.positions.length >= 2)
              .map((d) => {
                const gained = d.positions[0] - d.positions[d.positions.length - 1]
                return { ...d, gained }
              })
              .sort((a, b) => b.gained - a.gained)
              .map((d) => (
                <span key={d.code} className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/5 bg-white/3">
                  <span className="font-bold" style={{ color: d.color }}>{d.code}</span>
                  <span className={d.gained > 0 ? 'text-emerald-400' : d.gained < 0 ? 'text-red-400' : 'text-slate-500'}>
                    {d.gained > 0 ? `+${d.gained}` : d.gained === 0 ? '0' : String(d.gained)}
                  </span>
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'race-pace' | 'tyre-deg' | 'sectors' | 'positions' | 'radar'

export function AnalyticsView() {
  const [tab, setTab] = useState<Tab>('race-pace')
  const [showOverview, setShowOverview] = useState(false)

  const overviewContent = useMemo(() => {
    switch (tab) {
      case 'race-pace':
        return {
          title: 'Race Pace Analysis',
          description: 'Deep dive into cumulative lap time performance and consistency.',
          metrics: [
            { label: 'Box Plot', effect: 'Shows consistency. Smaller boxes = robotic precision.' },
            { label: 'Smoothed Pace', effect: 'Identifies the "tyre cliff" and real-world race evolution.' },
            { label: 'Outliers', effect: 'Typically reflect pits or severe traffic impedance.' }
          ]
        }
      case 'tyre-deg':
        return {
          title: 'Tyre Lifecycle & Degradation',
          description: 'Understanding the thermal and physical wear of various compounds.',
          metrics: [
            { label: 'Strategy Timeline', effect: 'Visual map of stint lengths and compound choices.' },
            { label: 'Degradation Slope', effect: 'The exact seconds lost per lap due to ageing rubber.' },
            { label: 'Compound Delta', effect: 'Compare hard vs soft life expectancy and offset.' }
          ]
        }
      case 'sectors':
        return {
          title: 'Sector Dominance',
          description: 'Breaking down the lap into its three key technical segments.',
          metrics: [
            { label: 'Sector Proportions', effect: 'Identify car efficiency (e.g. high-speed vs technical).' },
            { label: 'Purple Sectors', effect: 'The absolute benchmark for the session across all drivers.' },
            { label: 'Consistency', effect: 'Average vs Best sector delta reveals driver limit-finding.' }
          ]
        }
      case 'positions':
        return {
          title: 'Race Dynamics & Positions',
          description: 'Visualize the ebb and flow of the positions through overtakes and pits.',
          metrics: [
            { label: 'Position Trace', effect: 'Lap-by-lap tracking of every driver in the field.' },
            { label: 'Gains/Losses', effect: 'Summary of effective overtakes and strategy successes.' },
            { label: 'Pit Window Impact', effect: 'Vertical jumps often signify undercuts or overcuts.' }
          ]
        }
      case 'radar':
        return {
          title: 'Performance Radar',
          description: 'Multi-dimensional technical benchmark against the session ideal.',
          metrics: [
            { label: 'Sector Dominance', effect: 'Proximity to the absolute purple sectors.' },
            { label: 'Consistency', effect: 'Lap-to-lap variance in clean air.' },
            { label: 'Top Speed', effect: 'Power and aerodynamic efficiency at trap points.' }
          ]
        }
      default:
        return { title: '', description: '', metrics: [] }
    }
  }, [tab])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border bg-bg-secondary px-3 py-1.5 flex-shrink-0">
        <div className="flex-1 flex items-center gap-0.5">
          {([
            { id: 'race-pace', label: 'Race Pace' },
            { id: 'tyre-deg', label: 'Tyre Degradation' },
            { id: 'sectors', label: 'Sector Comparison' },
            { id: 'positions', label: 'Position Changes' },
            { id: 'radar', label: 'Radar' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.1em] transition-all ${
                tab === t.id
                  ? 'bg-accent/20 text-white border border-accent/40 shadow-[0_0_15px_rgba(33,150,243,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowOverview(!showOverview)}
          className={`p-2 rounded-full transition-all ${showOverview ? 'bg-accent text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
          title="Show Tab Insights"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {showOverview && (
        <div className="m-3 p-4 rounded-xl border border-accent/30 bg-accent/5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-3 border-b border-accent/20 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              {overviewContent.title}
            </h3>
            <button onClick={() => setShowOverview(false)} className="text-slate-500 hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-slate-300 mb-4 leading-relaxed max-w-2xl">{overviewContent.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {overviewContent.metrics.map(m => (
              <div key={m.label} className="bg-black/20 border border-white/5 p-2 rounded-lg">
                <div className="text-[9px] font-bold text-accent uppercase tracking-wider mb-1">{m.label}</div>
                <div className="text-[10px] text-slate-400 font-sans">{m.effect}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'race-pace' && <RacePaceTab />}
        {tab === 'tyre-deg' && <TyreDegTab />}
        {tab === 'sectors' && <SectorComparisonTab />}
        {tab === 'positions' && <PositionChangesTab />}
        {tab === 'radar' && <RadarTab />}
      </div>
    </div>
  )
}

function RadarTab() {
  const laps = useSessionStore(s => s.laps)
  const sessionData = useSessionStore(s => s.sessionData)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)

  const drivers = useMemo(() => sessionData?.drivers ?? [], [sessionData])
  useEffect(() => {
    if (!selectedDriver && drivers.length > 0) setSelectedDriver(drivers[0].code)
  }, [drivers, selectedDriver])

  const radarData = useMemo(() => {
    if (!laps.length || !selectedDriver) return null

    // Session-wide bests
    let bestS1 = Infinity, bestS2 = Infinity, bestS3 = Infinity
    for (const l of laps) {
      if (l.sector1 && l.sector1 > 0) bestS1 = Math.min(bestS1, l.sector1)
      if (l.sector2 && l.sector2 > 0) bestS2 = Math.min(bestS2, l.sector2)
      if (l.sector3 && l.sector3 > 0) bestS3 = Math.min(bestS3, l.sector3)
    }

    // Driver specific
    const dLaps = laps.filter(l => l.driverName === drivers.find(d => d.code === selectedDriver)?.driverName && (l.lapTime ?? 0) > 0)
    if (!dLaps.length) return null

    let dBestS1 = Infinity, dBestS2 = Infinity, dBestS3 = Infinity
    const times: number[] = []
    for (const l of dLaps) {
      if (l.sector1 && l.sector1 > 0) dBestS1 = Math.min(dBestS1, l.sector1)
      if (l.sector2 && l.sector2 > 0) dBestS2 = Math.min(dBestS2, l.sector2)
      if (l.sector3 && l.sector3 > 0) dBestS3 = Math.min(dBestS3, l.sector3)
      times.push(l.lapTime!)
    }

    // Consistency (StdDev) - Normalized (0.5s stddev is "average", 0.05s is "perfect")
    const avgTrial = times.reduce((a, b) => a + b, 0) / times.length
    const stdDev = Math.sqrt(times.map(x => Math.pow(x - avgTrial, 2)).reduce((a, b) => a + b) / times.length)
    const consistency = Math.max(0, Math.min(100, 100 * (1 - Math.min(1, stdDev / 1.0))))

    const d = (val: number, best: number) => (best === Infinity || val === Infinity) ? 0 : Math.max(0, Math.min(100, 100 * (best / val)))

    const metrics = [
      { name: 'S1 MASTERY', value: d(dBestS1, bestS1) },
      { name: 'S2 MASTERY', value: d(dBestS2, bestS2) },
      { name: 'S3 MASTERY', value: d(dBestS3, bestS3) },
      { name: 'CONSISTENCY', value: consistency },
      { name: 'PACE DEPTH', value: Math.min(100, (dLaps.length / 50) * 100) } // Visual metric for data volume
    ]

    return metrics
  }, [laps, selectedDriver])

  const W = 400, H = 340, CX = W / 2, CY = H / 2, R = 120

  return (
    <div className="flex h-full flex-col p-4 bg-bg-surface overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Technical Proficiency Radar
          <InfoTooltip title="Performance Benchmarking">
            Comparison of driver peak capabilities against session purple benchmarks across five dimensions.
          </InfoTooltip>
        </h2>

        <div className="flex flex-wrap gap-1 max-w-[50%] justify-end">
          {drivers.map(d => (
            <button
              key={d.code}
              onClick={() => setSelectedDriver(d.code)}
              className={`px-2 py-1 rounded text-[9px] font-bold transition-all border ${selectedDriver === d.code ? 'bg-accent/20 border-accent text-white' : 'bg-black/20 border-white/5 text-slate-500 hover:text-white'}`}
            >
              {d.code}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[500px] h-full drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <ChartDefs />
          {/* Background web */}
          {[1, 0.75, 0.5, 0.25].map(f => (
            <circle key={f} cx={CX} cy={CY} r={R * f} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
          ))}

          {radarData && (
            <>
              {radarData.map((m, i) => {
                const ang = (i / radarData.length) * Math.PI * 2 - Math.PI / 2
                const tx = CX + Math.cos(ang) * R, ty = CY + Math.sin(ang) * R
                const lx = CX + Math.cos(ang) * (R + 25), ly = CY + Math.sin(ang) * (R + 25)
                return (
                  <g key={m.name}>
                    <line x1={CX} y1={CY} x2={tx} y2={ty} stroke="rgba(255,255,255,0.08)" />
                    <text x={lx} y={ly} fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
                      {m.name}
                    </text>
                  </g>
                )
              })}

              <polygon
                points={radarData.map((m, i) => {
                  const ang = (i / radarData.length) * Math.PI * 2 - Math.PI / 2
                  const rad = (m.value / 100) * R
                  return `${CX + Math.cos(ang) * rad},${CY + Math.sin(ang) * rad}`
                }).join(' ')}
                fill="url(#radarGradient)"
                stroke="var(--color-accent)"
                strokeWidth="2"
                filter="url(#glow)"
              />

              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </>
          )}

          {!radarData && <text x={CX} y={CY} fill="rgba(255,255,255,0.2)" textAnchor="middle" fontSize="10">Insufficient data for {selectedDriver}</text>}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {radarData?.map(m => (
          <div key={m.name} className="bg-black/20 border border-white/5 p-2 rounded-lg text-center">
            <div className="text-[7px] text-slate-500 uppercase tracking-tighter mb-0.5">{m.name.split(' ')[0]}</div>
            <div className="text-[11px] font-mono font-bold text-accent">{Math.round(m.value)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
