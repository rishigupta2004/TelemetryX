import React from 'react'
import { PanelIcons } from '../FeaturesView'

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

interface ClusteringPanelProps {
  tabAccent: string
  sessionData: any
  clusterData: any
  clusterLoading: boolean
  clusterError: string | null
  clustersById: any[]
}

export function ClusteringPanel({ tabAccent, sessionData, clusterData, clusterLoading, clusterError, clustersById }: ClusteringPanelProps) {
  return (
    <section className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 p-5 feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <PanelHeader title="Cluster Intelligence" subtitle="ML-based driver clustering by racing style and performance patterns" icon={PanelIcons['clustering']} accentColor={tabAccent} />
      {clusterLoading && (
        <div className="grid grid-cols-3 gap-4">
          <SkeletonLoader className="h-[80px]" /><SkeletonLoader className="h-[80px]" /><SkeletonLoader className="h-[80px]" />
        </div>
      )}
      {!clusterLoading && clusterError && <div className="text-xs text-red-400">{clusterError}</div>}

      {!clusterLoading && !clusterError && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
              <div className="text-[10px] uppercase text-fg-muted/70 mb-2">Silhouette</div>
              <div className="font-mono text-2xl text-fg-primary font-bold">{clusterData?.silhouette_score?.toFixed(3) || '-'}</div>
              <div className="text-[10px] text-fg-muted mt-1">Cluster quality</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
              <div className="text-[10px] uppercase text-fg-muted/70 mb-2">Clusters</div>
              <div className="font-mono text-2xl text-fg-primary font-bold">{clusterData?.n_clusters || '-'}</div>
              <div className="text-[10px] text-fg-muted mt-1">distinct groups</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
              <div className="text-[10px] uppercase text-fg-muted/70 mb-2">Session Drivers</div>
              <div className="font-mono text-2xl text-fg-primary font-bold">{sessionData?.drivers?.length || 0}</div>
              <div className="text-[10px] text-fg-muted mt-1">in current session</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {clustersById.map((cluster) => (
              <div key={cluster.clusterId} className="rounded-xl border border-border/40 bg-bg-raised/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-fg-primary font-semibold">Cluster {cluster.clusterId}</span>
                  <span className="font-mono text-[10px] text-fg-muted bg-bg-surface/50 px-2 py-0.5 rounded">in-session {cluster.sessionCount}/{cluster.totalCount}</span>
                </div>
                <div className="mb-3 h-2.5 rounded-lg bg-bg-surface/50 overflow-hidden">
                  <div className="h-full rounded-lg bg-gradient-to-r from-blue-500/60 to-blue-400/80" style={{ width: `${Math.max(4, Math.round((cluster.sessionCount / Math.max(1, cluster.totalCount)) * 100))}%`, boxShadow: '0 0 8px rgba(59,130,246,0.4)' }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cluster.topDrivers.map((driver: any) => (
                    <span key={`${cluster.clusterId}-${driver.name}`} className={`rounded-md px-2 py-1 text-[10px] ${driver.inSession ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-bg-surface/50 text-fg-muted border border-border/30'}`}>
                      {driver.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
