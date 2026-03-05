import React, { useMemo, useCallback } from 'react'
import { useTimingData, type TimingRow } from '../hooks/useTimingData'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import { useUIStore } from '../stores/uiStore'

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
}

const VIEWS = [
  {
    id: 'timing', label: 'TIMING',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M1 2H15V4H9V14H7V4H1V2Z" />
        <rect x="7" y="6" width="6" height="2" />
        <rect x="7" y="9" width="4" height="2" />
        <rect x="7" y="12" width="5" height="2" />
      </svg>
    )
  },
  {
    id: 'telemetry', label: 'TELEMETRY',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 10L4 10L6 4L9 13L12 8L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    )
  },
  {
    id: 'track', label: 'TRACK',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4C4 2.89543 4.89543 2 6 2H10C11.1046 2 12 2.89543 12 4V12C12 13.1046 11.1046 14 10 14H6C4.89543 14 4 13.1046 4 12V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 2V14" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    )
  },
  {
    id: 'strategy', label: 'STRATEGY',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="12" height="3" />
        <rect x="2" y="6" width="8" height="3" opacity="0.6" />
        <rect x="11" y="6" width="3" height="3" />
        <rect x="2" y="10" width="10" height="3" opacity="0.4" />
      </svg>
    )
  },
  {
    id: 'features', label: 'FEATURES',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="3" cy="4" r="1.5" fill="currentColor" />
        <circle cx="13" cy="4" r="1.5" fill="currentColor" />
        <circle cx="3" cy="12" r="1.5" fill="currentColor" />
        <circle cx="13" cy="12" r="1.5" fill="currentColor" />
        <path d="M4 5L6.5 7M12 5L9.5 7M4 11L6.5 9M12 11L9.5 9" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: 'analytics', label: 'ANALYTICS',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="10" width="3" height="5" />
        <rect x="5" y="7" width="3" height="8" />
        <rect x="9" y="4" width="3" height="11" />
        <rect x="13" y="1" width="3" height="14" />
      </svg>
    )
  },
  {
    id: 'standings', label: 'STANDINGS',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="1" width="6" height="8" rx="1" />
        <rect x="1" y="5" width="5" height="6" rx="1" opacity="0.6" />
        <rect x="10" y="4" width="5" height="7" rx="1" opacity="0.4" />
        <rect x="1" y="12" width="14" height="2" />
      </svg>
    )
  },
  {
    id: 'profiles', label: 'PROFILES',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5" r="3" />
        <path d="M3 14C3 11.2386 5.23858 9 8 9C10.7614 9 13 11.2386 13 14V15H3V14Z" />
      </svg>
    )
  },
  {
    id: 'fia_documents', label: 'FIA DOCS',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 1H10L13 4V14C13 14.5523 12.5523 15 12 15H3C2.44772 15 2 14.5523 2 14V2C2 1.44772 2.44772 1 3 1Z" />
        <path d="M10 1V4H13" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="4" y="7" width="7" height="1" opacity="0.5" />
        <rect x="4" y="9" width="5" height="1" opacity="0.5" />
        <rect x="4" y="11" width="6" height="1" opacity="0.5" />
      </svg>
    )
  },
]

const DRIVER_ROW_HEIGHT = 28

const DriverRowItem = React.memo(function DriverRowItem({
  row,
  idx,
  collapsed,
  primaryDriver,
  compareDriver,
  onSelect
}: {
  row: TimingRow
  idx: number
  collapsed: boolean
  primaryDriver: string | null
  compareDriver: string | null
  onSelect: (driverCode: string, toggleCompare: boolean) => void
}) {
  const isPrimary = primaryDriver === row.driverCode
  const isCompare = compareDriver === row.driverCode
  const isSelected = isPrimary || isCompare

  const selectionColor = isPrimary ? 'var(--red-core)' : isCompare ? 'var(--blue-sel)' : 'transparent'
  const leftStripWidth = isSelected ? '5px' : '3px'

  return (
    <button
      type="button"
      className={`absolute left-0 top-0 w-full group overflow-hidden ${isSelected ? 'bg-bg-elevated' : 'hover:bg-bg-elevated'}`}
      style={{
        height: DRIVER_ROW_HEIGHT,
        transform: `translateY(${idx * DRIVER_ROW_HEIGHT}px)`,
        transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1)',
        borderTop: '0.5px solid var(--border-micro)',
        borderBottom: '0.5px solid var(--border-micro)'
      }}
      onClick={(e) => onSelect(row.driverCode, e.ctrlKey || e.metaKey)}
      title={row.driverCode}
    >
      <div
        className="flex h-full items-center gap-2 transition-colors duration-150"
        style={{
          borderLeft: `${leftStripWidth} solid ${isSelected ? selectionColor : row.teamColor}`
        }}
      >
        {collapsed ? (
          <div className="w-full flex justify-center items-center">
            <div
              className="text-[11px] font-bold text-fg-primary"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {row.driverCode.slice(0, 2)}
            </div>
          </div>
        ) : (
          <>
            <div className="w-8 flex justify-center items-center">
              <span className="text-[12px] font-mono font-bold text-fg-secondary">
                {row.position}
              </span>
            </div>

            <div className="w-[8px] h-[8px] flex-shrink-0" style={{ backgroundColor: row.teamColor }} />

            <div className="flex-1 truncate text-left">
              <span className="text-[13px] font-bold text-fg-primary leading-none" style={{ fontFamily: 'var(--font-heading)' }}>
                {row.driverCode}
              </span>
            </div>

            {isSelected && (
              <div
                className="mr-2 px-1 text-[9px] font-bold text-bg-void rounded-[2px] leading-none py-[2px]"
                style={{ backgroundColor: isPrimary ? 'var(--red-core)' : 'var(--blue-sel)' }}
              >
                {isPrimary ? '1' : '2'}
              </div>
            )}
          </>
        )}
      </div>
    </button>
  )
}, (prev, next) => (
  prev.idx === next.idx &&
  prev.collapsed === next.collapsed &&
  prev.primaryDriver === next.primaryDriver &&
  prev.compareDriver === next.compareDriver &&
  prev.row.driverCode === next.row.driverCode &&
  prev.row.position === next.row.position
))

