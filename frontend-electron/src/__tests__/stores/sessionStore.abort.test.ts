import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionInfoResponse } from '../../types'

vi.mock('../../api/sessions', () => ({
  fetchSeasons: vi.fn(),
  fetchRaces: vi.fn(),
  fetchSessions: vi.fn(),
  fetchSession: vi.fn(),
  fetchLaps: vi.fn(),
  fetchPositions: vi.fn(),
  slugifyRace: (race: string) => race
}))

import { fetchSessions as fetchSessionsApi } from '../../api/sessions'
import { ApiError } from '../../api/client'
import { useSessionStore } from '../../stores/sessionStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('sessionStore abort handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.setState({
      seasons: [],
      races: [],
      sessions: [],
      selectedYear: null,
      selectedRace: null,
      selectedSession: null,
      sessionMeta: null,
      drivers: [],
      laps: [],
      sessionData: null,
      loadingState: 'idle',
      error: null,
      apiError: null
    })
  })

  it('does not set apiError for aborted fetchSessions requests', async () => {
    vi.mocked(fetchSessionsApi).mockRejectedValueOnce(
      new DOMException('The operation was aborted', 'AbortError')
    )

    await useSessionStore.getState().fetchSessions(2025, 'Abu Dhabi Grand Prix')

    const state = useSessionStore.getState()
    expect(state.apiError).toBeNull()
    expect(state.error).toBeNull()
    expect(state.loadingState).toBe('idle')
  })

  it('sets apiError for real API failures', async () => {
    vi.mocked(fetchSessionsApi).mockRejectedValueOnce(
      new ApiError(500, '/features/2025/abu-dhabi-grand-prix', { message: 'boom' })
    )

    await useSessionStore.getState().fetchSessions(2025, 'Abu Dhabi Grand Prix')

    const state = useSessionStore.getState()
    expect(state.loadingState).toBe('error')
    expect(state.apiError?.code).toBe(500)
  })

  it('ignores stale responses from older fetchSessions requests', async () => {
    const first = deferred<SessionInfoResponse>()
    const second = deferred<SessionInfoResponse>()

    vi.mocked(fetchSessionsApi)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const p1 = useSessionStore.getState().fetchSessions(2025, 'Race A')
    const p2 = useSessionStore.getState().fetchSessions(2025, 'Race B')

    second.resolve({ year: 2025, race: 'Race B', n_sessions: 1, sessions: ['R'] })
    await p2

    first.resolve({ year: 2025, race: 'Race A', n_sessions: 1, sessions: ['Q'] })
    await p1

    const state = useSessionStore.getState()
    expect(state.selectedRace).toBe('Race B')
    expect(state.sessions).toEqual(['R'])
  })
})
