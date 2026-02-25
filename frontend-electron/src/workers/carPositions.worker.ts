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

type DriverLite = {
  code: string
  driverNumber: number
  teamColor?: string | null
}

type LapLite = {
  driverName: string
  driverNumber: number
  lapNumber: number
  lapTime?: number | null
  lapStartSeconds: number
  lapEndSeconds: number
  position?: number | null
  pitInSeconds?: number | null
  pitOutSeconds?: number | null
  pitInLaneTimeSeconds?: number | null
  pitOutLaneTimeSeconds?: number | null
  sector1?: number | null
  sector2?: number | null
  sector3?: number | null
}

type PositionLite = {
  driverNumber: number
  timestamp: number
  x: number
  y: number
}

type PitWindow = { start: number; end: number }

type DriverIndex = {
  driver: DriverLite
  laps: LapLite[]
  lapStarts: number[]
  positions: PositionLite[]
  posTimes: number[]
  firstStart: number
  lastEnd: number
  driverMaxLap: number
  raceMaxLap: number
  pitWindows: PitWindow[]
  pitStarts: number[]
}

type InitMessage = {
  type: 'init'
  payload: {
    drivers: DriverLite[]
    laps: LapLite[]
    positions: PositionLite[]
  }
}

type TickMessage = {
  type: 'tick'
  sessionTime: number
  seq: number
}

type InMessage = InitMessage | TickMessage

type PositionsMessage = {
  type: 'positions'
  seq: number
  positions: CarPosition[]
}

type ReadyMessage = { type: 'ready' }

type ErrorMessage = { type: 'error'; message: string }

type OutMessage = PositionsMessage | ReadyMessage | ErrorMessage

let indexed: DriverIndex[] = []
let prevTime: number | null = null
const lapHint = new Map<number, number>()
const posHint = new Map<number, number>()
const pitHint = new Map<number, number>()
const filteredUnwrappedProgress = new Map<number, number>()

const MAX_FORWARD_STEP_LAPS = 0.8
const MAX_STALE_POSITION_SECONDS = 3.0

function ub(arr: number[], v: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= v) lo = mid + 1
    else hi = mid
  }
  return lo
}

function asFinite(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function normalizeProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  const wrapped = progress % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}

function smoothUnwrappedProgress(driverNumber: number, rawUnwrapped: number, rewound: boolean): number {
  if (!Number.isFinite(rawUnwrapped)) {
    const prev = filteredUnwrappedProgress.get(driverNumber)
    return prev ?? 0
  }

  if (rewound) {
    filteredUnwrappedProgress.set(driverNumber, rawUnwrapped)
    return rawUnwrapped
  }

  const prev = filteredUnwrappedProgress.get(driverNumber)
  if (prev == null) {
    filteredUnwrappedProgress.set(driverNumber, rawUnwrapped)
    return rawUnwrapped
  }

  let next = rawUnwrapped
  if (next < prev) {
    next = prev
  } else {
    const delta = next - prev
    if (delta > MAX_FORWARD_STEP_LAPS) {
      next = prev + MAX_FORWARD_STEP_LAPS
    }
  }

  filteredUnwrappedProgress.set(driverNumber, next)
  return next
}

function pickPitInSeconds(lap: LapLite): number | null {
  return (
    asFinite(lap.pitInLaneTimeSeconds) ??
    asFinite((lap as unknown as { pit_in_lane_time?: number | null }).pit_in_lane_time) ??
    asFinite(lap.pitInSeconds)
  )
}

function pickPitOutSeconds(lap: LapLite): number | null {
  return (
    asFinite(lap.pitOutLaneTimeSeconds) ??
    asFinite((lap as unknown as { pit_out_lane?: number | null }).pit_out_lane) ??
    asFinite(lap.pitOutSeconds)
  )
}

