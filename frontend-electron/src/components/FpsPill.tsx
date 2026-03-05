import { useEffect, useRef, useState } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

export function FpsPill() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const [fps, setFps] = useState(0)
  const rafRef = useRef<number | null>(null)
  const framesRef = useRef(0)
  const windowStartRef = useRef<number | null>(null)

  useEffect(() => {
    const sampleWindowMs = 500
    const loop = (now: number) => {
      if (windowStartRef.current == null) {
        windowStartRef.current = now
        framesRef.current = 0
      }

      framesRef.current += 1
      const elapsed = now - windowStartRef.current
      if (elapsed >= sampleWindowMs) {
        const computedFps = Math.round((framesRef.current * 1000) / Math.max(1, elapsed))
        setFps(computedFps)
        framesRef.current = 0
        windowStartRef.current = now
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const fpsTone =
    fps >= 90
      ? 'text-emerald-200'
      : fps >= 60
        ? 'text-cyan-100'
        : fps >= 45
          ? 'text-amber-200'
          : 'text-rose-200'

  return (
    <div
      className="pointer-events-none fixed right-4 top-[4.8rem] z-[80] rounded-sm border border-border-hard bg-bg-surface px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-text-primary"
      aria-live="polite"
    >
      <span className="mr-2 text-white/55">FPS</span>
      <span className={fpsTone}>{fps || '—'}</span>
      <span className="ml-2 text-white/45">{isPlaying ? 'LIVE' : 'PAUSE'}</span>
    </div>
  )
}

