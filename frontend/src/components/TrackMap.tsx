import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore as useSessionDataStore } from '../stores/sessionStore'
import { useSessionTime } from '../lib/timeUtils'
import { useTrackViewport } from '../hooks/useTrackViewport'
import { useTrackData } from '../hooks/useTrackData'
import { useStaticTrackRenderer } from '../hooks/useStaticTrackRenderer'
import { useDynamicTrackRenderer } from '../hooks/useDynamicTrackRenderer'
import { useCarPositions } from '../hooks/useCarPositions'
import { interpolateFromLookup, Point } from '../lib/trackGeometry'
import { getRaceControlState } from '../lib/raceControlState'
import { normalizeLoopProgress, blendPoints, clamp, buildCornerBadges } from '../lib/trackHelpers'
import type { LapRow } from '../types'

interface TrackMapProps {
  compact?: boolean
  mode?: 'full' | 'minimap'
}

interface ResolvedCar {
  car: {
    driverCode: string
    driverNumber: number
    teamColor: string
    progress: number
    currentLap: number
    position: number | null
    x: number | null
    y: number | null
    hasLivePosition: boolean
    isInPit: boolean
    pitProgress: number | null
    progressSource: string
    mappingConfidence: number
    sourceTimestamp: number | null
  }
  pos: Point
  hidden: boolean
  stale: boolean
}

interface CurrentFlags {
  trackFlag: string | null
  isSafetyCar: boolean
  isVSC: boolean
  isRedFlag: boolean
  sectorFlags: Record<number, string>
}

const MOUSE_MOVE_THROTTLE_MS = 16