function buildPitWindows(laps: LapLite[]): PitWindow[] {
  if (!laps.length) return []
  const out: PitWindow[] = []

  for (let i = 0; i < laps.length; i += 1) {
    const lap = laps[i]
    const pitIn = pickPitInSeconds(lap)
    if (pitIn == null) continue

    let pitOut = pickPitOutSeconds(lap)
    if (pitOut == null || pitOut < pitIn) {
      for (let j = i + 1; j < laps.length; j += 1) {
        const candidate = pickPitOutSeconds(laps[j])
        if (candidate != null && candidate >= pitIn) {
          pitOut = candidate
          break
        }
      }
    }
    if (pitOut == null || pitOut < pitIn) pitOut = pitIn + 22

    const start = pitIn
    const end = Math.max(start + 1, pitOut)
    const prev = out[out.length - 1]
    if (prev && start <= prev.end) prev.end = Math.max(prev.end, end)
    else out.push({ start, end })
  }

  return out
}

function pitProgressWithStop(window: PitWindow, sessionTime: number): number {
  const duration = Math.max(1, window.end - window.start)
  const t = clamp01((sessionTime - window.start) / duration)
  const easeInOut = (v: number) => {
    const clamped = clamp01(v)
    return clamped < 0.5 ? 2 * clamped * clamped : 1 - ((-2 * clamped + 2) ** 2) / 2
  }

  const stopLocation = 0.42
  const nominalTransitSeconds = 18
  const minTransitShare = 0.28
  const dynamicTransitShare = Math.max(minTransitShare, Math.min(0.48, nominalTransitSeconds / duration))
  const entryRatio = dynamicTransitShare * 0.52
  const exitRatio = dynamicTransitShare * 0.48
  const stopRatio = Math.max(0.04, 1 - entryRatio - exitRatio)

  if (t <= entryRatio) return easeInOut(t / Math.max(1e-6, entryRatio)) * stopLocation
  if (t <= entryRatio + stopRatio) return stopLocation
  const exitT = (t - entryRatio - stopRatio) / Math.max(1e-6, exitRatio)
  return stopLocation + easeInOut(exitT) * (1 - stopLocation)
}

function lapFractionFromSectors(lap: LapLite, sessionTime: number): { fraction: number; hasSectorModel: boolean } {
  const start = asFinite(lap.lapStartSeconds)
  const end = asFinite(lap.lapEndSeconds)
  if (start == null || end == null || end <= start) {
    return { fraction: 0, hasSectorModel: false }
  }

  const lapDuration = end - start
  const linear = clamp01((sessionTime - start) / lapDuration)

  const s1 = asFinite(lap.sector1)
  const s2 = asFinite(lap.sector2)
  const s3 = asFinite(lap.sector3)
  const sectorSum = (s1 ?? 0) + (s2 ?? 0) + (s3 ?? 0)
  if (
    s1 == null || s2 == null || s3 == null ||
    s1 <= 0 || s2 <= 0 || s3 <= 0 ||
    sectorSum <= 0 ||
    Math.abs(sectorSum - lapDuration) > Math.max(1.6, lapDuration * 0.08)
  ) {
    return { fraction: linear, hasSectorModel: false }
  }

  const elapsed = Math.max(0, Math.min(lapDuration, sessionTime - start))
  if (elapsed <= s1) {
    return { fraction: (elapsed / s1) / 3, hasSectorModel: true }
  }
  if (elapsed <= s1 + s2) {
    return { fraction: 1 / 3 + ((elapsed - s1) / s2) / 3, hasSectorModel: true }
  }
  return { fraction: 2 / 3 + ((elapsed - s1 - s2) / s3) / 3, hasSectorModel: true }
}

