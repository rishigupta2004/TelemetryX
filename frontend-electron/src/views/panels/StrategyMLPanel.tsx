import React from 'react'
import { PanelIcons } from '../FeaturesView'
import { formatPct } from '../../lib/featuresUtils'
import type { StrategyRecommendationItem } from '../../types'

const PanelHeader = ({ title, subtitle, icon, accentColor }: { title: string; subtitle?: string; icon?: React.ReactNode; accentColor?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    {icon && (<div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accentColor ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` : 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))', border: accentColor ? `1px solid ${accentColor}40` : '1px solid rgba(56,189,248,0.2)' }}><div style={{ color: accentColor || '#38bdf8' }}>{icon}</div></div>)}
    <div><div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">{title}</div>{subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}</div>
  </div>
)

function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-bg-surface/50 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="h-full w-full bg-gradient-to-br from-bg-surface/30 to-bg-surface/10" />
    </div>
  )
}

interface StrategyMLPanelProps {
  tabAccent: string
  selectedYear: number | null
  selectedRace: string | null
  strategyData: any
  strategySourceYear: number | null
  strategyLoading: boolean
  strategyError: string | null
  topStrategies: StrategyRecommendationItem[]
  strategyExtents: { finishMin: number; finishMax: number; pointsMin: number; pointsMax: number }
}

export function StrategyMLPanel({ tabAccent, selectedYear, selectedRace, strategyData, strategySourceYear, strategyLoading, strategyError, topStrategies, strategyExtents }: StrategyMLPanelProps) {
  return (
    <section className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PanelHeader title="Strategy Scenario Map" subtitle="ML-powered strategy recommendations with probability estimates" icon={PanelIcons['strategy-ml']} accentColor={tabAccent} />
        {strategySourceYear != null && selectedYear != null && strategySourceYear !== selectedYear && (
          <span className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-[10px] font-mono text-amber-300 border border-amber-500/30">using {strategySourceYear} model</span>
        )}
      </div>

      {strategyLoading && (
        <div className="space-y-4">
          <SkeletonLoader className="h-[280px]" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SkeletonLoader className="h-[80px]" /><SkeletonLoader className="h-[80px]" /><SkeletonLoader className="h-[80px]" /><SkeletonLoader className="h-[80px]" />
          </div>
        </div>
      )}
      {!strategyLoading && strategyError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          <div className="font-semibold mb-1">Strategy model unavailable</div>
          Strategy model data unavailable for {selectedYear} {selectedRace ?? 'this race'}. Try a different session or check that model data exists.
        </div>
      )}

      {!strategyLoading && !strategyError && topStrategies.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-bg-raised/30 p-6 text-center text-sm text-fg-muted">No data available for strategy analysis</div>
      )}

      {!strategyLoading && !strategyError && topStrategies.length > 0 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/30 bg-[#050810] p-4" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
            <svg viewBox="0 0 480 260" className="h-[260px] w-full">
              <defs><linearGradient id="strategyBg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#0a1020" /><stop offset="100%" stopColor="#050a10" /></linearGradient></defs>
              <rect x="0" y="0" width="480" height="260" fill="url(#strategyBg)" />
              <line x1={38} y1={226} x2={460} y2={226} stroke="rgba(130,160,210,0.35)" /><line x1={38} y1={20} x2={38} y2={226} stroke="rgba(130,160,210,0.35)" />

              {topStrategies.map((item, idx) => {
                const xSpan = Math.max(0.001, strategyExtents.finishMax - strategyExtents.finishMin)
                const ySpan = Math.max(0.001, strategyExtents.pointsMax - strategyExtents.pointsMin)
                const x = 450 - ((item.avg_finish_position - strategyExtents.finishMin) / xSpan) * 400
                const y = 214 - ((item.avg_points - strategyExtents.pointsMin) / ySpan) * 180
                const r = 6 + Math.max(0, item.podium_probability || 0) * 14
                const hue = 140 - Math.min(120, item.avg_pit_stops * 45)
                const color = `hsl(${Math.max(15, hue)}, 78%, 55%)`
                return (
                  <g key={`${item.strategy}-${idx}`}>
                    <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.6} stroke={color} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 ${r * 0.8}px ${color})` }} />
                    <text x={x + r + 4} y={y + 3} fill="#d6e6ff" fontSize="8">{item.strategy}</text>
                  </g>
                )
              })}
              <text x={42} y={15} fill="#9ab4d9" fontSize="9">Avg points</text>
              <text x={365} y={244} fill="#9ab4d9" fontSize="9">Better finish →</text>
            </svg>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {topStrategies.slice(0, 8).map((item) => (
              <div key={item.strategy} className="rounded-xl border border-border/40 bg-bg-raised/40 px-4 py-3 text-xs transition-all hover:border-border/60 hover:bg-bg-raised/60">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-fg-primary font-semibold">{item.strategy}</span>
                  <span className="font-mono text-[10px] text-fg-muted bg-bg-surface/50 px-2 py-0.5 rounded">Pts {item.avg_points.toFixed(2)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-fg-muted">
                  <span>Finish <span className="text-fg-secondary font-mono">{item.avg_finish_position.toFixed(2)}</span></span>
                  <span>Podium <span className="text-fg-secondary font-mono">{formatPct(item.podium_probability)}</span></span>
                  <span>Stops <span className="text-fg-secondary font-mono">{item.avg_pit_stops.toFixed(1)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
