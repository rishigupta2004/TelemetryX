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
      <div className="grid h-[calc(100%-1.5rem)] min-h-0 grid-cols-[minmax(340px,36%)_minmax(0,1fr)] gap-2.5">
        <div className="h-full min-h-0 min-w-0">
          <TimingTower rows={timing.rows} status={timing.status} error={timing.error} />
        </div>

        <div className="flex min-w-0 flex-1 min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden rounded-md">
            <TrackMap />
          </div>
          <div className="grid h-[170px] min-h-0 flex-shrink-0 grid-cols-[minmax(220px,0.28fr)_minmax(0,1fr)] gap-2 pt-2 overflow-hidden">
            <div className="min-w-0">
              <WeatherPanel compact />
            </div>
            <div className="min-h-0 min-w-0 overflow-hidden">
              <RaceControlFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default TimingView
