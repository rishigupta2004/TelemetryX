import React, { useMemo } from 'react'
import { useFiaDocuments } from '../hooks/useFiaDocuments'
import { formatFiaPublishedCompact } from '../lib/fiaDocuments'
import { useSessionStore } from '../stores/sessionStore'

const ALERT_CATEGORIES = new Set(['stewards_decision', 'race_director_note', 'technical_directive'])

function categoryLabel(value: string): string {
  if (value === 'stewards_decision') return 'Stewards'
  if (value === 'race_director_note') return 'RD Note'
  if (value === 'technical_directive') return 'Tech Dir'
  return value
}


export const FiaAlertsStrip = React.memo(function FiaAlertsStrip() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const seasons = useSessionStore((s) => s.seasons)
  const {
    activeYear,
    activeRace,
    yearOptions,
    events,
    eventsLoading,
    eventsError,
    docs,
    docsLoading,
    docsError,
    setActiveYear,
    setActiveRace,
    refreshDocs
  } = useFiaDocuments({
    selectedYear,
    selectedRace,
    seasonYears: seasons.map((season) => Number(season.year)),
    autoRefreshMs: 60000
  })

  const alerts = useMemo(() => {
    return (docs?.documents ?? [])
      .filter((item) => ALERT_CATEGORIES.has(item.category))
      .slice(0, 8)
  }, [docs?.documents])

  return (
    <div className="rounded-md border border-border bg-bg-card p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">FIA Alerts</div>
          <div className="text-[11px] text-text-muted">Latest stewards / race director / technical directives</div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={activeYear ?? ''}
            onChange={(event) => setActiveYear(event.target.value ? Number(event.target.value) : null)}
            className="rounded border border-border bg-bg-secondary px-2 py-1 text-[11px] font-mono text-text-primary"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            value={activeRace}
            onChange={(event) => setActiveRace(event.target.value)}
            disabled={eventsLoading || events.length === 0}
            className="max-w-[260px] rounded border border-border bg-bg-secondary px-2 py-1 text-[11px] text-text-primary disabled:opacity-50"
          >
            {events.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refreshDocs(true)}
            className="rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-secondary transition hover:text-text-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      {eventsError && <div className="mb-1 text-xs text-red-400">{eventsError}</div>}
      {docsError && <div className="mb-1 text-xs text-red-400">{docsError}</div>}
      {docs?.fetched_at && (
        <div className="mb-1 text-[10px] text-text-muted">
          Updated {new Date(docs.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(eventsLoading || docsLoading) && (
          <div className="rounded border border-border bg-bg-secondary px-3 py-2 text-xs text-text-muted">Loading FIA alerts...</div>
        )}

        {!eventsLoading && !docsLoading && alerts.length === 0 && (
          <div className="rounded border border-border bg-bg-secondary px-3 py-2 text-xs text-text-muted">
            No alerts for this race/year selection.
          </div>
        )}

        {!eventsLoading && !docsLoading && alerts.map((item) => (
          <a
            key={`${item.key}-${item.url}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-[240px] max-w-[320px] rounded border border-border bg-bg-secondary px-2.5 py-2 transition hover:border-accent-blue/70 hover:bg-bg-hover/70"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="rounded bg-bg-card px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-text-secondary">
                {categoryLabel(item.category)}
              </span>
              <span className="text-[10px] text-text-muted">Doc {item.doc_number}</span>
            </div>
            <div className="max-h-[2.8em] overflow-hidden text-[11px] font-medium text-text-primary">{item.title}</div>
            <div className="mt-1 text-[10px] text-text-muted">{formatFiaPublishedCompact(item)}</div>
          </a>
        ))}
      </div>
    </div>
  )
})
