import React, { useEffect, useMemo, useRef } from 'react'
import { Cloud, Droplets, Gauge, Thermometer, Wind } from 'lucide-react'
import { useSessionTime } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'

function findLatestIndexAtOrBefore<T extends { timestamp: number }>(rows: T[], t: number): number {
  if (!rows.length) return -1
  if (t < rows[0].timestamp) return -1

  let lo = 0
  let hi = rows.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (rows[mid].timestamp <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

export const WeatherPanel = React.memo(function WeatherPanel() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const sessionTime = useSessionTime()

  const weatherSeries = useMemo(() => {
    const weather = sessionData?.weather
    if (!weather || weather.length === 0) return []
    const sorted = [...weather].sort((a, b) => a.timestamp - b.timestamp)
    return sorted
  }, [sessionData?.weather])

  const weatherIndexRef = useRef(0)
  const previousSessionTimeRef = useRef<number | null>(null)

  useEffect(() => {
    weatherIndexRef.current = 0
    previousSessionTimeRef.current = null
  }, [weatherSeries])

  const weather = useMemo(() => {
    if (!weatherSeries.length) return null

    const prevTime = previousSessionTimeRef.current
    let idx = Math.max(0, Math.min(weatherIndexRef.current, weatherSeries.length - 1))

    if (prevTime == null || sessionTime < prevTime) {
      const idxFromSearch = findLatestIndexAtOrBefore(weatherSeries, sessionTime)
      if (idxFromSearch < 0) {
        weatherIndexRef.current = 0
        previousSessionTimeRef.current = sessionTime
        return null
      }
      idx = idxFromSearch
      weatherIndexRef.current = idx
      previousSessionTimeRef.current = sessionTime
      return weatherSeries[idx]
    }

    while (idx + 1 < weatherSeries.length && weatherSeries[idx + 1].timestamp <= sessionTime) idx += 1
    while (idx > 0 && weatherSeries[idx].timestamp > sessionTime) idx -= 1

    weatherIndexRef.current = idx
    previousSessionTimeRef.current = sessionTime
    return weatherSeries[idx].timestamp <= sessionTime ? weatherSeries[idx] : null
  }, [weatherSeries, sessionTime])

  const ageSeconds = useMemo(() => {
    if (!weather) return null
    return Math.max(0, sessionTime - weather.timestamp)
  }, [weather, sessionTime])

  if (!weather) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-xl p-3 text-sm text-text-muted">
        No weather data
      </div>
    )
  }

  const tempColor = (temp: number) => {
    if (temp < 15) return '#0090ff'
    if (temp < 25) return '#a0a0a0'
    if (temp < 35) return '#ffd700'
    return '#ff1801'
  }

  const isRaining = weather.rainfall > 0

  const windCompass = (deg: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const idx = Math.round(deg / 45) % 8
    return dirs[idx]
  }

  return (
    <div className="glass-panel flex h-full flex-col rounded-[18px] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-text-secondary">Weather</span>
        <div className="flex items-center gap-1.5">
          {isRaining && (
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">RAIN</span>
          )}
          {ageSeconds != null && (
            <span className="font-mono text-[10px] text-text-muted">t-{ageSeconds.toFixed(1)}s</span>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <Thermometer size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Air</div>
            <div className="font-mono text-sm" style={{ color: tempColor(weather.airTemp) }}>
              {weather.airTemp.toFixed(1)}°C
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Thermometer size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Track</div>
            <div className="font-mono text-sm" style={{ color: tempColor(weather.trackTemp) }}>
              {weather.trackTemp.toFixed(1)}°C
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Droplets size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Humidity</div>
            <div className="font-mono text-sm text-text-primary">{weather.humidity}%</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Wind size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Wind</div>
            <div className="font-mono text-sm text-text-primary">
              {weather.windSpeed.toFixed(1)} m/s {windCompass(weather.windDirection)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Gauge size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Pressure</div>
            <div className="font-mono text-sm text-text-primary">{weather.pressure.toFixed(1)} hPa</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Cloud size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Rain</div>
            <div className={`font-mono text-sm ${isRaining ? 'text-blue-400' : 'text-green-400'}`}>
              {isRaining ? 'Yes' : 'Dry'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
