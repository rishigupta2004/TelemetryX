import { create } from 'zustand'

interface PlaybackState {
  currentTime: number
  isPlaying: boolean
  speed: number
  duration: number
  sessionStartTime: number
  externalClock: boolean
  replayPosition: number
  totalRaceDistance: number
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setSpeed: (speed: number) => void
  setDuration: (duration: number, sessionStartTime: number) => void
  setExternalClock: (enabled: boolean) => void
  setReplayPosition: (position: number) => void
  getReplayPosition: () => number
  setTotalRaceDistance: (laps: number) => void
  reset: () => void
}

let _animFrameId: number | null = null
let _lastTimestamp: number | null = null
let _lastPerfTime = 0
let _internalTime = 0
let _targetTime = 0
let _cachedState: { isPlaying: boolean; speed: number; duration: number } | null = null
let _setState: ((partial: Partial<PlaybackState>) => void) | null = null
let _pendingTimeUpdate = false
let _batchFrameId: number | null = null

const MIN_UPDATE_INTERVAL_MS = 6
const MAX_UPDATE_INTERVAL_MS = 85
const MIN_STORE_TIME_DELTA = 1 / 90
const MAX_DELTA_S = 0.5
const TIME_SMOOTHING_FACTOR = 0.85
const BATCH_INTERVAL_MS = 8

function stopLoop() {
  if (_animFrameId !== null) {
    cancelAnimationFrame(_animFrameId)
    _animFrameId = null
  }
  if (_batchFrameId !== null) {
    cancelAnimationFrame(_batchFrameId)
    _batchFrameId = null
  }
  _lastTimestamp = null
  _lastPerfTime = 0
  _cachedState = null
  _pendingTimeUpdate = false
}

function flushTimeUpdate() {
  if (!_pendingTimeUpdate || !_setState) return
  _pendingTimeUpdate = false
  _setState({ currentTime: _internalTime })
}

function scheduleBatchUpdate() {
  if (_batchFrameId !== null || !_setState) return
  _batchFrameId = requestAnimationFrame(() => {
    _batchFrameId = null
    flushTimeUpdate()
  })
}

function enqueueTimeUpdate() {
  _pendingTimeUpdate = true
  scheduleBatchUpdate()
}

function startLoop(getState: () => PlaybackState, set: (partial: Partial<PlaybackState>) => void) {
  stopLoop()
  _setState = set
  _targetTime = _internalTime

  const tick = (timestamp: number) => {
    if (!_cachedState) {
      const s = getState()
      _cachedState = { isPlaying: s.isPlaying, speed: s.speed, duration: s.duration }
    }

    if (!_cachedState.isPlaying) {
      _lastTimestamp = null
      return
    }

    const perfNow = performance.now()
    
    if (_lastTimestamp === null) {
      _lastTimestamp = timestamp
      _lastPerfTime = perfNow
      _animFrameId = requestAnimationFrame(tick)
      return
    }

    const rawElapsed = (timestamp - _lastTimestamp) / 1000
    const perfElapsed = (perfNow - _lastPerfTime) / 1000
    
    const smoothedElapsed = rawElapsed * (1 - TIME_SMOOTHING_FACTOR) + perfElapsed * TIME_SMOOTHING_FACTOR
    
    _lastTimestamp = timestamp
    _lastPerfTime = perfNow

    const delta = Math.min(smoothedElapsed * _cachedState.speed, MAX_DELTA_S)
    _targetTime = Math.min(_targetTime + delta, _cachedState.duration)
    
    _internalTime = _targetTime

    enqueueTimeUpdate()

    if (_internalTime >= _cachedState.duration) {
      const replayPos = _cachedState.duration > 0 ? _internalTime / _cachedState.duration : 0
      set({ isPlaying: false, currentTime: _internalTime, replayPosition: replayPos })
      _lastTimestamp = null
      _cachedState = null
      return
    }

    _animFrameId = requestAnimationFrame(tick)
  }

  _cachedState = {
    isPlaying: true,
    speed: getState().speed,
    duration: getState().duration
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
  replayPosition: 0,
  totalRaceDistance: 0,

  play: () => {
    const state = get()
    if (state.isPlaying || state.duration === 0) return
    if (state.externalClock) {
      set({ isPlaying: true })
      return
    }

    _internalTime = state.currentTime
    _targetTime = state.currentTime
    set({ isPlaying: true })
    startLoop(get, set)
  },

  pause: () => {
    stopLoop()
    _setState = null
    _internalTime = _targetTime
    const replayPos = get().duration > 0 ? _internalTime / get().duration : 0
    set({ isPlaying: false, currentTime: _internalTime, replayPosition: replayPos })
  },

  togglePlay: () => {
    const s = get()
    if (s.isPlaying) {
      get().pause()
    } else {
      if (s.currentTime >= s.duration) {
        _internalTime = 0
        _targetTime = 0
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
    _targetTime = clamped
    const replayPos = get().duration > 0 ? clamped / get().duration : 0
    set({ currentTime: clamped, replayPosition: replayPos, isPlaying: false })
    if (wasPlaying) {
      get().play()
    }
  },

  setCurrentTime: (time: number) => {
    const clamped = Math.max(0, Math.min(time, get().duration))
    _internalTime = clamped
    _targetTime = clamped
    const replayPos = get().duration > 0 ? clamped / get().duration : 0
    set({ currentTime: clamped, replayPosition: replayPos })
  },

  setSpeed: (speed: number) => {
    set({ speed })
    if (_cachedState) _cachedState.speed = speed
  },

  setDuration: (duration: number, sessionStartTime: number) => {
    stopLoop()
    _internalTime = 0
    _targetTime = 0
    _cachedState = null          // force rebuild on next play()
    set({ duration, sessionStartTime, currentTime: 0, isPlaying: false, replayPosition: 0 })
  },

  setExternalClock: (enabled: boolean) => {
    if (enabled) stopLoop()
    set({ externalClock: enabled })
  },

  setReplayPosition: (position: number) => {
    const state = get()
    const clamped = Math.max(0, Math.min(1, position))
    const time = clamped * state.duration
    const wasPlaying = state.isPlaying
    stopLoop()
    _internalTime = time
    _targetTime = time
    set({ currentTime: time, replayPosition: clamped, isPlaying: false })
    if (wasPlaying) {
      get().play()
    }
  },

  getReplayPosition: () => {
    const state = get()
    return state.duration > 0 ? state.currentTime / state.duration : 0
  },

  setTotalRaceDistance: (laps: number) => {
    set({ totalRaceDistance: laps })
  },

  reset: () => {
    stopLoop()
    _internalTime = 0
    _targetTime = 0
    set({
      currentTime: 0,
      isPlaying: false,
      speed: 1,
      duration: 0,
      sessionStartTime: 0,
      replayPosition: 0,
      totalRaceDistance: 0
    })
  }
}))
