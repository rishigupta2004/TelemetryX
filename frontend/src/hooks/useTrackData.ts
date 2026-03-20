import { useMemo } from 'react'
import {
  buildPathLookup,
  computeArcLengths,
  getBounds,
  parseCenterline,
  toPolylinePoints,
  validateAndSortCorners,
  Point
} from '../lib/trackGeometry'
import { TRACK_LOOKUP_TABLE_SIZE } from '../lib/constants'
import {
  asArray,
  toIndex,
  isClosedLoop,
  rotateIndex,
  buildZonePoints
} from '../lib/trackHelpers'
import startFinishPoints from '../data/start_finish_points.json'
import circuitFolderAliases from '../data/circuit_folder_aliases.json'

export interface TrackData {
  points: Point[]
  trackLookup: ReturnType<typeof buildPathLookup> | null
  mainPolylinePoints: string
  pitLanePoints: Point[]
  pitLaneLookup: ReturnType<typeof buildPathLookup> | null
  pitLanePolylinePoints: string | null
  hasPitLaneData: boolean
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  rawBounds: { minX: number; maxX: number; minY: number; maxY: number }
  toViewport: (p: Point) => Point
  width: number
  height: number
  corners: Array<{ number: number; idx: number; name: string | null }>
  startIndex: number
  sectorMarkers: Array<{
    key: string
    label: string
    idx: number
    color: string
    glowColor: string
  }>
  drsPolylines: Array<{
    zone: { zoneNumber: number; startIdx: number; endIdx: number; detectionIdx: number | null }
    segment: Point[]
    points: string | null
    midPoint: Point | null
  }>
  pitEntryIdx: number | null
  pitExitIdx: number | null
}

const normalizeCircuitKey = (value: string | null | undefined): string => {
  return String(value || '')
    .toLowerCase()
    .replace(/grand prix/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const detectCircuitFolder = (trackName: string | null | undefined, raceName: string | null | undefined): string | null => {
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
  // Try direct substring match with race name words
  const raceWords = normalizeCircuitKey(raceName ?? '').split(' ').filter(w => w.length > 3)
  for (const rule of rules) {
    if (raceWords.some(word => rule.token.includes(word) || word.includes(rule.token))) {
      return rule.folder
    }
  }
  return null
}

const nearestPointIndex = (
  points: Point[],
  lon: number,
  lat: number
): { idx: number; d2: number } | null => {
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

const lonLatDistanceMeters = (a: Point, b: Point): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6371000
  const lat1 = toRad(a.y)
  const lat2 = toRad(b.y)
  const dLat = lat2 - lat1
  const dLon = toRad(b.x - a.x)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadius * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))
}

const resolveStartFinishFallbackIndex = (
  points: Point[],
  trackName: string | null | undefined,
  raceName: string | null | undefined
): number | null => {
  if (!points.length || !Array.isArray(startFinishPoints) || !startFinishPoints.length) return null
  const wantedFolder = detectCircuitFolder(trackName, raceName)
  if (!wantedFolder) {
    console.warn('[TrackData] No circuit folder match for:', trackName, raceName)
    return null
  }
  const candidates = (startFinishPoints as Array<{ lon: number; lat: number; circuitFolder?: string }>).filter((row) =>
    String(row.circuitFolder || '').toLowerCase() === wantedFolder
  )
  if (candidates.length === 0) return null
  let best: { idx: number; d2: number } | null = null
  for (const row of candidates) {
    if (!Number.isFinite(row.lon) || !Number.isFinite(row.lat)) continue
    const candidate = nearestPointIndex(points, row.lon, row.lat)
    if (!candidate) continue
    if (!best || candidate.d2 < best.d2) best = candidate
  }
  if (!best) return null
  return best.idx
}

interface SessionData {
  trackGeometry?: unknown | null
  metadata?: { raceName?: string | null }
}

