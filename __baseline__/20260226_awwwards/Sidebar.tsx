import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { COMPOUND_COLORS } from '../lib/colors'
import { useTimingData, type TimingRow } from '../hooks/useTimingData'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import type { LapRow } from '../types'

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
]

const STORAGE_KEY = 'telemetryx_sidebar_collapsed'
const DRIVER_ROW_HEIGHT = 44

function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function normalizeCompound(raw: string | null | undefined): string {
  if (!raw) return 'UNKNOWN'
  const upper = raw.toUpperCase()
  if (upper === 'S') return 'SOFT'
  if (upper === 'M') return 'MEDIUM'
  if (upper === 'H') return 'HARD'
  if (upper === 'I') return 'INTER'
  if (upper === 'W') return 'WET'
  if (upper.includes('SOFT')) return 'SOFT'
  if (upper.includes('MEDIUM')) return 'MEDIUM'
  if (upper.includes('HARD')) return 'HARD'
  if (upper.includes('INTER')) return 'INTER'
  if (upper.includes('WET')) return 'WET'
  return 'UNKNOWN'
}

function buildTyreAgeLookup(laps: LapRow[]) {
  const byDriver = new Map<number, LapRow[]>()
  for (const lap of laps) {
    const list = byDriver.get(lap.driverNumber) ?? []
    list.push(lap)
    byDriver.set(lap.driverNumber, list)
  }
  const ageByLap = new Map<string, number>()
  const lastChangeByDriver = new Map<number, number>()
  for (const [driverNumber, list] of byDriver.entries()) {
    list.sort((a, b) => a.lapNumber - b.lapNumber)
    let lastCompound = normalizeCompound(list[0]?.tyreCompound)
    let lastChangeLap = list[0]?.lapNumber ?? 1
    for (const lap of list) {
      const compound = normalizeCompound(lap.tyreCompound)
      if (compound !== 'UNKNOWN' && compound !== lastCompound) {
        lastCompound = compound
        lastChangeLap = lap.lapNumber
      }
      ageByLap.set(`${driverNumber}|${lap.lapNumber}`, Math.max(0, lap.lapNumber - lastChangeLap))
    }
    lastChangeByDriver.set(driverNumber, lastChangeLap)
  }
  return { ageByLap, lastChangeByDriver }
}

function areRowsEqual(a: TimingRow, b: TimingRow): boolean {
  return (
    a.position === b.position &&
    a.driverCode === b.driverCode &&
    a.driverNumber === b.driverNumber &&
    a.teamColor === b.teamColor &&
    a.driverImage === b.driverImage &&
    a.gap === b.gap &&
    a.interval === b.interval &&
    a.tyreCompound === b.tyreCompound &&
    a.currentLap === b.currentLap &&
    a.status === b.status
  )
}

interface DriverListProps {
  collapsed: boolean
}

