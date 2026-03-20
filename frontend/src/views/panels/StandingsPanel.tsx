import React from 'react'
import { PanelIcons } from '../FeaturesView'
import { SeasonStandingsLiteChart, StandingsHeatmapLiteChart } from '../../components/FeaturesLiteCharts'
import type { SeasonStandingsDriver, SeasonStandingsPayload } from '../../lib/featuresUtils'

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

interface StandingsPanelProps {
  tabAccent: string
  selectedYear: number | null
  seasonStandings: SeasonStandingsPayload | null
  seasonStandingsLoading: boolean
  seasonStandingsError: string | null
  topSeasonStandings: SeasonStandingsDriver[]
}

export function StandingsPanel({ tabAccent, selectedYear, seasonStandings, seasonStandingsLoading, seasonStandingsError, topSeasonStandings }: StandingsPanelProps) {
  return (
    <section className="space-y-5 bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <PanelHeader title="Season Standings Analytics" subtitle="Race-by-race points progression, standings heatmap, and season summary (FastF1 standings-style coverage)" icon={PanelIcons['standings']} accentColor={tabAccent} />

      {seasonStandingsLoading && (
        <div className="space-y-4">
          <SkeletonLoader className="h-[360px]" /><SkeletonLoader className="h-[240px]" />
        </div>
      )}
      {seasonStandingsError && <div className="text-xs text-red-400">{seasonStandingsError}</div>}

      {!seasonStandingsLoading && !seasonStandingsError && topSeasonStandings.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-bg-raised/30 p-6 text-center text-sm text-fg-muted">No standings data available for {selectedYear || '-'}.</div>
      )}

      {!seasonStandingsLoading && !seasonStandingsError && topSeasonStandings.length > 0 && (
        <>
          <div className="rounded-xl border border-border/30 bg-[#050810] p-4" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
            <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              Season Summary Visualization
            </div>
            <SeasonStandingsLiteChart drivers={topSeasonStandings.map((driver) => ({ code: driver.code, color: driver.color, cumulative: driver.cumulative }))} raceCount={seasonStandings?.raceNames.length || 0} />
          </div>

          <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
            <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.14em] text-fg-secondary">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
              Driver Standings Heatmap
            </div>
            <StandingsHeatmapLiteChart raceNames={seasonStandings?.raceNames || []} drivers={topSeasonStandings.map((driver) => ({ code: driver.code, color: driver.color, byRace: driver.byRace, totalPoints: driver.totalPoints }))} />
          </div>
        </>
      )}
    </section>
  )
}
