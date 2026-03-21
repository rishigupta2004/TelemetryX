import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useDriverStore } from '../stores/driverStore'
import { useTrackViewport } from '../hooks/useTrackViewport'
import { useTrackData } from '../hooks/useTrackData'
import { useCarPositions } from '../hooks/useCarPositions'
import type { CarPosition } from '../hooks/useCarPositions'
import { useSessionTime } from '../lib/timeUtils'
import { getRaceControlState } from '../lib/raceControlState'
import { buildPathLookup, computeArcLengths, interpolateFromLookup, Point } from '../lib/trackGeometry'
import { normalizeLoopProgress } from '../lib/trackHelpers'
import type { Driver, LapRow } from '../types'

// ============================================================================
// TYPES
// ============================================================================

interface AnimatedTrackMapProps {
  cleanHud?: boolean
  perspective?: {
    rotateX: number
    rotateZ: number
  }
  showDRSZones?: boolean
  showSectors?: boolean
  showPitLane?: boolean
  showPerspectiveControls?: boolean
}

interface ResolvedCar {
  driverCode: string
  driverNumber: number
  teamColor: string
  progress: number
  currentLap: number
  displayPosition: number | null
  isInPit: boolean
}

interface TrackFlagState {
  trackFlag: string | null
  isSafetyCar: boolean
  isVSC: boolean
  isRedFlag: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECTOR_COLORS = [
  { stroke: '#FF3B6B', glow: '#FF3B6B', bg: 'rgba(255, 59, 107, 0.15)' },
  { stroke: '#00D2FF', glow: '#00D2FF', bg: 'rgba(0, 210, 255, 0.15)' },
  { stroke: '#c17bff', glow: '#c17bff', bg: 'rgba(193, 123, 255, 0.15)' }
]

const DRS_COLOR = 'rgba(255, 180, 50, 0.5)'
const DRS_GLOW = 'rgba(255, 180, 50, 0.8)'
const PIT_LANE_COLOR = 'rgba(180, 180, 180, 0.2)'
const TRACK_BORDER_COLOR = 'rgba(255, 255, 255, 0.2)'
const TRACK_CENTER_COLOR = 'rgba(255, 255, 255, 0.08)'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AnimatedTrackMap({
  cleanHud = false,
  perspective = { rotateX: 42, rotateZ: -3 },
  showDRSZones = true,
  showSectors = true,
  showPitLane = true,
  showPerspectiveControls = false
}: AnimatedTrackMapProps) {
  // Local state for interactive perspective controls
  const [localRotateX, setLocalRotateX] = useState(perspective.rotateX)
  const [localRotateZ, setLocalRotateZ] = useState(perspective.rotateZ)
  
  const effectivePerspective = {
    rotateX: localRotateX,
    rotateZ: localRotateZ
  }
  const svgRef = useRef<SVGSVGElement>(null)
  const animationRef = useRef<number | null>(null)
  const dotPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map())

  // Stores
  const replayPosition = usePlaybackStore(s => s.replayPosition)
  const setReplayPosition = usePlaybackStore(s => s.setReplayPosition)
  const isPlaying = usePlaybackStore(s => s.isPlaying)
  const sessionData = useSessionStore(s => s.sessionData)
  const lapsFromStore = useSessionStore(s => s.laps)
  
  // Driver selection
  const primaryDriver = useDriverStore(s => s.primaryDriver)
  const compareDriver = useDriverStore(s => s.compareDriver)
  const selectPrimary = useDriverStore(s => s.selectPrimary)
  const selectCompare = useDriverStore(s => s.selectCompare)

  // Track data
  const { viewport, containerRef } = useTrackViewport(true)
  const trackData = useTrackData(sessionData, viewport)
  
  // Session time
  const sessionTime = useSessionTime()
  const flagSessionTime = Math.round(sessionTime * 8) / 8

  // Car displayPositions
  const liveCarPositions = useCarPositions()

