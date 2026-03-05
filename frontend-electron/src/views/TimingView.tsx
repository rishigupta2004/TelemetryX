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
    <div className="flex h-full w-full flex-col overflow-hidden p-1 bg-bg-base">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>Live Classification</div>
        <div className="border border-border-hard bg-bg-surface px-2 py-1 text-[10px] font-mono tracking-[0.1em] text-fg-secondary uppercase uppercase">
          Timing · Track · Control
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Left column: Timing Tower — fixed 38%, no min-w */}
        <div className="min-h-0 min-w-0 flex-[0_0_38%] overflow-hidden">
          <ViewErrorBoundary viewName="Timing Tower">
            <TimingTower rows={timing.rows} status={timing.status} error={timing.error} />
          </ViewErrorBoundary>
        </div>

        {/* Center column: Track Map — takes remaining space */}
        <div className="min-h-0 min-w-0 flex-[1_1_0%]">
          <div className="relative h-full overflow-hidden border border-border-hard bg-bg-surface p-2">
            <ViewErrorBoundary viewName="Track Map">
              <TrackMap />
            </ViewErrorBoundary>
          </div>
        </div>

        {/* Right column: Weather + Race Control — fixed 22% */}
        <div className="flex min-h-0 min-w-0 flex-[0_0_22%] flex-col gap-3">
          <div className="flex-shrink-0 border border-border-hard bg-bg-surface p-2">
            <ViewErrorBoundary viewName="Weather">
              <WeatherPanel compact />
            </ViewErrorBoundary>
          </div>
          <div className="min-h-0 flex-1 border border-border-hard bg-bg-surface p-2">
            <ViewErrorBoundary viewName="Race Control">
              <RaceControlFeed />
            </ViewErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
})

export default TimingView