function buildIndex(drivers: DriverLite[], allLaps: LapLite[], allPositions: PositionLite[]): DriverIndex[] {
  const posByNum = new Map<number, PositionLite[]>()
  const lapsByNum = new Map<number, LapLite[]>()
  const lapsByCode = new Map<string, LapLite[]>()

  for (const row of allPositions) {
    if (!Number.isFinite(row.driverNumber) || !Number.isFinite(row.timestamp) || !Number.isFinite(row.x) || !Number.isFinite(row.y)) continue
    const bucket = posByNum.get(row.driverNumber) ?? []
    bucket.push(row)
    posByNum.set(row.driverNumber, bucket)
  }
  for (const rows of posByNum.values()) rows.sort((a, b) => a.timestamp - b.timestamp)

  for (const lap of allLaps) {
    const byNum = lapsByNum.get(lap.driverNumber) ?? []
    byNum.push(lap)
    lapsByNum.set(lap.driverNumber, byNum)

    const byCode = lapsByCode.get(lap.driverName) ?? []
    byCode.push(lap)
    lapsByCode.set(lap.driverName, byCode)
  }
  for (const laps of [...lapsByNum.values(), ...lapsByCode.values()]) {
    laps.sort((a, b) => a.lapStartSeconds - b.lapStartSeconds || a.lapNumber - b.lapNumber)
  }

  const raceMaxLap = Math.max(0, ...allLaps.map((l) => l.lapNumber || 0))
  return drivers.map((driver) => {
    const laps = lapsByNum.get(driver.driverNumber) ?? lapsByCode.get(driver.code) ?? []
    const positions = posByNum.get(driver.driverNumber) ?? []
    const pitWindows = buildPitWindows(laps)
    return {
      driver,
      laps,
      lapStarts: laps.map((l) => l.lapStartSeconds),
      positions,
      posTimes: positions.map((p) => p.timestamp),
      firstStart: laps[0]?.lapStartSeconds ?? 0,
      lastEnd: laps[laps.length - 1]?.lapEndSeconds ?? 0,
      driverMaxLap: laps[laps.length - 1]?.lapNumber ?? 0,
      raceMaxLap,
      pitWindows,
      pitStarts: pitWindows.map((w) => w.start)
    }
  })
}

