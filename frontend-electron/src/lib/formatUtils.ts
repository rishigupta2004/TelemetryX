export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--.---'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export function formatTimeShort(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  if (mins > 0) {
    return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0').slice(0, 2)}`
  }
  return `${secs}.${String(ms).padStart(3, '0').slice(0, 2)}`
}

export function formatInterval(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds === 0) return '-'
  const prefix = seconds > 0 ? '+' : ''
  if (Math.abs(seconds) < 60) {
    return `${prefix}${seconds.toFixed(3)}s`
  }
  const mins = Math.floor(Math.abs(seconds) / 60)
  const secs = Math.abs(seconds) % 60
  return `${prefix}${mins}:${String(Math.floor(secs)).padStart(2, '0')}`
}

export function formatGap(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '-'
  if (seconds === 0) return 'Leader'
  const prefix = seconds > 0 ? '+' : ''
  if (Math.abs(seconds) < 60) {
    return `${prefix}${seconds.toFixed(1)}s`
  }
  const mins = Math.floor(Math.abs(seconds) / 60)
  const secs = Math.abs(seconds) % 60
  return `${prefix}${mins}:${String(Math.floor(secs)).padStart(2, '0')}`
}

export function formatYears(years: number[]): string {
  if (!years.length) return '-'
  if (years.length === 1) return String(years[0])
  return `${years[0]}-${years[years.length - 1]}`
}

export function formatInitials(label: string): string {
  const parts = label.trim().split(/\s+/)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function barWidth(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0%'
  return `${Math.max(2, Math.round((value / max) * 100))}%`
}

export function formatRaceName(name: string): string {
  return name.replace(/ Grand Prix$/i, '')
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
