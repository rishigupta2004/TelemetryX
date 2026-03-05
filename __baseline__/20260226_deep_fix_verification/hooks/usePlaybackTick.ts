import { useEffect } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useWebSocket } from './useWebSocket'

function extractTime(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const candidates = [obj.currentTime, obj.timestamp, obj.time, obj.t]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function usePlaybackTick() {
  const { selectedYear, selectedRace, selectedSession } = useSessionStore((s) => ({
    selectedYear: s.selectedYear,
    selectedRace: s.selectedRace,
    selectedSession: s.selectedSession
  }))
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime)
  const setExternalClock = usePlaybackStore((s) => s.setExternalClock)

  const { status } = useWebSocket({
    year: selectedYear,
    race: selectedRace,
    session: selectedSession,
    onMessage: (payload) => {
      const t = extractTime(payload)
      if (t != null) setCurrentTime(t)
    }
  })

  useEffect(() => {
    setExternalClock(status === 'connected')
  }, [status, setExternalClock])

  return { status }
}
