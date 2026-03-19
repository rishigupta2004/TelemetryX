import { useCallback, useEffect, useRef } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useWebSocket } from './useWebSocket'

const TIME_KEYS = ['currentTime', 'timestamp', 'time', 't'] as const
const TIME_CACHE_MAX = 50
const timeValueCache = new Map<unknown, number>()

const extractTime = (payload: unknown): number | null => {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  for (let i = 0; i < TIME_KEYS.length; i++) {
    const key = TIME_KEYS[i]
    const value = obj[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function usePlaybackTick() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)

  const setCurrentTime = usePlaybackStore(s => s.setCurrentTime)
  const setExternalClock = usePlaybackStore(s => s.setExternalClock)

  const lastTimeRef = useRef<number | null>(null)
  const pendingIdleRef = useRef<number | null>(null)
  const queueRef = useRef<number[]>([])
  
  const processTimeQueue = useCallback(() => {
    pendingIdleRef.current = null
    const queue = queueRef.current
    if (queue.length === 0) return
    
    queueRef.current = []
    
    let latestTime: number | null = null
    for (let i = 0; i < queue.length; i++) {
      if (latestTime === null || queue[i] > latestTime) {
        latestTime = queue[i]
      }
    }
    
    if (latestTime !== null && latestTime !== lastTimeRef.current) {
      lastTimeRef.current = latestTime
      setCurrentTime(latestTime)
    }
  }, [setCurrentTime])

  const scheduleIdleUpdate = useCallback((time: number) => {
    queueRef.current.push(time)
    
    if (pendingIdleRef.current !== null) return
    
    if (typeof requestIdleCallback !== 'undefined') {
      pendingIdleRef.current = requestIdleCallback(() => {
        processTimeQueue()
      }, { timeout: 50 })
    } else {
      pendingIdleRef.current = window.setTimeout(() => {
        processTimeQueue()
      }, 16)
    }
  }, [processTimeQueue])

  const handleMessage = useCallback((payload: unknown) => {
    const t = extractTime(payload)
    if (t != null) {
      scheduleIdleUpdate(t)
    }
  }, [scheduleIdleUpdate])

  const { status } = useWebSocket({
    year: selectedYear,
    race: selectedRace,
    session: selectedSession,
    onMessage: handleMessage
  })

  useEffect(() => { 
    const cleanup = () => {
      if (pendingIdleRef.current !== null) {
        if (typeof requestIdleCallback !== 'undefined') {
          // Can't cancel requestIdleCallback, but that's OK
        } else {
          clearTimeout(pendingIdleRef.current)
        }
        pendingIdleRef.current = null
      }
    }
    return cleanup
  }, [])

  useEffect(() => {
    setExternalClock(status === 'connected')
  }, [status, setExternalClock])

  return status
}