const sanitizeOutlierPoints = (points: Point[]): Point[] => {
  if (points.length < 24) return points
  const deltas: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    const dist = Math.hypot(dx, dy)
    if (Number.isFinite(dist) && dist > 0) deltas.push(dist)
  }
  if (deltas.length < 8) return points
  const sorted = deltas.slice().sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || p50
  const maxAllowed = Math.max(p90 * 20, p50 * 50, 600)
  const out: Point[] = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1]
    const candidate = points[i]
    const step = Math.hypot(candidate.x - prev.x, candidate.y - prev.y)
    if (step <= maxAllowed) out.push(candidate)
  }
  return out.length >= Math.max(16, Math.floor(points.length * 0.4)) ? out : points
}

const robustRawBounds = (points: Point[]): { minX: number; maxX: number; minY: number; maxY: number } => {
  const full = getBounds(points, 0)
  if (points.length < 180) return full
  const xs = points.map((p) => p.x).sort((a, b) => a - b)
  const ys = points.map((p) => p.y).sort((a, b) => a - b)
  const lo = Math.floor(points.length * 0.005)
  const hi = Math.max(lo + 1, Math.ceil(points.length * 0.995) - 1)
  const rx0 = xs[lo]
  const rx1 = xs[hi]
  const ry0 = ys[lo]
  const ry1 = ys[hi]
  if (![rx0, rx1, ry0, ry1].every(Number.isFinite)) return full
  const fullArea = Math.max(1e-6, (full.maxX - full.minX) * (full.maxY - full.minY))
  const robustArea = Math.max(1e-6, (rx1 - rx0) * (ry1 - ry0))
  // Use robust bounds only when we detect a clear outlier spread.
  if (robustArea / fullArea > 0.88) return full
  return { minX: rx0, maxX: rx1, minY: ry0, maxY: ry1 }
}

const buildShortestZonePoints = (points: Point[], startIdx: number, endIdx: number): Point[] => {
  if (!points.length) return []
  const n = points.length
  const forward = buildZonePoints(points, startIdx, endIdx)
  const backward = buildZonePoints(points, endIdx, startIdx).reverse()
  if (!forward.length) return backward
  if (!backward.length) return forward
  const maxReasonable = Math.max(2, Math.floor(n * 0.45))
  const forwardOk = forward.length <= maxReasonable
  const backwardOk = backward.length <= maxReasonable
  if (forwardOk && backwardOk) return forward.length <= backward.length ? forward : backward
  if (forwardOk) return forward
  if (backwardOk) return backward
  return forward.length <= backward.length ? forward : backward
}