  // Local state
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  // Race control flags
  const sortedRaceControl = useMemo(() => {
    const raceControl = sessionData?.raceControl
    if (!raceControl || !raceControl.length) return []
    return [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
  }, [sessionData?.raceControl])

  const currentFlags = useMemo((): TrackFlagState => {
    if (!sortedRaceControl.length) {
      return { trackFlag: null, isSafetyCar: false, isVSC: false, isRedFlag: false }
    }
    const state = getRaceControlState(
      sortedRaceControl,
      flagSessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    const trackFlag = state.trackFlag
    return { trackFlag, isSafetyCar: state.isSafetyCar, isVSC: state.isVSC, isRedFlag: trackFlag === 'RED' }
  }, [flagSessionTime, sortedRaceControl, sessionData?.metadata?.raceStartSeconds])

  // Timing fallback displayPositions
  const timingFallbackPositions = useMemo(() => {
    if (!sessionData?.drivers?.length) return []
    const drivers = sessionData.drivers
    const laps = lapsFromStore.length ? lapsFromStore : sessionData.laps ?? []
    
    if (!laps.length) {
      return drivers.map((driver, idx) => ({
        driverCode: driver.code,
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#fff',
        progress: 0,
        currentLap: 1,
        displayPosition: idx + 1,
        isInPit: false
      }))
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
      const unwrapped = Math.max(0, lapNumber - 1) + progress
      const lapPosition = lap?.position ?? 99
      const offset = lapPosition < 99 ? (lapPosition - 1) / Math.max(1, drivers.length) : 0
      return {
        driverCode: driver.code,
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#fff',
        progress: (unwrapped - offset * 0.08 + 1) % 1,
        currentLap: lapNumber,
        displayPosition: lapPosition,
        isInPit: false
      }
    }).sort((a, b) => (a.displayPosition || 99) - (b.displayPosition || 99))
  }, [sessionData, lapsFromStore, sessionTime])

  // Combined car displayPositions
  const carPositions = useMemo(() => {
    if (liveCarPositions.length) return liveCarPositions
    return timingFallbackPositions
  }, [liveCarPositions, timingFallbackPositions])

  // Resolved cars with displayPositions
  const resolvedCars = useMemo((): ResolvedCar[] => {
    if (!trackData || !trackData.trackLookup) return []
    
    // Use replay displayPosition if available and not playing live
    const useReplayPosition = !isPlaying && replayPosition > 0
    
    if (useReplayPosition) {
      // Calculate time from replay displayPosition
      const duration = sessionData?.metadata?.duration ?? 0
      const replayTime = replayPosition * duration
      
      // Recalculate displayPositions for replay time
      return carPositions.map(car => {
        const driverLaps = lapsFromStore.filter(l => l.driverNumber === car.driverNumber)
          .sort((a, b) => a.lapStartSeconds - b.lapStartSeconds)
        
        let carProgress = 0
        let currentLap = 1
        
        for (const lap of driverLaps) {
          if (replayTime >= lap.lapStartSeconds && replayTime <= lap.lapEndSeconds) {
            const lapDuration = lap.lapEndSeconds - lap.lapStartSeconds
            carProgress = (replayTime - lap.lapStartSeconds) / lapDuration
            currentLap = lap.lapNumber
            break
          } else if (replayTime > lap.lapEndSeconds) {
            currentLap = lap.lapNumber + 1
          }
        }
        
        return {
          ...car,
          displayPosition: (car as CarPosition).position ?? 99,
          progress: (Math.max(0, currentLap - 1) + carProgress) % 1,
          currentLap
        }
      })
    }
    
    return carPositions.map(car => ({
      ...car,
      displayPosition: (car as CarPosition).position ?? 99,
      progress: normalizeLoopProgress(car.progress)
    }))
  }, [trackData, carPositions, replayPosition, isPlaying, sessionData?.metadata?.duration, lapsFromStore])

  // Built once per track — O(1) per car, no SVG DOM access
  const trackLookup = useMemo(() => {
    if (!trackData?.points?.length) return null
    const arcLens = computeArcLengths(trackData.points)
    return buildPathLookup(trackData.points, arcLens, 10_000)
  }, [trackData?.points])

  const dotPositions = useMemo(() => {
    const displayPositions = new Map<number, { x: number; y: number }>()
    if (!resolvedCars.length) return displayPositions

    if (trackLookup) {
      for (const car of resolvedCars) {
        const pt = interpolateFromLookup(trackLookup, car.progress)
        displayPositions.set(car.driverNumber, { x: pt.x, y: pt.y })
      }
    } else if (trackData?.points?.length) {
      const points = trackData.points
      for (const car of resolvedCars) {
        const idx = car.progress * (points.length - 1)
        const i0 = Math.floor(idx)
        const i1 = Math.min(i0 + 1, points.length - 1)
        const t = idx - i0
        const p0 = points[i0]; const p1 = points[i1]
        if (p0 && p1) {
          displayPositions.set(car.driverNumber, {
            x: p0.x + (p1.x - p0.x) * t,
            y: p0.y + (p1.y - p0.y) * t,
          })
        }
      }
    }
    dotPositionsRef.current = displayPositions
    return displayPositions
  }, [resolvedCars, trackData, trackLookup])

  // SVG viewBox
  const viewBox = useMemo(() => {
    if (!trackData) return '0 0 800 600'
    
    const { bounds, width, height } = trackData
    
    // Guard against invalid bounds
    if (!bounds || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) ||
        !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) {
      // Calculate bounds from points if bounds are invalid
      if (trackData.points?.length) {
        const xs = trackData.points.map(p => p.x)
        const ys = trackData.points.map(p => p.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const padding = 60
        return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
      }
      return '0 0 800 600'
    }
    
    const padding = 60
    return `${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${height + padding * 2}`
  }, [trackData])

  // Track path string
  const trackPathString = useMemo(() => {
    if (!trackData?.mainPolylinePoints) return ''
    const points = trackData.mainPolylinePoints.split(' ').map(p => {
      const [x, y] = p.split(',').map(Number)
      return { x, y }
    })
    if (!points.length) return ''
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`
    }
    return d
  }, [trackData])

  // Pit lane path string
  const pitLanePathString = useMemo(() => {
    if (!trackData?.pitLanePolylinePoints || !showPitLane) return ''
    const points = trackData.pitLanePolylinePoints.split(' ').map(p => {
      const [x, y] = p.split(',').map(Number)
      return { x, y }
    })
    if (!points.length) return ''
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`
    }
    return d
  }, [trackData, showPitLane])

