import React, { useMemo } from 'react'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionTime } from '../lib/timeUtils'

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
}

const VIEWS = [
  { id: 'timing', label: 'Timing Tower', icon: '⊞', hint: 'Live classification' },
  { id: 'telemetry', label: 'Telemetry', icon: '∿', hint: 'Speed · Throttle · Brake · RPM' },
  { id: 'strategy', label: 'Strategy', icon: '◎', hint: 'Pit windows & undercut' },
  { id: 'track', label: 'Track Map', icon: '⊛', hint: 'Live driver positions' },
  { id: 'features', label: 'Features', icon: '◇', hint: 'ML signals & insights' },
  { id: 'analytics', label: 'Analytics', icon: '◈', hint: 'Pace, tyres, sectors, ML' },
  { id: 'standings', label: 'Standings', icon: '▤', hint: 'Drivers + constructors' },
  { id: 'driverProfile', label: 'Driver Profiles', icon: '◍', hint: 'Career sheets + records' },
  { id: 'teamProfile', label: 'Team Profiles', icon: '◉', hint: 'Constructors + technical data' }
]

export const Sidebar = React.memo(function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const sessionData = useSessionStore((s) => s.sessionData)
  const laps = useSessionStore((s) => s.laps)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const sessionTime = useSessionTime()

  const orderedDrivers = useMemo(() => {
    if (!sessionData?.drivers?.length) return []

    const sourceLaps = laps.length ? laps : sessionData.laps
    const lapsByDriverNumber = new Map<number, typeof sourceLaps>()
    for (const lap of sourceLaps) {
      const rows = lapsByDriverNumber.get(lap.driverNumber) ?? []
      rows.push(lap)
      lapsByDriverNumber.set(lap.driverNumber, rows)
    }

    const findCurrentOrLatestLap = (driverLaps: typeof sourceLaps) => {
      if (!driverLaps.length) return null

      let lo = 0
      let hi = driverLaps.length - 1
      let latestBefore: typeof driverLaps[number] | null = null
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const lap = driverLaps[mid]
        if (lap.lapStartSeconds <= sessionTime && sessionTime < lap.lapEndSeconds) return lap
        if (lap.lapEndSeconds <= sessionTime) {
          latestBefore = lap
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      return latestBefore ?? driverLaps[0]
    }

    return sessionData.drivers
      .map((driver) => {
        const driverLaps = (lapsByDriverNumber.get(driver.driverNumber) ?? []).slice()
        driverLaps.sort((a, b) => a.lapNumber - b.lapNumber || a.lapEndSeconds - b.lapEndSeconds)
        const currentLap = findCurrentOrLatestLap(driverLaps)
        return {
          code: driver.code,
          teamColor: driver.teamColor,
          teamName: driver.teamName,
          position: currentLap?.position ?? 99
        }
      })
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        return a.code.localeCompare(b.code)
      })
  }, [sessionData, laps, sessionTime])

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className="panel flex w-[280px] flex-col overflow-hidden border-r border-border bg-bg-secondary sm:w-[296px]"
      style={{ borderRadius: 0 }}
    >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">Navigation</div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-border bg-bg-card px-2 py-0.5 text-[9px] uppercase tracking-wider text-text-muted">
              {currentView}
            </span>
          </div>
        </div>

        {/* View list */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {VIEWS.map((view) => {
            const isActive = currentView === view.id
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange(view.id)}
                className={`group flex w-full items-center gap-3.5 rounded px-3.5 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-bg-selected text-white' : 'text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {/* Icon badge */}
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-border text-base transition-colors ${
                    isActive ? 'bg-bg-selected text-white' : 'bg-bg-card text-text-muted group-hover:text-text-secondary'
                  }`}
                >
                  {view.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{view.label}</div>
                  <div className="mt-0.5 truncate text-[11px] text-text-muted opacity-80">
                    {view.hint}
                  </div>
                </div>

                {isActive && (
                  <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-border px-3 py-2.5">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-text-muted">Drivers</div>
          <div className="max-h-[196px] space-y-1 overflow-y-auto pr-0.5">
            {orderedDrivers.length === 0 && (
              <div className="rounded border border-border bg-bg-card px-2.5 py-2 text-[11px] text-text-muted">
                No driver data
              </div>
            )}
            {orderedDrivers.map((driver) => {
              const selected = primaryDriver === driver.code
              return (
                <button
                  key={driver.code}
                  type="button"
                  onClick={() => selectPrimary(driver.code)}
                  className={`flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-left transition-colors ${
                    selected
                      ? 'border-border bg-bg-selected text-white'
                      : 'border-border bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <span className="w-5 text-[10px] font-mono text-text-muted">P{driver.position}</span>
                  <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: driver.teamColor }} />
                  <span className="font-mono text-[12px] font-semibold">{driver.code}</span>
                  <span className="ml-auto truncate text-[10px] text-text-muted">{driver.teamName}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer — session hint */}
        <div className="border-t border-border px-4 py-3">
          <div className="text-[10px] text-text-muted">
            Click outside or press <kbd className="rounded border border-border bg-bg-card px-1 py-0.5 font-mono">Esc</kbd> to close
          </div>
        </div>
    </aside>
  )
})
