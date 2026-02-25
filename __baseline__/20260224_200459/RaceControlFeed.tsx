import React, { useEffect, useMemo, useState } from 'react'
import { getRaceControlStateFromSlice, upperBoundRaceControlByTimestamp } from '../lib/raceControlState'
import { useSessionTime } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'
import type { RaceControlMessage } from '../types'

// ── Max messages shown at once ──
const MAX_VISIBLE = 8

type OrderedRaceControl = RaceControlMessage & { __seq: number }
type FilterKey = 'all' | 'flags' | 'penalties' | 'safety' | 'drs'

const ub = (arr: OrderedRaceControl[], t: number, inc = true) => {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (inc ? arr[mid].timestamp <= t : arr[mid].timestamp < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

const norm = (v: string | null | undefined) => String(v || '').trim().toUpperCase()
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'flags', label: 'Flags' },
  { key: 'penalties', label: 'Penalties' },
  { key: 'safety', label: 'Safety Car' },
  { key: 'drs', label: 'DRS' }
]

function messageFilterKind(m: RaceControlMessage): Exclude<FilterKey, 'all'> | 'other' {
  const category = norm(m.category)
  const flag = norm(m.flag)
  if (category === 'SAFETYCAR' || category === 'SAFETY CAR') return 'safety'
  if (category === 'DRS') return 'drs'
  if (category === 'PENALTY') return 'penalties'
  if (category === 'FLAG' || category === 'TRACK' || !!flag) return 'flags'
  return 'other'
}

function messageKey(m: OrderedRaceControl): string {
  return `${m.timestamp}-${m.__seq}`
}

function eventTag(m: RaceControlMessage): { text: string; cls: string } | null {
  const category = norm(m.category)
  const flag = norm(m.flag)
  const text = norm(m.message)
  if (category === 'SAFETYCAR' || category === 'SAFETY CAR') {
    if (text.includes('VIRTUAL')) {
      return {
        text: 'VSC',
        cls: 'glass-pill-active !bg-[#2a1d12] !text-[#f1c078] !border-[#5a3f1e] shadow-[0_0_8px_rgba(241,192,120,0.45)]'
      }
    }
    return {
      text: 'SC',
      cls: 'glass-pill-active !bg-[#2a1d12] !text-[#f1c078] !border-[#5a3f1e] shadow-[0_0_8px_rgba(241,192,120,0.45)]'
    }
  }
  if (category === 'DRS') {
    return {
      text: 'DRS',
      cls: 'glass-pill-active !bg-[#12202b] !text-[#9fd0ff] !border-[#2b4b66] shadow-[0_0_8px_rgba(159,208,255,0.4)]'
    }
  }
  if (flag === 'RED') {
    return {
      text: 'RED',
      cls: 'glass-pill-active !bg-[#2b1313] !text-[#f2a0a0] !border-[#6b2424] shadow-[0_0_12px_rgba(210,77,77,0.6)]'
    }
  }
  if (flag.includes('YELLOW')) {
    return {
      text: flag,
      cls: 'glass-pill-active !bg-[#2a2414] !text-[#f3d26a] !border-[#5a4a1e] shadow-[0_0_10px_rgba(234,179,8,0.45)]'
    }
  }
  if (flag === 'GREEN' || flag === 'CLEAR') return { text: 'GREEN', cls: 'bg-[#14241a] text-[#9ad9b0] border-[#2f5a40]' }
  if (flag === 'CHEQUERED') return { text: 'FIN', cls: 'bg-[#1a1c20] text-[#e5e7eb] border-[#3a3f47]' }
  if (category === 'PENALTY') {
    return {
      text: 'PEN',
      cls: 'glass-pill-active !bg-[#26161b] !text-[#f2a3b5] !border-[#5a2a35] shadow-[0_0_8px_rgba(244,116,148,0.45)]'
    }
  }
  return null
}

const msgAccent = (m: RaceControlMessage): { bar: string; bg: string } => {
  const f = norm(m.flag)
  const c = norm(m.category)
  if (c === 'SAFETYCAR') return { bar: 'bg-amber-300/80', bg: 'bg-[#1c140d]' }
  if (f === 'GREEN' || f === 'CLEAR') return { bar: 'bg-emerald-300/70', bg: 'bg-[#0f1a16]' }
  if (f.includes('YELLOW')) return { bar: 'bg-yellow-300/70', bg: 'bg-[#1b170c]' }
  if (f === 'RED') return { bar: 'bg-rose-300/75', bg: 'bg-[#1c0f12]' }
  if (f === 'CHEQUERED') return { bar: 'bg-slate-200/70', bg: 'bg-[#14171c]' }
  if (c === 'DRS') return { bar: 'bg-cyan-300/70', bg: 'bg-[#0d1622]' }
  return { bar: 'bg-slate-400/30', bg: 'bg-[#111318]' }
}

