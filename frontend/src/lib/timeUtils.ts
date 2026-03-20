import { useMemo } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

export function useSessionTime(): number {
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  return sessionStartTime + currentTime
}

export function useSessionTimeAt(hz: number): number {
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  return useMemo(() => Math.round((sessionStartTime + currentTime) * hz) / hz, [sessionStartTime, currentTime, hz])
}

export const useSessionTime30 = () => useSessionTimeAt(30)
export const useSessionTime10 = () => useSessionTimeAt(10)
export const useSessionTime2s = () => useSessionTimeAt(2)
