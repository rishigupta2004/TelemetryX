import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
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
    <div className={`animate-pulse border border-border-micro bg-bg-surface/50 ${className}`}>
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
    </div>
  )
}

function SessionItemSkeleton() {
  return (
    <div className="flex items-center gap-4 border-l-2 border-border-soft bg-bg-surface/30 p-4">
      <SkeletonItem className="h-12 w-12" />
      <div className="flex-1 space-y-3">
        <SkeletonItem className="h-4 w-32" />
        <SkeletonItem className="h-2 w-20" />
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

  const sortedRaces = useMemo(() => {
    return [...races].sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
  }, [races])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-ui"
      style={{
        animation: closing ? 'modalOverlayOut 0.2s ease-in forwards' : 'modalOverlayIn 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      {/* Heavy Cinematic Backdrop */}
      <div className="absolute inset-0 bg-bg-void/90 backdrop-blur-xl" />
      <div className="absolute inset-0 z-[1] opacity-[0.05] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPg==')]" />
      
      {/* Intense Accent Glows */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-red-core/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] bg-red-core/5 blur-[150px] pointer-events-none" />

      {/* Terminal Modal Window */}
      <div
        className="relative z-10 w-[1080px] max-w-[95vw]"
        style={{
          animation: closing ? 'modalCardOut 0.2s ease-in forwards' : 'modalCardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="relative border border-red-core/30 bg-bg-panel/95 shadow-[0_0_50px_rgba(225,6,0,0.15)] overflow-hidden">
          
          {/* Tactical Header Overlay */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-core/0 via-red-core to-red-core/0 shadow-[0_0_15px_#e10600]" />
          <div className="absolute -top-[10px] -left-[10px] w-[40px] h-[40px] border-t-2 border-l-2 border-red-core/50" />
          <div className="absolute -top-[10px] -right-[10px] w-[40px] h-[40px] border-t-2 border-r-2 border-red-core/50" />
          <div className="absolute -bottom-[10px] -left-[10px] w-[40px] h-[40px] border-b-2 border-l-2 border-red-core/50" />
          <div className="absolute -bottom-[10px] -right-[10px] w-[40px] h-[40px] border-b-2 border-r-2 border-red-core/50" />

          <div className="relative p-8 px-10">
            {/* Header section */}
            <div className="mb-8 flex items-end justify-between border-b border-border/50 pb-4">
              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center bg-red-core/10 border border-red-core/30 shadow-[0_0_15px_rgba(225,6,0,0.2)]">
                  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="drop-shadow-[0_0_8px_#e10600]">
                    <path d="M4 24L10 8L16 20L22 12L28 24" stroke="#e10600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black uppercase italic tracking-widest text-fg-primary drop-shadow-md">
                    SESSION <span className="text-red-core drop-shadow-[0_0_8px_rgba(225,6,0,0.5)]">SELECTOR</span>
                  </h2>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-red-core/80">
                    <span className="h-1 w-1 bg-red-core animate-pulse" /> TARGET ACQUISITION
                  </div>
                </div>
              </div>
              
              <button
                className="group relative flex h-10 w-10 items-center justify-center border border-border-soft bg-bg-surface text-fg-muted transition-all duration-300 hover:border-red-core/50 hover:bg-red-core/10 hover:text-red-core hover:shadow-[0_0_15px_rgba(225,6,0,0.3)]"
                onClick={handleClose}
                type="button"
                title="Abort (Esc)"
              >
                <div className="absolute inset-0 bg-red-core/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <svg className="h-5 w-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Loading / Overlays */}
            {(loadingState === 'loading' || pendingAction) && (
              <div className="mb-6 border border-red-core/20 bg-red-core/5 p-4 backdrop-blur-sm shadow-[inset_0_0_20px_rgba(225,6,0,0.1)]">
                <div className="flex items-center gap-4 text-sm text-red-core">
                  <div className="h-5 w-5 border-2 border-red-core/30 border-t-red-core animate-spin rounded-full shadow-[0_0_8px_#e10600]" />
                  <span className="font-mono font-bold tracking-widest uppercase">Fetching Central Uplink...</span>
                </div>
                
                {pendingAction === 'session' && (
                  <div className="mt-4 border-t border-red-core/20 pt-4">
                    <div className="mb-2 flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-widest text-fg-primary">
                      <span>Syncing telemetry stream</span>
                      <span className="text-red-core animate-pulse">ENGAGED</span>
                    </div>
                    
                    {/* Aggressive Data Progress Bar */}
                    <div className="relative h-1.5 w-full overflow-hidden bg-bg-surface border border-border">
                      <div
                        className="absolute inset-y-0 left-0 bg-red-core shadow-[0_0_12px_#e10600] transition-all duration-500 ease-out"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="mt-2 text-[10px] font-mono tracking-widest text-fg-muted/60 uppercase">
                      // BYPASSING CACHE - ESTABLISHING PIPELINE
                    </div>
                  </div>
                )}
              </div>
            )}

            {apiError && (
              <div className="mb-6 flex items-start gap-4 border border-red-core/50 bg-red-core/20 p-4 shadow-[0_0_15px_rgba(225,6,0,0.3)] backdrop-blur-md">
                <span className="text-xl text-white">⚠</span>
                <div>
                  <div className="font-mono text-sm font-bold text-white tracking-widest uppercase">Uplink Failure</div>
                  <div className="mt-1 font-mono text-xs text-white/80">{apiError.message}</div>
                </div>
              </div>
            )}

            {/* Three Pillar Selection Interface */}
            <div className="grid grid-cols-3 gap-8">
              {/* Year Pillar */}
              <section className="group relative border-r border-border/50 pr-8">
                <h3 className="mb-4 flex items-center gap-3 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-fg-muted">
                  <div className="flex h-5 w-5 items-center justify-center border border-border-soft bg-bg-surface text-fg-primary">
                    1
                  </div>
                  <span>Campaign</span>
                </h3>
                
                <div className="scrollbar-custom max-h-[450px] space-y-2 overflow-auto pr-2">
                  {seasons.length === 0 && pendingAction === 'seasons' ? (
                    Array.from({ length: 5 }).map((_, i) => <SessionItemSkeleton key={i} />)
                  ) : (
                    seasons.map((season, i) => {
                      const isSelected = selectedYear === season.year;
                      return (
                        <button
                          key={season.year}
                          className={`relative w-full border-l-4 px-5 py-4 text-left font-display text-lg font-bold transition-all duration-200 ${
                            isSelected
                              ? 'border-red-core bg-red-core/15 text-white shadow-[inset_20px_0_40px_-20px_rgba(225,6,0,0.3)]'
                              : 'border-transparent bg-bg-surface/30 text-fg-secondary hover:border-red-core/30 hover:bg-bg-surface hover:text-fg-primary'
                          }`}
                          style={{ animation: `fadeInUp 0.3s ease-out ${i * 30}ms both` }}
                          onClick={() => {
                            setPendingAction('races')
                            void fetchRaces(season.year).finally(() => setPendingAction(null))
                          }}
                          type="button"
                        >
                          {isSelected && <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-red-core/10 to-transparent" />}
                          <span className={`${isSelected ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : ''}`}>{season.year}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </section>

              {/* Race Pillar */}
              <section className="group relative border-r border-border/50 pr-8">
                <h3 className="mb-4 flex items-center gap-3 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-fg-muted">
                  <div className="flex h-5 w-5 items-center justify-center border border-border-soft bg-bg-surface text-fg-primary">
                    2
                  </div>
                  <span>Location Drop</span>
                </h3>
                
                <div className="scrollbar-custom max-h-[450px] space-y-2 overflow-auto pr-2">
                  {selectedYear === null && (
                    <div className="flex h-[200px] flex-col items-center justify-center border border-dashed border-border-soft bg-bg-surface/20 text-center">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-fg-muted uppercase">Awaiting Campaign</div>
                    </div>
                  )}
                  {selectedYear !== null && races.length === 0 && loadingState !== 'loading' && !pendingAction && (
                    <div className="flex h-[200px] flex-col items-center justify-center border border-dashed border-red-500/20 bg-red-500/5 text-center text-red-500/70">
                      <div className="font-mono text-[10px] font-bold tracking-widest uppercase">No Intel Available</div>
                    </div>
                  )}
                  {selectedYear !== null && (races.length === 0 || pendingAction === 'races') && (
                    Array.from({ length: 7 }).map((_, i) => <SessionItemSkeleton key={i} />)
                  )}
                  
                  {sortedRaces.map((race, i) => {
                    const isSelected = selectedRace === (race.race_name ?? race.name);
                    return (
                      <button
                        key={race.race_name ?? race.name ?? `${race.display_name}-${i}`}
                        className={`group/item relative w-full border-l-4 px-5 py-4 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-[#00E5FF] bg-[#00E5FF]/15 shadow-[inset_20px_0_40px_-20px_rgba(0,229,255,0.2)]'
                            : 'border-transparent bg-bg-surface/30 hover:border-[#00E5FF]/30 hover:bg-bg-surface'
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
                        {isSelected && <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-[#00E5FF]/10 to-transparent" />}
                        <div className={`font-display text-[15px] font-bold leading-tight ${isSelected ? 'text-white drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]' : 'text-fg-secondary group-hover/item:text-fg-primary'}`}>
                          {race.display_name ?? race.race_name ?? race.name ?? 'UNKNOWN'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Session Pillar */}
              <section className="group relative">
                <h3 className="mb-4 flex items-center gap-3 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-fg-muted">
                  <div className="flex h-5 w-5 items-center justify-center border border-border-soft bg-bg-surface text-fg-primary">
                    3
                  </div>
                  <span>Stream Vector</span>
                </h3>
                
                <div className="scrollbar-custom max-h-[450px] space-y-2 overflow-auto pr-2">
                  {!selectedRaceObj && (
                    <div className="flex h-[200px] flex-col items-center justify-center border border-dashed border-border-soft bg-bg-surface/20 text-center">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-fg-muted uppercase">Lock Location Drop First</div>
                    </div>
                  )}
                  {selectedRaceObj && sessions.length === 0 && (
                     Array.from({ length: 4 }).map((_, i) => <SessionItemSkeleton key={i} />)
                  )}
                  {selectedRaceObj && sortSessions(sessions).map((session, i) => (
                      <button
                        key={session}
                        className="group/item relative w-full border-y border-transparent border-l-4 px-5 py-4 text-left bg-bg-surface/30 transition-all duration-300 hover:border-l-red-core hover:border-y-red-core/30 hover:bg-red-core/10 hover:shadow-[0_0_20px_rgba(225,6,0,0.2)]"
                        style={{ animation: `fadeInUp 0.3s ease-out ${i * 40}ms both` }}
                        onClick={() => {
                          if (!selectedYear || !selectedRaceObj) return
                          setPendingAction('session')
                          const raceKey = selectedRaceObj.race_name ?? selectedRaceObj.name ?? ''
                          handleClose()
                          void loadSession(selectedYear, raceKey, session)
                            .finally(() => setPendingAction(null))
                        }}
                        type="button"
                      >
                        <div className="relative z-10 flex items-center justify-between">
                          <div>
                            <div className="font-display text-2xl font-black italic tracking-tighter text-fg-primary transition-all duration-300 group-hover/item:text-white group-hover/item:drop-shadow-[0_0_10px_rgba(225,6,0,0.8)]">
                              {session}
                            </div>
                            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-fg-muted mt-1 transition-colors duration-300 group-hover/item:text-red-core/80">
                              {SESSION_LABELS[session] ?? session}
                            </div>
                          </div>
                          
                          <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-transparent bg-transparent opacity-0 transition-all duration-300 group-hover/item:border-red-core/50 group-hover/item:bg-red-core/20 group-hover/item:opacity-100">
                            <span className="font-mono text-sm font-bold text-red-core">G</span>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="sr-only" aria-hidden="true">
        Session picker animations loaded
      </div>
    </div>
  )
}
