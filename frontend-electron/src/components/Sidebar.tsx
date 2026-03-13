import React, { useMemo, useCallback, useEffect, useRef, useState, memo } from 'react'
import { animate } from 'animejs'
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
const DRIVER_OVERSCAN = 5
const VIRTUALIZATION_THRESHOLD = 20

interface DriverRowItemProps {
  row: TimingRow
  idx: number
  collapsed: boolean
  primaryDriver: string | null
  compareDriver: string | null
  onSelect: (driverCode: string, toggleCompare: boolean) => void
}

const DriverRowItem = memo(function DriverRowItem({
  row,
  idx,
  collapsed,
  primaryDriver,
  compareDriver,
  onSelect
}: DriverRowItemProps) {
  const isPrimary = primaryDriver === row.driverCode
  const isCompare = compareDriver === row.driverCode
  const isSelected = isPrimary || isCompare
  const rowRef = useRef<HTMLButtonElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (rowRef.current && idx < 12) {
      animate(rowRef.current, {
        opacity: [0, 1],
        translateX: [-12, 0],
        delay: idx * 35,
        duration: 350,
        easing: 'outQuint'
      })
    }
  }, [idx])

  useEffect(() => {
    if (isSelected && rowRef.current) {
      animate(rowRef.current, {
        boxShadow: [
          '0 0 0 rgba(220, 38, 38, 0)',
          '0 0 12px rgba(220, 38, 38, 0.3), 0 0 24px rgba(220, 38, 38, 0.15)'
        ],
        duration: 400,
        easing: 'outQuart'
      })
    }
  }, [isSelected])

  const handleClick = useCallback(() => {
    onSelect(row.driverCode, false)
  }, [onSelect, row.driverCode])

  const selectionColor = isPrimary ? 'var(--red-core)' : isCompare ? 'var(--blue-sel)' : 'transparent'
  const leftStripWidth = isSelected ? '5px' : '2px'

  return (
    <button
      ref={rowRef}
      type="button"
      className={`absolute left-0 top-0 w-full group overflow-hidden transition-all duration-150 micro-press ${
        isSelected 
          ? 'bg-gradient-to-r from-bg-elevated to-bg-elevated/60' 
          : 'hover:bg-gradient-to-r hover:from-bg-elevated/80 hover:to-transparent'
      }`}
      style={{
        height: DRIVER_ROW_HEIGHT,
        transform: `translateY(${idx * DRIVER_ROW_HEIGHT}px)`,
        transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms ease',
        borderTop: '0.5px solid var(--border-micro)',
        borderBottom: '0.5px solid var(--border-micro)',
        borderRadius: '4px'
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={row.driverCode}
    >
      <div
        className="flex h-full items-center gap-2 transition-all duration-150"
        style={{
          borderLeft: `${leftStripWidth} solid ${isSelected ? selectionColor : row.teamColor}`,
          boxShadow: isSelected ? `inset 0 0 20px ${selectionColor}20` : 'none'
        }}
      >
        {collapsed ? (
          <div className="w-full flex justify-center items-center">
            <div
              className="text-[11px] font-bold text-fg-primary transition-all duration-200 group-hover:scale-110"
              style={{ 
                fontFamily: 'var(--font-heading)',
                textShadow: isSelected ? `0 0 8px ${selectionColor}80` : 'none'
              }}
            >
              {row.driverCode.slice(0, 2)}
            </div>
          </div>
        ) : (
          <>
            <div className="w-8 flex justify-center items-center">
              <span 
                className={`text-[13px] font-mono font-bold tabular-nums transition-all duration-200 group-hover:text-fg-primary ${
                  isSelected ? 'text-glow' : ''
                }`}
              >
                {row.position}
              </span>
            </div>

            <div 
              className="w-[10px] h-[10px] rounded-sm flex-shrink-0 transition-all duration-200 group-hover:scale-125" 
              style={{ 
                backgroundColor: row.teamColor, 
                boxShadow: isHovered || isSelected 
                  ? `0 0 10px ${row.teamColor}, 0 0 20px ${row.teamColor}40` 
                  : `0 0 8px ${row.teamColor}60`,
                transform: isSelected ? 'scale(1.15)' : isHovered ? 'scale(1.1)' : 'scale(1)'
              }} 
            />

            <div className="flex-1 truncate text-left">
              <span 
                className="text-[13px] font-bold text-fg-primary leading-none transition-all duration-200 group-hover:translate-x-1" 
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  textShadow: isSelected ? `0 0 10px ${selectionColor}60` : 'none'
                }}
              >
                {row.driverCode}
              </span>
            </div>

            {isSelected && (
              <div
                className="mr-2 px-1.5 text-[9px] font-bold text-bg-void rounded-[2px] leading-none py-[2px] transition-all duration-200"
                style={{ 
                  backgroundColor: isPrimary ? 'var(--red-core)' : 'var(--blue-sel)',
                  boxShadow: `0 0 12px ${isPrimary ? 'var(--red-core)' : 'var(--blue-sel)'}80`,
                  animation: 'glowPulseRed 2s ease-in-out infinite'
                }}
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

const DriverList = memo(function DriverList({ collapsed }: { collapsed: boolean }) {
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

  const stableHandleSelect = useCallback(
    (driverCode: string, _toggleCompare: boolean) => {
      handleSelect(driverCode, false)
    },
    [handleSelect]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(300)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        setScrollTop(node.scrollTop)
      })
    }
    node.addEventListener('scroll', onScroll, { passive: true })

    const ro = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? node.clientHeight
      setViewportHeight(height)
    })
    ro.observe(node)

    return () => {
      node.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  const virtualWindow = useMemo(() => {
    const totalRows = rows.length
    if (totalRows < VIRTUALIZATION_THRESHOLD) {
      return {
        totalRows,
        startIndex: 0,
        endIndex: totalRows,
        visibleRows: rows,
      }
    }
    const visibleCount = Math.ceil(viewportHeight / DRIVER_ROW_HEIGHT)
    const startIndex = Math.max(0, Math.floor(scrollTop / DRIVER_ROW_HEIGHT) - DRIVER_OVERSCAN)
    const endIndex = Math.min(totalRows, startIndex + visibleCount + DRIVER_OVERSCAN * 2)
    return {
      totalRows,
      startIndex,
      endIndex,
      visibleRows: rows.slice(startIndex, endIndex),
    }
  }, [rows, viewportHeight, scrollTop])

  if (status === 'loading') {
    return (
      <div className="px-3 pb-3">
        <div className="skeleton-wave rounded-md h-6 mb-2" style={{ width: '80%' }} />
        <div className="skeleton-wave rounded-md h-6 mb-2" style={{ width: '90%' }} />
        <div className="skeleton-wave rounded-md h-6 mb-2" style={{ width: '70%' }} />
        <div className="skeleton-wave rounded-md h-6 mb-2" style={{ width: '85%' }} />
      </div>
    )
  }

  if (status !== 'ready' || rows.length === 0) return null

  const useVirtualization = rows.length >= VIRTUALIZATION_THRESHOLD

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ 
        height: useVirtualization ? rows.length * DRIVER_ROW_HEIGHT : 'auto',
        overflow: useVirtualization ? 'auto' : 'visible'
      }}
    >
      {virtualWindow.visibleRows.map((row, visibleIdx) => (
        <DriverRowItem
          key={row.driverNumber}
          row={row}
          idx={virtualWindow.startIndex + visibleIdx}
          collapsed={collapsed}
          primaryDriver={primaryDriver}
          compareDriver={compareDriver}
          onSelect={stableHandleSelect}
        />
      ))}
    </div>
  )
})