  // DRS zone paths
  const drsZonePaths = useMemo(() => {
    if (!trackData?.drsPolylines || !showDRSZones) return []
    return trackData.drsPolylines
      .filter(drs => drs.points)
      .map(drs => {
        const points = drs.points!.split(' ').map(p => {
          const [x, y] = p.split(',').map(Number)
          return { x, y }
        })
        if (points.length < 2) return ''
        let d = `M ${points[0].x} ${points[0].y}`
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`
        }
        return d
      })
      .filter(Boolean)
  }, [trackData, showDRSZones])

  // Sector lines
  const sectorLines = useMemo(() => {
    if (!trackData?.sectorMarkers || !showSectors) return []
    return trackData.sectorMarkers.map((sector, idx) => {
      const point = trackData.points[sector.idx]
      if (!point) return null
      
      const color = SECTOR_COLORS[idx % SECTOR_COLORS.length]
      // Calculate tangent direction for the line
      const nextIdx = (sector.idx + 1) % trackData.points.length
      const nextPoint = trackData.points[nextIdx]
      if (!nextPoint) return null
      
      const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x)
      const lineLength = 40
      
      return {
        x1: point.x - Math.cos(angle) * lineLength,
        y1: point.y - Math.sin(angle) * lineLength,
        x2: point.x + Math.cos(angle) * lineLength,
        y2: point.y + Math.sin(angle) * lineLength,
        color,
        label: sector.label
      }
    }).filter(Boolean)
  }, [trackData, showSectors])

  // ============================================================================
  // INTERACTION HANDLERS
  // ============================================================================

  const handleScrubberDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const displayPosition = Math.max(0, Math.min(1, x / rect.width))
    setReplayPosition(displayPosition)
  }, [isDragging, setReplayPosition])

  const handleScrubberClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const displayPosition = Math.max(0, Math.min(1, x / rect.width))
    setReplayPosition(displayPosition)
  }, [setReplayPosition])

  const handleDotClick = useCallback((driverCode: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      selectCompare(compareDriver === driverCode ? null : driverCode)
    } else {
      selectPrimary(driverCode)
    }
  }, [compareDriver, selectPrimary, selectCompare])

  // ============================================================================
  // RENDER
  // ============================================================================

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
      {/* 2.5D Scene Container */}
      <div
        className="absolute inset-0"
        style={{
          perspective: '1000px',
          perspectiveOrigin: '50% 50%'
        }}
      >
        <div
          className="h-full w-full"
          style={{
            transform: `rotateX(var(--track-rotate-x, ${effectivePerspective.rotateX}deg)) rotateZ(var(--track-rotate-z, ${effectivePerspective.rotateZ}deg))`,
            transformStyle: 'preserve-3d'
          }}
        >
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="h-full w-full"
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))'
            }}
          >
            {/* Track border (outer) */}
            <path
              d={trackPathString}
              fill="none"
              stroke={TRACK_BORDER_COLOR}
              strokeWidth="32"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Track surface */}
            <path
              d={trackPathString}
              fill="none"
              stroke="#1a1d24"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Track center line */}
            <path
              d={trackPathString}
              fill="none"
              stroke={TRACK_CENTER_COLOR}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 12"
            />
            
            {/* Pit lane */}
            {pitLanePathString && (
              <>
                <path
                  d={pitLanePathString}
                  fill="none"
                  stroke={PIT_LANE_COLOR}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 8"
                />
                <path
                  d={pitLanePathString}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 6"
                />
              </>
            )}
            
            {/* DRS Zones */}
            {drsZonePaths.map((drsPath, idx) => (
              <g key={`drs-${idx}`}>
                <path
                  d={drsPath}
                  fill="none"
                  stroke={DRS_COLOR}
                  strokeWidth="20"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={drsPath}
                  fill="none"
                  stroke={DRS_GLOW}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: 'blur(2px)'
                  }}
                />
              </g>
            ))}
            
            {/* Sector lines */}
            {sectorLines.map((sector, idx) => sector && (
              <g key={`sector-${idx}`}>
                <line
                  x1={sector.x1}
                  y1={sector.y1}
                  x2={sector.x2}
                  y2={sector.y2}
                  stroke={sector.color.stroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 6px ${sector.color.glow})`
                  }}
                />
                <text
                  x={(sector.x1 + sector.x2) / 2}
                  y={(sector.y1 + sector.y2) / 2 - 8}
                  fill={sector.color.stroke}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{
                    filter: `drop-shadow(0 0 4px ${sector.color.glow})`
                  }}
                >
                  {sector.label}
                </text>
              </g>
            ))}
            
            {/* Driver dots */}
            {resolvedCars.map(car => {
              const pos = dotPositions.get(car.driverNumber)
              // Use fallback position if pos is missing
              const displayPos = pos || { x: 400, y: 300 }
              
              const isPrimary = car.driverCode === primaryDriver
              const isCompare = car.driverCode === compareDriver
              const isHovered = car.driverCode === hoveredDriver
              const radius = isPrimary || isCompare ? 10 : 8
              
              return (
                <g
                  key={car.driverNumber}
                  onClick={(e) => handleDotClick(car.driverCode, e)}
                  onMouseEnter={() => setHoveredDriver(car.driverCode)}
                  onMouseLeave={() => setHoveredDriver(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer glow for primary/compare */}
                  {(isPrimary || isCompare) && (
                    <circle
                      cx={displayPos.x}
                      cy={displayPos.y}
                      r={radius + 4}
                      fill="none"
                      stroke={car.teamColor}
                      strokeWidth="2"
                      opacity="0.6"
                      style={{
                        filter: `drop-shadow(0 0 8px ${car.teamColor})`
                      }}
                    />
                  )}
                  
                  {/* Main dot */}
                  <circle
                    cx={displayPos.x}
                    cy={displayPos.y}
                    r={radius}
                    fill={car.teamColor}
                    stroke={isHovered ? '#fff' : 'rgba(0, 0, 0, 0.5)'}
                    strokeWidth={isHovered ? 2 : 1}
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 12px ${car.teamColor})` : `drop-shadow(0 0 4px ${car.teamColor})`
                    }}
                  />
                  
                  {/* Driver code label */}
                  <text
                    x={displayPos.x}
                    y={displayPos.y + radius + 12}
                    fill={isPrimary || isCompare ? car.teamColor : 'rgba(255, 255, 255, 0.7)'}
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {car.driverCode}
                  </text>
                  
                  {/* Position number */}
                  {car.displayPosition && (
                    <text
                      x={displayPos.x - radius - 4}
                      y={displayPos.y + 3}
                      fill="rgba(255, 255, 255, 0.8)"
                      fontSize="7"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {car.displayPosition}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* HUD Overlay */}
      {!cleanHud && (
        <>
          {/* Top left info */}
          <div className="absolute left-3 top-2 z-20 flex flex-col gap-1.5">
            <InfoPill>{sessionData?.trackGeometry?.name || 'Track'}</InfoPill>
            <InfoPill>LAP {Math.floor(sessionTime / 90) + 1}</InfoPill>
            
            {currentFlags.isRedFlag && (
              <FlagPill color="#fca5a5" bg="rgba(40, 10, 10, 0.95)">RED FLAG</FlagPill>
            )}
            {currentFlags.isSafetyCar && !currentFlags.isRedFlag && (
              <FlagPill color="#fdba74" bg="rgba(40, 30, 10, 0.95)">SAFETY CAR</FlagPill>
            )}
            {currentFlags.isVSC && !currentFlags.isRedFlag && !currentFlags.isSafetyCar && (
              <FlagPill color="#fde047" bg="rgba(40, 35, 10, 0.95)">VIRTUAL SC</FlagPill>
            )}
          </div>

          {/* Top right - driver list */}
          <div className="absolute right-3 top-2 z-20 max-h-[60%] overflow-y-auto">
            <div className="flex flex-col gap-1">
              {resolvedCars.slice(0, 10).map(car => (
                <DriverChip
                  key={car.driverNumber}
                  car={car}
                  isPrimary={car.driverCode === primaryDriver}
                  isCompare={car.driverCode === compareDriver}
                  isHovered={car.driverCode === hoveredDriver}
                  onClick={(code) => handleDotClick(code, { ctrlKey: false, metaKey: false } as any)}
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 right-2 z-10 pointer-events-none" 
               style={{ background: 'rgba(20, 22, 27, 0.85)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '8px 12px' }}>
            <div className="flex flex-col gap-1.5 text-[10px]">
              <LegendItem color={DRS_COLOR} borderColor={DRS_GLOW}>DRS Zone</LegendItem>
              <LegendItem color={PIT_LANE_COLOR} dashed borderColor="rgba(255,255,255,0.2)">Pit Lane</LegendItem>
              {sectorLines.map((s, i) => s && (
                <LegendItem key={i} color={s.color.bg} borderColor={s.color.stroke}>{s.label}</LegendItem>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Replay Scrubber */}
      <div 
        className="absolute bottom-4 left-4 right-4 z-30"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleScrubberDrag}
        onClick={handleScrubberClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="relative h-8">
          {/* Progress bar background */}
          <div 
            className="absolute inset-y-2 left-0 right-0 rounded-full"
            style={{ background: 'rgba(30, 32, 40, 0.9)' }}
          />
          
          {/* Progress bar fill */}
          <div 
            className="absolute inset-y-2 left-0 rounded-full"
            style={{ 
              width: `${replayPosition * 100}%`,
              background: 'linear-gradient(90deg, #3671C6 0%, #6dd5ed 100%)'
            }}
          />
          
          {/* Scrubber handle */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg"
            style={{ 
              left: `calc(${replayPosition * 100}% - 8px)`,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
            }}
          />
          
          {/* Time labels */}
          <div className="absolute -bottom-5 left-0 text-[10px] text-text-muted">
            {formatTime(0)}
          </div>
          <div className="absolute -bottom-5 right-0 text-[10px] text-text-muted">
            {formatTime(sessionData?.metadata?.duration ?? 0)}
          </div>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted">
            {formatTime(replayPosition * (sessionData?.metadata?.duration ?? 0))}
          </div>
        </div>
      </div>

      {/* Clean mode indicator */}
      {cleanHud && (
        <div className="absolute top-2 right-2 z-20">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
               style={{ 
                 background: 'rgba(20, 22, 27, 0.8)', 
                 border: '1px solid rgba(255, 255, 255, 0.1)', 
                 borderRadius: '4px',
                 color: 'rgba(255, 255, 255, 0.5)'
               }}>
            CLEAN MODE
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const InfoPill: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => (
  <div {...props} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ 
    background: 'rgba(20, 22, 27, 0.9)', 
    border: '1px solid rgba(255, 255, 255, 0.08)', 
    borderRadius: '6px', 
    color: '#a0a4af', 
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)', 
    ...style 
  }}>
    {children}
  </div>
)

const FlagPill: React.FC<{ color: string; bg: string; children: React.ReactNode }> = ({ color, bg, children }) => (
  <span className="animate-pulse px-3 py-1.5 text-xs font-bold" style={{ 
    background: bg, 
    border: `1px solid ${color}50`, 
    borderRadius: '6px', 
    color, 
    boxShadow: `0 2px 12px ${color}30` 
  }}>
    {children}
  </span>
)

const DriverChip: React.FC<{
  car: ResolvedCar
  isPrimary: boolean
  isCompare: boolean
  isHovered: boolean
  onClick: (code: string) => void
}> = ({ car, isPrimary, isCompare, isHovered, onClick }) => (
  <div 
    onClick={() => onClick(car.driverCode)}
    className="flex items-center gap-2 px-2 py-1 cursor-pointer transition-all"
    style={{ 
      background: isPrimary || isCompare ? 'rgba(30, 32, 40, 0.95)' : 'rgba(20, 22, 27, 0.8)',
      border: `1px solid ${isPrimary || isCompare ? car.teamColor : 'rgba(255, 255, 255, 0.06)'}`,
      borderRadius: '6px',
      opacity: isHovered ? 1 : 0.85
    }}
  >
    <span className="w-3 h-3 rounded-full" style={{ background: car.teamColor }} />
    <span 
      className="text-[10px] font-bold"
      style={{ color: isPrimary || isCompare ? car.teamColor : '#a0a4af' }}
    >
      {car.driverCode}
    </span>
    <span className="text-[9px]" style={{ color: '#6b6d72' }}>
      P{car.displayPosition}
    </span>
  </div>
)

const LegendItem: React.FC<{ color: string; borderColor?: string; dashed?: boolean; children: React.ReactNode }> = ({ 
  color, 
  borderColor, 
  dashed, 
  children 
}) => (
  <div className="flex items-center gap-2" style={{ color: '#6b6d72' }}>
    <span 
      className="h-2 w-5 rounded-sm" 
      style={{ 
        background: dashed ? color : `linear-gradient(90deg, ${color} 0%, ${color} 50%, ${color} 100%)`, 
        border: borderColor ? `1px dashed ${borderColor}` : undefined,
        boxShadow: dashed ? undefined : `0 0 6px ${color}`
      }} 
    />
    {children}
  </div>
)

// ============================================================================
// UTILITIES
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default AnimatedTrackMap
