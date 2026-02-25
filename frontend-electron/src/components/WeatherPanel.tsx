import React, { useEffect, useMemo, useRef } from 'react'
import { useSessionTime } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'
import type { WeatherRow } from '../types'

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

const windCompass = (deg: number) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const idx = Math.round(((deg % 360 + 360) % 360) / 22.5) % 16
  return dirs[idx]
}

interface WeatherPanelProps {
  compact?: boolean
}

export const WeatherPanel = React.memo(function WeatherPanel({ compact = false }: WeatherPanelProps) {
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

  const weather = useMemo<WeatherRow | null>(() => {
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

  if (!weather) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-xl p-4">
        <div className="text-center">
          <div className="text-2xl mb-2">🌤</div>
          <div className="text-sm font-semibold text-text-secondary">No weather data for this session</div>
          <div className="mt-1 text-xs text-text-muted">Weather readings will appear here when available</div>
        </div>
      </div>
    )
  }

  const trackTempColor = (temp: number) => {
    if (temp < 25) return { bg: 'rgba(0,144,255,0.12)', text: '#60a5fa' }
    if (temp <= 40) return { bg: 'rgba(160,160,160,0.08)', text: '#a0a0a0' }
    return { bg: 'rgba(255,100,0,0.12)', text: '#fb923c' }
  }

  const isRaining = weather.rainfall > 0
  const trackTemp = trackTempColor(weather.trackTemp)
  const trackName = sessionData?.trackGeometry?.name || sessionData?.metadata?.raceName || 'Circuit'

  if (compact) {
    return (
      <div className="glass-panel flex h-full flex-col rounded-[14px] p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-secondary">Weather</span>
          {isRaining && (
            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">🌧 RAIN</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div className="font-mono text-text-primary">🌡 {weather.airTemp.toFixed(1)}°C</div>
          <div className="font-mono" style={{ color: trackTemp.text }}>🔥 {weather.trackTemp.toFixed(1)}°C</div>
          <div className="font-mono text-text-muted">💧 {weather.humidity}%</div>
          <div className="font-mono text-text-muted">💨 {weather.windSpeed.toFixed(1)} m/s {windCompass(weather.windDirection)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel flex h-full flex-col rounded-[18px] p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Weather</span>
        <span className="text-[10px] text-text-muted">·</span>
        <span className="text-[11px] text-text-muted truncate">{trackName}</span>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Air Temp */}
        <div className="rounded-lg border border-border/60 bg-bg-card/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1">🌡 Air Temp</div>
          <div className="font-mono text-lg font-semibold text-text-primary leading-tight">
            {weather.airTemp.toFixed(1)}°C
          </div>
        </div>

        {/* Track Temp */}
        <div className="rounded-lg border border-border/60 p-3" style={{ backgroundColor: trackTemp.bg }}>
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1">🔥 Track</div>
          <div className="font-mono text-lg font-semibold leading-tight" style={{ color: trackTemp.text }}>
            {weather.trackTemp.toFixed(1)}°C
          </div>
        </div>

        {/* Humidity */}
        <div className="rounded-lg border border-border/60 bg-bg-card/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1">💧 Humidity</div>
          <div className="font-mono text-lg font-semibold text-text-primary leading-tight">
            {weather.humidity}%
          </div>
        </div>

        {/* Wind */}
        <div className="rounded-lg border border-border/60 bg-bg-card/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1">💨 Wind</div>
          <div className="font-mono text-lg font-semibold text-text-primary leading-tight">
            {weather.windSpeed.toFixed(1)} m/s
          </div>
          <div className="font-mono text-[11px] text-text-muted mt-0.5">
            {windCompass(weather.windDirection)}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* Rainfall */}
        <div className="rounded-lg border border-border/60 bg-bg-card/50 px-3 py-2.5 flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">🌧 Rainfall</div>
          {isRaining ? (
            <div className="font-mono text-sm font-semibold text-blue-300">{weather.rainfall.toFixed(1)} mm</div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-sm text-emerald-300">None</span>
            </div>
          )}
        </div>

        {/* Pressure */}
        <div className="rounded-lg border border-border/60 bg-bg-card/50 px-3 py-2.5 flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">📊 Pressure</div>
          <div className="font-mono text-sm font-semibold text-text-primary">{weather.pressure.toFixed(1)} hPa</div>
        </div>
      </div>
    </div>
  )
})
