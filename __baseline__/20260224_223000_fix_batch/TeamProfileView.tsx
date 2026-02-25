import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useProfileStore } from '../stores/profileStore'
import { useSessionStore } from '../stores/sessionStore'
import type { ProfilesResponse, TeamCareerProfile } from '../types'

function imageOrFallback(value: string | null | undefined, label: string): string {
  if (value && value.trim()) return value
  return `https://placehold.co/640x640/0b1428/c8dcff?text=${encodeURIComponent(label || 'Team')}`
}

function fmtYears(years: number[]): string {
  if (!years.length) return '-'
  if (years.length === 1) return String(years[0])
  return `${years[0]}-${years[years.length - 1]}`
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
      <div className="font-mono text-sm text-text-primary">{value ?? '-'}</div>
      <div className="text-[10px] text-text-muted">{label}</div>
    </div>
  )
}

export const TeamProfileView = React.memo(function TeamProfileView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const lapsStore = useSessionStore((s) => s.laps)
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
      .getProfiles(true)
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

  const allLaps = lapsStore.length ? lapsStore : sessionData?.laps ?? []

  const fallbackTeams = useMemo<TeamCareerProfile[]>(() => {
    if (!sessionData?.drivers?.length) return []
    const byTeam = new Map<string, { drivers: typeof sessionData.drivers; image: string | null; finalPos: number | null }>()
    for (const driver of sessionData.drivers) {
      const dLaps = allLaps
        .filter((lap) => lap.driverNumber === driver.driverNumber || lap.driverName === driver.code)
        .sort((a, b) => a.lapNumber - b.lapNumber)
      const finalPos = dLaps[dLaps.length - 1]?.position ?? null
      const existing = byTeam.get(driver.teamName)
      if (!existing) {
        byTeam.set(driver.teamName, { drivers: [driver], image: driver.teamImage ?? null, finalPos })
      } else {
        existing.drivers.push(driver)
        if (existing.image == null && driver.teamImage) existing.image = driver.teamImage
        if (finalPos != null && (existing.finalPos == null || finalPos < existing.finalPos)) existing.finalPos = finalPos
      }
    }
    return Array.from(byTeam.entries()).map(([teamName, row]) => ({
      teamName,
      teamImage: row.image,
      seasons: 1,
      seasonYears: [sessionData.metadata.year],
      starts: row.drivers.length > 0 ? 1 : 0,
      wins: row.finalPos === 1 ? 1 : 0,
      podiums: row.finalPos != null && row.finalPos <= 3 ? 1 : 0,
      points: 0,
      championships: 0,
      bestFinish: row.finalPos,
      records: row.finalPos === 1 ? [`Won ${sessionData.metadata.raceName}`] : []
    }))
  }, [sessionData, allLaps])

  const allTeams = payload?.teams?.length ? payload.teams : fallbackTeams

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

  if (loading && allTeams.length === 0) return <div className="flex h-full items-center justify-center text-text-muted">Loading team profiles...</div>
  if (error && allTeams.length === 0) return <div className="flex h-full items-center justify-center text-red-300">{error}</div>
  if (allTeams.length === 0) return <div className="flex h-full items-center justify-center text-text-muted">No profile data available</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-5 xl:p-6">
      <div className="glass-panel rounded-2xl px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Team Profiles</div>
        <div className="mt-1 text-xl font-semibold text-text-primary">Constructor + Technical Snapshot</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <aside className="glass-panel min-h-0 overflow-hidden rounded-2xl p-2.5">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Teams ({filteredTeams.length})</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team..."
            className="mb-2 w-full rounded-lg border border-white/12 bg-black/20 px-3 py-1.5 text-sm text-text-primary outline-none"
          />
          <div className="max-h-[calc(100%-3.8rem)] space-y-1 overflow-auto pr-1">
            {filteredTeams.map((team) => {
              const selected = selectedTeam?.teamName === team.teamName
              const img = team.teamImage || sessionImages.byTeam.get(team.teamName)
              return (
                <button
                  key={`team-${team.teamName}`}
                  type="button"
                  onClick={() => setSelectedTeamName(team.teamName)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${selected ? 'border-accent bg-accent/20' : 'border-white/10 bg-black/15 hover:bg-black/30'}`}
                >
                  <img src={imageOrFallback(img, team.teamName)} alt={team.teamName} className="h-8 w-8 rounded object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-text-primary">{team.teamName}</div>
                    <div className="truncate text-[10px] text-text-muted">{team.seasons} seasons</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="glass-panel min-h-0 overflow-auto rounded-2xl p-3.5">
          {!selectedTeam ? (
            <div className="flex h-full items-center justify-center text-text-muted">No team selected</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <img
                  src={imageOrFallback(selectedTeam.teamImage || sessionImages.byTeam.get(selectedTeam.teamName), selectedTeam.teamName)}
                  alt={selectedTeam.teamName}
                  className="h-24 w-24 rounded-lg border border-white/10 object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-text-primary">{selectedTeam.teamName}</div>
                  <div className="mt-1 text-xs text-text-muted">Career span: {fmtYears(selectedTeam.seasonYears)} · Seasons: {selectedTeam.seasons}</div>
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

              <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Current Line-up</div>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {currentDrivers.length === 0 && <div className="text-xs text-text-muted">No current session line-up data</div>}
                  {currentDrivers.map((driver) => (
                    <div key={`${driver.code}-${driver.driverNumber}`} className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-text-primary">
                      <img src={imageOrFallback(driver.driverImage, driver.driverName)} alt={driver.driverName} className="h-7 w-7 rounded object-cover" loading="lazy" />
                      <span className="font-semibold">{driver.driverName}</span>
                      <span className="ml-auto font-mono text-text-muted">{driver.code}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Records + Achievements</div>
                <div className="mt-2 space-y-1 text-xs text-text-primary">
                  {(selectedTeam.records || []).map((item) => (
                    <div key={`tr-${item}`} className="rounded border border-white/10 bg-white/5 px-2 py-1">{item}</div>
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
