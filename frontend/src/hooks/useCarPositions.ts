import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { Driver, LapRow, PositionRow } from '../types'

export interface CarPosition {
  driverCode: string
  driverNumber: number
  teamColor: string
  progress: number
  currentLap: number
  position: number
  x: number | null
  y: number | null
  hasLivePosition: boolean
  isInPit: boolean
  pitProgress: number | null
  progressSource: 'timing' | 'fused'
  mappingConfidence: number
  sourceTimestamp: number | null
}

type WorkerMessageIn =
  | {
    type: 'init'
    payload: {
      drivers: Driver[]
      laps: LapRow[]
      positions: PositionRow[]
    }
  }
  | {
    type: 'tick'
    sessionTime: number
    seq: number
  }

type WorkerMessageOut =
  | { type: 'ready' }
  | { type: 'positions'; seq: number; positions: CarPosition[] }
  | { type: 'error'; message: string }

function createCarPositionsWorker(): Worker {
  return new Worker(new URL('../workers/carPositions.worker.ts', import.meta.url), { type: 'module' })
}

function closeEnough(a: number | null, b: number | null, epsilon = 1e-4): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) <= epsilon
}

function isSameCarPosition(a: CarPosition, b: CarPosition): boolean {
  return (
    a.driverNumber === b.driverNumber &&
    a.driverCode === b.driverCode &&
    a.teamColor === b.teamColor &&
    a.currentLap === b.currentLap &&
    a.position === b.position &&
    a.hasLivePosition === b.hasLivePosition &&
    a.isInPit === b.isInPit &&
    closeEnough(a.progress, b.progress, 5e-4) &&
    closeEnough(a.x, b.x, 5e-3) &&
    closeEnough(a.y, b.y, 5e-3) &&
    closeEnough(a.pitProgress, b.pitProgress, 5e-4) &&
    a.progressSource === b.progressSource &&
    closeEnough(a.mappingConfidence, b.mappingConfidence, 1e-3) &&
    closeEnough(a.sourceTimestamp, b.sourceTimestamp, 5e-3)
  )
}

function mergeStablePositions(previous: CarPosition[], next: CarPosition[]): CarPosition[] {
  if (previous.length === 0) return next
  if (previous.length !== next.length) return next

  const previousByDriver = new Map<number, CarPosition>()
  for (const car of previous) previousByDriver.set(car.driverNumber, car)

  let changed = false
  const merged = next.map((candidate) => {
    const prior = previousByDriver.get(candidate.driverNumber)
    if (!prior) {
      changed = true
      return candidate
    }
    if (isSameCarPosition(prior, candidate)) return prior
    changed = true
    return candidate
  })

  return changed ? merged : previous
}

export function mergeStablePositionsForTest(previous: CarPosition[], next: CarPosition[]): CarPosition[] {
  return mergeStablePositions(previous, next)
}

type Subscriber = () => void

const subscribers = new Set<Subscriber>()
let sharedPositions: CarPosition[] = []
let cachedSnapshotRef: CarPosition[] | null = null
let worker: Worker | null = null
let workerReady = false
let seq = 0
let latestAcceptedSeq = 0
let lastTickTime: number | null = null
let latestSampledSessionTime = 0
let lastDrivers: Driver[] | null = null
let lastLaps: LapRow[] | null = null
let lastPositions: PositionRow[] | null = null
let activeSessionKey: string | null = null
let activeSubscribers = 0

let tickThrottleRef: number | null = null
const TICK_THROTTLE_MS = 16

