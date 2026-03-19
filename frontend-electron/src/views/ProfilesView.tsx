import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useProfileStore } from '../stores/profileStore'
import { useSessionStore } from '../stores/sessionStore'
import type { DriverCareerProfile, ProfilesResponse, TeamCareerProfile } from '../types'

type Mode = 'drivers' | 'teams'

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
    <div className="rounded-md border border-border bg-white/5 p-2 text-center">
      <div className="font-mono text-sm text-fg-primary">{value ?? '-'}</div>
      <div className="text-[10px] text-fg-muted">{label}</div>
    </div>
  )
}

export const ProfilesView = React.memo(function ProfilesView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const intentMode = useProfileStore((s) => s.mode)
  const intentDriverName = useProfileStore((s) => s.driverName)
  const intentTeamName = useProfileStore((s) => s.teamName)
  const clearIntent = useProfileStore((s) => s.clearIntent)
  const [payload, setPayload] = useState<ProfilesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('drivers')
  const [query, setQuery] = useState('')
  const [selectedDriverName, setSelectedDriverName] = useState<string>('')
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
    const byDriver = new Map<string, string>()
    const byTeam = new Map<string, string>()
    for (const driver of sessionData?.drivers ?? []) {
      if (driver.driverImage) byDriver.set(driver.driverName, driver.driverImage)
      if (driver.teamImage) byTeam.set(driver.teamName, driver.teamImage)
    }
    return { byDriver, byTeam }
  }, [sessionData?.drivers])

  const allDrivers = payload?.drivers ?? []
  const allTeams = payload?.teams ?? []

  useEffect(() => {
    if (!allDrivers.length) return
    if (!selectedDriverName || !allDrivers.some((d) => d.driverName === selectedDriverName)) {
      setSelectedDriverName(allDrivers[0].driverName)
    }
  }, [allDrivers, selectedDriverName])

  useEffect(() => {
    if (!allTeams.length) return
    if (!selectedTeamName || !allTeams.some((t) => t.teamName === selectedTeamName)) {
      setSelectedTeamName(allTeams[0].teamName)
    }
  }, [allTeams, selectedTeamName])

  useEffect(() => {
    if (!payload) return
    if (intentMode === 'drivers' && intentDriverName) {
      const exists = allDrivers.some((driver) => driver.driverName === intentDriverName)
      if (exists) {
        setMode('drivers')
        setSelectedDriverName(intentDriverName)
        clearIntent()
      }
    }
    if (intentMode === 'teams' && intentTeamName) {
      const exists = allTeams.some((team) => team.teamName === intentTeamName)
      if (exists) {
        setMode('teams')
        setSelectedTeamName(intentTeamName)
        clearIntent()
      }
    }
  }, [payload, intentMode, intentDriverName, intentTeamName, allDrivers, allTeams, clearIntent])

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allDrivers
    return allDrivers.filter((d) =>
      `${d.driverName} ${d.fullName || ''} ${d.teamName} ${d.nationality || ''}`.toLowerCase().includes(q)
    )
  }, [allDrivers, query])

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTeams
    return allTeams.filter((t) => `${t.teamName}`.toLowerCase().includes(q))
  }, [allTeams, query])

  const selectedDriver = useMemo(
    () => allDrivers.find((driver) => driver.driverName === selectedDriverName) ?? null,
    [allDrivers, selectedDriverName]
  )
  const selectedTeam = useMemo(
    () => allTeams.find((team) => team.teamName === selectedTeamName) ?? null,
    [allTeams, selectedTeamName]
  )

  if (loading) {
    return <div className="flex h-full items-center justify-center text-fg-muted">Loading full career profiles...</div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-red-300">{error}</div>
  }

  if (!payload) {
    return <div className="flex h-full items-center justify-center text-fg-muted">No profile data available</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-5 xl:p-6">
      <div className="bg-bg-surface border border-border rounded-md px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Profiles</div>
        <div className="mt-1 text-xl font-semibold text-fg-primary">Driver + Team Dossiers</div>
        <div className="mt-1 text-xs text-fg-muted">
          Unified F1 career sheets (available TelemetryX seasons + external profile enrichment) with stats, records, achievements, and moments.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('drivers')}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${mode === 'drivers' ? 'border-accent bg-accent/20 text-fg-primary' : 'border-border bg-black/15 text-fg-secondary'}`}
        >
          Drivers
        </button>
        <button
          type="button"
          onClick={() => setMode('teams')}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${mode === 'teams' ? 'border-accent bg-accent/20 text-fg-primary' : 'border-border bg-black/15 text-fg-secondary'}`}
        >
          Teams
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'drivers' ? 'Search driver/team/nationality...' : 'Search team...'}
          className="ml-auto w-[320px] max-w-full rounded-md border border-border bg-bg-inset px-3 py-1.5 text-sm text-fg-primary outline-none focus:border-accent focus:shadow-[0_0_0_1px_rgba(225,6,0,0.2)]"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <aside className="bg-bg-surface border border-border rounded-md min-h-0 overflow-hidden p-2.5">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">
            {mode === 'drivers' ? `Drivers (${filteredDrivers.length})` : `Teams (${filteredTeams.length})`}
          </div>
          <div className="max-h-full space-y-1 overflow-auto pr-1">
            {mode === 'drivers'
              ? filteredDrivers.map((driver) => {
                  const selected = selectedDriver?.driverName === driver.driverName
                  const img = driver.driverImage || sessionImages.byDriver.get(driver.driverName)
                  return (
                    <button
                      key={`driver-${driver.driverName}-${driver.driverNumber ?? 'x'}`}
                      type="button"
                      onClick={() => setSelectedDriverName(driver.driverName)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${selected ? 'border-accent bg-accent/20' : 'border-border-hard bg-black/15 hover:bg-black/30'}`}
                    >
                      {img ? (
                        <img src={img} alt={driver.driverName} className="h-8 w-8 rounded object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-black/40 text-[10px] font-semibold text-white">
                          {initials(driver.driverName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-fg-primary">{driver.driverName}</div>
                        <div className="truncate text-[10px] text-fg-muted">{driver.teamName}</div>
                      </div>
                    </button>
                  )
                })
              : filteredTeams.map((team) => {
                  const selected = selectedTeam?.teamName === team.teamName
                  const img = team.teamImage || sessionImages.byTeam.get(team.teamName)
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
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-black/40 text-[10px] font-semibold text-white">
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

        <section className="bg-bg-surface border border-border rounded-md min-h-0 overflow-auto p-3.5">
          {mode === 'drivers' ? (
            selectedDriver ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-bg-panel p-3">
                  {selectedDriver.driverImage || sessionImages.byDriver.get(selectedDriver.driverName) ? (
                    <img
                      src={selectedDriver.driverImage || sessionImages.byDriver.get(selectedDriver.driverName) || ''}
                      alt={selectedDriver.driverName}
                      className="h-28 w-28 rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-md border border-border bg-black/40 text-base font-semibold text-white">
                      {initials(selectedDriver.driverName)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-fg-primary">{selectedDriver.driverName}</div>
                    <div className="text-sm text-fg-secondary">{selectedDriver.fullName || selectedDriver.teamName}</div>
                    <div className="mt-1 text-xs text-fg-muted">
                      #{selectedDriver.driverNumber ?? '-'} · {selectedDriver.nationality || 'Nationality n/a'} · Age {selectedDriver.age ?? '-'}
                    </div>
                    <div className="mt-1 text-xs text-fg-muted">
                      Career span: {fmtYears(selectedDriver.seasonYears)} · Seasons: {selectedDriver.seasons}
                    </div>
                    {selectedDriver.wikipediaUrl && (
                      <a href={selectedDriver.wikipediaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-accent-blue hover:underline">
                        Source profile
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <Stat label="Starts" value={selectedDriver.starts} />
                  <Stat label="Wins" value={selectedDriver.wins} />
                  <Stat label="Podiums" value={selectedDriver.podiums} />
                  <Stat label="Poles" value={selectedDriver.poles ?? '-'} />
                  <Stat label="Championships" value={selectedDriver.championships} />
                  <Stat label="Points" value={selectedDriver.points} />
                  <Stat label="Best Finish" value={selectedDriver.bestFinish != null ? `P${selectedDriver.bestFinish}` : '-'} />
                  <Stat label="Best Quali" value={selectedDriver.bestQuali != null ? `P${selectedDriver.bestQuali}` : '-'} />
                  <Stat label="Team" value={selectedDriver.teamName} />
                  <Stat label="DOB" value={selectedDriver.dateOfBirth || '-'} />
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <div className="rounded-md border border-border bg-bg-panel p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Achievements</div>
                    <div className="mt-2 space-y-1 text-xs text-fg-primary">
                      {(selectedDriver.achievements || []).map((item) => (
                        <div key={`a-${item}`} className="rounded border border-border bg-white/5 px-2 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-bg-panel p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Records</div>
                    <div className="mt-2 space-y-1 text-xs text-fg-primary">
                      {(selectedDriver.records || []).map((item) => (
                        <div key={`r-${item}`} className="rounded border border-border bg-white/5 px-2 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-bg-panel p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Best Moments</div>
                    <div className="mt-2 space-y-1 text-xs text-fg-primary">
                      {(selectedDriver.bestMoments || []).map((item) => (
                        <div key={`m-${item}`} className="rounded border border-border bg-white/5 px-2 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-bg-panel p-3 text-sm text-fg-primary">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Best Driven Race</div>
                  {selectedDriver.bestRace
                    ? `${selectedDriver.bestRace.raceName} ${selectedDriver.bestRace.year} · P${selectedDriver.bestRace.finish} · ${selectedDriver.bestRace.points} points`
                    : 'No best race data available'}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-fg-muted">No driver selected</div>
            )
          ) : selectedTeam ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-bg-panel p-3">
                {selectedTeam.teamImage || sessionImages.byTeam.get(selectedTeam.teamName) ? (
                  <img
                    src={selectedTeam.teamImage || sessionImages.byTeam.get(selectedTeam.teamName) || ''}
                    alt={selectedTeam.teamName}
                    className="h-24 w-24 rounded-md border border-border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-md border border-border bg-black/40 text-base font-semibold text-white">
                    {initials(selectedTeam.teamName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-fg-primary">{selectedTeam.teamName}</div>
                  <div className="mt-1 text-xs text-fg-muted">
                    Career span: {fmtYears(selectedTeam.seasonYears)} · Seasons: {selectedTeam.seasons}
                  </div>
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
              </div>

              <div className="rounded-md border border-border bg-bg-panel p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Team Records + Achievements</div>
                <div className="mt-2 space-y-1 text-xs text-fg-primary">
                  {(selectedTeam.records || []).map((item) => (
                    <div key={`tr-${item}`} className="rounded border border-border bg-white/5 px-2 py-1">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-fg-muted">No team selected</div>
          )}
        </section>
      </div>
    </div>
  )
})
