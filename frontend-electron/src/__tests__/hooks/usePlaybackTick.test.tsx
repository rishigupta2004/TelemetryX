/** @vitest-environment jsdom */
import React from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const setCurrentTime = vi.fn()
const setExternalClock = vi.fn()
let wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    selectedYear: 2025,
    selectedRace: 'Bahrain Grand Prix',
    selectedSession: 'R',
  }),
}))

vi.mock('../../stores/playbackStore', () => ({
  usePlaybackStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    setCurrentTime,
    setExternalClock,
  }),
}))

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ status: wsStatus }),
}))

import { usePlaybackTick } from '../../hooks/usePlaybackTick'

describe('usePlaybackTick', () => {
  it('toggles external clock based on websocket status', () => {
    wsStatus = 'connected'
    const { rerender } = renderHook(() => usePlaybackTick())
    expect(setExternalClock).toHaveBeenLastCalledWith(true)

    wsStatus = 'disconnected'
    rerender()
    expect(setExternalClock).toHaveBeenLastCalledWith(false)
  })
})
