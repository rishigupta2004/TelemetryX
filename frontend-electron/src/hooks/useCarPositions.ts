import { useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { usePlaybackStore } from '../stores/playbackStore'

export interface CarPosition {
  driverCode: string
  driverNumber: number
  teamColor: string
  progress: number
  currentLap: number
  position: number
}

export function useCarPositions(): CarPosition[] {
  const sessionData = useSessionStore(s => s.sessionData)
  const currentTime = usePlaybackStore(s => s.currentTime)
  const sessionStartTime = usePlaybackStore(s => s.sessionStartTime)

  const sessionTime = sessionStartTime + currentTime

  return useMemo(() => {
    if (!sessionData?.laps || !sessionData?.drivers) return []

    const drivers = sessionData.drivers
    const allLaps = sessionData.laps
    const results: CarPosition[] = []

    for (const driver of drivers) {
      const driverLaps = allLaps
        .filter((l: any) =>
          l.driverName === driver.code ||
          l.driverNumber === driver.driverNumber
        )
        .sort((a: any, b: any) => a.lapNumber - b.lapNumber)

      // No lap data at all — truly DNS, skip
      if (driverLaps.length === 0) continue

      const firstStart = driverLaps[0].lapStartSeconds
      const lastEnd = driverLaps[driverLaps.length - 1].lapEndSeconds
      const driverMaxLap = driverLaps[driverLaps.length - 1].lapNumber
      const raceMaxLap = Math.max(
        ...allLaps.map((l: any) => l.lapNumber)
      )

      // Before this driver's first lap — show at start line
      if (sessionTime < firstStart) {
        results.push({
          driverCode: driver.code,
          driverNumber: driver.driverNumber,
          teamColor: driver.teamColor || '#fff',
          progress: 0,
          currentLap: 0,
          position: driverLaps[0].position || 99,
        })
        continue
      }

      // After this driver's last lap + 30s grace
      // If they completed far fewer laps than leader = DNF
      if (sessionTime > lastEnd + 30 &&
          driverMaxLap < raceMaxLap - 1) {
        // DNF — don't show
        continue
      }

      // Find current in-progress lap
      let found = false
      for (const lap of driverLaps) {
        if (lap.lapStartSeconds <= sessionTime &&
            sessionTime <= lap.lapEndSeconds) {
          // Currently on this lap
          const dur = lap.lapEndSeconds - lap.lapStartSeconds
          let progress = dur > 0
            ? (sessionTime - lap.lapStartSeconds) / dur
            : 0
          progress = Math.max(0, Math.min(0.999, progress))

          results.push({
            driverCode: driver.code,
            driverNumber: driver.driverNumber,
            teamColor: driver.teamColor || '#fff',
            progress,
            currentLap: lap.lapNumber,
            position: lap.position || 99,
          })
          found = true
          break
        }
      }

      if (found) continue

      // Between laps (gap between lapEnd and next lapStart)
      // Find last completed lap
      const completed = driverLaps.filter(
        (l: any) => l.lapEndSeconds <= sessionTime
      )
      if (completed.length > 0) {
        const lastLap = completed[completed.length - 1]
        // Show at finish line of last completed lap
        results.push({
          driverCode: driver.code,
          driverNumber: driver.driverNumber,
          teamColor: driver.teamColor || '#fff',
          progress: 0.999,
          currentLap: lastLap.lapNumber,
          position: lastLap.position || 99,
        })
      }
    }

    return results
  }, [sessionData, sessionTime])
}
