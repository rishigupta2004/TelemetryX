import React from 'react'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { WeatherPanel } from '../components/WeatherPanel'
import TimingTower from '../components/TimingTower'
import { useTimingData } from '../hooks/useTimingData'

export const TimingView = React.memo(function TimingView() {
  const timing = useTimingData()

  return (
    <div className="h-full w-full p-5 xl:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.24em] text-text-secondary">Live Classification</div>
        <div className="rounded-lg border border-border/70 bg-[#17315ab3] px-2.5 py-1 text-[11px] text-[#d3e7ff]">
          Timing + Track
        </div>
      </div>

      <div className="flex h-[calc(100%-2.1rem)] gap-4 xl:gap-5">
        <div className="h-full min-h-0 min-w-[680px] flex-[1.14]">
          <TimingTower rows={timing.rows} status={timing.status} error={timing.error} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="glass-panel relative min-h-0 flex-1 overflow-hidden rounded-2xl p-2.5">
            <TrackMap />
            <div className="pointer-events-none absolute bottom-3 right-3 z-20 h-[148px] w-[236px] overflow-hidden rounded-xl border border-white/15 bg-black/35 shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
              <TrackMap mode="minimap" />
            </div>
          </div>
          <div className="flex h-[248px] flex-shrink-0 gap-3 pt-3">
            <div className="w-[300px] flex-shrink-0">
              <WeatherPanel compact />
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
