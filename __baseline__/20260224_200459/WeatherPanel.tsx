import React, { useEffect, useMemo, useRef } from 'react'
import { Cloud, Droplets, Gauge, Thermometer, Wind } from 'lucide-react'
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

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const WIND_CELL_WEIGHTS = [0.45, 0.6, 0.38, 0.52, 0.32, 0.55, 0.28, 0.42]

const windCompass = (deg: number) => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round(deg / 45) % 8
  return dirs[idx]
}

function WeatherMap({ weather, compact = false }: { weather: WeatherRow; compact?: boolean }) {
  const rainLevel = clamp(weather.rainfall / 1.2)
  const humidityLevel = clamp(weather.humidity / 100)
  const heatLevel = clamp((weather.trackTemp - 10) / 35)
  const windDeg = ((weather.windDirection % 360) + 360) % 360

  const rainAlpha = 0.08 + rainLevel * 0.28
  const heatAlpha = 0.08 + heatLevel * 0.24
  const humidityAlpha = 0.06 + humidityLevel * 0.2

  const mapBackground = `radial-gradient(circle at 25% 20%, rgba(56,189,248,${rainAlpha}), transparent 58%),
    radial-gradient(circle at 70% 75%, rgba(251,146,60,${heatAlpha}), transparent 60%),
    linear-gradient(140deg, rgba(148,163,184,${humidityAlpha}), rgba(15,23,42,0.95))`

  const showDetail = !compact

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-white/10 bg-[#0b1016] ${
        compact ? 'h-[76px]' : 'h-[120px]'
      }`}
    >
      <div className="absolute inset-0" style={{ background: mapBackground }} />
      <div className="absolute inset-[6px] grid grid-cols-4 grid-rows-2 gap-1">
        {WIND_CELL_WEIGHTS.map((weight, idx) => (
          <div
            key={idx}
            className="rounded-[3px] border border-white/5"
            style={{
              background: `linear-gradient(135deg, rgba(56,189,248,${rainAlpha * weight}), rgba(251,146,60,${
                heatAlpha * weight
              }))`
            }}
          />
        ))}
      </div>
      {showDetail && (
        <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Weather Map
        </div>
      )}
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] text-text-secondary">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: `rgba(56,189,248,${0.4 + rainLevel * 0.4})` }}
        />
        <span className="font-mono">{Math.round(weather.humidity)}% HUM</span>
      </div>
      <div className="absolute left-2 bottom-2 flex items-center gap-2 text-[9px] text-text-secondary">
        <div className="relative h-6 w-6 rounded-full border border-white/15 bg-white/5">
          <div
            className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translate(-50%, -50%) rotate(${windDeg}deg)` }}
          >
            <div className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 rounded bg-cyan-200/80 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
            <div className="absolute left-1/2 -top-1 h-0 w-0 -translate-x-1/2 border-x-[4px] border-x-transparent border-b-[6px] border-b-cyan-200/80" />
          </div>
        </div>
        <span className="font-mono text-[10px] text-text-muted">
          {windCompass(weather.windDirection)} {weather.windSpeed.toFixed(1)} m/s
        </span>
      </div>
      {showDetail && (
        <div className="absolute right-2 bottom-2 rounded-full border border-white/10 bg-black/35 px-1.5 py-0.5 text-[9px] text-text-secondary">
          Track {weather.trackTemp.toFixed(1)}°C
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-lg border border-white/5" />
    </div>
  )
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

  const ageSeconds = useMemo(() => {
    if (!weather) return null
    return Math.max(0, sessionTime - weather.timestamp)
  }, [weather, sessionTime])

  const weatherIndex = weather ? weatherSeries.findIndex((row) => row.timestamp === weather.timestamp) : -1
  const previousWeather = weatherIndex > 0 ? weatherSeries[weatherIndex - 1] : null

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
  const rainState = weather.rainfall >= 0.7 ? 'Heavy rain' : weather.rainfall > 0 ? 'Light rain' : 'Dry'
  const weatherFreshness =
    ageSeconds == null ? 'unknown' : ageSeconds <= 30 ? 'live' : ageSeconds <= 120 ? 'delayed' : 'stale'
  const weatherFreshnessStyle =
    weatherFreshness === 'live'
      ? 'bg-emerald-500/20 text-emerald-300'
      : weatherFreshness === 'delayed'
        ? 'bg-amber-500/20 text-amber-300'
        : 'bg-red-500/20 text-red-300'

  const trend = (curr: number, prev: number | null, decimals = 1): string => {
    if (prev == null || !Number.isFinite(prev)) return '--'
    const delta = curr - prev
    if (Math.abs(delta) < 1e-6) return '0.0'
    return `${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}`
  }

  if (compact) {
    return (
      <div className="glass-panel flex h-full flex-col rounded-[14px] p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-secondary">Weather</span>
          <div className="flex items-center gap-1">
            {isRaining && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">RAIN</span>
            )}
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${weatherFreshnessStyle}`}>
              {weatherFreshness}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div className="font-mono text-text-primary">Air {weather.airTemp.toFixed(1)}C</div>
          <div className="font-mono text-text-primary">Track {weather.trackTemp.toFixed(1)}C</div>
          <div className="font-mono text-text-muted">Hum {weather.humidity}%</div>
          <div className="font-mono text-text-muted">Wind {weather.windSpeed.toFixed(1)} m/s {windCompass(weather.windDirection)}</div>
        </div>
        <div className="mt-2">
          <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-text-muted">Weather Map</div>
          <WeatherMap weather={weather} compact />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel flex h-full flex-col rounded-[18px] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-text-secondary">Weather</span>
        <div className="flex items-center gap-1.5">
          {isRaining && (
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">RAIN</span>
          )}
          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${weatherFreshnessStyle}`}>
            {weatherFreshness}
          </span>
          {ageSeconds != null && (
            <span className="font-mono text-[10px] text-text-muted">t-{ageSeconds.toFixed(1)}s</span>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">Weather Map</div>
          <WeatherMap weather={weather} />
        </div>
        <div className="flex items-center gap-2">
          <Thermometer size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Air</div>
            <div className="flex items-center font-mono text-sm leading-tight" style={{ color: tempColor(weather.airTemp) }}>
              {weather.airTemp.toFixed(1)}°C 
              <span className="ml-1 text-[10px] text-text-muted">({trend(weather.airTemp, previousWeather?.airTemp ?? null)})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Thermometer size={14} className="flex-shrink-0 text-text-muted" />
          <div>
            <div className="text-[10px] uppercase text-text-muted">Track</div>
            <div className="flex items-center font-mono text-sm leading-tight" style={{ color: tempColor(weather.trackTemp) }}>
              {weather.trackTemp.toFixed(1)}°C 
              <span className="ml-1 text-[10px] text-text-muted">({trend(weather.trackTemp, previousWeather?.trackTemp ?? null)})</span>
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
              {rainState}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
