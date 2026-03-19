import React, { useMemo } from 'react'
import { TrackMap } from '../components/TrackMap'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { WeatherPanel } from '../components/WeatherPanel'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'
import { useSessionTimeAt } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'

export const BroadcastView = React.memo(function BroadcastView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const sessionTime = useSessionTimeAt(4)
  const laps = useSessionStore((s) => s.laps)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)

  if (!sessionData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '13px'
      }}>
        Select a session to begin
      </div>
    )
  }

  const currentLap = useMemo(() => {
    if (!laps.length) return null
    let best = 0
    for (const lap of laps) {
      if (lap.lapEndSeconds <= sessionTime && lap.lapNumber > best) best = lap.lapNumber
    }
    if (best > 0) return best
    for (const lap of laps) {
      if (lap.lapStartSeconds <= sessionTime && sessionTime <= lap.lapEndSeconds) {
        return lap.lapNumber
      }
    }
    return null
  }, [laps, sessionTime])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Live Track Center</div>
        <div className="rounded border border-border bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">
          Broadcast + Control
        </div>
      </div>
      <div className="relative min-h-0 min-w-0 flex-[1_1_0%] border border-border-hard bg-bg-base panel-border p-1.5">
        <ViewErrorBoundary viewName="Broadcast Track Map">
          <TrackMap />
        </ViewErrorBoundary>
        <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2">
          <div className="px-6 py-2 text-[14px] font-bold bg-bg-panel border border-border-hard rounded-md text-fg-primary">
            LAP {currentLap ?? '—'} / {sessionMeta?.totalLaps ?? '—'}
          </div>
        </div>
      </div>
      <div className="flex h-[120px] flex-shrink-0 gap-2 overflow-hidden">
        <div className="w-[250px] flex-shrink-0">
          <WeatherPanel compact />
        </div>
        <div className="min-w-0 flex-1">
          <RaceControlFeed />
        </div>
      </div>
    </div>
  )
})

export default BroadcastView
