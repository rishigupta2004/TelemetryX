import React, { useMemo, useState } from 'react'
import { useFiaDocuments } from '../hooks/useFiaDocuments'
import { fiaTimelineBucket, formatFiaPublishedLong } from '../lib/fiaDocuments'
import { useSessionStore } from '../stores/sessionStore'
import type { FiaDocumentItem } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  stewards_decision: 'Stewards Decisions',
  race_director_note: 'Race Director Notes',
  technical_directive: 'Technical Directives',
  classification: 'Classifications',
  scrutineering: 'Scrutineering',
  entry_list: 'Entry Lists',
  other: 'Other'
}

const CATEGORY_ACCENTS: Record<string, string> = {
  stewards_decision: 'bg-rose-500/70',
  race_director_note: 'bg-amber-500/70',
  technical_directive: 'bg-violet-500/70',
  classification: 'bg-emerald-500/70',
  scrutineering: 'bg-cyan-500/70',
  entry_list: 'bg-blue-500/70',
  other: 'bg-slate-400/70'
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? titleCase(value)
}

function formatTimestamp(value: FiaDocumentItem): string {
  return formatFiaPublishedLong(value)
}

function bucketKey(value: FiaDocumentItem): string {
  return fiaTimelineBucket(value)
}

export const FiaDocumentsView = React.memo(function FiaDocumentsView() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const seasons = useSessionStore((s) => s.seasons)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const {
    activeYear,
    activeRace,
    yearOptions,
    events,
    eventsLoading,
    eventsError,
    docs: data,
    docsLoading: loading,
    docsError: error,
    setActiveYear,
    setActiveRace,
    refreshDocs
  } = useFiaDocuments({
    selectedYear,
    selectedRace,
    seasonYears: seasons.map((season) => Number(season.year))
  })

  const categoryRows = useMemo(() => {
    const entries = Object.entries(data?.category_counts ?? {})
    return entries.sort((a, b) => b[1] - a[1])
  }, [data])

  const maxCategoryCount = useMemo(() => {
    if (!categoryRows.length) return 0
    return Math.max(...categoryRows.map(([, count]) => count))
  }, [categoryRows])

  const timelineRows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const doc of data?.documents ?? []) {
      const key = bucketKey(doc)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-14)
  }, [data])

  const maxTimelineCount = useMemo(() => {
    if (!timelineRows.length) return 0
    return Math.max(...timelineRows.map(([, value]) => value))
  }, [timelineRows])

  const filteredDocs = useMemo(() => {
    const text = search.trim().toLowerCase()
    return (data?.documents ?? []).filter((doc) => {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false
      if (!text) return true
      return (
        doc.title.toLowerCase().includes(text) ||
        doc.filename.toLowerCase().includes(text) ||
        String(doc.doc_number).includes(text)
      )
    })
  }, [categoryFilter, data?.documents, search])

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 p-3 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="min-h-0 rounded-md border border-border bg-bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">FIA Documents Analytics</div>
          <div className="flex items-center gap-1.5">
            <select
              value={activeYear ?? ''}
              onChange={(event) => setActiveYear(event.target.value ? Number(event.target.value) : null)}
              className="rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-primary"
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
              className="max-w-[220px] rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] text-text-primary disabled:opacity-50"
            >
              {events.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refreshDocs(true)}
              className="rounded border border-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-secondary hover:text-text-primary"
            >
              Refresh
            </button>
          </div>
        </div>

        {eventsError && <div className="mb-2 text-xs text-red-400">{eventsError}</div>}

        {loading && <div className="text-sm text-text-secondary">Loading official FIA documents...</div>}

        {!loading && error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{error}</div>
        )}

        {!loading && !error && !data && (
          <div className="text-sm text-text-secondary">Select year and event to load FIA documents.</div>
        )}

        {!loading && !error && data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-border bg-bg-secondary p-2">
                <div className="text-[10px] uppercase text-text-muted">Event</div>
                <div className="truncate font-mono text-xs text-text-primary">{data.event_name}</div>
              </div>
              <div className="rounded border border-border bg-bg-secondary p-2">
                <div className="text-[10px] uppercase text-text-muted">Total Documents</div>
                <div className="font-mono text-lg text-text-primary">{data.total_documents}</div>
              </div>
              <div className="rounded border border-border bg-bg-secondary p-2">
                <div className="text-[10px] uppercase text-text-muted">Stewards Decisions</div>
                <div className="font-mono text-sm text-text-primary">{data.category_counts.stewards_decision ?? 0}</div>
              </div>
              <div className="rounded border border-border bg-bg-secondary p-2">
                <div className="text-[10px] uppercase text-text-muted">Race Director Notes</div>
                <div className="font-mono text-sm text-text-primary">{data.category_counts.race_director_note ?? 0}</div>
              </div>
            </div>

            <div className="rounded border border-border bg-bg-secondary p-2">
              <div className="mb-1 text-[10px] uppercase text-text-muted">Category Distribution</div>
              <div className="space-y-1.5">
                {categoryRows.map(([category, count]) => (
                  <div key={category}>
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px]">
                      <span className="truncate text-text-secondary">{categoryLabel(category)}</span>
                      <span className="font-mono text-text-muted">{count}</span>
                    </div>
                    <div className="h-2 rounded bg-bg-card">
                      <div
                        className={`h-2 rounded ${CATEGORY_ACCENTS[category] ?? 'bg-slate-400/70'}`}
                        style={{ width: `${Math.max(4, Math.round((count / Math.max(1, maxCategoryCount)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-border bg-bg-secondary p-2">
              <div className="mb-1 text-[10px] uppercase text-text-muted">Publication Timeline (Last 14 Days)</div>
              <div className="h-24">
                <div className="grid h-full grid-cols-7 gap-1">
                  {timelineRows.map(([day, count]) => (
                    <div key={day} className="flex flex-col items-center justify-end gap-1">
                      <div
                        className="w-full rounded-sm bg-accent-blue/70"
                        style={{ height: `${Math.max(8, Math.round((count / Math.max(1, maxTimelineCount)) * 90))}%` }}
                        title={`${day}: ${count}`}
                      />
                      <div className="text-[9px] text-text-muted">{day.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="min-h-0 flex flex-col rounded-md border border-border bg-bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Official Documents Feed</div>
          <div className="text-[10px] text-text-muted">
            {filteredDocs.length}/{data?.total_documents ?? 0}
          </div>
        </div>

        <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by doc title, number, or filename"
            className="rounded border border-border bg-bg-secondary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded border border-border bg-bg-secondary px-2 py-1.5 text-xs text-text-primary outline-none"
          >
            <option value="all">All Categories</option>
            {categoryRows.map(([category]) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            {filteredDocs.map((doc) => (
              <a
                key={doc.key}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded border border-border bg-bg-secondary p-2 transition hover:border-accent-blue/70 hover:bg-bg-hover/70"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-0.5 truncate font-mono text-xs text-text-primary">Doc {doc.doc_number} - {doc.title}</div>
                    <div className="truncate text-[10px] text-text-muted">{doc.filename}</div>
                  </div>
                  <span className="rounded bg-bg-card px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-text-secondary">
                    {categoryLabel(doc.category)}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">Published: {formatTimestamp(doc)}</div>
              </a>
            ))}

            {!loading && !error && filteredDocs.length === 0 && (
              <div className="rounded border border-border bg-bg-secondary p-3 text-center text-xs text-text-muted">
                No documents match this filter.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
})
