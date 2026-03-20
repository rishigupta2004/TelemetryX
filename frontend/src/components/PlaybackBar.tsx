import { useCallback, useMemo, useRef } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useSessionTime } from '../lib/timeUtils'
import { getRaceControlState } from '../lib/raceControlState'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

const SPEEDS = [1, 2, 4, 8, 16]

export function PlaybackBar() {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const speed = usePlaybackStore((s) => s.speed)
  const duration = usePlaybackStore((s) => s.duration)
  const sessionTime = useSessionTime()
  const togglePlay = usePlaybackStore((s) => s.togglePlay)
  const seek = usePlaybackStore((s) => s.seek)
  const setSpeed = usePlaybackStore((s) => s.setSpeed)
  const loadingState = useSessionStore((s) => s.loadingState)
  const sessionData = useSessionStore((s) => s.sessionData)
  const scrubberRef = useRef<HTMLDivElement>(null)

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const currentLap = useMemo(() => {
    if (!sessionData?.laps || duration === 0) {
      return { current: 0, total: 0 }
    }

    const laps = sessionData.laps
    const totalLaps = Math.max(...laps.map((lap) => lap.lapNumber))

    let currentLapNum = 0
    for (const lap of laps) {
      if (sessionTime >= lap.lapStartSeconds && sessionTime <= lap.lapEndSeconds) {
        currentLapNum = Math.max(currentLapNum, lap.lapNumber)
      }
    }

    if (currentLapNum === 0) {
      for (const lap of laps) {
        if (lap.lapStartSeconds <= sessionTime) {
          currentLapNum = Math.max(currentLapNum, lap.lapNumber)
        }
      }
    }

    if (currentLapNum === 0) currentLapNum = 1

    return { current: currentLapNum, total: totalLaps }
  }, [sessionData?.laps, sessionTime, duration])

  const handleScrub = useCallback(
    (clientX: number) => {
      if (!scrubberRef.current || duration === 0) return
      const rect = scrubberRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      seek(pct * duration)
    },
    [duration, seek]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleScrub(e.clientX)
      const handleMove = (moveEvent: MouseEvent) => handleScrub(moveEvent.clientX)
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [handleScrub]
  )

  const skipBack = () => seek(Math.max(0, currentTime - 10 * speed))
  const skipForward = () => seek(Math.min(duration, currentTime + 10 * speed))
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isReady = loadingState === 'ready' && duration > 0
  const progressFillColor = useMemo(() => {
    const raceControl = sessionData?.raceControl
    if (!raceControl?.length) return 'var(--color-accent)'
    const sorted = [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
    const state = getRaceControlState(
      sorted,
      sessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    if (state.trackFlag === 'RED') return '#ef4444'
    if (state.isSafetyCar || state.isVSC || state.trackFlag === 'YELLOW' || state.trackFlag === 'DOUBLE YELLOW') {
      return '#facc15'
    }
    return 'var(--color-accent)'
  }, [sessionData?.raceControl, sessionData?.metadata?.raceStartSeconds, sessionTime])

  return (
    <div className="h-[56px] min-w-0 bg-bg-secondary border-t border-border flex items-center px-2 sm:px-3 md:px-4 gap-2 sm:gap-3 flex-shrink-0">
      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={skipBack}
          disabled={!isReady}
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isReady}
          className="p-2 rounded-full bg-accent hover:bg-accent/80 text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={skipForward}
          disabled={!isReady}
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipForward size={16} />
        </button>
      </div>

      <span className="hidden font-mono text-sm text-text-primary w-[64px] text-center sm:inline-block">{formatTime(currentTime)}</span>

      <div
        ref={scrubberRef}
        className="min-w-0 flex-1 h-2 bg-bg-card rounded-full cursor-pointer relative group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, backgroundColor: progressFillColor }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <span className="hidden font-mono text-sm text-text-muted w-[64px] text-center md:inline-block">{formatTime(duration)}</span>

      <div className="hidden text-xs text-text-secondary font-mono w-[80px] text-center lg:block">
        Lap {currentLap.current} / {currentLap.total}
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`px-1 py-0.5 sm:px-1.5 text-[10px] font-mono rounded ${
              speed === s ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
