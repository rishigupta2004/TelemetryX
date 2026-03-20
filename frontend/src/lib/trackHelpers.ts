import { Point, PathLookup } from './trackGeometry'

export const asArray = <T = unknown>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return Object.values(value) as T[]
  return []
}

export const toIndex = (value: unknown, length: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const idx = Math.round(value)
  if (idx < 0 || idx >= length) return null
  return idx
}

export const normalizeCircuitKey = (value: string | null | undefined): string => {
  return String(value || '')
    .toLowerCase()
    .replace(/grand prix/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const isClosedLoop = (points: Point[]): boolean => {
  if (points.length < 2) return false
  const a = points[0]
  const b = points[points.length - 1]
  return a.x === b.x && a.y === b.y
}

export const rotateIndex = (idx: number | null, length: number, startIdx: number): number | null => {
  if (idx == null || length <= 0) return null
  if (idx < 0 || idx >= length) return null
  return (idx - startIdx + length) % length
}

export const normalizeLoopProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) return 0
  const normalized = progress % 1
  return normalized < 0 ? normalized + 1 : normalized
}

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t
}

export const easeInOut = (value: number): number => {
  const t = clamp(value, 0, 1)
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

export const blendPoints = (
  a: Point,
  b: Point,
  t: number
): Point => {
  const weight = easeInOut(t)
  return { x: lerp(a.x, b.x, weight), y: lerp(a.y, b.y, weight) }
}

export const shadeColor = (color: string, percent: number): string => {
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

export const textColorForHex = (hex: string): string => {
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

export interface CornerBadge {
  key: string
  number: number
  name: string | null
  idx: number
  x: number
  y: number
}

export const buildCornerBadges = (
  points: Point[],
  corners: Array<{ number: number; idx: number; name: string | null }>
): CornerBadge[] => {
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

export const buildZonePoints = (
  points: Point[],
  startIdx: number,
  endIdx: number
): Point[] => {
  if (!points.length) return []
  const n = points.length
  const out: Point[] = []
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

export const nearestPointIndex = (
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
