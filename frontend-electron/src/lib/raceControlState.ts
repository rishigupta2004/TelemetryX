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
        text.includes('VSC PERIOD') ||
        (text.includes('VIRTUAL') && (text.includes('DEPLOY') || text.includes('PERIOD')))
      const deploySc =
        text.includes('SAFETY CAR DEPLOY') ||
        text.includes('SC DEPLOY') ||
        text.includes('SC OUT') ||
        text.includes('SAFETY CAR OUT') ||
        text.includes('SAFETY CAR PERIOD') ||
        (text.includes('SAFETY CAR') && (text.includes('DEPLOY') || text.includes('OUT') || text.includes('PERIOD'))) ||
        (text.includes('SC') && (text.includes('DEPLOY') || text.includes('PERIOD')) && !text.includes('VSC') && !text.includes('VIRTUAL'))
      const clearSc =
        text.includes('ENDING') ||
        text.includes('ENDED') ||
        text.includes('IN THIS LAP') ||
        text.includes('WITHDRAWN') ||
        text.includes('RESTART') ||
        text.includes('RESUMED') ||
        (text.includes('GREEN') && text.includes('TRACK'))

      // VSC takes priority over SC if both match (shouldn't happen, but be safe)
      if (deployVsc && !deploySc) {
        isVSC = true
        isSafetyCar = false
      } else if (deploySc && !deployVsc) {
        isSafetyCar = true
        isVSC = false
      } else if (deploySc && deployVsc) {
        // Ambiguous — prefer VSC if text explicitly has 'VIRTUAL'
        if (text.includes('VIRTUAL')) { isVSC = true; isSafetyCar = false }
        else { isSafetyCar = true; isVSC = false }
      }

      if (clearSc) {
        isSafetyCar = false
        isVSC = false
      }
    }
  }

  // Pre-race stale-data suppression:
  // - Clear yellow sector flags that pre-date race start
  // - BUT preserve SC/VSC state even if seen before the first timed lap —
  //   SC can deploy on Lap 1 before race timing begins
  if (raceStartTime != null && sessionTime >= raceStartTime) {
    if (!inRaceTrackEvents && (trackFlag === 'YELLOW' || trackFlag === 'DOUBLE YELLOW')) {
      trackFlag = 'GREEN'
    }
    if (!inRaceTrackEvents) {
      for (const k of Object.keys(sectorFlags)) delete sectorFlags[Number(k)]
    }
    // Only suppress SC if we've seen race-period SC events and none of them deployed
    if (inRaceScEvents && !isSafetyCar && !isVSC) {
      // SC was cleared in-race — correct
    }
    // Do NOT blanket-clear isSafetyCar/isVSC when inRaceScEvents=false,
    // because an early Lap-1 SC event may have set these before inRaceScEvents turned true
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
