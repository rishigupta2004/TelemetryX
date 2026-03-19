import React from 'react'
import { useUIStore } from '../stores/uiStore'

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
}

const VIEWS = [
  { id: 'timing', label: 'Timing', icon: 'T' },
  { id: 'telemetry', label: 'Telemetry', icon: 'M' },
  { id: 'strategy', label: 'Strategy', icon: 'S' },
  { id: 'analytics', label: 'Analytics', icon: 'A' },
  { id: 'broadcast', label: 'Broadcast', icon: 'B' },
  { id: 'standings', label: 'Standings', icon: '📊' },
  { id: 'track', label: 'Track', icon: '🛤' },
  { id: 'profiles', label: 'Profiles', icon: '👤' },
  { id: 'fiaDocs', label: 'FIA Docs', icon: '📄' }
]

export const Sidebar = React.memo(function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <div
      className={`bg-[#060608] flex flex-col h-full border-r border-border flex-shrink-0 transition-[width] duration-300 ${
        sidebarCollapsed ? 'w-[58px]' : 'w-[200px]'
      }`}
    >
      <div className="flex flex-col gap-1 p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className="mb-3 flex w-full items-center justify-center rounded border border-transparent px-2 py-2 text-[10px] text-fg-muted transition-colors hover:border-border hover:bg-white/5 hover:text-fg-primary"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '»' : '« MENU'}
        </button>
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => onViewChange(view.id)}
            className={`flex w-full items-center ${
              sidebarCollapsed ? 'justify-center' : 'justify-start gap-3'
            } mb-1 rounded border-l-[3px] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-all ${
              currentView === view.id
                ? 'border-accent bg-accent/10 text-white shadow-[inset_1px_0_0_rgba(225,6,0,0.5)]'
                : 'border-transparent text-fg-muted hover:border-border hover:bg-white/5 hover:text-fg-primary'
            }`}
            title={view.label}
          >
            <span className={`text-[14px] ${currentView === view.id ? 'text-accent drop-shadow-[0_0_8px_rgba(225,6,0,0.8)]' : 'text-fg-muted'}`}>{view.icon}</span>
            {!sidebarCollapsed && <span>{view.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
})