const DriverRowItem = React.memo(function DriverRowItem({
  row,
  idx,
  collapsed,
  primaryDriver,
  compareDriver,
  tyreAge,
  onSelect
}: {
  row: TimingRow
  idx: number
  collapsed: boolean
  primaryDriver: string | null
  compareDriver: string | null
  tyreAge: number | null
  onSelect: (driverCode: string, toggleCompare: boolean) => void
}) {
  const compoundKey = normalizeCompound(row.tyreCompound)
  const compoundColor = COMPOUND_COLORS[compoundKey] ?? '#666666'
  const isPrimary = primaryDriver === row.driverCode
  const isCompare = compareDriver === row.driverCode
  const ringColor = isPrimary ? '#e10600' : isCompare ? '#00d2ff' : 'transparent'
  const textColor = compoundKey === 'HARD' || compoundKey === 'MEDIUM' ? '#0b0e12' : '#ffffff'

  return (
    <button
      type="button"
      className="absolute left-0 top-0 w-full"
      style={{
        height: DRIVER_ROW_HEIGHT,
        transform: `translateY(${idx * DRIVER_ROW_HEIGHT}px)`,
        transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onClick={(event) => onSelect(row.driverCode, event.ctrlKey || event.metaKey)}
      title={`${row.driverCode} · ${row.interval}`}
    >
      <div
        className="flex h-full items-center gap-2 rounded-md px-2 transition-colors duration-150"
        style={{
          borderLeft: `3px solid ${row.teamColor}`,
          background: isPrimary ? 'rgba(26,39,68,0.9)' : 'rgba(17,17,21,0.85)'
        }}
      >
        {collapsed ? (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
            style={{
              backgroundColor: row.teamColor,
              color: '#0b0e12',
              border: `2px solid ${ringColor}`,
              fontFamily: 'var(--font-display)'
            }}
          >
            {row.position}
          </div>
        ) : (
          <>
            <div className="flex w-8 items-center justify-center text-[12px] font-bold text-text-primary">
              {row.position}
            </div>
            {row.driverImage ? (
              <img
                src={row.driverImage}
                alt={row.driverName || row.driverCode}
                className="h-7 w-7 rounded-full border border-border object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-text-secondary"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                {initials(row.driverName || row.driverCode)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="truncate text-[12px] font-semibold text-text-primary"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {row.driverCode}
                </div>
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: row.teamColor }}
                />
                {(isPrimary || isCompare) && (
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: ringColor }}
                  />
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {row.interval}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  backgroundColor: compoundColor,
                  color: textColor,
                  border: `1px solid rgba(0,0,0,0.35)`
                }}
              >
                {compoundKey[0]}
              </div>
              <div className="text-[10px] font-mono text-text-muted">
                {tyreAge != null ? `${tyreAge}L` : '—'}
              </div>
            </div>
          </>
        )}
      </div>
    </button>
  )
}, (prev, next) => {
  return (
    prev.idx === next.idx &&
    prev.collapsed === next.collapsed &&
    prev.primaryDriver === next.primaryDriver &&
    prev.compareDriver === next.compareDriver &&
    prev.tyreAge === next.tyreAge &&
    areRowsEqual(prev.row, next.row)
  )
})

const DriverList = React.memo(function DriverList({ collapsed }: DriverListProps) {
  const { rows, status } = useTimingData()
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)
  const laps = useSessionStore((s) => s.laps)

  const tyreLookup = useMemo(() => buildTyreAgeLookup(laps), [laps])
  const totalHeight = rows.length * DRIVER_ROW_HEIGHT

  const handleSelect = useCallback(
    (driverCode: string, toggleCompare: boolean) => {
      if (toggleCompare) {
        selectCompare(compareDriver === driverCode ? null : driverCode)
      } else {
        selectPrimary(driverCode)
      }
    },
    [selectCompare, selectPrimary, compareDriver]
  )

  if (status === 'loading') {
    return (
      <div className={`px-3 pb-3 ${collapsed ? 'px-1' : 'px-3'}`}>
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-bg-card/60" />
          ))}
        </div>
      </div>
    )
  }

  if (status !== 'ready' || rows.length === 0) {
    return (
      <div className={`px-3 pb-3 text-[11px] text-text-muted ${collapsed ? 'px-1' : 'px-3'}`}>
        No driver data
      </div>
    )
  }

  return (
    <div className={`${collapsed ? 'px-1' : 'px-2'} pb-2`}>
      <div className="relative" style={{ height: totalHeight }}>
        {rows.map((row, idx) => {
          const key = `${row.driverNumber}|${row.currentLap}`
          const age = tyreLookup.ageByLap.get(key) ?? (row.currentLap > 0 ? Math.max(0, row.currentLap - (tyreLookup.lastChangeByDriver.get(row.driverNumber) ?? 1)) : null)
          return (
            <DriverRowItem
              key={row.driverNumber}
              row={row}
              idx={idx}
              collapsed={collapsed}
              primaryDriver={primaryDriver}
              compareDriver={compareDriver}
              tyreAge={Number.isFinite(age as number) ? (age as number) : null}
              onSelect={handleSelect}
            />
          )
        })}
      </div>
    </div>
  )
})

