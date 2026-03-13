/** @vitest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
vi.mock('../../views/TrackView', () => ({
  TrackView: () => <div data-testid="view-track">Track View</div>,
}))
vi.mock('../../views/FeaturesView', () => ({
  FeaturesView: () => <div data-testid="view-features">Features View</div>,
}))
vi.mock('../../views/AnalyticsView', () => ({
  AnalyticsView: () => <div data-testid="view-analytics">Analytics View</div>,
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
  })

  it('renders all tab controls and loads timing by default', async () => {
    render(<App />)

    const tabs = [
      'timing',
      'telemetry',
      'strategy',
      'simulation',
      'track',
      'features',
      'analytics',
      'standings',
      'profiles',
      'fia_documents',
    ]
    for (const tab of tabs) {
      expect(screen.getByRole('button', { name: tab })).toBeTruthy()
    }

    expect(await screen.findByTestId('view-timing')).toBeTruthy()
  })

  it('navigates every tab view', async () => {
    render(<App />)

    const pairs: Array<{ tab: string; testId: string }> = [
      { tab: 'telemetry', testId: 'view-telemetry' },
      { tab: 'strategy', testId: 'view-strategy' },
      { tab: 'simulation', testId: 'view-simulation' },
      { tab: 'track', testId: 'view-track' },
      { tab: 'features', testId: 'view-features' },
      { tab: 'analytics', testId: 'view-analytics' },
      { tab: 'standings', testId: 'view-standings' },
      { tab: 'profiles', testId: 'view-profiles' },
      { tab: 'fia_documents', testId: 'view-fia_documents' },
    ]

    for (const pair of pairs) {
      fireEvent.click(screen.getByRole('button', { name: pair.tab }))
      await waitFor(() => expect(screen.getByTestId(pair.testId)).toBeTruthy())
    }
  })
})
