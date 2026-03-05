import { describe, it, expect } from 'vitest'
import {
    formatMetricValue,
    formatLapTime,
    formatDelta,
    lbTs,
    ubTs,
    ubNum,
    lapAtTime,
} from '../../lib/telemetryUtils'
import type { TelemetryRow, LapRow } from '../../types'

// ── Formatting ──────────────────────────────────────────────────

describe('formatMetricValue', () => {
    it('formats binary values', () => {
        expect(formatMetricValue(1, 'binary')).toBe('ON')
        expect(formatMetricValue(0, 'binary')).toBe('OFF')
        expect(formatMetricValue(0.4, 'binary')).toBe('OFF')
        expect(formatMetricValue(0.5, 'binary')).toBe('ON')
    })

    it('formats RPM with commas', () => {
        expect(formatMetricValue(12500, 'rpm')).toBe('12,500')
        expect(formatMetricValue(12500, 'rpm', 'RPM')).toBe('12,500 RPM')
    })

    it('formats integer values', () => {
        expect(formatMetricValue(3.7, 'integer')).toBe('4')
    })

    it('formats percent values', () => {
        expect(formatMetricValue(85, 'percent')).toBe('85%')
    })

    it('formats default values', () => {
        expect(formatMetricValue(123.456, 'default')).toBe('123.5')
        expect(formatMetricValue(1500, 'default', 'km/h')).toBe('1500 km/h')
    })
})

describe('formatLapTime', () => {
    it('returns dash for invalid values', () => {
        expect(formatLapTime(null)).toBe('—')
        expect(formatLapTime(undefined)).toBe('—')
        expect(formatLapTime(0)).toBe('—')
        expect(formatLapTime(-5)).toBe('—')
    })

    it('formats seconds-only times', () => {
        expect(formatLapTime(45.123)).toBe('45.123')
    })

    it('formats minute:second times', () => {
        expect(formatLapTime(90.5)).toBe('1:30.500')
    })
})

describe('formatDelta', () => {
    it('returns dash for invalid values', () => {
        expect(formatDelta(null)).toBe('—')
        expect(formatDelta(undefined)).toBe('—')
    })

    it('formats positive deltas with +', () => {
        expect(formatDelta(0.5)).toBe('+0.500s')
    })

    it('formats negative deltas with −', () => {
        expect(formatDelta(-0.3)).toBe('−0.300s')
    })

    it('formats zero', () => {
        expect(formatDelta(0)).toBe('+0.000s')
    })
})

// ── Binary Search Helpers ───────────────────────────────────────

const makeRows = (timestamps: number[]): TelemetryRow[] =>
    timestamps.map((t) => ({
        timestamp: t, speed: 0, throttle: 0, brake: 0, gear: 0, rpm: 0, drs: 0
    }) as TelemetryRow)

describe('lbTs (lower-bound)', () => {
    it('finds first index >= t', () => {
        const rows = makeRows([1, 2, 3, 4, 5])
        expect(lbTs(rows, 3)).toBe(2)
        expect(lbTs(rows, 0)).toBe(0)
        expect(lbTs(rows, 6)).toBe(5)
    })

    it('handles empty array', () => {
        expect(lbTs([], 5)).toBe(0)
    })
})

describe('ubTs (upper-bound)', () => {
    it('finds first index > t', () => {
        const rows = makeRows([1, 2, 3, 4, 5])
        expect(ubTs(rows, 3)).toBe(3)
        expect(ubTs(rows, 0)).toBe(0)
        expect(ubTs(rows, 5)).toBe(5)
    })
})

describe('ubNum', () => {
    it('finds first index > t in number array', () => {
        expect(ubNum([10, 20, 30, 40], 20)).toBe(2)
        expect(ubNum([10, 20, 30, 40], 0)).toBe(0)
        expect(ubNum([10, 20, 30, 40], 50)).toBe(4)
    })
})

describe('lapAtTime', () => {
    const laps = [
        { lapNumber: 1, lapStartSeconds: 0, lapEndSeconds: 90 },
        { lapNumber: 2, lapStartSeconds: 90, lapEndSeconds: 180 },
        { lapNumber: 3, lapStartSeconds: 180, lapEndSeconds: 270 },
    ] as LapRow[]

    it('finds the lap containing the time', () => {
        const lap = lapAtTime(laps, 120)
        expect(lap?.lapNumber).toBe(2)
    })

    it('returns first lap at start boundary', () => {
        const lap = lapAtTime(laps, 0)
        expect(lap?.lapNumber).toBe(1)
    })

    it('returns last lap at end boundary', () => {
        const lap = lapAtTime(laps, 270)
        expect(lap?.lapNumber).toBe(3)
    })

    it('returns null for time outside all laps', () => {
        expect(lapAtTime(laps, 500)).toBeNull()
    })
})