export function TrackMap({ compact = false, mode = 'full' }: TrackMapProps) {
  const isMinimap = mode === 'minimap'
  const isCompact = compact || isMinimap

  const sessionData = useSessionDataStore((s) => s.sessionData)
  const lapsFromStore = useSessionDataStore((s) => s.laps)
  const liveCarPositions = useCarPositions()
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)

  const sessionTime = useSessionTime()
  const flagSessionTime = Math.round(sessionTime * 8) / 8

  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)
  const [hoveredSector, setHoveredSector] = useState<number | null>(null)

  const hoveredDriverRef = useRef<string | null>(null)
  const primaryDriverRef = useRef<string | null>(null)
  const compareDriverRef = useRef<string | null>(null)
  const hoveredSectorRef = useRef<number | null>(null)
  const resolvedCarsRef = useRef<ResolvedCar[]>([])
  const currentFlagsRef = useRef<CurrentFlags>({ trackFlag: null, isSafetyCar: false, isVSC: false, isRedFlag: false, sectorFlags: {} })
  const needsRenderRef = useRef<boolean>(false)
  const lastMouseMoveRef = useRef<number>(0)

  const { viewport, containerRef } = useTrackViewport(!isMinimap)
  const trackData = useTrackData(sessionData, viewport)
  const { staticCanvasRef } = useStaticTrackRenderer(trackData, isCompact, containerRef)

  useEffect(() => { hoveredDriverRef.current = hoveredDriver; needsRenderRef.current = true }, [hoveredDriver])
  useEffect(() => { primaryDriverRef.current = primaryDriver; needsRenderRef.current = true }, [primaryDriver])
  useEffect(() => { compareDriverRef.current = compareDriver; needsRenderRef.current = true }, [compareDriver])
  useEffect(() => { hoveredSectorRef.current = hoveredSector; needsRenderRef.current = true }, [hoveredSector])

  const sortedRaceControl = useMemo(() => {
    const raceControl = sessionData?.raceControl
    if (!raceControl || !raceControl.length) return []
    return [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
  }, [sessionData?.raceControl])

  const currentFlags = useMemo((): CurrentFlags => {
    if (!sortedRaceControl.length) {
      return { trackFlag: null, isSafetyCar: false, isVSC: false, isRedFlag: false, sectorFlags: {} }
    }
    const state = getRaceControlState(
      sortedRaceControl,
      flagSessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    const trackFlag = state.trackFlag
    return { trackFlag, isSafetyCar: state.isSafetyCar, isVSC: state.isVSC, isRedFlag: trackFlag === 'RED', sectorFlags: state.sectorFlags }
  }, [flagSessionTime, sortedRaceControl, sessionData?.metadata?.raceStartSeconds])

  const timingFallbackPositions = useMemo(() => {
    if (!sessionData?.drivers?.length) return []
    const drivers = sessionData.drivers
    const laps = lapsFromStore.length ? lapsFromStore : sessionData.laps ?? []
    
    if (!laps.length) {
      return []
    }

    const byNum = new Map<number, LapRow[]>()
    for (const lap of laps) {
      const rows = byNum.get(lap.driverNumber) ?? []
      rows.push(lap)
      byNum.set(lap.driverNumber, rows)
    }
    for (const rows of byNum.values()) {
      rows.sort((a, b) => a.lapStartSeconds - b.lapStartSeconds)
    }

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
    const findLap = (rows: LapRow[], t: number): LapRow | null => {
      if (!rows.length) return null
      let lo = 0, hi = rows.length - 1
      let latest: LapRow | null = null
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const lap = rows[mid]
        if (lap.lapStartSeconds <= t && t <= lap.lapEndSeconds) return lap
        if (lap.lapEndSeconds <= t) { latest = lap; lo = mid + 1 }
        else { hi = mid - 1 }
      }
      return latest ?? rows[0]
    }

    return drivers.map((driver) => {
      const rows = byNum.get(driver.driverNumber) ?? []
      const lap = findLap(rows, sessionTime)
      const lapNumber = lap?.lapNumber ?? 1
      const start = lap?.lapStartSeconds ?? 0
      const end = lap?.lapEndSeconds ?? start + 90
      const duration = Math.max(1, end - start)
      const progress = clamp01((sessionTime - start) / duration)
      const lapPosition = Number(lap?.position)
      const offset = Number.isFinite(lapPosition) && lapPosition > 0 ? (lapPosition - 1) / Math.max(1, drivers.length) : 0
      const unwrapped = Math.max(0, lapNumber - 1) + progress
      return {
        driverCode: driver.code,
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#fff',
        progress: (unwrapped + offset * 0.08) % 1,
        currentLap: lapNumber,
        position: lap?.position ?? 99,
        x: null,
        y: null,
        hasLivePosition: false,
        isInPit: false,
        pitProgress: null,
        progressSource: 'timing',
        mappingConfidence: 0.45,
        sourceTimestamp: null
      }
    }).sort((a, b) => (a.position || 99) - (b.position || 99))
  }, [sessionData, lapsFromStore, sessionTime])

  const carPositions = useMemo(() => {
    if (liveCarPositions.length) return liveCarPositions
    return timingFallbackPositions
  }, [liveCarPositions, timingFallbackPositions])

  const resolvedCars = useMemo((): ResolvedCar[] => {
    if (!trackData) return []
    const { points, trackLookup, pitLaneLookup, pitEntryIdx, pitExitIdx, rawBounds, toViewport, bounds, width, height } = trackData
    const hasPitLanePath = pitLaneLookup != null
    const rawMarginX = (rawBounds.maxX - rawBounds.minX) * 0.03
    const rawMarginY = (rawBounds.maxY - rawBounds.minY) * 0.03
    const viewportMargin = 20
    const viewportMinX = bounds.minX - viewportMargin
    const viewportMaxX = bounds.minX + width + viewportMargin
    const viewportMinY = bounds.minY - viewportMargin
    const viewportMaxY = bounds.minY + height + viewportMargin
    const nearestTrackDistance = (p: Point): number => {
      if (!points.length) return Number.POSITIVE_INFINITY
      let minDist = Number.POSITIVE_INFINITY
      for (let i = 0; i < points.length; i += 4) {
        const dx = points[i].x - p.x
        const dy = points[i].y - p.y
        const d = Math.hypot(dx, dy)
        if (d < minDist) minDist = d
      }
      return minDist
    }
    
    return carPositions.map((car) => {
      const rawProgress = Number(car.progress)
      if (!Number.isFinite(rawProgress)) {
        return {
          car,
          pos: points[0] ?? { x: bounds.minX + width / 2, y: bounds.minY + height / 2 },
          hidden: true,
          stale: false
        }
      }
      const normalizedProgress = rawProgress <= 1
        ? rawProgress
        : rawProgress > 1 && rawProgress <= 100
          ? rawProgress / 100
          : rawProgress > 100
            ? (rawProgress / 5500)
            : rawProgress
      const mainProgress = normalizeLoopProgress(normalizedProgress)
      const MIN_VALID_PROGRESS = 0.001
      const hasRealPosition =
        (car.sourceTimestamp ?? 0) > 0 &&
        Math.abs(mainProgress) > MIN_VALID_PROGRESS
      let pos = interpolateFromLookup(trackLookup, mainProgress)

      if (car.x != null && car.y != null && Number.isFinite(car.x) && Number.isFinite(car.y) && (car.x !== 0 || car.y !== 0)) {
        const swapped = { x: -car.y, y: -car.x }
        const inRawBounds = swapped.x >= rawBounds.minX - rawMarginX && swapped.x <= rawBounds.maxX + rawMarginX &&
                            swapped.y >= rawBounds.minY - rawMarginY && swapped.y <= rawBounds.maxY + rawMarginY
        if (inRawBounds) {
          const viewportPos = toViewport(swapped)
          const inViewportBounds = viewportPos.x >= viewportMinX && viewportPos.x <= viewportMaxX &&
                                   viewportPos.y >= viewportMinY && viewportPos.y <= viewportMaxY
          const nearTrack = nearestTrackDistance(viewportPos) <= 70
          if (inViewportBounds && nearTrack) pos = viewportPos
        }
      }

      if (car.isInPit && hasPitLanePath) {
        const pitProgress = clamp(car.pitProgress ?? 0, 0, 1)
        const pitPoint = interpolateFromLookup(pitLaneLookup, pitProgress)
        const blendWindow = 0.12
        if (pitEntryIdx != null && pitProgress < blendWindow) {
          pos = blendPoints(points[pitEntryIdx], pitPoint, pitProgress / blendWindow)
        } else if (pitExitIdx != null && pitProgress > 1 - blendWindow) {
          pos = blendPoints(pitPoint, points[pitExitIdx], (pitProgress - (1 - blendWindow)) / blendWindow)
        } else {
          pos = pitPoint
        }
      }

      const staleness = (car.hasLivePosition && car.sourceTimestamp != null)
        ? Math.abs(sessionTime - car.sourceTimestamp)
        : car.hasLivePosition ? 0 : -1
      const STALE_THRESHOLD = 3.0
      const HIDE_THRESHOLD = 5.0
      const hiddenByStaleness = car.hasLivePosition && staleness > HIDE_THRESHOLD
      const hiddenByMissingProgress = !hasRealPosition
      const hidden = hiddenByStaleness || hiddenByMissingProgress
      const stale = car.hasLivePosition && staleness >= STALE_THRESHOLD && staleness <= HIDE_THRESHOLD
      return { car, pos, hidden, stale }
    })
  }, [carPositions, trackData, sessionTime])

  useEffect(() => {
    resolvedCarsRef.current = resolvedCars
    currentFlagsRef.current = currentFlags
    needsRenderRef.current = true
  }, [resolvedCars, currentFlags])

  const cornerBadges = useMemo((): ReturnType<typeof buildCornerBadges> => {
    if (!trackData) return []
    return buildCornerBadges(trackData.points, trackData.corners)
  }, [trackData])

  const mappingStats = useMemo(() => {
    if (!carPositions.length) return { sourceLabel: 'NO CARS', avgConfidence: 0, degradedCount: 0 }
    let fusedCount = 0, timingCount = 0, confidenceSum = 0, degradedCount = 0
    for (const car of carPositions) {
      if (car.progressSource === 'fused') fusedCount += 1
      else timingCount += 1
      confidenceSum += car.mappingConfidence
      if (car.mappingConfidence < 0.62) degradedCount += 1
    }
    const sourceLabel = fusedCount >= timingCount ? 'FUSED' : 'TIMING'
    return { sourceLabel, avgConfidence: confidenceSum / carPositions.length, degradedCount }
  }, [carPositions])

  const dynamicCanvasRef = useDynamicTrackRenderer(
    trackData,
    containerRef,
    resolvedCarsRef,
    currentFlagsRef,
    needsRenderRef,
    hoveredDriverRef,
    primaryDriverRef,
    compareDriverRef,
    isCompact
  )

  const hoveredCar = useMemo(() => {
    if (!hoveredDriver) return null
    return carPositions.find(car => car.driverCode === hoveredDriver) ?? null
  }, [carPositions, hoveredDriver])

  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const now = performance.now()
    if (now - lastMouseMoveRef.current < MOUSE_MOVE_THROTTLE_MS) return
    lastMouseMoveRef.current = now
    
    if (isMinimap || !trackData) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { width: internalW, height: internalH } = trackData

    const scale = Math.min(rect.width / internalW, rect.height / internalH)
    const displayedW = internalW * scale
    const displayedH = internalH * scale
    const offsetX = (rect.width - displayedW) / 2
    const offsetY = (rect.height - displayedH) / 2

    const mx = (e.clientX - rect.left - offsetX) / scale
    const my = (e.clientY - rect.top - offsetY) / scale
    const cx = mx + trackData.bounds.minX
    const cy = my + trackData.bounds.minY

    let found: string | null = null
    const radius = isCompact ? 11 : 15
    for (const { car, pos } of resolvedCarsRef.current) {
      const dist = Math.hypot(pos.x - cx, pos.y - cy)
      if (dist <= radius + 2) { found = car.driverCode; break }
    }
    if (found !== hoveredDriverRef.current) setHoveredDriver(found)

    let foundSector: number | null = null
    for (let i = 0; i < trackData.sectorMarkers.length; i++) {
      const sector = trackData.sectorMarkers[i]
      const sectorPoint = trackData.points[sector.idx]
      if (sectorPoint) {
        const dist = Math.hypot(sectorPoint.x - cx, sectorPoint.y - cy)
        if (dist <= 35) { foundSector = i + 1; break }
      }
    }
    if (foundSector !== hoveredSectorRef.current) setHoveredSector(foundSector)
  }, [isMinimap, trackData, isCompact, resolvedCarsRef])

  const handlePointerClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMinimap || !hoveredDriver) return
    const car = carPositions.find(c => c.driverCode === hoveredDriver)
    if (car) {
      if (e.ctrlKey || e.metaKey) {
        selectCompare(compareDriver === car.driverCode ? null : car.driverCode)
      } else {
        selectPrimary(car.driverCode)
      }
    }
  }, [isMinimap, hoveredDriver, carPositions, compareDriver, selectPrimary, selectCompare])

  if (!trackData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Track layout not available
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #16181d 0%, #0d0e10 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
      }}
    >
      {!isMinimap && (
        <div className="absolute left-3 top-2 z-20 flex max-w-[min(44%,360px)] flex-col gap-1.5">
          <InfoPill>{sessionData?.trackGeometry?.name || 'Track'}</InfoPill>
          <InfoPill>MAP {mappingStats.sourceLabel} · Q{Math.round(mappingStats.avgConfidence * 100)}</InfoPill>
          {mappingStats.degradedCount > 0 && (
            <InfoPill style={{ background: 'rgba(23, 24, 29, 0.88)', borderColor: 'rgba(148,163,184,0.22)', color: '#94a3b8' }}>
              Position mapping: Q{Math.round(mappingStats.avgConfidence * 100)} reference
            </InfoPill>
          )}
          {currentFlags.isRedFlag && <FlagPill color="#fca5a5" bg="rgba(40, 10, 10, 0.95)">RED FLAG</FlagPill>}
          {currentFlags.isSafetyCar && !currentFlags.isRedFlag && <FlagPill color="#fdba74" bg="rgba(40, 30, 10, 0.95)">SAFETY CAR</FlagPill>}
          {currentFlags.isVSC && !currentFlags.isRedFlag && !currentFlags.isSafetyCar && <FlagPill color="#fde047" bg="rgba(40, 35, 10, 0.95)">VIRTUAL SC</FlagPill>}
        </div>
      )}

      {!isMinimap && hoveredCar && <HoverInfo car={hoveredCar} sessionTime={sessionTime} laps={lapsFromStore.length ? lapsFromStore : sessionData?.laps ?? []} />}

      <div className="absolute inset-0">
        <canvas ref={staticCanvasRef} className="absolute inset-0 h-full w-full" style={{ objectFit: 'contain', pointerEvents: 'none', willChange: 'contents' }} />
        <canvas
          ref={dynamicCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: 'contain', cursor: isMinimap ? 'default' : hoveredDriver ? 'pointer' : 'default', willChange: 'contents' }}
          onMouseMove={handlePointerMove}
          onClick={handlePointerClick}
          onMouseLeave={() => { setHoveredDriver(null); setHoveredSector(null) }}
        />
      </div>

      {!isMinimap && (
        <div
          className="absolute bottom-4 right-4 z-10 max-w-[150px] pointer-events-none sm:max-w-[185px]"
          style={{
            background: 'rgba(20, 22, 27, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '6px 9px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 22px rgba(0,0,0,0.42)'
          }}
        >
          <div className="flex flex-col gap-1 text-[9px] sm:text-[10px]">
            <LegendItem color="rgba(255,140,30,0.6)" borderColor="rgba(255,180,50,0.6)">DRS Zone</LegendItem>
            <LegendItem color="rgba(255,180,50,0.4)" dashed borderColor="rgba(255,180,50,0.6)">Pit Lane</LegendItem>
            <LegendItemDot color="rgba(150, 150, 150, 0.3)" borderColor="rgba(150, 150, 150, 0.5)">In Pit</LegendItemDot>
          </div>
        </div>
      )}
    </div>
  )
}

