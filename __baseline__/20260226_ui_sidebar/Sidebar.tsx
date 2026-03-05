import React, { useState, useEffect, useCallback } from 'react'

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
        width: collapsed ? 52 : 278,
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
      <nav className={`flex-1 space-y-1 overflow-y-auto py-3 ${collapsed ? 'px-1.5' : 'px-3'}`}>
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
