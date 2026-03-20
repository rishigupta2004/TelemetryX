import { Point } from './trackGeometry'

type RenderCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export const drawPath = (
  ctx: RenderCtx,
  pts: Point[],
  color: string | CanvasGradient,
  lineWidth: number,
  dash: number[] = [],
  glowColor?: string,
  glowBlur?: number
) => {
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

export const drawCurbs = (
  ctx: RenderCtx,
  pts: Point[],
  inner: boolean,
  lineWidth: number
) => {
  if (!pts || pts.length < 2) return
  
  const segments: Point[] = []
  for (let i = 0; i < pts.length; i += 3) {
    segments.push(pts[i])
  }
  if (segments.length < 2) return

  ctx.beginPath()
  ctx.moveTo(segments[0].x, segments[0].y)
  for (let i = 1; i < segments.length; i++) {
    ctx.lineTo(segments[i].x, segments[i].y)
  }
  
  const curbColor = inner ? '#c41e3a' : '#1e3a5f'
  ctx.strokeStyle = curbColor
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([4, 6])
  ctx.stroke()
  ctx.setLineDash([])
}

export const drawLabelPill = (
  ctx: RenderCtx,
  x: number,
  y: number,
  label: string,
  color: string,
  bg: string,
  fontSize = 9
) => {
  ctx.save()
  const w = label.length * (fontSize * 0.65) + 14
  const h = fontSize + 8
  ctx.translate(x - w / 2, y - h / 2)

  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, h / 2)
  ctx.fillStyle = bg
  ctx.fill()

  ctx.lineWidth = 1.5
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.6
  ctx.stroke()

  ctx.globalAlpha = 1.0
  ctx.fillStyle = color
  ctx.font = `700 ${fontSize}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, w / 2, h / 2 + 0.5)
  ctx.restore()
}

export interface SectorMarker {
  key: string
  label: string
  idx: number
  color: string
  glowColor: string
}

export interface DRSZone {
  zoneNumber: number
  startIdx: number
  endIdx: number
  detectionIdx: number | null
}

export interface CornerData {
  number: number
  idx: number
  name: string | null
}

export const drawTrack = (
  ctx: RenderCtx,
  points: Point[],
  hasPitLane: boolean,
  pitLanePoints?: Point[]
) => {
  drawPath(ctx, points, 'rgba(45, 45, 50, 0.4)', 36)
  drawPath(ctx, points, '#3a3a42', 28)
  
  const trackGradient = ctx.createLinearGradient(0, 0, 1, 1)
  trackGradient.addColorStop(0, '#2d2d34')
  trackGradient.addColorStop(0.5, '#35353d')
  trackGradient.addColorStop(1, '#2a2a32')
  
  const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 }
  const grad = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
  grad.addColorStop(0, '#2d2d34')
  grad.addColorStop(0.5, '#35353d')
  grad.addColorStop(1, '#2a2a32')
  drawPath(ctx, points, grad, 18)
  drawPath(ctx, points, 'rgba(60, 60, 70, 0.6)', 12)

  if (hasPitLane && pitLanePoints && pitLanePoints.length > 0) {
    drawPath(ctx, pitLanePoints, 'rgba(45, 45, 50, 0.2)', 14)
    drawPath(ctx, pitLanePoints, '#2a2a30', 10)
    drawPath(ctx, pitLanePoints, 'rgba(255, 180, 50, 0.08)', 1.5, [8, 10])
  }
}

export const drawDRSZones = (
  ctx: RenderCtx,
  drsPolylines: Array<{ zone: DRSZone; segment: Point[]; midPoint: Point | null }>,
  isCompact: boolean
) => {
  drsPolylines.forEach(drs => {
    if (!drs.segment || drs.segment.length < 2) return

    drawPath(ctx, drs.segment, 'rgba(0, 210, 80, 0.22)', 16)
    drawPath(ctx, drs.segment, 'rgba(0, 230, 100, 0.92)', 4)

    if (drs.midPoint) {
      drawLabelPill(ctx, drs.midPoint.x, drs.midPoint.y - 24, `DRS ${drs.zone.zoneNumber}`, 'rgba(0,220,90,0.95)', 'rgba(5,30,15,0.92)', 10)
    }
  })
}

export const drawStartFinish = (
  ctx: RenderCtx,
  points: Point[],
  startIndex: number
) => {
  if (!points[startIndex]) return
  const startPoint = points[startIndex]
  const pPrev = points[(startIndex - 1 + points.length) % points.length]
  const pNext = points[(startIndex + 1) % points.length]
  const startAngle = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x)

  ctx.save()
  ctx.translate(startPoint.x, startPoint.y)
  ctx.rotate(startAngle)

  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.roundRect(-12, -18, 24, 36, 3)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.shadowBlur = 0

  const cellsX = 3
  const cellsY = 5
  const cellW = 24 / cellsX
  const cellH = 36 / cellsY
  for (let row = 0; row < cellsY; row++) {
    for (let col = 0; col < cellsX; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#1a1a1a' : '#ffffff'
      ctx.fillRect(-12 + col * cellW, -18 + row * cellH, cellW, cellH)
    }
  }

  ctx.restore()
}

export const drawSectorMarkers = (
  ctx: RenderCtx,
  points: Point[],
  sectorMarkers: SectorMarker[]
) => {
  sectorMarkers.forEach((sector, idx) => {
    if (!points[sector.idx]) return
    const p = points[sector.idx]
    const prev = points[(sector.idx - 1 + points.length) % points.length]
    const next = points[(sector.idx + 1) % points.length]
    const tx = next.x - prev.x
    const ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    const nx = (-ty / len) * 20
    const ny = (tx / len) * 20

    ctx.shadowColor = sector.glowColor
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.moveTo(p.x - nx, p.y - ny)
    ctx.lineTo(p.x + nx, p.y + ny)
    ctx.strokeStyle = sector.color
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.globalAlpha = 1.0
    ctx.stroke()
    ctx.shadowBlur = 0

    const sectorNum = idx + 1
    const outerRadius = 18
    ctx.beginPath()
    ctx.arc(p.x + nx * 1.8, p.y + ny * 1.8, outerRadius, 0, Math.PI * 2)
    const sectorGrad = ctx.createRadialGradient(
      p.x + nx * 1.8, p.y + ny * 1.8, 0,
      p.x + nx * 1.8, p.y + ny * 1.8, outerRadius
    )
    sectorGrad.addColorStop(0, sector.color + '40')
    sectorGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = sectorGrad
    ctx.fill()

    drawLabelPill(ctx, p.x + nx * 1.8, p.y + ny * 1.8, sector.label, sector.color, 'rgba(15,15,18,0.9)', 11)
  })
}

export const drawPitMarkers = (
  ctx: RenderCtx,
  points: Point[],
  pitEntryIdx: number | null,
  pitExitIdx: number | null
) => {
  if (pitEntryIdx != null && points[pitEntryIdx]) {
    const p = points[pitEntryIdx]
    
    ctx.shadowColor = 'rgba(255, 180, 50, 0.8)'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 180, 50, 0.2)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 180, 50, 1)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb432'
    ctx.fill()

    drawLabelPill(ctx, p.x + 20, p.y, 'PIT IN', 'rgba(255,200,80,0.95)', 'rgba(40,25,5,0.92)', 10)
  }
  
  if (pitExitIdx != null && points[pitExitIdx]) {
    const p = points[pitExitIdx]
    
    ctx.shadowColor = 'rgba(255, 180, 50, 0.8)'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 180, 50, 0.2)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 180, 50, 1)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb432'
    ctx.fill()

    drawLabelPill(ctx, p.x + 20, p.y, 'PIT OUT', 'rgba(255,200,80,0.95)', 'rgba(40,25,5,0.92)', 10)
  }
}

export const drawCornerBadges = (
  ctx: RenderCtx,
  corners: Array<{ x: number; y: number; number: number; name: string | null }>,
  isCompact: boolean
) => {
  corners.forEach(corner => {
    const badgeRadius = isCompact ? 8 : 11
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    ctx.beginPath()
    ctx.arc(corner.x, corner.y, badgeRadius + 2, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1b1f'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    const badgeGrad = ctx.createRadialGradient(
      corner.x - badgeRadius * 0.3, corner.y - badgeRadius * 0.3, 0,
      corner.x, corner.y, badgeRadius
    )
    badgeGrad.addColorStop(0, '#3a3b42')
    badgeGrad.addColorStop(1, '#252629')
    ctx.beginPath()
    ctx.arc(corner.x, corner.y, badgeRadius, 0, Math.PI * 2)
    ctx.fillStyle = badgeGrad
    ctx.fill()

    ctx.strokeStyle = '#4a4b52'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${isCompact ? 9 : 12}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(corner.number), corner.x, corner.y + 0.5)

    if (corner.name && !isCompact) {
      ctx.font = '500 8px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.fillText(corner.name, corner.x, corner.y + badgeRadius + 10)
    }
  })
}
