import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { UPlotChart } from '../components/UPlotChart'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'
import { BoxPlotChart } from '../components/BoxPlotChart'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTelemetryStore } from '../stores/telemetryStore'
import { useFeaturesStore } from '../stores/featuresStore'
import { useTelemetryData } from '../hooks/useTelemetryData'
import { useSessionTime10 } from '../lib/timeUtils'
import { buildPaceSeries, median, movingAverage, PaceSeries } from '../lib/featuresUtils'
import type { LapRow, Driver } from '../types'

type AnalyticsTab = 'racepace' | 'telemetry'

interface BoxPlotData {
  label: string
  min: number
  q1: number
  median: number
  mean: number
  q3: number
  max: number
  outliers: number[]
  color: string
  meanTime: string
  tyreStrategy: string
}

const formatTime = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const secs = seconds.toFixed(3)
  return secs
}

const formatTimeFull = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--.---'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function validLap(lap: LapRow): boolean {
  const lapTime = getLapTimeSeconds(lap)
  return (
    lapTime >= 45 &&
    lapTime <= 200 &&
    lap.isDeleted !== true &&
    lap.isValid !== false
  )
}

function getLapTimeSeconds(lap: LapRow): number {
  const value = Number(
    lap.lapTime ??
    (lap as any).lapTimeSeconds ??
    (lap as any).lap_time_seconds ??
    0
  )
  return Number.isFinite(value) ? value : Number.NaN
}

