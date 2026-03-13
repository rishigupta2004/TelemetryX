import React, { lazy, Suspense, useEffect, useState } from 'react'
import SessionPicker from './components/SessionPicker'
import { useSessionStore } from './stores/sessionStore'

type AppView = 'timing' | 'telemetry' | 'strategy' | 'simulation' | 'track' | 'features' | 'analytics' | 'standings' | 'profiles' | 'fia_documents'

const lazyComponents = {
  timing: lazy(() => import('./views/TimingView')),
  telemetry: lazy(() => import('./views/TelemetryView').then(m => ({ default: m.TelemetryView }))),
  strategy: lazy(() => import('./views/StrategyView').then(m => ({ default: m.StrategyView }))),
  simulation: lazy(() => import('./views/SimulationView').then(m => ({ default: m.SimulationView }))),
  track: lazy(() => import('./views/TrackView').then(m => ({ default: m.TrackView }))),
  features: lazy(() => import('./views/FeaturesView').then(m => ({ default: m.FeaturesView }))),
  analytics: lazy(() => import('./views/AnalyticsView').then(m => ({ default: m.AnalyticsView }))),
  standings: lazy(() => import('./views/StandingsView').then(m => ({ default: m.StandingsView }))),
  profiles: lazy(() => import('./views/ProfilesView').then(m => ({ default: m.ProfilesView }))),
  fia_documents: lazy(() => import('./views/FiaDocumentsView').then(m => ({ default: m.FiaDocumentsView })))
} as Record<AppView, React.ComponentType<{ active?: boolean }>>

const VIEW_ORDER: AppView[] = ['timing', 'telemetry', 'strategy', 'simulation', 'track', 'features', 'analytics', 'standings', 'profiles', 'fia_documents']

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-black text-white">
      <span>Loading...</span>
    </div>
  )
}

function NavButton({ view, active, onClick }: { view: AppView; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm ${active ? 'bg-blue-600' : 'bg-gray-800'} text-white rounded`}
    >
      {view}
    </button>
  )
}

interface AppProps {
  onSignOut?: (() => void | Promise<void>) | null
}

export default function App({ onSignOut = null }: AppProps) {
  const [activeView, setActiveView] = useState<AppView>('timing')
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false)
  const selectedSession = useSessionStore((s) => s.selectedSession)

  const handleViewChange = (view: AppView) => {
    setActiveView(view)
  }

  useEffect(() => {
    if (!selectedSession) {
      setSessionPickerOpen(true)
    }
  }, [selectedSession])

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col">
      {/* Simple Nav */}
      <nav className="flex flex-wrap items-center gap-2 p-2 bg-gray-900 border-b border-gray-700">
        {VIEW_ORDER.map(view => (
          <NavButton
            key={view}
            view={view}
            active={activeView === view}
            onClick={() => handleViewChange(view)}
          />
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSessionPickerOpen(true)}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-gray-300 hover:bg-gray-700"
          >
            Session
          </button>
          <div className="ml-1">
            {onSignOut && (
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="px-3 py-2 text-sm bg-gray-800 text-white rounded border border-gray-700"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          {VIEW_ORDER.map(viewId => {
            const Component = lazyComponents[viewId]
            const isActive = activeView === viewId
            return (
              <div
                key={viewId}
                className="h-full w-full"
                style={{ display: isActive ? 'block' : 'none' }}
              >
                {isActive && <Component active={isActive} />}
              </div>
            )
          })}
        </Suspense>
      </div>

      <SessionPicker open={sessionPickerOpen} onClose={() => setSessionPickerOpen(false)} />
    </div>
  )
}
