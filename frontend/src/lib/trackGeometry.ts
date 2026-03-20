export interface Point { x: number; y: number }
export interface PathLookup { x: Float32Array; y: Float32Array; sampleCount: number }

const isLonLat = (pts: Point[]): boolean => {
  if (!pts.length) return false
  let chk = 0, val = 0
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    chk++
    if (Math.abs(p.x) <= 180 && Math.abs(p.y) <= 90) val++
    if (chk >= 20) break
  }
  return chk > 0 && val / chk >= 0.8
}

const projectToMeters = (pts: Point[], refLonLat?: { x: number, y: number }): Point[] => {
  if (!pts.length) return []
  const lon0 = refLonLat ? refLonLat.x : pts[0].x
  const lat0 = refLonLat ? refLonLat.y : pts[0].y
  const cos = Math.cos((lat0 * Math.PI) / 180)
  return pts.map(p => ({ x: (p.x - lon0) * 111_320 * cos, y: (p.y - lat0) * 111_320 }))
}

export const parseCenterline = (raw: number[][], refLonLat?: { x: number, y: number }): Point[] => {
  const out: Point[] = []
  for (const item of raw as unknown[]) {
    let x = 0, y = 0
    if (Array.isArray(item)) { x = Number(item[0]); y = Number(item[1]) }
    else if (item && typeof item === 'object') { x = Number((item as { x?: number }).x); y = Number((item as { y?: number }).y) }
    else continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({ x, y })
  }
  return isLonLat(out) ? projectToMeters(out, refLonLat).map(p => ({ x: p.x, y: -p.y })) : out
}

export const getBounds = (pts: Point[], pad = 60) => {
  if (!pts.length) return { minX: -pad, maxX: pad, minY: -pad, maxY: pad }
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad }
}

export const toPolylinePoints = (pts: Point[]): string => {
  if (!pts.length) return ''
  let out = `${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) out += ` ${pts[i].x},${pts[i].y}`
  return out
}

export const computeArcLengths = (pts: Point[]): number[] => {
  if (!pts.length) return [0]
  const lens = [0]
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    lens.push(lens[i - 1] + Math.sqrt(dx * dx + dy * dy))
  }
  return lens
}

export const interpolateAlongPath = (pts: Point[], progress: number, arcLens?: number[]): Point => {
  if (!pts.length) return { x: 0, y: 0 }
  if (pts.length === 1) return pts[0]
  const t = Math.max(0, Math.min(1, progress))
  const lens = arcLens ?? computeArcLengths(pts)
  const total = lens[lens.length - 1]
  const target = t * total
  let lo = 0, hi = lens.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (lens[mid] < target) lo = mid
    else hi = mid
  }
  const segLen = lens[hi] - lens[lo]
  if (!segLen) return pts[lo]
  const f = (target - lens[lo]) / segLen
  return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * f, y: pts[lo].y + (pts[hi].y - pts[lo].y) * f }
}

export const buildPathLookup = (pts: Point[], arcLens: number[], n = 10_000): PathLookup | null => {
  if (pts.length < 2 || arcLens.length < 2 || n < 2) return null
  const x = new Float32Array(n), y = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = interpolateAlongPath(pts, i / (n - 1), arcLens)
    x[i] = p.x; y[i] = p.y
  }
  return { x, y, sampleCount: n }
}

export const interpolateFromLookup = (lk: PathLookup | null, p: number): Point => {
  if (!lk || lk.sampleCount < 2) return { x: 0, y: 0 }
  const t = Math.max(0, Math.min(1, p))
  const idx = Math.floor(t * (lk.sampleCount - 1))
  const next = Math.min(lk.sampleCount - 1, idx + 1)
  const f = t * (lk.sampleCount - 1) - idx
  return { x: lk.x[idx] + (lk.x[next] - lk.x[idx]) * f, y: lk.y[idx] + (lk.y[next] - lk.y[idx]) * f }
}

export const pathLength = (pts: Point[]): number => {
  const lens = computeArcLengths(pts)
  return lens.length ? lens[lens.length - 1] : 0
}

export const normalizeToViewport = (pts: Point[], vw: number, vh: number, pad = 24): Point[] => {
  if (!pts.length) return []
  const { minX, maxX, minY, maxY } = getBounds(pts, 0)
  const e = 1e-9
  const sw = Math.max(e, maxX - minX)
  const sh = Math.max(e, maxY - minY)
  const tw = Math.max(1, vw - pad * 2)
  const th = Math.max(1, vh - pad * 2)
  const sc = Math.min(tw / sw, th / sh)
  return pts.map(p => ({ x: (vw - sw * sc) / 2 + (p.x - minX) * sc, y: (vh - sh * sc) / 2 + (p.y - minY) * sc }))
}

export interface CornerData { number: number; idx: number; name: string | null }

export const validateAndSortCorners = (corners: CornerData[]): CornerData[] => {
  if (!corners.length) return []
  const valid = corners.filter((c): c is CornerData => c != null && Number.isFinite(c.idx) && Number.isFinite(c.number))
  valid.sort((a, b) => a.idx - b.idx)
  return valid.map((c, i) => ({ ...c, number: Number.isFinite(c.number) && c.number > 0 ? c.number : i + 1 }))
}
