import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useCarPositions, type CarPosition } from '../hooks/useCarPositions'
import {
  buildPathLookup,
  computeArcLengths,
  getBounds,
  interpolateFromLookup,
  parseCenterline,
  toPolylinePoints
} from '../lib/trackGeometry'
import { TRACK_LOOKUP_TABLE_SIZE } from '../lib/constants'
import { getRaceControlStateFromSlice, upperBoundRaceControlByTimestamp } from '../lib/raceControlState'
import startFinishPoints from '../data/start_finish_points.json'
import circuitFolderAliases from '../data/circuit_folder_aliases.json'
import { useSessionTime } from '../lib/timeUtils'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import type { LapRow } from '../types'

interface TrackMapProps {
  compact?: boolean
  mode?: 'full' | 'minimap'
}

type CornerBadge = {
  key: string
  number: number
  name: string | null
  idx: number
  x: number
  y: number
}

type SectorMarker = {
  key: string
  label: string
  idx: number
  color: string
  glowColor: string
}

type DRSZone = {
  zoneNumber: number
  startIdx: number
  endIdx: number
  detectionIdx: number | null
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

// Threshold for matching start-finish to centerline, in the same units as the centerline.
// F1 centerlines use raw positional units (~meter scale), so threshold is generous.
const START_FINISH_MATCH_THRESHOLD = Infinity // always accept nearest

function nearestPointIndex(
  points: Array<{ x: number; y: number }>,
  lon: number,
  lat: number
): { idx: number; d2: number } | null {
  if (!points.length) return null
  let bestIdx = 0
  let bestD2 = Number.POSITIVE_INFINITY
  for (let i = 0; i < points.length; i += 1) {
    const dx = points[i].x - lon
    const dy = points[i].y - lat
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      bestIdx = i
    }
  }
  return { idx: bestIdx, d2: bestD2 }
}

