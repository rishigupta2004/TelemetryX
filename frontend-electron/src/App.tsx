/// <reference types="vite/client" />
import React, { lazy, memo, Suspense, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { animate, createTimeline } from 'animejs'
import { DebugOverlay } from './components/DebugOverlay'
import { ViewSkeleton } from './components/LoadingSkeleton'
import { PlaybackBar } from './components/PlaybackBar'
import { Sidebar } from './components/Sidebar'
import { ViewErrorBoundary } from './components/ViewErrorBoundary'
import { WelcomeScreen } from './components/WelcomeScreen'
import { SecurityModal } from './components/SecurityModal'
import { SecurityGate } from './components/SecurityGate'
import SessionPicker from './components/SessionPicker'
import TopBar from './components/TopBar'
import { useSessionStore } from './stores/sessionStore'
import { useUIStore } from './stores/uiStore'
import { usePlaybackTick } from './hooks/usePlaybackTick'

// ── Lazy-loaded heavy views ──────
const TimingView = lazy(() => import('./views/TimingView'))
const TelemetryView = lazy(() => import('./views/TelemetryView').then(m => ({ default: m.TelemetryView })))
const StrategyView = lazy(() => import('./views/StrategyView').then(m => ({ default: m.StrategyView })))
const TrackView = lazy(() => import('./views/TrackView').then(m => ({ default: m.TrackView })))
const FeaturesView = lazy(() => import('./views/FeaturesView').then(m => ({ default: m.FeaturesView })))
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then(m => ({ default: m.AnalyticsView })))
const StandingsView = lazy(() => import('./views/StandingsView').then(m => ({ default: m.StandingsView })))
const ProfilesView = lazy(() => import('./views/ProfilesView').then(m => ({ default: m.ProfilesView })))
const FiaDocumentsView = lazy(() => import('./views/FiaDocumentsView').then(m => ({ default: m.FiaDocumentsView })))

type AppView = 'timing' | 'telemetry' | 'strategy' | 'track' | 'features' | 'analytics' | 'standings' | 'profiles' | 'fia_documents' | 'compare'

