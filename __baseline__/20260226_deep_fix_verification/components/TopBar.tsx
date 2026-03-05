import React from 'react'
import type { SessionVizResponse } from '../types'

interface TopBarProps {
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  sessionData: SessionVizResponse | null
  onTogglePicker: () => void
}

export default React.memo(function TopBar({ loadingState, error, sessionData, onTogglePicker }: TopBarProps) {
  const sessionInfo = sessionData
    ? `${sessionData.metadata.year} ${sessionData.metadata.raceName} — ${sessionData.metadata.sessionType}`
    : null

  const chips = sessionData
    ? [
      { label: 'Drivers', value: String(sessionData.drivers.length), color: '#35e080' },
      { label: 'Laps', value: String(sessionData.laps.length), color: '#47a6ff' },
      { label: 'Telemetry', value: sessionData.metadata.telemetryAvailable ? 'Live' : 'Limited', color: sessionData.metadata.telemetryAvailable ? '#35e080' : '#ffdd57' }
    ]
    : []

  return (
    <header
      className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-bg-secondary/95 px-3 backdrop-blur-md sm:px-4 xl:px-6"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 xl:gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div
          className="h-7 w-1.5 rounded-sm"
          style={{
            background: 'linear-gradient(180deg, #e10600, #ff3b3b)',
            boxShadow: '0 0 8px rgba(225,6,0,0.3)'
          }}
        />
        <div className="text-base font-bold tracking-[-0.01em] text-white sm:text-lg" style={{ fontFamily: "'Orbitron', 'Inter', sans-serif" }}>
          TelemetryX
        </div>
        <div
          className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] md:flex"
          style={{
            background: loadingState === 'ready' ? 'rgba(53, 224, 128, 0.1)' : 'rgba(225, 6, 0, 0.08)',
            border: `1px solid ${loadingState === 'ready' ? 'rgba(53, 224, 128, 0.2)' : 'rgba(225, 6, 0, 0.15)'}`,
            color: loadingState === 'ready' ? '#35e080' : '#e10600',
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: loadingState === 'ready' ? '#35e080' : '#e10600',
              animation: loadingState === 'ready' ? 'pulseGlow 2s ease-in-out infinite' : 'none',
              boxShadow: `0 0 4px ${loadingState === 'ready' ? 'rgba(53,224,128,0.5)' : 'rgba(225,6,0,0.3)'}`
            }}
          />
          {loadingState === 'ready' ? 'Connected' : loadingState === 'loading' ? 'Loading' : 'Idle'}
        </div>
      </div>

      {/* Session info pill */}
      <div className="mx-3 min-w-0 flex-1 sm:mx-5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div
          className="flex h-9 items-center truncate rounded-lg border border-border/60 px-3.5 text-sm transition-all duration-300"
          style={{
            background: sessionInfo
              ? 'linear-gradient(90deg, rgba(20,20,22,0.8), rgba(15,15,17,0.9))'
              : 'rgba(20,20,22,0.6)',
          }}
        >
          {loadingState === 'loading' && (
            <span className="flex items-center gap-2 text-text-secondary" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-muted border-t-accent" />
              Loading session…
            </span>
          )}
          {loadingState === 'error' && (
            <span className="text-red-300" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              {error ?? 'Failed to load session'}
            </span>
          )}
          {loadingState !== 'loading' && loadingState !== 'error' && (
            <span className="truncate text-text-secondary" style={{ animation: sessionInfo ? 'fadeInUp 0.3s ease-out' : 'none' }}>
              {sessionInfo ?? 'No session loaded'}
            </span>
          )}
        </div>

        {chips.length > 0 && (
          <div className="mt-1 hidden items-center gap-1.5 xl:flex">
            {chips.map((chip, i) => (
              <div
                key={chip.label}
                className="flex items-center gap-1 rounded-full border border-border/50 bg-bg-card/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-muted"
                style={{ animation: `fadeInUp 0.3s ease-out ${i * 80}ms both` }}
              >
                <div className="h-1 w-1 rounded-full" style={{ backgroundColor: chip.color }} />
                {chip.label}: <span className="font-semibold text-text-secondary">{chip.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session picker button */}
      <button
        className="group relative overflow-hidden rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text-primary transition-all duration-200 hover:border-accent/40 hover:text-white sm:px-5 sm:text-sm"
        style={{
          background: 'linear-gradient(180deg, rgba(24,24,27,0.9), rgba(16,16,18,0.95))',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        onClick={onTogglePicker}
        type="button"
      >
        <span className="relative z-10">Select Session</span>
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background: 'linear-gradient(180deg, rgba(225,6,0,0.06), rgba(225,6,0,0.02))',
          }}
        />
      </button>
    </header>
  )
})