export const Sidebar = React.memo(function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)) } catch { /* ignore */ }
  }, [collapsed])

  const handleToggle = useCallback(() => setCollapsed((v) => !v), [])

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className="panel flex flex-col overflow-hidden border-r border-border bg-bg-secondary"
      style={{
        width: collapsed ? 48 : 278,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: 0,
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-3 py-2.5" style={{ justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted"
            style={{
              animation: 'fadeInLeft 0.2s ease-out',
            }}
          >
            Navigation
          </div>
        )}
        <button
          type="button"
          onClick={handleToggle}
          className="sidebar-toggle-btn flex h-6 w-6 items-center justify-center rounded border border-border bg-bg-card text-[10px] text-text-muted transition-all duration-200 hover:border-accent/50 hover:text-text-primary hover:scale-110"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span style={{ transition: 'transform 250ms ease', display: 'inline-block', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            ►
          </span>
        </button>
      </div>

      {/* View list */}
      <nav className={`space-y-1 overflow-y-auto py-3 ${collapsed ? 'px-1.5' : 'px-3'}`}>
        {VIEWS.map((view, i) => {
          const isActive = currentView === view.id
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onViewChange(view.id)}
              className={`group relative flex w-full items-center rounded text-left transition-all duration-200 ${collapsed
                ? 'justify-center px-0 py-2.5'
                : 'gap-3.5 px-3.5 py-2.5'
                } ${isActive ? 'bg-bg-selected text-white' : 'text-text-secondary hover:bg-bg-hover'
                }`}
              style={{
                animationDelay: `${i * 40}ms`,
              }}
              title={collapsed ? view.label : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                  style={{
                    animation: 'slideInLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 0 8px rgba(225, 6, 0, 0.4)'
                  }}
                />
              )}

              {/* Icon badge */}
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border transition-all duration-200 ${isActive
                  ? 'border-accent/30 bg-accent/10 text-white'
                  : 'border-border bg-bg-card text-text-muted group-hover:text-text-secondary group-hover:border-border/80'
                  }`}
                style={{
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 200ms ease, background-color 200ms ease, border-color 200ms ease',
                }}
              >
                {view.icon}
              </span>

              {!collapsed && (
                <div className="min-w-0 flex-1" style={{ transition: 'opacity 150ms ease' }}>
                  <div className={`truncate text-[13px] font-semibold transition-colors duration-200 ${isActive ? 'text-white' : ''}`}>
                    {view.label}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-text-muted opacity-80">
                    {view.hint}
                  </div>
                </div>
              )}

              {isActive && !collapsed && (
                <div
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
                  style={{
                    animation: 'pulseGlow 2s ease-in-out infinite',
                    boxShadow: '0 0 6px rgba(225, 6, 0, 0.6)'
                  }}
                />
              )}

              {/* Tooltip on hover when collapsed */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg border border-border bg-bg-card px-3 py-2 text-xs font-semibold text-text-primary shadow-xl group-hover:block"
                  style={{ animation: 'tooltipIn 0.15s ease-out' }}
                >
                  {view.label}
                  <div className="text-[10px] font-normal text-text-muted">{view.hint}</div>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* Driver list */}
      <div className={`border-t border-border ${collapsed ? 'pt-2' : 'pt-3'}`}>
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
            Drivers
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <DriverList collapsed={collapsed} />
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-border px-4 py-3" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
          <div className="text-[10px] text-text-muted">
            <kbd className="rounded border border-border bg-bg-card px-1 py-0.5 font-mono text-[9px]">⌘</kbd> + <kbd className="rounded border border-border bg-bg-card px-1 py-0.5 font-mono text-[9px]">1-5</kbd> to switch views
          </div>
        </div>
      )}
    </aside>
  )
})
