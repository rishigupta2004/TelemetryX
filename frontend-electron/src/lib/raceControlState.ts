import type { RaceControlMessage } from '../types'

export interface RaceControlState {
  trackFlag: string | null
  sectorFlags: Record<number, string>
  isSafetyCar: boolean
  isVSC: boolean
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
    const category = (msg.category || '').toUpperCase()
    const scope = (msg.scope || '').toUpperCase()
    const flag = (msg.flag || '').toUpperCase()
    const text = (msg.message || '').toUpperCase()

    if (raceStartTime != null && msg.timestamp >= raceStartTime) {
      if (category === 'FLAG' && scope === 'TRACK') inRaceTrackEvents = true
      if (category === 'SAFETYCAR') inRaceScEvents = true
    }

    if (category === 'FLAG' && scope === 'TRACK') {
      if (flag === 'GREEN' || flag === 'CLEAR') trackFlag = 'GREEN'
      else if (flag) trackFlag = flag
    }

    if (category === 'FLAG' && scope === 'SECTOR' && msg.sector) {
      if (flag === 'GREEN' || flag === 'CLEAR') delete sectorFlags[msg.sector]
      else if (flag) sectorFlags[msg.sector] = flag
    }

    if (category === 'SAFETYCAR') {
      if (text.includes('VIRTUAL') && text.includes('DEPLOY')) {
        isVSC = true
        isSafetyCar = false
      } else if (text.includes('SAFETY CAR') && text.includes('DEPLOY')) {
        isSafetyCar = true
        isVSC = false
      }

      if (
        text.includes('ENDING') ||
        text.includes('IN THIS LAP') ||
        text.includes('WITHDRAWN') ||
        text.includes('RESTART') ||
        text.includes('RESUMED')
      ) {
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
