import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

const SPEEDS = [1, 2, 4, 8, 16]

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

  const sessionLapRanges = useMemo(() => {
    const laps = sessionData?.laps ?? []
    if (!laps.length) return [] as SessionLapRange[]

    const byLap = new Map<number, SessionLapRange>()
    for (const lap of laps) {
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
  }, [sessionData?.laps])

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

  const skipBack = () => seek(Math.max(0, currentTime - 10 * speed))
  const skipForward = () => seek(Math.min(duration, currentTime + 10 * speed))
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isReady = loadingState === 'ready' && duration > 0

  return (
    <div className="flex h-12 flex-shrink-0 items-center gap-2 border-t border-border bg-bg-secondary px-4">
      <div className="flex items-center gap-1">
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
          onClick={togglePlay}
          disabled={!isReady}
          className="rounded-full bg-accent p-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
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
        className="group relative h-2.5 flex-1 cursor-pointer select-none rounded-full bg-bg-card"
        onMouseDown={handleMouseDown}
      >
        {/* Lap marker ticks */}
        {duration > 0 && sessionLapRanges.map((lap) => {
          const pos = ((lap.start - sessionStartTime) / duration) * 100
          if (pos <= 0 || pos >= 100) return null
          return <div key={lap.lapNumber} className="absolute top-0 h-full w-px bg-text-muted/30" style={{ left: `${pos}%` }} />
        })}
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${progress}%` }} />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `calc(${progress}% - 7px)` }}
        />
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
