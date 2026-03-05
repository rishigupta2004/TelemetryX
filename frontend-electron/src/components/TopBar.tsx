import React from 'react'
import { Bell, Settings } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import type { Driver, LapRow, SessionMetadata } from '../types'
import type { WsStatus } from '../hooks/useWebSocket'

interface TopBarProps {
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  sessionMeta: SessionMetadata | null
  drivers: Driver[]
  laps: LapRow[]
  wsStatus: WsStatus
  onTogglePicker: () => void
}

export default React.memo(function TopBar({
  loadingState,
  sessionMeta,
  wsStatus,
  onTogglePicker
}: TopBarProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const isConnected = wsStatus === 'connected' || loadingState === 'ready'
  const sessionInfo = sessionMeta
    ? `${sessionMeta.year} ${sessionMeta.raceName}`
    : 'NO SESSION'

  const sessionType = sessionMeta?.sessionType?.toUpperCase() || 'RACE'

  return (
    <header
      className="fixed left-0 right-0 top-[3px] z-40 flex h-[44px] items-center px-4 carbon-weave border-b border-border-hard bg-bg-surface panel-border"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 1. Hamburger Menu */}
      <button
        type="button"
        className="flex h-[20px] w-[20px] items-center justify-center mr-[8px] opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
        onClick={toggleSidebar}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 1H20" stroke="var(--fg-primary)" strokeWidth="2" />
          <path d="M0 7H20" stroke="var(--fg-primary)" strokeWidth="2" />
          <path d="M0 13H20" stroke="var(--fg-primary)" strokeWidth="2" />
        </svg>
      </button>

      {/* 2. TX Wordmark */}
      <div
        className="font-black text-[18px] tracking-tight mr-4 flex items-center"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        <span className="text-red-core">T</span>
        <span className="text-fg-primary">X</span>
      </div>

      {/* 3. 1px Vertical Separator */}
      <div className="w-[1px] h-[12px] bg-border-hard mx-2" />

      {/* 4. Session Selector Pill */}
      <button
        type="button"
        onClick={onTogglePicker}
        className="flex items-center mx-4 gap-2 hover:bg-bg-elevated px-2 py-1 rounded transition-colors group cursor-pointer"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="text-lg" title="FlagEmoji">🇪🇺</span>
        <span className="text-[13px] font-bold text-fg-primary whitespace-nowrap" style={{ fontFamily: 'var(--font-heading)' }}>
          {sessionInfo}
        </span>
        <span className="text-border-soft font-bold">·</span>
        <div className="px-1.5 py-0.5 rounded-[2px] border border-red-core bg-red-ghost flex items-center justify-center">
          <span className="text-red-core text-[9px] font-bold tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
            {sessionType}
          </span>
        </div>
        <span className="text-border-soft font-bold">·</span>
        <span className="text-[11px] text-fg-muted font-mono tracking-tight whitespace-nowrap">
          {sessionMeta ? new Date().getFullYear() : '----'}
        </span>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <path d="M4 6L0 0H8L4 6Z" fill="var(--fg-muted)" />
        </svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* 5. Connection Status */}
      <div className="flex items-center gap-2 mr-6" title={wsStatus}>
        <span className="text-[10px] font-mono text-fg-muted uppercase tracking-wider">
          {isConnected ? 'LIVE' : wsStatus}
        </span>
        <div className="relative flex items-center justify-center w-[8px] h-[8px]">
          {isConnected && (
            <div
              className="absolute inset-0 rounded-full bg-green-live opacity-50"
              style={{
                animation: 'pulseGlow 2s ease-in-out infinite'
              }}
            />
          )}
          <div
            className="w-[8px] h-[8px] rounded-full z-10"
            style={{ backgroundColor: isConnected ? 'var(--green-live)' : 'var(--amber-warn)' }}
          />
        </div>
      </div>

      {/* 6. Icons & Avatar */}
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="relative">
          <Bell size={16} className="text-fg-secondary hover:text-fg-primary cursor-pointer transition-colors" strokeWidth={1.5} />
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-[6px] h-[6px] bg-red-core rounded-full border border-bg-surface" />
          )}
        </div>

        <Settings size={16} className="text-fg-secondary hover:text-fg-primary cursor-pointer transition-colors" strokeWidth={1.5} />

        <div className="w-[1px] h-[16px] bg-border-hard mx-1" />

        <div
          className="w-[24px] h-[24px] rounded-full overflow-hidden border-[1.5px] border-border-hard bg-bg-inset flex items-center justify-center font-bold text-fg-primary text-[10px]"
        >
          RG
        </div>
      </div>

    </header>
  )
})
