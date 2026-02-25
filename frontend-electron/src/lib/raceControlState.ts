import type { RaceControlMessage } from '../types'

export interface RaceControlState {
  trackFlag: string | null
  sectorFlags: Record<number, string>
  isSafetyCar: boolean
  isVSC: boolean
}

const norm = (value: string | null | undefined): string => String(value || '').trim().toUpperCase()

function isSafetyCarCategory(category: string): boolean {
  return category === 'SAFETYCAR' || category === 'SAFETY CAR'
}

function isTrackFlagCategory(category: string): boolean {
  return category === 'FLAG' || category === 'TRACK'
}

function isGreenishFlag(flag: string): boolean {
  return flag === 'GREEN' || flag === 'CLEAR' || flag === 'ALL CLEAR'
}

function trackFlagFromText(text: string): string | null {
  if (text.includes('DOUBLE YELLOW')) return 'DOUBLE YELLOW'
  if (text.includes('YELLOW')) return 'YELLOW'
  if (text.includes('RED')) return 'RED'
  if (text.includes('CHEQUERED')) return 'CHEQUERED'
  if (text.includes('GREEN') || text.includes('ALL CLEAR') || text.includes('CLEAR')) return 'GREEN'
  return null
}

export function upperBoundRaceControlByTimestamp(
  raceControl: RaceControlMessage[],
  sessionTime: number
): number {
  let lo = 0
  let hi = raceControl.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (raceControl[mid].timestamp <= sessionTime) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Builds effective race-control state at a given absolute session time.
 * Includes a global stale pre-race suppression rule so incidents before
 * race-start don't leak into playback t=0 when lap timing starts later.
 */
export function getRaceControlStateFromSlice(
  raceControl: RaceControlMessage[],
  endExclusive: number,
  sessionTime: number,
  raceStartTime: number | null
): RaceControlState {
  let trackFlag: string | null = null
  const sectorFlags: Record<number, string> = {}
  let isSafetyCar = false
  let isVSC = false
  let inRaceTrackEvents = false
  let inRaceScEvents = false

  for (let i = 0; i < endExclusive; i += 1) {
    const msg = raceControl[i]
    const category = norm(msg.category)
    const scope = norm(msg.scope)
    const flag = norm(msg.flag)
    const text = norm(msg.message)

    if (raceStartTime != null && msg.timestamp >= raceStartTime) {
      if (isTrackFlagCategory(category) && scope === 'TRACK') inRaceTrackEvents = true
      if (isSafetyCarCategory(category)) inRaceScEvents = true
    }

    if (isTrackFlagCategory(category) && scope === 'TRACK') {
      if (isGreenishFlag(flag)) trackFlag = 'GREEN'
      else if (flag) trackFlag = flag
      else {
        const inferred = trackFlagFromText(text)
        if (inferred) trackFlag = inferred
      }
    }

    if (isTrackFlagCategory(category) && scope === 'SECTOR' && msg.sector) {
      if (isGreenishFlag(flag)) delete sectorFlags[msg.sector]
      else if (flag) sectorFlags[msg.sector] = flag
    }

    if (isSafetyCarCategory(category)) {
      const deployVsc =
        text.includes('VIRTUAL SAFETY CAR') ||
        text.includes('VSC DEPLOY') ||
        (text.includes('VIRTUAL') && text.includes('DEPLOY'))
      const deploySc =
        text.includes('SAFETY CAR DEPLOY') ||
        text.includes('SC DEPLOY') ||
        (text.includes('SAFETY CAR') && text.includes('DEPLOY'))
      const clearSc =
        text.includes('ENDING') ||
        text.includes('ENDED') ||
        text.includes('IN THIS LAP') ||
        text.includes('WITHDRAWN') ||
        text.includes('RESTART') ||
        text.includes('RESUMED')

      if (deployVsc) {
        isVSC = true
        isSafetyCar = false
      } else if (deploySc) {
        isSafetyCar = true
        isVSC = false
      }

      if (clearSc) {
        isSafetyCar = false
        isVSC = false
      }
    }
  }

  if (raceStartTime != null && sessionTime >= raceStartTime) {
    if (!inRaceTrackEvents && (trackFlag === 'RED' || trackFlag === 'YELLOW' || trackFlag === 'DOUBLE YELLOW')) {
      trackFlag = 'GREEN'
    }
    if (!inRaceTrackEvents) {
      for (const k of Object.keys(sectorFlags)) delete sectorFlags[Number(k)]
    }
    if (!inRaceScEvents) {
      isSafetyCar = false
      isVSC = false
    }
  }

  return { trackFlag, sectorFlags, isSafetyCar, isVSC }
}

export function getRaceControlState(
  raceControl: RaceControlMessage[],
  sessionTime: number,
  raceStartTime: number | null
): RaceControlState {
  const endExclusive = upperBoundRaceControlByTimestamp(raceControl, sessionTime)
  return getRaceControlStateFromSlice(raceControl, endExclusive, sessionTime, raceStartTime)
}
