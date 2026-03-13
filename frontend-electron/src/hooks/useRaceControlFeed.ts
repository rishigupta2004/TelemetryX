import { useMemo } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

export function useRaceControlFeed() {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionData = useSessionStore((s) => s.sessionData)
  const raceControl = sessionData?.raceControl ?? null

  const messages = useMemo(() => {
    if (!raceControl) return []
    return raceControl.filter((msg) => msg.timestamp <= currentTime)
  }, [raceControl, currentTime])
  const activeFlag = messages[messages.length - 1]?.flag ?? null

  return { messages, activeFlag }
}
