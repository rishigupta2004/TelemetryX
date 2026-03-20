/** @vitest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '../../stores/sessionStore'

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ orgId: 'org_demo', userId: 'user_demo' }),
  useClerk: () => ({ signOut: vi.fn(async () => {}) }),
}))

vi.mock('../../views/TimingView', () => ({
  default: () => <div data-testid="view-timing">Timing View</div>,
}))
vi.mock('../../views/TelemetryView', () => ({
  TelemetryView: () => <div data-testid="view-telemetry">Telemetry View</div>,
}))
vi.mock('../../views/StrategyView', () => ({
  StrategyView: () => <div data-testid="view-strategy">Strategy View</div>,
}))
vi.mock('../../views/SimulationView', () => ({
  SimulationView: () => <div data-testid="view-simulation">Simulation View</div>,
}))
vi.mock('../../views/FeaturesView', () => ({
  FeaturesView: () => <div data-testid="view-features">Features View</div>,
}))
vi.mock('../../views/AnalyticsView', () => ({
  AnalyticsView: () => <div data-testid="view-analytics">Analytics View</div>,
}))
vi.mock('../../views/BroadcastView', () => ({
  BroadcastView: () => <div data-testid="view-broadcast">Broadcast View</div>,
}))
vi.mock('../../views/StandingsView', () => ({
  StandingsView: () => <div data-testid="view-standings">Standings View</div>,
}))
vi.mock('../../views/ProfilesView', () => ({
  ProfilesView: () => <div data-testid="view-profiles">Profiles View</div>,
}))
vi.mock('../../views/FiaDocumentsView', () => ({
  FiaDocumentsView: () => <div data-testid="view-fia_documents">FIA Documents View</div>,
}))

vi.mock('../../components/SessionPicker', () => ({
  default: () => null,
}))

import App from '../../App'

describe('App tab and gate behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.setState({
      loadingState: 'ready',
      error: null,
      sessionData: {
        metadata: {
          year: 2024,
          raceName: 'Test GP',
          sessionType: 'R',
          duration: 3600,
          totalLaps: 50,
          telemetryAvailable: true,
          telemetryUnavailableReason: null,
          positionsTimeBounds: [0, 3600],
          telemetryTimeBounds: [0, 3600],
          raceStartSeconds: 0,
          raceEndSeconds: 3600,
          raceDurationSeconds: 3600,
          sourceVersion: 'test',
        },
        drivers: [],
        laps: [],
        positions: [],
        weather: [],
        raceControl: [],
        trackGeometry: null,
      },
    })
  })

  it('renders all tab controls and loads timing by default', async () => {
    render(<App />)

    const tabs = ['Timing', 'Telemetry', 'Strategy', 'Analytics', 'Broadcast', 'Standings', 'Profiles', 'FIA Docs']
    for (const tab of tabs) {
      expect(screen.getByRole('button', { name: new RegExp(`${tab}$`) })).toBeTruthy()
    }

    expect(await screen.findByTestId('view-timing')).toBeTruthy()
  })

  it('navigates every tab view', async () => {
    render(<App />)

    const pairs: Array<{ tab: string; testId: string }> = [
      { tab: 'Telemetry', testId: 'view-telemetry' },
      { tab: 'Strategy', testId: 'view-strategy' },
      { tab: 'Analytics', testId: 'view-analytics' },
      { tab: 'Broadcast', testId: 'view-broadcast' },
      { tab: 'Standings', testId: 'view-standings' },
      { tab: 'Profiles', testId: 'view-profiles' },
      { tab: 'FIA Docs', testId: 'view-fia_documents' },
    ]

    for (const pair of pairs) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`${pair.tab}$`) }))
      await waitFor(() => expect(screen.getByTestId(pair.testId)).toBeTruthy())
    }
  })
})
