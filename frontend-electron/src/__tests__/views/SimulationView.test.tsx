/** @vitest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const compareMock = vi.fn()

function makeComparePayload(baselines: number[], targetYear: number) {
  return {
    race_name: 'Test GP',
    target_year: targetYear,
    team_profile: 'balanced',
    n_samples: 1200,
    diagnostics: {
      elapsed_ms_total: 42.6,
      cache_hit_count: 1,
      avg_simulation_elapsed_ms: 21.3,
    },
    selected_baselines: baselines,
    failures: [],
    source_urls: ['https://www.fia.com/regulation/category/110'],
    simulations: baselines.map((baseline) => ({
      baseline_year: baseline,
      source_year: baseline,
      target_year: targetYear,
      race_name: 'Test GP',
      team_profile: 'balanced',
      n_samples: 1200,
      seed: baseline + targetYear,
      diagnostics: {
        elapsed_ms: 18.4,
        cache_hit: baseline === 2025,
        assumption_confidence_score: 0.72,
        fallback_gap_years: 0,
      },
      assumptions: {
        aero_delta_pct: { mean: -0.08, std: 0.02, confidence: 'medium', classification: 'estimated' },
      },
      regulation_diff: {
        baseline_year: baseline,
        target_year: targetYear,
        baseline_generation: 'Gen-Test',
        target_generation: 'Gen-AE26',
        source_urls: ['https://www.fia.com/regulation/category/110'],
        rows: [
          {
            key: 'max_width_mm',
            label: 'Maximum Width',
            unit: 'mm',
            baseline: 2000,
            target: 1900,
            delta: -100,
            confidence: 'high',
            classification: 'official_fixed',
            notes: [],
            source_urls: ['https://www.fia.com/regulation/category/110'],
          },
        ],
      },
      metrics: {
        lap_time_delta_seconds: { mean: 0.2, p10: 0.1, p50: 0.2, p90: 0.3 },
        race_time_delta_seconds: { mean: 10.0, p10: 8.0, p50: 10.0, p90: 12.0 },
        tyre_degradation_delta: { mean: 0.06, p10: 0.04, p50: 0.06, p90: 0.08 },
        pit_loss_delta_seconds: { mean: 0.3, p10: 0.2, p50: 0.3, p90: 0.4 },
      },
      strategy_projection: [
        {
          strategy: 'SOFT→HARD (Pits: 1)',
          expected_points: 18.1,
          avg_finish_position: 3.2,
          podium_probability: 0.56,
          avg_pit_stops: 1,
          confidence: 0.72,
          points_band: { mean: 18.1, p10: 15.5, p50: 18.0, p90: 20.1 },
        },
      ],
      notes: ['Test payload'],
    })),
  }
}

vi.mock('../../api/client', () => ({
  api: {
    getRegulationSimulationCompare: (...args: unknown[]) => compareMock(...args),
  },
}))

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: { selectedYear: number; selectedRace: string }) => unknown) =>
    selector({ selectedYear: 2025, selectedRace: 'Test GP' }),
}))

import { SimulationView } from '../../views/SimulationView'

describe('SimulationView', () => {
  beforeEach(() => {
    compareMock.mockReset()
    compareMock.mockImplementation((_race: string, params?: { baselineYears?: number[]; targetYear?: number }) => {
      const baselines = (params?.baselineYears || [2025]).slice().sort((a, b) => a - b)
      const target = params?.targetYear ?? 2026
      return Promise.resolve(makeComparePayload(baselines, target))
    })
  })

  it('loads with 2025 vs 2026 as default', async () => {
    render(<SimulationView active />)

    await waitFor(() => expect(compareMock).toHaveBeenCalled())
    const lastCall = compareMock.mock.calls[compareMock.mock.calls.length - 1]
    expect(lastCall[0]).toBe('Test GP')
    expect(lastCall[1]).toMatchObject({
      baselineYears: [2025],
      targetYear: 2026,
      teamProfile: 'balanced',
      nSamples: 1200,
    })
    expect(await screen.findByText('2025 -> 2026')).toBeTruthy()
    expect(await screen.findByText('Gen-Test')).toBeTruthy()
    expect(await screen.findByText('Gen-AE26')).toBeTruthy()
    expect(await screen.findByText('official-fixed 1')).toBeTruthy()
    expect(await screen.findByText('Total run 42.6ms')).toBeTruthy()
  })

  it('lets users choose additional baselines', async () => {
    render(<SimulationView active />)
    await waitFor(() => expect(compareMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: '2021' }))

    await waitFor(() => {
      const lastCall = compareMock.mock.calls[compareMock.mock.calls.length - 1]
      expect(lastCall[1]).toMatchObject({ baselineYears: [2021, 2025], targetYear: 2026 })
    })
  })

  it('resets controls back to defaults', async () => {
    render(<SimulationView active />)
    await waitFor(() => expect(compareMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: '2018' }))
    fireEvent.change(screen.getByLabelText('Team profile'), { target: { value: 'aggressive' } })
    fireEvent.change(screen.getByLabelText('Monte Carlo samples'), { target: { value: '1800' } })
    fireEvent.change(screen.getByLabelText('Seed (optional)'), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset defaults' }))

    await waitFor(() => {
      const lastCall = compareMock.mock.calls[compareMock.mock.calls.length - 1]
      expect(lastCall[1]).toMatchObject({
        baselineYears: [2025],
        targetYear: 2026,
        teamProfile: 'balanced',
        nSamples: 1200,
      })
    })
  })
})
