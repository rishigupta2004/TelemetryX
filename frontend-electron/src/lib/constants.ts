export const TARGET_FPS = 90
export const PLAYBACK_FPS = 90
export const RESIZE_DEBOUNCE_MS = 150
export const MAX_HISTORY_ENTRIES = 7200
export const TRACK_LOOKUP_TABLE_SIZE = 2000
const rawApiTimeoutMs = Number(
  (import.meta as unknown as { env?: { VITE_API_TIMEOUT_MS?: string } })?.env
    ?.VITE_API_TIMEOUT_MS ?? '25000'
)
export const API_TIMEOUT_MS = Number.isFinite(rawApiTimeoutMs) && rawApiTimeoutMs > 0
  ? rawApiTimeoutMs
  : 25000
export const API_RETRIES = 1
export const API_CACHE_TTL_MS = 120_000
export const API_CACHE_MAX_ENTRIES = 64
