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

  const raceControl = useMemo(() => sessionData?.raceControl ?? [], [sessionData])
  const scrubberRef = useRef<HTMLDivElement>(null)
  const pendingScrubXRef = useRef<number | null>(null)
  const scrubRafRef = useRef<number | null>(null)
  const dragMoveRef = useRef<((event: MouseEvent) => void) | null>(null)
  const dragUpRef = useRef<(() => void) | null>(null)

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
    return `${m}:${String(s).padStart(2, '0')}.${ms}`
  }

  const sessionLapRanges = useMemo(() => {
    const lapsSource = laps.length ? laps : (sessionData?.laps ?? [])
    if (!lapsSource.length) return [] as SessionLapRange[]

    const byLap = new Map<number, SessionLapRange>()
    for (const lap of lapsSource) {
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
    if (!raceControl || !raceControl.length) return [] as Array<{ start: number; end: number; type: 'SC' | 'VSC' | 'YELLOW' | 'RED' }>
    const sorted = [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
    const active = new Map<'SC' | 'VSC' | 'YELLOW' | 'RED', number>()
    const out: Array<{ start: number; end: number; type: 'SC' | 'VSC' | 'YELLOW' | 'RED' }> = []

    const classify = (msg: { flag?: string | null; category?: string | null; message?: string | null }) => {
      const token = `${msg.flag ?? ''} ${msg.category ?? ''} ${msg.message ?? ''}`.toUpperCase()
      if (token.includes('SAFETY CAR') || token.includes('SAFETY_CAR')) return 'SC'
      if (token.includes('VIRTUAL SAFETY') || token.includes('VSC')) return 'VSC'
      if (token.includes('RED FLAG')) return 'RED'
      if (token.includes('YELLOW')) return 'YELLOW'
      return null
    }

    const isEnd = (token: string) =>
      token.includes('ALL CLEAR') || token.includes('RESUME') || token.includes('ENDED') ||
      token.includes('ENDING') || token.includes('IN THIS LAP') || token.includes('WITHDRAWN') ||
      token.includes('GREEN FLAG')

    const isStart = (token: string) =>
      token.includes('DEPLOY') || token.includes('DEPLOYED') || token.includes('START') ||
      token.includes('ON TRACK') || token.includes('FULL COURSE') || token.includes('VSC') ||
      token.includes('SAFETY CAR') || token.includes('YELLOW FLAG') || token.includes('RED FLAG')

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
    <div className="flex h-[52px] w-full items-center px-[24px] carbon-weave border-t border-border-hard bg-bg-surface shrink-0 gap-[24px]">

      {/* Transport Controls */}
      <div className="flex items-center gap-[8px]">
        <button
          onClick={skipToLapStart} disabled={!isReady}
          className="flex h-[24px] w-[24px] items-center justify-center text-fg-secondary hover:text-fg-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={16} strokeWidth={2} />
        </button>
        <button
          onClick={skipBack} disabled={!isReady}
          className="flex h-[24px] w-[24px] items-center justify-center text-fg-secondary hover:text-fg-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <SkipBack size={16} strokeWidth={2} />
        </button>
        <button
          onClick={stepBack} disabled={!isReady}
          className="flex h-[24px] w-[24px] items-center justify-center text-fg-secondary hover:text-fg-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <StepBack size={16} strokeWidth={2} />
        </button>

        {/* Play Button - 32x32px square */}
        <button
          onClick={togglePlay} disabled={!isReady}
          className="flex h-[32px] w-[32px] mx-[4px] items-center justify-center border-[2px] border-red-core text-red-core disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-ghost transition-colors rounded-[2px]"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <button
          onClick={stepForward} disabled={!isReady}
          className="flex h-[24px] w-[24px] items-center justify-center text-fg-secondary hover:text-fg-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <StepForward size={16} strokeWidth={2} />
        </button>
        <button
          onClick={skipForward} disabled={!isReady}
          className="flex h-[24px] w-[24px] items-center justify-center text-fg-secondary hover:text-fg-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Timeline Scrubber */}
      <div
        className="flex-1 relative h-full flex items-center cursor-pointer group"
        ref={scrubberRef}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-0 right-0 h-[2px] bg-bg-inset">
          {/* Flag Shading */}
          {duration > 0 && flagWindows.map((window, idx) => {
            const startPct = ((window.start - sessionStartTime) / duration) * 100
            const endPct = ((window.end - sessionStartTime) / duration) * 100
            const left = Math.max(0, Math.min(100, startPct))
            const width = Math.max(0, Math.min(100, endPct) - left)
            let color = 'var(--amber-warn)'
            if (window.type === 'SC') color = 'var(--orange-sc)'
            if (window.type === 'RED') color = 'var(--red-danger)'
            if (width <= 0) return null
            return <div key={`${window.type}-${idx}`} className="absolute top-0 bottom-0 opacity-80" style={{ left: `${left}%`, width: `${width}%`, background: color }} />
          })}

          {/* Played Portion */}
          <div className="absolute left-0 top-0 bottom-0 bg-red-core" style={{ width: `${progress}%` }} />
        </div>

        {/* Lap Markers */}
        {duration > 0 && sessionLapRanges.map((lap) => {
          const pos = ((lap.start - sessionStartTime) / duration) * 100
          if (pos <= 0 || pos >= 100) return null
          const major = lap.lapNumber % 5 === 0
          return (
            <div key={lap.lapNumber} className="absolute left-0 top-1/2" style={{ transform: `translate(-50%, -50%)`, left: `${pos}%` }}>
              <div
                className={`w-[1px] bg-fg-ghost mx-auto ${major ? 'h-[6px]' : 'h-[4px]'}`}
                style={{ transform: 'translateY(-120%)' }}
              />
              {major && (
                <div className="absolute top-[8px] -left-[10px] w-[20px] text-center text-micro text-fg-muted">
                  {lap.lapNumber}
                </div>
              )}
            </div>
          )
        })}

        {/* Playhead Thumb (12px tall, 2px wide, no circle) */}
        <div
          className="absolute top-1/2 w-[2px] h-[12px] bg-fg-primary group-hover:scale-y-150 transition-transform pointer-events-none"
          style={{ left: `calc(${progress}% - 1px)`, transform: 'translateY(-50%)' }}
        >
          <div className="absolute bottom-[-3px] left-[-2px] w-[6px] h-[3px]">
            <svg width="6" height="3" viewBox="0 0 6 3" fill="var(--fg-primary)">
              <polygon points="0,0 6,0 3,3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Current Time / Lap Info */}
      <div className="flex items-center gap-[16px] w-[200px] justify-end whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-mono text-fg-primary">{formatTime(currentTime)}</span>
          <span className="text-[11px] text-fg-muted" style={{ fontFamily: 'var(--font-heading)' }}>
            LAP {currentLap.current}
            <span className="text-fg-ghost mx-1">/</span>
            {currentLap.total}
          </span>
        </div>

        {/* Speed Dropdown */}
        <div className="flex items-center border border-border-hard rounded-[2px] overflow-hidden bg-bg-inset">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-[24px] w-[24px] text-[10px] font-mono font-bold flex items-center justify-center transition-colors ${speed === s ? 'bg-bg-elevated text-red-core' : 'text-fg-muted hover:text-fg-primary'
                }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
