import { useEffect, useRef, useMemo } from 'react'
import type { RefObject } from 'react'
import { animate } from 'animejs'
import { Point } from '../lib/trackGeometry'
import { buildCornerBadges, CornerBadge } from '../lib/trackHelpers'
import {
  drawTrack,
  drawDRSZones,
  drawStartFinish,
  drawSectorMarkers,
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
  containerRef: RefObject<HTMLDivElement | null>
) => {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null)
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
    const containerWidth = Math.max(1, Math.floor(containerRef.current?.clientWidth ?? trackData.width))
    const containerHeight = Math.max(1, Math.floor(containerRef.current?.clientHeight ?? trackData.height))
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerWidth, containerHeight)

    const gradient = ctx.createRadialGradient(
      containerWidth / 2, containerHeight / 2, 0,
      containerWidth / 2, containerHeight / 2, Math.max(containerWidth, containerHeight) * 0.7
    )
    gradient.addColorStop(0, '#1e2229')
    gradient.addColorStop(1, '#0f1012')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, containerWidth, containerHeight)

    const { bounds, width, height } = trackData

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

    drawTrack(ctx, trackData.points, false)
    drawDRSZones(ctx, trackData.drsPolylines, isCompact)
    drawStartFinish(ctx, trackData.points, trackData.startIndex)
    drawSectorMarkers(ctx, trackData.points, trackData.sectorMarkers)
    drawCornerBadgesRender(ctx, cornerBadges, isCompact)
  }, [trackData, cornerBadges, isCompact, containerRef])

  return { staticCanvasRef, isAnimatingIn: isAnimatingInRef.current }
}
