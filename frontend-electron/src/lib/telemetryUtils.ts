import type { LapRow, TelemetryRow } from '../types'

// ── Binary Search Utilities ─────────────────────────────────────

/** Lower-bound: first index where row.timestamp ≥ t */
export const lbTs = (rows: TelemetryRow[], t: number): number => {
    let lo = 0
    let hi = rows.length
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (rows[mid].timestamp < t) lo = mid + 1
        else hi = mid
    }
    return lo
}

/** Upper-bound: first index where row.timestamp > t */
export const ubTs = (rows: TelemetryRow[], t: number): number => {
    let lo = 0
    let hi = rows.length
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (rows[mid].timestamp <= t) lo = mid + 1
        else hi = mid
    }
    return lo
}

/** Upper-bound on a sorted number array */
export const ubNum = (vals: number[], t: number): number => {
    let lo = 0
    let hi = vals.length
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (vals[mid] <= t) lo = mid + 1
        else hi = mid
    }
    return lo
}

/** Find the lap that contains time t (binary search on lap ranges) */
export const lapAtTime = (laps: LapRow[], t: number): LapRow | null => {
    let lo = 0
    let hi = laps.length - 1
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const lap = laps[mid]
        if (lap.lapStartSeconds <= t && t <= lap.lapEndSeconds) return lap
        if (t < lap.lapStartSeconds) hi = mid - 1
        else lo = mid + 1
    }
    return null
}

// ── Channel Definitions ─────────────────────────────────────────

export type ChannelDefinition = {
    key: 'speed' | 'throttle' | 'brake' | 'gear' | 'rpm' | 'drs'
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

export const CHANNEL_KEYS = CHANNELS.map((c) => c.key)

// ── Type Aliases ────────────────────────────────────────────────

export type ChannelKey = typeof CHANNEL_KEYS[number]
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

// ── Formatting Functions ────────────────────────────────────────

export const formatMetricValue = (
    value: number,
    mode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary',
    unit?: string
): string => {
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
    const sign = seconds >= 0 ? '+' : '−'
    return `${sign}${Math.abs(seconds).toFixed(3)}s`
}

export const metricSubtitle = (
    primary: number[],
    compare: number[],
    mode: 'default' | 'percent' | 'integer' | 'rpm' | 'binary',
    unit: string | undefined,
    compareCode: string | null
): string => {
    if (!primary.length) return 'No points in current view'

    const cur = primary[primary.length - 1]
    const sum = primary.reduce((acc, v) => acc + v, 0)
    const avg = sum / primary.length

    if (mode === 'binary') {
        const onSamples = primary.reduce((acc, v) => acc + (v >= 0.5 ? 1 : 0), 0)
        const usage = (onSamples / primary.length) * 100
        let text = `Current ${formatMetricValue(cur, mode, unit)} | Active ${usage.toFixed(0)}%`
        if (compareCode && compare.length) {
            const compareOn = compare.reduce((acc, v) => acc + (v >= 0.5 ? 1 : 0), 0)
            const compareUsage = (compareOn / compare.length) * 100
            const delta = usage - compareUsage
            text += ` | vs ${compareCode} ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`
        }
        return text
    }

    const peak = Math.max(...primary)
    let text = `Current ${formatMetricValue(cur, mode, unit)} | Avg ${formatMetricValue(avg, mode, unit)} | Peak ${formatMetricValue(peak, mode, unit)}`
    if (compareCode && compare.length) {
        const cCur = compare[compare.length - 1]
        const delta = cur - cCur
        text += ` | vs ${compareCode} ${delta >= 0 ? '+' : ''}${formatMetricValue(delta, mode, unit)}`
    }
    return text
}
