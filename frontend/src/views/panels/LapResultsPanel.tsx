import React from 'react'
import { PanelIcons } from '../FeaturesView'
import { tyreColor } from '../../lib/featuresUtils'
import type { PaceSeries, HoverTip, TyreStintRow } from '../../lib/featuresUtils'

const PanelHeader = ({ title, subtitle, icon, accentColor }: { title: string; subtitle?: string; icon?: React.ReactNode; accentColor?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    {icon && (<div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accentColor ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` : 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))', border: accentColor ? `1px solid ${accentColor}40` : '1px solid rgba(56,189,248,0.2)' }}><div style={{ color: accentColor || '#38bdf8' }}>{icon}</div></div>)}
    <div><div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">{title}</div>{subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}</div>
  </div>
)

interface LapResultsPanelProps {
  primaryDriver: string | null
  compareDriver: string | null
  lapScatterSeries: PaceSeries[]
  lapScatterBounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  lapDistributions: any[]
  positionTraces: any[]
  positionTraceBounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  teamPaceRows: any[]
  qualifyingRows: any[]
  tyreTimelineRows: TyreStintRow[]
  tyreTimelineMaxLap: number
  setLapScatterHover: (tip: HoverTip | null) => void
  setPositionHover: (tip: HoverTip | null) => void
}

export function LapResultsPanel({ primaryDriver, compareDriver, lapScatterSeries, lapScatterBounds, lapDistributions, positionTraces, positionTraceBounds, teamPaceRows, qualifyingRows, tyreTimelineRows, tyreTimelineMaxLap, setLapScatterHover, setPositionHover }: LapResultsPanelProps) {
  return (
    <section className="space-y-5 bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <PanelHeader title="Lap + Results Analytics" subtitle="FastF1-style lap scatter, lap distribution, position traces, team pace, and qualifying overview with hover inspection" icon={PanelIcons['lap-results']} accentColor="#38bdf8" />

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border/30 bg-[#050810] p-3" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            Driver Laptimes Scatterplot
          </div>
          <svg viewBox="0 0 1000 340" className="h-[340px] w-full">
            <defs><linearGradient id="lapScatterBg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#0a1020" /><stop offset="100%" stopColor="#050a10" /></linearGradient></defs>
            <rect x="0" y="0" width="1000" height="340" fill="url(#lapScatterBg)" />
            {lapScatterSeries.flatMap((series) => series.laps.map((lap, idx) => {
              const xSpan = Math.max(1, lapScatterBounds.xMax - lapScatterBounds.xMin)
              const ySpan = Math.max(0.001, lapScatterBounds.yMax - lapScatterBounds.yMin)
              const x = 52 + ((lap - lapScatterBounds.xMin) / xSpan) * 920
              const y = 304 - ((series.times[idx] - lapScatterBounds.yMin) / ySpan) * 260
              const highlighted = series.code === primaryDriver || series.code === compareDriver
              return <circle key={`${series.code}-${lap}-${idx}`} cx={x} cy={y} r={highlighted ? 4.2 : 2.8} fill={series.color} fillOpacity={highlighted ? 0.95 : 0.72} style={{ transition: 'r 0.15s ease, fill-opacity 0.15s ease' }} onMouseEnter={() => setLapScatterHover({ x, y, title: `${series.code} L${lap}`, detail: `${series.times[idx].toFixed(3)}s`, color: series.color })} onMouseLeave={() => setLapScatterHover(null)} />
            }))}
            <line x1={52} y1={304} x2={972} y2={304} stroke="rgba(132,160,200,0.35)" /><line x1={52} y1={24} x2={52} y2={304} stroke="rgba(132,160,200,0.35)" />
            <text x={56} y={18} fill="#9ab4d9" fontSize="10">Lap Time (s)</text><text x={936} y={332} fill="#9ab4d9" fontSize="10">Lap</text>
          </svg>
        </div>

        <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
          <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20h18M3 10h18M3 4h18"/></svg>
            Lap Time Distribution
          </div>
          <div className="space-y-2">
            {lapDistributions.map((row) => {
              const span = Math.max(0.001, lapScatterBounds.yMax - lapScatterBounds.yMin)
              const l10 = ((row.p10 - lapScatterBounds.yMin) / span) * 100
              const lq1 = ((row.q1 - lapScatterBounds.yMin) / span) * 100
              const lq3 = ((row.q3 - lapScatterBounds.yMin) / span) * 100
              const l90 = ((row.p90 - lapScatterBounds.yMin) / span) * 100
              const lmed = ((row.median - lapScatterBounds.yMin) / span) * 100
              return (
                <div key={`dist-${row.code}`} className="grid grid-cols-[52px_1fr_60px] items-center gap-3 text-[10px]">
                  <span className="font-mono text-fg-primary font-semibold">{row.code}</span>
                  <div className="relative h-5 rounded-lg bg-bg-surface/50">
                    <div className="absolute left-0 right-0 top-1/2 h-[1px] -translate-y-1/2 bg-border/50" />
                    <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ left: `${l10}%`, width: `${Math.max(1, l90 - l10)}%`, backgroundColor: row.color, boxShadow: `0 0 6px ${row.color}50` }} />
                    <div className="absolute top-[2px] h-[10px] rounded border border-white/40" style={{ left: `${lq1}%`, width: `${Math.max(1, lq3 - lq1)}%`, backgroundColor: `${row.color}88` }} />
                    <div className="absolute top-[1px] h-3 w-[2px] bg-white shadow" style={{ left: `${lmed}%`, boxShadow: '0 0 4px white' }} />
                  </div>
                  <span className="font-mono text-right text-fg-muted">{row.median.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-border/30 bg-[#050810] p-3" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10m-6 10V4m-6 16v-6m-6 0h12"/></svg>
            Position Changes During Race
          </div>
          <svg viewBox="0 0 1000 340" className="h-[340px] w-full">
            <defs><linearGradient id="positionBg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#0a1020" /><stop offset="100%" stopColor="#050a10" /></linearGradient></defs>
            <rect x="0" y="0" width="1000" height="340" fill="url(#positionBg)" />
            {positionTraces.map((trace) => {
              const xSpan = Math.max(1, positionTraceBounds.xMax - positionTraceBounds.xMin)
              const ySpan = Math.max(1, positionTraceBounds.yMax - positionTraceBounds.yMin)
              const points = trace.points.map((point: any) => ({ x: 52 + ((point.lap - positionTraceBounds.xMin) / xSpan) * 920, y: 304 - ((point.position - positionTraceBounds.yMin) / ySpan) * 260, lap: point.lap, position: point.position }))
              const path = points.map((point: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
              return (
                <g key={`pos-${trace.code}`}>
                  <path d={path} fill="none" stroke={trace.color} strokeWidth={2.2} opacity={0.88} />
                  {points.map((point: any) => <circle key={`${trace.code}-${point.lap}`} cx={point.x} cy={point.y} r={2.8} fill={trace.color} onMouseEnter={() => setPositionHover({ x: point.x, y: point.y, title: `${trace.code} | Lap ${point.lap}`, detail: `Position P${point.position}`, color: trace.color })} onMouseLeave={() => setPositionHover(null)} />)}
                </g>
              )
            })}
            <line x1={52} y1={304} x2={972} y2={304} stroke="rgba(132,160,200,0.35)" /><line x1={52} y1={24} x2={52} y2={304} stroke="rgba(132,160,200,0.35)" />
            <text x={56} y={18} fill="#9ab4d9" fontSize="10">Position</text><text x={936} y={332} fill="#9ab4d9" fontSize="10">Lap</text>
          </svg>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
            <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Team Pace Comparison
            </div>
            <div className="space-y-2 text-xs">
              {teamPaceRows.map((row) => (
                <div key={`team-${row.team}`} className="grid grid-cols-[110px_1fr_80px] items-center gap-3">
                  <span className="truncate text-[11px] text-fg-primary font-medium">{row.team}</span>
                  <div className="h-3 rounded-lg bg-bg-surface/50 overflow-hidden">
                    <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${Math.max(8, 100 - Math.min(96, row.delta * 25))}%`, backgroundColor: row.color, boxShadow: `0 0 8px ${row.color}60` }} />
                  </div>
                  <span className="font-mono text-right text-[10px] text-fg-muted">{row.medianLap.toFixed(3)}s</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
            <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Qualifying Results Overview
            </div>
            <div className="space-y-2 text-xs">
              {qualifyingRows.slice(0, 12).map((row) => (
                <div key={`quali-${row.code}`} className="grid grid-cols-[28px_44px_1fr_80px] items-center gap-3">
                  <span className="font-mono text-[10px] text-fg-muted">P{row.rank}</span>
                  <span className="font-mono text-fg-primary font-semibold">{row.code}</span>
                  <div className="h-3 rounded-lg bg-bg-surface/50 overflow-hidden">
                    <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${Math.max(7, 100 - Math.min(94, row.delta * 85))}%`, backgroundColor: row.color, boxShadow: `0 0 8px ${row.color}60` }} />
                  </div>
                  <span className="font-mono text-right text-[10px] text-fg-muted">{row.bestLap.toFixed(3)}s</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Tyre Strategies Timeline
        </div>
        { tyreTimelineRows.length === 0 ? (
          <div className="text-xs text-fg-muted p-4 text-center">No tyre-compound lap history available</div>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            { tyreTimelineRows.slice(0, 20).map((row) => (
              <div key={`${row.code}`} className="grid min-w-[760px] grid-cols-[44px_1fr_60px] items-center gap-3">
                <span className="font-mono text-[11px] text-fg-primary font-semibold">{row.code}</span>
                <div className="relative h-6 rounded-lg border border-border/40 bg-bg-surface/80">
                  {row.stints.map((stint, idx) => {
                    const left = ((stint.startLap - 1) / tyreTimelineMaxLap) * 100
                    const width = (stint.laps / tyreTimelineMaxLap) * 100
                    return <div key={`${row.code}-${idx}`} className="absolute top-0.5 h-5 rounded-md" style={{ left: `${left}%`, width: `${Math.max(1.5, width)}%`, backgroundColor: tyreColor(stint.compound), opacity: 0.92, boxShadow: `0 0 6px ${ tyreColor(stint.compound)}50` }} title={`${row.code} ${stint.compound} L${stint.startLap}-${stint.endLap} (${stint.laps} laps)`} />
                  })}
                </div>
                <span className="font-mono text-right text-[10px] text-fg-muted">L{row.stints[row.stints.length - 1]?.endLap || '-'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
