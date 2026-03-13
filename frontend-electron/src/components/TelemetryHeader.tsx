import React, { useEffect, useRef } from 'react'
import { useDriverStore } from '../stores/driverStore'
import { CHANNELS } from '../lib/telemetryUtils'
import type { ChannelKey } from '../lib/telemetryUtils'
import { animate } from 'animejs'

interface Driver {
  code: string
  driverName: string
  teamColor: string
}

interface TelemetryHeaderProps {
  drivers: Driver[]
  selectedDriver: string | null
  compareDriver: string | null
  stackedChannels: ChannelKey[]
  onSelectPrimary: (code: string) => void
  onSelectCompare: (code: string | null) => void
  onToggleChannel: (channel: ChannelKey) => void
  selectedDriverObj: Driver | undefined
  compareDriverObj: Driver | undefined
}

export const TelemetryHeader = React.memo(function TelemetryHeader({
  drivers,
  selectedDriver,
  compareDriver,
  stackedChannels,
  onSelectPrimary,
  onSelectCompare,
  onToggleChannel,
  selectedDriverObj,
  compareDriverObj,
}: TelemetryHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (headerRef.current) {
      animate(headerRef.current, {
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: 350,
        easing: 'easeOutCubic',
      })
    }
  }, [selectedDriver])

  return (
    <div
      ref={headerRef}
      className="flex flex-shrink-0 flex-col gap-2 border-b border-border-soft bg-gradient-to-r from-bg-surface via-bg-raised to-bg-surface px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-fg-muted font-bold tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Driver
          </span>
          <div className="relative">
            <select
              value={selectedDriver || ''}
              onChange={(e) => {
                onSelectPrimary(e.target.value)
              }}
              className="appearance-none rounded-lg border border-border-hard bg-gradient-to-b from-bg-inset to-bg-surface px-4 py-2 pr-8 text-[12px] font-mono text-fg-primary outline-none transition-all hover:border-blue-sel/50 focus:border-blue-sel focus:ring-1 focus:ring-blue-sel/30"
              style={{ minWidth: 160 }}
            >
              {drivers.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.driverName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-fg-muted font-bold tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Vs
          </span>
          <div className="relative">
            <select
              value={compareDriver || ''}
              onChange={(e) => onSelectCompare(e.target.value || null)}
              className="appearance-none rounded-lg border border-border-hard bg-gradient-to-b from-bg-inset to-bg-surface px-4 py-2 pr-8 text-[12px] font-mono text-fg-primary outline-none transition-all hover:border-purple-sb/50 focus:border-purple-sb focus:ring-1 focus:ring-purple-sb/30"
            >
              <option value="">None</option>
              {drivers
                .filter((d) => d.code !== selectedDriver)
                .map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.driverName}
                  </option>
                ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDriverObj && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-all"
              style={{
                backgroundColor: `${selectedDriverObj.teamColor}15`,
                borderColor: `${selectedDriverObj.teamColor}60`,
                color: selectedDriverObj.teamColor || '#fff',
                boxShadow: `0 0 12px ${selectedDriverObj.teamColor}20`,
              }}
            >
              <span className="font-mono opacity-70 uppercase text-[9px]">PRI</span>
              <span style={{ fontFamily: 'var(--font-heading)' }}>{selectedDriverObj.code}</span>
              <div
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: selectedDriverObj.teamColor, boxShadow: `0 0 8px ${selectedDriverObj.teamColor}` }}
              />
            </div>
          )}
          {compareDriverObj && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-all"
              style={{
                backgroundColor: `${compareDriverObj.teamColor}12`,
                borderColor: `${compareDriverObj.teamColor}50`,
                color: compareDriverObj.teamColor || '#bbb',
              }}
            >
              <span className="font-mono opacity-70 uppercase text-[9px]">CMP</span>
              <span style={{ fontFamily: 'var(--font-heading)' }}>{compareDriverObj.code}</span>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border-hard bg-bg-inset p-1">
          {CHANNELS.slice(0, 6).map((channel) => (
            <button
              key={channel.key}
              onClick={() => onToggleChannel(channel.key as ChannelKey)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${
                stackedChannels.includes(channel.key as ChannelKey)
                  ? 'bg-blue-sel/20 text-blue-sel shadow-sm'
                  : 'text-fg-muted hover:text-fg-secondary hover:bg-bg-raised'
              }`}
            >
              {channel.key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})
