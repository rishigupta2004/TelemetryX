import type { RaceControlMessage } from '../types'
import { ubTs } from './telemetryUtils'

export interface RaceControlState {
  trackFlag: string | null
  sectorFlags: Record<number, string>
  isSafetyCar: boolean
  isVSC: boolean
}

const norm = (value: string | null | undefined): string => String(value || '').trim().toUpperCase()
const isSafetyCarCategory = (c: string): boolean => c === 'SAFETYCAR' || c === 'SAFETY CAR'
const isTrackFlagCategory = (c: string): boolean => c === 'FLAG' || c === 'TRACK'
const isGreenishFlag = (f: string): boolean => f === 'GREEN' || f === 'CLEAR' || f === 'ALL CLEAR'

const trackFlagFromText = (text: string): string | null => {
  if (text.includes('DOUBLE YELLOW')) return 'DOUBLE YELLOW'
  if (text.includes('YELLOW')) return 'YELLOW'
  if (text.includes('RED')) return 'RED'
  if (text.includes('CHEQUERED')) return 'CHEQUERED'
  if (text.includes('GREEN') || text.includes('ALL CLEAR') || text.includes('CLEAR')) return 'GREEN'
  return null
}

export const upperBoundRaceControlByTimestamp = (raceControl: RaceControlMessage[], sessionTime: number): number => 
  ubTs(raceControl, sessionTime)

export function getRaceControlState(
  raceControl: RaceControlMessage[],
  sessionTime: number,
  raceStartTime: number | null
): RaceControlState {
  const endExclusive = upperBoundRaceControlByTimestamp(raceControl, sessionTime)
  
  let trackFlag: string | null = null
  const sectorFlags: Record<number, string> = {}
  let isSafetyCar = false
  let isVSC = false
  let inRaceTrackEvents = false
  let inRaceScEvents = false

  for (let i = 0; i < endExclusive; i++) {
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
      const deployVsc = text.includes('VIRTUAL SAFETY CAR') || text.includes('VSC DEPLOY') || text.includes('VSC PERIOD') || (text.includes('VIRTUAL') && (text.includes('DEPLOY') || text.includes('PERIOD')))
      const deploySc = text.includes('SAFETY CAR DEPLOY') || text.includes('SC DEPLOY') || text.includes('SC OUT') || text.includes('SAFETY CAR OUT') || text.includes('SAFETY CAR PERIOD') || (text.includes('SAFETY CAR') && (text.includes('DEPLOY') || text.includes('OUT') || text.includes('PERIOD'))) || (text.includes('SC') && (text.includes('DEPLOY') || text.includes('PERIOD')) && !text.includes('VSC') && !text.includes('VIRTUAL'))
      const clearSc = text.includes('ENDING') || text.includes('ENDED') || text.includes('IN THIS LAP') || text.includes('WITHDRAWN') || text.includes('RESTART') || text.includes('RESUMED') || (text.includes('GREEN') && text.includes('TRACK'))

      if (deployVsc && !deploySc) { isVSC = true; isSafetyCar = false }
      else if (deploySc && !deployVsc) { isSafetyCar = true; isVSC = false }
      else if (deploySc && deployVsc) {
        if (text.includes('VIRTUAL')) { isVSC = true; isSafetyCar = false }
        else { isSafetyCar = true; isVSC = false }
      }

      if (clearSc) { isSafetyCar = false; isVSC = false }
    }
  }

  if (raceStartTime != null && sessionTime >= raceStartTime) {
    if (!inRaceTrackEvents && (trackFlag === 'YELLOW' || trackFlag === 'DOUBLE YELLOW')) trackFlag = 'GREEN'
    if (!inRaceTrackEvents) for (const k of Object.keys(sectorFlags)) delete sectorFlags[Number(k)]
  }

  return { trackFlag, sectorFlags, isSafetyCar, isVSC }
}
