import { useEffect, useRef, useMemo } from 'react'
import { animate } from 'animejs'
import { Point } from '../lib/trackGeometry'
import { buildCornerBadges, CornerBadge } from '../lib/trackHelpers'
import {
  drawTrack,
  drawDRSZones,
  drawStartFinish,
  drawSectorMarkers,
  drawPitMarkers,
  drawCornerBadges as drawCornerBadgesRender
} from '../lib/trackRendering'

interface TrackData {
  points: Point[]
  hasPitLaneData: boolean
  pitLanePoints: Point[]
  drsPolylines: Array<{
    zone: { zoneNumber: number; startIdx: number; endIdx: number; detectionIdx: number | null }
    segment: Point[]
    midPoint: Point | null
  }>
  startIndex: number
  sectorMarkers: Array<{
    key: string
    label: string
    idx: number
    color: string
    glowColor: string
  }>
  pitEntryIdx: number | null
  pitExitIdx: number | null
  corners: Array<{ number: number; idx: number; name: string | null }>
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  width: number
  height: number
}

export const useStaticTrackRenderer = (
  trackData: TrackData | null,
  isCompact: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>
) => {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null)
  const isAnimatingInRef = useRef(true)

  const cornerBadges = useMemo(() => {
    if (!trackData) return []
    return buildCornerBadges(trackData.points, trackData.corners)
  }, [trackData])

  useEffect(() => {
    if (!containerRef.current) return
    
    animate(containerRef.current, {
      opacity: [0, 1],
      scale: [0.98, 1],
      duration: 400,
      easing: 'easeOutCubic',
      complete: () => { isAnimatingInRef.current = false }
    })
  }, [containerRef])

  useEffect(() => {
    const canvas = staticCanvasRef.current
    if (!canvas || !trackData) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const { width, height, bounds } = trackData
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(-bounds.minX, -bounds.minY)
    ctx.clearRect(bounds.minX, bounds.minY, width, height)

    let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const offscreen = new OffscreenCanvas(width * dpr, height * dpr)
        offscreenCtx = offscreen.getContext('2d', { alpha: true })
        if (offscreenCtx) {
          offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
          offscreenCtx.translate(-bounds.minX, -bounds.minY)
          offscreenCanvasRef.current = offscreen
        }
      } catch {
        offscreenCtx = null
      }
    }
    const targetCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D = offscreenCtx || ctx

    const gradient = ctx.createRadialGradient(
      bounds.minX + width / 2, bounds.minY + height / 2, 0,
      bounds.minX + width / 2, bounds.minY + height / 2, Math.max(width, height) * 0.7
    )
    gradient.addColorStop(0, '#1e2229')
    gradient.addColorStop(1, '#0f1012')
    ctx.fillStyle = gradient
    ctx.fillRect(bounds.minX, bounds.minY, width, height)

    ctx.fillStyle = '#0a0a0c'
    for (let i = 0; i < 50; i++) {
      const sx = bounds.minX + Math.random() * width
      const sy = bounds.minY + Math.random() * height
      const sr = Math.random() * 1.2 + 0.3
      ctx.globalAlpha = Math.random() * 0.3 + 0.1
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    drawTrack(targetCtx, trackData.points, trackData.hasPitLaneData, trackData.pitLanePoints)
    drawDRSZones(targetCtx, trackData.drsPolylines, isCompact)
    drawStartFinish(targetCtx, trackData.points, trackData.startIndex)
    drawSectorMarkers(targetCtx, trackData.points, trackData.sectorMarkers)
    drawPitMarkers(targetCtx, trackData.points, trackData.pitEntryIdx, trackData.pitExitIdx)
    drawCornerBadgesRender(targetCtx, cornerBadges, isCompact)

    if (offscreenCtx && offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0)
    }
  }, [trackData, cornerBadges, isCompact])

  return { staticCanvasRef, offscreenCanvasRef, isAnimatingIn: isAnimatingInRef.current }
}
