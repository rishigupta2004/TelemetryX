/** @vitest-environment jsdom */
import React from 'react'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTimingData } from '../../hooks/useTimingData'
import { useSessionStore } from '../../stores/sessionStore'
import type { Driver, LapRow, SessionResponse } from '../../types'

vi.mock('../../hooks/useCarPositions', () => ({
  useCarPositions: () => [
    {
      driverCode: 'VER',
      driverNumber: 1,
      teamColor: '#005AFF',
      progress: 0.78,
      currentLap: 2,
      position: 1,
      x: 0,
      y: 0,
      hasLivePosition: true,
      isInPit: false,
      pitProgress: null,
      progressSource: 'fused',
      mappingConfidence: 0.95,
      sourceTimestamp: 95,
    },
    {
      driverCode: 'NOR',
      driverNumber: 4,
      teamColor: '#FF8000',
      progress: 0.22,
      currentLap: 2,
      position: 2,
      x: 0,
      y: 0,
      hasLivePosition: true,
      isInPit: false,
      pitProgress: null,
      progressSource: 'fused',
      mappingConfidence: 0.9,
      sourceTimestamp: 95,
    },
  ],
}))

vi.mock('../../lib/timeUtils', () => ({
  useSessionTime30: () => 95,
}))

function lap(partial: Partial<LapRow>): LapRow {
  return {
    driverName: partial.driverName ?? 'UNK',
    driverNumber: partial.driverNumber ?? 0,
    lapNumber: partial.lapNumber ?? 1,
    lapTime: partial.lapTime ?? 90,
    lapTimeFormatted: partial.lapTimeFormatted ?? '1:30.000',
    lapStartSeconds: partial.lapStartSeconds ?? 0,
    lapEndSeconds: partial.lapEndSeconds ?? 90,
    lapStartTime: partial.lapStartTime ?? 0,
    position: partial.position ?? 1,
    tyreCompound: partial.tyreCompound ?? 'SOFT',
    isValid: partial.isValid ?? true,
    isDeleted: partial.isDeleted ?? false,
    pitInTimeFormatted: partial.pitInTimeFormatted ?? null,
    pitOutTimeFormatted: partial.pitOutTimeFormatted ?? null,
    pitInSeconds: partial.pitInSeconds ?? null,
    pitOutSeconds: partial.pitOutSeconds ?? null,
    pitInLaneTimeSeconds: partial.pitInLaneTimeSeconds ?? null,
    pitOutLaneTimeSeconds: partial.pitOutLaneTimeSeconds ?? null,
    sector1: partial.sector1 ?? 30.1,
    sector2: partial.sector2 ?? 30.2,
    sector3: partial.sector3 ?? 29.7,
  }
}

describe('useTimingData', () => {
  beforeEach(() => {
    const drivers: Driver[] = [
      {
        driverName: 'Max Verstappen',
        driverNumber: 1,
        teamName: 'Red Bull Racing',
        teamColor: '#005AFF',
        code: 'VER',
      },
      {
        driverName: 'Lando Norris',
        driverNumber: 4,
        teamName: 'McLaren',
        teamColor: '#FF8000',
        code: 'NOR',
      },
    ]
    const laps: LapRow[] = [
      lap({ driverName: 'VER', driverNumber: 1, lapNumber: 1, lapTime: 89.8, position: 1, tyreCompound: 'SOFT' }),
      lap({ driverName: 'NOR', driverNumber: 4, lapNumber: 1, lapTime: 90.9, position: 2, tyreCompound: 'MEDIUM', sector1: 30.4, sector2: 30.5, sector3: 30.0 }),
    ]
    const sessionData: SessionResponse = {
      metadata: {
        year: 2024,
        raceName: 'Bahrain Grand Prix',
        sessionType: 'R',
        duration: 5400,
        totalLaps: 57,
        telemetryAvailable: true,
        telemetryUnavailableReason: null,
        positionsTimeBounds: [0, 5400],
        telemetryTimeBounds: [0, 5400],
        raceStartSeconds: 0,
        raceEndSeconds: 5400,
        raceDurationSeconds: 5400,
        sourceVersion: 'unit-test',
      },
      drivers,
      laps,
      positions: [],
      weather: [],
      raceControl: [],
      trackGeometry: null,
    }
    useSessionStore.setState({
      sessionData,
      laps,
      loadingState: 'ready',
      error: null,
      apiError: null,
      drivers,
      selectedYear: 2024,
      selectedRace: 'Bahrain Grand Prix',
      selectedSession: 'R',
      sessionMeta: sessionData.metadata,
    })
  })

  it('builds timing rows from session laps and live positions', () => {
    const { result } = renderHook(() => useTimingData())

    expect(result.current.status).toBe('ready')
    expect(result.current.rows).toHaveLength(2)
    expect(result.current.rows[0].driverCode).toBe('VER')
    expect(result.current.rows[0].gap).toBe('LEADER')
    expect(result.current.rows[0].tyreCompound).toBe('SOFT')
    expect(result.current.rows[1].driverCode).toBe('NOR')
    expect(result.current.rows[1].interval.startsWith('+')).toBe(true)
    expect(result.current.rows[1].tyreCompound).toBe('MEDIUM')
    expect(result.current.sessionBestLap).toBeCloseTo(89.8, 3)
  })
})
