import React, { useMemo } from 'react'
import { TrackMap } from '../components/TrackMap'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'
import { WeatherPanel } from '../components/WeatherPanel'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { useTimingData } from '../hooks/useTimingData'
import { useSessionTimeAt } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'

export const TrackView = React.memo(function TrackView() {
  const timing = useTimingData()
  const sessionTime = useSessionTimeAt(4)
  const laps = useSessionStore((s) => s.laps)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)

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

  const topRows = useMemo(() => timing.rows.slice(0, 10), [timing.rows])

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden p-1">
      {/* Map fills most of the view */}
      <div className="relative min-h-0 min-w-0 flex-[1_1_0%] rounded-md border border-border bg-bg-base p-1.5">
        <ViewErrorBoundary viewName="Track Map">
          <TrackMap />
        </ViewErrorBoundary>

        {/* HUD overlay - position order on track */}
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-3 top-3 w-[190px] rounded-md border border-border bg-bg-panel p-2 shadow-md">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-secondary">Order</span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              {topRows.map((row) => (
                <div key={row.driverNumber} className="flex items-center gap-2">
                  <div className="w-5 text-right font-mono text-fg-muted">{row.position}</div>
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: row.teamColor }} />
                  <div className="min-w-0 flex-1 truncate font-semibold text-fg-primary" style={{ fontFamily: 'var(--font-display)' }}>
                    {row.driverCode}
                  </div>
                  <div className="font-mono text-[10px] text-fg-muted">{row.interval}</div>
                </div>
              ))}
              {!topRows.length && (
                <div className="text-[10px] text-fg-muted">No classification data</div>
              )}
            </div>
          </div>

          {/* Bottom: lap counter */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="rounded border border-border bg-bg-panel px-4 py-1.5 text-[12px] font-semibold text-fg-secondary">
              Lap {currentLap ?? '—'} / {sessionMeta?.totalLaps ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Weather and Race Control — compact fixed height */}
      <div className="flex h-[130px] flex-shrink-0 gap-2 overflow-hidden">
        <div className="w-[240px] flex-shrink-0">
          <WeatherPanel compact />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <RaceControlFeed />
        </div>
      </div>
    </div>
  )
})
