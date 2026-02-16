import { useEffect, useState } from 'react'
import SessionPicker from './components/SessionPicker'
import TopBar from './components/TopBar'
import TimingView from './views/TimingView'
import { TelemetryView } from './views/TelemetryView'
import { useSessionStore } from './stores/sessionStore'

type AppView = 'timing' | 'telemetry'

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('timing')

  const loadingState = useSessionStore((s) => s.loadingState)
  const error = useSessionStore((s) => s.error)
  const sessionData = useSessionStore((s) => s.sessionData)
  useEffect(() => {
    if (!sessionData) setActiveView('timing')
  }, [sessionData])

  const renderReadyView = () => {
    if (activeView === 'timing') return <TimingView />
    return <TelemetryView />
  }

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary">
      <TopBar
        error={error}
        loadingState={loadingState}
        onTogglePicker={() => setPickerOpen((v) => !v)}
        sessionData={sessionData}
      />

      <SessionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <main className="h-full pt-12">
        {loadingState === 'idle' && (
          <div className="flex h-full items-center justify-center text-lg text-text-secondary">Select a session to begin</div>
        )}

        {loadingState === 'loading' && (
          <div className="flex h-full items-center justify-center gap-3 text-text-secondary">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
            <span>Loading session data...</span>
          </div>
        )}

        {loadingState === 'error' && (
          <div className="flex h-full items-center justify-center text-lg text-red-400">
            {error ?? 'Failed to load session'}
          </div>
        )}

        {loadingState === 'ready' && (
          <div className="flex h-full flex-col gap-2 p-3">
            <div className="flex gap-1 border-b border-border bg-bg-primary px-3 py-1">
              {(['timing', 'telemetry'] as AppView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className={`rounded px-3 py-1 text-xs uppercase tracking-wider ${
                    activeView === view
                      ? 'bg-bg-selected text-text-primary'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">{renderReadyView()}</div>
          </div>
        )}
      </main>
    </div>
  )
}
