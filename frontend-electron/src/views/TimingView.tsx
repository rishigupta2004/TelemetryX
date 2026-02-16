import React from 'react'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { WeatherPanel } from '../components/WeatherPanel'
import TimingTower from '../components/TimingTower'
import { useTimingData } from '../hooks/useTimingData'

export const TimingView = React.memo(function TimingView() {
  const rows = useTimingData()

  return (
    <div className="h-full w-full p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Live Classification</div>
        <div className="rounded border border-border bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">
          Timing + Track
        </div>
      </div>
      <div className="flex h-[calc(100%-1.5rem)] gap-3">
        <div className="h-full min-h-0 w-[54%] min-w-[620px]">
          <TimingTower rows={rows} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <TrackMap />
          </div>
          <div className="flex h-[220px] flex-shrink-0 gap-2 pt-2">
            <div className="w-[240px] flex-shrink-0">
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
