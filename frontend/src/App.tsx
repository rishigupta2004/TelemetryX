import { Suspense, lazy, useEffect, useState } from 'react'
import { DebugOverlay } from './components/DebugOverlay'
import { PlaybackBar } from './components/PlaybackBar'
import { Sidebar } from './components/Sidebar'
import SessionPicker from './components/SessionPicker'
import TopBar from './components/TopBar'
import { WelcomeScreen } from './components/WelcomeScreen'
import TimingView from './views/TimingView'
import { TelemetryView } from './views/TelemetryView'
import { BroadcastView } from './views/BroadcastView'
import { StandingsView } from './views/StandingsView'
import { ProfilesView } from './views/ProfilesView'
import { FiaDocumentsView } from './views/FiaDocumentsView'
import { useSessionStore } from './stores/sessionStore'

type AppView = 'timing' | 'telemetry' | 'strategy' | 'analytics' | 'broadcast' | 'standings' | 'profiles' | 'fiaDocs'

const StrategyView = lazy(() => import('./views/StrategyView').then((m) => ({ default: m.StrategyView })))
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })))

function ViewSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
      Loading {label}…
    </div>
  )
}

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('timing')
  const [showWelcome, setShowWelcome] = useState(true)

  const loadingState = useSessionStore((s) => s.loadingState)
  const error = useSessionStore((s) => s.error)
  const sessionData = useSessionStore((s) => s.sessionData)

  useEffect(() => {
    if (!sessionData) setActiveView('timing')
  }, [sessionData])

  const showDebugOverlay = (() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === 'true') return true
    const storage = window.localStorage as { getItem?: (key: string) => string | null } | undefined
    return typeof storage?.getItem === 'function' && storage.getItem('telemetryx.debugOverlay') === '1'
  })()

  return (
    <div className="h-dvh w-screen overflow-hidden bg-bg-primary text-text-primary">
      {showWelcome && <WelcomeScreen onFinish={() => setShowWelcome(false)} />}

      <TopBar
        error={error}
        loadingState={loadingState}
        onTogglePicker={() => setPickerOpen((v) => !v)}
        sessionData={sessionData}
      />

      <SessionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <main className="grid h-[calc(100dvh-3rem)] grid-rows-[minmax(0,1fr)_3.5rem]">
        <div className="min-h-0">
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
              <div className="flex-1 min-h-0 min-w-0 relative">
                {/* CSS-based tab persistence: keep mounted views alive, hide with display:none */}
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'timing' ? 'block' : 'none' }}>
                  <TimingView />
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'telemetry' ? 'block' : 'none' }}>
                  <TelemetryView active={activeView === 'telemetry'} />
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'strategy' ? 'block' : 'none' }}>
                  <Suspense fallback={<ViewSkeleton label="Strategy view" />}>
                    <StrategyView active={activeView === 'strategy'} />
                  </Suspense>
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'analytics' ? 'block' : 'none' }}>
                  <Suspense fallback={<ViewSkeleton label="Analytics view" />}>
                    <AnalyticsView />
                  </Suspense>
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'broadcast' ? 'block' : 'none' }}>
                  <BroadcastView />
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'standings' ? 'block' : 'none' }}>
                  <StandingsView />
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'profiles' ? 'block' : 'none' }}>
                  <ProfilesView />
                </div>
                <div className="h-full w-full min-w-0" style={{ display: activeView === 'fiaDocs' ? 'block' : 'none' }}>
                  <FiaDocumentsView />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0">
          <PlaybackBar />
        </div>
      </main>
      {showDebugOverlay && <DebugOverlay />}
    </div>
  )
}
