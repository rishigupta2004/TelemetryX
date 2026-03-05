/// <reference types="vite/client" />
import React, { lazy, memo, Suspense, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { DebugOverlay } from './components/DebugOverlay'
import { ViewSkeleton } from './components/LoadingSkeleton'
import { PlaybackBar } from './components/PlaybackBar'
import { Sidebar } from './components/Sidebar'
import { ViewErrorBoundary } from './components/ViewErrorBoundary'
import { WelcomeScreen } from './components/WelcomeScreen'
import SessionPicker from './components/SessionPicker'
import TopBar from './components/TopBar'
import { useSessionStore } from './stores/sessionStore'

// ── Lazy-loaded heavy views (code-split into separate chunks) ──────
const TimingView = lazy(() => import('./views/TimingView'))
const TelemetryView = lazy(() => import('./views/TelemetryView').then(m => ({ default: m.TelemetryView })))
const StrategyView = lazy(() => import('./views/StrategyView').then(m => ({ default: m.StrategyView })))
const TrackView = lazy(() => import('./views/TrackView').then(m => ({ default: m.TrackView })))
const FeaturesView = lazy(() => import('./views/FeaturesView').then(m => ({ default: m.FeaturesView })))

type AppView = 'timing' | 'telemetry' | 'strategy' | 'track' | 'features'

// ── Deferred mount: only mount a view once it's been activated ──────
const ViewPanel = memo(({ active, children }: { active: boolean; children: ReactNode }) => (
  <div
    className={`absolute inset-0 h-full w-full overflow-hidden ${active ? 'gpu-layer' : ''}`}
    style={{
      display: active ? 'flex' : 'none',
      flexDirection: 'column'
    }}
    aria-hidden={!active}
  >
    {children}
  </div>
))
ViewPanel.displayName = 'ViewPanel'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('timing')
  // Track which views have been mounted (deferred mount pattern)
  const mountedViews = useRef(new Set<AppView>(['timing']))

  const loadingState = useSessionStore((s) => s.loadingState)
  const error = useSessionStore((s) => s.error)
  const sessionData = useSessionStore((s) => s.sessionData)
  const showDebugOverlay = import.meta.env.VITE_SHOW_DEBUG_OVERLAY === '1'

  // Mark view as mounted when activated
  useEffect(() => {
    mountedViews.current.add(activeView)
  }, [activeView])

  useEffect(() => {
    if (!sessionData) setActiveView('timing')
  }, [sessionData])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: AppView }>).detail
      if (!detail?.view) return
      setActiveView(detail.view)
    }
    window.addEventListener('telemetryx:navigate', handler as EventListener)
    return () => window.removeEventListener('telemetryx:navigate', handler as EventListener)
  }, [])

  const handleSplashFinish = useCallback(() => setSplashDone(true), [])
  const handleTogglePicker = useCallback(() => setPickerOpen((v) => !v), [])
  const handleClosePicker = useCallback(() => setPickerOpen(false), [])
  const handleViewChange = useCallback((view: string) => setActiveView(view as AppView), [])

  // ── Splash screen gate ──
  if (!splashDone) {
    return <WelcomeScreen onFinish={handleSplashFinish} />
  }

  const shouldMount = (view: AppView) => mountedViews.current.has(view) || activeView === view

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary">
      <TopBar
        error={error}
        loadingState={loadingState}
        onTogglePicker={handleTogglePicker}
        sessionData={sessionData}
      />

      <SessionPicker open={pickerOpen} onClose={handleClosePicker} />

      <main className="flex h-full flex-col pt-14">
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
              <Sidebar currentView={activeView} onViewChange={handleViewChange} />
              <div className="glass-panel contain-layout relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl">
                <Suspense fallback={<ViewSkeleton />}>
                  <ViewPanel active={activeView === 'timing'}>
                    <ViewErrorBoundary viewName="Timing">
                      <TimingView />
                    </ViewErrorBoundary>
                  </ViewPanel>
                  {shouldMount('telemetry') && (
                    <ViewPanel active={activeView === 'telemetry'}>
                      <ViewErrorBoundary viewName="Telemetry">
                        <TelemetryView active={activeView === 'telemetry'} />
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('strategy') && (
                    <ViewPanel active={activeView === 'strategy'}>
                      <ViewErrorBoundary viewName="Strategy">
                        <StrategyView active={activeView === 'strategy'} />
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('track') && (
                    <ViewPanel active={activeView === 'track'}>
                      <ViewErrorBoundary viewName="Track">
                        <TrackView />
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('features') && (
                    <ViewPanel active={activeView === 'features'}>
                      <ViewErrorBoundary viewName="Features">
                        <FeaturesView active={activeView === 'features'} />
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                </Suspense>
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
