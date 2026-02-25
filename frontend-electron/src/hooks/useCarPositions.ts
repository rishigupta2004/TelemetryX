import { useEffect, useMemo, useSyncExternalStore } from 'react'
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

type Subscriber = () => void

const subscribers = new Set<Subscriber>()
let sharedPositions: CarPosition[] = []
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

function emit() {
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function updateSharedPositions(next: CarPosition[]) {
  const merged = mergeStablePositions(sharedPositions, next)
  if (merged === sharedPositions) return
  sharedPositions = merged
  emit()
}

function clearSharedPositions() {
  if (!sharedPositions.length) return
  sharedPositions = []
  emit()
}

function subscribe(listener: Subscriber) {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

function getSnapshot(): CarPosition[] {
  return sharedPositions
}

function resetWorkerState() {
  workerReady = false
  latestAcceptedSeq = seq
  lastTickTime = null
}

function postTick(sessionTime: number, force = false) {
  if (!worker || !workerReady) return
  if (!force && lastTickTime === sessionTime) return
  lastTickTime = sessionTime
  const tickMessage: WorkerMessageIn = {
    type: 'tick',
    sessionTime,
    seq: ++seq
  }
  worker.postMessage(tickMessage)
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
  if (!worker) return
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
  postTick(sessionTime)
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
  const sessionKey = useSessionStore((s) =>
    s.selectedYear && s.selectedRace && s.selectedSession
      ? `${s.selectedYear}|${s.selectedRace}|${s.selectedSession}`
      : null
  )
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const speed = usePlaybackStore((s) => s.speed)

  const sampledSessionTime = useMemo(() => {
    const sessionTime = sessionStartTime + currentTime
    const samplingHz = speed >= 12 ? 60 : speed >= 8 ? 48 : speed >= 4 ? 36 : 30
    return Math.round(sessionTime * samplingHz) / samplingHz
  }, [currentTime, sessionStartTime, speed])

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
