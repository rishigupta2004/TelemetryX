import React from 'react'
import { UndercutPredictor } from '../../components/UndercutPredictor'
import { PanelIcons } from '../FeaturesView'

const PanelHeader = ({ title, subtitle, icon, accentColor }: { title: string; subtitle?: string; icon?: React.ReactNode; accentColor?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    {icon && (<div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accentColor ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)` : 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))', border: accentColor ? `1px solid ${accentColor}40` : '1px solid rgba(56,189,248,0.2)' }}><div style={{ color: accentColor || '#38bdf8' }}>{icon}</div></div>)}
    <div><div className="text-xs uppercase tracking-[0.18em] text-fg-secondary font-semibold">{title}</div>{subtitle && <div className="text-[11px] text-fg-muted mt-0.5">{subtitle}</div>}</div>
  </div>
)

export function UndercutPanel({ tabAccent }: { tabAccent: string }) {
  return (
    <section className="min-h-[620px] bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-4 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PanelHeader title="Undercut Decision Lab" subtitle="Validate model inputs, run predictions, and review recommendation confidence in one panel." icon={PanelIcons['undercut']} accentColor={tabAccent} />
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[10px] font-mono text-blue-400">Manual override enabled</div>
      </div>
      <UndercutPredictor />
    </section>
  )
}
