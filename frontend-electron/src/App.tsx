import { useEffect, useState } from 'react'
import { DebugOverlay } from './components/DebugOverlay'
import { PlaybackBar } from './components/PlaybackBar'
import { Sidebar } from './components/Sidebar'
import SessionPicker from './components/SessionPicker'
import TopBar from './components/TopBar'
import { WelcomeScreen } from './components/WelcomeScreen'
import TimingView from './views/TimingView'
import { TelemetryView } from './views/TelemetryView'
import { StrategyView } from './views/StrategyView'
import { TrackView } from './views/TrackView'
import { FeaturesView } from './views/FeaturesView'
import { useSessionStore } from './stores/sessionStore'

type AppView = 'timing' | 'telemetry' | 'strategy' | 'track' | 'features'
type BootPhase = 'welcome' | 'app'

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('timing')
  const [bootPhase, setBootPhase] = useState<BootPhase>('welcome')

  const loadingState = useSessionStore((s) => s.loadingState)
  const error = useSessionStore((s) => s.error)
  const sessionData = useSessionStore((s) => s.sessionData)
  const showDebugOverlay = import.meta.env.VITE_SHOW_DEBUG_OVERLAY === '1'

  useEffect(() => {
    if (!sessionData) setActiveView('timing')
  }, [sessionData])

  if (bootPhase === 'welcome') {
    return <WelcomeScreen onFinish={() => setBootPhase('app')} />
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

      <main className="flex h-full flex-col pt-16">
        <div className="min-h-0 flex-1 px-4 pb-3 pt-3 xl:px-6 xl:pb-4 xl:pt-4">
          {loadingState === 'idle' && (
            <div className="glass-panel flex h-full items-center justify-center rounded-2xl text-xl text-text-secondary">
              Select a session to begin
            </div>
          )}

          {loadingState === 'loading' && (
            <div className="glass-panel flex h-full items-center justify-center gap-3 rounded-2xl text-text-secondary">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
              <span>Loading session data...</span>
            </div>
          )}

          {loadingState === 'error' && (
            <div className="glass-panel flex h-full items-center justify-center rounded-2xl text-lg text-red-300">
              {error ?? 'Failed to load session'}
            </div>
          )}

          {loadingState === 'ready' && (
            <div className="flex h-full min-h-0 gap-4 xl:gap-5">
              <Sidebar currentView={activeView} onViewChange={(view) => setActiveView(view as AppView)} />
              <div className="glass-panel min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl">
                {activeView === 'timing' && <TimingView />}
                {activeView === 'telemetry' && <TelemetryView />}
                {activeView === 'strategy' && <StrategyView />}
                {activeView === 'track' && <TrackView />}
                {activeView === 'features' && <FeaturesView />}
              </div>
            </div>
          )}
        </div>
        <PlaybackBar />
      </main>
      {showDebugOverlay && <DebugOverlay />}
    </div>
  )
}