export const AnalyticsView = React.memo(function AnalyticsView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const lapsFromStore = useSessionStore((s) => s.laps)
  
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  
  const telemetryStoreData = useTelemetryStore((s) => s.telemetryData)
  const loadTelemetry = useTelemetryStore((s) => s.loadTelemetry)
  
  const featuresStore = useFeaturesStore()
  const loadFeatures = featuresStore.loadFeatures
  
  const sessionTime = useSessionTime10()
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('racepace')
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeight, setPanelHeight] = useState(400)

  const laps = lapsFromStore.length ? lapsFromStore : sessionData?.laps ?? []
  const drivers = sessionData?.drivers ?? []
  const year = selectedYear ?? sessionData?.metadata?.year ?? 0
  const raceName = selectedRace ?? sessionData?.metadata?.raceName ?? ''
  const sessionType = selectedSession ?? sessionData?.metadata?.sessionType ?? ''

  useEffect(() => {
    if (year && raceName && sessionType) {
      loadFeatures(year, raceName, sessionType)
    }
  }, [year, raceName, sessionType, loadFeatures])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height || 0
      if (h > 0) setPanelHeight(Math.max(320, Math.floor(h) - 8))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const driverMap = useMemo(() => {
    const map = new Map<number, Driver>()
    for (const d of drivers) {
      map.set(d.driverNumber, d)
    }
    return map
  }, [drivers])

  const lapFeatures = featuresStore.lap
  const tyreFeatures = featuresStore.tyre

  const boxPlotData = useMemo((): BoxPlotData[] => {
    if (!lapFeatures?.length || !drivers.length) return []

    const validLaps = lapFeatures.filter((lap) => {
      const time = Number(lap.lap_time ?? lap.lapTime ?? 0)
      return Number.isFinite(time) && time > 40 && time < 200
    })

    if (!validLaps.length) return []

    const byDriver = new Map<string, LapRow[]>()
    for (const lap of validLaps) {
      const driver = driverMap.get(lap.driver_number)
      const code = driver?.code ?? String(lap.driver_name ?? lap.driver_number)
      const rows = byDriver.get(code) ?? []
      const lapRow: LapRow = {
        driverNumber: lap.driver_number,
        driverName: lap.driver_name,
        lapNumber: lap.lap_number,
        lapTime: lap.lap_time ?? 0,
        lapStartSeconds: 0,
        lapEndSeconds: 0,
        position: 0,
        tyreCompound: '',
        isDeleted: false,
        isValid: true,
      }
      rows.push(lapRow)
      byDriver.set(code, rows)
    }

    const results: BoxPlotData[] = []

    for (const [code, driverLaps] of byDriver) {
      const times = driverLaps.map((l) => getLapTimeSeconds(l)).filter((t) => Number.isFinite(t))
      if (times.length < 3) continue

      const smoothed = movingAverage(times, 3)
      const sorted = [...smoothed].sort((a, b) => a - b)
      
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const med = sorted[Math.floor(sorted.length * 0.5)]
      const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length
      const iqr = q3 - q1
      
      const lowerWhisker = Math.max(sorted[0], q1 - 1.5 * iqr)
      const upperWhisker = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr)
      
      const outliers = smoothed.filter((t) => t < q1 - 1.5 * iqr || t > q3 + 1.5 * iqr)

      const driver = drivers.find((d) => d.code === code)
      const color = driver?.teamColor ?? '#9fb3d4'

      const tyreStints = tyreFeatures?.filter(
        (t) => {
          const tDriver = driverMap.get(t.driver_number)
          return (tDriver?.code ?? String(t.driver_name ?? '')) === code
        }
      ).sort((a, b) => a.stint_number - b.stint_number) ?? []

      const tyreStrategy = tyreStints
        .map((s) => {
          const c = String(s.tyre_compound ?? '').toUpperCase()
          if (c.includes('SOFT')) return 'S'
          if (c.includes('MEDIUM')) return 'M'
          if (c.includes('HARD')) return 'H'
          if (c.includes('INTER')) return 'I'
          if (c.includes('WET')) return 'W'
          return '?'
        })
        .join('-')

      results.push({
        label: code,
        min: lowerWhisker,
        q1,
        median: med,
        mean,
        q3,
        max: upperWhisker,
        outliers: outliers.slice(0, 5),
        color,
        meanTime: formatTime(mean),
        tyreStrategy: tyreStrategy || '—',
      })
    }

    return results.sort((a, b) => a.mean - b.mean)
  }, [lapFeatures, drivers, driverMap, tyreFeatures])

  const paceSeries = useMemo((): PaceSeries[] => {
    if (!sessionData?.laps?.length || !drivers.length) return []
    return buildPaceSeries(sessionData)
  }, [sessionData, drivers])

  const paceChartSeries = useMemo(() => {
    return paceSeries.map((s) => ({
      label: s.code,
      data: s.laps.map((lap, i) => {
        const idx = s.laps.indexOf(lap)
        return idx >= 0 && s.smoothed[idx] ? s.smoothed[idx] : NaN
      }),
      color: s.color,
      width: 2,
    }))
  }, [paceSeries])

  const maxLap = useMemo(() => {
    if (!paceSeries.length) return 1
    return Math.max(...paceSeries.map((s) => Math.max(...s.laps)))
  }, [paceSeries])

  const windowedTelemetry = useMemo(() => {
    if (!primaryDriver || !telemetryStoreData) return null
    return null
  }, [primaryDriver, telemetryStoreData])

  const sessionTimeNum = Math.round(sessionTime * 30) / 30

  const {
    windowedTelemetry: telemetryData,
    lapTimeWindow,
  } = useTelemetryData(
    sessionTimeNum,
    1,
    primaryDriver,
    compareDriver
  )

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession || !primaryDriver || !lapTimeWindow) return
    loadTelemetry(selectedYear, selectedRace, selectedSession, lapTimeWindow.t0, lapTimeWindow.t1)
  }, [selectedYear, selectedRace, selectedSession, primaryDriver, lapTimeWindow, loadTelemetry])

  const telemetryDistance = telemetryData?.distance ?? []
  const telemetrySpeed = telemetryData?.speed ?? { primary: [], compare: [] }
  const telemetryThrottle = telemetryData?.throttle ?? { primary: [], compare: [] }
  const telemetryBrake = telemetryData?.brake ?? { primary: [], compare: [] }
  const telemetryGear = telemetryData?.gear ?? { primary: [], compare: [] }
  const telemetryLonAcc = telemetryData?.lonAcc ?? { primary: [], compare: [] }
  const telemetryLatAcc = telemetryData?.latAcc ?? { primary: [], compare: [] }

  const primaryDriverData = drivers.find((d) => d.code === primaryDriver)
  const compareDriverData = drivers.find((d) => d.code === compareDriver)

  const primaryColor = primaryDriverData?.teamColor ?? '#82cfff'
  const compareColor = compareDriverData?.teamColor ?? '#a6b0bf'

  const subtitle = useMemo(() => {
    if (!primaryDriver || !lapTimeWindow) return ''
    const compound = lapTimeWindow.lap?.tyreCompound ?? ''
    const time = lapTimeWindow.lap?.lapTime ?? 0
    let result = `${primaryDriver} (${compound}, ${formatTimeFull(time)})`
    if (compareDriver) {
      const cCompound = ''
      const cTime = 0
      result += ` vs ${compareDriver} (${cCompound}, ${formatTimeFull(cTime)})`
    }
    return result
  }, [primaryDriver, compareDriver, lapTimeWindow])

  const hasRacePaceData = boxPlotData.length > 0 || paceSeries.length > 0
  const hasTelemetryData = telemetryDistance.length > 0 && telemetrySpeed.primary.length > 0

  const isLoading = featuresStore.loading

  const renderRacePaceTab = () => {
    if (isLoading && !hasRacePaceData) {
      return (
        <div className="h-full flex items-center justify-center">
          <LoadingSkeleton rows={6} className="w-full max-w-md" />
        </div>
      )
    }

    if (!hasRacePaceData) {
      return (
        <EmptyState
          title="No race pace data"
          detail="Load a session with lap data to view race pace analysis."
          variant="muted"
        />
      )
    }

    const boxHeight = Math.round(panelHeight * 0.4)
    const lineHeight = panelHeight - boxHeight - 20

    return (
      <div className="flex flex-col gap-2 h-full">
        <div className="flex-shrink-0" style={{ height: boxHeight }}>
          <BoxPlotChart
            data={boxPlotData}
            height={boxHeight - 40}
            yLabel="Smoothed Laptime (s)"
            formatValue={formatTime}
          />
        </div>
        <div className="flex-1 min-h-0">
          <UPlotChart
            title="Race Pace"
            timestamps={paceSeries[0]?.laps ?? []}
            series={paceChartSeries}
            height={lineHeight}
            xRange={[0, maxLap]}
            xLabel="Lap"
            xTickMode="integer"
            yLabel="Laptime (s)"
            yTickMode="default"
            yTickUnit="s"
            frame={false}
            showHeader={false}
          />
        </div>
      </div>
    )
  }

  const renderTelemetryTab = () => {
    if (!primaryDriver) {
      return (
        <EmptyState
          title="No driver selected"
          detail="Select a primary driver to view telemetry comparison."
          variant="muted"
        />
      )
    }

    if (!hasTelemetryData) {
      return (
        <div className="h-full flex items-center justify-center">
          <LoadingSkeleton rows={8} className="w-full max-w-md" />
        </div>
      )
    }

    const chartHeight = Math.round((panelHeight - 60) / 6)

    return (
      <div className="flex flex-col gap-0.5 h-full overflow-auto">
        <UPlotChart
          title="Speed"
          subtitle={subtitle}
          timestamps={telemetryDistance}
          series={[
            { label: primaryDriver ?? 'Primary', data: telemetrySpeed.primary, color: primaryColor, width: 2 },
            ...(compareDriver && telemetrySpeed.compare.length
              ? [{ label: compareDriver, data: telemetrySpeed.compare, color: compareColor, width: 2 }]
              : [])
          ]}
          height={chartHeight}
          xTickMode="distance"
          xTickUnit="m"
          yLabel="km/h"
          yTickMode="integer"
          yTickUnit="km/h"
        />
        <UPlotChart
          title="Lon Acc"
          timestamps={telemetryDistance}
          series={[
            { label: primaryDriver ?? 'Primary', data: telemetryLonAcc.primary, color: primaryColor, width: 2 },
            ...(compareDriver && telemetryLonAcc.compare.length
              ? [{ label: compareDriver, data: telemetryLonAcc.compare, color: compareColor, width: 2 }]
              : [])
          ]}
          height={chartHeight}
          xTickMode="distance"
          xTickUnit="m"
          yLabel="g"
          yTickMode="default"
          yTickUnit="g"
        />
        <UPlotChart
          title="Lat Acc"
          timestamps={telemetryDistance}
          series={[
            { label: primaryDriver ?? 'Primary', data: telemetryLatAcc.primary, color: primaryColor, width: 2 },
            ...(compareDriver && telemetryLatAcc.compare.length
              ? [{ label: compareDriver, data: telemetryLatAcc.compare, color: compareColor, width: 2 }]
              : [])
          ]}
          height={chartHeight}
          xTickMode="distance"
          xTickUnit="m"
          yLabel="g"
          yTickMode="default"
          yTickUnit="g"
        />
        <UPlotChart
          title="Throttle"
          timestamps={telemetryDistance}
          series={[
            { label: primaryDriver ?? 'Primary', data: telemetryThrottle.primary, color: primaryColor, width: 2 },
            ...(compareDriver && telemetryThrottle.compare.length
              ? [{ label: compareDriver, data: telemetryThrottle.compare, color: compareColor, width: 2 }]
              : [])
          ]}
          height={chartHeight}
          xTickMode="distance"
          xTickUnit="m"
          yLabel="%"
          yTickMode="percent"
          yTickUnit="%"
        />
        <UPlotChart
          title="Brake"
          timestamps={telemetryDistance}
          series={[
            { label: primaryDriver ?? 'Primary', data: telemetryBrake.primary, color: primaryColor, width: 2 },
            ...(compareDriver && telemetryBrake.compare.length
              ? [{ label: compareDriver, data: telemetryBrake.compare, color: compareColor, width: 2 }]
              : [])
          ]}
          height={chartHeight}
          xTickMode="distance"
          xTickUnit="m"
          yLabel=""
          yTickMode="binary"
          stepped={true}
        />
        <UPlotChart
          title="Gear"
          timestamps={telemetryDistance}
          series={[
            { label: primaryDriver ?? 'Primary', data: telemetryGear.primary, color: primaryColor, width: 2 },
            ...(compareDriver && telemetryGear.compare.length
              ? [{ label: compareDriver, data: telemetryGear.compare, color: compareColor, width: 2 }]
              : [])
          ]}
          height={chartHeight}
          xTickMode="distance"
          xTickUnit="m"
          yLabel=""
          yTickMode="integer"
          stepped={true}
        />
      </div>
    )
  }

  const tabs: Array<{ key: AnalyticsTab; label: string }> = [
    { key: 'racepace', label: 'Race Pace' },
    { key: 'telemetry', label: 'Telemetry' },
  ]

  const sessionTitle = sessionData
    ? `${year} ${raceName} - ${sessionType}`
    : 'Analytics'

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="rounded-md border border-border bg-bg-surface px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary">Analytics</div>
          <div className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${activeTab === tab.key ? 'border-accent bg-accent/10 text-fg-primary' : 'border-border bg-bg-secondary text-fg-secondary'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-fg-muted">
          <span className="max-w-full truncate rounded-md border border-border bg-bg-inset px-2 py-0.5 font-mono" title={sessionTitle}>
            {sessionTitle}
          </span>
          <span className="rounded-md border border-border bg-bg-inset px-2 py-0.5 font-mono">
            Driver {primaryDriver || '-'} {compareDriver ? `| ${compareDriver}` : ''}
          </span>
        </div>
      </div>

      <div className="bg-bg-surface rounded-md border border-border flex-1 overflow-hidden">
        <div ref={panelRef} className="h-full w-full p-2.5">
          <ViewErrorBoundary viewName="Analytics Panel">
            {activeTab === 'racepace' ? renderRacePaceTab() : renderTelemetryTab()}
          </ViewErrorBoundary>
        </div>
      </div>
    </div>
  )
})

export default AnalyticsView
