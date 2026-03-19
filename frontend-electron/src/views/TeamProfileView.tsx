import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useProfileStore } from '../stores/profileStore'
import { useSessionStore } from '../stores/sessionStore'
import type { ProfilesResponse } from '../types'

function initials(label: string): string {
  const parts = label.trim().split(/\s+/)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function fmtYears(years: number[]): string {
  if (!years.length) return '-'
  if (years.length === 1) return String(years[0])
  return `${years[0]}-${years[years.length - 1]}`
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border-hard bg-white/5 p-2 text-center">
      <div className="font-mono text-sm text-fg-primary">{value ?? '-'}</div>
      <div className="text-[10px] text-fg-muted">{label}</div>
    </div>
  )
}

export const TeamProfileView = React.memo(function TeamProfileView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const intentTeamName = useProfileStore((s) => s.teamName)
  const clearIntent = useProfileStore((s) => s.clearIntent)

  const [payload, setPayload] = useState<ProfilesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedTeamName, setSelectedTeamName] = useState<string>('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .getProfiles(false)
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
  }, [])

  const sessionImages = useMemo(() => {
    const byTeam = new Map<string, string>()
    for (const driver of sessionData?.drivers ?? []) {
      if (driver.teamImage) byTeam.set(driver.teamName, driver.teamImage)
    }
    return { byTeam }
  }, [sessionData?.drivers])

  const teamColorByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const driver of sessionData?.drivers ?? []) {
      if (driver.teamName && driver.teamColor) map.set(driver.teamName, driver.teamColor)
    }
    return map
  }, [sessionData?.drivers])

  const allTeams = payload?.teams ?? []

  useEffect(() => {
    if (!allTeams.length) return
    if (intentTeamName && allTeams.some((team) => team.teamName === intentTeamName)) {
      setSelectedTeamName(intentTeamName)
      clearIntent()
      return
    }
    if (!selectedTeamName || !allTeams.some((team) => team.teamName === selectedTeamName)) {
      setSelectedTeamName(allTeams[0].teamName)
    }
  }, [allTeams, selectedTeamName, intentTeamName, clearIntent])

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTeams
    return allTeams.filter((t) => `${t.teamName}`.toLowerCase().includes(q))
  }, [allTeams, query])

  const selectedTeam = useMemo(
    () => allTeams.find((team) => team.teamName === selectedTeamName) ?? null,
    [allTeams, selectedTeamName]
  )

  const currentDrivers = useMemo(() => {
    if (!selectedTeam) return []
    return (sessionData?.drivers ?? []).filter((driver) => driver.teamName === selectedTeam.teamName)
  }, [selectedTeam, sessionData?.drivers])

  if (loading && allTeams.length === 0) return <div className="flex h-full items-center justify-center text-fg-muted">Loading team profiles...</div>
  if (error && allTeams.length === 0) return <div className="flex h-full items-center justify-center text-red-300">{error}</div>
  if (allTeams.length === 0) return <div className="flex h-full items-center justify-center text-fg-muted">No profile data available</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-5 xl:p-6">
      <div className="bg-bg-surface border border-border-hard px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Team Profiles</div>
        <div className="mt-1 text-xl font-semibold text-fg-primary">Constructor + Technical Snapshot</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <aside className="bg-bg-surface border border-border-hard min-h-0 overflow-hidden p-2.5">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Teams ({filteredTeams.length})</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team..."
            className="mb-2 w-full rounded-lg border border-white/12 bg-black/20 px-3 py-1.5 text-sm text-fg-primary outline-none"
          />
          <div className="max-h-[calc(100%-3.8rem)] space-y-1 overflow-auto pr-1">
            {filteredTeams.map((team) => {
              const selected = selectedTeam?.teamName === team.teamName
              const img = team.teamImage || sessionImages.byTeam.get(team.teamName)
              const teamColor = teamColorByName.get(team.teamName) || '#2a3340'
              return (
                <button
                  key={`team-${team.teamName}`}
                  type="button"
                  onClick={() => setSelectedTeamName(team.teamName)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${selected ? 'border-accent bg-accent/20' : 'border-border-hard bg-black/15 hover:bg-black/30'}`}
                >
                  {img ? (
                    <img src={img} alt={team.teamName} className="h-8 w-8 rounded object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-black/40 text-[10px] font-semibold text-white" style={{ border: `1px solid ${teamColor}` }}>
                      {initials(team.teamName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-fg-primary">{team.teamName}</div>
                    <div className="truncate text-[10px] text-fg-muted">{team.seasons} seasons</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="bg-bg-surface border border-border-hard min-h-0 overflow-auto  p-3.5">
          {!selectedTeam ? (
            <div className="flex h-full items-center justify-center text-fg-muted">No team selected</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border-hard bg-black/20 p-3">
                {selectedTeam.teamImage || sessionImages.byTeam.get(selectedTeam.teamName) ? (
                  <img
                    src={selectedTeam.teamImage || sessionImages.byTeam.get(selectedTeam.teamName) || ''}
                    alt={selectedTeam.teamName}
                    className="h-24 w-24 rounded-lg border border-border-hard object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border-hard bg-black/40 text-xl font-semibold text-white" style={{ borderColor: teamColorByName.get(selectedTeam.teamName) || '#2a3340' }}>
                    {initials(selectedTeam.teamName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-fg-primary">{selectedTeam.teamName}</div>
                  <div className="mt-1 text-xs text-fg-muted">Career span: {fmtYears(selectedTeam.seasonYears)} · Seasons: {selectedTeam.seasons}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stat label="Starts" value={selectedTeam.starts} />
                <Stat label="Wins" value={selectedTeam.wins} />
                <Stat label="Podiums" value={selectedTeam.podiums} />
                <Stat label="Points" value={selectedTeam.points} />
                <Stat label="Titles" value={selectedTeam.championships} />
                <Stat label="Best Finish" value={selectedTeam.bestFinish != null ? `P${selectedTeam.bestFinish}` : '-'} />
                <Stat label="Seasons" value={selectedTeam.seasons} />
                <Stat label="Current Drivers" value={currentDrivers.length} />
              </div>

              <div className="rounded-xl border border-border-hard bg-black/15 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Current Line-up</div>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {currentDrivers.length === 0 && <div className="text-xs text-fg-muted">No current session line-up data</div>}
                  {currentDrivers.map((driver) => {
                    const teamColor = teamColorByName.get(driver.teamName) || '#2a3340'
                    return (
                      <div key={`${driver.code}-${driver.driverNumber}`} className="flex items-center gap-2 rounded border border-border-hard bg-white/5 px-2 py-1.5 text-xs text-fg-primary">
                        {driver.driverImage ? (
                          <img src={driver.driverImage} alt={driver.driverName} className="h-7 w-7 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded bg-black/40 text-[10px] font-semibold text-white" style={{ border: `1px solid ${teamColor}` }}>
                            {initials(driver.driverName)}
                          </div>
                        )}
                        <span className="font-semibold">{driver.driverName}</span>
                        <span className="ml-auto font-mono text-fg-muted">{driver.code}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border-hard bg-black/15 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Records + Achievements</div>
                <div className="mt-2 space-y-1 text-xs text-fg-primary">
                  {(selectedTeam.records || []).map((item) => (
                    <div key={`tr-${item}`} className="rounded border border-border-hard bg-white/5 px-2 py-1">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
})
