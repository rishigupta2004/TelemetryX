import React, { useEffect, useRef } from 'react'
import { animate } from 'animejs'
import type { LapTimeWindow } from '../hooks/useTelemetryData'

interface TelemetryControlsProps {
  selectedDriver: string | null
  compareDriver: string | null
  followPlayback: boolean
  selectedLap: number
  lapNumbers: number[]
  lapTimeWindow: LapTimeWindow | null
  activeLapNumber: number | null
  telemetryWindowStart: number
  telemetryWindowEnd: number
  loadingState: string
  compareDriverHasData: boolean
  onFollowPlaybackToggle: () => void
  onSelectLap: (lap: number) => void
}

export const TelemetryControls = React.memo(function TelemetryControls({
  selectedDriver,
  compareDriver,
  followPlayback,
  selectedLap,
  lapNumbers,
  lapTimeWindow,
  activeLapNumber,
  telemetryWindowStart,
  telemetryWindowEnd,
  loadingState,
  compareDriverHasData,
  onFollowPlaybackToggle,
  onSelectLap,
}: TelemetryControlsProps) {
  const controlsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (controlsRef.current && selectedDriver) {
      animate(controlsRef.current, {
        opacity: [0, 1],
        translateX: [-8, 0],
        duration: 300,
        easing: 'easeOutCubic',
        delay: 50,
      })
    }
  }, [selectedDriver, compareDriver])

  const lapIdx = lapNumbers.indexOf(selectedLap)
  const lapSelectValue = lapNumbers.includes(selectedLap) ? selectedLap : lapNumbers[0] ?? 0
  const windowStartLabel = lapTimeWindow ? 0 : telemetryWindowStart
  const windowEndLabel = lapTimeWindow ? lapTimeWindow.duration : telemetryWindowEnd

  return (
    <div ref={controlsRef} className="flex w-full flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onFollowPlaybackToggle}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] transition-all ${
          followPlayback
            ? 'border-blue-sel bg-blue-sel/15 text-blue-sel shadow-sm shadow-blue-sel/20'
            : 'border-border-hard bg-bg-surface text-fg-muted hover:text-fg-primary hover:border-fg-muted'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${followPlayback ? 'bg-blue-sel animate-pulse' : 'bg-fg-muted'}`} />
        SYNC {followPlayback ? 'ON' : 'OFF'}
      </button>

      <div className="flex items-center overflow-hidden rounded-md border border-border-hard bg-bg-inset">
        <button
          type="button"
          onClick={() => {
            if (lapIdx > 0) {
              onSelectLap(lapNumbers[lapIdx - 1])
            }
          }}
          disabled={lapIdx <= 0}
          className="px-3 py-1.5 text-fg-secondary hover:text-fg-primary hover:bg-bg-raised transition-all disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="relative">
          <select
            value={lapSelectValue}
            onChange={(e) => onSelectLap(Number(e.target.value))}
          className="appearance-none cursor-pointer bg-transparent px-3 py-1 pr-7 font-mono text-[11px] text-fg-primary outline-none"
          >
            {lapNumbers.map((lap) => (
              <option key={lap} value={lap}>
                Lap {lap}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted">
            <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
              <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (lapIdx < lapNumbers.length - 1) {
              onSelectLap(lapNumbers[lapIdx + 1])
            }
          }}
          disabled={lapIdx >= lapNumbers.length - 1}
          className="px-3 py-1.5 text-fg-secondary hover:text-fg-primary hover:bg-bg-raised transition-all disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {lapTimeWindow && (
        <div className="flex items-center gap-1.5 rounded-md bg-bg-inset px-2.5 py-1 border border-border-micro">
          <span className="text-[9px] text-fg-muted uppercase tracking-wider">Lap Time</span>
          <span className="font-mono text-[12px] text-fg-primary font-semibold">{lapTimeWindow.duration.toFixed(3)}s</span>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.14em]">Active</span>
          <span className="text-fg-secondary">Lap {activeLapNumber ?? '-'}</span>
        </span>
        <span className="text-fg-muted">|</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.14em]">Window</span>
          <span className="text-fg-secondary">{windowStartLabel.toFixed(0)}-{windowEndLabel.toFixed(0)}s</span>
        </span>
        {String(loadingState) === 'loading' && (
          <>
            <span className="text-fg-muted">|</span>
            <span className="flex items-center gap-1.5 text-amber-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-warn animate-pulse" />
              Loading...
            </span>
          </>
        )}
        {compareDriver && !compareDriverHasData && (
          <>
            <span className="text-fg-muted">|</span>
            <span className="text-red-danger">{compareDriver} No Data</span>
          </>
        )}
      </div>
    </div>
  )
})
