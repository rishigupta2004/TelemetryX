import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ChevronsLeft, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

const SPEEDS = [1, 2, 4, 8, 16]
const FRAME_STEP = 0.1
const SKIP_STEP = 5
const SKIP_BIG_STEP = 30

type SessionLapRange = {
  lapNumber: number
  start: number
  end: number
}

function upperBound(values: number[], target: number): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (values[mid] <= target) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function PlaybackBar() {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const speed = usePlaybackStore((s) => s.speed)
  const duration = usePlaybackStore((s) => s.duration)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const sessionTime = useSessionTime()
  const togglePlay = usePlaybackStore((s) => s.togglePlay)
  const seek = usePlaybackStore((s) => s.seek)
  const setSpeed = usePlaybackStore((s) => s.setSpeed)
  const loadingState = useSessionStore((s) => s.loadingState)
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)
  const raceControl = useSessionStore((s) => s.sessionData?.raceControl ?? [])
  const scrubberRef = useRef<HTMLDivElement>(null)
  const pendingScrubXRef = useRef<number | null>(null)
  const scrubRafRef = useRef<number | null>(null)
  const dragMoveRef = useRef<((event: MouseEvent) => void) | null>(null)
  const dragUpRef = useRef<(() => void) | null>(null)

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatLapTime = (seconds: number) => {
    const clamped = Math.max(0, seconds)
    const mins = Math.floor(clamped / 60)
    const secs = clamped % 60
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
  }

  const sessionLapRanges = useMemo(() => {
    const lapRows = laps.length ? laps : (sessionData?.laps ?? [])
    const lapsSource = lapRows
    const lapsList = lapsSource
    if (!lapsList.length) return [] as SessionLapRange[]

    const byLap = new Map<number, SessionLapRange>()
    for (const lap of lapsList) {
      const existing = byLap.get(lap.lapNumber)
      if (!existing) {
        byLap.set(lap.lapNumber, {
          lapNumber: lap.lapNumber,
          start: lap.lapStartSeconds,
          end: lap.lapEndSeconds
        })
        continue
      }
      if (lap.lapStartSeconds < existing.start) existing.start = lap.lapStartSeconds
      if (lap.lapEndSeconds > existing.end) existing.end = lap.lapEndSeconds
    }

    return Array.from(byLap.values()).sort((a, b) => a.start - b.start)
  }, [laps, sessionData?.laps])

  const lapRangeStarts = useMemo(() => sessionLapRanges.map((lap) => lap.start), [sessionLapRanges])

  const currentLap = useMemo(() => {
    if (!sessionLapRanges.length || duration === 0) return { current: 0, total: 0 }

    const totalLaps = sessionLapRanges.reduce((max, lap) => Math.max(max, lap.lapNumber), 0)
    const idx = upperBound(lapRangeStarts, sessionTime) - 1
    if (idx < 0) return { current: 1, total: totalLaps }

    const lap = sessionLapRanges[Math.min(idx, sessionLapRanges.length - 1)]
    if (sessionTime <= lap.end) return { current: lap.lapNumber, total: totalLaps }

    // Driver has completed this lap and is ON the next one
    return { current: Math.min(lap.lapNumber + 1, totalLaps), total: totalLaps }
  }, [sessionLapRanges, lapRangeStarts, sessionTime, duration])

  const currentLapWindow = useMemo(() => {
    if (!sessionLapRanges.length) return null
    const idx = upperBound(lapRangeStarts, sessionTime) - 1
    if (idx < 0) return null
    const lap = sessionLapRanges[Math.min(idx, sessionLapRanges.length - 1)]
    return lap
  }, [sessionLapRanges, lapRangeStarts, sessionTime])

  const currentLapTime = useMemo(() => {
    if (!currentLapWindow) return null
    const t = Math.min(currentLapWindow.end, Math.max(currentLapWindow.start, sessionTime))
    return Math.max(0, t - currentLapWindow.start)
  }, [currentLapWindow, sessionTime])

  const handleScrub = useCallback(
    (clientX: number) => {
      if (!scrubberRef.current || duration === 0) return
      const rect = scrubberRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      seek(pct * duration)
    },
    [duration, seek]
  )

  const flushScrub = useCallback(() => {
    scrubRafRef.current = null
    if (pendingScrubXRef.current == null) return
    handleScrub(pendingScrubXRef.current)
  }, [handleScrub])

  const enqueueScrub = useCallback(
    (clientX: number) => {
      pendingScrubXRef.current = clientX
      if (scrubRafRef.current == null) scrubRafRef.current = window.requestAnimationFrame(flushScrub)
    },
    [flushScrub]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      enqueueScrub(e.clientX)
      const handleMove = (moveEvent: MouseEvent) => enqueueScrub(moveEvent.clientX)
      const handleUp = () => {
        if (pendingScrubXRef.current != null) handleScrub(pendingScrubXRef.current)
        if (dragMoveRef.current) window.removeEventListener('mousemove', dragMoveRef.current)
        if (dragUpRef.current) window.removeEventListener('mouseup', dragUpRef.current)
        dragMoveRef.current = null
        dragUpRef.current = null
      }
      dragMoveRef.current = handleMove
      dragUpRef.current = handleUp
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [enqueueScrub, handleScrub]
  )

  useEffect(() => {
    return () => {
      if (scrubRafRef.current != null) window.cancelAnimationFrame(scrubRafRef.current)
      if (dragMoveRef.current) window.removeEventListener('mousemove', dragMoveRef.current)
      if (dragUpRef.current) window.removeEventListener('mouseup', dragUpRef.current)
    }
  }, [])

  const skipBack = () => seek(Math.max(0, currentTime - SKIP_STEP))
  const skipForward = () => seek(Math.min(duration, currentTime + SKIP_STEP))
  const stepBack = () => seek(Math.max(0, currentTime - FRAME_STEP))
  const stepForward = () => seek(Math.min(duration, currentTime + FRAME_STEP))
  const skipToLapStart = () => {
    if (!sessionLapRanges.length) return
    const idx = upperBound(lapRangeStarts, sessionTime) - 1
    if (idx < 0) return
    const lap = sessionLapRanges[Math.min(idx, sessionLapRanges.length - 1)]
    seek(Math.max(0, lap.start - sessionStartTime))
  }
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isReady = loadingState === 'ready' && duration > 0

  const flagWindows = useMemo(() => {
    if (!raceControl || !raceControl.length) return [] as Array<{ start: number; end: number; type: 'SC' | 'VSC' | 'YELLOW' }>
    const sorted = [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
    const active = new Map<'SC' | 'VSC' | 'YELLOW', number>()
    const out: Array<{ start: number; end: number; type: 'SC' | 'VSC' | 'YELLOW' }> = []
    const classify = (msg: { flag?: string | null; category?: string | null; message?: string | null }) => {
      const token = `${msg.flag ?? ''} ${msg.category ?? ''} ${msg.message ?? ''}`.toUpperCase()
      if (token.includes('SAFETY CAR') || token.includes('SAFETY_CAR')) return 'SC'
      if (token.includes('VIRTUAL SAFETY') || token.includes('VSC')) return 'VSC'
      if (token.includes('YELLOW')) return 'YELLOW'
      return null
    }
    const isEnd = (token: string) =>
      token.includes('ALL CLEAR') ||
      token.includes('RESUME') ||
      token.includes('ENDED') ||
      token.includes('ENDING') ||
      token.includes('IN THIS LAP') ||
      token.includes('WITHDRAWN') ||
      token.includes('GREEN FLAG')
    const isStart = (token: string) =>
      token.includes('DEPLOY') ||
      token.includes('DEPLOYED') ||
      token.includes('START') ||
      token.includes('ON TRACK') ||
      token.includes('FULL COURSE') ||
      token.includes('VSC') ||
      token.includes('SAFETY CAR') ||
      token.includes('YELLOW FLAG')

    for (const msg of sorted) {
      const type = classify(msg)
      if (!type) continue
      const token = `${msg.flag ?? ''} ${msg.category ?? ''} ${msg.message ?? ''}`.toUpperCase()
      const t = msg.timestamp
      if (isStart(token) && !active.has(type)) {
        active.set(type, t)
        continue
      }
      if (isEnd(token) && active.has(type)) {
        out.push({ start: active.get(type) as number, end: t, type })
        active.delete(type)
      }
    }
    return out
  }, [raceControl])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as HTMLElement).isContentEditable)) return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
        return
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        seek(Math.max(0, currentTime - (event.shiftKey ? SKIP_BIG_STEP : SKIP_STEP)))
        return
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault()
        seek(Math.min(duration, currentTime + (event.shiftKey ? SKIP_BIG_STEP : SKIP_STEP)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTime, duration, seek, togglePlay])

  return (
    <div className="flex h-16 flex-shrink-0 items-center gap-2 border-t border-border bg-bg-secondary px-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={skipToLapStart}
          disabled={!isReady}
          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-hover/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
          title="Skip to lap start"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          onClick={skipBack}
          disabled={!isReady}
          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-hover/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          onClick={stepBack}
          disabled={!isReady}
          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-hover/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
          title="Frame step back"
        >
          <StepBack size={16} />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isReady}
          className="rounded-full bg-accent p-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={stepForward}
          disabled={!isReady}
          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-hover/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
          title="Frame step forward"
        >
          <StepForward size={16} />
        </button>
        <button
          type="button"
          onClick={skipForward}
          disabled={!isReady}
          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-hover/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipForward size={16} />
        </button>
      </div>

      <span className="hidden w-[78px] text-center font-mono text-sm text-text-primary md:inline">{formatTime(currentTime)}</span>

      <div
        ref={scrubberRef}
        className="group relative h-3 flex-1 cursor-pointer select-none overflow-hidden rounded-full bg-bg-card"
        onMouseDown={handleMouseDown}
      >
        {/* Flag shading */}
        {duration > 0 && flagWindows.map((window, idx) => {
          const startPct = ((window.start - sessionStartTime) / duration) * 100
          const endPct = ((window.end - sessionStartTime) / duration) * 100
          const left = Math.max(0, Math.min(100, startPct))
          const width = Math.max(0, Math.min(100, endPct) - left)
          const color =
            window.type === 'SC'
              ? 'rgba(255, 153, 0, 0.35)'
              : window.type === 'VSC'
                ? 'rgba(255, 208, 0, 0.35)'
                : 'rgba(255, 235, 59, 0.25)'
          if (width <= 0) return null
          return <div key={`${window.type}-${idx}`} className="absolute inset-y-0" style={{ left: `${left}%`, width: `${width}%`, background: color }} />
        })}
        {/* Lap marker ticks */}
        {duration > 0 && sessionLapRanges.map((lap) => {
          const pos = ((lap.start - sessionStartTime) / duration) * 100
          if (pos <= 0 || pos >= 100) return null
          const major = lap.lapNumber % 5 === 0
          return (
            <div
              key={lap.lapNumber}
              className="absolute top-0 h-full"
              style={{
                left: `${pos}%`,
                width: major ? 2 : 1,
                background: major ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)'
              }}
            />
          )
        })}
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${progress}%` }} />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.35)]"
          style={{ left: `calc(${progress}% - 8px)` }}
        />
        {currentLapTime != null && (
          <div
            className="absolute -top-5 flex items-center gap-1 rounded bg-bg-card/90 px-2 py-0.5 text-[10px] font-mono text-text-secondary shadow"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          >
            Lap {currentLap.current} · {formatLapTime(currentLapTime)}
          </div>
        )}
      </div>

      <span className="hidden w-[78px] text-center font-mono text-sm text-text-muted md:inline">{formatTime(duration)}</span>

      <div className="w-[70px] text-center font-mono text-[11px] text-text-secondary sm:w-[90px] sm:text-xs">
        Lap {currentLap.current} / {currentLap.total}
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors sm:px-2 ${speed === s ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
              }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