const stateBadge = (
  flag: string | null,
  sc: boolean,
  vsc: boolean
): { label: string; cls: string } | null => {
  if (sc) return { label: 'SC', cls: 'glass-pill-active !bg-[#2a1d12] !text-[#f1c078] !border-[#5a3f1e] shadow-[0_0_8px_rgba(241,192,120,0.45)]' }
  if (vsc) return { label: 'VSC', cls: 'glass-pill-active !bg-[#2a1d12] !text-[#f1c078] !border-[#5a3f1e] shadow-[0_0_8px_rgba(241,192,120,0.45)]' }
  if (!flag) return null
  if (flag === 'GREEN' || flag === 'CLEAR') return { label: 'GREEN', cls: 'bg-[#14241a] text-[#9ad9b0] border-[#2f5a40]' }
  if (flag.includes('YELLOW')) {
    return {
      label: flag,
      cls: 'glass-pill-active !bg-[#2a2414] !text-[#f3d26a] !border-[#5a4a1e] shadow-[0_0_10px_rgba(234,179,8,0.45)]'
    }
  }
  if (flag === 'RED') {
    return {
      label: 'RED',
      cls: 'glass-pill-active !bg-[#2b1313] !text-[#f2a0a0] !border-[#6b2424] shadow-[0_0_12px_rgba(210,77,77,0.6)]'
    }
  }
  if (flag === 'CHEQUERED') return { label: 'FIN', cls: 'bg-[#1a1c20] text-[#e5e7eb] border-[#3a3f47]' }
  return { label: flag, cls: 'bg-[#15181e] text-text-secondary border-[#2a2f38]' }
}

export function RaceControlFeed() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const sessionTime = useSessionTime()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [animatedMessageKey, setAnimatedMessageKey] = useState<string | null>(null)

  const messages = useMemo(() => {
    if (!sessionData?.raceControl?.length) return []
    return sessionData.raceControl
      .map((m, idx) => ({ ...m, __seq: idx }))
      .sort((a, b) => a.timestamp - b.timestamp || a.__seq - b.__seq)
  }, [sessionData?.raceControl])

  // ── Only messages up to current session time ──
  const upToNow = useMemo(() => {
    if (!messages.length) return []
    const end = ub(messages, sessionTime, true)
    return messages.slice(0, end)
  }, [messages, sessionTime])

  const filteredUpToNow = useMemo(() => {
    if (filter === 'all') return upToNow
    return upToNow.filter((message) => messageFilterKind(message) === filter)
  }, [upToNow, filter])

  // Keep the latest chronological feed without expiring older events by TTL.
  const visible = useMemo(() => {
    if (!filteredUpToNow.length) return []
    return filteredUpToNow.slice(-MAX_VISIBLE)
  }, [filteredUpToNow])

  useEffect(() => {
    if (!visible.length) return
    const newest = visible[visible.length - 1]
    const key = messageKey(newest)
    setAnimatedMessageKey((prev) => (prev === key ? prev : key))
    const timer = window.setTimeout(() => {
      setAnimatedMessageKey((current) => (current === key ? null : current))
    }, 380)
    return () => window.clearTimeout(timer)
  }, [visible])

  const badge = useMemo(() => {
    if (!messages.length) return null
    const e = upperBoundRaceControlByTimestamp(messages, sessionTime)
    const s = getRaceControlStateFromSlice(
      messages,
      e,
      sessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    return stateBadge(s.trackFlag, s.isSafetyCar, s.isVSC)
  }, [messages, sessionTime, sessionData?.metadata?.raceStartSeconds])

  if (!visible.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-xl p-3 text-sm text-text-muted">
        No race control messages{filter !== 'all' ? ` for ${FILTERS.find((item) => item.key === filter)?.label}` : ''}
      </div>
    )
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-xl bg-[#13161c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/6 bg-[#151a22] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[#c1c7d0]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            Race Control
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                filter === item.key
                  ? 'border-[#2b4b66] bg-[#122033] text-[#dbeafe]'
                  : 'border-[#2a2f38] bg-[#13161c] text-text-muted hover:border-[#3a4250] hover:text-text-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`glass-pill rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          <span className="text-[10px] text-text-muted">
            {visible.length} msg{visible.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Message list — newest first */}
      <div className="flex-1 overflow-y-auto">
        {visible
          .slice()
          .reverse()
          .map((m, i) => {
            const accent = msgAccent(m)
            const tag = eventTag(m)
            const isNewest = i === 0
            const rowKey = messageKey(m)
            const shouldAnimate = rowKey === animatedMessageKey
            return (
              <div
                key={rowKey}
                className={`relative border-b border-white/5 px-3 py-2 transition-colors ${accent.bg} ${
                  isNewest ? 'bg-white/4' : ''
                }`}
                style={shouldAnimate ? { animation: 'txRaceControlSlideIn 320ms cubic-bezier(0.2,0.7,0.2,1)' } : undefined}
              >
                {/* Left accent bar */}
                <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${accent.bar}`} />

                <div className="mb-1 flex flex-wrap items-center gap-1.5 pl-2">
                  <span className="font-mono text-[10px] text-text-muted">{m.time}</span>
                  {m.lap != null && (
                    <span className="text-[10px] text-text-muted">L{m.lap}</span>
                  )}
                  {tag && (
                    <span className={`glass-pill rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase ${tag.cls}`}>
                      {tag.text}
                    </span>
                  )}
                  {m.racingNumber != null && (
                    <span className="text-[10px] text-text-muted">#{m.racingNumber}</span>
                  )}
                  {isNewest && (
                    <span className="rounded-full border border-[#2b4b66] bg-[#122033] px-1.5 py-0 text-[9px] font-bold text-[#9fd0ff]">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="pl-2 text-[12px] leading-snug text-text-primary">{m.message}</div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
