import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

type Snapshot = { fps: number; fpsFloor: number; frameP95: number; frameP99: number; tickP95: number; heapMb: number | null }
type Sample = Snapshot & { tMs: number; playbackTime: number }
const p = (arr: number[], q: number) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.max(0, Math.min(s.length - 1, Math.floor((s.length - 1) * q)))] }
const c = (ok: boolean) => (ok ? '#4ade80' : '#f87171')

export function DebugOverlay() {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const speed = usePlaybackStore((s) => s.speed)
  const duration = usePlaybackStore((s) => s.duration)
  const [snap, setSnap] = useState<Snapshot>({ fps: 0, fpsFloor: 0, frameP95: 0, frameP99: 0, tickP95: 0, heapMb: null })
  const currentTimeRef = useRef(0), frameTimesRef = useRef<number[]>([]), tickTimesRef = useRef<number[]>([]), historyRef = useRef<Sample[]>([]), frameCountRef = useRef(0), lastFrameRef = useRef<number | null>(null), lastTickRef = useRef<number | null>(null), rafRef = useRef<number | null>(null), timerRef = useRef<number | null>(null)

  useEffect(() => {
    currentTimeRef.current = currentTime
    const now = performance.now()
    if (lastTickRef.current != null) {
      tickTimesRef.current.push(now - lastTickRef.current)
      if (tickTimesRef.current.length > 900) tickTimesRef.current.splice(0, tickTimesRef.current.length - 900)
    }
    lastTickRef.current = now
  }, [currentTime])

  useEffect(() => {
    const onFrame = (now: number) => {
      if (lastFrameRef.current != null) {
        frameTimesRef.current.push(now - lastFrameRef.current)
        if (frameTimesRef.current.length > 1200) frameTimesRef.current.splice(0, frameTimesRef.current.length - 1200)
      }
      lastFrameRef.current = now
      frameCountRef.current += 1
      rafRef.current = requestAnimationFrame(onFrame)
    }

    rafRef.current = requestAnimationFrame(onFrame)
    timerRef.current = window.setInterval(() => {
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
      const next: Snapshot = { fps: frameCountRef.current, fpsFloor: frameTimesRef.current.length ? Math.floor(1000 / Math.max(...frameTimesRef.current)) : 0, frameP95: p(frameTimesRef.current, 0.95), frameP99: p(frameTimesRef.current, 0.99), tickP95: p(tickTimesRef.current, 0.95), heapMb: mem ? mem / (1024 * 1024) : null }
      frameCountRef.current = 0
      setSnap(next)
      historyRef.current.push({ ...next, tMs: Date.now(), playbackTime: currentTimeRef.current })
      if (historyRef.current.length > 2400) historyRef.current.splice(0, historyRef.current.length - 2400)
    }, 1000)

    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); if (timerRef.current != null) window.clearInterval(timerRef.current) }
  }, [])

  const checks = useMemo(() => ({ fps: snap.fps >= 60 && snap.fpsFloor >= 55, p95: snap.frameP95 <= 16.7, p99: snap.frameP99 <= 20, tick: !isPlaying || snap.tickP95 <= 18 }), [isPlaying, snap])
  const drift = useMemo(() => {
    if (historyRef.current.length < 20) return null
    const recent = historyRef.current.slice(-300), first = recent.find((s) => s.heapMb != null), last = [...recent].reverse().find((s) => s.heapMb != null)
    if (!first || !last || first.heapMb == null || last.heapMb == null) return null
    const mins = Math.max(1e-6, (last.tMs - first.tMs) / 60000), delta = last.heapMb - first.heapMb
    return { delta, rate: delta / mins }
  }, [snap.heapMb])

  const exportReport = () => {
    const payload = { generatedAt: new Date().toISOString(), targets: { fps: '60-90', fpsFloor: '>=55', frameP95Ms: '<=16.7', frameP99Ms: '<=20', tickP95Ms: '<=18 while playing' }, playback: { isPlaying, speed, currentTime, duration }, current: snap, drift, samples: historyRef.current }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `telemetryx-perf-report-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 74, zIndex: 9999, minWidth: 250, borderRadius: 10, border: '1px solid rgba(113,160,226,0.45)', background: 'rgba(7,14,27,0.88)', color: '#dbeafe', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 11, padding: '10px 11px', backdropFilter: 'blur(10px)' }}>
      <div style={{ marginBottom: 6, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Perf HUD</div>
      <div>playback: {isPlaying ? `playing ${speed}x` : 'paused'}</div>
      <div style={{ color: c(checks.fps) }}>fps: {snap.fps} | floor: {snap.fpsFloor} (60-90, floor 55)</div>
      <div style={{ color: c(checks.p95) }}>frame p95: {snap.frameP95.toFixed(2)}ms (&lt;=16.7)</div>
      <div style={{ color: c(checks.p99) }}>frame p99: {snap.frameP99.toFixed(2)}ms (&lt;=20)</div>
      <div style={{ color: c(checks.tick) }}>ui tick p95: {snap.tickP95.toFixed(2)}ms (&lt;=18 while playing)</div>
      <div>heap: {snap.heapMb == null ? 'n/a' : `${snap.heapMb.toFixed(1)} MB`}</div>
      <div>drift: {drift == null ? 'n/a' : `${drift.delta >= 0 ? '+' : ''}${drift.delta.toFixed(2)} MB (${drift.rate.toFixed(3)} MB/min)`}</div>
      <button type="button" onClick={exportReport} style={{ marginTop: 6, width: '100%', borderRadius: 6, border: '1px solid rgba(125,175,241,0.55)', background: 'rgba(21,49,87,0.82)', color: '#e3f0ff', padding: '4px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Export Perf Report JSON</button>
    </div>
  )
}
