import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UPlotChart } from '../components/UPlotChart'
import { useSessionTime } from '../lib/timeUtils'
import { useDriverStore } from '../stores/driverStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import { ChannelKey } from '../lib/telemetryUtils'
import { useTelemetryData, useTelemetryCharts } from '../hooks/useTelemetryData'
import { usePlaybackCursor } from '../hooks/usePlaybackCursor'
import { TelemetryHeader } from '../components/TelemetryHeader'
import { TelemetryControls } from '../components/TelemetryControls'
import { TelemetryLegend } from '../components/TelemetryLegend'
import { MultiDriverTelemetry } from '../components/MultiDriverTelemetry'

const DEFAULT_CHART_HEIGHT = 500

export const TelemetryView = React.memo(function TelemetryView({ active = true }: { active?: boolean }) {
  const activeRef = useRef(active)
  activeRef.current = active

  const sessionData = useSessionStore((s) => s.sessionData)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)

  const loadingState = useTelemetryStore((s) => s.loadingState)
  const loadTelemetry = useTelemetryStore((s) => s.loadTelemetry)
  const telemetryData = useTelemetryStore((s) => s.telemetryData)

  const selectedDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)

  const [selectedLap, setSelectedLap] = useState(1)
  const [followPlayback, setFollowPlayback] = useState(true)
  const [stackedChannels, setStackedChannels] = useState<ChannelKey[]>(['speed', 'throttle', 'brake', 'rpm', 'gear', 'drs'])
  const [cursorByKey, setCursorByKey] = useState<Record<string, { x: number | null; values: number[] }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single')
  const telemetryError = useTelemetryStore((s) => s.error)

  const previousDriverRef = useRef<string | null>(null)
  const lastFetchRef = useRef<{ year: number; race: string; session: string; t0: number; t1: number } | null>(null)

  const sessionTime = useSessionTime()
  const speed = usePlaybackStore((s) => s.speed)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const samplingHz = followPlayback ? (speed >= 12 ? 36 : speed >= 8 ? 30 : speed >= 4 ? 24 : 18) : 60
  const sampledSessionTime = Math.round(sessionTime * samplingHz) / samplingHz

  const drivers = useMemo(() => sessionData?.drivers || [], [sessionData?.drivers])

  const chartWindowRef = useRef({ lapT0: 0, lapT1: 0, distMax: 0, timestampsAbs: [] as number[], distance: [] as number[] })
  const cursorFractionRef = usePlaybackCursor(active, chartWindowRef)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(DEFAULT_CHART_HEIGHT)
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    const measure = () => {
      const h = el.getBoundingClientRect().height
      if (h > 50) setChartHeight(Math.max(160, Math.floor(h)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const {
    windowedTelemetry,
    fetchWindow,
    lapTimeWindow,
    lapNumbers,
    activeLapNumber,
    effectiveLapNumber,
    telemetryWindowStart,
    telemetryWindowEnd,
  } = useTelemetryData(sampledSessionTime, selectedLap, selectedDriver, compareDriver)

  const { chartData, builtCharts } = useTelemetryCharts(
    windowedTelemetry,
    selectedDriver,
    compareDriver,
    drivers,
    lapTimeWindow
  )

  useEffect(() => {
    if (windowedTelemetry) {
      chartWindowRef.current = {
        lapT0: windowedTelemetry.lapT0,
        lapT1: windowedTelemetry.lapT1,
        distMax: windowedTelemetry.distance[windowedTelemetry.distance.length - 1] ?? 0,
        timestampsAbs: windowedTelemetry.timestampsAbs,
        distance: windowedTelemetry.distance,
      }
    }
  }, [windowedTelemetry])

  useEffect(() => {
    if (!selectedDriver && drivers.length) selectPrimary(drivers[0].code)
  }, [drivers, selectedDriver, selectPrimary])

  useEffect(() => {
    if (!drivers.length) return
    if (!selectedDriver || !drivers.some((d) => d.code === selectedDriver)) selectPrimary(drivers[0].code)
    if (compareDriver && !drivers.some((d) => d.code === compareDriver && d.code !== selectedDriver))
      selectCompare(null)
  }, [drivers, selectedDriver, compareDriver, selectPrimary, selectCompare])

  useEffect(() => {
    if (lapNumbers.length && !lapNumbers.includes(selectedLap)) setSelectedLap(lapNumbers[0])
  }, [lapNumbers, selectedLap])

  useEffect(() => {
    if (effectiveLapNumber != null && selectedLap !== effectiveLapNumber) {
      setSelectedLap(effectiveLapNumber)
    }
  }, [effectiveLapNumber, selectedLap])

  useEffect(() => {
    if (!selectedDriver) {
      previousDriverRef.current = null
      return
    }
    const prev = previousDriverRef.current
    previousDriverRef.current = selectedDriver
    if (prev === selectedDriver || !windowedTelemetry) return
    const target = activeLapNumber ?? lapNumbers[0]
    if (target !== selectedLap) setSelectedLap(target)
  }, [selectedDriver, activeLapNumber, selectedLap, windowedTelemetry, lapNumbers])

  useEffect(() => {
    if (followPlayback && activeLapNumber != null && selectedLap !== activeLapNumber) setSelectedLap(activeLapNumber)
  }, [activeLapNumber, followPlayback, selectedLap])

  useEffect(() => {
    if (loadingState === 'loading') {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [loadingState])

  const resolvedYear = selectedYear ?? sessionData?.metadata?.year ?? null
  const resolvedRace = selectedRace ?? sessionData?.metadata?.raceName ?? null
  const resolvedSession = selectedSession ?? sessionData?.metadata?.sessionType ?? null
  const effectiveSelectedLap = selectedLap ?? 1
  const sessionKey = resolvedYear && resolvedRace && resolvedSession
    ? `${resolvedYear}|${resolvedRace}|${resolvedSession}`
    : null

  useEffect(() => {
    if (!active) return
    if (!resolvedYear || !resolvedRace || !resolvedSession) return

    const t0 = fetchWindow?.t0 ?? 0
    const t1 = fetchWindow?.t1 ?? 600

    const next = {
      year: resolvedYear,
      race: resolvedRace,
      session: resolvedSession,
      t0,
      t1,
    }
    const prev = lastFetchRef.current
    if (
      prev &&
      prev.year === next.year &&
      prev.race === next.race &&
      prev.session === next.session &&
      prev.t0 === next.t0 &&
      prev.t1 === next.t1
    ) {
      return
    }

    lastFetchRef.current = next
    const timer = window.setTimeout(() => {
      void loadTelemetry(next.year, next.race, next.session, next.t0, next.t1)
    }, 90)
    return () => window.clearTimeout(timer)
  }, [active, resolvedYear, resolvedRace, resolvedSession, fetchWindow, loadTelemetry, selectedDriver, compareDriver, effectiveSelectedLap, sessionKey])

  const handleCursor = useCallback(
    (key: string) =>
      (payload: { idx: number | null; x: number | null; values: number[] }) => {
        setCursorByKey((prev) => ({
          ...prev,
          [key]: { x: payload.x, values: payload.values },
        }))
      },
    []
  )

  const handleSeek = useCallback(
    (dataX: number) => {
      if (!chartData) return
      const times = chartData.timestampsAbs
      const dist = chartData.distance
      if (!times.length || !dist.length) return
      let lo = 0
      let hi = dist.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (dist[mid] < dataX) lo = mid + 1
        else hi = mid
      }
      const i = lo
      const t = times[Math.min(i, times.length - 1)]
      if (Number.isFinite(t)) {
        usePlaybackStore.getState().seek(t - sessionStartTime)
      }
    },
    [chartData, sessionStartTime]
  )

  const handleToggleChannel = useCallback((channel: ChannelKey) => {
    setStackedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }, [])

  const handleSelectLap = useCallback(
    (lap: number) => {
      setSelectedLap(lap)
      setFollowPlayback(false)
    },
    []
  )

  if (!sessionData) return <div className="flex h-full items-center justify-center text-fg-muted">No session loaded</div>

  const primaryDriverObj = drivers.find((d) => d.code === selectedDriver)
  const compareDriverObj = compareDriver ? drivers.find((d) => d.code === compareDriver) : undefined
  const compareDriverHasData = useMemo(() => {
    if (!compareDriver || !telemetryData) return true
    const driver = drivers.find((item) => item.code === compareDriver)
    if (!driver) return false
    const rowsByKey = telemetryData as Record<string, Array<{ driverNumber?: number; driverName?: string }> | undefined>
    const candidates = [
      compareDriver,
      compareDriver.toUpperCase(),
      String(driver.driverNumber),
      String(driver.driverName || ''),
      String(driver.driverName || '').toUpperCase(),
    ].filter(Boolean)
    for (const key of candidates) {
      const rows = rowsByKey[key]
      if (Array.isArray(rows) && rows.length > 0) return true
    }
    return Object.values(rowsByKey).some((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return false
      const first = rows[0]
      return (
        Number(first.driverNumber) === Number(driver.driverNumber) ||
        String(first.driverName || '').toUpperCase() === compareDriver.toUpperCase()
      )
    })
  }, [compareDriver, drivers, telemetryData])

  const driverList = drivers.map((d) => ({ code: d.code, driverName: d.driverName, teamColor: d.teamColor }))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TelemetryHeader
        drivers={driverList}
        selectedDriver={selectedDriver}
        compareDriver={compareDriver}
        stackedChannels={stackedChannels}
        onSelectPrimary={(code) => {
          selectPrimary(code)
          setFollowPlayback(true)
        }}
        onSelectCompare={selectCompare}
        onToggleChannel={handleToggleChannel}
        selectedDriverObj={primaryDriverObj}
        compareDriverObj={compareDriverObj}
      />

      <div className="relative z-10 flex flex-col gap-2 border-b border-border bg-bg-surface px-4 pb-2.5 pt-2">
        <div className="flex items-center justify-between">
          <TelemetryControls
            selectedDriver={selectedDriver}
            compareDriver={compareDriver}
            followPlayback={followPlayback}
            selectedLap={selectedLap}
            lapNumbers={lapNumbers}
            lapTimeWindow={lapTimeWindow}
            activeLapNumber={activeLapNumber}
            telemetryWindowStart={telemetryWindowStart}
            telemetryWindowEnd={telemetryWindowEnd}
            loadingState={loadingState}
            compareDriverHasData={compareDriverHasData}
            onFollowPlaybackToggle={() => setFollowPlayback((v) => !v)}
            onSelectLap={handleSelectLap}
          />
          <div className="flex items-center gap-1 rounded-lg bg-bg-surface p-0.5 border border-border-micro">
            <button
              onClick={() => setViewMode('single')}
              className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
                viewMode === 'single' 
                  ? 'bg-bg-raised text-fg-primary shadow-sm' 
                  : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Single
            </button>
            <button
              onClick={() => setViewMode('multi')}
              className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
                viewMode === 'multi' 
                  ? 'bg-bg-raised text-fg-primary shadow-sm' 
                  : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Multi-Driver
            </button>
          </div>
        </div>
        {viewMode === 'single' && (
          <TelemetryLegend primaryDriverObj={primaryDriverObj ?? undefined} compareDriverObj={compareDriverObj} />
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-base">
        {viewMode === 'multi' ? (
          <MultiDriverTelemetry height={chartHeight} />
        ) : builtCharts.length > 0 ? (
          <div ref={chartContainerRef} className="flex-1 overflow-y-hidden w-full flex flex-col">
            <div className="flex-1 flex flex-col">
                {(() => {
                  const filteredCharts = builtCharts.filter((chart) => stackedChannels.includes(chart.key as ChannelKey))
                  return filteredCharts.map((chart, idx, arr) => {
                    const isLast = idx === arr.length - 1
                    const dynamicHeight = Math.max(80, Math.floor((chartHeight - (arr.length - 1)) / arr.length))

                  const distArr = chartData?.distance ?? []
                  const timeArr = chartData?.timestampsAbs ?? []
                  const xMax = distArr.length > 0
                    ? distArr[distArr.length - 1]
                    : timeArr.length > 0
                      ? timeArr[timeArr.length - 1] - (timeArr[0] ?? 0)
                      : 0
                  return (
                    <div key={chart.key} className={isLast ? '' : 'border-b border-border-micro/50'}>
                      <UPlotChart
                        title={chart.title}
                        timestamps={chart.timestamps}
                        series={chart.series}
                        height={dynamicHeight}
                        yRange={chart.yRange}
                        xRange={xMax > 0 ? [0, xMax] : undefined}
                        xLabel={isLast ? 'Distance' : ''}
                        xTickMode="distance"
                        xTickUnit="m"
                        yLabel={chart.yLabel}
                        yTickMode={chart.yTickMode}
                        yTickUnit={chart.yTickUnit}
                        markers={chart.markers}
                        stepped={chart.stepped}
                        shadingData={chart.shadingData}
                        frame={false}
                        showHeader={true}
                        annotations={chart.key === 'speed' ? chartData?.peaks : undefined}
                        onCursor={handleCursor(String(chart.key))}
                        playbackCursorRef={cursorFractionRef}
                        onSeek={handleSeek}
                      />
                    </div>
                  )
                })})()}
            </div>
            {(isLoading || String(loadingState) === 'loading') && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-border-hard bg-bg-panel/90 px-2 py-1 text-[10px] font-mono text-fg-muted">
                refreshing telemetry…
              </div>
            )}
          </div>
        ) : isLoading || String(loadingState) === 'loading' ? (
          <div className="flex h-full flex-col gap-2 p-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative overflow-hidden rounded-md border border-border bg-bg-surface p-3">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="mb-2 h-3 w-24 rounded bg-bg-inset" />
                <div className="h-32 w-full rounded-lg bg-bg-inset" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-hard bg-bg-surface">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-fg-muted">
                <path d="M3 3V21H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 14L12 9L16 13L21 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-[14px] font-semibold text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>
                {String(loadingState) === 'error' ? 'Error Loading Telemetry' : 'No Telemetry Available'}
              </div>
              <div className="mt-1 text-[11px] text-fg-muted font-mono">
                {String(loadingState) === 'error'
                  ? telemetryError || 'Failed to load telemetry data'
                  : String(loadingState) === 'loading'
                  ? `Loading overlay data for lap ${selectedLap}...`
                  : 'No telemetry stream for this lap yet'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
