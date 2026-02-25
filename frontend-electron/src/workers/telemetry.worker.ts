import type { TelemetryResponse } from '../types'

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

let currentSessionKey: string | null = null
let currentTelemetryData: TelemetryResponse | null = null

self.onmessage = (e: MessageEvent) => {
  const { type, msgId, sessionKey, data, t0, t1 } = e.data

  if (type === 'clear') {
    currentSessionKey = null
    currentTelemetryData = null
    self.postMessage({ type: 'cleared', msgId })
    return
  }

  if (type === 'process') {
    if (currentSessionKey !== sessionKey) {
      currentSessionKey = sessionKey
      currentTelemetryData = null
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
