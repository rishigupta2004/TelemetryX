import type { LapRow, TelemetryRow } from '../types'

const binSearch = (arr: { timestamp?: number; lapEndSeconds?: number }[], t: number, inclusive: boolean): number => {
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const val = arr[mid].timestamp ?? arr[mid].lapEndSeconds ?? 0
    if (inclusive ? val <= t : val < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export const lbTs = <T extends { timestamp: number }>(rows: T[], t: number) => binSearch(rows, t, false)
export const ubTs = <T extends { timestamp: number }>(rows: T[], t: number) => binSearch(rows, t, true)
export const ubNum = (vals: number[], t: number) => binSearch(vals.map(v => ({ lapEndSeconds: v })), t, true)

export const lapAtTime = (laps: LapRow[], t: number): LapRow | null => {
  let lo = 0, hi = laps.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const lap = laps[mid]
    if (lap.lapStartSeconds <= t && t <= lap.lapEndSeconds) return lap
    if (t < lap.lapStartSeconds) hi = mid - 1
    else lo = mid + 1
  }
  return null
}

export const ubLaps = (laps: LapRow[], t: number): number => {
  let lo = 0, hi = laps.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((laps[mid].lapEndSeconds ?? 0) <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export const currentLap = (laps: LapRow[], t: number): LapRow | null => {
  let lo = 0, hi = laps.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const lap = laps[mid]
    if (lap.lapStartSeconds <= t && t < lap.lapEndSeconds) return lap
    if (t < lap.lapStartSeconds) hi = mid - 1
    else lo = mid + 1
  }
  return null
}

export type ChannelKey = 'speed' | 'throttle' | 'brake' | 'gear' | 'rpm' | 'drs'

export type ChannelDefinition = {
  key: ChannelKey
  title: string
  y?: [number, number]
  axisLabel: string
  tickMode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary'
  tickUnit?: string
  markers?: boolean
  stepped?: boolean
  fillColor?: string
}

export const CHANNELS: ChannelDefinition[] = [
  { key: 'speed', title: 'Speed', axisLabel: 'Speed (km/h)', tickMode: 'default', tickUnit: 'km/h', markers: true, y: [0, 350] },
  { key: 'throttle', title: 'Throttle', y: [0, 100], axisLabel: 'Throttle (%)', tickMode: 'percent' },
  { key: 'brake', title: 'Brake', y: [0, 100], axisLabel: 'Brake (%)', tickMode: 'percent', fillColor: 'rgba(232,0,45,0.2)' },
  { key: 'rpm', title: 'RPM', y: [0, 15000], axisLabel: 'Engine Speed (RPM)', tickMode: 'rpm' },
  { key: 'gear', title: 'Gear', y: [0, 8], axisLabel: 'Gear', tickMode: 'integer', stepped: true },
  { key: 'drs', title: 'DRS', y: [0, 1], axisLabel: 'DRS State', tickMode: 'binary', stepped: true }
]

export const CHANNEL_KEYS = CHANNELS.map(c => c.key) as ChannelKey[]
export type ChannelSelection = ChannelKey | 'deltaSpeed'
export type MetricKey = ChannelKey
export type MetricPair = { primary: number[]; compare: number[] }

export type Windowed = {
  lapT0: number
  lapT1: number
  fullLapDuration: number
  timestampsAbs: number[]
  timestampsRel: number[]
  distance: number[]
} & Record<MetricKey, MetricPair>

export type BuiltChart = {
  key: MetricKey | 'deltaSpeed'
  title: string
  yRange?: [number, number]
  yLabel: string
  yTickMode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary'
  yTickUnit?: string
  stepped?: boolean
  timestamps: number[]
  series: { label: string; data: number[]; color: string; width?: number }[]
  subtitle: string
  markers: { x: number; label?: string }[]
  shadingData?: { drs?: number[]; brake?: number[] }
}

export const formatMetricValue = (value: number, mode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary', unit?: string): string => {
  if (mode === 'binary') return value >= 0.5 ? 'ON' : 'OFF'
  if (mode === 'rpm') return `${Math.round(value).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`
  if (mode === 'integer') return `${Math.round(value)}${unit ? ` ${unit}` : ''}`
  if (mode === 'percent') return `${Math.round(value)}%`
  if (Math.abs(value) >= 1000) return `${Math.round(value)}${unit ? ` ${unit}` : ''}`
  return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`
}

export const formatLapTime = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs
}

export const formatDelta = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  return `${seconds >= 0 ? '+' : '−'}${Math.abs(seconds).toFixed(3)}s`
}

export const metricSubtitle = (primary: number[], compare: number[], mode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary', unit: string | undefined, compareCode: string | null): string => {
  if (!primary.length) return 'No points in current view'
  const cur = primary[primary.length - 1]
  const avg = primary.reduce((a, v) => a + v, 0) / primary.length

  if (mode === 'binary') {
    const onSamples = primary.reduce((a, v) => a + (v >= 0.5 ? 1 : 0), 0)
    const usage = (onSamples / primary.length) * 100
    let txt = `Current ${formatMetricValue(cur, mode, unit)} | Active ${usage.toFixed(0)}%`
    if (compareCode && compare.length) {
      const cOn = compare.reduce((a, v) => a + (v >= 0.5 ? 1 : 0), 0)
      const cUsage = (cOn / compare.length) * 100
      txt += ` | vs ${compareCode} ${cUsage - usage >= 0 ? '+' : ''}${(cUsage - usage).toFixed(0)}%`
    }
    return txt
  }

  const peak = Math.max(...primary)
  let txt = `Current ${formatMetricValue(cur, mode, unit)} | Avg ${formatMetricValue(avg, mode, unit)} | Peak ${formatMetricValue(peak, mode, unit)}`
  if (compareCode && compare.length) {
    const delta = cur - compare[compare.length - 1]
    txt += ` | vs ${compareCode} ${delta >= 0 ? '+' : ''}${formatMetricValue(delta, mode, unit)}`
  }
  return txt
}
