import { describe, it, expect } from 'vitest'
import {
    median,
    movingAverage,
    linearSlope,
    quantile,
    formatPct,
    formatSigned,
    normalizeName,
    colorFromString,
    tyreColor,
    toPath,
    buildTyreTimeline,
} from '../../lib/featuresUtils'
import type { LapRow } from '../../types'

// ── Math Utilities ──────────────────────────────────────────────

describe('median', () => {
    it('returns 0 for empty array', () => {
        expect(median([])).toBe(0)
    })

    it('returns middle value for odd-length array', () => {
        expect(median([3, 1, 2])).toBe(2)
    })

    it('returns average of middle two for even-length array', () => {
        expect(median([1, 2, 3, 4])).toBe(2.5)
    })
})

describe('movingAverage', () => {
    it('returns same length array', () => {
        const result = movingAverage([1, 2, 3, 4, 5], 3)
        expect(result).toHaveLength(5)
    })

    it('first value equals itself', () => {
        const result = movingAverage([10, 20, 30], 3)
        expect(result[0]).toBe(10)
    })

    it('averages within window', () => {
        const result = movingAverage([10, 20, 30], 3)
        // [10, (10+20)/2, (10+20+30)/3]
        expect(result[1]).toBe(15)
        expect(result[2]).toBe(20)
    })
})

describe('linearSlope', () => {
    it('returns 0 for too few points', () => {
        expect(linearSlope([1], [1])).toBe(0)
    })

    it('calculates positive slope', () => {
        const slope = linearSlope([1, 2, 3], [2, 4, 6])
        expect(slope).toBeCloseTo(2)
    })

    it('returns 0 for flat line', () => {
        const slope = linearSlope([1, 2, 3], [5, 5, 5])
        expect(slope).toBeCloseTo(0)
    })
})

describe('quantile', () => {
    it('returns 0 for empty array', () => {
        expect(quantile([], 0.5)).toBe(0)
    })

    it('returns median at q=0.5', () => {
        expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    })

    it('returns min at q=0', () => {
        expect(quantile([1, 2, 3], 0)).toBe(1)
    })

    it('returns max at q=1', () => {
        expect(quantile([1, 2, 3], 1)).toBe(3)
    })
})

// ── Formatting ──────────────────────────────────────────────────

describe('formatPct', () => {
    it('returns dash for null/undefined', () => {
        expect(formatPct(null)).toBe('-')
        expect(formatPct(undefined)).toBe('-')
    })
    it('formats 0.85 as 85.0%', () => {
        expect(formatPct(0.85)).toBe('85.0%')
    })
})

describe('formatSigned', () => {
    it('returns dash for null', () => {
        expect(formatSigned(null)).toBe('-')
    })
    it('adds + for positive values', () => {
        expect(formatSigned(1.5)).toBe('+1.50')
    })
    it('keeps - for negative values', () => {
        expect(formatSigned(-0.3)).toBe('-0.30')
    })
})

describe('normalizeName', () => {
    it('lowercases and strips non-alphanumeric', () => {
        expect(normalizeName('Max Verstappen')).toBe('maxverstappen')
        expect(normalizeName("L. O'Brien")).toBe('lobrien')
    })
})

// ── Color ───────────────────────────────────────────────────────

describe('colorFromString', () => {
    it('returns a consistent HSL color', () => {
        const c1 = colorFromString('VER')
        const c2 = colorFromString('VER')
        expect(c1).toBe(c2)
        expect(c1).toMatch(/^hsl\(\d+, 75%, 58%\)$/)
    })

    it('returns different colors for different inputs', () => {
        expect(colorFromString('VER')).not.toBe(colorFromString('HAM'))
    })
})

describe('tyreColor', () => {
    it('maps known compounds to correct colors', () => {
        expect(tyreColor('SOFT')).toBe('#ef4444')
        expect(tyreColor('MEDIUM')).toBe('#facc15')
        expect(tyreColor('HARD')).toBe('#f5f5f5')
        expect(tyreColor('INTERMEDIATE')).toBe('#22c55e')
        expect(tyreColor('WET')).toBe('#3b82f6')
    })

    it('returns default for unknown compound', () => {
        expect(tyreColor('UNKNOWN')).toBe('#9ca3af')
    })
})

// ── SVG Path ────────────────────────────────────────────────────

describe('toPath', () => {
    it('returns empty string for empty arrays', () => {
        expect(toPath([], [], 0, 1, 0, 1, 100, 100)).toBe('')
    })

    it('generates M L path for 3 points', () => {
        const path = toPath([0, 1, 2], [0, 50, 100], 0, 2, 0, 100, 200, 100)
        expect(path).toMatch(/^M /)
        expect(path).toContain(' L ')
        // Should have 3 coordinate pairs
        expect(path.split(/[ML]\s*/).filter(Boolean)).toHaveLength(3)
    })
})

// ── Data Builders ───────────────────────────────────────────────

describe('buildTyreTimeline', () => {
    it('returns empty for empty inputs', () => {
        expect(buildTyreTimeline([], [])).toEqual([])
    })

    it('builds stints from lap data', () => {
        const drivers = [{ code: 'VER', driverNumber: 1, teamColor: '#1e41ff' }]
        const laps = [
            { driverNumber: 1, lapNumber: 1, tyreCompound: 'SOFT' },
            { driverNumber: 1, lapNumber: 2, tyreCompound: 'SOFT' },
            { driverNumber: 1, lapNumber: 3, tyreCompound: 'MEDIUM' },
            { driverNumber: 1, lapNumber: 4, tyreCompound: 'MEDIUM' },
        ] as LapRow[]

        const result = buildTyreTimeline(laps, drivers)
        expect(result).toHaveLength(1)
        expect(result[0].code).toBe('VER')
        expect(result[0].stints).toHaveLength(2)
        expect(result[0].stints[0].compound).toBe('SOFT')
        expect(result[0].stints[0].laps).toBe(2)
        expect(result[0].stints[1].compound).toBe('MEDIUM')
        expect(result[0].stints[1].laps).toBe(2)
    })
})
