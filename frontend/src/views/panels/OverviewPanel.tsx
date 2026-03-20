import React from 'react'
import { TrackMap } from '../../components/TrackMap'
import { StatCard } from '../../components/ui'
import { PanelIcons, OVERVIEW_SPOTLIGHT } from '../FeaturesView'
import type { FeaturePanelId } from '../../lib/featuresUtils'

const PanelHeader = ({ title, subtitle, icon, accentColor }: { title: string; subtitle?: string; icon?: React.ReactNode; accentColor?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    {icon && (
      <div 
        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ 
          background: accentColor ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` : 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))',
          border: accentColor ? `1px solid ${accentColor}40` : '1px solid rgba(56,189,248,0.2)'
        }}
      >
        <div style={{ color: accentColor || '#38bdf8' }}>{icon}</div>
      </div>
    )}
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">{title}</div>
      {subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}
    </div>
  </div>
)

interface OverviewPanelProps {
  selectedYear: number | null
  selectedRace: string | null
  selectedSession: string | null
  sessionData: any
  publishReadiness: Record<string, boolean | null>
  setActivePanel: (panel: FeaturePanelId) => void
}

export function OverviewPanel({ selectedYear, selectedRace, selectedSession, sessionData, publishReadiness, setActivePanel }: OverviewPanelProps) {
  const trackOverview = React.useMemo(() => {
    const geo = sessionData?.trackGeometry
    if (!geo) return null
    return {
      name: geo.name || 'Track',
      country: geo.country || '-',
      layoutYear: geo.layoutYear ?? null,
      source: geo.source || '-',
      corners: Array.isArray(geo.corners) ? geo.corners.length : 0,
      sectors: Array.isArray(geo.sectors) ? geo.sectors.length : 0,
      drsZones: Array.isArray(geo.drsZones) ? geo.drsZones.length : 0,
      trackWidth: geo.trackWidth ?? null
    }
  }, [sessionData?.trackGeometry])

  return (
    <section className="space-y-5">
      <div className="bg-gradient-to-br from-bg-surface/90 to-bg-surface/70 border border-border-hard/60 flex flex-wrap items-center justify-between gap-4 px-5 py-4 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">Session Overview</div>
          <div className="mt-1 text-[11px] text-fg-muted flex items-center gap-2">
            <span className="font-mono text-fg-primary/80">{selectedYear || '-'}</span>
            <span className="text-fg-muted/40">·</span>
            <span className="font-mono text-fg-primary/80">{selectedRace || '-'}</span>
            <span className="text-fg-muted/40">·</span>
            <span className="font-mono text-fg-primary/80">{selectedSession || '-'}</span>
            {sessionData?.drivers?.length && (<><span className="text-fg-muted/40">·</span><span className="text-fg-secondary">{sessionData.drivers.length} drivers</span></>)}
            {sessionData?.laps?.length && (<><span className="text-fg-muted/40">·</span><span className="text-fg-secondary">{sessionData.laps.length} laps</span></>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(publishReadiness).map(([key, status]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg border border-border/40 bg-bg-raised/50 px-3 py-1.5 text-[10px] font-mono">
              <span className={`inline-block h-2 w-2 rounded-full ${status === true ? 'bg-green-400 shadow-lg shadow-green-400/40' : status === false ? 'bg-red-400 shadow-lg shadow-red-400/40' : 'bg-fg-muted animate-pulse'}`} />
              <span className="uppercase text-fg-secondary">{key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Drivers" value={sessionData?.drivers?.length ?? '—'} unit="Active in session" accentColor="blue" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>} />
        <StatCard label="Laps" value={sessionData?.laps?.length ?? '—'} unit="Recorded laps" accentColor="cyan" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />
        <StatCard label="Telemetry" value={sessionData?.metadata?.telemetryAvailable ? 'LIVE' : 'LIMITED'} unit={sessionData?.metadata?.telemetryUnavailableReason ?? 'Available'} accentColor="green" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />
        <StatCard label="Session Length" value={sessionData?.metadata?.duration ? (sessionData.metadata.duration / 60).toFixed(1) : '—'} unit={sessionData?.metadata?.duration ? 'min total duration' : ''} accentColor="purple" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <div className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 overflow-hidden" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-3" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-fg-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary font-semibold">Track Intelligence Map</div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-fg-muted font-mono">
              {trackOverview?.name && <span className="text-fg-secondary font-medium">{trackOverview.name}</span>}
              {trackOverview?.country && <span className="text-fg-muted">· {trackOverview.country}</span>}
              <span className="text-fg-muted/50 ml-2">Click driver to select · Ctrl+click to compare</span>
            </div>
          </div>
          <div className="h-[480px]"><TrackMap /></div>
        </div>

        <div className="space-y-4">
          {trackOverview ? (
            <>
              <div className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-4 space-y-4" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fg-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary font-semibold">Circuit Data</div>
                </div>
                {[
                  { label: 'Track', value: trackOverview.name },
                  { label: 'Country', value: trackOverview.country },
                  { label: 'Corners', value: trackOverview.corners ? String(trackOverview.corners) : '-' },
                  { label: 'DRS Zones', value: trackOverview.drsZones ? String(trackOverview.drsZones) : '-' },
                  { label: 'Sectors', value: trackOverview.sectors ? String(trackOverview.sectors) : '3' },
                  { label: 'Track Width', value: trackOverview.trackWidth != null ? `${trackOverview.trackWidth.toFixed(1)} m` : '-' },
                  { label: 'Layout Year', value: trackOverview.layoutYear != null ? String(trackOverview.layoutYear) : '-' },
                  { label: 'Data Source', value: trackOverview.source },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-border/20 last:border-0">
                    <span className="text-[10px] uppercase text-fg-muted/70">{label}</span>
                    <span className="font-mono text-[11px] text-fg-primary truncate max-w-[160px] text-right">{value || '-'}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-4 space-y-3" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-fg-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary font-semibold">Track Flags Legend</div>
                </div>
                {[
                  { color: 'bg-red-500', label: 'Red Flag — Race stopped' },
                  { color: 'bg-orange-400', label: 'Safety Car deployed' },
                  { color: 'bg-yellow-400', label: 'VSC / Yellow sector' },
                  { color: 'bg-green-500', label: 'Green — Track clear' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-3 text-[10px] text-fg-muted">
                    <span className={`h-2.5 w-5 rounded-sm ${color} opacity-90 flex-shrink-0 shadow-sm`} />
                    {label}
                  </div>
                ))}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-fg-muted">
                  <span className="h-2.5 w-5 rounded-sm flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(90deg, rgba(0,220,90,0.9) 0%, rgba(0,200,80,0.3) 100%)' }} />
                  DRS zone (green overlay)
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 text-[11px] text-fg-muted" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              Load a session to see circuit data
            </div>
          )}

          <div className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-4 space-y-2" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-fg-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary font-semibold">Analytics Panels</div>
            </div>
            {OVERVIEW_SPOTLIGHT.map((panel) => (
              <button key={panel.id} type="button" onClick={() => setActivePanel(panel.id)} className="group flex w-full items-center justify-between rounded-lg border border-border/30 bg-bg-raised/40 px-3 py-2.5 text-left transition-all hover:border-white/20 hover:bg-bg-raised/60 hover:shadow-lg">
                <span className="text-[11px] font-semibold text-fg-secondary group-hover:text-fg-primary flex items-center gap-2">
                  {PanelIcons[panel.id] && <span className="opacity-60 group-hover:opacity-100 transition-opacity">{PanelIcons[panel.id]}</span>}
                  {panel.label}
                </span>
                <span className="text-[10px] text-fg-muted/60 group-hover:text-fg-muted transition-colors">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