function emit() {
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function updateSharedPositions(next: CarPosition[]) {
  const merged = mergeStablePositions(sharedPositions, next)
  if (merged === sharedPositions) return
  sharedPositions = merged
  cachedSnapshotRef = merged
  emit()
}

function clearSharedPositions() {
  if (!sharedPositions.length) return
  sharedPositions = []
  cachedSnapshotRef = null
  emit()
}

function subscribe(listener: Subscriber) {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

function getSnapshot(): CarPosition[] {
  if (cachedSnapshotRef === null) {
    cachedSnapshotRef = sharedPositions
  }
  return cachedSnapshotRef
}

function resetWorkerState() {
  workerReady = false
  latestAcceptedSeq = seq
  lastTickTime = null
}

function flushTick() {
  if (!worker || !workerReady) return
  tickThrottleRef = null
  
  if (lastTickTime === latestSampledSessionTime) return
  lastTickTime = latestSampledSessionTime
  
  const tickMessage: WorkerMessageIn = {
    type: 'tick',
    sessionTime: latestSampledSessionTime,
    seq: ++seq
  }
  worker.postMessage(tickMessage)
}

function postTick(sessionTime: number, force = false) {
  latestSampledSessionTime = sessionTime
  
  if (!worker || !workerReady) return
  if (!force && lastTickTime === sessionTime) return
  
  if (tickThrottleRef !== null) return
  
  tickThrottleRef = window.setTimeout(() => {
    flushTick()
  }, TICK_THROTTLE_MS)
}

function ensureWorker() {
  if (worker) return
  worker = createCarPositionsWorker()
  worker.onmessage = (event: MessageEvent<WorkerMessageOut>) => {
    const message = event.data
    if (message.type === 'ready') {
      workerReady = true
      postTick(latestSampledSessionTime, true)
      return
    }
    if (message.type === 'positions') {
      if (message.seq < latestAcceptedSeq) return
      latestAcceptedSeq = message.seq
      updateSharedPositions(message.positions)
      return
    }
    if (message.type === 'error') {
      // Keep rendering with the last known positions.
    }
  }
}

function teardownWorker() {
  if (tickThrottleRef !== null) {
    clearTimeout(tickThrottleRef)
    tickThrottleRef = null
  }
  if (!worker) return
  worker.onmessage = null
  worker.onerror = null
  worker.terminate()
  worker = null
  resetWorkerState()
}

function postInit(drivers: Driver[], laps: LapRow[], positions: PositionRow[] | null) {
  if (!worker) return
  resetWorkerState()
  const initMessage: WorkerMessageIn = {
    type: 'init',
    payload: {
      drivers,
      laps,
      positions: positions ?? []
    }
  }
  worker.postMessage(initMessage)
}

function maybeInit(drivers: Driver[] | null, laps: LapRow[] | null, positions: PositionRow[] | null) {
  ensureWorker()
  if (!drivers?.length || !laps?.length) {
    lastDrivers = drivers
    lastLaps = laps
    lastPositions = positions
    resetWorkerState()
    clearSharedPositions()
    return
  }
  if (drivers === lastDrivers && laps === lastLaps && positions === lastPositions) return
  lastDrivers = drivers
  lastLaps = laps
  lastPositions = positions
  postInit(drivers, laps, positions)
}

function maybeTick(sessionTime: number) {
  latestSampledSessionTime = sessionTime
  if (worker && workerReady) {
    if (tickThrottleRef === null) {
      tickThrottleRef = window.setTimeout(() => {
        flushTick()
      }, TICK_THROTTLE_MS)
    }
  }
}

function updateSessionKey(sessionKey: string | null) {
  if (sessionKey === activeSessionKey) return
  activeSessionKey = sessionKey
  lastDrivers = null
  lastLaps = null
  lastPositions = null
  resetWorkerState()
  clearSharedPositions()
}

export function useCarPositions(): CarPosition[] {
  const drivers = useSessionStore((s) => s.sessionData?.drivers ?? null)
  const lapsFromStore = useSessionStore((s) => s.laps)
  const sessionLaps = useSessionStore((s) => s.sessionData?.laps ?? null)
  const laps = lapsFromStore.length ? lapsFromStore : sessionLaps
  const positions = useSessionStore((s) => s.sessionData?.positions ?? null)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const sessionKey = selectedYear && selectedRace && selectedSession
    ? `${selectedYear}|${selectedRace}|${selectedSession}`
    : null
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)

  const sampledSessionTime = useMemo(() => {
    const sessionTime = sessionStartTime + currentTime
    const HZ = 60
    return Math.round(sessionTime * HZ) / HZ
  }, [currentTime, sessionStartTime])

  const carPositions = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    activeSubscribers += 1
    ensureWorker()
    return () => {
      activeSubscribers = Math.max(0, activeSubscribers - 1)
      if (activeSubscribers === 0) teardownWorker()
    }
  }, [])

  useEffect(() => {
    updateSessionKey(sessionKey)
  }, [sessionKey])

  useEffect(() => {
    maybeInit(drivers, laps, positions)
  }, [drivers, laps, positions])

  useEffect(() => {
    maybeTick(sampledSessionTime)
  }, [sampledSessionTime])

  return carPositions
}
