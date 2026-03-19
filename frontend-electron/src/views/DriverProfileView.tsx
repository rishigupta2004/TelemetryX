import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useProfileStore } from '../stores/profileStore'
import { useSessionStore } from '../stores/sessionStore'
import type { DriverCareerProfile, ProfilesResponse } from '../types'

type SelectedDriver = DriverCareerProfile & { teamColor?: string }

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

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--.---'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border-hard bg-white/5 p-2 text-center">
      <div className="font-mono text-sm text-fg-primary">{value ?? '-'}</div>
      <div className="text-[10px] text-fg-muted">{label}</div>
    </div>
  )
}

export const DriverProfileView = React.memo(function DriverProfileView() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const lapsStore = useSessionStore((s) => s.laps)
  const intentDriverName = useProfileStore((s) => s.driverName)
  const clearIntent = useProfileStore((s) => s.clearIntent)

  const [payload, setPayload] = useState<ProfilesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedDriverName, setSelectedDriverName] = useState<string>('')

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

  const teamColorByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const driver of sessionData?.drivers ?? []) {
      if (driver.teamName && driver.teamColor) map.set(driver.teamName, driver.teamColor)
    }
    return map
  }, [sessionData?.drivers])

  const allLaps = lapsStore.length ? lapsStore : sessionData?.laps ?? []
  const allDrivers = payload?.drivers ?? []

  useEffect(() => {
    if (!allDrivers.length) return
    if (intentDriverName && allDrivers.some((driver) => driver.driverName === intentDriverName)) {
      setSelectedDriverName(intentDriverName)
      clearIntent()
      return
    }
    if (!selectedDriverName || !allDrivers.some((driver) => driver.driverName === selectedDriverName)) {
      setSelectedDriverName(allDrivers[0].driverName)
    }
  }, [allDrivers, selectedDriverName, intentDriverName, clearIntent])

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allDrivers
    return allDrivers.filter((d) =>
      `${d.driverName} ${d.fullName || ''} ${d.teamName} ${d.nationality || ''}`.toLowerCase().includes(q)
    )
  }, [allDrivers, query])

  const selectedDriver = useMemo<SelectedDriver | null>(() => {
    const primary = allDrivers.find((driver) => driver.driverName === selectedDriverName) ?? null
    if (!primary) return null
    const sessionMatch = sessionData?.drivers?.find(
      (driver) => driver.code === primary.driverName || driver.driverName === primary.fullName
    )
    return {
      ...primary,
      driverNumber: primary.driverNumber ?? sessionMatch?.driverNumber ?? null,
      teamName: primary.teamName || sessionMatch?.teamName || '',
      driverImage:
        primary.driverImage ??
        sessionMatch?.driverImage ??
        sessionImages.byDriver.get(primary.driverName) ??
        null,
      fullName: primary.fullName || sessionMatch?.driverName || primary.driverName,
      teamColor: sessionMatch?.teamColor || teamColorByName.get(primary.teamName) || '#2a3340'
    }
  }, [allDrivers, selectedDriverName, sessionData?.drivers, sessionImages.byDriver, teamColorByName])

  const sessionSnapshot = useMemo(() => {
    if (!selectedDriver || !sessionData) return null
    const driverMatch = sessionData.drivers.find(
      (driver) =>
        driver.code === selectedDriver.driverName ||
        driver.driverName === selectedDriver.fullName ||
        driver.driverName === selectedDriver.driverName
    )
    if (!driverMatch) return null
    const dLaps = allLaps
      .filter((lap) => lap.driverNumber === driverMatch.driverNumber || lap.driverName === driverMatch.code)
      .sort((a, b) => a.lapNumber - b.lapNumber)
    if (!dLaps.length) return null
    const bestLap = dLaps
      .filter((lap) => (lap.lapTime || 0) > 0 && lap.isDeleted !== true)
      .sort((a, b) => Number(a.lapTime || 1e9) - Number(b.lapTime || 1e9))[0]
    const lastLap = dLaps[dLaps.length - 1]
    const pitStops = dLaps.reduce((acc, lap) => acc + (lap.pitInSeconds != null ? 1 : 0), 0)
    const validLaps = dLaps.filter((lap) => (lap.lapTime || 0) > 0 && lap.isDeleted !== true).length
    return {
      position: lastLap?.position ?? null,
      lapsCompleted: validLaps,
      bestLapTime: bestLap?.lapTime ?? null,
      lastLapTime: lastLap?.lapTime ?? null,
      tyreCompound: lastLap?.tyreCompound ?? null,
      pitStops
    }
  }, [selectedDriver, sessionData, allLaps])

  if (loading && allDrivers.length === 0) return <div className="flex h-full items-center justify-center text-fg-muted">Loading driver profiles...</div>
  if (error && allDrivers.length === 0) return <div className="flex h-full items-center justify-center text-red-300">{error}</div>
  if (allDrivers.length === 0) return <div className="flex h-full items-center justify-center text-fg-muted">No profile data available</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-5 xl:p-6">
      <div className="bg-bg-surface border border-border-hard px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Driver Profiles</div>
        <div className="mt-1 text-xl font-semibold text-fg-primary">Career + Current Data</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <aside className="bg-bg-surface border border-border-hard min-h-0 overflow-hidden p-2.5">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">Drivers ({filteredDrivers.length})</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search driver/team/nationality..."
            className="mb-2 w-full rounded-lg border border-white/12 bg-black/20 px-3 py-1.5 text-sm text-fg-primary outline-none"
          />
          <div className="max-h-[calc(100%-3.8rem)] space-y-1 overflow-auto pr-1">
            {filteredDrivers.map((driver) => {
              const selected = selectedDriver?.driverName === driver.driverName
              const img = driver.driverImage || sessionImages.byDriver.get(driver.driverName)
              const teamColor = teamColorByName.get(driver.teamName) || '#2a3340'
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
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-black/40 text-[10px] font-semibold text-white" style={{ border: `1px solid ${teamColor}` }}>
                      {initials(driver.driverName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-fg-primary">{driver.driverName}</div>
                    <div className="truncate text-[10px] text-fg-muted">{driver.teamName}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="bg-bg-surface border border-border-hard min-h-0 overflow-auto  p-3.5">
          {!selectedDriver ? (
            <div className="flex h-full items-center justify-center text-fg-muted">No driver selected</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border-hard bg-black/20 p-3">
                {selectedDriver.driverImage || sessionImages.byDriver.get(selectedDriver.driverName) ? (
                  <img
                    src={selectedDriver.driverImage || sessionImages.byDriver.get(selectedDriver.driverName) || ''}
                    alt={selectedDriver.driverName}
                    className="h-28 w-28 rounded-lg border border-border-hard object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-border-hard bg-black/40 text-2xl font-semibold text-white" style={{ borderColor: selectedDriver.teamColor || '#2a3340' }}>
                    {initials(selectedDriver.driverName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-fg-primary">{selectedDriver.driverName}</div>
                    {sessionImages.byTeam.get(selectedDriver.teamName) && (
                      <img
                        src={sessionImages.byTeam.get(selectedDriver.teamName)}
                        alt={selectedDriver.teamName}
                        className="h-5 w-5 rounded object-contain"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="text-sm text-fg-secondary">{selectedDriver.fullName || selectedDriver.teamName}</div>
                  <div className="mt-1 text-xs text-fg-muted">#{selectedDriver.driverNumber ?? '-'} · {selectedDriver.nationality || 'Nationality n/a'} · Age {selectedDriver.age ?? '-'}</div>
                  <div className="mt-1 text-xs text-fg-muted">Career span: {fmtYears(selectedDriver.seasonYears)} · Seasons: {selectedDriver.seasons}</div>
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

              {sessionSnapshot && (
                <div className="rounded-xl border border-border-hard bg-black/15 p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Session Snapshot</div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    <Stat label="Position" value={sessionSnapshot.position != null ? `P${sessionSnapshot.position}` : '-'} />
                    <Stat label="Laps" value={sessionSnapshot.lapsCompleted} />
                    <Stat label="Best Lap" value={formatTime(sessionSnapshot.bestLapTime)} />
                    <Stat label="Last Lap" value={formatTime(sessionSnapshot.lastLapTime)} />
                    <Stat label="Tyre" value={sessionSnapshot.tyreCompound || '-'} />
                    <Stat label="Pit Stops" value={sessionSnapshot.pitStops} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <div className="rounded-xl border border-border-hard bg-black/15 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Achievements</div>
                  <div className="mt-2 space-y-1 text-xs text-fg-primary">{(selectedDriver.achievements || []).map((item) => <div key={`a-${item}`} className="rounded border border-border-hard bg-white/5 px-2 py-1">{item}</div>)}</div>
                </div>
                <div className="rounded-xl border border-border-hard bg-black/15 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Records</div>
                  <div className="mt-2 space-y-1 text-xs text-fg-primary">{(selectedDriver.records || []).map((item) => <div key={`r-${item}`} className="rounded border border-border-hard bg-white/5 px-2 py-1">{item}</div>)}</div>
                </div>
                <div className="rounded-xl border border-border-hard bg-black/15 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Best Moments</div>
                  <div className="mt-2 space-y-1 text-xs text-fg-primary">{(selectedDriver.bestMoments || []).map((item) => <div key={`m-${item}`} className="rounded border border-border-hard bg-white/5 px-2 py-1">{item}</div>)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border-hard bg-black/15 p-3 text-sm text-fg-primary">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Best Driven Race</div>
                {selectedDriver.bestRace
                  ? `${selectedDriver.bestRace.raceName} ${selectedDriver.bestRace.year} · P${selectedDriver.bestRace.finish} · ${selectedDriver.bestRace.points} points`
                  : 'No best race data available'}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
})
