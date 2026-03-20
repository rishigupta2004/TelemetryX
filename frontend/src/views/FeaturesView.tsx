import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { api } from '../api/client'
import {
  buildPaceSeries,
  buildTyreTimeline,
  colorFromString,
  loadSavedPanel,
  median,
  normalizeName,
  quantile,
  savePanel,
  FEATURE_PANELS,
  OVERVIEW_SPOTLIGHT,
} from '../lib/featuresUtils'
import type {
  FeaturePanelId,
  HoverTip,
  PaceSeries,
  SeasonStandingsDriver,
  SeasonStandingsPayload,
} from '../lib/featuresUtils'
import type {
  ClusteringResponse,
  CircuitInsightsResponse,
  Driver,
  PointsFeatureRow,
  Race,
  StrategyRecommendationItem,
  StrategyRecommendationsResponse
} from '../types'
import {
  OverviewPanel,
  RacePacePanel,
  TrackMapPanel,
  LapResultsPanel,
  StrategyMLPanel,
  ClusteringPanel,
  StandingsPanel,
  DriverIntelPanel,
  UndercutPanel,
  FiaDocsPanel,
} from './panels'


const MAX_CACHE_SIZE = 50

function withCacheEviction<K, V>(cache: Map<K, V>, key: K, value: V): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, value)
}

export const PanelIcons: Record<string, React.ReactNode> = {
  overview: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  'race-pace': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20 Q 6 20 6 15 T 12 10 T 18 8 T 21 5"/><circle cx="3" cy="20" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="21" cy="5" r="2"/></svg>,
  'lap-results': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  'strategy-ml': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v10"/><path d="M21 12h-6m-6 0H1"/><path d="M18.5 5.5l-4 4m-5 5l-4 4"/></svg>,
  clustering: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M12 12v8m-4-4l4 4 4-4"/></svg>,
  standings: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10m-6 10V4m-6 16v-6m-6 0h12"/></svg>,
  'driver-intel': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><path d="M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>,
  undercut: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5m-8-5h5v5m-8 8h5v5m-8-8h5v5"/><circle cx="19" cy="19" r="3"/></svg>,
  'fia-docs': <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8m8 4H8m2-8H8"/></svg>,
}

export { OVERVIEW_SPOTLIGHT }

