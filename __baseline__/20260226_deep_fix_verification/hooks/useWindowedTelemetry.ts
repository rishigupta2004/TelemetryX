import { useEffect, useMemo, useRef, useState } from 'react'
import { get } from '../api/client'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { useDriverStore } from '../stores/driverStore'
import type { TelemetryResponse, TelemetryRow } from '../types'
import { slugifyRace } from '../api/sessions'

export interface TelemetrySeries {
  time: number[]
  speed: number[]
  throttle: number[]
  brake: number[]
  gear: number[]
  drs: number[]
  rpm: number[]
}

interface CacheEntry {
  key: string
  t0: number
  t1: number
  data: TelemetryResponse
}

const CACHE_LIMIT = 3

function buildSeries(rows: TelemetryRow[] | undefined): TelemetrySeries {
  const safe = rows ?? []
  return {
    time: safe.map((r) => r.timestamp),
    speed: safe.map((r) => r.speed),
    throttle: safe.map((r) => r.throttle),
    brake: safe.map((r) => r.brake),
    gear: safe.map((r) => r.gear),
    drs: safe.map((r) => r.drs),
    rpm: safe.map((r) => r.rpm)
  }
}

export function useWindowedTelemetry(windowSeconds = 30) {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const { selectedYear, selectedRace, selectedSession, drivers } = useSessionStore((s) => ({
    selectedYear: s.selectedYear,
    selectedRace: s.selectedRace,
    selectedSession: s.selectedSession,
    drivers: s.drivers
  }))
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<TelemetryResponse>({})

  const cacheRef = useRef<CacheEntry[]>([])
  const lastRequestRef = useRef<{ key: string; t0: number; t1: number } | null>(null)
  const lastTimeRef = useRef<number>(0)

  const driverNumbers = useMemo(() => {
    const byCode = new Map(drivers.map((d) => [d.code, d.driverNumber]))
    const nums: number[] = []
    if (primaryDriver && byCode.has(primaryDriver)) nums.push(byCode.get(primaryDriver) as number)
    if (compareDriver && byCode.has(compareDriver)) nums.push(byCode.get(compareDriver) as number)
    return nums
  }, [drivers, primaryDriver, compareDriver])

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession) return
    if (!driverNumbers.length) return

    const timeDelta = Math.abs(currentTime - lastTimeRef.current)
    if (timeDelta < 2 && lastRequestRef.current) return
    lastTimeRef.current = currentTime

    const half = Math.max(5, windowSeconds / 2)
    const t0 = Math.max(0, currentTime - half)
    const t1 = currentTime + half
    const key = `${selectedYear}|${selectedRace}|${selectedSession}|${driverNumbers.join(',')}`

    const cached = cacheRef.current.find((entry) => entry.key === key && t0 >= entry.t0 && t1 <= entry.t1)
    if (cached) {
      setPayload(cached.data)
      return
    }

    setLoading(true)
    setError(null)
    const slug = slugifyRace(selectedRace)
    const params = new URLSearchParams()
    params.set('t0', t0.toFixed(3))
    params.set('t1', t1.toFixed(3))
    params.set('drivers', driverNumbers.join(','))

    get<TelemetryResponse>(`/sessions/${selectedYear}/${encodeURIComponent(slug)}/${encodeURIComponent(selectedSession)}/telemetry?${params.toString()}`)
      .then((data) => {
        setPayload(data)
        const next: CacheEntry = { key, t0, t1, data }
        cacheRef.current = [next, ...cacheRef.current.filter((entry) => entry.key !== key)].slice(0, CACHE_LIMIT)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setLoading(false)
        lastRequestRef.current = { key, t0, t1 }
      })
  }, [selectedYear, selectedRace, selectedSession, driverNumbers, currentTime, windowSeconds])

  const primarySeries = useMemo(() => buildSeries(primaryDriver ? payload[primaryDriver] : undefined), [payload, primaryDriver])
  const compareSeries = useMemo(() => buildSeries(compareDriver ? payload[compareDriver] : undefined), [payload, compareDriver])

  return {
    primary: primarySeries,
    compare: compareDriver ? compareSeries : null,
    loading,
    error
  }
}
