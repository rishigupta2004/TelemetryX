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

const selectPlaybackState = (s: ReturnType<typeof usePlaybackStore.getState>) => ({
  currentTime: s.currentTime,
  isPlaying: s.isPlaying,
  speed: s.speed,
  duration: s.duration,
  sessionStartTime: s.sessionStartTime,
  togglePlay: s.togglePlay,
  seek: s.seek,
  setSpeed: s.setSpeed
})

const selectSessionData = (s: ReturnType<typeof useSessionStore.getState>) => ({
  loadingState: s.loadingState,
  sessionData: s.sessionData,
  laps: s.laps
})

const formatTimeCache = new Map<number, string>()
const CACHE_MAX_SIZE = 1000

function formatTime(seconds: number): string {
  const cached = formatTimeCache.get(seconds)
  if (cached) return cached
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  
  const result = h > 0 
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
    : `${m}:${String(s).padStart(2, '0')}.${ms}`
  
  if (formatTimeCache.size >= CACHE_MAX_SIZE) {
    formatTimeCache.clear()
  }
  formatTimeCache.set(seconds, result)
  return result
}

export function PlaybackBar() {
  const {
    currentTime,
    isPlaying,
    speed,
    duration,
    sessionStartTime,
    togglePlay,
    seek,
    setSpeed
  } = usePlaybackStore(selectPlaybackState)
  
  const { loadingState, sessionData, laps: lapsData } = useSessionStore(selectSessionData)
  
  const sessionTime = useSessionTime()
  
  const scrubberRef = useRef<HTMLDivElement>(null)
  const pendingScrubXRef = useRef<number | null>(null)
  const scrubRafRef = useRef<number | null>(null)
  const dragMoveRef = useRef<((event: MouseEvent) => void) | null>(null)
  const dragUpRef = useRef<(() => void) | null>(null)

  const raceControl = useMemo(() => sessionData?.raceControl ?? [], [sessionData])

  const sessionLapRanges = useMemo(() => {
    const lapsSource = lapsData.length ? lapsData : (sessionData?.laps ?? [])
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
  }, [lapsData, sessionData?.laps])

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

  const skipBack = useCallback(() => seek(Math.max(0, currentTime - SKIP_STEP)), [currentTime, seek])
  const skipForward = useCallback(() => seek(Math.min(duration, currentTime + SKIP_STEP)), [currentTime, duration, seek])
  const stepBack = useCallback(() => seek(Math.max(0, currentTime - FRAME_STEP)), [currentTime, seek])
  const stepForward = useCallback(() => seek(Math.min(duration, currentTime + FRAME_STEP)), [currentTime, duration, seek])
  
  const skipToLapStart = useCallback(() => {
    if (!sessionLapRanges.length) return
    const idx = upperBound(lapRangeStarts, sessionTime) - 1
    if (idx < 0) return
    const lap = sessionLapRanges[Math.min(idx, sessionLapRanges.length - 1)]
    seek(Math.max(0, lap.start - sessionStartTime))
  }, [sessionLapRanges, lapRangeStarts, sessionTime, sessionStartTime, seek])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isReady = loadingState === 'ready' && duration > 0
  const formattedTime = formatTime(currentTime)

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

  const lapMarkers = useMemo(() => {
    if (duration <= 0) return []
    const markers: Array<{ pos: number; lapNumber: number; major: boolean }> = []
    for (const lap of sessionLapRanges) {
      const pos = ((lap.start - sessionStartTime) / duration) * 100
      if (pos <= 0 || pos >= 100) continue
      markers.push({
        pos,
        lapNumber: lap.lapNumber,
        major: lap.lapNumber % 5 === 0
      })
    }
    return markers
  }, [sessionLapRanges, sessionStartTime, duration])

  const flagShading = useMemo(() => {
    if (duration <= 0) return []
    return flagWindows.map((window, idx) => {
      const startPct = ((window.start - sessionStartTime) / duration) * 100
      const endPct = ((window.end - sessionStartTime) / duration) * 100
      const left = Math.max(0, Math.min(100, startPct))
      const width = Math.max(0, Math.min(100, endPct) - left)
      let color = 'var(--amber-warn)'
      if (window.type === 'SC') color = 'var(--orange-sc)'
      if (window.type === 'RED') color = 'var(--red-danger)'
      if (width <= 0) return null
      return { left, width, color, key: `${window.type}-${idx}` }
    }).filter(Boolean) as Array<{ left: number; width: number; color: string; key: string }>
  }, [flagWindows, sessionStartTime, duration])

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
    <div className="flex h-[60px] w-full items-center px-[24px] gradient-header border-t border-border-hard bg-bg-surface shrink-0 gap-[24px] shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">

      {/* Transport Controls */}
      <div className="flex items-center gap-[4px]">
        <button
          onClick={skipToLapStart} disabled={!isReady}
          className="flex h-[28px] w-[28px] items-center justify-center text-fg-secondary hover:text-fg-primary hover:bg-bg-elevated rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 scale-hover"
        >
          <ChevronsLeft size={18} strokeWidth={2} />
        </button>
        <button
          onClick={skipBack} disabled={!isReady}
          className="flex h-[28px] w-[28px] items-center justify-center text-fg-secondary hover:text-fg-primary hover:bg-bg-elevated rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 scale-hover"
        >
          <SkipBack size={18} strokeWidth={2} />
        </button>
        <button
          onClick={stepBack} disabled={!isReady}
          className="flex h-[28px] w-[28px] items-center justify-center text-fg-secondary hover:text-fg-primary hover:bg-bg-elevated rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 scale-hover"
        >
          <StepBack size={18} strokeWidth={2} />
        </button>

        {/* Play Button - larger with glow effect */}
        <button
          onClick={togglePlay} disabled={!isReady}
          className={`flex h-[40px] w-[40px] mx-[6px] items-center justify-center border-[2px] text-red-core disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 rounded-full btn-glow
            ${isPlaying 
              ? 'border-red-core bg-red-core/20 shadow-[0_0_20px_rgba(239,68,68,0.6)] glow-pulse' 
              : 'border-red-core/60 hover:border-red-core hover:bg-red-ghost hover:scale-105 hover:shadow-[0_0_12px_rgba(239,68,68,0.4)]'
            }`}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>

        <button
          onClick={stepForward} disabled={!isReady}
          className="flex h-[28px] w-[28px] items-center justify-center text-fg-secondary hover:text-fg-primary hover:bg-bg-elevated rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 scale-hover"
        >
          <StepForward size={18} strokeWidth={2} />
        </button>
        <button
          onClick={skipForward} disabled={!isReady}
          className="flex h-[28px] w-[28px] items-center justify-center text-fg-secondary hover:text-fg-primary hover:bg-bg-elevated rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 scale-hover"
        >
          <SkipForward size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Timeline Scrubber */}
      <div
        className="flex-1 relative h-full flex items-center cursor-pointer group"
        ref={scrubberRef}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-0 right-0 h-[6px] bg-bg-inset rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden">
          {/* Flag Shading */}
          {flagShading.map((f) => (
            f && <div key={f.key} className="absolute top-0 bottom-0 opacity-80 rounded-full" style={{ left: `${f.left}%`, width: `${f.width}%`, background: f.color }} />
          ))}

          {/* Played Portion with gradient and glow */}
          <div 
            className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-100 ${isPlaying ? 'shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'shadow-[0_0_4px_rgba(239,68,68,0.3)]'}`}
            style={{ 
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%)'
            }} 
          />
        </div>

        {/* Lap Markers */}
        {lapMarkers.map((marker) => (
          <div key={marker.lapNumber} className="absolute left-0 top-1/2" style={{ transform: `translate(-50%, -50%)`, left: `${marker.pos}%` }}>
            <div
              className={`w-[2px] bg-fg-muted/50 mx-auto transition-all duration-200 ${marker.major ? 'h-[10px]' : 'h-[6px]'}`}
              style={{ transform: 'translateY(-140%)' }}
            />
            {marker.major && (
              <div className="absolute top-[10px] -left-[12px] w-[24px] text-center text-[10px] font-medium text-fg-muted">
                {marker.lapNumber}
              </div>
            )}
          </div>
        ))}

        {/* Playhead Thumb */}
        <div
          className={`absolute top-1/2 w-[14px] h-[14px] bg-white rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8),0_2px_4px_rgba(0,0,0,0.3)] group-hover:scale-125 transition-all duration-150 pointer-events-none border-2 ${isPlaying ? 'border-red-500 shadow-[0_0_16px_rgba(239,68,68,1)]' : 'border-red-core'}`}
          style={{ left: `calc(${progress}% - 7px)`, transform: 'translateY(-50%)' }}
        />
      </div>

      {/* Current Time / Lap Info */}
      <div className="flex items-center gap-[16px] w-[200px] justify-end whitespace-nowrap">
        <div className="flex items-center gap-3 bg-bg-elevated/80 px-3 py-1.5 rounded-md shadow-sm border border-border-soft/50 transition-all duration-200 hover:bg-bg-elevated hover:border-border-soft">
          <span className="text-[14px] font-mono font-semibold text-fg-primary">{formattedTime}</span>
          <span className="text-[11px] text-fg-muted" style={{ fontFamily: 'var(--font-heading)' }}>
            LAP {currentLap.current}
            <span className="text-fg-ghost mx-1">/</span>
            {currentLap.total}
          </span>
        </div>

        {/* Speed Dropdown */}
        <div className="flex items-center shadow-sm rounded-[6px] overflow-hidden bg-bg-inset border border-border-soft">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-[26px] min-w-[32px] px-2 text-[11px] font-mono font-bold flex items-center justify-center transition-all duration-200 ${speed === s 
                  ? 'bg-red-core text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' 
                  : 'text-fg-muted hover:text-fg-primary hover:bg-bg-elevated'
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
