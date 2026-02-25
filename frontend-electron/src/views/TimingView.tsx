import React from 'react'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'
import { WeatherPanel } from '../components/WeatherPanel'
import TimingTower from '../components/TimingTower'
import { useTimingData } from '../hooks/useTimingData'

export const TimingView = React.memo(function TimingView() {
  const timing = useTimingData()

  return (
    <div className="h-full w-full p-5 xl:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.24em] text-text-secondary">Live Classification</div>
        <div className="rounded-lg border border-border/70 bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
          Timing + Track
        </div>
      </div>

      <div className="flex h-[calc(100%-2.1rem)] gap-4 xl:gap-5">
        <div className="h-full min-h-0 min-w-[680px] flex-[1.14]">
          <ViewErrorBoundary viewName="Timing Tower">
            <TimingTower rows={timing.rows} status={timing.status} error={timing.error} />
          </ViewErrorBoundary>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="glass-panel relative min-h-0 flex-1 overflow-hidden rounded-2xl p-2.5">
            <ViewErrorBoundary viewName="Track Map">
              <TrackMap />
            </ViewErrorBoundary>
          </div>
          <div className="flex h-[248px] flex-shrink-0 gap-3 pt-3">
            <div className="w-[300px] flex-shrink-0">
              <ViewErrorBoundary viewName="Weather">
                <WeatherPanel compact />
              </ViewErrorBoundary>
            </div>
            <div className="min-w-0 flex-1">
              <ViewErrorBoundary viewName="Race Control">
                <RaceControlFeed />
              </ViewErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default TimingView
