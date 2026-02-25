import { usePlaybackStore } from '../stores/playbackStore'

/**
 * Returns the current absolute session time.
 * ALL data filtering must use this value.
 *
 * sessionTime = sessionStartTime + currentTime
 */
export function useSessionTime(): number {
  return usePlaybackStore((s) => s.sessionStartTime + s.currentTime)
}
