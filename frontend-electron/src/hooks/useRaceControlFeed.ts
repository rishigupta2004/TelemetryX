import { useMemo } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { RaceControlMessage } from '../types'

export function useRaceControlFeed() {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const raceControl = useSessionStore((s) => s.sessionData?.raceControl ?? [])

  const messages = useMemo(() => {
    return (raceControl ?? []).filter((msg) => msg.timestamp <= currentTime)
  }, [raceControl, currentTime])

  const activeFlag = useMemo(() => {
    const last = messages[messages.length - 1]
    return last?.flag ?? null
  }, [messages])

  return { messages: messages as RaceControlMessage[], activeFlag }
}
