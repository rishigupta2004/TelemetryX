export interface Point {
  x: number
  y: number
}

/**
 * Takes raw centerline array [[x,y], [x,y], ...]
 * Returns Point[]
 */
export function parseCenterline(raw: number[][]): Point[] {
  return raw.map(([x, y]) => ({ x: -y, y: -x }))
}

/**
 * Compute bounding box of points with padding
 */
export function getBounds(points: Point[], padding = 60) {
  if (!points.length) {
    return { minX: -padding, maxX: padding, minY: -padding, maxY: padding }
  }

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minY: Math.min(...ys) - padding,
    maxY: Math.max(...ys) + padding
  }
}

/**
 * Convert points to SVG polyline points string
 */
export function toPolylinePoints(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * Given progress 0.0-1.0, return interpolated point
 * along the centerline path.
 * progress=0 -> first point, progress=1 -> last point
 */
export function interpolateAlongPath(points: Point[], progress: number): Point {
  if (!points.length) return { x: 0, y: 0 }

  const clamped = Math.max(0, Math.min(1, progress))
  const index = clamped * (points.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) return points[lower]

  const t = index - lower
  return {
    x: points[lower].x + (points[upper].x - points[lower].x) * t,
    y: points[lower].y + (points[upper].y - points[lower].y) * t
  }
}

/**
 * Compute cumulative path lengths for each segment.
 * Returns total path length.
 */
export function pathLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    total += Math.sqrt(dx * dx + dy * dy)
  }
  return total
}

/**
 * Scale and center points into a viewport while preserving aspect ratio.
 */
export function normalizeToViewport(
  points: Point[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 24
): Point[] {
  if (!points.length) return []

  const { minX, maxX, minY, maxY } = getBounds(points, 0)
  const sourceWidth = Math.max(1, maxX - minX)
  const sourceHeight = Math.max(1, maxY - minY)

  const targetWidth = Math.max(1, viewportWidth - padding * 2)
  const targetHeight = Math.max(1, viewportHeight - padding * 2)
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)

  const scaledWidth = sourceWidth * scale
  const scaledHeight = sourceHeight * scale
  const offsetX = (viewportWidth - scaledWidth) / 2
  const offsetY = (viewportHeight - scaledHeight) / 2

  return points.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale
  }))
}
