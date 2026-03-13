import React from 'react'
import { DriverSummary } from '../../components/DriverSummary'
import { PitStrategy } from '../../components/PitStrategy'
import { PanelIcons } from '../FeaturesView'

const PanelHeader = ({ title, subtitle, icon, accentColor }: { title: string; subtitle?: string; icon?: React.ReactNode; accentColor?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    {icon && (<div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accentColor ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` : 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))', border: accentColor ? `1px solid ${accentColor}40` : '1px solid rgba(56,189,248,0.2)' }}><div style={{ color: accentColor || '#38bdf8' }}>{icon}</div></div>)}
    <div><div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">{title}</div>{subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}</div>
  </div>
)

export function DriverIntelPanel({ tabAccent }: { tabAccent: string }) {
  return (
    <section className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-4 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PanelHeader title="Driver Intelligence Workspace" subtitle="Snapshot and strategy timeline share the same session window and driver selection." icon={PanelIcons['driver-intel']} accentColor={tabAccent} />
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[10px] font-mono text-green-400">Real-time data bound</div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-h-[560px] rounded-xl border border-border/40 bg-[#050810] p-3 overflow-hidden" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}><DriverSummary /></div>
        <div className="min-h-[560px] rounded-xl border border-border/40 bg-[#050810] p-3 overflow-hidden" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}><PitStrategy /></div>
      </div>
    </section>
  )
}
