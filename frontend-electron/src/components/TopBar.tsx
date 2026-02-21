import type { SessionVizResponse } from '../types'

interface TopBarProps {
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  sessionData: SessionVizResponse | null
  onTogglePicker: () => void
}

export default function TopBar({ loadingState, error, sessionData, onTogglePicker }: TopBarProps) {
  const sessionInfo = sessionData
    ? `${sessionData.metadata.year} ${sessionData.metadata.raceName} - ${sessionData.metadata.sessionType}`
    : null
  const chips = sessionData
    ? [
        { label: 'Drivers', value: String(sessionData.drivers.length) },
        { label: 'Laps', value: String(sessionData.laps.length) },
        { label: 'Telemetry', value: sessionData.metadata.telemetryAvailable ? 'Live' : 'Limited' }
      ]
    : []

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-[linear-gradient(180deg,rgba(10,24,48,0.85),rgba(8,16,33,0.75))] px-4 backdrop-blur-md xl:px-6">
      <div className="flex items-center gap-2 xl:gap-3">
        <div className="h-8 w-2 rounded-full bg-gradient-to-b from-accent-blue to-accent" />
        <div className="font-['Plus_Jakarta_Sans','Avenir_Next',sans-serif] text-[26px] font-semibold tracking-[-0.02em] text-white xl:text-[30px]">
          TelemetryX
        </div>
        <div className="hidden rounded-full border border-[#89bbf858] bg-[#1634629e] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#cbe4ff] md:block">
          Live Analysis
        </div>
      </div>

      <div className="mx-4 min-w-0 flex-1">
        <div className="truncate rounded-full border border-[#77a8e23a] bg-[#10224180] px-4 py-1 text-sm text-text-secondary">
          {loadingState === 'loading' && <span>Loading...</span>}
          {loadingState === 'error' && <span className="text-red-300">{error ?? 'Failed to load session'}</span>}
          {loadingState !== 'loading' && loadingState !== 'error' && <span>{sessionInfo ?? 'No session loaded'}</span>}
        </div>
        {chips.length > 0 && (
          <div className="mt-1 hidden items-center gap-1.5 xl:flex">
            {chips.map((chip) => (
              <div
                key={chip.label}
                className="rounded-full border border-[#83b4ee45] bg-[#0f24457d] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b8d6fa]"
              >
                {chip.label}: <span className="font-semibold text-[#e7f2ff]">{chip.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="rounded-xl border border-[#85baff66] bg-[#16325db8] px-4 py-1.5 text-sm font-semibold text-[#e6f1ff] transition hover:bg-[#214379cc]"
        onClick={onTogglePicker}
        type="button"
      >
        Select Session
      </button>
    </header>
  )
}
