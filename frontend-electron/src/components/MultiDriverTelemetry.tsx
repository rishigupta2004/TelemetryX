import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UPlotChart } from '../components/UPlotChart'
import { useSessionStore } from '../stores/sessionStore'
import { useMultiDriverStore, type SelectedDriver } from '../stores/multiDriverStore'
import { api } from '../api/client'
import type { Driver, TelemetryRow } from '../types'
import { CHANNELS, type ChannelKey } from '../lib/telemetryUtils'

const MAX_TELEMETRY_POINTS = 2000

interface MultiDriverTelemetryProps {
  height?: number
}

const CHART_HEIGHT = 140
const METRICS: ChannelKey[] = ['speed', 'throttle', 'brake', 'gear']

interface ProcessedDriverData {
  driver: SelectedDriver
  distance: number[]
  speed: number[]
  throttle: number[]
  brake: number[]
  gear: number[]
}

interface ProcessedData {
  drivers: ProcessedDriverData[]
  maxDistance: number
}

export const MultiDriverTelemetry = React.memo(function MultiDriverTelemetry({
  height = 600
}: MultiDriverTelemetryProps) {
  const sessionData = useSessionStore((s) => s.sessionData)
  const fullLaps = useSessionStore((s) => s.laps)
  
  const selectedDrivers = useMultiDriverStore((s) => s.selectedDrivers)
  const availableDrivers = useMultiDriverStore((s) => s.availableDrivers)
  const setAvailableDrivers = useMultiDriverStore((s) => s.setAvailableDrivers)
  const addDriver = useMultiDriverStore((s) => s.addDriver)
  const removeDriver = useMultiDriverStore((s) => s.removeDriver)
  const updateDriverLap = useMultiDriverStore((s) => s.updateDriverLap)

  const [telemetryData, setTelemetryData] = useState<Map<string, TelemetryRow[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [lapOptions, setLapOptions] = useState<Map<string, number[]>>(new Map())

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (sessionData?.drivers) {
      setAvailableDrivers(sessionData.drivers)
    }
  }, [sessionData?.drivers, setAvailableDrivers])

  useEffect(() => {
    const lapsByDriver = new Map<string, number[]>()
    const allLaps = fullLaps.length ? fullLaps : sessionData?.laps || []
    
    for (const lap of allLaps) {
      const driverCode = sessionData?.drivers?.find(d => d.driverNumber === lap.driverNumber)?.code
      if (!driverCode) continue
      const laps = lapsByDriver.get(driverCode) || []
      if (!laps.includes(lap.lapNumber)) {
        laps.push(lap.lapNumber)
      }
    }
    
    for (const [code, laps] of lapsByDriver) {
      laps.sort((a, b) => a - b)
    }
    
    setLapOptions(lapsByDriver)
  }, [fullLaps, sessionData?.laps, sessionData?.drivers])

  const fetchTelemetry = useCallback(async () => {
    if (!selectedDrivers.length || !sessionData) return
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    
    const selectedYear = sessionData.metadata.year
    const selectedRace = sessionData.metadata.raceName
    const selectedSession = sessionData.metadata.sessionType

    try {
      const data = await api.getTelemetry(selectedYear, selectedRace, selectedSession, undefined, undefined, 1, abortControllerRef.current.signal)
      setTelemetryData(new Map(Object.entries(data)))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error fetching telemetry:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedDrivers, sessionData])

  useEffect(() => {
    fetchTelemetry()
  }, [fetchTelemetry])

  const processedData = useMemo((): ProcessedData | null => {
    if (!selectedDrivers.length || !telemetryData.size) return null

    const allLaps = fullLaps.length ? fullLaps : sessionData?.laps || []
    
    const results: ProcessedDriverData[] = []

    for (const driver of selectedDrivers) {
      const rows = telemetryData.get(driver.driverCode) || []
      if (!rows.length) continue

      const lapInfo = allLaps.find(l => {
        const driverMatch = sessionData?.drivers?.find(d => d.code === driver.driverCode)
        return driverMatch && l.driverNumber === driverMatch.driverNumber && l.lapNumber === driver.lapNumber
      })

      if (!lapInfo) continue

      const t0 = Math.floor(lapInfo.lapStartSeconds)
      const t1 = Math.ceil(lapInfo.lapEndSeconds)

      const filteredRows = rows.filter(r => r.timestamp >= t0 && r.timestamp <= t1)
      if (!filteredRows.length) continue

      let timestamps = filteredRows.map(r => r.timestamp)
      let distance: number[] = new Array(timestamps.length)
      distance[0] = 0

      for (let i = 1; i < timestamps.length; i++) {
        const dt = Math.max(0, timestamps[i] - timestamps[i - 1])
        const v0 = Number(filteredRows[i - 1].speed || 0)
        const v1 = Number(filteredRows[i].speed || 0)
        const vAvg = (v0 + v1) / 2
        const meters = (vAvg / 3.6) * dt
        distance[i] = distance[i - 1] + (Number.isFinite(meters) ? Math.max(0, meters) : 0)
      }

      const needsDownsampling = timestamps.length > MAX_TELEMETRY_POINTS
      if (needsDownsampling) {
        const step = timestamps.length / MAX_TELEMETRY_POINTS
        timestamps = []
        for (let i = 0; i < MAX_TELEMETRY_POINTS; i++) {
          timestamps.push(filteredRows[Math.floor(i * step)].timestamp)
        }
        distance = distance.filter((_, i) => i % Math.floor(step) === 0).slice(0, MAX_TELEMETRY_POINTS)
      }

      const speed = filteredRows.map(r => Number(r.speed) || 0)
      const throttle = filteredRows.map(r => Number(r.throttle) || 0)
      const brake = filteredRows.map(r => Number(r.brake) || 0)
      const gear = filteredRows.map(r => Number(r.gear) || 0)

      results.push({
        driver,
        distance: needsDownsampling ? distance.filter((_, i) => i % Math.floor(timestamps.length / MAX_TELEMETRY_POINTS) === 0).slice(0, MAX_TELEMETRY_POINTS) : distance,
        speed: needsDownsampling ? speed.filter((_, i) => i % Math.floor(speed.length / MAX_TELEMETRY_POINTS) === 0).slice(0, MAX_TELEMETRY_POINTS) : speed,
        throttle: needsDownsampling ? throttle.filter((_, i) => i % Math.floor(throttle.length / MAX_TELEMETRY_POINTS) === 0).slice(0, MAX_TELEMETRY_POINTS) : throttle,
        brake: needsDownsampling ? brake.filter((_, i) => i % Math.floor(brake.length / MAX_TELEMETRY_POINTS) === 0).slice(0, MAX_TELEMETRY_POINTS) : brake,
        gear: needsDownsampling ? gear.filter((_, i) => i % Math.floor(gear.length / MAX_TELEMETRY_POINTS) === 0).slice(0, MAX_TELEMETRY_POINTS) : gear,
      })
    }

    if (!results.length) return null

    const maxDistance = Math.max(...results.map(r => r.distance[r.distance.length - 1] || 0))
    if (maxDistance === 0) return null

    return { drivers: results, maxDistance }
  }, [selectedDrivers, telemetryData, fullLaps, sessionData])

  const handleDriverToggle = useCallback((driver: Driver) => {
    const isSelected = selectedDrivers.some(d => d.driverCode === driver.code)
    if (isSelected) {
      removeDriver(driver.code)
    } else {
      const driverLaps = lapOptions.get(driver.code) || []
      addDriver(driver, driverLaps[driverLaps.length - 1] || 1)
    }
  }, [selectedDrivers, lapOptions, addDriver, removeDriver])

  const handleLapChange = useCallback((driverCode: string, lap: number) => {
    updateDriverLap(driverCode, lap)
  }, [updateDriverLap])

  const getMetricData = useCallback((driverData: ProcessedDriverData, metric: ChannelKey): number[] => {
    switch (metric) {
      case 'speed': return driverData.speed
      case 'throttle': return driverData.throttle
      case 'brake': return driverData.brake
      case 'gear': return driverData.gear
      case 'rpm': return []
      case 'drs': return []
      default: return []
    }
  }, [])

  const getChannelConfig = (key: ChannelKey) => {
    return CHANNELS.find(c => c.key === key)
  }

  const availableDriverList = useMemo(() => {
    return sessionData?.drivers || []
  }, [sessionData?.drivers])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(height)
  
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    const measure = () => {
      const h = el.getBoundingClientRect().height
      if (h > 50) setChartHeight(Math.max(80, Math.floor(h)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-soft bg-gradient-to-r from-bg-surface via-bg-raised to-bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted" style={{ fontFamily: 'var(--font-heading)' }}>
            Drivers
          </span>
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {availableDriverList.map((driver) => {
            const isSelected = selectedDrivers.some(d => d.driverCode === driver.code)
            return (
              <button
                key={driver.code}
                onClick={() => handleDriverToggle(driver)}
                disabled={!isSelected && selectedDrivers.length >= 4}
                className={`
                  flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all
                  ${isSelected 
                    ? 'bg-bg-surface border border-border-soft shadow-sm' 
                    : 'bg-transparent border border-transparent hover:border-border-micro'
                  }
                  ${!isSelected && selectedDrivers.length >= 4 ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                style={{ 
                  color: isSelected ? 'var(--fg-primary)' : 'var(--fg-muted)'
                }}
              >
                <span 
                  className="h-2 w-2 rounded-full" 
                  style={{ backgroundColor: driver.teamColor }}
                />
                <span>{driver.code}</span>
              </button>
            )
          })}
        </div>

        {selectedDrivers.length > 0 && (
          <div className="ml-auto flex items-center gap-4">
            {selectedDrivers.map((driver) => {
              const laps = lapOptions.get(driver.driverCode) || []
              return (
                <div key={driver.driverCode} className="flex items-center gap-2 rounded-lg bg-bg-surface px-2 py-1 border border-border-soft">
                  <span 
                    className="h-2 w-2 rounded-full" 
                    style={{ backgroundColor: driver.teamColor }}
                  />
                  <span className="text-[11px] font-medium text-fg-secondary">{driver.driverCode}</span>
                  <select
                    value={driver.lapNumber}
                    onChange={(e) => handleLapChange(driver.driverCode, Number(e.target.value))}
                    className="rounded bg-bg-inset px-1.5 py-0.5 text-[10px] font-mono text-fg-primary border border-border-micro focus:outline-none focus:border-border-soft"
                  >
                    {laps.map((lap) => (
                      <option key={lap} value={lap}>Lap {lap}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeDriver(driver.driverCode)}
                    className="ml-1 flex h-4 w-4 items-center justify-center rounded text-fg-muted hover:bg-bg-inset hover:text-fg-primary"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div ref={chartContainerRef} className="flex-1 overflow-y-hidden w-full flex flex-col">
        {!selectedDrivers.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-hard bg-bg-surface">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-fg-muted">
                <path d="M3 3V21H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 14L12 9L16 13L21 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-[14px] font-semibold text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>
                Select Drivers to Compare
              </div>
              <div className="mt-1 text-[11px] text-fg-muted font-mono">
                Click on driver pills above to add up to 4 drivers
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex h-full flex-col gap-2 p-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-border-soft bg-bg-surface p-3">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="mb-2 h-3 w-24 rounded bg-bg-inset" />
                <div className="h-24 w-full rounded-lg bg-bg-inset" />
              </div>
            ))}
          </div>
        ) : processedData ? (
          <div className="flex-1 flex flex-col">
            {METRICS.map((metricKey, idx, arr) => {
              const config = getChannelConfig(metricKey)
              if (!config) return null

              const isLast = idx === arr.length - 1
              const dynamicHeight = Math.max(80, Math.floor((chartHeight - (arr.length - 1)) / arr.length))

              const series = processedData.drivers.map((driverData) => ({
                label: driverData.driver.driverCode,
                data: getMetricData(driverData, metricKey),
                color: driverData.driver.teamColor,
                width: 2
              }))

              const allDataEmpty = series.every(s => !s.data.length || s.data.every((v: number) => !Number.isFinite(v)))
              if (allDataEmpty) return null

              return (
                <div key={metricKey} className={isLast ? '' : 'border-b border-border-micro/50'}>
                  <UPlotChart
                    title={config.title}
                    timestamps={processedData.drivers[0]?.distance || []}
                    series={series}
                    height={dynamicHeight}
                    yRange={config.y}
                    xRange={[0, processedData.maxDistance]}
                    xLabel={isLast ? 'Distance' : ''}
                    xTickMode="distance"
                    xTickUnit="m"
                    yLabel={config.axisLabel}
                    yTickMode={config.tickMode}
                    yTickUnit={config.tickUnit}
                    stepped={config.stepped}
                    frame={false}
                    showHeader={true}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-[14px] font-semibold text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>
                No Telemetry Data
              </div>
              <div className="mt-1 text-[11px] text-fg-muted font-mono">
                No telemetry data available for selected drivers and laps
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
