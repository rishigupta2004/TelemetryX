import { create } from 'zustand'

interface PlaybackState {
  currentTime: number
  isPlaying: boolean
  speed: number
  duration: number
  sessionStartTime: number
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  setDuration: (duration: number, sessionStartTime: number) => void
  reset: () => void
}

let _animFrameId: number | null = null
let _lastFrameTime: number | null = null
let _internalTime = 0
let _lastStoreUpdate = 0

const MIN_UPDATE_INTERVAL_MS = 6
const MAX_UPDATE_INTERVAL_MS = 85
const MIN_STORE_TIME_DELTA = 1 / 90
const MAX_DELTA_S = 0.5

function computeUpdateIntervalMs(speed: number): number {
  const visibilityMultiplier = typeof document !== 'undefined' && document.hidden ? 1.85 : 1
  const speedFactor = Math.max(1, speed)
  const base = 22 / Math.sqrt(speedFactor)
  const interval = base * visibilityMultiplier
  return Math.max(MIN_UPDATE_INTERVAL_MS, Math.min(MAX_UPDATE_INTERVAL_MS, interval))
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTime: 0,
  isPlaying: false,
  speed: 1,
  duration: 0,
  sessionStartTime: 0,

  play: () => {
    const state = get()
    if (state.isPlaying || state.duration === 0) return

    _lastFrameTime = performance.now()
    _lastStoreUpdate = _lastFrameTime
    _internalTime = state.currentTime
    set({ isPlaying: true })

    const tick = (now: number) => {
      const s = get()
      if (!s.isPlaying) return

      const delta = Math.min((now - (_lastFrameTime || now)) / 1000, MAX_DELTA_S)
      _lastFrameTime = now
      _internalTime += delta * s.speed

      if (_internalTime >= s.duration) {
        _internalTime = s.duration
        set({ currentTime: _internalTime, isPlaying: false })
        _animFrameId = null
        return
      }

      const updateIntervalMs = computeUpdateIntervalMs(s.speed)
      if (now - _lastStoreUpdate >= updateIntervalMs && Math.abs(_internalTime - s.currentTime) >= MIN_STORE_TIME_DELTA) {
        set({ currentTime: _internalTime })
        _lastStoreUpdate = now
      }

      _animFrameId = requestAnimationFrame(tick)
    }

    _animFrameId = requestAnimationFrame(tick)
  },

  pause: () => {
    if (_animFrameId) cancelAnimationFrame(_animFrameId)
    _animFrameId = null
    _lastFrameTime = null
    set({ isPlaying: false, currentTime: _internalTime })
  },

  togglePlay: () => {
    const s = get()
    if (s.isPlaying) {
      s.pause()
    } else {
      if (s.currentTime >= s.duration) {
        _internalTime = 0
        set({ currentTime: 0 })
      }
      s.play()
    }
  },

  seek: (time: number) => {
    const s = get()
    const clamped = Math.max(0, Math.min(time, s.duration))
    _internalTime = clamped
    set({ currentTime: clamped })
  },

  setSpeed: (speed: number) => set({ speed }),

  setDuration: (duration: number, sessionStartTime: number) => {
    if (_animFrameId) cancelAnimationFrame(_animFrameId)
    _animFrameId = null
    _lastFrameTime = null
    _internalTime = 0
    set({ duration, sessionStartTime, currentTime: 0, isPlaying: false })
  },

  reset: () => {
    if (_animFrameId) cancelAnimationFrame(_animFrameId)
    _animFrameId = null
    _lastFrameTime = null
    _internalTime = 0
    set({
      currentTime: 0,
      isPlaying: false,
      speed: 1,
      duration: 0,
      sessionStartTime: 0
    })
  }
}))
