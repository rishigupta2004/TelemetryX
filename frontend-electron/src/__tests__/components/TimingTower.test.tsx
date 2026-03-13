/** @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { TimingRow } from '../../hooks/useTimingData'
import TimingTower from '../../components/TimingTower'

vi.mock('animejs', () => ({
  animate: () => ({ pause: () => {} }),
}))

vi.mock('../../hooks/useF1Flip', () => ({
  useF1Flip: () => ({ current: null }),
}))

vi.mock('../../hooks/useFlashObserver', () => ({
  useFlashObserver: () => ({ current: null }),
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock
})

function row(partial: Partial<TimingRow>): TimingRow {
  return {
    position: partial.position ?? 1,
    driverCode: partial.driverCode ?? 'VER',
    driverName: partial.driverName ?? 'Max Verstappen',
    driverNumber: partial.driverNumber ?? 1,
    teamColor: partial.teamColor ?? '#005AFF',
    teamName: partial.teamName ?? 'Red Bull Racing',
    driverImage: null,
    teamImage: null,
    gap: partial.gap ?? 'LEADER',
    interval: partial.interval ?? '+0.000s',
    lastLap: partial.lastLap ?? '1:29.999',
    bestLap: partial.bestLap ?? '1:29.800',
    bestLapTime: partial.bestLapTime ?? 89.8,
    tyreCompound: partial.tyreCompound ?? 'SOFT',
    pits: partial.pits ?? 0,
    sector1: partial.sector1 ?? 29.9,
    sector2: partial.sector2 ?? 30.1,
    sector3: partial.sector3 ?? 29.8,
    s1Color: partial.s1Color ?? 'green',
    s2Color: partial.s2Color ?? 'white',
    s3Color: partial.s3Color ?? 'purple',
    status: partial.status ?? 'racing',
    currentLap: partial.currentLap ?? 2,
    currentSector: partial.currentSector ?? 2,
    lapsCompleted: partial.lapsCompleted ?? 1,
    lapProgress: partial.lapProgress ?? 0.4,
    lapDistance: partial.lapDistance ?? 1400,
    lapTimeRef: partial.lapTimeRef ?? 89.8,
  }
}

describe('TimingTower', () => {
  it('renders timing rows with visible values from data payload', () => {
    const rows: TimingRow[] = [
      row({
        position: 1,
        driverCode: 'VER',
        gap: 'LEADER',
        interval: '+0.000s',
        lastLap: '1:29.800',
        tyreCompound: 'SOFT',
      }),
      row({
        position: 2,
        driverCode: 'NOR',
        driverName: 'Lando Norris',
        driverNumber: 4,
        teamColor: '#FF8000',
        teamName: 'McLaren',
        gap: '+1.203s',
        interval: '+1.203s',
        lastLap: '1:31.003',
        tyreCompound: 'MEDIUM',
      }),
    ]

    render(<TimingTower rows={rows} status="ready" error={null} />)

    expect(screen.getByLabelText('VER position 1')).toBeTruthy()
    expect(screen.getByLabelText('NOR position 2')).toBeTruthy()
    expect(screen.getByText('VER')).toBeTruthy()
    expect(screen.getByText('NOR')).toBeTruthy()
    expect(screen.getByText('1:31.003')).toBeTruthy()
    expect(screen.getAllByText('+1.203s').length).toBeGreaterThanOrEqual(1)
  })
})
