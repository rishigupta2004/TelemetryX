import { create } from 'zustand'

interface PlaybackState {
  currentTime: number
  isPlaying: boolean
  speed: number
  duration: number
  sessionStartTime: number
  externalClock: boolean
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setSpeed: (speed: number) => void
  setDuration: (duration: number, sessionStartTime: number) => void
  setExternalClock: (enabled: boolean) => void
  reset: () => void
}

let _animFrameId: number | null = null
let _lastTimestamp: number | null = null
let _internalTime = 0

const MIN_UPDATE_INTERVAL_MS = 6
const MAX_UPDATE_INTERVAL_MS = 85
const MIN_STORE_TIME_DELTA = 1 / 90
const MAX_DELTA_S = 0.5

function stopLoop() {
  if (_animFrameId !== null) {
    cancelAnimationFrame(_animFrameId)
    _animFrameId = null
  }
  _lastTimestamp = null
}

function startLoop(getState: () => PlaybackState, set: (partial: Partial<PlaybackState>) => void) {
  stopLoop()

  const tick = (timestamp: number) => {
    const state = getState()

    if (!state.isPlaying) {
      _lastTimestamp = null
      return
    }

    if (_lastTimestamp === null) {
      _lastTimestamp = timestamp
      _animFrameId = requestAnimationFrame(tick)
      return
    }

    const elapsed = (timestamp - _lastTimestamp) / 1000
    _lastTimestamp = timestamp

    const delta = Math.min(elapsed * state.speed, MAX_DELTA_S)
    _internalTime = Math.min(_internalTime + delta, state.duration)

    set({ currentTime: _internalTime })

    if (_internalTime >= state.duration) {
      set({ isPlaying: false, currentTime: _internalTime })
      _lastTimestamp = null
      return
    }

    _animFrameId = requestAnimationFrame(tick)
  }

  _animFrameId = requestAnimationFrame(tick)
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTime: 0,
  isPlaying: false,
  speed: 1,
  duration: 0,
  sessionStartTime: 0,
  externalClock: false,

  play: () => {
    const state = get()
    if (state.isPlaying || state.duration === 0) return
    if (state.externalClock) {
      set({ isPlaying: true })
      return
    }

    _internalTime = state.currentTime
    set({ isPlaying: true })
    startLoop(get, set)
  },

  pause: () => {
    stopLoop()
    set({ isPlaying: false, currentTime: _internalTime })
  },

  togglePlay: () => {
    const s = get()
    if (s.isPlaying) {
      get().pause()
    } else {
      if (s.currentTime >= s.duration) {
        _internalTime = 0
        set({ currentTime: 0 })
      }
      get().play()
    }
  },

  seek: (time: number) => {
    const wasPlaying = get().isPlaying
    stopLoop()
    const clamped = Math.max(0, Math.min(time, get().duration))
    _internalTime = clamped
    set({ currentTime: clamped, isPlaying: false })
    if (wasPlaying) {
      get().play()
    }
  },

  setCurrentTime: (time: number) => {
    const clamped = Math.max(0, Math.min(time, get().duration))
    _internalTime = clamped
    set({ currentTime: clamped })
  },

  setSpeed: (speed: number) => set({ speed }),

  setDuration: (duration: number, sessionStartTime: number) => {
    stopLoop()
    _internalTime = 0
    set({ duration, sessionStartTime, currentTime: 0, isPlaying: false })
  },

  setExternalClock: (enabled: boolean) => {
    if (enabled) stopLoop()
    set({ externalClock: enabled })
  },

  reset: () => {
    stopLoop()
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
