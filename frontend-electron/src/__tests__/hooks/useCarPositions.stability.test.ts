import { describe, expect, it } from 'vitest'

import { mergeStablePositionsForTest, type CarPosition } from '../../hooks/useCarPositions'

function car(overrides: Partial<CarPosition> = {}): CarPosition {
  return {
    driverCode: overrides.driverCode ?? 'VER',
    driverNumber: overrides.driverNumber ?? 1,
    teamColor: overrides.teamColor ?? '#005AFF',
    progress: overrides.progress ?? 0.42,
    currentLap: overrides.currentLap ?? 3,
    position: overrides.position ?? 1,
    x: overrides.x ?? 100,
    y: overrides.y ?? 200,
    hasLivePosition: overrides.hasLivePosition ?? true,
    isInPit: overrides.isInPit ?? false,
    pitProgress: overrides.pitProgress ?? null,
    progressSource: overrides.progressSource ?? 'fused',
    mappingConfidence: overrides.mappingConfidence ?? 0.96,
    sourceTimestamp: overrides.sourceTimestamp ?? 12.0,
  }
}

describe('mergeStablePositionsForTest', () => {
  it('keeps stable reference across 120 unchanged update cycles', () => {
    let current: CarPosition[] = []
    for (let i = 0; i < 120; i += 1) {
      const next = [car(), car({ driverCode: 'NOR', driverNumber: 4, position: 2, x: 120, y: 180 })]
      const merged = mergeStablePositionsForTest(current, next)
      if (i === 0) {
        expect(merged).toHaveLength(2)
      } else {
        expect(merged).toBe(current)
      }
      current = merged
    }
  })

  it('ignores micro jitter but updates on meaningful movement', () => {
    const base = [car()]
    const jitter = [car({ progress: 0.4202, x: 100.004, y: 200.004, mappingConfidence: 0.9605 })]
    const stable = mergeStablePositionsForTest(base, jitter)
    expect(stable).toBe(base)

    const moved = [car({ progress: 0.46, x: 130, y: 245 })]
    const changed = mergeStablePositionsForTest(base, moved)
    expect(changed).not.toBe(base)
    expect(changed[0].x).toBe(130)
    expect(changed[0].y).toBe(245)
  })
})
