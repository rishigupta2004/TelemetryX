import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useCarPositions } from '../hooks/useCarPositions'
import {
  computeArcLengths,
  getBounds,
  interpolateAlongPath,
  normalizeToViewport,
  parseCenterline,
  toPolylinePoints
} from '../lib/trackGeometry'
import { getRaceControlStateFromSlice, upperBoundRaceControlByTimestamp } from '../lib/raceControlState'
import { useSessionTime } from '../lib/timeUtils'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'

interface TrackMapProps {
  compact?: boolean
}

type CornerBadge = {
  key: string
  number: number
  idx: number
  x: number
  y: number
}

type SectorMarker = {
  key: string
  label: string
  idx: number
  color: string
}

type DRSZone = {
  zoneNumber: number
  startIdx: number
  endIdx: number
  detectionIdx: number | null
}

type ProjectedPoint = {
  progress: number
  distance: number
  segmentIdx: number
}

function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return Object.values(value) as T[]
  return []
}

function toIndex(value: unknown, length: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const idx = Math.round(value)
  if (idx < 0 || idx >= length) return null
  return idx
}

function isClosedLoop(points: Array<{ x: number; y: number }>): boolean {
  if (points.length < 2) return false
  const a = points[0]
  const b = points[points.length - 1]
  return a.x === b.x && a.y === b.y
}

function rotateIndex(idx: number | null, length: number, startIdx: number): number | null {
  if (idx == null || length <= 0) return null
  if (idx < 0 || idx >= length) return null
  return (idx - startIdx + length) % length
}

function textColorForHex(hex: string): string {
  const fallback = '#ffffff'
  if (!hex || typeof hex !== 'string') return fallback
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return fallback
  const raw = m[1]
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? '#101214' : '#ffffff'
}

function buildCornerBadges(
  points: Array<{ x: number; y: number }>,
  corners: Array<{ number: number; idx: number }>
): CornerBadge[] {
  if (!points.length || !corners.length) return []
  const n = points.length
  const center = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }),
    { x: 0, y: 0 }
  )

  return corners.map((corner) => {
    const idx = corner.idx
    const p = points[idx]
    const prev = points[(idx - 2 + n) % n]
    const next = points[(idx + 2) % n]
    const tx = next.x - prev.x
    const ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    const nx = -ty / len
    const ny = tx / len
    const off = 24
    const c1 = { x: p.x + nx * off, y: p.y + ny * off }
    const c2 = { x: p.x - nx * off, y: p.y - ny * off }
    const d1 = (c1.x - center.x) ** 2 + (c1.y - center.y) ** 2
    const d2 = (c2.x - center.x) ** 2 + (c2.y - center.y) ** 2
    const c = d1 >= d2 ? c1 : c2
    return {
      key: `${corner.number}-${idx}`,
      number: corner.number,
      idx,
      x: c.x,
      y: c.y
    }
  })
}

function buildZonePoints(
  points: Array<{ x: number; y: number }>,
  startIdx: number,
  endIdx: number
): Array<{ x: number; y: number }> {
  if (!points.length) return []
  const n = points.length
  const out: Array<{ x: number; y: number }> = []
  let idx = startIdx % n
  const guardLimit = n + 2
  let guard = 0
  while (guard < guardLimit) {
    out.push(points[idx])
    if (idx === endIdx) break
    idx = (idx + 1) % n
    guard += 1
  }
  return out
}

function toTrackSpacePoint(x: number, y: number): { x: number; y: number } {
  return { x: -y, y: -x }
}

