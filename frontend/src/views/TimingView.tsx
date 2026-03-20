import React from 'react'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { WeatherPanel } from '../components/WeatherPanel'
import TimingTower from '../components/TimingTower'
import { useTimingData } from '../hooks/useTimingData'
import { useSessionStore } from '../stores/sessionStore'

export const TimingView = React.memo(function TimingView() {
  const timing = useTimingData()
  const sessionData = useSessionStore((s) => s.sessionData)
  const weather = sessionData?.weather?.at(-1)

  return (
    <div className="h-full w-full p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Live Classification</div>
        <div className="rounded border border-border bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">
          Timing + Track
        </div>
      </div>
      <div className="grid h-[calc(100%-1.5rem)] min-h-0 grid-cols-[minmax(560px,43%)_minmax(0,1fr)] gap-2.5">
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <TimingTower rows={timing.rows} status={timing.status} error={timing.error} />
          </div>
          <div className="flex gap-2 border-t border-border px-2 py-1 text-[10px] text-text-muted">
            <span>AIR {typeof weather?.airTemp === 'number' ? weather.airTemp.toFixed(1) : '—'}°C</span>
            <span>TRK {typeof weather?.trackTemp === 'number' ? weather.trackTemp.toFixed(1) : '—'}°C</span>
            <span>HUM {typeof weather?.humidity === 'number' ? weather.humidity : '—'}%</span>
            <span>WND {typeof weather?.windSpeed === 'number' ? weather.windSpeed.toFixed(1) : '—'}</span>
          </div>
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
