import React, { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
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

function TopBarComponent({
  loadingState,
  sessionMeta,
  wsStatus,
  onTogglePicker
}: TopBarProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const headerRef = useRef<HTMLHeadingElement | null>(null)
  const [isAnimatingIn, setIsAnimatingIn] = useState(true)

  useEffect(() => {
    if (isAnimatingIn && headerRef.current) {
      animate(headerRef.current, {
        opacity: [0, 1],
        translateY: [-8, 0],
        duration: 300,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        complete: () => setIsAnimatingIn(false)
      })
    }
  }, [isAnimatingIn])

  useEffect(() => {
    if (!isAnimatingIn && headerRef.current) {
      headerRef.current.style.opacity = '1'
    }
  }, [isAnimatingIn])

  const isConnected = wsStatus === 'connected' || loadingState === 'ready'
  const sessionInfo = sessionMeta
    ? `${sessionMeta.year} ${sessionMeta.raceName}`
    : 'NO SESSION'

  const sessionType = sessionMeta?.sessionType?.toUpperCase() || 'RACE'

  return (
    <header
      ref={headerRef}
      className="fixed left-0 right-0 top-[3px] z-40 flex h-[52px] items-center px-4 gradient-header border-b border-border-hard bg-bg-surface/95 backdrop-blur-md panel-border"
      style={{
        WebkitAppRegion: 'drag',
        opacity: 0,
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.03)'
      } as React.CSSProperties}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-full bg-gradient-to-r from-red-core/5 to-transparent" />
        <div className="absolute top-0 right-32 w-96 h-full bg-gradient-to-l from-blue-sel/10 to-transparent" />
      </div>

      <button
        type="button"
        className="flex h-[20px] w-[20px] items-center justify-center mr-[12px] opacity-80 hover:opacity-100 transition-all duration-200 cursor-pointer btn-glow rounded-md group"
        onClick={toggleSidebar}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 1H20" stroke="var(--fg-primary)" strokeWidth="2" className="transition-all duration-200 group-hover:stroke-red-core" />
          <path d="M0 7H20" stroke="var(--fg-primary)" strokeWidth="2" className="transition-all duration-200 group-hover:stroke-red-core" />
          <path d="M0 13H20" stroke="var(--fg-primary)" strokeWidth="2" className="transition-all duration-200 group-hover:stroke-red-core" />
        </svg>
      </button>

      <div
        className="font-black text-[20px] tracking-tight mr-6 flex items-center transition-all duration-300 group"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        <div className="relative">
          <span className="text-red-core transition-all duration-300 relative z-10" style={{ 
            textShadow: '0 0 20px rgba(225,6,0,0.6), 0 0 40px rgba(225,6,0,0.3)'
          }}>T</span>
          <div className="absolute inset-0 bg-red-core/20 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        <span className="text-fg-primary relative">
          X
          <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded" />
        </span>
      </div>

      <div className="w-[1px] h-[20px] bg-gradient-to-b from-transparent via-border-hard to-transparent mx-2" />

      <button
        type="button"
        onClick={onTogglePicker}
        className="flex items-center mx-4 gap-3 hover:bg-bg-elevated/80 px-4 py-2 rounded-xl transition-all duration-300 group cursor-pointer border-glow relative overflow-hidden"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-core/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        
        <span className="text-xl transition-transform duration-200 group-hover:scale-110 relative z-10" title="FlagEmoji">🇪🇺</span>
        <span className="text-[13px] font-bold text-fg-primary whitespace-nowrap transition-colors duration-200 relative z-10" style={{ fontFamily: 'var(--font-heading)' }}>
          {sessionInfo}
        </span>
        <span className="text-border-soft font-bold relative z-10">·</span>
        <div className="px-3 py-1 rounded-md border border-red-core/40 bg-red-ghost/30 flex items-center justify-center transition-all duration-300 group-hover:border-red-core group-hover:bg-red-ghost/60 group-hover:shadow-[0_0_12px_rgba(225,6,0,0.3)] relative z-10">
          <span className="text-red-core text-[10px] font-bold tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
            {sessionType}
          </span>
        </div>
        <span className="text-border-soft font-bold relative z-10">·</span>
        <span className="text-[11px] text-fg-muted font-mono tracking-tight whitespace-nowrap relative z-10">
          {sessionMeta ? new Date().getFullYear() : '----'}
        </span>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 opacity-50 group-hover:opacity-100 transition-all duration-200 group-hover:translate-y-0.5 relative z-10">
          <path d="M4 6L0 0H8L4 6Z" fill="var(--fg-muted)" />
        </svg>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3 mr-6 group" title={wsStatus}>
        <span className="text-[11px] font-semibold uppercase tracking-widest transition-colors duration-300 group-hover:text-fg-secondary" 
          style={{ 
            color: isConnected ? 'var(--green-live)' : 'var(--amber-warn)',
            textShadow: isConnected ? '0 0 10px rgba(34,197,94,0.4)' : 'none'
          }}>
          {isConnected ? 'LIVE' : wsStatus}
        </span>
        <div className="relative flex items-center justify-center w-[10px] h-[10px]">
          {isConnected && (
            <>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.4)',
                  animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s'
                }}
              />
            </>
          )}
          <div
            className={`w-[10px] h-[10px] rounded-full z-10 transition-all duration-500 ${isConnected ? 'glow-green shadow-[0_0_8px_rgba(34,197,94,0.8)]' : ''}`}
            style={{ 
              backgroundColor: isConnected ? 'var(--green-live)' : 'var(--amber-warn)',
              boxShadow: isConnected ? '0 0 12px rgba(34,197,94,0.9), inset 0 0 4px rgba(255,255,255,0.3)' : '0 0 8px rgba(251,191,36,0.5)'
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="relative group/icon">
          <Bell size={18} className="text-fg-secondary hover:text-fg-primary cursor-pointer transition-all duration-200 group-hover/icon:scale-110" strokeWidth={1.5} />
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-[7px] h-[7px] bg-red-core rounded-full border-2 border-bg-surface animate-pulse shadow-[0_0_8px_rgba(225,6,0,0.8)]" />
          )}
          <div className="absolute inset-0 bg-red-core/10 rounded-full opacity-0 group-hover/icon:opacity-100 blur-xl transition-opacity duration-200" />
        </div>

        <div className="relative group/icon">
          <Settings size={18} className="text-fg-secondary hover:text-fg-primary cursor-pointer transition-all duration-200 group-hover/icon:scale-110 group-hover/icon:rotate-90" strokeWidth={1.5} />
          <div className="absolute inset-0 bg-blue-sel/10 rounded-full opacity-0 group-hover/icon:opacity-100 blur-xl transition-opacity duration-200" />
        </div>

        <div className="w-[1px] h-[20px] bg-gradient-to-b from-transparent via-border-hard to-transparent mx-1" />

        <div
          className="w-[28px] h-[28px] rounded-full overflow-hidden border-[2px] border-border-hard bg-bg-inset flex items-center justify-center font-bold text-fg-primary text-[10px] transition-all duration-300 hover:border-red-core/60 hover:scale-110 hover:shadow-[0_0_16px_rgba(225,6,0,0.4)] cursor-pointer group/avatar"
        >
          <span className="relative z-10 group-hover/avatar:text-white transition-colors duration-300">RG</span>
          <div className="absolute inset-0 bg-gradient-to-br from-red-core/20 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300" />
        </div>
      </div>

    </header>
  )
}

export default React.memo(TopBarComponent)
export const TopBar = React.memo(TopBarComponent)
