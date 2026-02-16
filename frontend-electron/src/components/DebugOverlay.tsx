import { useEffect } from 'react'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

export function DebugOverlay() {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const duration = usePlaybackStore((s) => s.duration)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const speed = usePlaybackStore((s) => s.speed)
  const sessionData = useSessionStore((s) => s.sessionData)
  const fullLaps = useSessionStore((s) => s.laps)
  const sessionTime = useSessionTime()

  const laps = fullLaps.length ? fullLaps : sessionData?.laps || []
  const weatherRows = sessionData?.weather || []
  const firstLapStart = laps.length > 0
    ? Math.min(...laps.map((l) => l.lapStartSeconds).filter((t) => t > 0))
    : 0
  const lastLapEnd = laps.length > 0
    ? Math.max(...laps.map((l) => l.lapEndSeconds))
    : 0

  const verLaps = laps
    .filter((l) => l.driverName === 'VER')
    .sort((a, b) => a.lapNumber - b.lapNumber)

  let verCurrentLap = 0
  for (const lap of verLaps) {
    if (sessionTime >= lap.lapStartSeconds &&
        sessionTime <= lap.lapEndSeconds) {
      verCurrentLap = lap.lapNumber
      break
    }
    if (sessionTime > lap.lapEndSeconds) {
      verCurrentLap = lap.lapNumber
    }
  }

  const rc = sessionData?.raceControl || []
  const rcTimestamps = rc.map((m: any) => m.timestamp)
  const lapStarts = laps.map((l: any) => l.lapStartSeconds).filter((t: number) => t > 0)
  const rcUpToNow = rc.filter((m) => m.timestamp >= sessionStartTime && m.timestamp <= sessionTime)
  const lastRC = rcUpToNow.length > 0 ? rcUpToNow[rcUpToNow.length - 1] : null
  const weatherNearest = weatherRows.length > 0
    ? weatherRows.reduce((best, row) =>
      Math.abs(row.timestamp - sessionTime) < Math.abs(best.timestamp - sessionTime) ? row : best
    )
    : null

  useEffect(() => {
    if (!sessionData) return
    const weather = sessionData?.weather || []
    const weatherTs = weather.map((w: any) => w.timestamp)

    console.log('=== FULL TIMESTAMP AUDIT ===')
    console.log('RC range:',
      rc.length ? `${Math.min(...rcTimestamps)} → ${Math.max(...rcTimestamps)}` : 'none')
    console.log('Weather range:',
      weather.length ? `${Math.min(...weatherTs)} → ${Math.max(...weatherTs)}` : 'none')
    console.log('Lap range:',
      laps.length ? `${Math.min(...lapStarts)} → ${Math.max(...laps.map((l: any) => l.lapEndSeconds))}` : 'none')
    console.log('sessionStartTime:', sessionStartTime)
    console.log('duration:', duration)
    console.log('')
    console.log('At currentTime=0:')
    console.log('  sessionTime:', sessionStartTime)
    console.log('  RC messages at this time:',
      rc.filter((m: any) => m.timestamp <= sessionStartTime).length, '/', rc.length)
    console.log('  RC race-window messages at this time:',
      rc.filter((m: any) => m.timestamp >= sessionStartTime && m.timestamp <= sessionStartTime).length, '/', rc.length)
    console.log('  RC messages at currentTime=0:',
      rc.filter((m: any) => m.timestamp <= 0).length, '/', rc.length)
    console.log('')
    console.log('First 5 RC messages:')
    rc.slice(0, 5).forEach((m: any) =>
      console.log(`  t=${m.timestamp} L${m.lap} ${m.flag || m.category}: ${(m.message || '').substring(0, 50)}`))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData])

  // Driver code matching audit
  useEffect(() => {
    if (!sessionData) return

    const drivers = sessionData.drivers || []
    const laps = sessionData.laps || []

    console.log('=== DRIVER MATCHING AUDIT ===')
    console.log('Driver count:', drivers.length)
    console.log('Lap count:', laps.length)

    // Show all driver objects
    console.log('Drivers:')
    drivers.forEach((d: any) => {
      console.log(`  #${d.driverNumber} code="${d.code}" name="${d.driverName}" team="${d.teamName}"`)
    })

    // Show unique driverName values from laps
    const lapDriverNames = [...new Set(laps.map((l: any) => l.driverName))]
    console.log('Lap driverName values:', lapDriverNames.sort())

    // Show unique driverNumber values from laps
    const lapDriverNumbers = [...new Set(laps.map((l: any) => l.driverNumber))]
    console.log('Lap driverNumber values:', lapDriverNumbers.sort((a: number, b: number) => a - b))

    // Check matching
    console.log('')
    console.log('MATCHING:')
    for (const driver of drivers) {
      const byCode = laps.filter((l: any) => l.driverName === driver.code)
      const byNumber = laps.filter((l: any) => l.driverNumber === driver.driverNumber)
      const byName = laps.filter((l: any) => l.driverName === driver.driverName)

      console.log(
        `  ${driver.driverName} (#${driver.driverNumber}) code="${driver.code}": ` +
          `byCode=${byCode.length} byNumber=${byNumber.length} byName=${byName.length}`
      )
    }

    // Show first lap row fully
    if (laps.length > 0) {
      console.log('')
      console.log('First lap row ALL fields:', JSON.stringify(laps[0]))
    }
  }, [sessionData])

  return (
    <div style={{
      position: 'fixed',
      bottom: 60,
      right: 10,
      background: 'rgba(0,0,0,0.9)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: 11,
      padding: 8,
      borderRadius: 4,
      zIndex: 9999,
      maxWidth: 350,
      border: '1px solid #333'
    }}>
      <div><b>DEBUG OVERLAY</b></div>
      <div>currentTime: {currentTime.toFixed(1)}</div>
      <div>sessionStartTime: {firstLapStart.toFixed(1)}</div>
      <div>sessionTime: {sessionTime.toFixed(1)}</div>
      <div>duration: {duration.toFixed(1)}</div>
      <div>isPlaying: {String(isPlaying)} | speed: {speed}x</div>
      <div>---</div>
      <div>firstLapStart: {firstLapStart.toFixed(1)}</div>
      <div>lastLapEnd: {lastLapEnd.toFixed(1)}</div>
      <div style={{ color: '#0f0' }}>
        MATCH: sessionTime = firstLapStart + currentTime
      </div>
      <div>---</div>
      <div>VER on lap: {verCurrentLap}</div>
      <div>VER lap1: {verLaps[0]?.lapStartSeconds?.toFixed(1)} - {verLaps[0]?.lapEndSeconds?.toFixed(1)}</div>
      <div>VER lap5: {verLaps[4]?.lapStartSeconds?.toFixed(1)} - {verLaps[4]?.lapEndSeconds?.toFixed(1)}</div>
      <div>---</div>
      <div>RC messages up to now: {rcUpToNow.length} / {rc.length}</div>
      <div>Last RC: {lastRC ? `L${lastRC.lap} ${lastRC.flag || lastRC.category}` : 'none'}</div>
      <div>Last RC timestamp: {lastRC?.timestamp}</div>
      <div>Weather rows up to now: {weatherRows.filter((w) => w.timestamp <= sessionTime).length} / {weatherRows.length}</div>
      <div>Weather nearest ts: {weatherNearest?.timestamp?.toFixed?.(1) ?? 'none'}</div>
    </div>
  )
}