const DriverList = React.memo(function DriverList({ collapsed }: { collapsed: boolean }) {
  const { rows, status } = useTimingData()
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)

  const handleSelect = useCallback(
    (driverCode: string, toggleCompare: boolean) => {
      if (toggleCompare) {
        selectCompare(compareDriver === driverCode ? null : driverCode)
      } else {
        selectPrimary(primaryDriver === driverCode ? null : driverCode)
      }
    },
    [selectCompare, selectPrimary, compareDriver, primaryDriver]
  )

  if (status === 'loading') {
    return (
      <div className="px-3 pb-3">
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-6 bg-border-hard/50" />
          ))}
        </div>
      </div>
    )
  }

  if (status !== 'ready' || rows.length === 0) return null

  return (
    <div className="relative w-full overflow-hidden" style={{ height: rows.length * DRIVER_ROW_HEIGHT }}>
      {rows.map((row, idx) => (
        <DriverRowItem
          key={row.driverNumber}
          row={row}
          idx={idx}
          collapsed={collapsed}
          primaryDriver={primaryDriver}
          compareDriver={compareDriver}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
})

export const Sidebar = React.memo(function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)

  return (
    <aside
      className={`fixed bottom-0 left-0 top-[47px] z-30 flex flex-col border-r border-border-hard border-t-[3px] border-t-red-core bg-bg-surface panel-border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? 'w-[64px]' : 'w-[280px]'
        }`}
    >  {/* 1. Logo area if expanded */}
      {!collapsed && (
        <div className="hidden h-[48px] items-center px-4 shrink-0">
          <span className="text-[10px] text-fg-muted font-bold tracking-widest uppercase">Navigation</span>
        </div>
      )}

      {/* 2. Navigation Section */}
      <div className="flex flex-col gap-1 py-2">
        {!collapsed && <div className="h-[1px] w-full bg-border-micro mb-0" />}
        {VIEWS.map((view) => {
          const isActive = currentView === view.id
          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className="relative flex items-center w-full h-[36px] group transition-colors focus:outline-none"
              title={collapsed ? view.label : undefined}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-core z-10" />
              )}

              <div
                className={`flex w-full h-full items-center ${collapsed ? 'justify-center' : 'px-4'} ${isActive
                  ? 'bg-bg-elevated'
                  : 'hover:bg-bg-elevated'
                  }`}
              >
                <div
                  className={`flex flex-shrink-0 items-center justify-center w-[20px] h-[20px] transition-colors ${isActive ? 'text-red-core' : 'text-fg-muted group-hover:text-fg-secondary'
                    }`}
                >
                  {view.icon}
                </div>

                {!collapsed && (
                  <span
                    className={`ml-3 text-[11px] font-bold tracking-[0.18em] pt-[2px] ${isActive ? 'text-fg-primary' : 'text-fg-secondary group-hover:text-fg-primary'
                      }`}
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {view.label}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {!collapsed && (
        <>
          {/* 3. Session info section */}
          <div className="mt-2 px-4 shrink-0">
            <div className="text-col-header mb-1">SESSION</div>
            <div className="h-[1px] w-full bg-border-micro mb-2" />
            <div className="text-[13px] font-bold text-fg-secondary leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              {sessionMeta?.raceName?.toUpperCase() || 'BAHRAIN GP'}
            </div>
            <div className="text-[11px] text-fg-muted font-sans mt-0.5">
              {sessionMeta?.sessionType?.toUpperCase() || 'RACE'} · {sessionMeta?.year || 2024}
            </div>
          </div>

          {/* 4. Drivers section */}
          <div className="mt-4 flex-1 min-h-0 flex flex-col pb-4">
            <div className="px-4 text-col-header mb-1 shrink-0">DRIVERS</div>
            <div className="h-[1px] w-full bg-border-micro mb-2 shrink-0" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
              <DriverList collapsed={false} />
            </div>
          </div>
        </>
      )}

      {/* Driver list collapsed view */}
      {collapsed && (
        <div className="mt-4 flex-1 overflow-y-auto no-scrollbar pt-2 border-t border-border-micro pb-4">
          <DriverList collapsed={true} />
        </div>
      )}
    </aside>
  )
})