export const useTrackData = (
  sessionData: SessionData | null | undefined,
  viewport: { width: number; height: number }
): TrackData | null => {
  return useMemo(() => {
    const geo = (sessionData?.trackGeometry ?? null) as Record<string, unknown> | null
    const rawCenterline = asArray<number[]>(geo?.centerline)
    if (!rawCenterline.length) return null

    // Helper to get raw origin
    const getOrigin = (raw: number[][]): { x: number, y: number } | undefined => {
      for (const item of raw as unknown[]) {
        let x = 0, y = 0
        if (Array.isArray(item)) { x = Number(item[0]); y = Number(item[1]) }
        else if (item && typeof item === 'object') { x = Number((item as { x?: number }).x); y = Number((item as { y?: number }).y) }
        else continue
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
      }
      return undefined
    }
    const trackOrigin = getOrigin(rawCenterline)

    const parsedPoints = sanitizeOutlierPoints(parseCenterline(rawCenterline))
    const rawCount = parsedPoints.length
    const closed = isClosedLoop(parsedPoints)
    const loopPoints = closed ? parsedPoints.slice(0, -1) : parsedPoints
    const loopCount = loopPoints.length
    if (!loopCount) return null

    const fallbackStartLoopIndex = resolveStartFinishFallbackIndex(
      loopPoints,
      (geo as any)?.name ?? null,
      sessionData?.metadata?.raceName ?? null
    )

    const explicitStartIndexRaw =
      toIndex((geo as any)?.start_finish?.index, rawCount) ??
      toIndex((geo as any)?.startPositionIndex, rawCount)

    const shouldUseFallback =
      fallbackStartLoopIndex != null &&
      (explicitStartIndexRaw == null || explicitStartIndexRaw === 0)

    const startIndexRaw = shouldUseFallback
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
    const baseRawBounds = robustRawBounds(rawPoints)
    const spanX = Math.max(1e-9, baseRawBounds.maxX - baseRawBounds.minX)
    const spanY = Math.max(1e-9, baseRawBounds.maxY - baseRawBounds.minY)
    const padX = Math.max(spanX * 0.08, 0.0006)
    const padY = Math.max(spanY * 0.08, 0.0006)
    const rawBounds = {
      minX: baseRawBounds.minX - padX,
      maxX: baseRawBounds.maxX + padX,
      minY: baseRawBounds.minY - padY,
      maxY: baseRawBounds.maxY + padY
    }

    const viewportWidth = Math.max(320, viewport.width)
    const viewportHeight = Math.max(220, viewport.height)
    const viewportPadding = 6
    const sourceWidth = Math.max(1e-9, rawBounds.maxX - rawBounds.minX)
    const sourceHeight = Math.max(1e-9, rawBounds.maxY - rawBounds.minY)
    const targetWidth = Math.max(1, viewportWidth - viewportPadding * 2)
    const targetHeight = Math.max(1, viewportHeight - viewportPadding * 2)
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
    const scaledWidth = sourceWidth * scale
    const scaledHeight = sourceHeight * scale
    const offsetX = (viewportWidth - scaledWidth) / 2
    const offsetY = (viewportHeight - scaledHeight) / 2
    const toViewport = (p: Point) => ({
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
    const hasPitLaneData = rawPitLane.length >= 2
    const rawPitLanePoints = parseCenterline(rawPitLane, trackOrigin)
    const pitLanePoints = rawPitLanePoints.map(toViewport)
    const pitLaneArcLengths = computeArcLengths(pitLanePoints)
    const pitLaneLookup =
      hasPitLaneData && pitLanePoints.length >= 2 ? buildPathLookup(pitLanePoints, pitLaneArcLengths, Math.floor(TRACK_LOOKUP_TABLE_SIZE * 0.6)) : null
    const pitLanePolylinePoints =
      hasPitLaneData && pitLanePoints.length >= 2 ? toPolylinePoints(pitLanePoints) : null

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
    const validatedCorners = validateAndSortCorners(corners)

    const startIndex = 0

    const SECTOR_COLORS = [
      { stroke: '#FF3B6B', glow: '#FF3B6B' },
      { stroke: '#00D2FF', glow: '#00D2FF' },
      { stroke: '#c17bff', glow: '#c17bff' }
    ]
    const sectorMarkers: TrackData['sectorMarkers'] = []
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
    const drsZones = drsRaw
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
      .filter(Boolean) as Array<{ zoneNumber: number; startIdx: number; endIdx: number; detectionIdx: number | null }>

    const pitRaw = (geo as any)?.pitLane ?? (geo as any)?.pit_lane
    const pitEntryRaw = toIndex(pitRaw?.entryIndex ?? pitRaw?.entry_index, rawCount)
    const pitExitRaw = toIndex(pitRaw?.exitIndex ?? pitRaw?.exit_index, rawCount)
    const pitEntryLoopRaw = closed && pitEntryRaw === rawCount - 1 ? 0 : pitEntryRaw
    const pitExitLoopRaw = closed && pitExitRaw === rawCount - 1 ? 0 : pitExitRaw
    const pitEntryIdx = rotateIndex(pitEntryLoopRaw, loopCount, startLoop)
    const pitExitIdx = rotateIndex(pitExitLoopRaw, loopCount, startLoop)

    const drsPolylines = drsZones.map((zone) => {
      const segment = buildShortestZonePoints(points, zone.startIdx, zone.endIdx)
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
      hasPitLaneData,
      bounds,
      rawBounds,
      toViewport,
      width,
      height,
      corners: validatedCorners,
      startIndex,
      sectorMarkers,
      drsPolylines,
      pitEntryIdx,
      pitExitIdx
    }
  }, [sessionData?.trackGeometry, viewport.height, viewport.width])
}
