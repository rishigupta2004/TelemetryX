import React, { useMemo } from 'react'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
}

const VIEWS = [
  { id: 'timing', label: 'Timing', icon: 'T' },
  { id: 'telemetry', label: 'Telemetry', icon: 'M' },
  { id: 'strategy', label: 'Strategy', icon: 'S' },
  { id: 'track', label: 'Track', icon: 'K' },
  { id: 'features', label: 'Features + ML', icon: 'F' }
]

export const Sidebar = React.memo(function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const sessionData = useSessionStore((s) => s.sessionData)
  const loadingState = useSessionStore((s) => s.loadingState)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)

  const drivers = sessionData?.drivers || []

  const positionByDriver = useMemo(() => {
    const laps = sessionData?.laps ?? []
    const map = new Map<number, number>()
    for (const lap of laps) map.set(lap.driverNumber, lap.position ?? 99)
    return map
  }, [sessionData?.laps])

  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort((a, b) => {
        const aPos = positionByDriver.get(a.driverNumber) ?? 99
        const bPos = positionByDriver.get(b.driverNumber) ?? 99
        return aPos - bPos
      }),
    [drivers, positionByDriver]
  )

  return (
    <aside className="glass-panel-strong flex h-full w-[278px] flex-shrink-0 flex-col rounded-2xl">
      <div className="border-b border-border/80 px-3 py-3">
        <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">Views</div>
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => onViewChange(view.id)}
            className={`mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-xs tracking-[0.08em] transition ${
              currentView === view.id
                ? 'bg-[#2d4f87b8] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'text-text-secondary hover:bg-bg-hover/70 hover:text-text-primary'
            }`}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#1a3258] text-[10px] font-semibold">
              {view.icon}
            </span>
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2.5">
        <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">Drivers</div>
        {loadingState !== 'ready' ? (
          <div className="px-2 py-4 text-center text-xs text-text-muted">
            {loadingState === 'idle' ? 'Load a session' : loadingState === 'loading' ? 'Loading...' : 'Error loading'}
          </div>
        ) : (
          sortedDrivers.map((driver) => {
            const pos = positionByDriver.get(driver.driverNumber) ?? null
            const driverCode = driver.code || ''
            const isPrimary = driverCode === primaryDriver
            const isCompare = driverCode === compareDriver
            return (
              <button
                key={driver.driverNumber}
                type="button"
                onClick={(event) => {
                  if (!driverCode) return
                  if (event.ctrlKey || event.metaKey) {
                    selectCompare(isCompare ? null : driverCode)
                    return
                  }
                  selectPrimary(driverCode)
                }}
                className={`group mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                  isPrimary
                    ? 'bg-[#2d4f87b8]'
                    : isCompare
                      ? 'bg-[#204170a8] ring-1 ring-accent-blue/70'
                      : 'hover:bg-bg-hover/70'
                }`}
                title={isCompare ? 'Compare driver' : 'Primary driver'}
              >
                <span className="w-6 flex-shrink-0 text-right font-mono text-[10px] text-text-muted">{pos ? `P${pos}` : '-'}</span>
                {driver.driverImage ? (
                  <img
                    src={driver.driverImage}
                    alt={driver.driverName}
                    className="h-5 w-5 rounded-full border border-border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-4 w-1 rounded-sm" style={{ backgroundColor: driver.teamColor || '#666666' }} />
                )}
                <span className="font-mono text-xs font-bold text-text-primary">{driverCode || '???'}</span>
                <span className="truncate text-[10px] text-text-muted opacity-70 group-hover:opacity-100">
                  {driver.driverName?.split(' ').pop() || ''}
                </span>
                {driver.teamImage && (
                  <img
                    src={driver.teamImage}
                    alt={driver.teamName || 'Team'}
                    className="ml-auto h-3.5 w-3.5 rounded object-contain opacity-85"
                    loading="lazy"
                  />
                )}
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
})
