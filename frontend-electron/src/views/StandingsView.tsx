import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { EmptyState } from '../components/EmptyState'
import { useProfileStore } from '../stores/profileStore'
import { useSessionStore } from '../stores/sessionStore'
import type { SeasonStandingsResponse } from '../types'

function asRaceLabel(name: string): string {
  return name.replace(/ Grand Prix$/i, '')
}

export const StandingsView = React.memo(function StandingsView() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const year = selectedYear ?? new Date().getFullYear()

  const [payload, setPayload] = useState<SeasonStandingsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movedDriverRows, setMovedDriverRows] = useState<Set<string>>(new Set())
  const [movedTeamRows, setMovedTeamRows] = useState<Set<string>>(new Set())
  const prevDriverPosRef = useRef<Map<string, number>>(new Map())
  const prevTeamPosRef = useRef<Map<string, number>>(new Map())
  const openDriver = useProfileStore((s) => s.openDriver)
  const openTeam = useProfileStore((s) => s.openTeam)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .getSeasonStandings(year)
      .then((res) => {
        if (!active) return
        setPayload(res)
      })
      .catch((err) => {
        if (!active) return
        setError(String(err))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [year])

  const topProgress = useMemo(() => {
    if (!payload?.drivers?.length) return []
    return payload.drivers.slice(0, 8)
  }, [payload?.drivers])

  useEffect(() => {
    if (!payload?.drivers?.length) return
    const moved = new Set<string>()
    const next = new Map<string, number>()
    for (const driver of payload.drivers) {
      const key = `${driver.driverName}-${driver.driverNumber ?? 'x'}`
      const prev = prevDriverPosRef.current.get(key)
      if (prev != null && prev !== driver.position) moved.add(key)
      next.set(key, driver.position)
    }
    prevDriverPosRef.current = next
    setMovedDriverRows(moved)
    if (moved.size > 0) {
      const t = window.setTimeout(() => setMovedDriverRows(new Set()), 700)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [payload?.drivers])

  useEffect(() => {
    if (!payload?.constructors?.length) return
    const moved = new Set<string>()
    const next = new Map<string, number>()
    for (const team of payload.constructors) {
      const key = team.teamName
      const prev = prevTeamPosRef.current.get(key)
      if (prev != null && prev !== team.position) moved.add(key)
      next.set(key, team.position)
    }
    prevTeamPosRef.current = next
    setMovedTeamRows(moved)
    if (moved.size > 0) {
      const t = window.setTimeout(() => setMovedTeamRows(new Set()), 700)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [payload?.constructors])

  const openDriverProfile = (driverName: string) => {
    openDriver(driverName)
    window.dispatchEvent(new CustomEvent('telemetryx:navigate', { detail: { view: 'driverProfile' } }))
  }

  const openTeamProfile = (teamName: string) => {
    openTeam(teamName)
    window.dispatchEvent(new CustomEvent('telemetryx:navigate', { detail: { view: 'teamProfile' } }))
  }

  if (loading) {
    return <EmptyState title="Loading standings..." variant="loading" />
  }

  if (error) {
    return <EmptyState title="Failed to load standings" detail={error} variant="error" />
  }

  if (!payload) {
    return <EmptyState title="No standings data available" detail="Standings data may not be available for the selected season" />
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="bg-bg-surface border border-border-hard px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Standings</div>
        <div className="mt-1 text-xl font-semibold text-fg-primary">{payload.year} Championship</div>
        <div className="mt-1 text-xs text-fg-muted">{payload.roundsCount} races · latest: {payload.lastRace}</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-bg-surface border border-border-hard min-h-0 overflow-hidden">
          <div className="border-b border-border-hard px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Driver Standings</div>
          <div className="max-h-full overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-bg-surface text-[11px] uppercase tracking-[0.12em] text-fg-muted">
                <tr>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Pts</th>
                  <th className="px-3 py-2">W</th>
                  <th className="px-3 py-2">Pod</th>
                  <th className="px-3 py-2">Best</th>
                </tr>
              </thead>
              <tbody>
                {payload.drivers.map((driver) => {
                  const rowKey = `${driver.driverName}-${driver.driverNumber ?? 'x'}`
                  return (
                    <tr
                      key={rowKey}
                      className={`border-b border-border-micro text-fg-primary transition-colors hover:bg-white/5 ${movedDriverRows.has(rowKey) ? 'tx-standings-row-move' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-fg-secondary">{driver.position}</td>
                      <td className="px-3 py-2 font-semibold">
                        <button type="button" className="text-left hover:text-accent-blue" onClick={() => openDriverProfile(driver.driverName)}>
                          {driver.driverName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-fg-secondary">{driver.teamName}</td>
                      <td className="px-3 py-2 font-mono">{driver.points}</td>
                      <td className="px-3 py-2 font-mono">{driver.wins}</td>
                      <td className="px-3 py-2 font-mono">{driver.podiums}</td>
                      <td className="px-3 py-2 font-mono">{driver.bestFinish ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[0.95fr_1.05fr] gap-3">
          <div className="bg-bg-surface border border-border-hard min-h-0 overflow-hidden">
            <div className="border-b border-border-hard px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Constructor Standings</div>
            <div className="max-h-full overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-bg-surface text-[11px] uppercase tracking-[0.12em] text-fg-muted">
                  <tr>
                    <th className="px-3 py-2">Pos</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">Pts</th>
                    <th className="px-3 py-2">W</th>
                    <th className="px-3 py-2">Pod</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.constructors.map((team) => (
                    <tr
                      key={team.teamName}
                      className={`border-b border-border-micro text-fg-primary transition-colors hover:bg-white/5 ${movedTeamRows.has(team.teamName) ? 'tx-standings-row-move' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-fg-secondary">{team.position}</td>
                      <td className="px-3 py-2 font-semibold">
                        <button type="button" className="text-left hover:text-accent-blue" onClick={() => openTeamProfile(team.teamName)}>
                          {team.teamName}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono">{team.points}</td>
                      <td className="px-3 py-2 font-mono">{team.wins}</td>
                      <td className="px-3 py-2 font-mono">{team.podiums}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-bg-surface border border-border-hard min-h-0 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Top Driver Progression</div>
            <div className="mt-2 space-y-2 overflow-auto pr-1 text-xs">
              {topProgress.map((driver) => (
                <div key={`${driver.driverName}-${driver.driverNumber ?? 'x'}-progress`} className="rounded-lg border border-border-hard bg-black/20 px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-fg-primary">{driver.driverName}</span>
                    <span className="font-mono text-fg-secondary">{driver.points} pts</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {driver.seasonPointsProgression.slice(-6).map((race) => (
                      <div key={`${driver.driverName}-${race.raceName}`} className="rounded border border-border-hard bg-white/5 px-1 py-1 text-center">
                        <div className="text-[9px] text-fg-muted">{asRaceLabel(race.raceName).slice(0, 4)}</div>
                        <div className="font-mono text-[10px] text-fg-primary">+{race.points}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