export const FeaturesView = React.memo(function FeaturesView({ active }: { active: boolean }) {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const sessionData = useSessionStore((s) => s.sessionData)
  const races = useSessionStore((s) => s.races)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)

  const [strategyData, setStrategyData] = useState<StrategyRecommendationsResponse | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [strategyError, setStrategyError] = useState<string | null>(null)

  const [clusterData, setClusterData] = useState<ClusteringResponse | null>(null)
  const [clusterLoading, setClusterLoading] = useState(false)
  const [clusterError, setClusterError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<FeaturePanelId>('overview')
  const [tabsCollapsed, setTabsCollapsed] = useState(() => {
    try { return window.localStorage.getItem('telemetryx_features_tabs_collapsed') === 'true' } catch { return false }
  })

  const activePanelMeta = useMemo(
    () => FEATURE_PANELS.find((p) => p.id === activePanel) ?? FEATURE_PANELS[0],
    [activePanel]
  )

  const tabAccent = useMemo(() => colorFromString(activePanelMeta?.label ?? 'Features'), [activePanelMeta])

  const [lapScatterHover, setLapScatterHover] = useState<HoverTip | null>(null)
  const [positionHover, setPositionHover] = useState<HoverTip | null>(null)
  const [seasonStandings, setSeasonStandings] = useState<SeasonStandingsPayload | null>(null)
  const [seasonStandingsLoading, setSeasonStandingsLoading] = useState(false)
  const [seasonStandingsError, setSeasonStandingsError] = useState<string | null>(null)
  const [circuitInsights, setCircuitInsights] = useState<CircuitInsightsResponse | null>(null)
  const [publishReadiness, setPublishReadiness] = useState<Record<string, boolean | null>>({
    api: null, clustering: null, undercut: null, strategy: null
  })

  const standingsCacheRef = useRef<Map<string, SeasonStandingsPayload>>(new Map())
  const readinessCacheRef = useRef<Map<string, Record<string, boolean | null>>>(new Map())
  const strategyCacheRef = useRef<Map<string, { data: StrategyRecommendationsResponse | null; error: string | null }>>(new Map())
  const clusteringCacheRef = useRef<Map<string, ClusteringResponse>>(new Map())

  const panelStorageKey = useMemo(
    () => `telemetryx.features.panel.${selectedYear || 'na'}.${selectedRace || 'na'}.${selectedSession || 'na'}`,
    [selectedYear, selectedRace, selectedSession]
  )

  useEffect(() => {
    const saved = loadSavedPanel(panelStorageKey)
    if (saved) { setActivePanel(saved); return }
    setActivePanel('overview')
  }, [panelStorageKey])

  useEffect(() => {
    savePanel(panelStorageKey, activePanel)
  }, [panelStorageKey, activePanel])

  useEffect(() => {
    const readinessKey = `${selectedYear || 'na'}|${selectedRace || 'na'}`
    const cached = readinessCacheRef.current.get(readinessKey)
    if (cached) { setPublishReadiness(cached); return }
    let cancelled = false
    const timer = window.setTimeout(() => {
      const run = async () => {
        const checks = await Promise.allSettled([api.getHealth(), api.getClustering(false), api.getUndercutSummary()])
        if (cancelled) return
        const next = { api: checks[0].status === 'fulfilled', clustering: checks[1].status === 'fulfilled', undercut: checks[2].status === 'fulfilled', strategy: null }
        readinessCacheRef.current.set(readinessKey, next)
        withCacheEviction(readinessCacheRef.current, readinessKey, next)
        setPublishReadiness(next)
      }
      void run()
    }, 60)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [selectedYear, selectedRace])

  useEffect(() => {
    if (!active || !selectedYear || !selectedRace) { setStrategyData(null); setStrategyError(null); return }
    let cancelled = false
    const strategyKey = `${selectedYear}|${selectedRace}`
    const cached = strategyCacheRef.current.get(strategyKey)
    if (cached) { setStrategyData(cached.data); setStrategyLoading(false); setStrategyError(cached.error); return }
    setStrategyLoading(true); setStrategyError(null); setStrategyData(null)

    api.getStrategyRecommendations(selectedYear, selectedRace)
      .then((data) => {
        if (cancelled) return
        withCacheEviction(strategyCacheRef.current, strategyKey, { data, error: null })
        setStrategyData(data)
      })
      .catch((err) => {
        if (cancelled) return
        const message = String(err)
        setStrategyData(null); setStrategyError(message)
        withCacheEviction(strategyCacheRef.current, strategyKey, { data: null, error: message })
      })
      .finally(() => { if (!cancelled) setStrategyLoading(false) })
    return () => { cancelled = true }
  }, [active, selectedYear, selectedRace])

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession) { setClusterData(null); setClusterLoading(false); setClusterError(null); return }
    const clusterKey = `${selectedYear}|${selectedRace}|${selectedSession}`
    let cancelled = false
    const cached = clusteringCacheRef.current.get(clusterKey)
    if (cached) { setClusterData(cached); setClusterLoading(false); setClusterError(null); return }
    setClusterLoading(true); setClusterError(null); setClusterData(null)

    api.getClustering(true)
      .then((payload) => { if (!cancelled) { withCacheEviction(clusteringCacheRef.current, clusterKey, payload); setClusterData(payload) } })
      .catch((err) => { if (!cancelled) { setClusterData(null); setClusterError(String(err)) } })
      .finally(() => { if (!cancelled) setClusterLoading(false) })
    return () => { cancelled = true }
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
    if (primaryDriver && !byCode.has(primaryDriver)) { const found = racePaceSeries.find((item) => item.code === primaryDriver); if (found) top.push(found) }
    if (compareDriver && !byCode.has(compareDriver)) { const found = racePaceSeries.find((item) => item.code === compareDriver); if (found) top.push(found) }
    return top
  }, [racePaceSeries, primaryDriver, compareDriver])

  const paceBounds = useMemo(() => {
    const laps = visibleRacePaceSeries.flatMap((item) => item.laps)
    const values = visibleRacePaceSeries.flatMap((item) => item.smoothed)
    const xMin = laps.length ? Math.min(...laps) : 1
    const xMax = laps.length ? Math.max(...laps) : 60
    const yMinRaw = values.length ? Math.min(...values) : 85
    const yMaxRaw = values.length ? Math.max(...values) : 95
    return { xMin, xMax, yMin: Math.floor(yMinRaw - 0.6), yMax: Math.ceil(yMaxRaw + 0.6) }
  }, [visibleRacePaceSeries])

  const paceHighlights = useMemo(() => {
    if (!racePaceSeries.length) return { bestMedian: null as PaceSeries | null, mostDeg: null as PaceSeries | null }
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
    return { name: geo.name || 'Track', country: geo.country || '-', layoutYear: geo.layoutYear ?? null, source: geo.source || '-', corners: Array.isArray(geo.corners) ? geo.corners.length : 0, sectors: Array.isArray(geo.sectors) ? geo.sectors.length : 0, drsZones: Array.isArray(geo.drsZones) ? geo.drsZones.length : 0, trackWidth: geo.trackWidth ?? null }
  }, [sessionData?.trackGeometry])

  const strategyExtents = useMemo(() => {
    const finish = topStrategies.map((item) => item.avg_finish_position)
    const points = topStrategies.map((item) => item.avg_points)
    return { finishMin: finish.length ? Math.min(...finish) : 1, finishMax: finish.length ? Math.max(...finish) : 20, pointsMin: points.length ? Math.min(...points) : 0, pointsMax: points.length ? Math.max(...points) : 25 }
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
        return { clusterId, totalCount: drivers.length, sessionCount: drivers.filter((item) => item.inSession).length, topDrivers: sortedDrivers.slice(0, 4) }
      })
  }, [clusterData, sessionDriverSet])

  const driverByCode = useMemo(() => {
    const map = new Map<string, Driver>()
    for (const driver of sessionData?.drivers ?? []) map.set(driver.code, driver)
    return map
  }, [sessionData?.drivers])

  const driverByNumber = useMemo(() => {
    const map = new Map<number, Driver>()
    for (const driver of sessionData?.drivers ?? []) map.set(driver.driverNumber, driver)
    return map
  }, [sessionData?.drivers])

  const lapScatterSeries = useMemo(() => {
    const base = racePaceSeries.slice(0, 12)
    const map = new Map(base.map((item) => [item.code, item]))
    if (primaryDriver && !map.has(primaryDriver)) { const found = racePaceSeries.find((item) => item.code === primaryDriver); if (found) map.set(found.code, found) }
    if (compareDriver && !map.has(compareDriver)) { const found = racePaceSeries.find((item) => item.code === compareDriver); if (found) map.set(found.code, found) }
    return Array.from(map.values())
  }, [racePaceSeries, primaryDriver, compareDriver])

  const lapScatterBounds = useMemo(() => {
    const laps = lapScatterSeries.flatMap((item) => item.laps)
    const times = lapScatterSeries.flatMap((item) => item.times)
    return { xMin: laps.length ? Math.min(...laps) : 1, xMax: laps.length ? Math.max(...laps) : 60, yMin: times.length ? Math.floor(Math.min(...times) - 0.5) : 85, yMax: times.length ? Math.ceil(Math.max(...times) + 0.5) : 95 }
  }, [lapScatterSeries])

  const lapDistributions = useMemo(() => {
    return lapScatterSeries.map((series) => {
      const values = [...series.times].sort((a, b) => a - b)
      return { code: series.code, color: series.color, p10: quantile(values, 0.1), q1: quantile(values, 0.25), median: quantile(values, 0.5), q3: quantile(values, 0.75), p90: quantile(values, 0.9) }
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

    return Array.from(byDriverLap.entries())
      .map(([code, lapMap]) => {
        const points = Array.from(lapMap.entries()).sort((a, b) => a[0] - b[0]).map(([lap, position]) => ({ lap, position }))
        const latestPosition = points[points.length - 1]?.position ?? 99
        const driver = driverByCode.get(code)
        return { code, color: driver?.teamColor || colorFromString(code), points, latestPosition }
      })
      .filter((trace) => trace.points.length > 1)
      .sort((a, b) => a.latestPosition - b.latestPosition)
      .slice(0, 12)
  }, [sessionData?.drivers, sessionData?.laps, driverByCode])

  const positionTraceBounds = useMemo(() => {
    const laps = positionTraces.flatMap((trace) => trace.points.map((p) => p.lap))
    const positions = positionTraces.flatMap((trace) => trace.points.map((p) => p.position))
    return { xMin: laps.length ? Math.min(...laps) : 1, xMax: laps.length ? Math.max(...laps) : 60, yMin: positions.length ? Math.min(...positions) : 1, yMax: positions.length ? Math.max(...positions) : 20 }
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
      .map(([team, data]) => ({ team, color: data.color, medianLap: median(data.times) }))
      .filter((row) => Number.isFinite(row.medianLap) && row.medianLap > 0)
      .sort((a, b) => a.medianLap - b.medianLap)
    const leader = rows[0]?.medianLap ?? null
    return rows.map((row) => ({ ...row, delta: leader != null ? row.medianLap - leader : 0 }))
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
        return { code, bestLap, color: driver?.teamColor || colorFromString(code) }
      })
      .sort((a, b) => a.bestLap - b.bestLap)

    const pole = rows[0]?.bestLap ?? null
    return rows.map((row, idx) => ({ ...row, rank: idx + 1, delta: pole != null ? row.bestLap - pole : 0 }))
  }, [sessionData?.laps, sessionData?.drivers])

  const orderedRaces = useMemo(() => {
    return [...(races as Race[])].sort((a, b) => {
      const ar = a.round ?? 0, br = b.round ?? 0
      if (ar !== br) return ar - br
      const an = a.display_name ?? a.race_name ?? a.name ?? ''
      const bn = b.display_name ?? b.race_name ?? b.name ?? ''
      return an.localeCompare(bn)
    })
  }, [races])

  useEffect(() => {
    if (activePanel !== 'standings' || !selectedYear || orderedRaces.length === 0) { setSeasonStandings(null); setSeasonStandingsError(null); setSeasonStandingsLoading(false); return }
    const cacheKey = `${selectedYear}:${orderedRaces.map((race) => race.race_name ?? race.name ?? race.display_name ?? '').join('|')}`
    const cached = standingsCacheRef.current.get(cacheKey)
    if (cached) { setSeasonStandings(cached); setSeasonStandingsError(null); setSeasonStandingsLoading(false); return }

    let cancelled = false
    setSeasonStandingsLoading(true); setSeasonStandingsError(null); setSeasonStandings(null)

    Promise.all(orderedRaces.map(async (race) => {
      const raceKey = race.race_name ?? race.name ?? race.display_name ?? ''
      try { const rows = await api.getPointsFeatures(selectedYear, raceKey, 'R'); return { race: raceKey, rows } }
      catch { return { race: raceKey, rows: [] as PointsFeatureRow[] } }
    }))
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
            const entry = driverMap.get(code) ?? { code, byRace: new Array(raceNames.length).fill(0), totalPoints: 0, color }
            entry.byRace[idx] += points
            entry.totalPoints += points
            driverMap.set(code, entry)
          }
        })

        const drivers: SeasonStandingsDriver[] = Array.from(driverMap.values())
          .map((driver) => {
            let sum = 0
            const cumulative = driver.byRace.map((points) => { sum += points; return sum })
            return { code: driver.code, totalPoints: driver.totalPoints, byRace: driver.byRace, cumulative, color: driver.color }
          })
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .slice(0, 20)

        const payload: SeasonStandingsPayload = { raceNames, drivers }
        withCacheEviction(standingsCacheRef.current, cacheKey, payload)
        setSeasonStandings(payload)
      })
      .catch((err) => { if (!cancelled) { setSeasonStandings(null); setSeasonStandingsError(String(err)) } })
      .finally(() => { if (!cancelled) setSeasonStandingsLoading(false) })
    return () => { cancelled = true }
  }, [activePanel, selectedYear, orderedRaces, driverByCode])

  useEffect(() => {
    if (activePanel !== 'race-pace' || !selectedYear || !selectedRace) return
    let cancelled = false
    api.getCircuitInsights(selectedYear, selectedRace)
      .then((payload) => { if (!cancelled) setCircuitInsights(payload) })
      .catch(() => { if (!cancelled) setCircuitInsights(null) })
    return () => { cancelled = true }
  }, [activePanel, selectedYear, selectedRace])

  const topSeasonStandings = useMemo(() => seasonStandings?.drivers.slice(0, 10) ?? [], [seasonStandings])

  const tyreTimelineRows = useMemo(
    () => buildTyreTimeline(sessionData?.laps ?? [], (sessionData?.drivers ?? []).map((driver) => ({ code: driver.code, driverNumber: driver.driverNumber, teamColor: driver.teamColor }))),
    [sessionData?.laps, sessionData?.drivers]
  )

  const tyreTimelineMaxLap = useMemo(() => {
    let maxLap = 1
    for (const row of tyreTimelineRows) { for (const stint of row.stints) { maxLap = Math.max(maxLap, stint.endLap) } }
    return maxLap
  }, [ tyreTimelineRows])

  return (
    <div className="flex h-full min-h-0 flex-col relative">
      <div className="bg-bg-surface border-b border-border flex flex-shrink-0 items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-accent" />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-secondary">Features + ML</div>
        </div>
        {tabsCollapsed ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-[11px] font-semibold text-fg-primary">{FEATURE_PANELS.find((p) => p.id === activePanel)?.label ?? 'Overview'}</span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-thin" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {FEATURE_PANELS.map((panel) => {
              const active = activePanel === panel.id
              return (
                <button key={panel.id} type="button" onClick={() => setActivePanel(panel.id)} title={panel.hint} className={`flex-shrink-0 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 border ${active ? 'border-accent bg-accent/10 text-fg-primary' : 'border-transparent text-fg-muted hover:text-fg-secondary hover:bg-white/5'}`}>
                  {PanelIcons[panel.id] && <span className="opacity-80">{PanelIcons[panel.id]}</span>}
                  {panel.label}
                </button>
              )
            })}
          </div>
        )}
        <button type="button" onClick={() => { const next = !tabsCollapsed; setTabsCollapsed(next); try { window.localStorage.setItem('telemetryx_features_tabs_collapsed', String(next)) } catch { } }} className="rounded-lg border border-border/60 bg-bg-raised/60 px-2.5 py-1 text-[10px] text-fg-muted hover:text-fg-primary hover:border-white/20 transition-all" title={tabsCollapsed ? 'Expand tab bar' : 'Collapse tab bar'}>
          {tabsCollapsed ? '▼' : '▲'}
        </button>
        <div className="rounded-full border border-border/60 bg-bg-raised/60 px-3 py-1 text-[10px] font-mono text-fg-muted" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}>
          {selectedYear || '-'} · {selectedRace || '-'} · {selectedSession || '-'}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 bg-bg-base">
        <div className="mx-auto w-full space-y-5">

          {activePanel === 'overview' && (
            <OverviewPanel selectedYear={selectedYear} selectedRace={selectedRace} selectedSession={selectedSession} sessionData={sessionData} publishReadiness={publishReadiness} setActivePanel={setActivePanel} />
          )}

          {activePanel === 'race-pace' && (
            <>
              <TrackMapPanel tabAccent={tabAccent} trackOverview={trackOverview} primaryDriver={primaryDriver} compareDriver={compareDriver} circuitInsights={circuitInsights} />
              <RacePacePanel tabAccent={tabAccent} primaryDriver={primaryDriver} compareDriver={compareDriver} racePaceSeries={racePaceSeries} visibleRacePaceSeries={visibleRacePaceSeries} paceBounds={paceBounds} paceHighlights={paceHighlights} weatherSnapshot={weatherSnapshot} trackOverview={trackOverview} circuitInsights={circuitInsights} />
            </>
          )}

          {activePanel === 'lap-results' && (
            <LapResultsPanel primaryDriver={primaryDriver} compareDriver={compareDriver} lapScatterSeries={lapScatterSeries} lapScatterBounds={lapScatterBounds} lapDistributions={lapDistributions} positionTraces={positionTraces} positionTraceBounds={positionTraceBounds} teamPaceRows={teamPaceRows} qualifyingRows={qualifyingRows} tyreTimelineRows={ tyreTimelineRows} tyreTimelineMaxLap={ tyreTimelineMaxLap} setLapScatterHover={setLapScatterHover} setPositionHover={setPositionHover} />
          )}

          {(activePanel === 'strategy-ml' || activePanel === 'undercut') && (
            <StrategyMLPanel tabAccent={tabAccent} selectedYear={selectedYear} selectedRace={selectedRace} strategyData={strategyData} strategyLoading={strategyLoading} strategyError={strategyError} topStrategies={topStrategies} strategyExtents={strategyExtents} />
          )}

          {activePanel === 'clustering' && (
            <ClusteringPanel tabAccent={tabAccent} sessionData={sessionData} clusterData={clusterData} clusterLoading={clusterLoading} clusterError={clusterError} clustersById={clustersById} />
          )}

          {activePanel === 'standings' && (
            <StandingsPanel tabAccent={tabAccent} selectedYear={selectedYear} seasonStandings={seasonStandings} seasonStandingsLoading={seasonStandingsLoading} seasonStandingsError={seasonStandingsError} topSeasonStandings={topSeasonStandings} />
          )}

          {activePanel === 'driver-intel' && (
            <DriverIntelPanel tabAccent={tabAccent} />
          )}

          {activePanel === 'undercut' && (
            <UndercutPanel tabAccent={tabAccent} />
          )}

          {activePanel === 'fia-docs' && (
            <FiaDocsPanel />
          )}
        </div>
      </div>
    </div>
  )
})
