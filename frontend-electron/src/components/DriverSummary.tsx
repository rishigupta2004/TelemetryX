import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import type { DriverSummaryResponse } from '../types'

interface DriverSummaryProps {
  onSummaryLoaded?: (summary: DriverSummaryResponse | null) => void
}

function fmtNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return Number(value).toFixed(digits)
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${(Number(value) * 100).toFixed(1)}%`
}

function fmtSigned(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value > 0 ? '+' : ''}${Number(value).toFixed(digits)}`
}

function fmtPosition(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `P${Math.round(Number(value))}`
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-0.5 last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-primary">{value}</span>
    </div>
  )
}

export const DriverSummary = React.memo(function DriverSummary({ onSummaryLoaded }: DriverSummaryProps) {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const sessionData = useSessionStore((s) => s.sessionData)

  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)

  const [summary, setSummary] = useState<DriverSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const driverMeta = useMemo(() => {
    const drivers = sessionData?.drivers ?? []
    const primary = primaryDriver ? drivers.find((item) => item.code === primaryDriver) : null
    const compare = compareDriver ? drivers.find((item) => item.code === compareDriver) : null
    return { primary, compare }
  }, [sessionData?.drivers, primaryDriver, compareDriver])

  const driverQueries = useMemo(() => {
    const drivers = sessionData?.drivers ?? []
    const toQuery = (code: string | null): string | null => {
      if (!code) return null
      const driver = drivers.find((item) => item.code === code)
      return driver ? String(driver.driverNumber) : null
    }

    const primary = toQuery(primaryDriver)
    const compare = toQuery(compareDriver)

    return {
      primary,
      compare: primary && compare && primary !== compare ? compare : null
    }
  }, [sessionData?.drivers, primaryDriver, compareDriver])

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession || !driverQueries.primary) {
      setSummary(null)
      setError(null)
      if (onSummaryLoaded) onSummaryLoaded(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getDriverSummary(
        selectedYear,
        selectedRace,
        selectedSession,
        driverQueries.primary,
        driverQueries.compare ?? undefined
      )
      .then((payload) => {
        if (!cancelled) {
          setSummary(payload)
          if (onSummaryLoaded) onSummaryLoaded(payload)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null)
          setError(String(err))
          if (onSummaryLoaded) onSummaryLoaded(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedRace, selectedSession, driverQueries.primary, driverQueries.compare, onSummaryLoaded])

  if (!primaryDriver) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-text-muted">
        Select a driver to load summary
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-text-secondary">
        Loading driver summary...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-red-400">
        {error}
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-text-muted">
        Driver summary unavailable
      </div>
    )
  }

  if (summary.available === false) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-bg-card p-4 text-sm text-text-muted">
        {summary.reason || 'Driver summary unavailable for current feature set'}
      </div>
    )
  }

  return (
    <div className="feature-card flex h-full flex-col rounded-md border border-border bg-bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-1 rounded-full"
            style={{ backgroundColor: driverMeta.primary?.teamColor || '#444' }}
          />
          {driverMeta.primary?.driverImage ? (
            <img
              src={driverMeta.primary.driverImage}
              alt={driverMeta.primary.driverName}
              className="h-8 w-8 rounded-full border border-border object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-text-secondary"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              {primaryDriver?.slice(0, 2) ?? '--'}
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">Driver Summary</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[14px] font-semibold text-text-primary" style={{ fontFamily: 'var(--font-display)' }}>
                {primaryDriver}
              </span>
              {driverMeta.primary?.driverName && (
                <span className="text-[11px] text-text-muted">{driverMeta.primary.driverName}</span>
              )}
            </div>
          </div>
        </div>
        {compareDriver && (
          <div
            className="rounded-full border-2 border-dashed px-2.5 py-1 text-[11px] font-semibold"
            style={{
              borderColor: driverMeta.compare?.teamColor || '#888',
              color: driverMeta.compare?.teamColor || '#bbb'
            }}
          >
            vs {compareDriver}
          </div>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto p-3 text-xs md:grid-cols-2">
        <div className="feature-card rounded border border-border bg-bg-secondary p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Lap</div>
          <MetricRow label="Current lap" value={fmtNumber(summary.lap_analysis.lap_number, 0)} />
          <MetricRow label="Position" value={fmtPosition(summary.lap_analysis.position)} />
          <MetricRow label="Last lap" value={summary.lap_analysis.last_lap_time || '-'} />
          <MetricRow label="Personal best" value={`${fmtNumber(summary.lap_analysis.personal_best, 3)}s`} />
          <MetricRow label="Delta to leader" value={`${fmtSigned(summary.lap_analysis.lap_delta_to_leader, 3)}s`} />
        </div>

        <div className="feature-card rounded border border-border bg-bg-secondary p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Performance</div>
          <MetricRow label="Position delta" value={fmtSigned(summary.driver_performance.position_change, 0)} />
          <MetricRow label="Points" value={fmtNumber(summary.driver_performance.points, 1)} />
          <MetricRow label="Overtakes made" value={fmtNumber(summary.driver_performance.overtakes_made, 0)} />
          <MetricRow label="Defensive losses" value={fmtNumber(summary.driver_performance.positions_lost_defensive, 0)} />
        </div>

        <div className="feature-card rounded border border-border bg-bg-secondary p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Tyres</div>
          <MetricRow label="Current compound" value={summary.tyre_analysis.current_compound || '-'} />
          <MetricRow label="Stint number" value={fmtNumber(summary.tyre_analysis.stint_number, 0)} />
          <MetricRow label="Stint length" value={`${fmtNumber(summary.tyre_analysis.stint_length, 0)} laps`} />
          <MetricRow label="Tyre age" value={`${fmtNumber(summary.tyre_analysis.tyre_age, 0)} laps`} />
          <MetricRow label="Life left" value={fmtNumber(summary.tyre_analysis.tyre_life_remaining, 1)} />
        </div>

        <div className="feature-card rounded border border-border bg-bg-secondary p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Telemetry</div>
          <MetricRow label="Vmax" value={`${fmtNumber(summary.telemetry_analysis.speed_max, 0)} km/h`} />
          <MetricRow label="Vavg" value={`${fmtNumber(summary.telemetry_analysis.speed_avg, 1)} km/h`} />
          <MetricRow label="Throttle avg" value={`${fmtNumber(summary.telemetry_analysis.throttle_avg, 1)}%`} />
          <MetricRow label="DRS usage" value={fmtPct(summary.telemetry_analysis.drs_usage_pct)} />
        </div>

        <div className="feature-card rounded border border-border bg-bg-secondary p-2 md:col-span-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Race Context</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] lg:grid-cols-4">
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Track <span className="font-mono text-text-primary">{summary.race_context.track_status || '-'}</span></div>
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Air <span className="font-mono text-text-primary">{fmtNumber(summary.race_context.air_temp, 1)}C</span></div>
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Track temp <span className="font-mono text-text-primary">{fmtNumber(summary.race_context.track_temp, 1)}C</span></div>
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Humidity <span className="font-mono text-text-primary">{fmtNumber(summary.race_context.humidity, 0)}%</span></div>
          </div>
        </div>

        <div className="rounded border border-border bg-bg-secondary p-2 md:col-span-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Strategy Signals</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] lg:grid-cols-4">
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Current lap <span className="font-mono text-text-primary">{fmtNumber(summary.strategic_analysis.current_lap, 0)}</span></div>
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Current pos <span className="font-mono text-text-primary">{fmtPosition(summary.strategic_analysis.current_position)}</span></div>
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Stint length <span className="font-mono text-text-primary">{fmtNumber(summary.strategic_analysis.stint_length, 0)}</span></div>
            <div className="rounded border border-border/60 bg-bg-card/70 px-2 py-1 text-text-muted">Pit window <span className="font-mono text-text-primary">{fmtNumber(summary.strategic_analysis.optimal_pit_window, 0)}</span></div>
          </div>
        </div>

        {summary.comparison && (
          <div className="rounded border border-accent-blue/60 bg-bg-secondary p-2 md:col-span-2">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary">Head-to-Head</div>
            <MetricRow label="Pace delta" value={`${fmtSigned(summary.comparison.pace_delta_seconds, 3)}s`} />
            <MetricRow label="Winner" value={summary.comparison.head_to_head_winner || '-'} />
          </div>
        )}
      </div>
    </div>
  )
})
