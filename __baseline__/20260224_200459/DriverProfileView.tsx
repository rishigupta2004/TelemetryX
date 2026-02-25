import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useProfileStore } from '../stores/profileStore'
import { useSessionStore } from '../stores/sessionStore'
import type { DriverCareerProfile, ProfilesResponse } from '../types'

function imageOrFallback(value: string | null | undefined, label: string): string {
  if (value && value.trim()) return value
  return `https://placehold.co/640x640/0b1428/c8dcff?text=${encodeURIComponent(label || 'Driver')}`
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
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
      <div className="font-mono text-sm text-text-primary">{value ?? '-'}</div>
      <div className="text-[10px] text-text-muted">{label}</div>
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
    const byDriver = new Map<string, string>()
    const byTeam = new Map<string, string>()
    for (const driver of sessionData?.drivers ?? []) {
      if (driver.driverImage) byDriver.set(driver.driverName, driver.driverImage)
      if (driver.teamImage) byTeam.set(driver.teamName, driver.teamImage)
    }
    return { byDriver, byTeam }
  }, [sessionData?.drivers])

  const allLaps = lapsStore.length ? lapsStore : sessionData?.laps ?? []

  const fallbackDrivers = useMemo<DriverCareerProfile[]>(() => {
    if (!sessionData?.drivers?.length) return []
    const year = sessionData.metadata.year
    return sessionData.drivers.map((driver) => {
      const dLaps = allLaps
        .filter((lap) => lap.driverNumber === driver.driverNumber || lap.driverName === driver.code)
        .sort((a, b) => a.lapNumber - b.lapNumber)
      const finalLap = dLaps[dLaps.length - 1]
      const finalPos = finalLap?.position ?? null
      const bestLap = dLaps
        .filter((lap) => (lap.lapTime || 0) > 0 && lap.isDeleted !== true)
        .sort((a, b) => Number(a.lapTime || 1e9) - Number(b.lapTime || 1e9))[0]
      return {
        driverNumber: driver.driverNumber,
        driverName: driver.code || driver.driverName,
        fullName: driver.driverName,
        teamName: driver.teamName,
        driverImage: driver.driverImage ?? null,
        age: null,
        nationality: null,
        dateOfBirth: null,
        wikipediaUrl: null,
        starts: dLaps.length > 0 ? 1 : 0,
        seasons: 1,
        seasonYears: [year],
        poles: null,
        wins: finalPos === 1 ? 1 : 0,
        podiums: finalPos != null && finalPos <= 3 ? 1 : 0,
        points: 0,
        championships: 0,
        bestFinish: finalPos,
        bestQuali: null,
        achievements: finalPos === 1 ? [`Won ${sessionData.metadata.raceName}`] : [],
        records: [],
        bestRace:
          finalPos != null
            ? {
                raceName: sessionData.metadata.raceName,
                year,
                finish: finalPos,
                points: 0
              }
            : null,
        bestMoments: bestLap ? [`Best lap: ${formatTime(bestLap.lapTime)}`] : []
      }
    })
  }, [sessionData, allLaps])

  const allDrivers = payload?.drivers?.length ? payload.drivers : fallbackDrivers

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

  const selectedDriver = useMemo(
    () => allDrivers.find((driver) => driver.driverName === selectedDriverName) ?? null,
    [allDrivers, selectedDriverName]
  )

  if (loading && allDrivers.length === 0) return <div className="flex h-full items-center justify-center text-text-muted">Loading driver profiles...</div>
  if (error && allDrivers.length === 0) return <div className="flex h-full items-center justify-center text-red-300">{error}</div>
  if (allDrivers.length === 0) return <div className="flex h-full items-center justify-center text-text-muted">No profile data available</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-5 xl:p-6">
      <div className="glass-panel rounded-2xl px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Driver Profiles</div>
        <div className="mt-1 text-xl font-semibold text-text-primary">Career + Current Data</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <aside className="glass-panel min-h-0 overflow-hidden rounded-2xl p-2.5">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Drivers ({filteredDrivers.length})</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search driver/team/nationality..."
            className="mb-2 w-full rounded-lg border border-white/12 bg-black/20 px-3 py-1.5 text-sm text-text-primary outline-none"
          />
          <div className="max-h-[calc(100%-3.8rem)] space-y-1 overflow-auto pr-1">
            {filteredDrivers.map((driver) => {
              const selected = selectedDriver?.driverName === driver.driverName
              const img = driver.driverImage || sessionImages.byDriver.get(driver.driverName)
              return (
                <button
                  key={`driver-${driver.driverName}-${driver.driverNumber ?? 'x'}`}
                  type="button"
                  onClick={() => setSelectedDriverName(driver.driverName)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${selected ? 'border-accent bg-accent/20' : 'border-white/10 bg-black/15 hover:bg-black/30'}`}
                >
                  <img src={imageOrFallback(img, driver.driverName)} alt={driver.driverName} className="h-8 w-8 rounded object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-text-primary">{driver.driverName}</div>
                    <div className="truncate text-[10px] text-text-muted">{driver.teamName}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="glass-panel min-h-0 overflow-auto rounded-2xl p-3.5">
          {!selectedDriver ? (
            <div className="flex h-full items-center justify-center text-text-muted">No driver selected</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <img
                  src={imageOrFallback(selectedDriver.driverImage || sessionImages.byDriver.get(selectedDriver.driverName), selectedDriver.driverName)}
                  alt={selectedDriver.driverName}
                  className="h-28 w-28 rounded-lg border border-white/10 object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-text-primary">{selectedDriver.driverName}</div>
                  <div className="text-sm text-text-secondary">{selectedDriver.fullName || selectedDriver.teamName}</div>
                  <div className="mt-1 text-xs text-text-muted">#{selectedDriver.driverNumber ?? '-'} · {selectedDriver.nationality || 'Nationality n/a'} · Age {selectedDriver.age ?? '-'}</div>
                  <div className="mt-1 text-xs text-text-muted">Career span: {fmtYears(selectedDriver.seasonYears)} · Seasons: {selectedDriver.seasons}</div>
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
                <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Achievements</div>
                  <div className="mt-2 space-y-1 text-xs text-text-primary">{(selectedDriver.achievements || []).map((item) => <div key={`a-${item}`} className="rounded border border-white/10 bg-white/5 px-2 py-1">{item}</div>)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Records</div>
                  <div className="mt-2 space-y-1 text-xs text-text-primary">{(selectedDriver.records || []).map((item) => <div key={`r-${item}`} className="rounded border border-white/10 bg-white/5 px-2 py-1">{item}</div>)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Best Moments</div>
                  <div className="mt-2 space-y-1 text-xs text-text-primary">{(selectedDriver.bestMoments || []).map((item) => <div key={`m-${item}`} className="rounded border border-white/10 bg-white/5 px-2 py-1">{item}</div>)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-text-primary">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Best Driven Race</div>
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
