/** @vitest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const compareMock = vi.fn()
const backtestMock = vi.fn()

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
      track_type: 'medium',
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

function makeBacktestPayload() {
  return {
    baseline_year: 2018,
    target_year: 2021,
    shift_label: '2018→2021',
    team_profile: 'balanced',
    n_samples: 1200,
    backtest_results: [
      { metric: 'Points', predicted: 15.5, actual: 14.2, error: 1.3 },
      { metric: 'Finish Position', predicted: 4.2, actual: 4.5, error: -0.3 },
    ],
    accuracy_summary: {
      mae_points: 1.3,
      mae_position: 0.3,
      has_comparison: true,
    },
    diagnostics: { elapsed_ms: 45.2 },
    notes: ['Backtest comparison complete'],
  }
}

vi.mock('../../api/client', () => ({
  api: {
    getRegulationSimulationCompare: (...args: unknown[]) => compareMock(...args),
    getRegulationSimulationBacktest: (...args: unknown[]) => backtestMock(...args),
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
    backtestMock.mockReset()
    compareMock.mockImplementation((_race: string, params?: { baselineYears?: number[]; targetYear?: number }) => {
      const baselines = (params?.baselineYears || [2025]).slice().sort((a, b) => a - b)
      const target = params?.targetYear ?? 2026
      return Promise.resolve(makeComparePayload(baselines, target))
    })
    backtestMock.mockImplementation(() => Promise.resolve(makeBacktestPayload()))
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

  it('shows backtest panel and runs backtest', async () => {
    render(<SimulationView active />)
    await waitFor(() => expect(compareMock).toHaveBeenCalled())

    expect(await screen.findByText('Accuracy Backtest')).toBeTruthy()
    expect(await screen.findByText('Historical regulation shift validation')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Run Backtest' }))

    await waitFor(() => expect(backtestMock).toHaveBeenCalled())
    const backtestCall = backtestMock.mock.calls[0]
    expect(backtestCall[0]).toMatchObject({
      baselineYear: 2018,
      targetYear: 2021,
      teamProfile: 'balanced',
      nSamples: 1200,
    })

    expect(await screen.findByText('Accuracy Metrics')).toBeTruthy()
    expect(await screen.findByText(/MAE Points:/)).toBeTruthy()
    expect(await screen.findByText(/MAE Position:/)).toBeTruthy()
  })

  it('allows changing regulation shift in backtest', async () => {
    render(<SimulationView active />)
    await waitFor(() => expect(compareMock).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Regulation shift'), { target: { value: '2021-2022' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run Backtest' }))

    await waitFor(() => expect(backtestMock).toHaveBeenCalled())
    const backtestCall = backtestMock.mock.calls[0]
    expect(backtestCall[0]).toMatchObject({
      baselineYear: 2021,
      targetYear: 2022,
    })
  })

  it('shows track type in simulation results', async () => {
    render(<SimulationView active />)
    await waitFor(() => expect(compareMock).toHaveBeenCalled())

    expect(await screen.findByText('medium')).toBeTruthy()
  })
})
