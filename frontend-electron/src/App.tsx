import { useEffect, useState } from 'react'
import { DebugOverlay } from './components/DebugOverlay'
import { PlaybackBar } from './components/PlaybackBar'
import { Sidebar } from './components/Sidebar'
import SessionPicker from './components/SessionPicker'
import TopBar from './components/TopBar'
import TimingView from './views/TimingView'
import { TelemetryView } from './views/TelemetryView'
import { StrategyView } from './views/StrategyView'
import { AnalyticsView } from './views/AnalyticsView'
import { BroadcastView } from './views/BroadcastView'
import { StandingsView } from './views/StandingsView'
import { TrackView } from './views/TrackView'
import { ProfilesView } from './views/ProfilesView'
import { FiaDocumentsView } from './views/FiaDocumentsView'
import { useSessionStore } from './stores/sessionStore'

type AppView = 'timing' | 'telemetry' | 'strategy' | 'analytics' | 'broadcast' | 'standings' | 'track' | 'profiles' | 'fiaDocs'

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('timing')

  const loadingState = useSessionStore((s) => s.loadingState)
  const error = useSessionStore((s) => s.error)
  const sessionData = useSessionStore((s) => s.sessionData)

  useEffect(() => {
    if (!sessionData) setActiveView('timing')
  }, [sessionData])

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary">
      <TopBar
        error={error}
        loadingState={loadingState}
        onTogglePicker={() => setPickerOpen((v) => !v)}
        sessionData={sessionData}
      />

      <SessionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <main className="h-full pt-12 flex flex-col">
        <div className="flex-1 min-h-0">
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
            <div className="flex h-full min-h-0">
              <Sidebar currentView={activeView} onViewChange={(view) => setActiveView(view as AppView)} />
              <div className="flex-1 min-h-0 min-w-0">
                {activeView === 'timing' && <div className="h-full w-full min-w-0"><TimingView /></div>}
                {activeView === 'telemetry' && <div className="h-full w-full min-w-0"><TelemetryView active /></div>}
                {activeView === 'strategy' && <div className="h-full w-full min-w-0"><StrategyView active /></div>}
                {activeView === 'analytics' && <div className="h-full w-full min-w-0"><AnalyticsView /></div>}
                {activeView === 'broadcast' && <div className="h-full w-full min-w-0"><BroadcastView /></div>}
                {activeView === 'standings' && <div className="h-full w-full min-w-0"><StandingsView /></div>}
                {activeView === 'track' && <div className="h-full w-full min-w-0"><TrackView /></div>}
                {activeView === 'profiles' && <div className="h-full w-full min-w-0"><ProfilesView /></div>}
                {activeView === 'fiaDocs' && <div className="h-full w-full min-w-0"><FiaDocumentsView /></div>}
              </div>
            </div>
          )}
        </div>
        <PlaybackBar />
      </main>
      <DebugOverlay />
    </div>
  )
}
