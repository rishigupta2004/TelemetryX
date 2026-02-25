import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DriverSummary } from '../components/DriverSummary'
import { RacePaceLiteChart, SeasonStandingsLiteChart, StandingsHeatmapLiteChart } from '../components/FeaturesLiteCharts'
import { FiaAlertsStrip } from '../components/FiaAlertsStrip'
import { PitStrategy } from '../components/PitStrategy'
import { TrackMap } from '../components/TrackMap'
import { UndercutPredictor } from '../components/UndercutPredictor'
import { api } from '../api/client'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { FiaDocumentsView } from './FiaDocumentsView'
import type {
  ClusteringResponse,
  CircuitInsightsResponse,
  LapRow,
  PointsFeatureRow,
  Race,
  StrategyRecommendationItem,
  StrategyRecommendationsResponse
} from '../types'

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${(Number(value) * 100).toFixed(1)}%`
}

function formatSigned(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value > 0 ? '+' : ''}${Number(value).toFixed(digits)}`
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function strategyCandidates(seasonYears: number[], selectedYear: number): number[] {
  const fromStore = [...seasonYears].sort((a, b) => b - a).filter((year) => year < selectedYear)
  if (fromStore.length > 0) return fromStore

  const fallback: number[] = []
  for (let year = selectedYear - 1; year >= 2018; year -= 1) fallback.push(year)
  return fallback
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

function movingAverage(values: number[], windowSize = 3): number[] {
  const out: number[] = []
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1)
    const slice = values.slice(start, i + 1)
    const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length
    out.push(avg)
  }
  return out
}

function linearSlope(xs: number[], ys: number[]): number {
  if (xs.length < 2 || ys.length < 2 || xs.length !== ys.length) return 0
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) return 0
  return (n * sumXY - sumX * sumY) / denom
}

type PaceSeries = {
  code: string
  color: string
  laps: number[]
  times: number[]
  smoothed: number[]
  median: number
  slope: number
  latestPosition: number
  latestLap: number
}

type HoverTip = {
  x: number
  y: number
  title: string
  detail?: string
}

type SeasonStandingsDriver = {
  code: string
  totalPoints: number
  byRace: number[]
  cumulative: number[]
  color: string
}

type SeasonStandingsPayload = {
  raceNames: string[]
  drivers: SeasonStandingsDriver[]
}

type TyreStintRow = {
  code: string
  teamColor: string
  stints: Array<{ startLap: number; endLap: number; laps: number; compound: string }>
}

type FeaturePanelId =
  | 'overview'
  | 'race-pace'
  | 'lap-results'
  | 'strategy-ml'
  | 'clustering'
  | 'standings'
  | 'driver-intel'
  | 'undercut'
  | 'fia-docs'

const FEATURE_PANELS: Array<{ id: FeaturePanelId; label: string; hint: string }> = [
  { id: 'overview', label: 'Overview', hint: 'All critical widgets in one screen' },
  { id: 'race-pace', label: 'Race Pace', hint: 'Lap evolution and degradation' },
  { id: 'lap-results', label: 'Lap + Results', hint: 'Scatter, distribution, positions, team pace' },
  { id: 'strategy-ml', label: 'Strategy ML', hint: 'Scenario map and model ranking' },
  { id: 'clustering', label: 'Clustering', hint: 'Driver performance clusters' },
  { id: 'standings', label: 'Standings', hint: 'Season progression and points heatmap' },
  { id: 'driver-intel', label: 'Driver Intel', hint: 'Driver summary and pit timeline' },
  { id: 'undercut', label: 'Undercut', hint: 'Predictive undercut model panel' },
  { id: 'fia-docs', label: 'FIA Docs', hint: 'Official FIA documents analytics' }
]

const FEATURE_PANEL_IDS = new Set<FeaturePanelId>(FEATURE_PANELS.map((panel) => panel.id))
const OVERVIEW_SPOTLIGHT = FEATURE_PANELS.filter((panel) => panel.id !== 'overview')

function loadSavedPanel(key: string): FeaturePanelId | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return FEATURE_PANEL_IDS.has(raw as FeaturePanelId) ? (raw as FeaturePanelId) : null
  } catch {
    return null
  }
}

function savePanel(key: string, panel: FeaturePanelId): void {
  try {
    window.localStorage.setItem(key, panel)
  } catch {
    // ignore storage failures
  }
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * Math.max(0, Math.min(1, q))
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  const t = pos - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * t
}

