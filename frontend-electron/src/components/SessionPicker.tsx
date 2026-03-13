import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useFeaturesPreloader } from '../hooks/useFeaturesPreloader'
import { normalizeKey } from '../api/sessions'

interface SessionPickerProps {
  open: boolean
  onClose: () => void
}

const SESSION_PRIORITY = ['R', 'Q', 'S', 'SR', 'FP1', 'FP2', 'FP3']

const SESSION_LABELS: Record<string, string> = {
  R: 'Race',
  Q: 'Qualifying',
  S: 'Sprint',
  SR: 'Sprint Race',
  FP1: 'Practice 1',
  FP2: 'Practice 2',
  FP3: 'Practice 3',
}

function sortSessions(sessions: string[]): string[] {
  return [...sessions].sort((a, b) => {
    const ai = SESSION_PRIORITY.indexOf(a)
    const bi = SESSION_PRIORITY.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function SkeletonItem({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/5 ${className}`}>
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
    </div>
  )
}

function SessionItemSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <SkeletonItem className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <SkeletonItem className="h-3 w-24 rounded" />
        <SkeletonItem className="h-2 w-16 rounded" />
      </div>
    </div>
  )
}

export default function SessionPicker({ open, onClose }: SessionPickerProps) {
  const {
    seasons,
    races,
    sessions,
    selectedYear,
    selectedRace,
    loadingState,
    apiError,
    fetchSeasons,
    fetchRaces,
    fetchSessions,
    loadSession
  } = useSessionStore()
  const { preload, loadedCount, totalCount, progress, failedEndpoints } = useFeaturesPreloader()

  const [pendingAction, setPendingAction] = useState<'seasons' | 'races' | 'session' | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    setClosing(false)
    void (async () => {
      if (seasons.length === 0) {
        setPendingAction('seasons')
        await fetchSeasons()
        setPendingAction(null)
      }
    })()
  }, [open, seasons.length, fetchSeasons])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  const selectedRaceObj = useMemo(() => {
    if (!selectedRace) return null
    const normalizedSelected = normalizeKey(selectedRace)
    return races.find((race) => {
      const raceName = race.race_name ?? race.name ?? ''
      const displayName = race.display_name ?? ''
      return normalizeKey(raceName) === normalizedSelected ||
             normalizeKey(displayName) === normalizedSelected ||
             raceName === selectedRace ||
             displayName === selectedRace
    }) ?? null
  }, [races, selectedRace])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        animation: closing ? 'modalOverlayOut 0.2s ease-in forwards' : 'modalOverlayIn 0.25s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      {/* Backdrop with enhanced glassmorphism */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" />
      
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Modal */}
      <div
        className="relative z-10 w-[920px] max-w-[95vw] rounded-3xl p-1"
        style={{
          animation: closing ? 'modalCardOut 0.2s ease-in forwards' : 'modalCardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Gradient border container */}
        <div className="relative rounded-3xl bg-gradient-to-br from-white/20 via-white/10 to-white/5 p-[1px]">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/30 via-transparent to-purple-500/20 opacity-50" />
          
          {/* Inner modal content */}
          <div
            className="relative rounded-[22px] border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl p-6 shadow-2xl"
            style={{
              boxShadow: `
                0 0 80px -20px rgba(99, 102, 241, 0.3),
                0 30px 60px -20px rgba(139, 92, 246, 0.15),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset,
                0 20px 40px -10px rgba(0, 0, 0, 0.5)
              `
            }}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="relative">
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-white">
                  <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                    Select Session
                  </span>
                </h2>
                <p className="mt-1.5 text-sm text-text-muted/70">Choose year → race → session type</p>
                
                {/* Animated underline */}
                <div className="absolute -bottom-1 left-0 h-0.5 w-0 animate-underline-expand bg-gradient-to-r from-accent to-purple-400 rounded-full" />
              </div>
              
              <button
                className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-text-muted transition-all duration-300 hover:border-accent/50 hover:bg-accent/20 hover:text-white hover:scale-110 hover:shadow-lg hover:shadow-accent/25"
                onClick={handleClose}
                type="button"
                title="Close (Esc)"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <svg className="h-5 w-5 relative z-10 transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Loading states */}
            {(loadingState === 'loading' || pendingAction) && (
              <div className="mb-4 space-y-3" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                <div className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-secondary border-t-accent" />
                  <span className="font-medium">Loading…</span>
                </div>
                
                {pendingAction === 'session' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">Preloading features</span>
                      <span className="text-sm font-semibold text-accent">{loadedCount}/{totalCount}</span>
                    </div>
                    
                    {/* Enhanced progress bar */}
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div 
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent via-purple-400 to-accent transition-all duration-500 ease-out"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                      </div>
                      {/* Progress shimmer effect */}
                      <div 
                        className="absolute inset-0 -translate-x-full animate-shimmer-progress bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ width: '100%' }}
                      />
                    </div>
                    
                    {failedEndpoints.length > 0 && (
                      <div className="mt-2 text-xs text-amber-400/80 flex items-center gap-1.5">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Failed: {failedEndpoints.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {apiError && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-sm">
                <span className="font-semibold">Error:</span> {apiError.message}
              </div>
            )}

            <div className="grid grid-cols-3 gap-5">
              {/* Year column */}
              <section className="group">
                <h3 className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-text-muted/60">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                    <svg className="h-4 w-4 text-accent/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span>Year</span>
                </h3>
                <div className="scrollbar-custom max-h-80 space-y-1.5 overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
                  {seasons.length === 0 && pendingAction === 'seasons' ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <SessionItemSkeleton key={i} />
                    ))
                  ) : (
                    seasons.map((season, i) => (
                      <button
                        key={season.year}
                        className={`group/item relative w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition-all duration-300 ${
                          selectedYear === season.year
                            ? 'bg-gradient-to-r from-accent/30 via-accent/20 to-purple-500/20 text-white border border-accent/40 shadow-lg shadow-accent/20'
                            : 'text-text-secondary hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
                        }`}
                        style={{ 
                          animation: `fadeInUp 0.3s ease-out ${i * 30}ms both`,
                        }}
                        onClick={() => {
                          setPendingAction('races')
                          void fetchRaces(season.year).finally(() => setPendingAction(null))
                        }}
                        type="button"
                      >
                        {/* Glow effect for selected */}
                        {selectedYear === season.year && (
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/20 to-purple-500/20 blur-xl transition-all duration-300 group-hover/item:blur-2xl" />
                        )}
                        <span className="relative z-10">{season.year}</span>
                      </button>
                    ))
                  )}
                </div>
              </section>

              {/* Race column */}
              <section className="group">
                <h3 className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-text-muted/60">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                    <svg className="h-4 w-4 text-amber-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span>Race</span>
                </h3>
                <div className="scrollbar-custom max-h-80 space-y-1.5 overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
                  {selectedYear === null && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                        <svg className="h-6 w-6 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-sm text-text-muted/50">Select a year first</div>
                    </div>
                  )}
                  {selectedYear !== null && races.length === 0 && loadingState !== 'loading' && !pendingAction && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                        <svg className="h-6 w-6 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-sm text-text-muted/50">No races available</div>
                    </div>
                  )}
                  {selectedYear !== null && (races.length === 0 || pendingAction === 'races') && (
                    Array.from({ length: 6 }).map((_, i) => (
                      <SessionItemSkeleton key={i} />
                    ))
                  )}
                  {races.map((race, i) => (
                    <button
                      key={race.race_name ?? race.name ?? `${race.display_name}-${i}`}
                      className={`group/item relative w-full rounded-xl px-4 py-3.5 text-left text-sm transition-all duration-300 ${
                        selectedRace === (race.race_name ?? race.name)
                          ? 'bg-gradient-to-r from-accent/30 via-accent/20 to-purple-500/20 text-white border border-accent/40 shadow-lg shadow-accent/20'
                          : 'text-text-secondary hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
                      }`}
                      style={{ animation: `fadeInUp 0.3s ease-out ${i * 25}ms both` }}
                      onClick={() => {
                        if (!selectedYear) return
                        const raceKey = race.race_name ?? race.name ?? race.display_name ?? ''
                        setPendingAction('races')
                        void fetchSessions(selectedYear, raceKey).finally(() => setPendingAction(null))
                      }}
                      type="button"
                    >
                      {selectedRace === (race.race_name ?? race.name) && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/20 to-purple-500/20 blur-xl transition-all duration-300 group-hover/item:blur-2xl" />
                      )}
                      <span className="relative z-10 font-medium">{race.display_name ?? race.race_name ?? race.name ?? 'Unknown'}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Session column */}
              <section className="group">
                <h3 className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-text-muted/60">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                    <svg className="h-4 w-4 text-green-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <span>Session</span>
                </h3>
                <div className="scrollbar-custom max-h-80 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
                  {!selectedRaceObj && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                        <svg className="h-6 w-6 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                      </div>
                      <div className="text-sm text-text-muted/50">Select a race first</div>
                      <div className="mt-2 text-xs text-text-muted/30">↑ or use ↑↓ keys to navigate</div>
                    </div>
                  )}
                  {selectedRaceObj && sessions.length === 0 && (
                    Array.from({ length: 4 }).map((_, i) => (
                      <SessionItemSkeleton key={i} />
                    ))
                  )}
                  {selectedRaceObj &&
                    sortSessions(sessions).map((session, i) => (
                      <button
                        key={session}
                        className="group/item relative w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-left transition-all duration-300 hover:border-accent/40 hover:bg-white/10 hover:shadow-lg hover:shadow-accent/10"
                        style={{ animation: `fadeInUp 0.3s ease-out ${i * 40}ms both` }}
                        onClick={() => {
                          if (!selectedYear || !selectedRaceObj) return
                          setPendingAction('session')
                          const raceKey = selectedRaceObj.race_name ?? selectedRaceObj.name ?? ''
                          void Promise.allSettled([
                            preload(selectedYear, raceKey, session),
                            loadSession(selectedYear, raceKey, session)
                          ]).then(() => {
                            const state = useSessionStore.getState()
                            if (state.loadingState === 'ready') handleClose()
                          }).finally(() => setPendingAction(null))
                        }}
                        type="button"
                      >
                        <div className="relative z-10">
                          <div className="text-sm font-bold text-text-primary transition-colors duration-200 group-hover/item:text-white">
                            {session}
                          </div>
                          <div className="text-xs text-text-muted/60 mt-0.5 transition-colors duration-200 group-hover/item:text-text-muted">
                            {SESSION_LABELS[session] ?? session}
                          </div>
                        </div>
                        {/* Arrow indicator */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover/item:translate-x-1 group-hover/item:opacity-100">
                          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes shimmer-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes underline-expand {
          from { width: 0; }
          to { width: 60%; }
        }

        @keyframes gradient {
          0% { background-position: 0% center; }
          50% { background-position: 100% center; }
          100% { background-position: 0% center; }
        }

        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }

        .animate-shimmer-progress {
          animation: shimmer-progress 1s infinite linear;
        }

        .animate-underline-expand {
          animation: underline-expand 0.5s ease-out 0.3s forwards;
          width: 0;
        }

        .animate-gradient {
          animation: gradient 3s ease infinite;
          background-size: 200% auto;
        }

        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }

        .scrollbar-custom::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .scrollbar-custom::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  )
}
