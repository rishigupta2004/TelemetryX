import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

type Snapshot = {
  fps: number
  fpsFloor: number
  frameP95: number
  frameP99: number
  tickP95: number
}

const FPS_TARGET = 60
const FPS_FLOOR_TARGET = 55
const FRAME_P95_TARGET = 16.7
const FRAME_P99_TARGET = 20
const TICK_P95_TARGET = 18

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))
  return sorted[idx]
}

const good = (ok: boolean) => (ok ? 'text-emerald-200' : 'text-rose-200')

export function RenderBudgetPanel() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const [open, setOpen] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('tx.renderBudget.open') === '1'
  )
  const [snap, setSnap] = useState<Snapshot>({ fps: 0, fpsFloor: 0, frameP95: 0, frameP99: 0, tickP95: 0 })

  const frameTimesRef = useRef<number[]>([])
  const tickTimesRef = useRef<number[]>([])
  const frameCountRef = useRef(0)
  const lastFrameRef = useRef<number | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    const now = performance.now()
    if (lastTickRef.current != null) {
      tickTimesRef.current.push(now - lastTickRef.current)
      if (tickTimesRef.current.length > 1200) tickTimesRef.current.splice(0, tickTimesRef.current.length - 1200)
    }
    lastTickRef.current = now
  }, [currentTime])

  useEffect(() => {
    const onFrame = (now: number) => {
      if (lastFrameRef.current != null) {
        frameTimesRef.current.push(now - lastFrameRef.current)
        if (frameTimesRef.current.length > 2400) frameTimesRef.current.splice(0, frameTimesRef.current.length - 2400)
      }
      lastFrameRef.current = now
      frameCountRef.current += 1
      rafRef.current = requestAnimationFrame(onFrame)
    }

    rafRef.current = requestAnimationFrame(onFrame)
    intervalRef.current = window.setInterval(() => {
      const next: Snapshot = {
        fps: frameCountRef.current,
        fpsFloor: frameTimesRef.current.length ? Math.floor(1000 / Math.max(...frameTimesRef.current)) : 0,
        frameP95: percentile(frameTimesRef.current, 0.95),
        frameP99: percentile(frameTimesRef.current, 0.99),
        tickP95: percentile(tickTimesRef.current, 0.95),
      }
      frameCountRef.current = 0
      setSnap(next)
    }, 1000)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      if (intervalRef.current != null) window.clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('tx.renderBudget.open', open ? '1' : '0')
  }, [open])

  const checks = useMemo(
    () => ({
      fps: snap.fps >= FPS_TARGET && snap.fpsFloor >= FPS_FLOOR_TARGET,
      p95: snap.frameP95 <= FRAME_P95_TARGET,
      p99: snap.frameP99 <= FRAME_P99_TARGET,
      tick: !isPlaying || snap.tickP95 <= TICK_P95_TARGET,
    }),
    [isPlaying, snap]
  )

  return (
    <div className="pointer-events-auto fixed bottom-[4.5rem] right-4 z-[90]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 ml-auto block rounded-sm border border-border-hard bg-bg-surface px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-text-primary hover:bg-bg-hover"
      >
        PERF {open ? 'HIDE' : 'SHOW'}
      </button>

      {open && (
        <div className="w-[250px] border border-border-hard bg-bg-surface panel-border p-3 font-mono text-[11px] text-text-primary">
          <div className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-cyan-100/95">RENDER BUDGET</div>
          <div className="text-cyan-100/75">mode: {isPlaying ? 'LIVE' : 'PAUSE'}</div>
          <div className={good(checks.fps)}>fps: {snap.fps} (min {snap.fpsFloor})</div>
          <div className={good(checks.p95)}>frame p95: {snap.frameP95.toFixed(2)}ms</div>
          <div className={good(checks.p99)}>frame p99: {snap.frameP99.toFixed(2)}ms</div>
          <div className={good(checks.tick)}>ui tick p95: {snap.tickP95.toFixed(2)}ms</div>
          <div className="mt-1 text-[10px] text-cyan-100/65">targets: 60-90 fps | p95 &lt;=16.7ms | tick &lt;=18ms</div>
        </div>
      )}
    </div>
  )
}