function colorFromString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 75%, 58%)`
}

function tyreColor(compound: string): string {
  const c = String(compound || '').toUpperCase()
  if (c.includes('SOFT')) return '#ef4444'
  if (c.includes('MEDIUM')) return '#facc15'
  if (c.includes('HARD')) return '#f5f5f5'
  if (c.includes('INTER')) return '#22c55e'
  if (c.includes('WET')) return '#3b82f6'
  return '#9ca3af'
}

function buildTyreTimeline(
  laps: LapRow[],
  drivers: Array<{ code: string; driverNumber: number; teamColor: string }>
): TyreStintRow[] {
  if (!laps.length || !drivers.length) return []
  const byDriver = new Map<number, LapRow[]>()
  for (const lap of laps) {
    const rows = byDriver.get(lap.driverNumber) ?? []
    rows.push(lap)
    byDriver.set(lap.driverNumber, rows)
  }

  const out: TyreStintRow[] = []
  for (const driver of drivers) {
    const rows = (byDriver.get(driver.driverNumber) ?? [])
      .filter((row) => Number.isFinite(row.lapNumber) && row.lapNumber > 0)
      .sort((a, b) => a.lapNumber - b.lapNumber)
    if (!rows.length) continue

    const stints: TyreStintRow['stints'] = []
    let startLap = rows[0].lapNumber
    let prevLap = rows[0].lapNumber
    let compound = String(rows[0].tyreCompound || 'UNKNOWN')

    for (let i = 1; i < rows.length; i += 1) {
      const lap = rows[i]
      const lapNo = lap.lapNumber
      const comp = String(lap.tyreCompound || 'UNKNOWN')
      const contiguous = lapNo === prevLap + 1
      if (!contiguous || comp !== compound) {
        stints.push({
          startLap,
          endLap: prevLap,
          laps: prevLap - startLap + 1,
          compound,
        })
        startLap = lapNo
        compound = comp
      }
      prevLap = lapNo
    }

    stints.push({
      startLap,
      endLap: prevLap,
      laps: prevLap - startLap + 1,
      compound,
    })

    out.push({ code: driver.code, teamColor: driver.teamColor || '#8aa7d1', stints })
  }

  out.sort((a, b) => a.code.localeCompare(b.code))
  return out
}

function buildPaceSeries(sessionData: ReturnType<typeof useSessionStore.getState>['sessionData']): PaceSeries[] {
  if (!sessionData?.laps?.length || !sessionData?.drivers?.length) return []

  const numberToDriver = new Map<number, (typeof sessionData.drivers)[number]>()
  for (const driver of sessionData.drivers) {
    numberToDriver.set(driver.driverNumber, driver)
  }

  const buckets = new Map<string, LapRow[]>()
  for (const lap of sessionData.laps) {
    const driver = numberToDriver.get(lap.driverNumber)
    const code = driver?.code || String(lap.driverName || lap.driverNumber)
    if (!code) continue
    const lapTime = Number(lap.lapTime)
    if (!Number.isFinite(lapTime) || lapTime <= 40 || lapTime >= 200) continue
    const list = buckets.get(code) ?? []
    list.push(lap)
    buckets.set(code, list)
  }

  const series: PaceSeries[] = []
  for (const [code, rows] of buckets.entries()) {
    const sorted = [...rows].sort((a, b) => a.lapNumber - b.lapNumber)
    const laps = sorted.map((row) => row.lapNumber)
    const times = sorted.map((row) => Number(row.lapTime))
    const smoothed = movingAverage(times, 3)
    const refDriver = numberToDriver.get(sorted[0].driverNumber)

    const latest = sorted[sorted.length - 1]

    series.push({
      code,
      color: refDriver?.teamColor || '#8aa7d1',
      laps,
      times,
      smoothed,
      median: median(times),
      slope: linearSlope(laps, smoothed),
      latestPosition: Number.isFinite(latest.position) ? latest.position : 99,
      latestLap: latest.lapNumber
    })
  }

  return series.sort((a, b) => {
    if (a.latestPosition !== b.latestPosition) return a.latestPosition - b.latestPosition
    return a.median - b.median
  })
}

function toPath(
  xValues: number[],
  yValues: number[],
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  width: number,
  height: number
): string {
  if (xValues.length === 0 || yValues.length === 0 || xValues.length !== yValues.length) return ''
  const xSpan = Math.max(1, xMax - xMin)
  const ySpan = Math.max(0.001, yMax - yMin)

  const points = xValues.map((x, idx) => {
    const y = yValues[idx]
    const px = ((x - xMin) / xSpan) * width
    const py = height - ((y - yMin) / ySpan) * height
    return `${px.toFixed(2)},${py.toFixed(2)}`
  })

  return `M ${points.join(' L ')}`
}

export const FeaturesView = React.memo(function FeaturesView({ active }: { active: boolean }) {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const sessionData = useSessionStore((s) => s.sessionData)
  const seasons = useSessionStore((s) => s.seasons)
  const races = useSessionStore((s) => s.races)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)

  const [strategyData, setStrategyData] = useState<StrategyRecommendationsResponse | null>(null)
  const [strategySourceYear, setStrategySourceYear] = useState<number | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [strategyError, setStrategyError] = useState<string | null>(null)

  const [clusterData, setClusterData] = useState<ClusteringResponse | null>(null)
  const [clusterLoading, setClusterLoading] = useState(false)
  const [clusterError, setClusterError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<FeaturePanelId>('overview')
  const [lapScatterHover, setLapScatterHover] = useState<HoverTip | null>(null)
  const [positionHover, setPositionHover] = useState<HoverTip | null>(null)
  const [seasonStandings, setSeasonStandings] = useState<SeasonStandingsPayload | null>(null)
  const [seasonStandingsLoading, setSeasonStandingsLoading] = useState(false)
  const [seasonStandingsError, setSeasonStandingsError] = useState<string | null>(null)
  const [circuitInsights, setCircuitInsights] = useState<CircuitInsightsResponse | null>(null)
  const [publishReadiness, setPublishReadiness] = useState<Record<string, boolean | null>>({
    api: null,
    clustering: null,
    undercut: null,
    strategy: null
  })
  const [publishReadinessTs, setPublishReadinessTs] = useState<number | null>(null)
  const standingsCacheRef = useRef<Map<string, SeasonStandingsPayload>>(new Map())
  const readinessCacheRef = useRef<Map<string, Record<string, boolean | null>>>(new Map())
  const strategyCacheRef = useRef<
    Map<string, { data: StrategyRecommendationsResponse | null; sourceYear: number | null; error: string | null }>
  >(new Map())
  const clusteringCacheRef = useRef<ClusteringResponse | null>(null)

  const panelStorageKey = useMemo(
    () => `telemetryx.features.panel.${selectedYear || 'na'}.${selectedRace || 'na'}.${selectedSession || 'na'}`,
    [selectedYear, selectedRace, selectedSession]
  )

  useEffect(() => {
    const saved = loadSavedPanel(panelStorageKey)
    if (saved) {
      setActivePanel(saved)
      return
    }
    setActivePanel('overview')
  }, [panelStorageKey])

  useEffect(() => {
    savePanel(panelStorageKey, activePanel)
  }, [panelStorageKey, activePanel])

  const fallbackYears = useMemo(() => {
    if (!selectedYear) return []
    return strategyCandidates(seasons.map((season) => season.year), selectedYear)
  }, [seasons, selectedYear])

  useEffect(() => {
    const readinessKey = `${selectedYear || 'na'}|${selectedRace || 'na'}`
    const cached = readinessCacheRef.current.get(readinessKey)
    if (cached) {
      setPublishReadiness(cached)
      setPublishReadinessTs(Date.now())
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      const run = async () => {
        const checks = await Promise.allSettled([
          api.getHealth(),
          api.getClustering(false),
          api.getUndercutSummary()
        ])
        if (cancelled) return
        const next = {
          api: checks[0].status === 'fulfilled',
          clustering: checks[1].status === 'fulfilled',
          undercut: checks[2].status === 'fulfilled',
          strategy: null
        }
        readinessCacheRef.current.set(readinessKey, next)
        setPublishReadiness(next)
        setPublishReadinessTs(Date.now())
      }
      void run()
    }, 60)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [selectedYear, selectedRace, fallbackYears])

  useEffect(() => {
    if (!active) return
    if (!selectedYear || !selectedRace) {
      setStrategyData(null)
      setStrategySourceYear(null)
      setStrategyError(null)
      return
    }

    let cancelled = false
    const strategyKey = `${selectedYear}|${selectedRace}|${fallbackYears.join(',')}`
    const cached = strategyCacheRef.current.get(strategyKey)
    if (cached) {
      setStrategyData(cached.data)
      setStrategySourceYear(cached.sourceYear)
      setStrategyLoading(false)
      setStrategyError(cached.error)
      return
    }
    setStrategyLoading(true)
    setStrategyError(null)
    setStrategyData(null)
    setStrategySourceYear(null)

    api
      .getStrategyRecommendationsWithFallback(selectedYear, selectedRace, fallbackYears)
      .then(({ data, sourceYear }) => {
        if (cancelled) return
        strategyCacheRef.current.set(strategyKey, { data, sourceYear, error: null })
        setStrategyData(data)
        setStrategySourceYear(sourceYear)
      })
      .catch((err) => {
        if (cancelled) return
        const message = String(err)
        setStrategyData(null)
        setStrategySourceYear(null)
        setStrategyError(message)
        strategyCacheRef.current.set(strategyKey, { data: null, sourceYear: null, error: message })
      })
      .finally(() => {
        if (!cancelled) setStrategyLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [active, selectedYear, selectedRace, fallbackYears])

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession) {
      setClusterData(null)
      setClusterLoading(false)
      setClusterError(null)
      return
    }

    let cancelled = false
    if (clusteringCacheRef.current) {
      setClusterData(clusteringCacheRef.current)
      setClusterLoading(false)
      setClusterError(null)
      return
    }
    setClusterLoading(true)
    setClusterError(null)
    setClusterData(null)

    api
      .getClustering(true)
      .then((payload) => {
        if (!cancelled) {
          clusteringCacheRef.current = payload
          setClusterData(payload)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setClusterData(null)
          setClusterError(String(err))
        }
      })
      .finally(() => {
        if (!cancelled) setClusterLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedRace, selectedSession])

  const topStrategies = useMemo(() => {
    if (!strategyData?.all_strategies) return []
    return Object.values(strategyData.all_strategies)
      .filter((item): item is StrategyRecommendationItem => !!item && Number.isFinite(item.avg_points))
      .sort((a, b) => b.avg_points - a.avg_points)
      .slice(0, 10)
  }, [strategyData])

  const racePaceSeries = useMemo(() => buildPaceSeries(sessionData), [sessionData])

  const visibleRacePaceSeries = useMemo(() => {
    const top = racePaceSeries.slice(0, 8)
    const byCode = new Map(top.map((item) => [item.code, item]))
    if (primaryDriver && !byCode.has(primaryDriver)) {
      const found = racePaceSeries.find((item) => item.code === primaryDriver)
      if (found) top.push(found)
    }
    if (compareDriver && !byCode.has(compareDriver)) {
      const found = racePaceSeries.find((item) => item.code === compareDriver)
      if (found) top.push(found)
    }
    return top
  }, [racePaceSeries, primaryDriver, compareDriver])

  const paceBounds = useMemo(() => {
    const laps = visibleRacePaceSeries.flatMap((item) => item.laps)
    const values = visibleRacePaceSeries.flatMap((item) => item.smoothed)
    const xMin = laps.length ? Math.min(...laps) : 1
    const xMax = laps.length ? Math.max(...laps) : 60
    const yMinRaw = values.length ? Math.min(...values) : 85
    const yMaxRaw = values.length ? Math.max(...values) : 95
    return {
      xMin,
      xMax,
      yMin: Math.floor(yMinRaw - 0.6),
      yMax: Math.ceil(yMaxRaw + 0.6)
    }
  }, [visibleRacePaceSeries])

  const paceHighlights = useMemo(() => {
    if (!racePaceSeries.length) {
      return {
        bestMedian: null as PaceSeries | null,
        mostDeg: null as PaceSeries | null
      }
    }

    const bestMedian = [...racePaceSeries].sort((a, b) => a.median - b.median)[0]
    const mostDeg = [...racePaceSeries].sort((a, b) => b.slope - a.slope)[0]
    return { bestMedian, mostDeg }
  }, [racePaceSeries])

  const weatherSnapshot = useMemo(() => {
    const weather = sessionData?.weather ?? []
    if (!weather.length) return null
    return weather[weather.length - 1]
  }, [sessionData?.weather])

  const trackOverview = useMemo(() => {
    const geo = sessionData?.trackGeometry
    if (!geo) return null
    return {
      name: geo.name || 'Track',
      country: geo.country || '-',
      layoutYear: geo.layoutYear ?? null,
      source: geo.source || '-',
      corners: Array.isArray(geo.corners) ? geo.corners.length : 0,
      sectors: Array.isArray(geo.sectors) ? geo.sectors.length : 0,
      drsZones: Array.isArray(geo.drsZones) ? geo.drsZones.length : 0,
      trackWidth: geo.trackWidth ?? null
    }
  }, [sessionData?.trackGeometry])

  const strategyExtents = useMemo(() => {
    const finish = topStrategies.map((item) => item.avg_finish_position)
    const points = topStrategies.map((item) => item.avg_points)
    return {
      finishMin: finish.length ? Math.min(...finish) : 1,
      finishMax: finish.length ? Math.max(...finish) : 20,
      pointsMin: points.length ? Math.min(...points) : 0,
      pointsMax: points.length ? Math.max(...points) : 25
    }
  }, [topStrategies])

  const sessionDriverSet = useMemo(() => {
    const set = new Set<string>()
    for (const driver of sessionData?.drivers ?? []) {
      if (driver.driverName) set.add(normalizeName(driver.driverName))
      if (driver.code) set.add(normalizeName(driver.code))
    }
    return set
  }, [sessionData?.drivers])

  const clustersById = useMemo(() => {
    const map = new Map<number, Array<{ name: string; inSession: boolean; prob: number }>>()
    for (const row of clusterData?.clusters ?? []) {
      const cluster = Number(row.cluster)
      const list = map.get(cluster) ?? []
      const name = row.driver_name
      const inSession = sessionDriverSet.has(normalizeName(name))
      const probs = row.probabilities || {}
      const prob = Number(probs[cluster] ?? 0)
      list.push({ name, inSession, prob: Number.isFinite(prob) ? prob : 0 })
      map.set(cluster, list)
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([clusterId, drivers]) => {
        const sortedDrivers = [...drivers].sort((a, b) => b.prob - a.prob)
        return {
          clusterId,
          totalCount: drivers.length,
          sessionCount: drivers.filter((item) => item.inSession).length,
          topDrivers: sortedDrivers.slice(0, 4)
        }
      })
  }, [clusterData, sessionDriverSet])

  const driverByCode = useMemo(() => {
    const map = new Map<string, (typeof sessionData.drivers)[number]>()
    for (const driver of sessionData?.drivers ?? []) map.set(driver.code, driver)
    return map
  }, [sessionData?.drivers])

  const lapScatterSeries = useMemo(() => {
    const base = racePaceSeries.slice(0, 12)
    const map = new Map(base.map((item) => [item.code, item]))
    if (primaryDriver && !map.has(primaryDriver)) {
      const found = racePaceSeries.find((item) => item.code === primaryDriver)
      if (found) map.set(found.code, found)
    }
    if (compareDriver && !map.has(compareDriver)) {
      const found = racePaceSeries.find((item) => item.code === compareDriver)
      if (found) map.set(found.code, found)
    }
    return Array.from(map.values())
  }, [racePaceSeries, primaryDriver, compareDriver])

  const lapScatterBounds = useMemo(() => {
    const laps = lapScatterSeries.flatMap((item) => item.laps)
    const times = lapScatterSeries.flatMap((item) => item.times)
    return {
      xMin: laps.length ? Math.min(...laps) : 1,
      xMax: laps.length ? Math.max(...laps) : 60,
      yMin: times.length ? Math.floor(Math.min(...times) - 0.5) : 85,
      yMax: times.length ? Math.ceil(Math.max(...times) + 0.5) : 95
    }
  }, [lapScatterSeries])

  const lapDistributions = useMemo(() => {
    return lapScatterSeries.map((series) => {
      const values = [...series.times].sort((a, b) => a - b)
      return {
        code: series.code,
        color: series.color,
        p10: quantile(values, 0.1),
        q1: quantile(values, 0.25),
        median: quantile(values, 0.5),
        q3: quantile(values, 0.75),
        p90: quantile(values, 0.9)
      }
    })
  }, [lapScatterSeries])

  const positionTraces = useMemo(() => {
    const drivers = sessionData?.drivers ?? []
    const laps = sessionData?.laps ?? []
    if (!drivers.length || !laps.length) return []

    const driverByNumber = new Map(drivers.map((driver) => [driver.driverNumber, driver]))
    const byDriverLap = new Map<string, Map<number, number>>()

    for (const lap of laps) {
      const driver = driverByNumber.get(lap.driverNumber)
      const code = driver?.code || String(lap.driverName || lap.driverNumber)
      if (!code) continue
      const lapNo = Number(lap.lapNumber)
      const pos = Number(lap.position)
      if (!Number.isFinite(lapNo) || !Number.isFinite(pos) || lapNo <= 0 || pos <= 0) continue
      const lapMap = byDriverLap.get(code) ?? new Map<number, number>()
      lapMap.set(lapNo, pos)
      byDriverLap.set(code, lapMap)
    }

    const traces = Array.from(byDriverLap.entries())
      .map(([code, lapMap]) => {
        const points = Array.from(lapMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([lap, position]) => ({ lap, position }))
        const latestPosition = points[points.length - 1]?.position ?? 99
        const driver = driverByCode.get(code)
        return {
          code,
          color: driver?.teamColor || colorFromString(code),
          points,
          latestPosition
        }
      })
      .filter((trace) => trace.points.length > 1)
      .sort((a, b) => a.latestPosition - b.latestPosition)

    return traces.slice(0, 12)
  }, [sessionData?.drivers, sessionData?.laps, driverByCode])

  const positionTraceBounds = useMemo(() => {
    const laps = positionTraces.flatMap((trace) => trace.points.map((p) => p.lap))
    const positions = positionTraces.flatMap((trace) => trace.points.map((p) => p.position))
    return {
      xMin: laps.length ? Math.min(...laps) : 1,
      xMax: laps.length ? Math.max(...laps) : 60,
      yMin: positions.length ? Math.min(...positions) : 1,
      yMax: positions.length ? Math.max(...positions) : 20
    }
  }, [positionTraces])

  const teamPaceRows = useMemo(() => {
    const byTeam = new Map<string, { times: number[]; color: string }>()
    for (const series of racePaceSeries) {
      const driver = driverByCode.get(series.code)
      const team = driver?.teamName || 'Unknown'
      const entry = byTeam.get(team) ?? { times: [], color: driver?.teamColor || colorFromString(team) }
      entry.times.push(...series.times)
      byTeam.set(team, entry)
    }

    const rows = Array.from(byTeam.entries())
      .map(([team, data]) => ({
        team,
        color: data.color,
        medianLap: median(data.times)
      }))
      .filter((row) => Number.isFinite(row.medianLap) && row.medianLap > 0)
      .sort((a, b) => a.medianLap - b.medianLap)

    const leader = rows[0]?.medianLap ?? null
    return rows.map((row) => ({
      ...row,
      delta: leader != null ? row.medianLap - leader : 0
    }))
  }, [racePaceSeries, driverByCode])

  const qualifyingRows = useMemo(() => {
    const laps = sessionData?.laps ?? []
    const drivers = sessionData?.drivers ?? []
    const driverByNumber = new Map(drivers.map((driver) => [driver.driverNumber, driver]))
    const bestByDriver = new Map<number, number>()

    for (const lap of laps) {
      const lapTime = Number(lap.lapTime)
      if (!Number.isFinite(lapTime) || lapTime <= 0 || lapTime > 200) continue
      if (lap.isDeleted || lap.isValid === false) continue
      const prev = bestByDriver.get(lap.driverNumber)
      if (prev == null || lapTime < prev) bestByDriver.set(lap.driverNumber, lapTime)
    }

    const rows = Array.from(bestByDriver.entries())
      .map(([driverNumber, bestLap]) => {
        const driver = driverByNumber.get(driverNumber)
        const code = driver?.code || String(driverNumber)
        return {
          code,
          bestLap,
          color: driver?.teamColor || colorFromString(code)
        }
      })
      .sort((a, b) => a.bestLap - b.bestLap)

    const pole = rows[0]?.bestLap ?? null
    return rows.map((row, idx) => ({
      ...row,
      rank: idx + 1,
      delta: pole != null ? row.bestLap - pole : 0
    }))
  }, [sessionData?.laps, sessionData?.drivers])

  const orderedRaces = useMemo(() => {
    return [...(races as Race[])].sort((a, b) => {
      const at = new Date(a.startDate || 0).getTime()
      const bt = new Date(b.startDate || 0).getTime()
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt
      return a.name.localeCompare(b.name)
    })
  }, [races])

  useEffect(() => {
    if (activePanel !== 'standings') return
    if (!selectedYear || orderedRaces.length === 0) {
      setSeasonStandings(null)
      setSeasonStandingsError(null)
      setSeasonStandingsLoading(false)
      return
    }

    const cacheKey = `${selectedYear}:${orderedRaces.map((race) => race.name).join('|')}`
    const cached = standingsCacheRef.current.get(cacheKey)
    if (cached) {
      setSeasonStandings(cached)
      setSeasonStandingsError(null)
      setSeasonStandingsLoading(false)
      return
    }

    let cancelled = false
    setSeasonStandingsLoading(true)
    setSeasonStandingsError(null)
    setSeasonStandings(null)

    Promise.all(
      orderedRaces.map(async (race) => {
        try {
          const rows = await api.getPointsFeatures(selectedYear, race.name, 'R')
          return { race: race.name, rows }
        } catch {
          return { race: race.name, rows: [] as PointsFeatureRow[] }
        }
      })
    )
      .then((results) => {
        if (cancelled) return
        const raceNames = results.map((item) => item.race)
        const driverMap = new Map<string, { code: string; byRace: number[]; totalPoints: number; color: string }>()

        results.forEach((result, idx) => {
          for (const row of result.rows) {
            const code = String(row.driver_name || '').trim().toUpperCase()
            if (!code) continue
            const points = Number(row.points)
            if (!Number.isFinite(points)) continue
            const color = driverByCode.get(code)?.teamColor || colorFromString(code)
            const entry = driverMap.get(code) ?? {
              code,
              byRace: new Array(raceNames.length).fill(0),
              totalPoints: 0,
              color
            }
            entry.byRace[idx] += points
            entry.totalPoints += points
            driverMap.set(code, entry)
          }
        })

        const drivers: SeasonStandingsDriver[] = Array.from(driverMap.values())
          .map((driver) => {
            let sum = 0
            const cumulative = driver.byRace.map((points) => {
              sum += points
              return sum
            })
            return {
              code: driver.code,
              totalPoints: driver.totalPoints,
              byRace: driver.byRace,
              cumulative,
              color: driver.color
            }
          })
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .slice(0, 20)

        const payload: SeasonStandingsPayload = { raceNames, drivers }
        standingsCacheRef.current.set(cacheKey, payload)
        setSeasonStandings(payload)
      })
      .catch((err) => {
        if (cancelled) return
        setSeasonStandings(null)
        setSeasonStandingsError(String(err))
      })
      .finally(() => {
        if (!cancelled) setSeasonStandingsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activePanel, selectedYear, orderedRaces, driverByCode])

  useEffect(() => {
    if (activePanel !== 'race-pace' || !selectedYear || !selectedRace) return
    let cancelled = false
    api
      .getCircuitInsights(selectedYear, selectedRace)
      .then((payload) => {
        if (!cancelled) setCircuitInsights(payload)
      })
      .catch(() => {
        if (!cancelled) setCircuitInsights(null)
      })
    return () => {
      cancelled = true
    }
  }, [activePanel, selectedYear, selectedRace])

  const topSeasonStandings = useMemo(() => seasonStandings?.drivers.slice(0, 10) ?? [], [seasonStandings])

  const standingsMaxPoints = useMemo(() => {
    if (!topSeasonStandings.length) return 1
    return Math.max(1, ...topSeasonStandings.map((driver) => driver.totalPoints))
  }, [topSeasonStandings])

  const tyreTimelineRows = useMemo(
    () =>
      buildTyreTimeline(
        sessionData?.laps ?? [],
        (sessionData?.drivers ?? []).map((driver) => ({
          code: driver.code,
          driverNumber: driver.driverNumber,
          teamColor: driver.teamColor,
        }))
      ),
    [sessionData?.laps, sessionData?.drivers]
  )

  const tyreTimelineMaxLap = useMemo(() => {
    let maxLap = 1
    for (const row of tyreTimelineRows) {
      for (const stint of row.stints) {
        maxLap = Math.max(maxLap, stint.endLap)
      }
    }
    return maxLap
  }, [tyreTimelineRows])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Compact header with horizontal pill tab bar ── */}
      <div
        className="flex flex-shrink-0 flex-col gap-2 px-4 pt-3 pb-2.5"
        style={{
          background: 'rgba(2,4,8,0.7)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Features + ML
          </div>
          <div
            className="px-2.5 py-1 text-[10px] font-mono text-text-muted rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {selectedYear || '-'} · {selectedRace || '-'} · {selectedSession || '-'}
          </div>
        </div>

        {/* Pill tab bar */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {FEATURE_PANELS.map((panel) => {
            const active = activePanel === panel.id
            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => setActivePanel(panel.id)}
                title={panel.hint}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                  active
                    ? 'text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                style={
                  active
                    ? {
                        background: 'rgba(255,255,255,0.16)',
                        border: '1px solid rgba(255,255,255,0.24)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)',
                        backdropFilter: 'blur(12px)',
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid transparent',
                      }
                }
              >
                {panel.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-[1600px] space-y-5">

          {activePanel === 'overview' && (
            <section className="space-y-4 glass-panel p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Overview</div>
                <div className="text-[11px] text-text-muted">
                  Pick a workspace from the tab bar above to focus on one model surface at a time.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-text-primary">Track map + corner/sector styling</div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-text-primary">Driver lap scatter + distribution analysis</div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-text-primary">Position changes + team pace deltas</div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-text-primary">Strategy scenarios + undercut outcomes</div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-text-primary">Season standings progression heatmap</div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-text-primary">Telemetry overlays across speed/throttle/brake/gear/DRS</div>
              </div>
            </section>
          )}

          {activePanel === 'race-pace' && (
            <section className="glass-panel p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Track Intelligence Map</div>
                  <div className="text-[11px] text-text-muted">
                    Live map is now inside Features workspace: click for primary, Ctrl/Cmd+click for compare
                  </div>
                </div>
                <div className="rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-muted">
                  {trackOverview?.name || 'Track not available'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.25fr_0.75fr]">
                <div className="h-[500px] min-h-[420px] rounded border border-border bg-black">
                  <TrackMap />
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">Corners</div>
                      <div className="font-mono text-sm text-text-primary">{trackOverview?.corners ?? '-'}</div>
                    </div>
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">DRS Zones</div>
                      <div className="font-mono text-sm text-text-primary">{trackOverview?.drsZones ?? '-'}</div>
                    </div>
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">Sectors</div>
                      <div className="font-mono text-sm text-text-primary">{trackOverview?.sectors ?? '-'}</div>
                    </div>
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">Track Width</div>
                      <div className="font-mono text-sm text-text-primary">
                        {trackOverview?.trackWidth != null ? `${trackOverview.trackWidth.toFixed(1)} m` : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded border border-border bg-bg-secondary p-2 text-xs">
                    <div className="mb-1 text-[10px] uppercase text-text-muted">Context</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <span className="text-text-muted">Country</span>
                      <span className="font-mono text-text-primary">{trackOverview?.country || '-'}</span>
                      <span className="text-text-muted">Layout Year</span>
                      <span className="font-mono text-text-primary">{trackOverview?.layoutYear ?? '-'}</span>
                      <span className="text-text-muted">Geometry Source</span>
                      <span className="truncate font-mono text-text-primary">{trackOverview?.source || '-'}</span>
                      <span className="text-text-muted">Primary</span>
                      <span className="font-mono text-text-primary">{primaryDriver || '-'}</span>
                      <span className="text-text-muted">Compare</span>
                      <span className="font-mono text-text-primary">{compareDriver || '-'}</span>
                    </div>
                  </div>

                  {circuitInsights && (
                    <div className="rounded border border-border bg-bg-secondary p-2 text-xs">
                      <div className="mb-1 text-[10px] uppercase text-text-muted">Circuit Facts</div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-text-muted">Length</span>
                        <span className="font-mono text-text-primary">{circuitInsights.facts['Circuit Length'] || '-'}</span>
                        <span className="text-text-muted">Race Distance</span>
                        <span className="font-mono text-text-primary">{circuitInsights.facts['Race Distance'] || '-'}</span>
                        <span className="text-text-muted">Laps</span>
                        <span className="font-mono text-text-primary">{circuitInsights.facts['Number of Laps'] || '-'}</span>
                        <span className="text-text-muted">First GP</span>
                        <span className="font-mono text-text-primary">{circuitInsights.facts['First Grand Prix'] || '-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activePanel === 'race-pace' && (
            <section className="glass-panel p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Race Pace Explorer</div>
                  <div className="text-[11px] text-text-muted">Smoothed lap-time evolution (3-lap rolling) with degradation trend</div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                  {weatherSnapshot && (
                    <span className="rounded border border-border bg-bg-secondary px-2 py-0.5">
                      Air {weatherSnapshot.airTemp.toFixed(1)}C | Track {weatherSnapshot.trackTemp.toFixed(1)}C
                    </span>
                  )}
                  <span className="rounded border border-border bg-bg-secondary px-2 py-0.5">
                    Drivers {visibleRacePaceSeries.length}
                  </span>
                  <span className="rounded border border-border bg-bg-secondary px-2 py-0.5">
                    Lap {paceBounds.xMin}-{paceBounds.xMax}
                  </span>
                </div>
              </div>

              {visibleRacePaceSeries.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-text-muted">
                  No lap-time race pace data available for this session
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded border border-border bg-bg-card p-2.5">
                    <RacePaceLiteChart
                      series={visibleRacePaceSeries.map((item) => ({
                        code: item.code,
                        color: item.color,
                        laps: item.laps,
                        smoothed: item.smoothed,
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-border bg-bg-secondary p-2">
                        <div className="text-[10px] uppercase text-text-muted">Best Race Pace</div>
                        <div className="font-mono text-sm text-text-primary">{paceHighlights.bestMedian?.code || '-'}</div>
                        <div className="text-[11px] text-text-muted">median {paceHighlights.bestMedian?.median?.toFixed(3) ?? '-'}s</div>
                      </div>
                      <div className="rounded border border-border bg-bg-secondary p-2">
                        <div className="text-[10px] uppercase text-text-muted">Highest Degradation</div>
                        <div className="font-mono text-sm text-text-primary">{paceHighlights.mostDeg?.code || '-'}</div>
                        <div className="text-[11px] text-text-muted">slope {formatSigned(paceHighlights.mostDeg?.slope, 3)} s/lap</div>
                      </div>
                    </div>

                    <div className="space-y-1 overflow-y-auto rounded border border-border bg-bg-secondary p-2 text-xs">
                      {visibleRacePaceSeries.map((item) => {
                        const highlighted = item.code === primaryDriver || item.code === compareDriver
                        return (
                          <div key={item.code} className={`rounded px-2 py-1 ${highlighted ? 'bg-bg-card' : ''}`}>
                            <div className="mb-0.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="font-mono text-text-primary">{item.code}</span>
                              </div>
                              <span className="font-mono text-[10px] text-text-muted">P{item.latestPosition}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-[10px] text-text-muted">
                              <span>Median {item.median.toFixed(3)}s</span>
                              <span>Trend {formatSigned(item.slope, 3)}</span>
                              <span>Laps {item.laps.length}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activePanel === 'lap-results' && (
            <section className="space-y-3 glass-panel p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Lap + Results Analytics</div>
                <div className="text-[11px] text-text-muted">
                  FastF1-style lap scatter, lap distribution, position traces, team pace, and qualifying overview with hover inspection
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded border border-border bg-bg-card p-2.5">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Driver Laptimes Scatterplot</div>
                  <svg viewBox="0 0 1000 340" className="h-[340px] w-full">
                    {lapScatterSeries.flatMap((series) =>
                      series.laps.map((lap, idx) => {
                        const xSpan = Math.max(1, lapScatterBounds.xMax - lapScatterBounds.xMin)
                        const ySpan = Math.max(0.001, lapScatterBounds.yMax - lapScatterBounds.yMin)
                        const x = 52 + ((lap - lapScatterBounds.xMin) / xSpan) * 920
                        const y = 304 - ((series.times[idx] - lapScatterBounds.yMin) / ySpan) * 260
                        const highlighted = series.code === primaryDriver || series.code === compareDriver
                        return (
                          <circle
                            key={`${series.code}-${lap}-${idx}`}
                            cx={x}
                            cy={y}
                            r={highlighted ? 3.8 : 2.6}
                            fill={series.color}
                            fillOpacity={highlighted ? 0.95 : 0.72}
                            onMouseEnter={() =>
                              setLapScatterHover({
                                x,
                                y,
                                title: `${series.code} L${lap}`,
                                detail: `${series.times[idx].toFixed(3)}s`
                              })
                            }
                            onMouseLeave={() => setLapScatterHover(null)}
                          />
                        )
                      })
                    )}

                    <line x1={52} y1={304} x2={972} y2={304} stroke="rgba(132,160,200,0.35)" />
                    <line x1={52} y1={24} x2={52} y2={304} stroke="rgba(132,160,200,0.35)" />
                    <text x={56} y={18} fill="#9ab4d9" fontSize="10">Lap Time (s)</text>
                    <text x={936} y={332} fill="#9ab4d9" fontSize="10">Lap</text>

                    {lapScatterHover && (
                      <g transform={`translate(${Math.min(820, lapScatterHover.x + 12)} ${Math.max(30, lapScatterHover.y - 30)})`}>
                        <rect width={160} height={34} rx={6} fill="#0a1a35" stroke="#5e82b8" />
                        <text x={8} y={14} fill="#e2eeff" fontSize="10" fontFamily="monospace">{lapScatterHover.title}</text>
                        <text x={8} y={27} fill="#b8cce9" fontSize="10" fontFamily="monospace">{lapScatterHover.detail}</text>
                      </g>
                    )}
                  </svg>
                </div>

                <div className="rounded border border-border bg-bg-secondary p-2.5">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Lap Time Distribution</div>
                  <div className="space-y-1.5">
                    {lapDistributions.map((row) => {
                      const span = Math.max(0.001, lapScatterBounds.yMax - lapScatterBounds.yMin)
                      const l10 = ((row.p10 - lapScatterBounds.yMin) / span) * 100
                      const lq1 = ((row.q1 - lapScatterBounds.yMin) / span) * 100
                      const lq3 = ((row.q3 - lapScatterBounds.yMin) / span) * 100
                      const l90 = ((row.p90 - lapScatterBounds.yMin) / span) * 100
                      const lmed = ((row.median - lapScatterBounds.yMin) / span) * 100
                      return (
                        <div key={`dist-${row.code}`} className="grid grid-cols-[52px_1fr_58px] items-center gap-2 text-[10px]">
                          <span className="font-mono text-text-primary">{row.code}</span>
                          <div className="relative h-4 rounded bg-bg-card">
                            <div className="absolute left-0 right-0 top-1/2 h-[1px] -translate-y-1/2 bg-border" />
                            <div className="absolute top-1/2 h-[2px] -translate-y-1/2" style={{ left: `${l10}%`, width: `${Math.max(1, l90 - l10)}%`, backgroundColor: row.color }} />
                            <div
                              className="absolute top-[2px] h-[10px] rounded border border-white/40"
                              style={{ left: `${lq1}%`, width: `${Math.max(1, lq3 - lq1)}%`, backgroundColor: `${row.color}55` }}
                              onMouseEnter={() =>
                                setLapScatterHover({
                                  x: 700,
                                  y: 40,
                                  title: `${row.code} distribution`,
                                  detail: `P10 ${row.p10.toFixed(3)} | P50 ${row.median.toFixed(3)} | P90 ${row.p90.toFixed(3)}`
                                })
                              }
                              onMouseLeave={() => setLapScatterHover(null)}
                            />
                            <div className="absolute top-[1px] h-3 w-[2px] bg-white" style={{ left: `${lmed}%` }} />
                          </div>
                          <span className="font-mono text-right text-text-muted">{row.median.toFixed(3)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded border border-border bg-bg-card p-2.5">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Position Changes During Race</div>
                  <svg viewBox="0 0 1000 340" className="h-[340px] w-full">
                    {positionTraces.map((trace) => {
                      const xSpan = Math.max(1, positionTraceBounds.xMax - positionTraceBounds.xMin)
                      const ySpan = Math.max(1, positionTraceBounds.yMax - positionTraceBounds.yMin)
                      const points = trace.points.map((point) => {
                        const x = 52 + ((point.lap - positionTraceBounds.xMin) / xSpan) * 920
                        const y = 304 - ((point.position - positionTraceBounds.yMin) / ySpan) * 260
                        return { x, y, lap: point.lap, position: point.position }
                      })
                      const path = points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
                      return (
                        <g key={`pos-${trace.code}`}>
                          <path d={path} fill="none" stroke={trace.color} strokeWidth={2} opacity={0.88} />
                          {points.map((point) => (
                            <circle
                              key={`${trace.code}-${point.lap}`}
                              cx={point.x}
                              cy={point.y}
                              r={2.4}
                              fill={trace.color}
                              onMouseEnter={() =>
                                setPositionHover({
                                  x: point.x,
                                  y: point.y,
                                  title: `${trace.code} | Lap ${point.lap}`,
                                  detail: `Position P${point.position}`
                                })
                              }
                              onMouseLeave={() => setPositionHover(null)}
                            />
                          ))}
                        </g>
                      )
                    })}

                    <line x1={52} y1={304} x2={972} y2={304} stroke="rgba(132,160,200,0.35)" />
                    <line x1={52} y1={24} x2={52} y2={304} stroke="rgba(132,160,200,0.35)" />
                    <text x={56} y={18} fill="#9ab4d9" fontSize="10">Position</text>
                    <text x={936} y={332} fill="#9ab4d9" fontSize="10">Lap</text>
                    {positionHover && (
                      <g transform={`translate(${Math.min(820, positionHover.x + 10)} ${Math.max(30, positionHover.y - 28)})`}>
                        <rect width={172} height={34} rx={6} fill="#0a1a35" stroke="#5e82b8" />
                        <text x={8} y={14} fill="#e2eeff" fontSize="10" fontFamily="monospace">{positionHover.title}</text>
                        <text x={8} y={27} fill="#b8cce9" fontSize="10" fontFamily="monospace">{positionHover.detail}</text>
                      </g>
                    )}
                  </svg>
                </div>

                <div className="space-y-3">
                  <div className="rounded border border-border bg-bg-secondary p-2.5">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Team Pace Comparison</div>
                    <div className="space-y-1.5 text-xs">
                      {teamPaceRows.map((row) => (
                        <div key={`team-${row.team}`} className="grid grid-cols-[108px_1fr_86px] items-center gap-2">
                          <span className="truncate text-[11px] text-text-primary">{row.team}</span>
                          <div className="h-2 rounded bg-bg-card">
                            <div
                              className="h-2 rounded"
                              style={{
                                width: `${Math.max(8, 100 - Math.min(96, row.delta * 25))}%`,
                                backgroundColor: row.color
                              }}
                              title={`${row.team}: ${row.medianLap.toFixed(3)}s (${row.delta > 0 ? '+' : ''}${row.delta.toFixed(3)}s)`}
                            />
                          </div>
                          <span className="font-mono text-right text-[10px] text-text-muted">
                            {row.medianLap.toFixed(3)}s
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded border border-border bg-bg-secondary p-2.5">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Qualifying Results Overview</div>
                    <div className="space-y-1 text-xs">
                      {qualifyingRows.slice(0, 12).map((row) => (
                        <div key={`quali-${row.code}`} className="grid grid-cols-[26px_42px_1fr_86px] items-center gap-2">
                          <span className="font-mono text-[10px] text-text-muted">P{row.rank}</span>
                          <span className="font-mono text-text-primary">{row.code}</span>
                          <div className="h-2 rounded bg-bg-card">
                            <div
                              className="h-2 rounded"
                              style={{
                                width: `${Math.max(7, 100 - Math.min(94, row.delta * 85))}%`,
                                backgroundColor: row.color
                              }}
                              title={`${row.code}: ${row.bestLap.toFixed(3)}s (${row.delta > 0 ? '+' : ''}${row.delta.toFixed(3)}s)`}
                            />
                          </div>
                          <span className="font-mono text-right text-[10px] text-text-muted">{row.bestLap.toFixed(3)}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded border border-border bg-bg-secondary p-2.5">
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Tyre Strategies Timeline</div>
                {tyreTimelineRows.length === 0 ? (
                  <div className="text-xs text-text-muted">No tyre-compound lap history available</div>
                ) : (
                  <div className="space-y-1.5 overflow-x-auto">
                    {tyreTimelineRows.slice(0, 20).map((row) => (
                      <div key={`tyre-${row.code}`} className="grid min-w-[760px] grid-cols-[42px_1fr_56px] items-center gap-2">
                        <span className="font-mono text-[11px] text-text-primary">{row.code}</span>
                        <div className="relative h-5 rounded border border-white/10 bg-bg-card/80">
                          {row.stints.map((stint, idx) => {
                            const left = ((stint.startLap - 1) / tyreTimelineMaxLap) * 100
                            const width = (stint.laps / tyreTimelineMaxLap) * 100
                            return (
                              <div
                                key={`${row.code}-${idx}`}
                                className="absolute top-0.5 h-4 rounded-sm"
                                style={{
                                  left: `${left}%`,
                                  width: `${Math.max(1.2, width)}%`,
                                  backgroundColor: tyreColor(stint.compound),
                                  opacity: 0.92,
                                }}
                                title={`${row.code} ${stint.compound} L${stint.startLap}-${stint.endLap} (${stint.laps} laps)`}
                              />
                            )
                          })}
                        </div>
                        <span className="font-mono text-right text-[10px] text-text-muted">L{row.stints[row.stints.length - 1]?.endLap || '-'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activePanel === 'strategy-ml' && (
            <section className="glass-panel p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Strategy Scenario Map</div>
                {strategySourceYear != null && selectedYear != null && strategySourceYear !== selectedYear && (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                    using {strategySourceYear} model
                  </span>
                )}
              </div>

              {strategyLoading && <div className="text-sm text-text-secondary">Loading strategy analytics...</div>}
              {!strategyLoading && strategyError && <div className="text-xs text-red-400">{strategyError}</div>}

              {!strategyLoading && !strategyError && topStrategies.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded border border-border bg-bg-card p-2">
                    <svg viewBox="0 0 480 260" className="h-[260px] w-full">
                      <line x1={38} y1={226} x2={460} y2={226} stroke="rgba(130,160,210,0.35)" />
                      <line x1={38} y1={20} x2={38} y2={226} stroke="rgba(130,160,210,0.35)" />

                      {topStrategies.map((item, idx) => {
                        const xSpan = Math.max(0.001, strategyExtents.finishMax - strategyExtents.finishMin)
                        const ySpan = Math.max(0.001, strategyExtents.pointsMax - strategyExtents.pointsMin)
                        const x = 450 - ((item.avg_finish_position - strategyExtents.finishMin) / xSpan) * 400
                        const y = 214 - ((item.avg_points - strategyExtents.pointsMin) / ySpan) * 180
                        const r = 5 + Math.max(0, item.podium_probability || 0) * 13
                        const hue = 140 - Math.min(120, item.avg_pit_stops * 45)
                        const color = `hsl(${Math.max(15, hue)}, 78%, 55%)`
                        return (
                          <g key={`${item.strategy}-${idx}`}>
                            <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.55} stroke={color} strokeWidth={1.2} />
                            <text x={x + 8} y={y - 8} fill="#d6e6ff" fontSize="8">{item.strategy}</text>
                          </g>
                        )
                      })}

                      <text x={42} y={15} fill="#9ab4d9" fontSize="9">Avg points</text>
                      <text x={365} y={244} fill="#9ab4d9" fontSize="9">Better finish →</text>
                    </svg>
                  </div>

                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {topStrategies.slice(0, 8).map((item) => (
                      <div key={item.strategy} className="rounded border border-border bg-bg-secondary px-2 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-text-primary">{item.strategy}</span>
                          <span className="font-mono text-[10px] text-text-muted">Pts {item.avg_points.toFixed(2)}</span>
                        </div>
                        <div className="mt-0.5 grid grid-cols-3 gap-1 text-[10px] text-text-muted">
                          <span>Finish {item.avg_finish_position.toFixed(2)}</span>
                          <span>Podium {formatPct(item.podium_probability)}</span>
                          <span>Stops {item.avg_pit_stops.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activePanel === 'clustering' && (
            <section className="glass-panel p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-text-secondary">Cluster Intelligence</div>
              {clusterLoading && <div className="text-sm text-text-secondary">Loading clusters...</div>}
              {!clusterLoading && clusterError && <div className="text-xs text-red-400">{clusterError}</div>}

              {!clusterLoading && !clusterError && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">Silhouette</div>
                      <div className="font-mono text-sm text-text-primary">{clusterData?.silhouette_score?.toFixed(3) || '-'}</div>
                    </div>
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">Clusters</div>
                      <div className="font-mono text-sm text-text-primary">{clusterData?.n_clusters || '-'}</div>
                    </div>
                    <div className="rounded border border-border bg-bg-secondary p-2">
                      <div className="text-[10px] uppercase text-text-muted">Session Drivers</div>
                      <div className="font-mono text-sm text-text-primary">{sessionData?.drivers?.length || 0}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {clustersById.map((cluster) => (
                      <div key={cluster.clusterId} className="rounded border border-border bg-bg-secondary p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-text-primary">Cluster {cluster.clusterId}</span>
                          <span className="font-mono text-[10px] text-text-muted">
                            in-session {cluster.sessionCount}/{cluster.totalCount}
                          </span>
                        </div>
                        <div className="mb-1 h-2 rounded bg-bg-card">
                          <div
                            className="h-2 rounded bg-accent-blue/80"
                            style={{ width: `${Math.max(4, Math.round((cluster.sessionCount / Math.max(1, cluster.totalCount)) * 100))}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {cluster.topDrivers.map((driver) => (
                            <span key={`${cluster.clusterId}-${driver.name}`} className="rounded bg-bg-card px-1.5 py-0.5 text-text-muted">
                              {driver.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activePanel === 'standings' && (
            <section className="space-y-3 glass-panel p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Season Standings Analytics</div>
                <div className="text-[11px] text-text-muted">
                  Race-by-race points progression, standings heatmap, and season summary (FastF1 standings-style coverage)
                </div>
              </div>

              {seasonStandingsLoading && <div className="text-sm text-text-secondary">Loading season standings from feature files...</div>}
              {seasonStandingsError && <div className="text-xs text-red-400">{seasonStandingsError}</div>}

              {!seasonStandingsLoading && !seasonStandingsError && topSeasonStandings.length === 0 && (
                <div className="text-sm text-text-muted">No standings data available for {selectedYear || '-'}.</div>
              )}

              {!seasonStandingsLoading && !seasonStandingsError && topSeasonStandings.length > 0 && (
                <>
                  <div className="rounded border border-border bg-bg-card p-2.5">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Season Summary Visualization</div>
                    <SeasonStandingsLiteChart
                      drivers={topSeasonStandings.map((driver) => ({
                        code: driver.code,
                        color: driver.color,
                        cumulative: driver.cumulative,
                      }))}
                      raceCount={seasonStandings?.raceNames.length || 0}
                    />
                  </div>

                  <div className="rounded border border-border bg-bg-secondary p-2.5">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-secondary">Driver Standings Heatmap</div>
                    <StandingsHeatmapLiteChart
                      raceNames={seasonStandings?.raceNames || []}
                      drivers={topSeasonStandings.map((driver) => ({
                        code: driver.code,
                        color: driver.color,
                        byRace: driver.byRace,
                        totalPoints: driver.totalPoints,
                      }))}
                    />
                  </div>
                </>
              )}
            </section>
          )}

          {activePanel === 'driver-intel' && (
            <section className="glass-panel p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Driver Intelligence Workspace</div>
                  <div className="text-[11px] text-text-muted">
                    Snapshot and strategy timeline share the same session window and driver selection.
                  </div>
                </div>
                <div className="rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-muted">
                  Real-time data bound
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="min-h-[560px] rounded-lg border border-white/10 bg-black/15 p-2">
                  <DriverSummary />
                </div>
                <div className="min-h-[560px] rounded-lg border border-white/10 bg-black/15 p-2">
                  <PitStrategy />
                </div>
              </div>
            </section>
          )}

          {(activePanel === 'undercut' || activePanel === 'strategy-ml') && (
            <section className="min-h-[620px] glass-panel p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Undercut Decision Lab</div>
                  <div className="text-[11px] text-text-muted">
                    Validate model inputs, run predictions, and review recommendation confidence in one panel.
                  </div>
                </div>
                <div className="rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-muted">
                  Manual override enabled
                </div>
              </div>
              <UndercutPredictor />
            </section>
          )}

          {activePanel === 'fia-docs' && (
            <section className="glass-panel min-h-[980px]">
              <FiaDocumentsView />
            </section>
          )}
        </div>
      </div>
    </div>
  )
})
