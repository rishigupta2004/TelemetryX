import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'

interface SessionPickerProps {
  open: boolean
  onClose: () => void
}

const SESSION_PRIORITY = ['R', 'Q', 'S', 'SR', 'FP1', 'FP2', 'FP3']

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
    selectedYear,
    selectedRace,
    loadingState,
    fetchSeasons,
    fetchRaces,
    loadSession
  } = useSessionStore()

  const [pendingAction, setPendingAction] = useState<'seasons' | 'races' | 'session' | null>(null)

  useEffect(() => {
    if (!open) return
    void (async () => {
      if (seasons.length === 0) {
        setPendingAction('seasons')
        await fetchSeasons()
        setPendingAction(null)
      }
    })()
  }, [open, seasons.length, fetchSeasons])

  const selectedRaceObj = useMemo(
    () => races.find((race) => race.name === selectedRace) ?? null,
    [races, selectedRace]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[840px] max-w-[95vw] rounded-lg border border-border bg-bg-secondary p-4 text-text-primary">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Select Session</h2>
          <button
            className="rounded-sm bg-bg-hover px-3 py-1 text-sm hover:opacity-90"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {(loadingState === 'loading' || pendingAction) && (
          <div className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
            Loading...
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <section>
            <h3 className="mb-2 text-sm text-text-secondary">Year</h3>
            <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border p-2">
              {seasons.map((season) => (
                <button
                  key={season.year}
                  className={`w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-bg-hover ${
                    selectedYear === season.year ? 'bg-bg-selected' : ''
                  }`}
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

          <section>
            <h3 className="mb-2 text-sm text-text-secondary">Race</h3>
            <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border p-2">
              {selectedYear === null && <div className="text-sm text-text-muted">Select a year first</div>}
              {selectedYear !== null && races.length === 0 && loadingState !== 'loading' && (
                <div className="text-sm text-text-muted">No races available</div>
              )}
              {races.map((race) => (
                <button
                  key={race.name}
                  className={`w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-bg-hover ${
                    selectedRace === race.name ? 'bg-bg-selected' : ''
                  }`}
                  onClick={() => useSessionStore.setState({ selectedRace: race.name, selectedSession: null })}
                  type="button"
                >
                  {race.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm text-text-secondary">Session</h3>
            <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border p-2">
              {!selectedRaceObj && <div className="text-sm text-text-muted">Select a race first</div>}
              {selectedRaceObj &&
                sortSessions(selectedRaceObj.sessions).map((session) => (
                  <button
                    key={session}
                    className="w-full rounded-sm border border-border px-2 py-1 text-left text-sm hover:bg-bg-hover"
                    onClick={() => {
                      if (!selectedYear || !selectedRaceObj) return
                      setPendingAction('session')
                      void loadSession(selectedYear, selectedRaceObj.name, session).then(() => {
                        const state = useSessionStore.getState()
                        if (state.loadingState === 'ready') onClose()
                      }).finally(() => setPendingAction(null))
                    }}
                    type="button"
                  >
                    {session}
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
