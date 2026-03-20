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

  it('uses source-derived start fallback when explicit start index is far away', () => {
    const nearStart = [144.9695959, -37.8505145]
    const farStart = [144.9659884, -37.847612]
    const sessionData = {
      metadata: { raceName: 'Australian Grand Prix' },
      trackGeometry: {
        name: 'Melbourne Circuit',
        startPositionIndex: 0,
        start_finish: { index: 0 },
        centerline: [
          farStart,
          [144.9678, -37.8491],
          nearStart,
          [144.9692, -37.8502],
          farStart,
        ],
        corners: [{ index: 2, number: 1, name: 'T1' }],
      },
    }

    const { result } = renderHook(() =>
      useTrackData(sessionData, { width: 1200, height: 700 })
    )

    const data = result.current
    expect(data).not.toBeNull()
    if (!data) return
    expect(data.corners.length).toBe(1)
    // Explicit index=0 would leave this corner at idx=2; fallback should rebase it.
    expect(data.corners[0].idx).not.toBe(2)
  })
})
