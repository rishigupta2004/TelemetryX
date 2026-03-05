import { useEffect, useMemo, useRef, useState } from 'react'
import { get } from '../api/client'
import { slugifyRace } from '../api/sessions'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { PositionRow } from '../types'

export interface DriverPosition {
  x: number
  y: number
  trackFraction: number
}

const FETCH_THROTTLE_MS = 500

export function useWindowedPositions(windowSeconds = 20) {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const { selectedYear, selectedRace, selectedSession, drivers } = useSessionStore((s) => ({
    selectedYear: s.selectedYear,
    selectedRace: s.selectedRace,
    selectedSession: s.selectedSession,
    drivers: s.drivers
  }))

  const [rows, setRows] = useState<PositionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastFetchRef = useRef<number>(-1)
  const timerRef = useRef<number | null>(null)

  const fetchWindow = (t: number) => {
    if (!selectedYear || !selectedRace || !selectedSession) return
    const t0 = Math.max(0, t - Math.max(5, windowSeconds * 0.25))
    const t1 = t + Math.max(5, windowSeconds * 0.75)
    const slug = slugifyRace(selectedRace)
    const params = new URLSearchParams()
    params.set('t0', t0.toFixed(3))
    params.set('t1', t1.toFixed(3))
    if (drivers.length) {
      params.set('drivers', drivers.map((d) => d.driverNumber).join(','))
    }

    setLoading(true)
    setError(null)
    get<PositionRow[]>(`/sessions/${selectedYear}/${encodeURIComponent(slug)}/${encodeURIComponent(selectedSession)}/positions?${params.toString()}`)
      .then((data) => setRows(data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession) return
    const delta = Math.abs(currentTime - lastFetchRef.current)
    if (delta >= 2 || lastFetchRef.current < 0) {
      lastFetchRef.current = currentTime
      fetchWindow(currentTime)
    }
  }, [selectedYear, selectedRace, selectedSession, currentTime, windowSeconds])

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    if (timerRef.current != null) return
    timerRef.current = window.setInterval(() => {
      const delta = Math.abs(currentTime - lastFetchRef.current)
      if (delta >= 2) {
        lastFetchRef.current = currentTime
        fetchWindow(currentTime)
      }
    }, FETCH_THROTTLE_MS)
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPlaying, currentTime, windowSeconds])

  const positions = useMemo(() => {
    const byDriver = new Map<number, PositionRow[]>()
    for (const row of rows) {
      const list = byDriver.get(row.driverNumber) ?? []
      list.push(row)
      byDriver.set(row.driverNumber, list)
    }
    for (const list of byDriver.values()) {
      list.sort((a, b) => a.timestamp - b.timestamp)
    }

    const out = new Map<number, DriverPosition>()
    for (const [driverNumber, list] of byDriver.entries()) {
      if (!list.length) continue
      let lo = 0
      let hi = list.length - 1
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1
        if (list[mid].timestamp < currentTime) lo = mid
        else hi = mid
      }
      const a = list[lo]
      const b = list[Math.min(lo + 1, list.length - 1)]
      const span = b.timestamp - a.timestamp
      const t = span > 0 ? (currentTime - a.timestamp) / span : 0
      const lerp = (v0: number, v1: number) => v0 + (v1 - v0) * Math.max(0, Math.min(1, t))
      const x = lerp(a.x, b.x)
      const y = lerp(a.y, b.y)
      const startTs = list[0].timestamp
      const endTs = list[list.length - 1].timestamp
      const frac = endTs > startTs ? (currentTime - startTs) / (endTs - startTs) : 0
      out.set(driverNumber, { x, y, trackFraction: Math.max(0, Math.min(1, frac)) })
    }
    return out
  }, [rows, currentTime])

  return { positions, loading, error }
}
