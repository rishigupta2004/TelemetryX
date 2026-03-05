import { useCallback, useEffect } from 'react'
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
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime)
  const setExternalClock = usePlaybackStore((s) => s.setExternalClock)

  const handleMessage = useCallback(
    (payload: unknown) => {
      const t = extractTime(payload)
      if (t != null) setCurrentTime(t)
    },
    [setCurrentTime]
  )

  const { status } = useWebSocket({
    year: selectedYear,
    race: selectedRace,
    session: selectedSession,
    onMessage: handleMessage
  })

  // The WebSocket is currently an echo server — it does NOT push real timing data.
  // Never enable externalClock, so the local requestAnimationFrame playback loop
  // always drives time forward when the user presses play.
  useEffect(() => {
    setExternalClock(false)
  }, [status, setExternalClock])

  return status
}
