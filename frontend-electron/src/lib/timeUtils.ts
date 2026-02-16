import { usePlaybackStore } from '../stores/playbackStore'

/**
 * Returns the current absolute session time.
 * ALL data filtering must use this value.
 *
 * sessionTime = sessionStartTime + currentTime
 */
export function useSessionTime(): number {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  return sessionStartTime + currentTime
}