const InfoPill: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => (
  <div
    {...props}
    className="truncate px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
    style={{
      background: 'rgba(20, 22, 27, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '6px',
      color: '#a0a4af',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      ...style
    }}
  >
    {children}
  </div>
)

const FlagPill: React.FC<{ color: string; bg: string; children: React.ReactNode }> = ({ color, bg, children }) => (
  <span className="animate-pulse px-3 py-1.5 text-xs font-bold" style={{ background: bg, border: `1px solid ${color}50`, borderRadius: '6px', color, boxShadow: `0 2px 12px ${color}30` }}>
    {children}
  </span>
)

const HoverInfo: React.FC<{ car: { driverCode: string; driverNumber: number; teamColor: string; currentLap: number; position: number | null; progressSource: string; mappingConfidence: number }; sessionTime: number; laps: LapRow[] }> = ({ car, sessionTime, laps }) => {
  const driverLaps = laps.filter(l => l.driverNumber === car.driverNumber).sort((a, b) => a.lapEndSeconds - b.lapEndSeconds)
  let compound = '—', compoundColor = '#666'
  for (let i = driverLaps.length - 1; i >= 0; i--) {
    if (driverLaps[i].lapEndSeconds <= sessionTime || i === 0) {
      const raw = (driverLaps[i]. tyreCompound || '').toUpperCase()
      if (raw.includes('SOFT')) { compound = 'SOFT'; compoundColor = '#e8002d' }
      else if (raw.includes('MEDIUM')) { compound = 'MEDIUM'; compoundColor = '#ffd700' }
      else if (raw.includes('HARD')) { compound = 'HARD'; compoundColor = '#f0f0f0' }
      else if (raw.includes('INTER')) { compound = 'INTER'; compoundColor = '#39b54a' }
      else if (raw.includes('WET')) { compound = 'WET'; compoundColor = '#0067ff' }
      break
    }
  }

  return (
    <div
      className="absolute right-3 top-2 z-20 max-w-[210px] px-3 py-2 text-[11px] font-mono pointer-events-none"
      style={{
        background: 'rgba(20, 22, 27, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        color: '#e2e4e8',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="font-bold text-[14px]" style={{ color: car.teamColor || '#fff' }}>{car.driverCode}</div>
      <div className="mt-1 text-[11px]" style={{ color: '#8b8d94' }}>P{car.position || '—'} · Lap {car.currentLap || '—'}</div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: compoundColor, boxShadow: `0 0 8px ${compoundColor}60` }} />
        <span style={{ color: '#a0a4af' }}>{compound}</span>
      </div>
      <div className="mt-1 text-[10px]" style={{ color: '#6b6d72' }}>{car.progressSource.toUpperCase()} · Q{Math.round(car.mappingConfidence * 100)}</div>
    </div>
  )
}

const LegendItem: React.FC<{ color: string; borderColor?: string; dashed?: boolean; children: React.ReactNode }> = ({ color, borderColor, dashed, children }) => (
  <div className="flex items-center gap-2" style={{ color: '#6b6d72' }}>
    <span className="h-2 w-5 rounded-sm" style={{ background: dashed ? color : `linear-gradient(90deg, ${color} 0%, ${color} 50%, ${color} 100%)`, border: borderColor ? `1px dashed ${borderColor}` : undefined, boxShadow: dashed ? undefined : '0 0 6px rgba(255,180,50,0.5)' }} />
    {children}
  </div>
)

const LegendItemDot: React.FC<{ color: string; borderColor: string; children: React.ReactNode }> = ({ color, borderColor, children }) => (
  <div className="flex items-center gap-2" style={{ color: '#6b6d72' }}>
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, border: `1px solid ${borderColor}` }} />
    {children}
  </div>
)
