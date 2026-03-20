import type { TelemetryResponse } from '../types'

const MAX_CACHE_ENTRIES = 5
const MAX_TOTAL_ROWS = 500000

interface CacheEntry {
  sessionKey: string
  data: TelemetryResponse
  totalRows: number
  timestamp: number
}

let cache: CacheEntry[] = []

function isNonDecreasing(rows: TelemetryResponse[string]): boolean {
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].timestamp < rows[i - 1].timestamp) return false
  }
  return true
}

function dedupeByTimestamp(rows: TelemetryResponse[string]): TelemetryResponse[string] {
  if (!rows.length) return rows
  const deduped: TelemetryResponse[string] = [rows[0]]
  for (let i = 1; i < rows.length; i += 1) {
    const prev = deduped[deduped.length - 1]
    const cur = rows[i]
    if (cur.timestamp === prev.timestamp) deduped[deduped.length - 1] = cur
    else deduped.push(cur)
  }
  return deduped
}

function mergeSortedRows(existing: TelemetryResponse[string], incoming: TelemetryResponse[string]): TelemetryResponse[string] {
  if (!existing.length) return dedupeByTimestamp(incoming)
  if (!incoming.length) return existing

  const merged: TelemetryResponse[string] = []
  let i = 0
  let j = 0

  while (i < existing.length && j < incoming.length) {
    const a = existing[i]
    const b = incoming[j]
    if (a.timestamp < b.timestamp) {
      merged.push(a)
      i += 1
      continue
    }
    if (b.timestamp < a.timestamp) {
      merged.push(b)
      j += 1
      continue
    }
    merged.push(b)
    i += 1
    j += 1
  }

  while (i < existing.length) merged.push(existing[i++])
  while (j < incoming.length) merged.push(incoming[j++])
  return dedupeByTimestamp(merged)
}

function sliceByTimeRange(rows: TelemetryResponse[string], t0: number, t1: number): TelemetryResponse[string] {
  if (!rows.length) return rows
  
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].timestamp < t0) lo = mid + 1
    else hi = mid
  }
  const startIdx = lo
  
  lo = startIdx
  hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].timestamp <= t1) lo = mid + 1
    else hi = mid
  }
  const endIdx = lo
  
  return rows.slice(startIdx, endIdx)
}

function getTotalRowCount(telemetry: TelemetryResponse): number {
  let count = 0
  for (const rows of Object.values(telemetry)) {
    count += rows.length
  }
  return count
}

function evictCacheIfNeeded(): void {
  let totalRows = 0
  for (const entry of cache) {
    totalRows += entry.totalRows
  }
  
  while (cache.length > MAX_CACHE_ENTRIES || totalRows > MAX_TOTAL_ROWS) {
    const oldest = cache.shift()
    if (oldest) {
      totalRows -= oldest.totalRows
    }
  }
}

function getFromCache(sessionKey: string): TelemetryResponse | null {
  for (const entry of cache) {
    if (entry.sessionKey === sessionKey) {
      entry.timestamp = Date.now()
      return entry.data
    }
  }
  return null
}

function addToCache(sessionKey: string, data: TelemetryResponse): void {
  const existingIdx = cache.findIndex(e => e.sessionKey === sessionKey)
  if (existingIdx !== -1) {
    cache.splice(existingIdx, 1)
  }
  
  cache.push({
    sessionKey,
    data,
    totalRows: getTotalRowCount(data),
    timestamp: Date.now()
  })
  
  evictCacheIfNeeded()
}

let currentSessionKey: string | null = null
let currentTelemetryData: TelemetryResponse | null = null

self.onmessage = (e: MessageEvent) => {
  const { type, msgId, sessionKey, data, t0, t1 } = e.data

  if (type === 'clear') {
    currentSessionKey = null
    currentTelemetryData = null
    cache = []
    self.postMessage({ type: 'cleared', msgId })
    return
  }

  if (type === 'process') {
    if (currentSessionKey !== sessionKey) {
      currentSessionKey = sessionKey
      currentTelemetryData = getFromCache(sessionKey)
    }

    if (data) {
      const merged: TelemetryResponse = {}
      const driverKeys = new Set([
        ...Object.keys(currentTelemetryData || {}),
        ...Object.keys(data)
      ])

      for (const key of driverKeys) {
        const existingRows = currentTelemetryData?.[key] ?? []
        const incomingRows = data[key] ?? []
        const sortedIncoming = isNonDecreasing(incomingRows) ? incomingRows : [...incomingRows].sort((a, b) => a.timestamp - b.timestamp)
        merged[key] = mergeSortedRows(existingRows, sortedIncoming)
      }
      currentTelemetryData = merged
      addToCache(sessionKey, merged)
    }
    
    let result = currentTelemetryData || {}
    if (t0 !== undefined && t1 !== undefined && currentTelemetryData) {
      result = {}
      for (const key of Object.keys(currentTelemetryData)) {
        result[key] = sliceByTimeRange(currentTelemetryData[key], t0, t1)
      }
    }

    self.postMessage({ type: 'result', msgId, data: result })
  }
}
