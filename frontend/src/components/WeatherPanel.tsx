import React, { useEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'animejs'
import { useSessionTime2s } from '../lib/timeUtils'
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
  const sessionTime = useSessionTime2s()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isAnimatingIn, setIsAnimatingIn] = useState(true)

  useEffect(() => {
    if (isAnimatingIn && containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 300,
        easing: 'easeOutCubic',
        complete: () => setIsAnimatingIn(false)
      })
    }
  }, [isAnimatingIn])

  useEffect(() => {
    if (!isAnimatingIn && containerRef.current) {
      containerRef.current.style.opacity = '1'
    }
  }, [isAnimatingIn])

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

  const previousWeather = useMemo<WeatherRow | null>(() => {
    if (!weatherSeries.length || !weather) return null
    const idx = weatherSeries.indexOf(weather)
    return idx > 0 ? weatherSeries[idx - 1] : null
  }, [weatherSeries, weather])

  const getTrend = (curr: number, prev: number | undefined) => {
    if (prev === undefined || Math.abs(curr - prev) < 0.05) return null
    return curr > prev ? '↑' : '↓'
  }

  if (!weather) {
    return (
      <div className="flex h-full items-center justify-center p-2 bg-transparent text-center">
        <div>
          <div className="text-[10px] font-bold text-fg-secondary tracking-widest uppercase pb-1" style={{ fontFamily: 'var(--font-heading)' }}>No Data</div>
          <div className="text-[10px] font-mono text-fg-muted tracking-widest uppercase">Awaiting Weather Stream</div>
        </div>
      </div>
    )
  }

  const trackTempColor = (temp: number) => {
    if (temp < 25) return { bg: 'rgba(0,144,255,0.0)', text: '#60a5fa' }
    if (temp <= 40) return { bg: 'rgba(160,160,160,0.0)', text: '#a0a0a0' }
    return { bg: 'rgba(255,100,0,0.0)', text: '#fb923c' }
  }

  const isRaining = weather.rainfall > 0
  const trackTemp = trackTempColor(weather.trackTemp)

  if (compact) {
    return (
      <div className="flex flex-col p-1 w-full bg-transparent">
        <div className="mb-2 flex items-center justify-between border-b border-border-micro pb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>WEATHER</span>
          {isRaining && (
            <span className="text-[10px] font-mono tracking-widest text-blue-sel uppercase">RAIN DETECTED</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono">
          <div className="text-fg-primary flex justify-between">
            <span className="text-fg-muted">AIR</span> <span>{weather.airTemp.toFixed(1)}°C</span>
          </div>
          <div className="flex justify-between" style={{ color: trackTemp.text }}>
            <span className="text-fg-muted">TRK</span> <span>{weather.trackTemp.toFixed(1)}°C</span>
          </div>
          <div className="text-fg-muted flex justify-between">
            <span>HUM</span> <span className="text-fg-primary">{weather.humidity}%</span>
          </div>
          <div className="text-fg-muted flex justify-between">
            <span>WND</span> <span className="text-fg-primary">{weather.windSpeed.toFixed(1)} <span className="text-[9px]">{windCompass(weather.windDirection)}</span></span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col p-4 bg-transparent w-full" style={{ opacity: 0 }}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2 border-b border-border-hard pb-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>WEATHER STATION</span>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-[1px] bg-border-hard border border-border-hard">
        {/* Air Temp */}
        <div className="bg-bg-surface p-3 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="text-[10px] font-mono tracking-widest text-fg-muted mb-1">AIR TEMP</div>
          <div className="font-mono text-[16px] font-bold text-fg-primary leading-tight flex items-center gap-1">
            {weather.airTemp.toFixed(1)}°C
            <span className="text-[10px] text-fg-secondary">{getTrend(weather.airTemp, previousWeather?.airTemp)}</span>
          </div>
        </div>

        {/* Track Temp */}
        <div className="bg-bg-surface p-3 flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: trackTemp.bg }}>
          <div className="text-[10px] font-mono tracking-widest text-fg-muted mb-1">TRACK TEMP</div>
          <div className="font-mono text-[16px] font-bold leading-tight flex items-center gap-1" style={{ color: trackTemp.text }}>
            {weather.trackTemp.toFixed(1)}°C
            <span className="text-[10px] opacity-70">{getTrend(weather.trackTemp, previousWeather?.trackTemp)}</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-bg-surface p-3 flex flex-col items-center justify-center">
          <div className="text-[10px] font-mono tracking-widest text-fg-muted mb-1">HUMIDITY</div>
          <div className="font-mono text-[16px] font-bold text-fg-primary leading-tight">
            {weather.humidity}%
          </div>
        </div>

        {/* Wind */}
        <div className="bg-bg-surface p-3 flex flex-col items-center justify-center">
          <div className="text-[10px] font-mono tracking-widest text-fg-muted mb-1">WIND</div>
          <div className="font-mono text-[16px] font-bold text-fg-primary leading-tight">
            {weather.windSpeed.toFixed(1)}
          </div>
          <div className="font-mono text-[10px] text-fg-muted mt-0.5 tracking-widest">
            {windCompass(weather.windDirection)}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className={`mt-4 grid grid-cols-2 gap-[1px] bg-border-hard border border-border-hard ${isRaining ? 'shadow-[0_0_15px_rgba(33,150,243,0.3)] animate-pulse' : ''}`}>
        {/* Rainfall */}
        <div className={`bg-bg-surface px-3 py-2 flex justify-between items-center text-[10px] font-mono tracking-widest uppercase ${isRaining ? 'bg-blue-900/10' : ''}`}>
          <span className="text-fg-muted">RAIN</span>
          {isRaining ? (
            <span className="text-blue-sel font-bold flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-blue-sel animate-ping" />
              {weather.rainfall.toFixed(1)} MM
            </span>
          ) : (
            <span className="text-green-live">NONE</span>
          )}
        </div>

        {/* Pressure */}
        <div className="bg-bg-surface px-3 py-2 flex justify-between items-center text-[10px] font-mono tracking-widest uppercase">
          <span className="text-fg-muted">PRESS</span>
          <span className="text-fg-primary">{weather.pressure.toFixed(1)} hPa</span>
        </div>
      </div>
    </div>
  )
})
