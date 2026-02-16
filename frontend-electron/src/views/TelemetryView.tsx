import React, { useEffect, useMemo, useState } from 'react'
import { UPlotChart } from '../components/UPlotChart'
import { useSessionTime } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'

export const TelemetryView = React.memo(function TelemetryView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const fullLaps = useSessionStore((s) => s.laps)

  const telemetryData = useTelemetryStore((s) => s.telemetryData)
  const loadingState = useTelemetryStore((s) => s.loadingState)
  const loadTelemetry = useTelemetryStore((s) => s.loadTelemetry)

  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [compareDriver, setCompareDriver] = useState<string | null>(null)
  const [selectedLap, setSelectedLap] = useState<number>(1)
  const sessionTime = useSessionTime()
  const roundedSessionTime = Math.round(sessionTime * 10) / 10

  const drivers = sessionData?.drivers || []
  const laps = fullLaps.length ? fullLaps : sessionData?.laps || []

  const driverLaps = useMemo(() => {
    if (!selectedDriver || !laps.length) return []
    return laps.filter((l) => l.driverName === selectedDriver).sort((a, b) => a.lapNumber - b.lapNumber)
  }, [selectedDriver, laps])

  const lapNumbers = useMemo(() => driverLaps.map((l) => l.lapNumber), [driverLaps])

  const lapTimeWindow = useMemo(() => {
    const lap = driverLaps.find((l) => l.lapNumber === selectedLap)
    if (!lap) return null
    return {
      t0: Math.floor(lap.lapStartSeconds),
      t1: Math.ceil(lap.lapEndSeconds),
      duration: lap.lapTime || lap.lapEndSeconds - lap.lapStartSeconds
    }
  }, [driverLaps, selectedLap])

  useEffect(() => {
    if (!selectedDriver && drivers.length > 0) {
      setSelectedDriver(drivers[0].code)
    }
  }, [drivers, selectedDriver])

  useEffect(() => {
    if (lapNumbers.length > 0 && !lapNumbers.includes(selectedLap)) {
      setSelectedLap(lapNumbers[0])
    }
  }, [lapNumbers, selectedLap])

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession) return
    if (!lapTimeWindow) return
    const t0 = Math.max(0, lapTimeWindow.t0 - 1)
    const t1 = lapTimeWindow.t1 + 1
    void loadTelemetry(selectedYear, selectedRace, selectedSession, t0, t1)
  }, [selectedYear, selectedRace, selectedSession, lapTimeWindow, loadTelemetry])

  const chartData = useMemo(() => {
    if (!telemetryData || !selectedDriver || !lapTimeWindow) return null

    const primaryRaw = telemetryData[selectedDriver] || []
    const compareRaw = compareDriver ? telemetryData[compareDriver] || [] : []
    if (!primaryRaw.length) return null

    const lapT0 = lapTimeWindow.t0
    const lapT1 = lapTimeWindow.t1
    const timeLimit = Math.min(roundedSessionTime, lapT1)

    const primaryData = primaryRaw.filter((r) => r.timestamp >= lapT0 && r.timestamp <= timeLimit)
    const compareData = compareRaw.filter((r) => r.timestamp >= lapT0 && r.timestamp <= timeLimit)
    if (!primaryData.length) return null

    const firstTimestamp = lapT0
    const timestamps = primaryData.map((r) => r.timestamp - firstTimestamp)

    const alignCompare = (field: 'speed' | 'throttle' | 'brake' | 'gear' | 'rpm' | 'drs') => {
      if (!compareData.length) return [] as number[]
      return timestamps.map((_, i) => {
        const targetTime = primaryData[i].timestamp
        let nearest = compareData[0]
        let minDiff = Math.abs(targetTime - nearest.timestamp)
        for (const row of compareData) {
          const diff = Math.abs(targetTime - row.timestamp)
          if (diff < minDiff) {
            minDiff = diff
            nearest = row
          }
        }
        return Number(nearest[field]) || 0
      })
    }

    const primaryColor = drivers.find((d) => d.code === selectedDriver)?.teamColor || '#0090ff'
    const compareColor = compareDriver
      ? drivers.find((d) => d.code === compareDriver)?.teamColor || '#ff8c00'
      : '#ff8c00'

    return {
      timestamps,
      fullLapDuration: lapT1 - lapT0,
      primaryColor,
      compareColor,
      speed: { primary: primaryData.map((r) => r.speed), compare: alignCompare('speed') },
      throttle: { primary: primaryData.map((r) => r.throttle), compare: alignCompare('throttle') },
      brake: { primary: primaryData.map((r) => Number(r.brake)), compare: alignCompare('brake') },
      gear: { primary: primaryData.map((r) => r.gear), compare: alignCompare('gear') },
      rpm: { primary: primaryData.map((r) => r.rpm), compare: alignCompare('rpm') },
      drs: { primary: primaryData.map((r) => r.drs), compare: alignCompare('drs') }
    }
  }, [telemetryData, selectedDriver, compareDriver, drivers, lapTimeWindow, roundedSessionTime])

  useEffect(() => {
    if (!lapTimeWindow) return
    if (roundedSessionTime > lapTimeWindow.t1 + 2) {
      const nextLap = lapNumbers.find((lap) => lap > selectedLap)
      if (nextLap) setSelectedLap(nextLap)
    }
  }, [roundedSessionTime, lapTimeWindow, selectedLap, lapNumbers])

  const goToPrevLap = () => {
    const idx = lapNumbers.indexOf(selectedLap)
    if (idx > 0) setSelectedLap(lapNumbers[idx - 1])
  }

  const goToNextLap = () => {
    const idx = lapNumbers.indexOf(selectedLap)
    if (idx < lapNumbers.length - 1) setSelectedLap(lapNumbers[idx + 1])
  }

  if (loadingState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-text-secondary">
        Loading telemetry for Lap {selectedLap}...
      </div>
    )
  }

  if (!sessionData) {
    return <div className="flex h-full items-center justify-center text-text-muted">No session loaded</div>
  }

  const makeSeries = (primary: number[], compare: number[]) => {
    const result = [
      { label: selectedDriver || 'DRV', data: primary, color: chartData?.primaryColor || '#0090ff', width: 2 }
    ]
    if (compareDriver && compare.length) {
      result.push({ label: compareDriver, data: compare, color: chartData?.compareColor || '#ff8c00', width: 1.5 })
    }
    return result
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border bg-bg-secondary px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">DRIVER:</span>
          <select
            value={selectedDriver || ''}
            onChange={(e) => {
              setSelectedDriver(e.target.value)
              setSelectedLap(1)
            }}
            className="rounded border border-border bg-bg-card px-2 py-1 text-sm text-text-primary"
          >
            {drivers.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} — {d.driverName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">VS:</span>
          <select
            value={compareDriver || ''}
            onChange={(e) => setCompareDriver(e.target.value || null)}
            className="rounded border border-border bg-bg-card px-2 py-1 text-sm text-text-primary"
          >
            <option value="">None</option>
            {drivers
              .filter((d) => d.code !== selectedDriver)
              .map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.driverName}
                </option>
              ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={goToPrevLap}
            disabled={lapNumbers.indexOf(selectedLap) <= 0}
            className="rounded border border-border bg-bg-card px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            type="button"
          >
            ◀
          </button>
          <select
            value={selectedLap}
            onChange={(e) => setSelectedLap(Number(e.target.value))}
            className="rounded border border-border bg-bg-card px-2 py-1 font-mono text-sm text-text-primary"
          >
            {lapNumbers.map((lap) => (
              <option key={lap} value={lap}>
                Lap {lap}
              </option>
            ))}
          </select>
          <button
            onClick={goToNextLap}
            disabled={lapNumbers.indexOf(selectedLap) >= lapNumbers.length - 1}
            className="rounded border border-border bg-bg-card px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            type="button"
          >
            ▶
          </button>
          {lapTimeWindow && <span className="ml-2 font-mono text-xs text-text-muted">{lapTimeWindow.duration.toFixed(1)}s</span>}
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {chartData ? (
          <>
            {/* Keep x-axis fixed to full lap duration while traces draw progressively */}
            <UPlotChart
              title="Speed (km/h)"
              timestamps={chartData.timestamps}
              series={makeSeries(chartData.speed.primary, chartData.speed.compare)}
              height={150}
              yRange={[0, 360]}
              xRange={[0, chartData.fullLapDuration]}
              yLabel="km/h"
            />
            <UPlotChart
              title="Throttle (%)"
              timestamps={chartData.timestamps}
              series={makeSeries(chartData.throttle.primary, chartData.throttle.compare)}
              height={90}
              yRange={[0, 105]}
              xRange={[0, chartData.fullLapDuration]}
              yLabel="%"
            />
            <UPlotChart
              title="Brake"
              timestamps={chartData.timestamps}
              series={makeSeries(chartData.brake.primary, chartData.brake.compare)}
              height={90}
              yRange={[0, 105]}
              xRange={[0, chartData.fullLapDuration]}
              yLabel="%"
            />
            <UPlotChart
              title="Gear"
              timestamps={chartData.timestamps}
              series={makeSeries(chartData.gear.primary, chartData.gear.compare)}
              height={70}
              yRange={[0, 9]}
              xRange={[0, chartData.fullLapDuration]}
              yLabel="Gear"
              stepped
            />
            <UPlotChart
              title="RPM"
              timestamps={chartData.timestamps}
              series={makeSeries(chartData.rpm.primary, chartData.rpm.compare)}
              height={90}
              yRange={[0, 15000]}
              xRange={[0, chartData.fullLapDuration]}
              yLabel="RPM"
            />
            <UPlotChart
              title="DRS"
              timestamps={chartData.timestamps}
              series={makeSeries(chartData.drs.primary, chartData.drs.compare)}
              height={50}
              yRange={[0, 2]}
              xRange={[0, chartData.fullLapDuration]}
              yLabel="DRS"
              stepped
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            {loadingState === 'error' ? 'Error loading telemetry' : 'No telemetry data for this lap'}
          </div>
        )}
      </div>
    </div>
  )
})