const ViewPanel = memo(({ active, children }: { active: boolean; children: ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // View transition animations
  useEffect(() => {
    if (!containerRef.current) return
    if (active) {
      containerRef.current.style.display = 'flex'
      animate(containerRef.current, {
        opacity: [0, 1],
        translateX: [12, 0],
        duration: 220,
        ease: 'outQuad'
      })
    } else {
      animate(containerRef.current, {
        opacity: [1, 0],
        translateX: [0, -12],
        duration: 180,
        ease: 'inQuad',
        onComplete: () => {
          if (containerRef.current && !active) {
            containerRef.current.style.display = 'none'
          }
        }
      })
    }
  }, [active])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full overflow-hidden ${active ? 'gpu-layer' : ''}`}
      style={{
        display: active ? 'flex' : 'none',
        flexDirection: 'column',
        opacity: active ? 1 : 0
      }}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
})
ViewPanel.displayName = 'ViewPanel'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const activeView = useUIStore((s) => s.activeView) as AppView
  const setActiveView = useUIStore((s) => s.setActiveView)
  const mountedViews = useRef(new Set<AppView>(['timing']))

  const loadingState = useSessionStore((s) => s.loadingState)
  const error = useSessionStore((s) => s.error)
  const sessionMeta = useSessionStore((s) => s.sessionMeta)
  const drivers = useSessionStore((s) => s.drivers)
  const laps = useSessionStore((s) => s.laps)
  const showDebugOverlay = import.meta.env.VITE_SHOW_DEBUG_OVERLAY === '1'
  const wsStatus = usePlaybackTick()

  useEffect(() => {
    mountedViews.current.add(activeView)
  }, [activeView])

  useEffect(() => {
    if (!sessionMeta) setActiveView('timing')
  }, [sessionMeta, setActiveView])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: AppView }>).detail
      if (!detail?.view) return
      setActiveView(detail.view)
    }
    window.addEventListener('telemetryx:navigate', handler as EventListener)
    return () => window.removeEventListener('telemetryx:navigate', handler as EventListener)
  }, [])

  // App Boot Sequence Animation once ready
  useEffect(() => {
    if (loadingState === 'ready' && splashDone) {
      const tl = createTimeline()
      tl.add('.top-bar-anim', {
        translateY: [-44, 0],
        opacity: [0, 1],
        duration: 400,
        ease: 'outExpo'
      }, 100)
        .add('.sidebar-anim', {
          translateX: [-196, 0],
          duration: 350,
          ease: 'outExpo'
        }, 200)
        .add('.playback-bar-anim', {
          translateY: [52, 0],
          duration: 350,
          ease: 'outExpo'
        }, 400)
        .add('.content-anim', {
          opacity: [0, 1],
          duration: 300,
          ease: 'outQuad'
        }, 600)
        .add('.flag-strip-anim', {
          width: ['0%', '100%'],
          duration: 250,
          ease: 'outQuad'
        }, 800)
    }
  }, [loadingState, splashDone])

  const handleSplashFinish = useCallback(() => setSplashDone(true), [])
  const handleTogglePicker = useCallback(() => setPickerOpen((v) => !v), [])
  const handleClosePicker = useCallback(() => setPickerOpen(false), [])
  const handleViewChange = useCallback((view: string) => setActiveView(view as AppView), [setActiveView])

  if (!splashDone) {
    return <WelcomeScreen onFinish={handleSplashFinish} />
  }

  const shouldMount = (view: AppView) => mountedViews.current.has(view) || activeView === view

  return (
    <div className="h-screen w-screen bg-bg-void text-fg-primary flex flex-col overflow-hidden max-h-screen">
      {/* 3px Razor-thin Flag Status Banner */}
      <div
        className="flag-strip-anim h-[3px] w-0 bg-green-live shrink-0 origin-left z-50 fixed top-0 left-0"
        id="flag-strip"
      />

      <div className="top-bar-anim z-40 relative">
        <TopBar
          error={error}
          loadingState={loadingState}
          onTogglePicker={handleTogglePicker}
          sessionMeta={sessionMeta}
          drivers={drivers}
          laps={laps}
          wsStatus={wsStatus}
        />
      </div>

      <SessionPicker open={pickerOpen} onClose={handleClosePicker} />

      <main className="flex flex-1 min-h-0 relative z-10 pt-[44px]">
        {loadingState === 'idle' && (
          <div className="flex h-full w-full items-center justify-center text-text-heading text-fg-secondary">
            Select a session to begin
          </div>
        )}

        {loadingState === 'loading' && (
          <div className="flex h-full w-full items-center justify-center gap-3 text-fg-secondary">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-fg-ghost border-t-red-core" />
            <span className="text-body">Loading session data...</span>
          </div>
        )}

        {loadingState === 'error' && (
          <div className="flex h-full w-full items-center justify-center text-lg text-red-danger">
            {error ?? 'Failed to load session'}
          </div>
        )}

        {loadingState === 'ready' && (
          <>
            <div className="sidebar-anim translate-x-[-196px] shrink-0 h-full border-r border-border-hard bg-bg-surface">
              <Sidebar currentView={activeView} onViewChange={handleViewChange} />
            </div>

            <div className="content-anim opacity-0 flex-1 flex flex-col min-w-0 h-full relative">
              <div className="relative flex-1 min-h-0 overflow-hidden bg-bg-base">
                <Suspense fallback={<ViewSkeleton />}>
                  <ViewPanel active={activeView === 'timing'}>
                    <ViewErrorBoundary viewName="Timing">
                      <TimingView />
                    </ViewErrorBoundary>
                  </ViewPanel>
                  {shouldMount('telemetry') && (
                    <ViewPanel active={activeView === 'telemetry'}>
                      <ViewErrorBoundary viewName="Telemetry">
                        <SecurityGate view="telemetry">
                          <TelemetryView active={activeView === 'telemetry'} />
                        </SecurityGate>
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('strategy') && (
                    <ViewPanel active={activeView === 'strategy'}>
                      <ViewErrorBoundary viewName="Strategy">
                        <SecurityGate view="strategy">
                          <StrategyView active={activeView === 'strategy'} />
                        </SecurityGate>
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
                        <SecurityGate view="features">
                          <FeaturesView active={activeView === 'features'} />
                        </SecurityGate>
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('analytics') && (
                    <ViewPanel active={activeView === 'analytics'}>
                      <ViewErrorBoundary viewName="Analytics">
                        <SecurityGate view="analytics">
                          <AnalyticsView />
                        </SecurityGate>
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('standings') && (
                    <ViewPanel active={activeView === 'standings'}>
                      <ViewErrorBoundary viewName="Standings">
                        <SecurityGate view="standings">
                          <StandingsView />
                        </SecurityGate>
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('profiles') && (
                    <ViewPanel active={activeView === 'profiles'}>
                      <ViewErrorBoundary viewName="Profiles">
                        <SecurityGate view="profiles">
                          <ProfilesView />
                        </SecurityGate>
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                  {shouldMount('fia_documents') && (
                    <ViewPanel active={activeView === 'fia_documents'}>
                      <ViewErrorBoundary viewName="FIA Documents">
                        <SecurityGate view="fia_documents">
                          <FiaDocumentsView />
                        </SecurityGate>
                      </ViewErrorBoundary>
                    </ViewPanel>
                  )}
                </Suspense>
              </div>

              <div className="playback-bar-anim translate-y-[52px] shrink-0 h-[52px] border-t border-border-hard bg-bg-surface z-20 relative">
                <PlaybackBar />
              </div>
            </div>
          </>
        )}
      </main>
      <SecurityModal />
      {showDebugOverlay && <DebugOverlay />}
    </div>
  )
}
