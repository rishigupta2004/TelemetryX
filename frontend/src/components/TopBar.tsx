import type { SessionVizResponse } from '../types'

interface TopBarProps {
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  sessionData: SessionVizResponse | null
  onTogglePicker: () => void
}

export default function TopBar({ loadingState, error, sessionData, onTogglePicker }: TopBarProps) {
  const sessionInfo = sessionData
    ? `${sessionData.metadata.year} ${sessionData.metadata.raceName} — ${sessionData.metadata.sessionType}`
    : null

  return (
    <header className="z-40 flex h-12 items-center justify-between border-b border-border bg-[#0a0a0c] px-5">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-accent" style={{ boxShadow: '0 0 8px var(--color-accent), 0 0 16px var(--color-accent)' }} />
        <div className="text-[13px] font-bold tracking-[0.25em] text-white">
          TELEMETRY<span className="text-accent">X</span>
        </div>
      </div>

      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-secondary">
        {loadingState === 'loading' && <span className="animate-pulse text-accent">SYS_LOADING...</span>}
        {loadingState === 'error' && <span className="text-red-500">SYS_ERR: {error ?? 'FAILED TO LOAD'}</span>}
        {loadingState !== 'loading' && loadingState !== 'error' && (
          <span>{sessionInfo ? `[ ${sessionInfo} ]` : '[ NO_SESSION_LINKED ]'}</span>
        )}
      </div>

      <button
        className="rounded border border-border bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-primary transition-all hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-1 focus:ring-accent focus:ring-offset-1 focus:ring-offset-black"
        onClick={onTogglePicker}
        type="button"
      >
        Select Session
      </button>
    </header>
  )
}