function computePositions(sessionTime: number): CarPosition[] {
  if (!indexed.length) return []

  const rewound = prevTime != null && sessionTime < prevTime
  if (rewound) {
    lapHint.clear()
    posHint.clear()
    pitHint.clear()
    filteredUnwrappedProgress.clear()
  }
  prevTime = sessionTime

  const out: CarPosition[] = []
  const activeDriverNumbers = new Set<number>()

  for (const item of indexed) {
    const {
      driver,
      laps,
      lapStarts,
      positions,
      posTimes,
      firstStart,
      lastEnd,
      pitWindows,
      pitStarts
    } = item

    if (!laps.length) continue

    let timeForLaps = sessionTime
    if (Number.isFinite(firstStart)) {
      if (timeForLaps < firstStart) timeForLaps = firstStart
    }
    if (Number.isFinite(lastEnd) && lastEnd > 0) {
      if (timeForLaps > lastEnd) timeForLaps = lastEnd
    }

    let li = lapHint.get(driver.driverNumber) ?? 0
    li = rewound ? Math.max(0, ub(lapStarts, timeForLaps) - 1) : Math.max(0, Math.min(li, laps.length - 1))
    while (!rewound && li + 1 < laps.length && lapStarts[li + 1] <= timeForLaps) li += 1
    while (li > 0 && lapStarts[li] > timeForLaps) li -= 1
    lapHint.set(driver.driverNumber, li)

    const lap = laps[li]
    const lapNumber = Math.max(1, Number(lap.lapNumber) || 1)
    const lapModel = lapFractionFromSectors(lap, timeForLaps)
    const rawUnwrappedProgress = (lapNumber - 1) + lapModel.fraction
    const smoothedUnwrapped = smoothUnwrappedProgress(driver.driverNumber, rawUnwrappedProgress, rewound)
    const progress = normalizeProgress(smoothedUnwrapped)

    let x: number | null = null
    let y: number | null = null
    let sourceTimestamp: number | null = null
    let hasFreshPosition = false
    if (positions.length) {
      let pi = posHint.get(driver.driverNumber) ?? 0
      pi = rewound ? ub(posTimes, sessionTime) : Math.max(0, Math.min(pi, positions.length))
      while (!rewound && pi < positions.length && posTimes[pi] <= sessionTime) pi += 1
      while (pi > 0 && posTimes[pi - 1] > sessionTime) pi -= 1
      posHint.set(driver.driverNumber, pi)

      if (pi <= 0) {
        x = positions[0].x
        y = positions[0].y
        sourceTimestamp = positions[0].timestamp
      } else if (pi >= positions.length) {
        const tail = positions[positions.length - 1]
        x = tail.x
        y = tail.y
        sourceTimestamp = tail.timestamp
      } else {
        const a = positions[pi - 1]
        const b = positions[pi]
        const dt = b.timestamp - a.timestamp
        const t = !Number.isFinite(dt) || dt <= 1e-6 ? 0 : clamp01((sessionTime - a.timestamp) / dt)
        x = a.x + (b.x - a.x) * t
        y = a.y + (b.y - a.y) * t
        sourceTimestamp = t < 0.5 ? a.timestamp : b.timestamp
      }
      if (sourceTimestamp != null) {
        hasFreshPosition = Math.abs(sessionTime - sourceTimestamp) <= MAX_STALE_POSITION_SECONDS
      }
    }

    let isInPit = false
    let pitProgress: number | null = null
    if (pitWindows.length) {
      let wi = pitHint.get(driver.driverNumber) ?? 0
      wi = rewound ? Math.max(0, ub(pitStarts, sessionTime) - 1) : Math.max(0, Math.min(wi, pitWindows.length - 1))
      while (!rewound && wi + 1 < pitWindows.length && pitWindows[wi].end < sessionTime) wi += 1
      while (wi > 0 && pitWindows[wi].start > sessionTime) wi -= 1

      let activeWindow: PitWindow | null = null
      const candidate = pitWindows[wi]
      if (candidate && sessionTime >= candidate.start && sessionTime <= candidate.end) {
        activeWindow = candidate
      } else if (wi + 1 < pitWindows.length) {
        const next = pitWindows[wi + 1]
        if (sessionTime >= next.start && sessionTime <= next.end) {
          wi += 1
          activeWindow = next
        }
      }

      pitHint.set(driver.driverNumber, wi)
      if (activeWindow) {
        isInPit = true
        pitProgress = pitProgressWithStop(activeWindow, sessionTime)
      }
    } else {
      pitHint.delete(driver.driverNumber)
    }

    const hasLivePosition = x != null && y != null
    let mappingConfidence = lapModel.hasSectorModel ? 0.72 : 0.58
    if (hasFreshPosition) mappingConfidence += 0.2
    else if (hasLivePosition) mappingConfidence += 0.08
    if (isInPit) mappingConfidence += 0.05
    mappingConfidence = clamp01(mappingConfidence)

    activeDriverNumbers.add(driver.driverNumber)
    out.push({
      driverCode: driver.code,
      driverNumber: driver.driverNumber,
      teamColor: driver.teamColor || '#fff',
      progress,
      currentLap: lap.lapNumber,
      position: lap.position || 99,
      x,
      y,
      hasLivePosition,
      isInPit,
      pitProgress,
      progressSource: hasLivePosition ? 'fused' : 'timing',
      mappingConfidence,
      sourceTimestamp
    })
  }

  for (const driverNumber of filteredUnwrappedProgress.keys()) {
    if (!activeDriverNumbers.has(driverNumber)) filteredUnwrappedProgress.delete(driverNumber)
  }

  return out
}

self.onmessage = (event: MessageEvent<InMessage>) => {
  try {
    const message = event.data
    if (message.type === 'init') {
      indexed = buildIndex(message.payload.drivers ?? [], message.payload.laps ?? [], message.payload.positions ?? [])
      prevTime = null
      lapHint.clear()
      posHint.clear()
      pitHint.clear()
      filteredUnwrappedProgress.clear()
      const out: ReadyMessage = { type: 'ready' }
      self.postMessage(out as OutMessage)
      return
    }

    if (message.type === 'tick') {
      const positions = computePositions(message.sessionTime)
      const out: PositionsMessage = {
        type: 'positions',
        seq: message.seq,
        positions
      }
      self.postMessage(out as OutMessage)
    }
  } catch (err) {
    const out: ErrorMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err)
    }
    self.postMessage(out as OutMessage)
  }
}
