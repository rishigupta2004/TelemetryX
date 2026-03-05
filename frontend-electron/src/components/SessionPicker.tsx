import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useFeaturesPreloader } from '../hooks/useFeaturesPreloader'

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

export default function SessionPicker({ open, onClose }: SessionPickerProps) {
  const {
    seasons,
    races,
    sessions,
    selectedYear,
    selectedRace,
    loadingState,
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

  // Keyboard: Escape to close
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
    return races.find((race) => race.race_name === selectedRace || race.name === selectedRace) ?? null
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative z-10 w-[880px] max-w-[95vw] border border-border-hard bg-bg-surface p-5 text-text-primary panel-border"
        style={{
          animation: closing ? 'modalCardOut 0.2s ease-in forwards' : 'modalCardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.01em]">Select Session</h2>
            <p className="mt-0.5 text-xs text-text-muted">Choose year → race → session type</p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg-card text-text-muted transition-all duration-200 hover:border-accent/40 hover:text-text-primary"
            onClick={handleClose}
            type="button"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {(loadingState === 'loading' || pendingAction) && (
          <div className="mb-3 space-y-2" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-secondary border-t-accent" />
              Loading…
            </div>
            {pendingAction === 'session' && (
              <div className="rounded-lg border border-border/60 bg-bg-card/30 px-3 py-2 text-xs text-text-muted">
                <div className="mb-1 flex items-center justify-between">
                  <span>Preloading features</span>
                  <span>{loadedCount}/{totalCount}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-hover">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                {failedEndpoints.length > 0 && (
                  <div className="mt-1 text-[11px] text-amber-300">Failed: {failedEndpoints.join(', ')}</div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {/* Year column */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Year</h3>
            <div className="max-h-72 space-y-0.5 overflow-auto rounded-xl border border-border/50 bg-bg-card/30 p-2">
              {seasons.map((season, i) => (
                <button
                  key={season.year}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150 ${selectedYear === season.year
                    ? 'bg-accent/10 text-white border border-accent/20'
                    : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                    }`}
                  style={{ animationDelay: `${i * 20}ms` }}
                  onClick={() => {
                    setPendingAction('races')
                    void fetchRaces(season.year).finally(() => setPendingAction(null))
                  }}
                  type="button"
                >
                  {season.year}
                </button>
              ))}
            </div>
          </section>

          {/* Race column */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Race</h3>
            <div className="max-h-72 space-y-0.5 overflow-auto rounded-xl border border-border/50 bg-bg-card/30 p-2">
              {selectedYear === null && <div className="px-2 py-3 text-center text-xs text-text-muted">Select a year first</div>}
              {selectedYear !== null && races.length === 0 && loadingState !== 'loading' && (
                <div className="px-2 py-3 text-center text-xs text-text-muted">No races available</div>
              )}
              {races.map((race, i) => (
                <button
                  key={race.race_name ?? race.name ?? `${race.display_name}-${i}`}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${selectedRace === (race.race_name ?? race.name)
                    ? 'bg-accent/10 text-white border border-accent/20'
                    : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                    }`}
                  style={{ animation: `fadeInUp 0.2s ease-out ${i * 15}ms both` }}
                  onClick={() => {
                    if (!selectedYear) return
                    const raceKey = race.race_name ?? race.name ?? race.display_name ?? ''
                    setPendingAction('races')
                    void fetchSessions(selectedYear, raceKey).finally(() => setPendingAction(null))
                  }}
                  type="button"
                >
                  {race.display_name ?? race.race_name ?? race.name ?? 'Unknown'}
                </button>
              ))}
            </div>
          </section>

          {/* Session column */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Session</h3>
            <div className="max-h-72 space-y-1 overflow-auto rounded-xl border border-border/50 bg-bg-card/30 p-2">
              {!selectedRaceObj && <div className="px-2 py-3 text-center text-xs text-text-muted">Select a race first</div>}
              {selectedRaceObj &&
                sortSessions(sessions).map((session, i) => (
                  <button
                    key={session}
                    className="group w-full rounded-lg border border-border/40 bg-bg-secondary px-3 py-2.5 text-left transition-all duration-150 hover:border-accent/30 hover:bg-bg-hover"
                    style={{ animation: `fadeInUp 0.2s ease-out ${i * 30}ms both` }}
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
                    <div className="text-sm font-semibold text-text-primary">{session}</div>
                    <div className="text-[11px] text-text-muted">{SESSION_LABELS[session] ?? session}</div>
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
