import { ApiError } from '../api/client'
import type { FiaDocumentItem } from '../types'

export const normalizeFiaText = (value: string): string => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const availableEventsFromApiError = (err: unknown): string[] => {
  if (!(err instanceof ApiError) || !err.detail || typeof err.detail !== 'object') return []
  const detail = err.detail as { available_events?: unknown }
  if (!Array.isArray(detail.available_events)) return []
  return detail.available_events.map((item) => String(item)).filter(Boolean)
}

export const apiErrorText = (err: unknown): string => {
  if (err instanceof ApiError && err.status === 404) {
    return 'No FIA documents are available for the selected season/event.'
  }
  if (err instanceof ApiError && err.detail && typeof err.detail === 'object') {
    const detailMessage = (err.detail as { message?: unknown }).message
    if (typeof detailMessage === 'string' && detailMessage.trim()) return detailMessage
  }
  return String(err)
}

const parseFiaPublishedDate = (value: FiaDocumentItem): Date | null => {
  if (value.published_at) {
    const parsed = new Date(value.published_at)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  const raw = value.published_raw?.trim()
  if (!raw) return null
  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, dd, mm, yy, hh, min] = match
  const parsed = new Date(Number(`20${yy}`), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatFiaPublishedCompact = (value: FiaDocumentItem): string => {
  const date = parseFiaPublishedDate(value)
  if (!date) return value.published_raw || '-'
  return date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const formatFiaPublishedLong = (value: FiaDocumentItem): string => {
  const date = parseFiaPublishedDate(value)
  if (!date) return value.published_raw || '-'
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export const fiaTimelineBucket = (value: FiaDocumentItem): string => {
  const date = parseFiaPublishedDate(value)
  if (!date) return 'Unknown'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
