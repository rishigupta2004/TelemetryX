import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { ubNum } from '../lib/telemetryUtils'

export interface ChartWindowRef {
  lapT0: number
  lapT1: number
  distMax: number
  timestampsAbs: number[]
  distance: number[]
}

export function usePlaybackCursor(
  active: boolean,
  chartWindowRef: React.MutableRefObject<ChartWindowRef>
) {
  const cursorFractionRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    let rafId: number | null = null
    let frameCount = 0
    let lastTime = 0

    const update = (time: number) => {
      if (!active) return
      frameCount++
      if (frameCount % 2 !== 0 || time - lastTime < 16) {
        rafId = requestAnimationFrame(update)
        return
      }
      lastTime = time
      const state = usePlaybackStore.getState()
      const t = state.sessionStartTime + state.currentTime
      const w = chartWindowRef.current
      if (w.lapT0 >= w.lapT1 || w.distMax <= 0 || !w.timestampsAbs.length) {
        cursorFractionRef.current = null
        rafId = requestAnimationFrame(update)
        return
      }
      const times = w.timestampsAbs
      const dist = w.distance
      let d = 0
      if (t <= times[0]) {
        d = dist[0]
      } else if (t >= times[times.length - 1]) {
        d = dist[dist.length - 1]
      } else {
        const idx = ubNum(times, t)
        const i1 = Math.max(1, Math.min(times.length - 1, idx))
        const i0 = i1 - 1
        const ratio = times[i1] > times[i0] ? (t - times[i0]) / (times[i1] - times[i0]) : 0
        d = dist[i0] + (dist[i1] - dist[i0]) * Math.max(0, Math.min(1, ratio))
      }
      const frac = w.distMax > 0 ? d / w.distMax : 0
      if (t < w.lapT0) {
        cursorFractionRef.current = 0
      } else if (t > w.lapT1) {
        cursorFractionRef.current = 1
      } else {
        cursorFractionRef.current = frac
      }
      rafId = requestAnimationFrame(update)
    }

    rafId = requestAnimationFrame(update)
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      cursorFractionRef.current = null
    }
  }, [active, chartWindowRef])

  return cursorFractionRef
}
