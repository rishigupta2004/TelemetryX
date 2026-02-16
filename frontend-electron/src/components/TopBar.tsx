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
    <header className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-bg-secondary px-4">
      <div className="text-lg font-bold text-accent">TelemetryX</div>

      <div className="text-sm text-text-secondary">
        {loadingState === 'loading' && <span>Loading...</span>}
        {loadingState === 'error' && <span className="text-red-400">{error ?? 'Failed to load session'}</span>}
        {loadingState !== 'loading' && loadingState !== 'error' && (
          <span>{sessionInfo ?? 'No session loaded'}</span>
        )}
      </div>

      <button
        className="rounded-sm border border-border bg-bg-card px-3 py-1 text-sm text-text-primary hover:bg-bg-hover"
        onClick={onTogglePicker}
        type="button"
      >
        Select Session
      </button>
    </header>
  )
}
