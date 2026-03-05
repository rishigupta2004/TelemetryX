import { useMemo } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

/**
 * Returns absolute session time, updated at 60fps (full rate).
 * Use for smooth animation: chart cursor, track map cars.
 * ALL data filtering must use this value.
 */
export function useSessionTime(): number {
  return usePlaybackStore((s) => s.sessionStartTime + s.currentTime)
}

/**
 * Throttled session time at `hz` updates per second.
 * Use for heavy components that don't need 60fps: timing tower, weather, etc.
 */
export function useSessionTimeAt(hz: number): number {
  const raw = usePlaybackStore((s) => s.sessionStartTime + s.currentTime)
  return useMemo(() => Math.round(raw * hz) / hz, [raw, hz])
}

/** Session time throttled to 30Hz — good for timing tower re-renders. */
export function useSessionTime30(): number {
  return useSessionTimeAt(30)
}

/** Session time throttled to 2Hz — for weather/race-control/strategy panels. */
export function useSessionTime2s(): number {
  return useSessionTimeAt(2)
}