function projectPointToProgress(
  point: { x: number; y: number },
  path: Array<{ x: number; y: number }>,
  arcLengths: number[],
  hintSegmentIdx: number | null
): ProjectedPoint | null {
  if (path.length < 2 || arcLengths.length < 2) return null

  const firstSegment = 1
  const lastSegment = path.length - 1
  const total = arcLengths[arcLengths.length - 1]
  if (!Number.isFinite(total) || total <= 1e-9) return null

  let bestDistanceSq = Number.POSITIVE_INFINITY
  let bestArc = 0
  let bestSegmentIdx = firstSegment
  const evaluateSegment = (segmentIdx: number) => {
    if (segmentIdx < firstSegment || segmentIdx > lastSegment) return
    const i = segmentIdx
    const a = path[i - 1]
    const b = path[i]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const lenSq = vx * vx + vy * vy
    if (lenSq <= 1e-9) return

    const wx = point.x - a.x
    const wy = point.y - a.y
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq))
    const px = a.x + vx * t
    const py = a.y + vy * t
    const dx = point.x - px
    const dy = point.y - py
    const distSq = dx * dx + dy * dy

    if (distSq < bestDistanceSq) {
      bestDistanceSq = distSq
      bestArc = arcLengths[i - 1] + Math.sqrt(lenSq) * t
      bestSegmentIdx = i
    }
  }

  if (hintSegmentIdx != null && hintSegmentIdx >= firstSegment && hintSegmentIdx <= lastSegment) {
    const windowSize = 36
    const start = Math.max(firstSegment, hintSegmentIdx - windowSize)
    const end = Math.min(lastSegment, hintSegmentIdx + windowSize)
    for (let i = start; i <= end; i += 1) evaluateSegment(i)

    if (bestDistanceSq > 25600) {
      for (let i = firstSegment; i <= lastSegment; i += 1) evaluateSegment(i)
    }
  } else {
    for (let i = firstSegment; i <= lastSegment; i += 1) evaluateSegment(i)
  }
  return {
    progress: Math.max(0, Math.min(0.999, bestArc / total)),
    distance: Math.sqrt(bestDistanceSq),
    segmentIdx: bestSegmentIdx
  }
}