export const Sidebar = memo(function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)
  const navRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const sessionRef = useRef<HTMLDivElement>(null)
  const driversRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sidebarRef.current) {
      animate(sidebarRef.current, {
        opacity: [0, 1],
        translateX: [-16, 0],
        duration: 450,
        easing: 'outQuint'
      })
    }
  }, [])

  useEffect(() => {
    if (navRef.current) {
      animate(navRef.current, {
        opacity: [0, 1],
        translateX: [-8, 0],
        delay: 150,
        duration: 400,
        easing: 'outQuint'
      })
    }
  }, [])

  useEffect(() => {
    if (sessionRef.current && !collapsed) {
      animate(sessionRef.current, {
        opacity: [0, 1],
        translateY: [8, 0],
        delay: 280,
        duration: 350,
        easing: 'outQuint'
      })
    }
  }, [collapsed])

  useEffect(() => {
    if (driversRef.current && !collapsed) {
      animate(driversRef.current, {
        opacity: [0, 1],
        translateY: [8, 0],
        delay: 350,
        duration: 350,
        easing: 'outQuint'
      })
    }
  }, [collapsed])

  return (
    <aside
      ref={sidebarRef}
      className={`fixed bottom-0 left-0 top-[47px] z-30 flex flex-col border-r border-border-hard border-t-[3px] border-t-red-core bg-gradient-to-b from-bg-surface via-bg-surface to-bg-base panel-premium-soft transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        collapsed ? 'w-[64px]' : 'w-[280px]'
      }`}
      style={{
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35), inset 0 0 80px rgba(220, 38, 38, 0.025)',
        background: collapsed 
          ? 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
          : 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 50%, var(--bg-base) 100%)'
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-30" 
        style={{
          background: 'radial-gradient(ellipse at 20% 20%, rgba(225, 6, 0, 0.06) 0%, transparent 50%)'
        }}
      />

      {!collapsed && (
        <div className="hidden h-[48px] items-center px-4 shrink-0 relative">
          <span className="text-[10px] text-fg-muted font-bold tracking-widest uppercase animate-fade-in">Navigation</span>
          <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-red-core/30 via-border-micro to-transparent" />
        </div>
      )}

      <div ref={navRef} className="flex flex-col gap-1 py-2 px-1 relative">
        {!collapsed && (
          <div className="h-[1px] w-full bg-border-micro mb-1" />
        )}
        {VIEWS.map((view, viewIdx) => {
          const isActive = currentView === view.id
          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`relative flex items-center w-full h-[36px] group transition-all duration-200 focus:outline-none micro-press ${
                isActive ? 'glow-subtle-red' : ''
              }`}
              title={collapsed ? view.label : undefined}
              style={{
                animation: 'slideInUp 0.3s ease forwards',
                animationDelay: `${100 + viewIdx * 40}ms`,
                opacity: 0
              }}
            >
              {isActive && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-[3px] z-10 shadow-[0_0_12px_rgba(220,38,0.5)]" 
                  style={{
                    background: 'linear-gradient(180deg, var(--red-core) 0%, var(--red-core)/80 50%, var(--red-core)/60 100%)',
                    boxShadow: '0 0 12px rgba(220, 38, 38, 0.6), 0 0 24px rgba(220, 38, 38, 0.3)'
                  }}
                />
              )}

              <div
                className={`flex w-full h-full items-center ${collapsed ? 'justify-center' : 'px-3'} ${
                  isActive
                    ? 'bg-gradient-to-r from-red-core/12 to-transparent shadow-[0_0_16px_rgba(220,38,38,0.2)]'
                    : 'hover:bg-gradient-to-r hover:from-bg-elevated/80 hover:to-transparent'
                }`}
                style={{
                  transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                  borderRadius: '6px'
                }}
              >
                <div
                  className={`flex flex-shrink-0 items-center justify-center w-[20px] h-[20px] transition-all duration-200 ${
                    isActive
                      ? 'text-red-core scale-110'
                      : 'text-fg-muted group-hover:text-fg-secondary group-hover:scale-105'
                  }`}
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.5))' : 'none'
                  }}
                >
                  {view.icon}
                </div>

                {!collapsed && (
                  <span
                    className={`ml-3 text-[11px] font-bold tracking-[0.18em] pt-[2px] transition-all duration-200 ${
                      isActive
                        ? 'text-fg-primary glow-subtle-red'
                        : 'text-fg-secondary group-hover:text-fg-primary'
                    }`}
                    style={{ 
                      fontFamily: 'var(--font-heading)',
                      textShadow: isActive ? '0 0 10px rgba(220, 38, 38, 0.4)' : 'none'
                    }}
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
          <div ref={sessionRef} className="mt-2 px-4 shrink-0 relative">
            <div 
              className="absolute inset-0 pointer-events-none opacity-50"
              style={{
                background: 'radial-gradient(ellipse at 80% 50%, rgba(124, 58, 237, 0.04) 0%, transparent 60%)'
              }}
            />
            <div className="text-[9px] text-fg-muted font-bold tracking-[0.25em] uppercase mb-1">Session</div>
            <div 
              className="h-[1px] w-full bg-gradient-to-r from-red-core/50 via-border-micro to-transparent mb-2" 
              style={{ boxShadow: '0 0 8px rgba(225, 6, 0, 0.2)' }}
            />
            <div 
              className="text-[13px] font-bold text-fg-secondary leading-tight bg-gradient-to-r from-fg-secondary to-fg-primary bg-clip-text text-transparent"
              style={{ 
                fontFamily: 'var(--font-heading)',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.1)'
              }}
            >
              {sessionMeta?.raceName?.toUpperCase() || 'BAHRAIN GP'}
            </div>
            <div className="text-[11px] text-fg-muted font-sans mt-0.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: 'var(--green-live)',
                    boxShadow: '0 0 6px var(--green-live)'
                  }}
                />
                {sessionMeta?.sessionType?.toUpperCase() || 'RACE'}
              </span>
              <span className="text-fg-ghost">·</span>
              <span>{sessionMeta?.year || 2024}</span>
            </div>
          </div>

          <div ref={driversRef} className="mt-4 flex-1 min-h-0 flex flex-col pb-4 relative">
            <div className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: 'radial-gradient(ellipse at 50% 80%, rgba(59, 130, 246, 0.04) 0%, transparent 60%)'
              }}
            />
            <div className="px-4 text-[9px] text-fg-muted font-bold tracking-[0.25em] uppercase mb-1 shrink-0 relative z-10">Drivers</div>
            <div className="h-[1px] w-full bg-gradient-to-r from-red-core/30 via-border-micro to-transparent mb-2 shrink-0 relative z-10" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar relative z-10">
              <DriverList collapsed={false} />
              <div 
                className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg-surface via-bg-surface/95 to-transparent pointer-events-none" 
                style={{ boxShadow: '0 -8px 20px rgba(17, 17, 20, 0.8)' }}
              />
            </div>
          </div>
        </>
      )}

      {collapsed && (
        <div 
          className="mt-4 flex-1 overflow-y-auto no-scrollbar pt-2 border-t border-border-micro pb-4 relative bg-gradient-to-b from-transparent via-bg-surface/50 to-bg-base"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(17, 17, 20, 0.6) 20%, var(--bg-base) 100%)'
          }}
        >
          <DriverList collapsed={true} />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg-surface via-bg-surface/90 to-transparent pointer-events-none" />
        </div>
      )}
    </aside>
  )
})
