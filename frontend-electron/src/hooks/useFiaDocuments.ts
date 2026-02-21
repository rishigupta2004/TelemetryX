import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { apiErrorText, availableEventsFromApiError, normalizeFiaText } from '../lib/fiaDocuments'
import type { FiaDocumentsResponse } from '../types'

interface UseFiaDocumentsOptions {
  selectedYear: number | null
  selectedRace: string | null
  seasonYears: number[]
  autoRefreshMs?: number
}

interface UseFiaDocumentsResult {
  activeYear: number | null
  activeRace: string
  yearOptions: number[]
  events: string[]
  eventsLoading: boolean
  eventsError: string | null
  docs: FiaDocumentsResponse | null
  docsLoading: boolean
  docsError: string | null
  setActiveYear: (value: number | null) => void
  setActiveRace: (value: string) => void
  refreshDocs: (forceRefresh?: boolean) => Promise<void>
}

export function useFiaDocuments({
  selectedYear,
  selectedRace,
  seasonYears,
  autoRefreshMs = 0
}: UseFiaDocumentsOptions): UseFiaDocumentsResult {
  const [activeYear, setActiveYear] = useState<number | null>(selectedYear ?? null)
  const [activeRace, setActiveRace] = useState<string>(selectedRace ?? '')
  const [fiaYears, setFiaYears] = useState<number[]>([])

  const [events, setEvents] = useState<string[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const [docs, setDocs] = useState<FiaDocumentsResponse | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)

  const yearOptions = useMemo(() => {
    const set = new Set<number>()
    for (const year of seasonYears) set.add(Number(year))
    for (const year of fiaYears) set.add(Number(year))
    if (selectedYear != null) set.add(Number(selectedYear))
    if (activeYear != null) set.add(Number(activeYear))
    return Array.from(set)
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)
  }, [seasonYears, fiaYears, selectedYear, activeYear])

  useEffect(() => {
    let cancelled = false
    api
      .getFiaDocumentSeasons()
      .then((payload) => {
        if (cancelled) return
        const years = (payload.seasons ?? [])
          .map((item) => Number(item.year))
          .filter((value) => Number.isFinite(value))
          .sort((a, b) => b - a)
        setFiaYears(years)
      })
      .catch((err) => {
        if (!cancelled) console.warn('FIA seasons unavailable:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedYear != null && selectedYear !== activeYear) {
      setActiveYear(selectedYear)
      setActiveRace('')
      return
    }
    if (activeYear != null) return
    if (selectedYear != null) {
      setActiveYear(selectedYear)
      return
    }
    if (yearOptions.length > 0) setActiveYear(yearOptions[0])
  }, [activeYear, selectedYear, yearOptions])

  useEffect(() => {
    if (!activeYear) {
      setEvents([])
      setActiveRace('')
      setEventsError(null)
      return
    }

    let cancelled = false
    setEventsLoading(true)
    setEventsError(null)
    api
      .getFiaDocumentEvents(activeYear)
      .then((payload) => {
        if (cancelled) return
        const nextEvents = payload.events.map((event) => event.name)
        setEvents(nextEvents)
        const preferred = nextEvents.find((event) => normalizeFiaText(event) === normalizeFiaText(selectedRace || ''))
        setActiveRace((prev) => (preferred ? preferred : prev && nextEvents.includes(prev) ? prev : nextEvents[0] ?? ''))
      })
      .catch((err) => {
        if (cancelled) return
        setEvents([])
        setActiveRace('')
        setEventsError(apiErrorText(err))
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeYear, selectedRace])

  const refreshDocs = useCallback(
    async (forceRefresh = false) => {
      if (!activeYear || !activeRace) {
        setDocs(null)
        setDocsError(null)
        return
      }
      setDocsLoading(true)
      setDocsError(null)
      try {
        const payload = await api.getFiaDocuments(activeYear, activeRace, forceRefresh)
        setDocs(payload)
      } catch (err) {
        const availableEvents = availableEventsFromApiError(err)
        if (availableEvents.length > 0) {
          setEvents(availableEvents)
          setActiveRace((prev) => {
            if (prev && availableEvents.includes(prev)) return prev
            const preferred = availableEvents.find((event) => normalizeFiaText(event) === normalizeFiaText(selectedRace || ''))
            return preferred || availableEvents[0] || ''
          })
        }
        setDocs(null)
        setDocsError(apiErrorText(err))
      } finally {
        setDocsLoading(false)
      }
    },
    [activeYear, activeRace, selectedRace]
  )

  useEffect(() => {
    void refreshDocs(false)
  }, [refreshDocs])

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0 || !activeYear || !activeRace) return
    const id = window.setInterval(() => {
      void refreshDocs(true)
    }, autoRefreshMs)
    return () => window.clearInterval(id)
  }, [autoRefreshMs, activeYear, activeRace, refreshDocs])

  return {
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
  }
}