export function TrackMap({ compact = false }: TrackMapProps) {
  const sessionData = useSessionStore((s) => s.sessionData)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)
  const sessionTime = useSessionTime()
  const carPositions = useCarPositions()
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)
  const projectionHintByDriverRef = useRef<Map<string, number>>(new Map())

  const trackData = useMemo(() => {
    const geo = sessionData?.trackGeometry
    const rawCenterline = asArray<number[]>(geo?.centerline)
    if (!rawCenterline.length) return null

    const parsedPoints = parseCenterline(rawCenterline)
    const rawCount = parsedPoints.length
    const closed = isClosedLoop(parsedPoints)
    const loopPoints = closed ? parsedPoints.slice(0, -1) : parsedPoints
    const loopCount = loopPoints.length
    if (!loopCount) return null

    const startIndexRaw =
      toIndex((geo as any)?.start_finish?.index, rawCount) ??
      toIndex((geo as any)?.startPositionIndex, rawCount) ??
      0
    const startLoopRaw = closed && startIndexRaw === rawCount - 1 ? 0 : startIndexRaw
    const startLoop = Math.max(0, Math.min(startLoopRaw, loopCount - 1))

    const rotatedLoop =
      startLoop === 0
        ? loopPoints
        : [...loopPoints.slice(startLoop), ...loopPoints.slice(0, startLoop)]
    const orderedPoints = closed ? [...rotatedLoop, rotatedLoop[0]] : rotatedLoop

    const rawPoints = orderedPoints
    const rawArcLengths = computeArcLengths(rawPoints)
    const rawBounds = getBounds(rawPoints, 0)
    const rawWidth = Math.max(1, rawBounds.maxX - rawBounds.minX)
    const rawHeight = Math.max(1, rawBounds.maxY - rawBounds.minY)
    const rawDiagonal = Math.hypot(rawWidth, rawHeight)

    const points = normalizeToViewport(rawPoints, 1000, 620, 26)
    const arcLengths = computeArcLengths(points)
    const bounds = getBounds(points, 0)
    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)

    const corners = asArray<any>(geo?.corners)
      .map((corner, i) => {
        const cornerRawIdx = toIndex(corner?.index, rawCount)
        const cornerLoopRaw = closed && cornerRawIdx === rawCount - 1 ? 0 : cornerRawIdx
        const idx = rotateIndex(cornerLoopRaw, loopCount, startLoop)
        if (idx == null) return null
        const number = Number(corner?.number ?? i + 1)
        return { number: Number.isFinite(number) ? number : i + 1, idx }
      })
      .filter(Boolean) as Array<{ number: number; idx: number }>

    corners.sort((a, b) => a.number - b.number)

    const startIndex = 0

    const sectorColors = ['#ff6464', '#64ff64', '#6464ff']
    const sectorMarkers: SectorMarker[] = []
    const sectorsRaw = (geo as any)?.sectors
    if (Array.isArray(sectorsRaw)) {
      sectorsRaw.forEach((s: any, i: number) => {
        const endRawIdx = toIndex(s?.endIndex ?? s?.end_index, rawCount)
        const endLoopRaw = closed && endRawIdx === rawCount - 1 ? 0 : endRawIdx
        const idx = rotateIndex(endLoopRaw, loopCount, startLoop)
        if (idx == null) return
        sectorMarkers.push({
          key: `sector-${i}`,
          label: `S${i + 1}`,
          idx,
          color: sectorColors[i] || '#ffffff'
        })
      })
    } else if (sectorsRaw && typeof sectorsRaw === 'object') {
      Object.entries(sectorsRaw).forEach(([k, v]: [string, any], i: number) => {
        const endRawIdx = toIndex(v?.endIndex ?? v?.end_index, rawCount)
        const endLoopRaw = closed && endRawIdx === rawCount - 1 ? 0 : endRawIdx
        const idx = rotateIndex(endLoopRaw, loopCount, startLoop)
        if (idx == null) return
        const label = /1/.test(k) ? 'S1' : /2/.test(k) ? 'S2' : /3/.test(k) ? 'S3' : `S${i + 1}`
        sectorMarkers.push({
          key: `sector-${k}`,
          label,
          idx,
          color: sectorColors[i] || '#ffffff'
        })
      })
    }

    const drsRaw = asArray<any>((geo as any)?.drsZones ?? (geo as any)?.drs_zones)
    const drsZones: DRSZone[] = drsRaw
      .map((z: any, i: number) => {
        const startRaw = toIndex(z?.startIndex ?? z?.start_index ?? z?.activation_index, rawCount)
        const endRaw = toIndex(z?.endIndex ?? z?.end_index, rawCount)
        const detectionRaw = toIndex(z?.detectionIndex ?? z?.detection_index, rawCount)
        const startLoopRaw = closed && startRaw === rawCount - 1 ? 0 : startRaw
        const endLoopRaw = closed && endRaw === rawCount - 1 ? 0 : endRaw
        const detectionLoopRaw = closed && detectionRaw === rawCount - 1 ? 0 : detectionRaw
        const startIdx = rotateIndex(startLoopRaw, loopCount, startLoop)
        const endIdx = rotateIndex(endLoopRaw, loopCount, startLoop)
        const detectionIdx = rotateIndex(detectionLoopRaw, loopCount, startLoop)
        if (startIdx == null || endIdx == null) return null
        return {
          zoneNumber: Number(z?.zone_number ?? i + 1),
          startIdx,
          endIdx,
          detectionIdx
        }
      })
      .filter(Boolean) as DRSZone[]

    const pitRaw = (geo as any)?.pitLane ?? (geo as any)?.pit_lane
    const pitEntryRaw = toIndex(pitRaw?.entryIndex ?? pitRaw?.entry_index, rawCount)
    const pitExitRaw = toIndex(pitRaw?.exitIndex ?? pitRaw?.exit_index, rawCount)
    const pitEntryLoopRaw = closed && pitEntryRaw === rawCount - 1 ? 0 : pitEntryRaw
    const pitExitLoopRaw = closed && pitExitRaw === rawCount - 1 ? 0 : pitExitRaw
    const pitEntryIdx = rotateIndex(pitEntryLoopRaw, loopCount, startLoop)
    const pitExitIdx = rotateIndex(pitExitLoopRaw, loopCount, startLoop)

    return {
      points,
      arcLengths,
      rawPoints,
      rawArcLengths,
      rawDiagonal,
      bounds,
      width,
      height,
      corners,
      startIndex,
      sectorMarkers,
      drsZones,
      pitEntryIdx,
      pitExitIdx
    }
  }, [sessionData?.trackGeometry])

  const sortedRaceControl = useMemo(() => {
    const raceControl = sessionData?.raceControl
    if (!raceControl || !raceControl.length) return []
    return [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
  }, [sessionData?.raceControl])

  const currentFlags = useMemo(() => {
    if (!sortedRaceControl.length) {
      return {
        trackFlag: null as string | null,
        isSafetyCar: false,
        isVSC: false,
        isRedFlag: false
      }
    }
    const endExclusive = upperBoundRaceControlByTimestamp(sortedRaceControl, sessionTime)
    const state = getRaceControlStateFromSlice(
      sortedRaceControl,
      endExclusive,
      sessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    const trackFlag = state.trackFlag
    const isRedFlag = trackFlag === 'RED'

    return {
      trackFlag,
      isSafetyCar: state.isSafetyCar,
      isVSC: state.isVSC,
      isRedFlag
    }
  }, [sortedRaceControl, sessionData?.metadata?.raceStartSeconds, sessionTime])

  const cornerBadges = useMemo(
    () => (trackData ? buildCornerBadges(trackData.points, trackData.corners) : []),
    [trackData]
  )

  useEffect(() => {
    projectionHintByDriverRef.current.clear()
  }, [trackData])

  if (!trackData) {
    return <div className="flex h-full items-center justify-center text-sm text-text-muted">Track layout not available</div>
  }

  const { points, arcLengths, rawPoints, rawArcLengths, rawDiagonal, bounds, width, height, startIndex, sectorMarkers, drsZones, pitEntryIdx, pitExitIdx } = trackData
  const mainPolylinePoints = useMemo(() => toPolylinePoints(points), [points])
  const drsPolylines = useMemo(
    () =>
      drsZones.map((zone) => {
        const segment = buildZonePoints(points, zone.startIdx, zone.endIdx)
        return { zone, points: segment.length >= 2 ? toPolylinePoints(segment) : null }
      }),
    [drsZones, points]
  )
  const startPoint = points[startIndex]
  const pPrev = points[(startIndex - 1 + points.length) % points.length]
  const pNext = points[(startIndex + 1) % points.length]
  const startAngle = (Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x) * 180) / Math.PI
  const viewBox = `${bounds.minX} ${bounds.minY} ${width} ${height}`

  const displayCars = useMemo(
    () => [...carPositions].sort((a, b) => (b.position || 99) - (a.position || 99)),
    [carPositions]
  )
  const hoveredCar = useMemo(
    () => (hoveredDriver ? displayCars.find((car) => car.driverCode === hoveredDriver) ?? null : null),
    [displayCars, hoveredDriver]
  )

  const liveProjectionTolerance = Math.max(35, rawDiagonal * 0.45)
  const REFERENCE_STYLE = true

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
      <div className="absolute left-3 top-2 z-20 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-zinc-300">
          {sessionData?.trackGeometry?.name || 'Track'}
        </span>
        {currentFlags.isRedFlag && (
          <span className="animate-pulse rounded border border-red-500/50 bg-red-600/40 px-3 py-1 text-sm font-bold text-red-300">
            RED FLAG
          </span>
        )}
        {currentFlags.isSafetyCar && !currentFlags.isRedFlag && (
          <span className="rounded border border-orange-400/50 bg-orange-500/30 px-3 py-1 text-sm font-bold text-orange-300">
            SAFETY CAR
          </span>
        )}
        {currentFlags.isVSC && !currentFlags.isRedFlag && !currentFlags.isSafetyCar && (
          <span className="rounded border border-orange-400/50 bg-orange-500/30 px-3 py-1 text-sm font-bold text-orange-300">
            VIRTUAL SAFETY CAR
          </span>
        )}
      </div>
      {hoveredCar && (
        <div className="absolute right-3 top-2 z-20 rounded border border-border bg-bg-card/95 px-2.5 py-1.5 text-[11px] font-mono text-text-primary shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div>{hoveredCar.driverCode}</div>
          <div className="text-text-muted">
            P{hoveredCar.position || '-'} | L{hoveredCar.currentLap || '-'}
          </div>
        </div>
      )}

      <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <polyline
          points={mainPolylinePoints}
          fill="none"
          stroke={REFERENCE_STYLE ? '#1a1d22' : '#111317'}
          strokeWidth={REFERENCE_STYLE ? 26 : 28}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={mainPolylinePoints}
          fill="none"
          stroke={REFERENCE_STYLE ? '#b7bcc2' : '#b8bcc0'}
          strokeWidth={REFERENCE_STYLE ? 18 : 19}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={mainPolylinePoints}
          fill="none"
          stroke={REFERENCE_STYLE ? '#4e5560' : '#3d4146'}
          strokeWidth={REFERENCE_STYLE ? 5 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {drsPolylines.map(({ zone, points: zonePolyline }) => {
          if (!zonePolyline) return null
          return (
            <g key={`drs-${zone.zoneNumber}`}>
              <polyline
                points={zonePolyline}
                fill="none"
                stroke={REFERENCE_STYLE ? '#d99552' : '#22c55e'}
                strokeWidth={REFERENCE_STYLE ? 7 : 8}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={REFERENCE_STYLE ? 0.92 : 0.75}
              />
              {!REFERENCE_STYLE && zone.detectionIdx != null && (
                <g>
                  <circle
                    cx={points[zone.detectionIdx].x}
                    cy={points[zone.detectionIdx].y}
                    r={4}
                    fill="#34d399"
                    opacity={0.85}
                  />
                  <text
                    x={points[zone.detectionIdx].x + 6}
                    y={points[zone.detectionIdx].y - 6}
                    fill="#34d399"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    DRS {zone.zoneNumber}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        <g transform={`translate(${startPoint.x} ${startPoint.y}) rotate(${startAngle})`}>
          <rect x={-7} y={-14} width={14} height={28} fill="#ffffff" opacity={0.95} />
          <rect x={-7} y={-14} width={7} height={7} fill="#111111" />
          <rect x={0} y={-7} width={7} height={7} fill="#111111" />
          <rect x={-7} y={0} width={7} height={7} fill="#111111" />
          <rect x={0} y={7} width={7} height={7} fill="#111111" />
        </g>

        {cornerBadges.map((corner) => (
          <g key={corner.key}>
            <circle cx={corner.x} cy={corner.y} r={10.5} fill="#3a3d43" stroke="#2a2d32" strokeWidth={1.5} />
            <text
              x={corner.x}
              y={corner.y + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize="12"
              fontFamily="monospace"
              fontWeight="700"
            >
              {corner.number}
            </text>
          </g>
        ))}

        {!REFERENCE_STYLE && sectorMarkers.map((sector) => {
          const p = points[sector.idx]
          return (
            <g key={sector.key}>
              <circle cx={p.x} cy={p.y} r={6.5} fill={sector.color} opacity={0.85} />
              <text
                x={p.x + 9}
                y={p.y + 4}
                fill={sector.color}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="800"
              >
                {sector.label}
              </text>
            </g>
          )
        })}

        {!REFERENCE_STYLE && pitEntryIdx != null && (
          <g>
            <circle cx={points[pitEntryIdx].x} cy={points[pitEntryIdx].y} r={5} fill="#f59e0b" opacity={0.9} />
            <text
              x={points[pitEntryIdx].x + 8}
              y={points[pitEntryIdx].y + 3}
              fill="#f59e0b"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="700"
            >
              PIT IN
            </text>
          </g>
        )}
        {!REFERENCE_STYLE && pitExitIdx != null && (
          <g>
            <circle cx={points[pitExitIdx].x} cy={points[pitExitIdx].y} r={5} fill="#f59e0b" opacity={0.9} />
            <text
              x={points[pitExitIdx].x + 8}
              y={points[pitExitIdx].y + 3}
              fill="#f59e0b"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="700"
            >
              PIT OUT
            </text>
          </g>
        )}

        {displayCars.map((car) => {
          let pos = interpolateAlongPath(points, car.progress, arcLengths)
          if (car.hasLivePosition && car.x != null && car.y != null) {
            const trackPoint = toTrackSpacePoint(car.x, car.y)
            const projected = projectPointToProgress(
              trackPoint,
              rawPoints,
              rawArcLengths,
              projectionHintByDriverRef.current.get(car.driverCode) ?? null
            )
            if (projected && projected.distance <= liveProjectionTolerance) {
              projectionHintByDriverRef.current.set(car.driverCode, projected.segmentIdx)
              pos = interpolateAlongPath(points, projected.progress, arcLengths)
            }
          }
          const isHovered = hoveredDriver === car.driverCode
          const isPrimary = primaryDriver === car.driverCode
          const isCompare = compareDriver === car.driverCode
          const radius = compact ? 11 : 16
          const bubbleFill = car.teamColor || '#6b7280'
          const codeColor = textColorForHex(bubbleFill)
          const isInPit = Boolean((car as any).isInPit)

          return (
            <g
              key={car.driverNumber}
              onMouseEnter={() => setHoveredDriver(car.driverCode)}
              onMouseLeave={() => setHoveredDriver(null)}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey) {
                  selectCompare(isCompare ? null : car.driverCode)
                  return
                }
                selectPrimary(car.driverCode)
              }}
              style={{
                cursor: 'pointer',
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                transition: 'transform 0.2s linear'
              }}
            >
              <circle
                cx={0}
                cy={0}
                r={isHovered ? radius + 2 : radius}
                fill={bubbleFill}
                opacity={isInPit ? 0.45 : 1}
                stroke={isPrimary ? '#ffffff' : isCompare ? '#0090ff' : isHovered ? '#ffffff' : '#111111'}
                strokeWidth={isPrimary || isCompare ? 3 : isHovered ? 2.4 : 1.4}
              />
              <text
                x={0}
                y={0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={codeColor}
                fontSize={compact ? '10' : '12'}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="800"
              >
                {car.driverCode}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="absolute right-3 top-2 z-10 rounded-md border border-white/15 bg-black/65 px-2 py-1 text-[11px] text-zinc-200">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-200 ring-1 ring-white/20" />
          <span>Cars</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-500/60 ring-1 ring-white/10" />
          <span>PIT (dimmed)</span>
        </div>
      </div>
    </div>
  )
}