function normalizeCircuitKey(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/grand prix/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function detectCircuitFolder(trackName: string | null | undefined, raceName: string | null | undefined): string | null {
  const key = `${normalizeCircuitKey(trackName)} ${normalizeCircuitKey(raceName)}`.trim()
  if (!key) return null
  const folderRules = Array.isArray(startFinishPoints)
    ? (startFinishPoints as Array<{ circuitFolder?: string }>)
      .map((row) => String(row.circuitFolder || '').trim().toLowerCase())
      .filter(Boolean)
      .filter((value, idx, arr) => arr.indexOf(value) === idx)
      .map((folder) => ({ token: folder.replace(/_/g, ' '), folder }))
    : []
  const explicitRules: Array<{ token: string; folder: string }> = Array.isArray(circuitFolderAliases)
    ? (circuitFolderAliases as Array<{ token?: string; folder?: string }>)
      .map((row) => ({ token: normalizeCircuitKey(row.token), folder: String(row.folder || '').toLowerCase() }))
      .filter((row) => row.token.length > 0 && row.folder.length > 0)
    : []
  const rules: Array<{ token: string; folder: string }> = [...folderRules, ...explicitRules]
  for (const rule of rules) {
    if (key.includes(rule.token)) return rule.folder
  }
  return null
}

function resolveStartFinishFallbackIndex(
  points: Array<{ x: number; y: number }>,
  trackName: string | null | undefined,
  raceName: string | null | undefined
): number | null {
  if (!points.length || !Array.isArray(startFinishPoints) || !startFinishPoints.length) return null
  const wantedFolder = detectCircuitFolder(trackName, raceName)
  const candidates = (startFinishPoints as Array<{ lon: number; lat: number; circuitFolder?: string }>).filter((row) =>
    wantedFolder ? String(row.circuitFolder || '').toLowerCase() === wantedFolder : true
  )
  if (wantedFolder && candidates.length === 0) return null
  let best: { idx: number; d2: number } | null = null
  const rows = candidates.length ? candidates : (startFinishPoints as Array<{ lon: number; lat: number }>)
  for (const row of rows) {
    if (!Number.isFinite(row.lon) || !Number.isFinite(row.lat)) continue
    const candidate = nearestPointIndex(points, row.lon, row.lat)
    if (!candidate) continue
    if (!best || candidate.d2 < best.d2) best = candidate
  }
  if (!best) return null
  // No hard threshold — always return the best-matching index.
  // Previously used a 0.2° threshold which was wrong because centerlines are in F1 meter-scale units.
  return best.idx
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
  corners: Array<{ number: number; idx: number; name: string | null }>
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
    const off = 26
    const c1 = { x: p.x + nx * off, y: p.y + ny * off }
    const c2 = { x: p.x - nx * off, y: p.y - ny * off }
    const d1 = (c1.x - center.x) ** 2 + (c1.y - center.y) ** 2
    const d2 = (c2.x - center.x) ** 2 + (c2.y - center.y) ** 2
    const c = d1 >= d2 ? c1 : c2
    return { key: `${corner.number}-${idx}`, number: corner.number, name: corner.name, idx, x: c.x, y: c.y }
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

function normalizeLoopProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  const normalized = progress % 1
  return normalized < 0 ? normalized + 1 : normalized
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function easeInOut(value: number): number {
  const t = clamp(value, 0, 1)
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function blendPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const weight = easeInOut(t)
  return { x: lerp(a.x, b.x, weight), y: lerp(a.y, b.y, weight) }
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string | CanvasGradient,
  lineWidth: number,
  dash: number[] = [],
  glowColor?: string,
  glowBlur?: number
) {
  if (!pts || pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (dash.length) ctx.setLineDash(dash)
  else ctx.setLineDash([])

  if (glowColor && glowBlur) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = glowBlur
  } else {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

function drawLabelPill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, bg: string) {
  ctx.save()
  const w = label.length * 7 + 14
  const h = 16
  ctx.translate(x - w / 2, y - h / 2)

  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 8)
  ctx.fillStyle = bg
  ctx.fill()

  ctx.lineWidth = 1
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.7
  ctx.stroke()

  ctx.globalAlpha = 1.0
  ctx.fillStyle = color
  ctx.font = '700 9px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, w / 2, h / 2 + 0.5)
  ctx.restore()
}

export function TrackMap({ compact = false, mode = 'full' }: TrackMapProps) {
  const isMinimap = mode === 'minimap'
  const isCompact = compact || isMinimap
  const sessionData = useSessionStore((s) => s.sessionData)
  const lapsFromStore = useSessionStore((s) => s.laps)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)
  const sessionTime = useSessionTime()
  const flagSessionTime = Math.round(sessionTime * 8) / 8
  const carPositions = useCarPositions()
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ width: 1000, height: 620 })
  const containerRef = useRef<HTMLDivElement>(null)
  const staticCanvasRef = useRef<HTMLCanvasElement>(null)
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null)
  const hoveredDriverRef = useRef<string | null>(null)
  const primaryDriverRef = useRef<string | null>(null)
  const compareDriverRef = useRef<string | null>(null)
  const renderRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

    // Use fallback first - the coordinate-based matching is more reliable
    const fallbackStartLoopIndex = resolveStartFinishFallbackIndex(
      loopPoints,
      (geo as any)?.name ?? null,
      sessionData?.metadata?.raceName ?? null
    )

    const explicitStartIndexRaw =
      toIndex((geo as any)?.start_finish?.index, rawCount) ??
      toIndex((geo as any)?.startPositionIndex, rawCount)

    // Use fallback if explicit index is 0 or null (0 is often wrong)
    const useFallback = fallbackStartLoopIndex != null && (explicitStartIndexRaw == null || explicitStartIndexRaw === 0)

    const startIndexRaw = useFallback
      ? (closed ? Math.min(fallbackStartLoopIndex, Math.max(0, rawCount - 2)) : fallbackStartLoopIndex)
      : (explicitStartIndexRaw ?? 0)
    const startLoopRaw = closed && startIndexRaw === rawCount - 1 ? 0 : startIndexRaw
    const startLoop = Math.max(0, Math.min(startLoopRaw, loopCount - 1))

    const rotatedLoop =
      startLoop === 0
        ? loopPoints
        : [...loopPoints.slice(startLoop), ...loopPoints.slice(0, startLoop)]
    const orderedPoints = closed ? [...rotatedLoop, rotatedLoop[0]] : rotatedLoop

    const rawPoints = orderedPoints
    const rawBounds = getBounds(rawPoints, 24)

    const viewportWidth = Math.max(320, viewport.width)
    const viewportHeight = Math.max(220, viewport.height)
    const viewportPadding = 28
    const sourceWidth = Math.max(1e-9, rawBounds.maxX - rawBounds.minX)
    const sourceHeight = Math.max(1e-9, rawBounds.maxY - rawBounds.minY)
    const targetWidth = Math.max(1, viewportWidth - viewportPadding * 2)
    const targetHeight = Math.max(1, viewportHeight - viewportPadding * 2)
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
    const scaledWidth = sourceWidth * scale
    const scaledHeight = sourceHeight * scale
    const offsetX = (viewportWidth - scaledWidth) / 2
    const offsetY = (viewportHeight - scaledHeight) / 2
    const toViewport = (p: { x: number; y: number }) => ({
      x: offsetX + (p.x - rawBounds.minX) * scale,
      y: offsetY + (p.y - rawBounds.minY) * scale
    })

    const points = rawPoints.map(toViewport)
    const arcLengths = computeArcLengths(points)
    const trackLookup = buildPathLookup(points, arcLengths, TRACK_LOOKUP_TABLE_SIZE)
    const bounds = getBounds(points, 12)
    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const mainPolylinePoints = toPolylinePoints(points)

    const rawPitLane = asArray<number[]>(
      (geo as any)?.pitLaneCenterline ??
      (geo as any)?.pit_lane_centerline ??
      (geo as any)?.pitLane?.centerline ??
      (geo as any)?.pit_lane?.centerline
    )
    const rawPitLanePoints = parseCenterline(rawPitLane)
    const pitLanePoints = rawPitLanePoints.map(toViewport)
    const pitLaneArcLengths = computeArcLengths(pitLanePoints)
    const pitLaneLookup =
      pitLanePoints.length >= 2 ? buildPathLookup(pitLanePoints, pitLaneArcLengths, Math.floor(TRACK_LOOKUP_TABLE_SIZE * 0.6)) : null
    const pitLanePolylinePoints =
      pitLanePoints.length >= 2 ? toPolylinePoints(pitLanePoints) : null

    const corners = asArray<any>(geo?.corners)
      .map((corner, i) => {
        const cornerRawIdx = toIndex(corner?.index, rawCount)
        const cornerLoopRaw = closed && cornerRawIdx === rawCount - 1 ? 0 : cornerRawIdx
        const idx = rotateIndex(cornerLoopRaw, loopCount, startLoop)
        if (idx == null) return null
        const number = Number(corner?.number ?? i + 1)
        const name = typeof corner?.name === 'string' && corner.name.trim() ? corner.name.trim() : null
        return { number: Number.isFinite(number) ? number : i + 1, idx, name }
      })
      .filter(Boolean) as Array<{ number: number; idx: number; name: string | null }>
    corners.sort((a, b) => a.number - b.number)

    const startIndex = 0

    const SECTOR_COLORS = [
      { stroke: '#FF3B6B', glow: '#FF3B6B' },
      { stroke: '#00D2FF', glow: '#00D2FF' },
      { stroke: '#c17bff', glow: '#c17bff' }
    ]
    const sectorMarkers: SectorMarker[] = []
    const sectorsRaw = (geo as any)?.sectors
    if (Array.isArray(sectorsRaw)) {
      sectorsRaw.forEach((s: any, i: number) => {
        const endRawIdx = toIndex(s?.endIndex ?? s?.end_index, rawCount)
        const endLoopRaw = closed && endRawIdx === rawCount - 1 ? 0 : endRawIdx
        const idx = rotateIndex(endLoopRaw, loopCount, startLoop)
        if (idx == null) return
        const col = SECTOR_COLORS[i] ?? { stroke: '#fff', glow: '#fff' }
        sectorMarkers.push({
          key: `sector-${i}`,
          label: `S${i + 1}`,
          idx,
          color: col.stroke,
          glowColor: col.glow
        })
      })
    } else if (sectorsRaw && typeof sectorsRaw === 'object') {
      Object.entries(sectorsRaw).forEach(([k, v]: [string, any], i: number) => {
        const endRawIdx = toIndex(v?.endIndex ?? v?.end_index, rawCount)
        const endLoopRaw = closed && endRawIdx === rawCount - 1 ? 0 : endRawIdx
        const idx = rotateIndex(endLoopRaw, loopCount, startLoop)
        if (idx == null) return
        const label = /1/.test(k) ? 'S1' : /2/.test(k) ? 'S2' : /3/.test(k) ? 'S3' : `S${i + 1}`
        const col = SECTOR_COLORS[i] ?? { stroke: '#fff', glow: '#fff' }
        sectorMarkers.push({ key: `sector-${k}`, label, idx, color: col.stroke, glowColor: col.glow })
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
        return { zoneNumber: Number(z?.zone_number ?? i + 1), startIdx, endIdx, detectionIdx }
      })
      .filter(Boolean) as DRSZone[]

    const pitRaw = (geo as any)?.pitLane ?? (geo as any)?.pit_lane
    const pitEntryRaw = toIndex(pitRaw?.entryIndex ?? pitRaw?.entry_index, rawCount)
    const pitExitRaw = toIndex(pitRaw?.exitIndex ?? pitRaw?.exit_index, rawCount)
    const pitEntryLoopRaw = closed && pitEntryRaw === rawCount - 1 ? 0 : pitEntryRaw
    const pitExitLoopRaw = closed && pitExitRaw === rawCount - 1 ? 0 : pitExitRaw
    const pitEntryIdx = rotateIndex(pitEntryLoopRaw, loopCount, startLoop)
    const pitExitIdx = rotateIndex(pitExitLoopRaw, loopCount, startLoop)

    const drsPolylines = drsZones.map((zone) => {
      const segment = buildZonePoints(points, zone.startIdx, zone.endIdx)
      const midIdx = Math.floor(segment.length / 2)
      const midPoint = segment[midIdx] ?? null
      return {
        zone,
        segment,
        points: segment.length >= 2 ? toPolylinePoints(segment) : null,
        midPoint
      }
    })

    return {
      points,
      trackLookup,
      mainPolylinePoints,
      pitLanePoints,
      pitLaneLookup,
      pitLanePolylinePoints,
      bounds,
      rawBounds,
      toViewport,
      width,
      height,
      corners,
      startIndex,
      sectorMarkers,
      drsPolylines,
      pitEntryIdx,
      pitExitIdx
    }
  }, [sessionData?.trackGeometry, viewport.height, viewport.width])

  const sortedRaceControl = useMemo(() => {
    const raceControl = sessionData?.raceControl
    if (!raceControl || !raceControl.length) return []
    return [...raceControl].sort((a, b) => a.timestamp - b.timestamp)
  }, [sessionData?.raceControl])

  const currentFlags = useMemo(() => {
    if (!sortedRaceControl.length) {
      return { trackFlag: null as string | null, isSafetyCar: false, isVSC: false, isRedFlag: false, sectorFlags: {} as Record<number, string> }
    }
    const endExclusive = upperBoundRaceControlByTimestamp(sortedRaceControl, flagSessionTime)
    const state = getRaceControlStateFromSlice(
      sortedRaceControl,
      endExclusive,
      flagSessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    const trackFlag = state.trackFlag
    return { trackFlag, isSafetyCar: state.isSafetyCar, isVSC: state.isVSC, isRedFlag: trackFlag === 'RED', sectorFlags: state.sectorFlags }
  }, [flagSessionTime, sortedRaceControl, sessionData?.metadata?.raceStartSeconds])

  const cornerBadges = useMemo(
    () => (trackData ? buildCornerBadges(trackData.points, trackData.corners) : []),
    [trackData]
  )

  const displayCars = useMemo(() => {
    if (carPositions.length) {
      return [...carPositions].sort((a, b) => (a.position || 99) - (b.position || 99))
    }
    const laps = lapsFromStore.length ? lapsFromStore : sessionData?.laps ?? []
    const drivers = sessionData?.drivers ?? []
    if (!drivers.length) return []
    if (!laps.length) {
      return drivers.map((driver, idx) => ({
        driverCode: driver.code,
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#fff',
        progress: 0,
        currentLap: 1,
        position: idx + 1,
        x: null,
        y: null,
        hasLivePosition: false,
        isInPit: false,
        pitProgress: null,
        progressSource: 'timing',
        mappingConfidence: 0.35,
        sourceTimestamp: null
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
    const findLap = (rows: LapRow[], t: number) => {
      if (!rows.length) return null
      let lo = 0
      let hi = rows.length - 1
      let latest: LapRow | null = null
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const lap = rows[mid]
        if (lap.lapStartSeconds <= t && t <= lap.lapEndSeconds) return lap
        if (lap.lapEndSeconds <= t) {
          latest = lap
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      return latest ?? rows[0]
    }
    const fallback: CarPosition[] = drivers.map((driver) => {
      const rows = byNum.get(driver.driverNumber) ?? []
      const lap = findLap(rows, sessionTime)
      const lapNumber = lap?.lapNumber ?? 1
      const start = lap?.lapStartSeconds ?? 0
      const end = lap?.lapEndSeconds ?? start + 90
      const duration = Math.max(1, end - start)
      const progress = clamp01((sessionTime - start) / duration)
      const unwrapped = Math.max(0, lapNumber - 1) + progress
      return {
        driverCode: driver.code,
        driverNumber: driver.driverNumber,
        teamColor: driver.teamColor || '#fff',
        progress: unwrapped % 1,
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
    })
    return fallback.sort((a, b) => (a.position || 99) - (b.position || 99))
  }, [carPositions, lapsFromStore, sessionData?.laps, sessionData?.drivers, sessionTime])
  const hoveredCar = useMemo(
    () => (hoveredDriver ? displayCars.find((car) => car.driverCode === hoveredDriver) ?? null : null),
    [displayCars, hoveredDriver]
  )

  const resolvedCars = useMemo(() => {
    if (!trackData) return []
    const { points, trackLookup, pitLaneLookup, pitEntryIdx, pitExitIdx, rawBounds, toViewport } = trackData
    const hasPitLanePath = pitLaneLookup != null
    // Margin in raw (pre-viewport) coordinate space for bounds checking
    const rawMarginX = (rawBounds.maxX - rawBounds.minX) * 0.15
    const rawMarginY = (rawBounds.maxY - rawBounds.minY) * 0.15
    return displayCars.map((car) => {
      const mainProgress = normalizeLoopProgress(car.progress)
      let pos = interpolateFromLookup(trackLookup, mainProgress)
      let usedLivePos = false
      if (car.x != null && car.y != null && Number.isFinite(car.x) && Number.isFinite(car.y)) {
        // Apply the same coordinate swap that parseCenterline does (x: -y, y: -x)
        const swapped = { x: -car.y, y: -car.x }
        const inBounds =
          swapped.x >= rawBounds.minX - rawMarginX &&
          swapped.x <= rawBounds.maxX + rawMarginX &&
          swapped.y >= rawBounds.minY - rawMarginY &&
          swapped.y <= rawBounds.maxY + rawMarginY
        if (inBounds) {
          pos = toViewport(swapped)
          usedLivePos = true
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
      // Compute staleness: how many seconds since last GPS position sample.
      // Only applies to cars that have live GPS data (hasLivePosition=true).
      // Timing-based cars (hasLivePosition=false, sourceTimestamp=null) are NEVER hidden —
      // they show at the computed lap-progress position.
      const staleness = (car.hasLivePosition && car.sourceTimestamp != null && Number.isFinite(car.sourceTimestamp))
        ? Math.abs(sessionTime - car.sourceTimestamp)
        : car.hasLivePosition ? 0 : -1   // -1 = timing-based, never stale
      const STALE_THRESHOLD = 3.0
      const HIDE_THRESHOLD = 5.0
      // Only hide if we previously had live GPS data but it's now stale
      const hidden = car.hasLivePosition && staleness > HIDE_THRESHOLD
      const stale = car.hasLivePosition && staleness >= STALE_THRESHOLD && staleness <= HIDE_THRESHOLD
      return { car, pos, hidden, stale }

    })
  }, [displayCars, trackData, sessionTime])

  const mappingStats = useMemo(() => {
    if (!displayCars.length) {
      return { sourceLabel: 'NO CARS', avgConfidence: 0, degradedCount: 0 }
    }
    let fusedCount = 0
    let timingCount = 0
    let confidenceSum = 0
    let degradedCount = 0
    for (const car of displayCars) {
      if (car.progressSource === 'fused') fusedCount += 1
      else timingCount += 1
      confidenceSum += car.mappingConfidence
      if (car.mappingConfidence < 0.62) degradedCount += 1
    }
    const sourceLabel = fusedCount >= timingCount ? 'FUSED' : 'TIMING'
    return {
      sourceLabel,
      avgConfidence: confidenceSum / displayCars.length,
      degradedCount
    }
  }, [displayCars])

  useEffect(() => {
    hoveredDriverRef.current = hoveredDriver
    renderRef.current?.()
  }, [hoveredDriver])

  useEffect(() => {
    primaryDriverRef.current = primaryDriver
    renderRef.current?.()
  }, [primaryDriver])

  useEffect(() => {
    compareDriverRef.current = compareDriver
    renderRef.current?.()
  }, [compareDriver])

  // Static canvas (track + labels) — only redraw when track data changes
  useEffect(() => {
    const canvas = staticCanvasRef.current
    if (!canvas || !trackData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const { width, height, bounds } = trackData
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(-bounds.minX, -bounds.minY)
    ctx.clearRect(bounds.minX, bounds.minY, width, height)

    // === FLAT 2D BACKGROUND — pure dark, no vignette ===
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(bounds.minX, bounds.minY, width, height)

    // === TRACK SURFACE — thinner gray road with lighter shoulders ===
    // Lighter shoulders (outer edge)
    drawPath(ctx, trackData.points, '#5a5a5a', 20)
    // Road surface (gray asphalt)
    drawPath(ctx, trackData.points, '#2d2d2d', 14)
    // Inner road detail (slightly lighter center)
    drawPath(ctx, trackData.points, '#3a3a3a', 10)
    // Center line dashes
    drawPath(ctx, trackData.points, 'rgba(255,255,255,0.15)', 1.5, [14, 18])

    // === PIT LANE — very subtle, barely-there road with fine centre line ===
    if (trackData.pitLanePoints && trackData.pitLanePoints.length > 0) {
      // Pit surface (muted dark road matching main track shoulders)
      drawPath(ctx, trackData.pitLanePoints, '#383838', 9)
      drawPath(ctx, trackData.pitLanePoints, '#252525', 6)
      // Amber pit lane dashes — subdued (activation highlight added in dynamic canvas when driver is in pit)
      drawPath(ctx, trackData.pitLanePoints, 'rgba(255,175,35,0.25)', 1.5, [7, 9])
      // Subtle white centre line — like main track but even more transparent
      drawPath(ctx, trackData.pitLanePoints, 'rgba(255,255,255,0.10)', 0.8, [10, 14])
    }

    // === DRS ZONES — orange/amber like F1 TV reference ===
    trackData.drsPolylines.forEach(drs => {
      if (!drs.segment || drs.segment.length < 2) return
      drawPath(ctx, drs.segment, 'rgba(255, 160, 40, 0.45)', 22)
      drawPath(ctx, drs.segment, 'rgba(255, 180, 60, 0.9)', 6)
      if (drs.midPoint) {
        drawLabelPill(ctx, drs.midPoint.x, drs.midPoint.y - 20, `DRS`, 'rgba(255,180,40,0.95)', 'rgba(40,25,0,0.85)')
      }
    })

    // === START/FINISH — checkered flag pattern like F1 TV ===
    if (trackData.points[trackData.startIndex]) {
      const startPoint = trackData.points[trackData.startIndex]
      const pPrev = trackData.points[(trackData.startIndex - 1 + trackData.points.length) % trackData.points.length]
      const pNext = trackData.points[(trackData.startIndex + 1) % trackData.points.length]
      const startAngle = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x)

      ctx.save()
      ctx.translate(startPoint.x, startPoint.y)
      ctx.rotate(startAngle)

      // Draw wider checkered pattern
      const cw = 20
      const ch = 32
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 2)
      ctx.fill()

      const cellsX = 3
      const cellsY = 5
      const cellW = cw / cellsX
      const cellH = ch / cellsY
      for (let row = 0; row < cellsY; row++) {
        for (let col = 0; col < cellsX; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#111111' : '#ffffff'
          ctx.fillRect(-cw / 2 + col * cellW, -ch / 2 + row * cellH, cellW, cellH)
        }
      }

      ctx.restore()
    }

    // === SECTOR BOUNDARY LINES — thick colored marks across track ===
    trackData.sectorMarkers.forEach(sector => {
      if (!trackData.points[sector.idx]) return
      const p = trackData.points[sector.idx]
      const prev = trackData.points[(sector.idx - 1 + trackData.points.length) % trackData.points.length]
      const next = trackData.points[(sector.idx + 1) % trackData.points.length]
      const tx = next.x - prev.x
      const ty = next.y - prev.y
      const len = Math.hypot(tx, ty) || 1
      const nx = (-ty / len) * 18
      const ny = (tx / len) * 18

      ctx.beginPath()
      ctx.moveTo(p.x - nx, p.y - ny)
      ctx.lineTo(p.x + nx, p.y + ny)
      ctx.strokeStyle = sector.color
      ctx.lineWidth = 3.5
      ctx.lineCap = 'round'
      ctx.globalAlpha = 1.0
      ctx.stroke()

      // Sector label pill offset outward from track
      drawLabelPill(ctx, p.x + nx * 2.2, p.y + ny * 2.2, sector.label, sector.color, 'rgba(0,0,0,0.85)')
    })

    // === PIT ENTRY / EXIT markers ===
    if (trackData.pitEntryIdx != null && trackData.points[trackData.pitEntryIdx]) {
      const p = trackData.points[trackData.pitEntryIdx]
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,180,40,0.3)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,180,40,0.9)'
      ctx.lineWidth = 2
      ctx.stroke()
      drawLabelPill(ctx, p.x + 16, p.y, 'PIT IN', 'rgba(255,180,40,0.95)', 'rgba(35,20,0,0.9)')
    }
    if (trackData.pitExitIdx != null && trackData.points[trackData.pitExitIdx]) {
      const p = trackData.points[trackData.pitExitIdx]
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,180,40,0.3)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,180,40,0.9)'
      ctx.lineWidth = 2
      ctx.stroke()
      drawLabelPill(ctx, p.x + 16, p.y, 'PIT OUT', 'rgba(255,180,40,0.95)', 'rgba(35,20,0,0.9)')
    }
    if (trackData.pitLanePolylinePoints && trackData.pitEntryIdx != null && trackData.pitExitIdx != null) {
      const midPit = {
        x: (trackData.points[trackData.pitEntryIdx].x + trackData.points[trackData.pitExitIdx].x) / 2,
        y: (trackData.points[trackData.pitEntryIdx].y + trackData.points[trackData.pitExitIdx].y) / 2
      }
      drawLabelPill(ctx, midPit.x, midPit.y + 22, 'PIT LANE', 'rgba(255,180,40,0.9)', 'rgba(35,20,0,0.9)')
    }

    // === CORNER BADGES — dark gray circles with white numbers (like reference) ===
    cornerBadges.forEach(corner => {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, 10, 0, Math.PI * 2)
      ctx.fillStyle = '#2a2a2a'
      ctx.fill()
      ctx.strokeStyle = '#444'
      ctx.lineWidth = 1.2
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.font = '700 11px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(corner.number), corner.x, corner.y + 0.5)
    })
  }, [trackData, cornerBadges])

  // Dynamic canvas (flags + cars) — redraw on live updates
  useEffect(() => {
    const canvas = dynamicCanvasRef.current
    if (!canvas || !trackData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const { width, height, bounds } = trackData
      const hoveredCode = hoveredDriverRef.current
      const primaryCode = primaryDriverRef.current
      const compareCode = compareDriverRef.current

      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.translate(-bounds.minX, -bounds.minY)
      ctx.clearRect(bounds.minX, bounds.minY, width, height)

      // === FLAG OVERLAYS ===
      if (currentFlags.isRedFlag) {
        drawPath(ctx, trackData.points, 'rgba(255, 30, 30, 0.5)', 24, [], 'rgba(255, 0, 0, 0.8)', 16)
      } else if (currentFlags.isSafetyCar) {
        drawPath(ctx, trackData.points, 'rgba(255, 165, 0, 0.45)', 24, [], 'rgba(255, 165, 0, 0.8)', 14)
      } else if (currentFlags.isVSC) {
        drawPath(ctx, trackData.points, 'rgba(255, 220, 0, 0.4)', 24, [], 'rgba(255, 220, 0, 0.8)', 12)
      }

      // === PIT LANE ACTIVE HIGHLIGHT — glows amber when any driver is in pit ===
      const anyInPit = resolvedCars.some(({ car }) => car.isInPit)
      if (anyInPit && trackData.pitLanePoints && trackData.pitLanePoints.length > 0) {
        ctx.globalAlpha = 0.55
        drawPath(ctx, trackData.pitLanePoints, 'rgba(255,175,35,0.5)', 5)
        drawPath(ctx, trackData.pitLanePoints, 'rgba(255,200,60,0.9)', 1.5, [6, 8])
        ctx.globalAlpha = 1.0
      }

      // Sector-specific yellow flags
      if (currentFlags.trackFlag !== 'RED' && !currentFlags.isSafetyCar && !currentFlags.isVSC) {
        const sectorIndices = trackData.sectorMarkers.map(s => s.idx).sort((a, b) => a - b)
        for (const [sectorNum, sectorFlag] of Object.entries(currentFlags.sectorFlags ?? {})) {
          if (sectorFlag === 'YELLOW' || sectorFlag === 'DOUBLE YELLOW') {
            const sIdx = Number(sectorNum) - 1
            const startIdx = sIdx === 0 ? 0 : (sectorIndices[sIdx - 1] ?? 0)
            const endIdx = sectorIndices[sIdx] ?? trackData.points.length - 1
            const sectorPts = buildZonePoints(trackData.points, startIdx, endIdx)
            if (sectorPts.length >= 2) {
              const yellowColor = sectorFlag === 'DOUBLE YELLOW'
                ? 'rgba(255, 200, 0, 0.55)'
                : 'rgba(255, 220, 0, 0.40)'
              drawPath(ctx, sectorPts, yellowColor, 22, [], yellowColor, 12)
            }
          }
        }
      }

      // Driver dots
      resolvedCars.forEach(({ car, pos, hidden, stale }) => {
        if (hidden) return
        const isInPit = Boolean(car.isInPit)
        const isHovered = hoveredCode === car.driverCode
        const isPrimary = primaryCode === car.driverCode
        const isCompare = compareCode === car.driverCode
        const radius = isCompact ? 12 : 16
        const bubbleFill = car.teamColor || '#6b7280'
        const codeColor = textColorForHex(bubbleFill)
        const baseAlpha = stale ? 0.5 : isInPit ? 0.4 : 1.0

        ctx.save()
        ctx.translate(pos.x, pos.y)

        if (isPrimary || isCompare) {
          ctx.beginPath()
          ctx.arc(0, 0, radius + 5, 0, Math.PI * 2)
          ctx.strokeStyle = isPrimary ? 'rgba(255,255,255,0.4)' : 'rgba(0,144,255,0.4)'
          ctx.lineWidth = 2
          ctx.globalAlpha = 0.7 * baseAlpha
          ctx.stroke()
          ctx.globalAlpha = baseAlpha
        }

        ctx.beginPath()
        ctx.arc(0, 0, isHovered ? radius + 2 : radius, 0, Math.PI * 2)
        ctx.fillStyle = bubbleFill
        ctx.globalAlpha = baseAlpha

        ctx.shadowColor = bubbleFill
        ctx.shadowBlur = isHovered ? 18 : 12
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.beginPath()
        ctx.arc(-radius * 0.25, -radius * 0.28, radius * 0.42, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.globalAlpha = baseAlpha
        ctx.fill()

        ctx.strokeStyle = isPrimary ? '#ffffff' : isCompare ? '#cfd6df' : isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
        ctx.lineWidth = isPrimary || isCompare ? 2.5 : isHovered ? 2 : 1.2
        ctx.globalAlpha = baseAlpha
        ctx.stroke()

        ctx.fillStyle = codeColor
        ctx.font = `800 ${isCompact ? 9 : 11}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = baseAlpha
        ctx.fillText(car.driverCode, 0, 0.5)

        ctx.restore()
      })
    }

    renderRef.current = render
    const frameId = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frameId)
      if (renderRef.current === render) {
        renderRef.current = null
      }
    }
  }, [trackData, resolvedCars, isCompact, currentFlags])

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMinimap) return
    if (!trackData) return
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
    for (const { car, pos } of resolvedCars) {
      const dist = Math.hypot(pos.x - cx, pos.y - cy)
      if (dist <= radius + 2) {
        found = car.driverCode
        break
      }
    }
    if (found !== hoveredDriver) {
      setHoveredDriver(found)
    }
  }

  const handlePointerClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMinimap) return
    if (!hoveredDriver) return
    const car = displayCars.find(c => c.driverCode === hoveredDriver)
    if (car) {
      if (e.ctrlKey || e.metaKey) {
        selectCompare(compareDriver === car.driverCode ? null : car.driverCode)
      } else {
        selectPrimary(car.driverCode)
      }
    }
  }

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
      className="relative h-full w-full overflow-hidden rounded-xl"
      style={{
        background: '#1a1a1a'
      }}
    >
      {!isMinimap && (
        <div className="absolute left-3 top-2 z-20 flex flex-col gap-1.5">
          <div className="glass-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            {sessionData?.trackGeometry?.name || 'Track'}
          </div>
          <div className="glass-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            MAP {mappingStats.sourceLabel} · Q{Math.round(mappingStats.avgConfidence * 100)}
          </div>
          {mappingStats.degradedCount > 0 && (
            <div className="glass-pill border-amber-500/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
              {mappingStats.degradedCount} low-confidence mapping
            </div>
          )}
          {currentFlags.isRedFlag && (
            <span className="glass-pill animate-pulse px-3 py-1 text-xs font-bold text-red-300 border-red-500/40">
              🔴 RED FLAG
            </span>
          )}
          {currentFlags.isSafetyCar && !currentFlags.isRedFlag && (
            <span className="glass-pill px-3 py-1 text-xs font-bold text-orange-300 border-orange-500/40">
              🟠 SAFETY CAR
            </span>
          )}
          {currentFlags.isVSC && !currentFlags.isRedFlag && !currentFlags.isSafetyCar && (
            <span className="glass-pill px-3 py-1 text-xs font-bold text-orange-300 border-orange-500/40">
              🟡 VIRTUAL SC
            </span>
          )}
        </div>
      )}

      {!isMinimap && hoveredCar && (() => {
        // Build compound info from laps
        const allLaps = lapsFromStore.length ? lapsFromStore : sessionData?.laps ?? []
        const driverLaps = allLaps
          .filter((lap) => lap.driverNumber === hoveredCar.driverNumber)
          .sort((a, b) => a.lapEndSeconds - b.lapEndSeconds)
        // Find current or latest lap for compound
        let compound = '—'
        let compoundColor = '#666'
        for (let i = driverLaps.length - 1; i >= 0; i--) {
          if (driverLaps[i].lapEndSeconds <= sessionTime || i === 0) {
            const raw = (driverLaps[i].tyreCompound || '').toUpperCase()
            if (raw.includes('SOFT')) { compound = 'SOFT'; compoundColor = '#e8002d' }
            else if (raw.includes('MEDIUM')) { compound = 'MEDIUM'; compoundColor = '#ffd700' }
            else if (raw.includes('HARD')) { compound = 'HARD'; compoundColor = '#f0f0f0' }
            else if (raw.includes('INTER')) { compound = 'INTER'; compoundColor = '#39b54a' }
            else if (raw.includes('WET')) { compound = 'WET'; compoundColor = '#0067ff' }
            break
          }
        }
        return (
          <div className="glass-pill absolute right-3 top-2 z-20 px-3 py-2 text-[11px] font-mono text-text-primary pointer-events-none">
            <div className="font-bold text-[13px]">{hoveredCar.driverCode}</div>
            <div className="text-text-muted mt-0.5">P{hoveredCar.position || '—'} · Lap {hoveredCar.currentLap || '—'}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: compoundColor }} />
              <span className="text-text-secondary">{compound}</span>
            </div>
            <div className="text-text-muted text-[10px] mt-0.5">SRC {hoveredCar.progressSource.toUpperCase()} · Q{Math.round(hoveredCar.mappingConfidence * 100)}</div>
          </div>
        )
      })()}

      <div className="absolute inset-0">
        <canvas
          ref={staticCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: 'contain', pointerEvents: 'none' }}
        />
        <canvas
          ref={dynamicCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: 'contain', cursor: isMinimap ? 'default' : hoveredDriver ? 'pointer' : 'default' }}
          onMouseMove={handlePointerMove}
          onClick={handlePointerClick}
          onMouseLeave={() => setHoveredDriver(null)}
        />
      </div>

      {!isMinimap && (
        <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
          <div className="glass-pill flex flex-col gap-1 px-2.5 py-1.5 text-[10px]">
            <div className="flex items-center gap-1.5 text-text-muted">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: 'rgba(255,180,40,0.8)' }} />
              DRS Zone
            </div>
            <div className="flex items-center gap-1.5 text-text-muted">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: 'rgba(255,180,40,0.5)', border: '1px dashed rgba(255,180,40,0.6)' }} />
              Pit Lane
            </div>
            <div className="flex items-center gap-1.5 text-text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-text-muted opacity-40" />
              In Pit
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
