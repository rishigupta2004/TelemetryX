/** @vitest-environment jsdom */
import React from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTrackData } from '../../hooks/useTrackData'
import { interpolateFromLookup } from '../../lib/trackGeometry'

describe('useTrackData', () => {
  it('normalizes geometry and builds lookup data for movement interpolation', () => {
    const sessionData = {
      metadata: { raceName: 'Test Grand Prix' },
      trackGeometry: {
        name: 'Test Circuit',
        startPositionIndex: 1,
        centerline: [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
        corners: [
          { index: 1, number: 1, name: 'T1' },
          { index: 3, number: 2, name: 'T2' },
        ],
        sectors: [{ endIndex: 1 }, { endIndex: 2 }, { endIndex: 3 }],
        drsZones: [{ startIndex: 1, endIndex: 3, zone_number: 1 }],
        pitLane: { entryIndex: 1, exitIndex: 3 },
        pitLaneCenterline: [
          [100, 0],
          [120, 30],
          [120, 70],
          [100, 100],
        ],
      },
    }

    const { result } = renderHook(() =>
      useTrackData(sessionData, { width: 800, height: 500 })
    )

    const data = result.current
    expect(data).not.toBeNull()
    if (!data) return

    expect(data.points.length).toBeGreaterThanOrEqual(4)
    expect(data.trackLookup).not.toBeNull()
    expect(data.hasPitLaneData).toBe(true)
    expect(data.drsPolylines.length).toBe(1)
    expect(data.corners.length).toBe(2)

    const p0 = interpolateFromLookup(data.trackLookup, 0)
    const p50 = interpolateFromLookup(data.trackLookup, 0.5)
    const p90 = interpolateFromLookup(data.trackLookup, 0.9)

    expect(Number.isFinite(p0.x)).toBe(true)
    expect(Number.isFinite(p50.y)).toBe(true)
    expect(Number.isFinite(p90.x)).toBe(true)
    expect(`${p0.x},${p0.y}`).not.toBe(`${p50.x},${p50.y}`)
  })
})
