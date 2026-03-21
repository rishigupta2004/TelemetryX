import { useEffect, useMemo, useRef, useState } from 'react'
import { get } from '../api/client'
import { slugifyRace } from '../api/sessions'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import { getRaceControlState } from '../lib/raceControlState'
import type { PositionRow } from '../types'

export interface DriverPosition {
  x: number
  y: number
  trackFraction: number
}

const FETCH_THROTTLE_MS = 500

export function useWindowedPositions(windowSeconds = 20) {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const drivers = useSessionStore((s) => s.drivers)

  const [rows, setRows] = useState<PositionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastFetchRef = useRef<number>(-1)
  const timerRef = useRef<number | null>(null)
  const absoluteTimeRef = useRef<number>(0)
  const lastFlagRef = useRef<string | null>(null)

  const absoluteTime = sessionStartTime + currentTime

  useEffect(() => {
    absoluteTimeRef.current = absoluteTime
  }, [absoluteTime])

  useEffect(() => {
    lastFetchRef.current = -1
    setRows([])
  }, [selectedYear, selectedRace, selectedSession])

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

    const sd = useSessionStore.getState().sessionData
    const rc = sd?.raceControl
    let activeFlag: string | null = null
    if (rc?.length) {
      const sorted = [...rc].sort((a, b) => a.timestamp - b.timestamp)
      const state = getRaceControlState(sorted, absoluteTime, sd?.metadata?.raceStartSeconds ?? null)
      activeFlag = state.isSafetyCar ? 'SC' : state.isVSC ? 'VSC' : state.trackFlag
    }
    const flagChanged = activeFlag !== lastFlagRef.current
    lastFlagRef.current = activeFlag

    const delta = Math.abs(absoluteTime - lastFetchRef.current)
    if (flagChanged || delta >= 2 || lastFetchRef.current < 0) {
      lastFetchRef.current = absoluteTime
      fetchWindow(absoluteTime)
    }
  }, [selectedYear, selectedRace, selectedSession, absoluteTime, windowSeconds])

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
      const t = absoluteTimeRef.current
      const delta = Math.abs(t - lastFetchRef.current)
      if (delta >= 2) {
        lastFetchRef.current = t
        fetchWindow(t)
      }
    }, FETCH_THROTTLE_MS)
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPlaying, selectedYear, selectedRace, selectedSession, windowSeconds])

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
        if (list[mid].timestamp < absoluteTime) lo = mid
        else hi = mid
      }
      const a = list[lo]
      const b = list[Math.min(lo + 1, list.length - 1)]
      const span = b.timestamp - a.timestamp
      const t = span > 0 ? (absoluteTime - a.timestamp) / span : 0
      const lerp = (v0: number, v1: number) => v0 + (v1 - v0) * Math.max(0, Math.min(1, t))
      const x = lerp(a.x, b.x)
      const y = lerp(a.y, b.y)
      const startTs = list[0].timestamp
      const endTs = list[list.length - 1].timestamp
      const frac = endTs > startTs ? (absoluteTime - startTs) / (endTs - startTs) : 0
      out.set(driverNumber, { x, y, trackFraction: Math.max(0, Math.min(1, frac)) })
    }
    return out
  }, [rows, absoluteTime])

  return { positions, loading, error }
}
