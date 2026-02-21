import React, { useMemo } from 'react'
import { getRaceControlStateFromSlice, upperBoundRaceControlByTimestamp } from '../lib/raceControlState'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'
import type { RaceControlMessage } from '../types'

const MAX_VISIBLE = 120, MAX_MARKS = 80
const ub = (arr: RaceControlMessage[], t: number, inc = true) => { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (inc ? arr[mid].timestamp <= t : arr[mid].timestamp < t) lo = mid + 1; else hi = mid } return lo }
const msgStyle = (m: RaceControlMessage) => {
  const f = String(m.flag || '').toUpperCase(), c = String(m.category || '').toLowerCase()
  if (c === 'safetycar') return { bg: 'bg-orange-500/10', border: 'border-l-orange-500', badge: String(m.message || '').toUpperCase().includes('VIRTUAL') ? 'VSC' : 'SC', badgeColor: 'bg-orange-500/20 text-orange-400' }
  if (f === 'GREEN' || f === 'CLEAR') return { bg: 'bg-green-500/5', border: 'border-l-green-500' }
  if (f.includes('YELLOW')) return { bg: 'bg-yellow-500/10', border: 'border-l-yellow-500' }
  if (f === 'RED') return { bg: 'bg-red-500/10', border: 'border-l-red-500', badge: 'RED', badgeColor: 'bg-red-500/20 text-red-400' }
  if (f === 'CHEQUERED') return { bg: 'bg-white/5', border: 'border-l-white', badge: 'FIN', badgeColor: 'bg-white/10 text-white' }
  if (c === 'drs') return { bg: 'bg-blue-500/5', border: 'border-l-blue-500', badge: 'DRS', badgeColor: 'bg-blue-500/20 text-blue-400' }
  return { bg: 'bg-bg-card', border: 'border-l-border' }
}
const stateBadge = (flag: string | null, sc: boolean, vsc: boolean): { label: string; cls: string } | null => {
  if (sc) return { label: 'SC', cls: 'bg-orange-500/20 text-orange-400' }
  if (vsc) return { label: 'VSC', cls: 'bg-orange-500/20 text-orange-400' }
  if (!flag) return null
  if (flag === 'GREEN' || flag === 'CLEAR') return { label: 'GREEN', cls: 'bg-green-500/20 text-green-400' }
  if (flag.includes('YELLOW')) return { label: flag, cls: 'bg-yellow-500/20 text-yellow-400' }
  if (flag === 'RED') return { label: 'RED', cls: 'bg-red-500/20 text-red-400' }
  if (flag === 'CHEQUERED') return { label: 'FIN', cls: 'bg-white/10 text-white' }
  return { label: flag, cls: 'bg-bg-hover text-text-secondary' }
}
const markerColor = (m: RaceControlMessage) => { const f = String(m.flag || '').toUpperCase(), c = String(m.category || '').toUpperCase(); if (f === 'RED') return '#f87171'; if (f.includes('YELLOW')) return '#fbbf24'; if (c === 'SAFETYCAR') return '#fb923c'; return '#93c5fd' }

export function RaceControlFeed() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const duration = usePlaybackStore((s) => s.duration)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const seek = usePlaybackStore((s) => s.seek)
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const sessionTime = useSessionTime()

  const messages = useMemo(() => (sessionData?.raceControl?.length ? [...sessionData.raceControl].sort((a, b) => a.timestamp - b.timestamp) : []), [sessionData?.raceControl])
  const visible = useMemo(() => { if (!messages.length) return []; const s = ub(messages, sessionStartTime, false), e = ub(messages, sessionTime, true); return e <= s ? [] : messages.slice(Math.max(s, e - MAX_VISIBLE), e) }, [messages, sessionStartTime, sessionTime])
  const badge = useMemo(() => { if (!messages.length) return null; const e = upperBoundRaceControlByTimestamp(messages, sessionTime); const s = getRaceControlStateFromSlice(messages, e, sessionTime, sessionData?.metadata?.raceStartSeconds ?? null); return stateBadge(s.trackFlag, s.isSafetyCar, s.isVSC) }, [messages, sessionTime, sessionData?.metadata?.raceStartSeconds])
  const marks = useMemo(() => {
    if (!messages.length || duration <= 0) return []
    const inSession = messages.filter((m) => m.timestamp >= sessionStartTime && m.timestamp <= sessionStartTime + duration)
    if (inSession.length <= MAX_MARKS) return inSession
    const stride = Math.ceil(inSession.length / MAX_MARKS)
    return inSession.filter((_, i) => i % stride === 0)
  }, [messages, duration, sessionStartTime])

  if (!visible.length) return <div className="glass-panel flex h-full items-center justify-center rounded-xl p-3 text-sm text-text-muted">No race control messages</div>
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-xl">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border/70 px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-text-secondary">Race Control</span>
        {badge && <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>{badge.label}</span>}
      </div>
      <div className="px-3 pb-1.5 pt-1">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-text-muted"><span>Event Timeline</span><span>{marks.length} marks</span></div>
        <div className="relative h-2.5 cursor-pointer rounded-full bg-[#132845]" onMouseDown={(e) => { if (duration <= 0) return; const r = e.currentTarget.getBoundingClientRect(); seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration) }}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-blue/70 to-accent/70" style={{ width: `${progress * 100}%` }} />
          {marks.map((m, i) => <span key={`${m.timestamp}-${m.category}-${i}`} className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded" style={{ left: `${Math.max(0, Math.min(100, ((m.timestamp - sessionStartTime) / duration) * 100))}%`, backgroundColor: markerColor(m) }} title={`${m.time} | ${m.flag || m.category} | ${m.message}`} />)}
          <span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/70 bg-[#f5fbff]" style={{ left: `calc(${progress * 100}% - 7px)` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {visible.slice().reverse().map((m, i) => {
          const s = msgStyle(m)
          return (
            <div key={`${m.timestamp}-${m.category}-${m.message}-${i}`} className={`${s.bg} ${s.border} border-l-2 border-b border-border/50 px-3 py-1.5`}>
              <div className="mb-0.5 flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-muted">{m.time}</span>{m.lap != null && <span className="text-[10px] text-text-muted">L{m.lap}</span>}
                {s.badge && <span className={`rounded px-1.5 py-0 text-[9px] font-bold ${s.badgeColor}`}>{s.badge}</span>}
                {m.racingNumber != null && <span className="text-[10px] text-text-muted">#{m.racingNumber}</span>}
              </div>
              <div className="text-xs leading-tight text-text-primary">{m.message}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
