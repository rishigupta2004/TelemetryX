import React from 'react'
import { TrackMap } from '../../components/TrackMap'
import { RacePaceLiteChart } from '../../components/FeaturesLiteCharts'
import { PanelIcons } from '../FeaturesView'
import { formatSigned } from '../../lib/featuresUtils'
import type { PaceSeries } from '../../lib/featuresUtils'

const PanelHeader = ({ title, subtitle, icon, accentColor }: { title: string; subtitle?: string; icon?: React.ReactNode; accentColor?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    {icon && (
      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accentColor ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` : 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))', border: accentColor ? `1px solid ${accentColor}40` : '1px solid rgba(56,189,248,0.2)' }}>
        <div style={{ color: accentColor || '#38bdf8' }}>{icon}</div>
      </div>
    )}
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">{title}</div>
      {subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}
    </div>
  </div>
)

interface RacePacePanelProps {
  tabAccent: string
  primaryDriver: string | null
  compareDriver: string | null
  racePaceSeries: PaceSeries[]
  visibleRacePaceSeries: PaceSeries[]
  paceBounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  paceHighlights: { bestMedian: PaceSeries | null; mostDeg: PaceSeries | null }
  weatherSnapshot: any
  trackOverview: any
  circuitInsights: any
}

export function RacePacePanel({ tabAccent, primaryDriver, compareDriver, visibleRacePaceSeries, paceBounds, paceHighlights, weatherSnapshot, trackOverview, circuitInsights }: RacePacePanelProps) {
  return (
    <section className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <PanelHeader title="Race Pace Explorer" subtitle="Smoothed lap-time evolution (3-lap rolling) with degradation trend" icon={PanelIcons['race-pace']} accentColor={tabAccent} />
      <div className="flex flex-wrap gap-2 mb-4 text-[10px] text-fg-muted">
        {weatherSnapshot && (<span className="rounded-lg border border-border/40 bg-bg-raised/50 px-3 py-1.5"><span className="text-fg-secondary">Air</span> {weatherSnapshot.airTemp.toFixed(1)}°C · <span className="text-fg-secondary">Track</span> {weatherSnapshot.trackTemp.toFixed(1)}°C</span>)}
        <span className="rounded-lg border border-border/40 bg-bg-raised/50 px-3 py-1.5">Drivers <span className="text-fg-primary font-medium">{visibleRacePaceSeries.length}</span></span>
        <span className="rounded-lg border border-border/40 bg-bg-raised/50 px-3 py-1.5">Lap <span className="text-fg-primary font-medium">{paceBounds.xMin}</span>-<span className="text-fg-primary font-medium">{paceBounds.xMax}</span></span>
      </div>

      {visibleRacePaceSeries.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-xl border border-border/30 bg-bg-raised/20 text-sm text-fg-muted">No lap-time race pace data available for this session</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border/30 bg-[#050810] p-3" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
            <RacePaceLiteChart series={visibleRacePaceSeries.map((item) => ({ code: item.code, color: item.color, laps: item.laps, smoothed: item.smoothed }))} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3">
              <div className="text-[10px] uppercase text-fg-muted/70 mb-1">Best Race Pace</div>
              <div className="font-mono text-base text-fg-primary font-semibold">{paceHighlights.bestMedian?.code || '-'}</div>
              <div className="text-[11px] text-fg-muted mt-1">median {paceHighlights.bestMedian?.median?.toFixed(3) ?? '-'}s</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3">
              <div className="text-[10px] uppercase text-fg-muted/70 mb-1">Highest Degradation</div>
              <div className="font-mono text-base text-fg-primary font-semibold">{paceHighlights.mostDeg?.code || '-'}</div>
              <div className="text-[11px] text-fg-muted mt-1">slope {formatSigned(paceHighlights.mostDeg?.slope, 3)} s/lap</div>
            </div>
          </div>

          <div className="space-y-1.5 overflow-y-auto rounded-xl border border-border/30 bg-bg-raised/30 p-3 text-xs max-h-[320px]">
            <div className="grid grid-cols-[40px_1fr_80px] gap-2 text-[10px] uppercase text-fg-muted/60 px-2 pb-2 border-b border-border/20 mb-2">
              <span>Code</span><span>Stats</span><span className="text-right">Position</span>
            </div>
            {visibleRacePaceSeries.map((item) => {
              const highlighted = item.code === primaryDriver || item.code === compareDriver
              return (
                <div key={item.code} className={`rounded-lg px-3 py-2.5 transition-all ${highlighted ? 'bg-bg-raised/60 border border-border/40 shadow-md' : 'hover:bg-bg-raised/30'}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color, boxShadow: highlighted ? `0 0 8px ${item.color}` : 'none' }} />
                      <span className="font-mono text-fg-primary font-semibold">{item.code}</span>
                    </div>
                    <span className="font-mono text-[10px] text-fg-muted bg-bg-surface/50 px-2 py-0.5 rounded">P{item.latestPosition}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-fg-muted">
                    <span>Median <span className="text-fg-secondary font-mono">{item.median.toFixed(3)}s</span></span>
                    <span>Trend <span className="text-fg-secondary font-mono">{formatSigned(item.slope, 3)}</span></span>
                    <span>Laps <span className="text-fg-secondary font-mono">{item.laps.length}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

interface TrackMapPanelProps {
  tabAccent: string
  trackOverview: any
  primaryDriver: string | null
  compareDriver: string | null
  circuitInsights: any
}

export function TrackMapPanel({ tabAccent, trackOverview, primaryDriver, compareDriver, circuitInsights }: TrackMapPanelProps) {
  return (
    <section className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <PanelHeader title="Track Intelligence Map" subtitle="Live map is now inside Features workspace: click for primary, Ctrl/Cmd+click for compare" icon={PanelIcons['race-pace']} accentColor={tabAccent} />
      <div className="flex flex-col gap-4">
        <div className="h-[560px] min-h-[460px] rounded-xl border border-border/40 bg-[#06080c] overflow-hidden" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}>
          <TrackMap />
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3"><div className="text-[10px] uppercase text-fg-muted/70 mb-1">Corners</div><div className="font-mono text-lg text-fg-primary font-semibold">{trackOverview?.corners ?? '-'}</div></div>
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3"><div className="text-[10px] uppercase text-fg-muted/70 mb-1">DRS Zones</div><div className="font-mono text-lg text-fg-primary font-semibold">{trackOverview?.drsZones ?? '-'}</div></div>
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3"><div className="text-[10px] uppercase text-fg-muted/70 mb-1">Sectors</div><div className="font-mono text-lg text-fg-primary font-semibold">{trackOverview?.sectors ?? '-'}</div></div>
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3"><div className="text-[10px] uppercase text-fg-muted/70 mb-1">Track Width</div><div className="font-mono text-lg text-fg-primary font-semibold">{trackOverview?.trackWidth != null ? `${trackOverview.trackWidth.toFixed(1)} m` : '-'}</div></div>
          </div>

          <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3 text-xs">
            <div className="text-[10px] uppercase text-fg-muted/70 mb-3">Context</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
              <span className="text-fg-muted">Country</span><span className="font-mono text-fg-primary">{trackOverview?.country || '-'}</span>
              <span className="text-fg-muted">Layout Year</span><span className="font-mono text-fg-primary">{trackOverview?.layoutYear ?? '-'}</span>
              <span className="text-fg-muted">Geometry Source</span><span className="truncate font-mono text-fg-primary">{trackOverview?.source || '-'}</span>
              <span className="text-fg-muted">Primary</span><span className="font-mono text-fg-primary">{primaryDriver || '-'}</span>
              <span className="text-fg-muted">Compare</span><span className="font-mono text-fg-primary">{compareDriver || '-'}</span>
            </div>
          </div>

          {circuitInsights && circuitInsights.facts && (
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-3 text-xs">
              <div className="text-[10px] uppercase text-fg-muted/70 mb-3">Circuit Facts</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                <span className="text-fg-muted">Length</span><span className="font-mono text-fg-primary">{circuitInsights.facts['Circuit Length'] ?? '-'}</span>
                <span className="text-fg-muted">Race Distance</span><span className="font-mono text-fg-primary">{circuitInsights.facts['Race Distance'] ?? '-'}</span>
                <span className="text-fg-muted">Laps</span><span className="font-mono text-fg-primary">{circuitInsights.facts['Number of Laps'] ?? '-'}</span>
                <span className="text-fg-muted">First GP</span><span className="font-mono text-fg-primary">{circuitInsights.facts['First Grand Prix'] ?? '-'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
