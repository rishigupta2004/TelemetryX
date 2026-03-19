import { useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import { Point } from '../lib/trackGeometry'
import { drawPath } from '../lib/trackRendering'
import { buildZonePoints } from '../lib/trackHelpers'

interface TrackData {
  points: Point[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  width: number
  height: number
  sectorMarkers: Array<{ idx: number }>
  hasPitLaneData: boolean
  pitLanePoints: Point[]
}

interface CurrentFlags {
  trackFlag: string | null
  isSafetyCar: boolean
  isVSC: boolean
  isRedFlag: boolean
  sectorFlags: Record<number, string>
}

interface ResolvedCar {
  car: { driverCode: string; teamColor: string; isInPit: boolean; hasLivePosition: boolean; sourceTimestamp: number | null }
  pos: Point
  hidden: boolean
  stale: boolean
}

interface CarRendererConfig {
  isCompact: boolean
  trackData: TrackData
  cars: ResolvedCar[]
  currentFlags: CurrentFlags
  hoveredCode: string | null
  primaryCode: string | null
  compareCode: string | null
}

const FRAME_THROTTLE_MS = 1000 / 60

const drawCar = (
  ctx: CanvasRenderingContext2D,
  car: ResolvedCar,
  radius: number,
  isCompact: boolean,
  hoveredCode: string | null,
  primaryCode: string | null,
  compareCode: string | null
) => {
  const { car: c, pos, hidden, stale } = car
  if (hidden) return
  const isInPit = Boolean(c.isInPit)
  const isHovered = hoveredCode === c.driverCode
  const isPrimary = primaryCode === c.driverCode
  const isCompare = compareCode === c.driverCode
  const bubbleFill = c.teamColor || '#6b7280'

  const textColorForHex = (hex: string): string => {
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

  const shadeColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1)
  }

  const codeColor = textColorForHex(bubbleFill)
  const baseAlpha = stale ? 0.5 : isInPit ? 0.35 : 1.0

  ctx.save()
  ctx.translate(pos.x, pos.y)

  if (isPrimary || isCompare) {
    const ringRadius = radius + 6
    ctx.beginPath()
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2)
    
    const ringGrad = ctx.createRadialGradient(0, 0, ringRadius - 3, 0, 0, ringRadius + 2)
    if (isPrimary) {
      ringGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
      ringGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)')
      ringGrad.addColorStop(1, 'rgba(255, 255, 255, 0.4)')
    } else {
      ringGrad.addColorStop(0, 'rgba(0, 144, 255, 0.05)')
      ringGrad.addColorStop(0.5, 'rgba(0, 144, 255, 0.25)')
      ringGrad.addColorStop(1, 'rgba(0, 144, 255, 0.4)')
    }
    ctx.fillStyle = ringGrad
    ctx.globalAlpha = baseAlpha * 0.8
    ctx.fill()
    ctx.globalAlpha = baseAlpha
    
    ctx.beginPath()
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2)
    ctx.strokeStyle = isPrimary ? 'rgba(255,255,255,0.9)' : 'rgba(0,144,255,0.9)'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(0, 0, isHovered ? radius + 3 : radius, 0, Math.PI * 2)
  
  const carGrad = ctx.createRadialGradient(
    -radius * 0.3, -radius * 0.3, 0,
    0, 0, radius * 1.2
  )
  carGrad.addColorStop(0, bubbleFill)
  carGrad.addColorStop(0.7, bubbleFill)
  carGrad.addColorStop(1, shadeColor(bubbleFill, -30))
  
  ctx.fillStyle = carGrad
  ctx.globalAlpha = baseAlpha
  ctx.shadowColor = bubbleFill
  ctx.shadowBlur = isHovered ? 22 : 14
  ctx.fill()
  
  ctx.shadowColor = bubbleFill
  ctx.shadowBlur = isHovered ? 28 : 18
  ctx.beginPath()
  ctx.arc(0, 0, isHovered ? radius + 3 : radius, 0, Math.PI * 2)
  ctx.strokeStyle = bubbleFill
  ctx.lineWidth = 2
  ctx.globalAlpha = baseAlpha * 0.6
  ctx.stroke()
  ctx.globalAlpha = baseAlpha
  ctx.shadowBlur = 0

  ctx.beginPath()
  ctx.arc(-radius * 0.28, -radius * 0.3, radius * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.globalAlpha = baseAlpha
  ctx.fill()

  ctx.strokeStyle = isPrimary ? '#ffffff' : isCompare ? '#7ab8ff' : isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'
  ctx.lineWidth = isPrimary || isCompare ? 2.5 : isHovered ? 2 : 1.2
  ctx.globalAlpha = baseAlpha
  ctx.beginPath()
  ctx.arc(0, 0, isHovered ? radius + 3 : radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = codeColor
  ctx.font = `800 ${isCompact ? 9 : 11}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = baseAlpha
  ctx.fillText(c.driverCode, 0, 0.5)

  ctx.restore()
}

export const useDynamicTrackRenderer = (
  trackData: TrackData | null,
  containerRef: RefObject<HTMLDivElement | null>,
  resolvedCarsRef: React.MutableRefObject<ResolvedCar[]>,
  currentFlagsRef: React.MutableRefObject<CurrentFlags>,
  needsRenderRef: React.MutableRefObject<boolean>,
  hoveredDriverRef: React.MutableRefObject<string | null>,
  primaryDriverRef: React.MutableRefObject<string | null>,
  compareDriverRef: React.MutableRefObject<string | null>,
  isCompact: boolean
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0)

  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas || !trackData) {
      rafRef.current = requestAnimationFrame(render)
      return
    }

    const elapsed = timestamp - lastFrameTimeRef.current
    if (elapsed < FRAME_THROTTLE_MS) {
      rafRef.current = requestAnimationFrame(render)
      return
    }
    lastFrameTimeRef.current = timestamp

    if (!needsRenderRef.current) {
      rafRef.current = requestAnimationFrame(render)
      return
    }
    needsRenderRef.current = false

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const { width, height, bounds } = trackData
    const containerWidth = Math.max(1, Math.floor(containerRef.current?.clientWidth ?? width))
    const containerHeight = Math.max(1, Math.floor(containerRef.current?.clientHeight ?? height))
    const dpr = window.devicePixelRatio || 1

    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerWidth, containerHeight)
    ctx.translate(-bounds.minX, -bounds.minY)

    const currentFlags = currentFlagsRef.current
    const cars = resolvedCarsRef.current

    const { minX: bMinX, minY: bMinY } = bounds
    const w = width
    const h = height

    if (currentFlags.isRedFlag) {
      const redGrad = ctx.createRadialGradient(bMinX + w / 2, bMinY + h / 2, 0, bMinX + w / 2, bMinY + h / 2, Math.max(w, h) * 0.8)
      redGrad.addColorStop(0, 'rgba(255, 30, 30, 0.35)')
      redGrad.addColorStop(1, 'rgba(255, 0, 0, 0.15)')
      drawPath(ctx, trackData.points, redGrad, 30, [], 'rgba(255, 0, 0, 0.9)', 20)
    } else if (currentFlags.isSafetyCar) {
      const scGrad = ctx.createRadialGradient(bMinX + w / 2, bMinY + h / 2, 0, bMinX + w / 2, bMinY + h / 2, Math.max(w, h) * 0.8)
      scGrad.addColorStop(0, 'rgba(255, 165, 0, 0.3)')
      scGrad.addColorStop(1, 'rgba(255, 140, 0, 0.12)')
      drawPath(ctx, trackData.points, scGrad, 30, [], 'rgba(255, 165, 0, 0.85)', 16)
    } else if (currentFlags.isVSC) {
      const vscGrad = ctx.createRadialGradient(bMinX + w / 2, bMinY + h / 2, 0, bMinX + w / 2, bMinY + h / 2, Math.max(w, h) * 0.8)
      vscGrad.addColorStop(0, 'rgba(255, 220, 0, 0.25)')
      vscGrad.addColorStop(1, 'rgba(255, 200, 0, 0.1)')
      drawPath(ctx, trackData.points, vscGrad, 30, [], 'rgba(255, 220, 0, 0.8)', 14)
    }

    const anyInPit = cars.some(({ car }) => car.isInPit)
    if (anyInPit && trackData.hasPitLaneData && trackData.pitLanePoints && trackData.pitLanePoints.length > 0) {
      ctx.globalAlpha = 0.6
      drawPath(ctx, trackData.pitLanePoints, 'rgba(255,175,35,0.4)', 8)
      drawPath(ctx, trackData.pitLanePoints, 'rgba(255,200,60,0.95)', 2, [6, 10])
      ctx.globalAlpha = 1.0
    }

    if (currentFlags.trackFlag !== 'RED' && !currentFlags.isSafetyCar && !currentFlags.isVSC) {
      const sectorIndices = trackData.sectorMarkers.map(s => s.idx).sort((a, b) => a - b)
      for (const [sectorNum, sectorFlag] of Object.entries(currentFlags.sectorFlags ?? {})) {
        if (sectorFlag === 'YELLOW' || sectorFlag === 'DOUBLE YELLOW') {
          const sIdx = Number(sectorNum) - 1
          const startIdx = sIdx === 0 ? 0 : (sectorIndices[sIdx - 1] ?? 0)
          const endIdx = sectorIndices[sIdx] ?? trackData.points.length - 1
          const sectorPts = buildZonePoints(trackData.points, startIdx, endIdx)
          if (sectorPts.length >= 2) {
            const yellowColor = sectorFlag === 'DOUBLE YELLOW' ? 'rgba(255, 180, 0, 0.5)' : 'rgba(255, 200, 0, 0.35)'
            drawPath(ctx, sectorPts, yellowColor, 24, [], yellowColor, 14)
          }
        }
      }
    }

    const radius = isCompact ? 12 : 16
    const hoveredCode = hoveredDriverRef.current
    const primaryCode = primaryDriverRef.current
    const compareCode = compareDriverRef.current

    for (const car of cars) {
      drawCar(ctx, car, radius, isCompact, hoveredCode, primaryCode, compareCode)
    }

    rafRef.current = requestAnimationFrame(render)
  }, [trackData, containerRef, isCompact, resolvedCarsRef, currentFlagsRef, needsRenderRef, hoveredDriverRef, primaryDriverRef, compareDriverRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [render])

  return canvasRef
}
