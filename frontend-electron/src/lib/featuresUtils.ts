import type { Driver, LapRow } from '../types'

export const formatPct = (value: number | null | undefined): string => 
    value == null || !Number.isFinite(value) ? '-' : `${(Number(value) * 100).toFixed(1)}%`

export const formatSigned = (value: number | null | undefined, digits = 2): string =>
    value == null || !Number.isFinite(value) ? '-' : `${value > 0 ? '+' : ''}${Number(value).toFixed(digits)}`

export const normalizeName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export const median = (values: number[]): number => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export const movingAverage = (values: number[], windowSize = 3): number[] => {
    const out: number[] = []
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - windowSize + 1)
        const slice = values.slice(start, i + 1)
        out.push(slice.reduce((sum, v) => sum + v, 0) / slice.length)
    }
    return out
}

export const linearSlope = (xs: number[], ys: number[]): number => {
    if (xs.length < 2 || ys.length < 2 || xs.length !== ys.length) return 0
    const n = xs.length
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0)
    const denom = n * sumXX - sumX * sumX
    return Math.abs(denom) < 1e-9 ? 0 : (n * sumXY - sumX * sumY) / denom
}

export const quantile = (values: number[], q: number): number => {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const pos = (sorted.length - 1) * Math.max(0, Math.min(1, q))
    const lo = Math.floor(pos), hi = Math.ceil(pos)
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export const colorFromString = (input: string): string => {
    let hash = 0
    for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0
    return `hsl(${Math.abs(hash) % 360}, 75%, 58%)`
}

export const tyreColor = (compound: string): string => {
    const c = String(compound || '').toUpperCase()
    if (c.includes('SOFT')) return '#ef4444'
    if (c.includes('MEDIUM')) return '#facc15'
    if (c.includes('HARD')) return '#f5f5f5'
    if (c.includes('INTER')) return '#22c55e'
    if (c.includes('WET')) return '#3b82f6'
    return '#9ca3af'
}

export type PaceSeries = { code: string; color: string; laps: number[]; times: number[]; smoothed: number[]; median: number; slope: number; latestPosition: number; latestLap: number }
export type HoverTip = { x: number; y: number; title: string; detail?: string; color?: string }
export type SeasonStandingsDriver = { code: string; totalPoints: number; byRace: number[]; cumulative: number[]; color: string }
export type SeasonStandingsPayload = { raceNames: string[]; drivers: SeasonStandingsDriver[] }
export type TyreStintRow = { code: string; teamColor: string; stints: Array<{ startLap: number; endLap: number; laps: number; compound: string }> }

export type FeaturePanelId = 'overview' | 'race-pace' | 'lap-results' | 'strategy-ml' | 'clustering' | 'standings' | 'driver-intel' | 'undercut' | 'fia-docs'

export const FEATURE_PANELS: Array<{ id: FeaturePanelId; label: string; hint: string }> = [
    { id: 'overview', label: 'Overview', hint: 'All critical widgets in one screen' },
    { id: 'race-pace', label: 'Race Pace', hint: 'Lap evolution and degradation' },
    { id: 'lap-results', label: 'Lap + Results', hint: 'Scatter, distribution, positions, team pace' },
    { id: 'strategy-ml', label: 'Strategy ML', hint: 'Scenario map and model ranking' },
    { id: 'clustering', label: 'Clustering', hint: 'Driver performance clusters' },
    { id: 'standings', label: 'Standings', hint: 'Season progression and points heatmap' },
    { id: 'driver-intel', label: 'Driver Intel', hint: 'Driver summary and pit timeline' },
    { id: 'undercut', label: 'Undercut', hint: 'Predictive undercut model panel' },
    { id: 'fia-docs', label: 'FIA Docs', hint: 'Official FIA documents analytics' }
]

export const FEATURE_PANEL_IDS = new Set<FeaturePanelId>(FEATURE_PANELS.map((p) => p.id))
export const OVERVIEW_SPOTLIGHT = FEATURE_PANELS.filter((p) => p.id !== 'overview')

export const buildTyreTimeline = (laps: LapRow[], drivers: Array<{ code: string; driverNumber: number; teamColor: string }>): TyreStintRow[] => {
    if (!laps.length || !drivers.length) return []
    const byDriver = new Map<number, LapRow[]>()
    for (const lap of laps) {
        const rows = byDriver.get(lap.driverNumber) ?? []
        rows.push(lap)
        byDriver.set(lap.driverNumber, rows)
    }
    const out: TyreStintRow[] = []
    for (const driver of drivers) {
        const rows = (byDriver.get(driver.driverNumber) ?? [])
            .filter((row) => Number.isFinite(row.lapNumber) && row.lapNumber > 0)
            .sort((a, b) => a.lapNumber - b.lapNumber)
        if (!rows.length) continue
        const stints: TyreStintRow['stints'] = []
        let startLap = rows[0].lapNumber, prevLap = rows[0].lapNumber, compound = String(rows[0]. tyreCompound || 'UNKNOWN')
        for (let i = 1; i < rows.length; i++) {
            const lap = rows[i], lapNo = lap.lapNumber, comp = String(lap.tyreCompound || 'UNKNOWN')
            const contiguous = lapNo === prevLap + 1
            if (!contiguous || comp !== compound) {
                stints.push({ startLap, endLap: prevLap, laps: prevLap - startLap + 1, compound })
                startLap = lapNo; compound = comp
            }
            prevLap = lapNo
        }
        stints.push({ startLap, endLap: prevLap, laps: prevLap - startLap + 1, compound })
        out.push({ code: driver.code, teamColor: driver.teamColor || '#8aa7d1', stints })
    }
    return out.sort((a, b) => a.code.localeCompare(b.code))
}

export const buildPaceSeries = (sessionData: { laps?: LapRow[]; drivers?: Driver[] } | null): PaceSeries[] => {
    if (!sessionData?.laps?.length || !sessionData?.drivers?.length) return []
    const numberToDriver = new Map<number, Driver>()
    for (const driver of sessionData.drivers) numberToDriver.set(driver.driverNumber, driver)
    const buckets = new Map<string, LapRow[]>()
    for (const lap of sessionData.laps) {
        const driver = numberToDriver.get(lap.driverNumber)
        const code = driver?.code || String(lap.driverName || lap.driverNumber)
        if (!code) continue
        const lapTime = Number(lap.lapTime)
        if (!Number.isFinite(lapTime) || lapTime <= 40 || lapTime >= 200) continue
        const list = buckets.get(code) ?? []
        list.push(lap)
        buckets.set(code, list)
    }
    const series: PaceSeries[] = []
    for (const [code, rows] of buckets.entries()) {
        const sorted = [...rows].sort((a, b) => a.lapNumber - b.lapNumber)
        const laps = sorted.map((r) => r.lapNumber), times = sorted.map((r) => Number(r.lapTime))
        const smoothed = movingAverage(times, 3), refDriver = numberToDriver.get(sorted[0].driverNumber)
        const latest = sorted[sorted.length - 1]
        series.push({
            code, color: refDriver?.teamColor || '#8aa7d1', laps, times, smoothed,
            median: median(times), slope: linearSlope(laps, smoothed),
            latestPosition: Number.isFinite(latest.position) ? latest.position : 99, latestLap: latest.lapNumber
        })
    }
    return series.sort((a, b) => a.latestPosition !== b.latestPosition ? a.latestPosition - b.latestPosition : a.median - b.median)
}

export const toPath = (xValues: number[], yValues: number[], xMin: number, xMax: number, yMin: number, yMax: number, width: number, height: number): string => {
    if (!xValues.length || !yValues.length || xValues.length !== yValues.length) return ''
    const xSpan = Math.max(1, xMax - xMin), ySpan = Math.max(0.001, yMax - yMin)
    const points = xValues.map((x, idx) => {
        const y = yValues[idx]
        const px = ((x - xMin) / xSpan) * width
        const py = height - ((y - yMin) / ySpan) * height
        return `${px.toFixed(2)},${py.toFixed(2)}`
    })
    return `M ${points.join(' L ')}`
}

export const loadSavedPanel = (key: string): FeaturePanelId | null => {
    try {
        const raw = window.localStorage.getItem(key)
        return raw && FEATURE_PANEL_IDS.has(raw as FeaturePanelId) ? raw as FeaturePanelId : null
    } catch { return null }
}

export const savePanel = (key: string, panel: FeaturePanelId): void => {
    try { window.localStorage.setItem(key, panel) } catch { /* ignore */ }
}
