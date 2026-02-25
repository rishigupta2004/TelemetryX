import React, { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { COMPOUND_COLORS } from '../lib/colors'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { TyreStint, UndercutEvent } from '../types'

type SortMode = 'position' | 'result' | 'alpha'

interface UndercutDriverStats {
  total: number
  successRate: number
  avgGain: number
}

interface PreparedStint extends TyreStint {
  avgLapTimeSec: number | null
}

function readableCompound(compound: string): string {
  return compound[0] + compound.slice(1).toLowerCase()
}

function formatLapTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--.---'
  const mins = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000)
  return `${mins}:${String(sec).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

function normalizeCompound(compound: string): string {
  const upper = String(compound || '').toUpperCase()
  if (upper.includes('SOFT')) return 'SOFT'
  if (upper.includes('MEDIUM')) return 'MEDIUM'
  if (upper.includes('HARD')) return 'HARD'
  if (upper.includes('INTER')) return 'INTER'
  if (upper.includes('WET')) return 'WET'
  return upper || 'UNKNOWN'
}

const LEGEND_COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTER', 'WET'] as const

function buildDriverUndercutStats(events: UndercutEvent[]): Map<string, UndercutDriverStats> {
  const grouped = new Map<string, UndercutEvent[]>()
  for (const event of events) {
    const key = String(event.driver_name || '').toUpperCase()
    if (!key) continue
    const list = grouped.get(key) ?? []
    list.push(event)
    grouped.set(key, list)
  }

  const stats = new Map<string, UndercutDriverStats>()
  for (const [driver, list] of grouped.entries()) {
    const total = list.length
    const successCount = list.reduce((sum, item) => sum + (item.undercut_success ? 1 : 0), 0)
    const avgGain =
      total > 0
        ? list.reduce((sum, item) => sum + Number(item.position_change || 0), 0) / total
        : 0
    stats.set(driver, {
      total,
      successRate: total > 0 ? successCount / total : 0,
      avgGain
    })
  }
  return stats
}

function deriveCurrentLap(lapBoundaries: Array<{ lap: number; start: number }>, sessionTime: number): number {
  if (!lapBoundaries.length) return 1
  let lo = 0
  let hi = lapBoundaries.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lapBoundaries[mid].start <= sessionTime) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return lapBoundaries[ans].lap
}

export const PitStrategy = React.memo(function PitStrategy() {
  const tyreStints = useSessionStore((s) => s.tyreStints)
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const sessionTime = useSessionTime()
  const isPlaying = usePlaybackStore((s) => s.isPlaying)

  const [sortMode, setSortMode] = useState<SortMode>('position')
  const [undercutEvents, setUndercutEvents] = useState<UndercutEvent[]>([])
  const [undercutLoading, setUndercutLoading] = useState(false)
  const [undercutError, setUndercutError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedYear || !selectedRace) {
      setUndercutEvents([])
      setUndercutLoading(false)
      setUndercutError(null)
      return
    }

    let cancelled = false
    setUndercutLoading(true)
    setUndercutError(null)

    api
      .getUndercutEvents({ year: selectedYear, raceName: selectedRace, limit: 1000 })
      .then((payload) => {
        if (cancelled) return
        setUndercutEvents(payload.events || [])
      })
      .catch((err) => {
        if (cancelled) return
        setUndercutEvents([])
        setUndercutError(String(err))
      })
      .finally(() => {
        if (!cancelled) setUndercutLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedRace])

  const totalLaps = useMemo(() => {
    if (!tyreStints || tyreStints.length === 0) return 0
    return Math.max(...tyreStints.map((s) => s.last_lap))
  }, [tyreStints])

  const lapBoundaries = useMemo(() => {
    const startByLap = new Map<number, number>()
    for (const lap of laps) {
      if (!Number.isFinite(lap.lapNumber) || !Number.isFinite(lap.lapStartSeconds)) continue
      const existing = startByLap.get(lap.lapNumber)
      if (existing == null || lap.lapStartSeconds < existing) {
        startByLap.set(lap.lapNumber, lap.lapStartSeconds)
      }
    }
    return Array.from(startByLap.entries())
      .map(([lap, start]) => ({ lap, start }))
      .sort((a, b) => a.lap - b.lap)
  }, [laps])

  const currentLap = useMemo(() => deriveCurrentLap(lapBoundaries, sessionTime), [lapBoundaries, sessionTime])

  const finalPositionByDriver = useMemo(() => {
    const best = new Map<string, { lap: number; pos: number }>()
    for (const lap of laps) {
      const key = lap.driverName
      if (!key) continue
      const prev = best.get(key)
      if (!prev || lap.lapNumber > prev.lap) {
        best.set(key, { lap: lap.lapNumber, pos: lap.position })
      }
    }
    const out = new Map<string, number>()
    for (const [driver, value] of best.entries()) out.set(driver, value.pos)
    return out
  }, [laps])

  const undercutByDriver = useMemo(() => {
    const targetSession = String(selectedSession || '').toUpperCase()
    const filtered = undercutEvents.filter((event) => {
      const eventSession = String(event.session || '').toUpperCase()
      return targetSession ? eventSession === targetSession : true
    })
    return buildDriverUndercutStats(filtered)
  }, [undercutEvents, selectedSession])

  const driverStints = useMemo(() => {
    if (!tyreStints || tyreStints.length === 0) return []

    const lapsByDriver = new Map<string, typeof laps>()
    for (const lap of laps) {
      const key = lap.driverName
      if (!key) continue
      const list = lapsByDriver.get(key) ?? []
      list.push(lap)
      lapsByDriver.set(key, list)
    }

    const grouped = new Map<string, TyreStint[]>()
    for (const stint of tyreStints) {
      const key = stint.driver_name
      const list = grouped.get(key) ?? []
      list.push(stint)
      grouped.set(key, list)
    }

    const rows = Array.from(grouped.entries()).map(([driver, stints]) => {
      const sortedStints = [...stints].sort((a, b) => a.stint_number - b.stint_number)
      const driverLaps = lapsByDriver.get(driver) ?? []

      const preparedStints: PreparedStint[] = sortedStints.map((stint) => {
        const inRange = driverLaps.filter(
          (lap) =>
            lap.lapNumber >= stint.first_lap &&
            lap.lapNumber <= stint.last_lap &&
            lap.lapTime != null &&
            Number.isFinite(lap.lapTime) &&
            !lap.isDeleted
        )
        const avgLapTimeSec =
          inRange.length > 0
            ? inRange.reduce((sum, lap) => sum + Number(lap.lapTime || 0), 0) / inRange.length
            : null
        return { ...stint, avgLapTimeSec }
      })

      return {
        driver,
        driverNumber: sortedStints[0].driver_number,
        position: sortedStints[0].position,
        finalPosition: finalPositionByDriver.get(driver) ?? sortedStints[0].position,
        strategy: sortedStints[0].tyre_strategy_sequence,
        stints: preparedStints
      }
    })

    rows.sort((a, b) => {
      if (sortMode === 'alpha') return a.driver.localeCompare(b.driver)
      if (sortMode === 'result') return a.finalPosition - b.finalPosition
      return a.position - b.position
    })

    return rows
  }, [tyreStints, laps, finalPositionByDriver, sortMode])

  const averagePitStops = useMemo(() => {
    if (!driverStints.length) return 0
    const totalStops = driverStints.reduce((sum, row) => sum + Math.max(0, row.stints.length - 1), 0)
    return totalStops / driverStints.length
  }, [driverStints])

  const getTeamColor = (driverCode: string) => {
    const driver = sessionData?.drivers?.find((d) => d.code === driverCode)
    return driver?.teamColor || '#666666'
  }

  if (selectedSession && !String(selectedSession).toUpperCase().startsWith('R')) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-text-muted">
        Not applicable for qualifying sessions.
      </div>
    )
  }

  if (!driverStints.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-text-muted">
        No pit strategy data available for current session selection.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-bg-card">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-secondary">Pit Strategy</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Stint timeline with pit events and undercut context</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded border border-border bg-bg-secondary px-1 py-1">
            <ArrowUpDown size={12} className="text-text-muted" />
            {(['position', 'result', 'alpha'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${sortMode === mode ? 'bg-bg-selected text-text-primary' : 'text-text-muted hover:text-text-primary'
                  }`}
              >
                {mode === 'position' ? 'Position' : mode === 'result' ? 'Result' : 'A-Z'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 text-right">
            <div className="rounded border border-border bg-bg-secondary px-2 py-1">
              <div className="text-[9px] uppercase tracking-[0.1em] text-text-muted">Drivers</div>
              <div className="font-mono text-[11px] text-text-primary">{driverStints.length}</div>
            </div>
            <div className="rounded border border-border bg-bg-secondary px-2 py-1">
              <div className="text-[9px] uppercase tracking-[0.1em] text-text-muted">Avg Stops</div>
              <div className="font-mono text-[11px] text-text-primary">{averagePitStops.toFixed(1)}</div>
            </div>
            <div className="rounded border border-border bg-bg-secondary px-2 py-1">
              <div className="text-[9px] uppercase tracking-[0.1em] text-text-muted">Distance</div>
              <div className="font-mono text-[11px] text-text-primary">{totalLaps}L</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[96px_1fr_50px] gap-2 border-b border-border/80 px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-text-muted">
        <span>Driver</span>
        <span>Compound Timeline</span>
        <span className="text-right">Stops</span>
      </div>

      <div className="flex-1 min-h-0 space-y-1 overflow-y-auto px-3 py-2">
        {driverStints.map(({ driver, position, finalPosition, stints, strategy }) => {
          const pitLaps = stints.slice(1).map((stint) => stint.first_lap)
          const pitNow = isPlaying && pitLaps.includes(currentLap)
          const undercut = undercutByDriver.get(driver)

          return (
            <div
              key={`${driver}-${strategy}`}
              className={`grid min-h-[52px] grid-cols-[96px_1fr_50px] items-center gap-2 rounded border border-transparent px-1 transition hover:border-white/10 hover:bg-bg-secondary/60 ${pitNow ? 'tx-pit-flash' : ''
                }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-6 text-right font-mono text-[10px] text-text-muted">P{position}</span>
                <div className="h-5 w-1 shrink-0 rounded-sm" style={{ backgroundColor: getTeamColor(driver) }} />
                <span className="font-mono text-xs font-semibold text-text-primary">{driver}</span>
                {finalPosition !== position && (
                  <span className="rounded bg-white/8 px-1 py-0.5 font-mono text-[9px] text-text-secondary">F{finalPosition}</span>
                )}
              </div>

              <div className="relative h-[36px] w-full overflow-visible rounded border border-border/70 bg-bg-secondary/40">
                {stints.map((stint, idx) => {
                  const leftPct = (Math.max(0, stint.first_lap - 1) / totalLaps) * 100
                  const widthPct = (stint.tyre_laps_in_stint / totalLaps) * 100
                  const compound = normalizeCompound(stint.tyre_compound)
                  const color = COMPOUND_COLORS[compound] || '#666666'
                  const textColor = compound === 'HARD' ? '#111111' : '#0b0f14'
                  const isPitBoundary = idx > 0
                  const tooltip = `${compound} | Age ${stint.tyre_age_at_stint_start}-${stint.tyre_age_at_stint_end} laps | Stint ${stint.tyre_laps_in_stint} laps | Avg ${formatLapTime(stint.avgLapTimeSec)}`

                  return (
                    <div
                      key={`${driver}-${stint.stint_number}`}
                      className="group absolute bottom-0 top-0 flex cursor-default items-center justify-center overflow-visible border-r border-black/20"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        background: `linear-gradient(to right, ${color}88, ${color}18)`,
                        borderTop: `2px solid ${color}`,
                        minWidth: '16px'
                      }}
                    >
                      {isPitBoundary && (
                        <div
                          className="pointer-events-none absolute -left-[1px] top-[-4px] h-[32px] w-[2px] bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.55)]"
                          title={`Pit stop lap ${stint.first_lap}`}
                        />
                      )}
                      <span className="font-mono text-[13px] font-bold" style={{ color: textColor }}>
                        {compound[0]}
                      </span>
                      <div className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 hidden w-[220px] -translate-x-1/2 rounded border border-border bg-bg-card/95 p-1.5 text-[10px] text-text-secondary shadow-[0_12px_24px_rgba(0,0,0,0.4)] group-hover:block">
                        {tooltip}
                      </div>
                    </div>
                  )
                })}

                {undercut && undercut.total > 0 && (
                  <div
                    className={`pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono ${undercut.successRate >= 0.5
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                      }`}
                    title={`Undercut events ${undercut.total}, success ${(undercut.successRate * 100).toFixed(0)}%, avg pos delta ${undercut.avgGain.toFixed(2)}`}
                  >
                    <Sparkles size={10} />
                    UC {(undercut.successRate * 100).toFixed(0)}%
                  </div>
                )}
              </div>

              <span className="w-10 shrink-0 text-right font-mono text-[10px] text-text-muted">{stints.length - 1}P</span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND_COMPOUNDS.map((compound) => {
            const color = COMPOUND_COLORS[compound] ?? COMPOUND_COLORS.INTERMEDIATE ?? '#666666'
            return (
              <div key={compound} className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-text-muted">{readableCompound(compound)}</span>
              </div>
            )
          })}
        </div>
        <div className="text-[10px] text-text-muted">
          {undercutLoading ? 'Loading undercut events...' : undercutError ? 'Undercut history unavailable' : `Lap ${currentLap}`}
        </div>
      </div>
    </div>
  )
})
