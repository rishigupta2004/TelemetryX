import React from 'react'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { WeatherPanel } from '../components/WeatherPanel'
import TimingTower from '../components/TimingTower'
import { useTimingData } from '../hooks/useTimingData'

export const TimingView = React.memo(function TimingView() {
  const timing = useTimingData()

  return (
    <div className="h-full w-full p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Live Classification</div>
        <div className="rounded border border-border bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">
          Timing + Track
        </div>
      </div>
      <div className="flex h-[calc(100%-1.5rem)] gap-3">
        {/* Timing Tower - Left side, ~35% width */}
        <div className="h-full min-h-0 w-[36%] min-w-[360px] max-w-[560px]">
          <TimingTower rows={timing.rows} status={timing.status} error={timing.error} />
        </div>

        {/* Track Map - Right side, larger prominence ~65% */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <TrackMap />
          </div>
          {/* Overlays - weather and race control as smaller panels */}
          <div className="flex h-[180px] flex-shrink-0 gap-2 pt-2">
            <div className="w-[200px] flex-shrink-0">
              <WeatherPanel />
            </div>
            <div className="min-w-0 flex-1">
              <RaceControlFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default TimingView
