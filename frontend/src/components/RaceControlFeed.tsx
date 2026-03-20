import React, { useEffect, useMemo, useState, useRef, memo, useCallback } from 'react'
import { animate } from 'animejs'
import { getRaceControlState, upperBoundRaceControlByTimestamp } from '../lib/raceControlState'
import { useSessionTime2s } from '../lib/timeUtils'
import { useSessionStore } from '../stores/sessionStore'
import type { RaceControlMessage } from '../types'

const MAX_VISIBLE = 14

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
  { key: 'all', label: 'ALL' },
  { key: 'flags', label: 'FLAGS' },
  { key: 'penalties', label: 'PENALTIES' },
  { key: 'safety', label: 'SAFETY' },
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
  const base = 'px-1 py-[1px] border text-[8px] font-bold uppercase tracking-[0.12em] whitespace-nowrap'

  if (category === 'SAFETYCAR' || category === 'SAFETY CAR') {
    if (text.includes('VIRTUAL')) {
      return { text: 'VSC', cls: `${base} bg-orange-ghost text-orange-sc border-orange-sc` }
    }
    return { text: 'SC', cls: `${base} bg-orange-ghost text-orange-sc border-orange-sc` }
  }
  if (category === 'DRS') {
    return { text: 'DRS', cls: `${base} bg-bg-elevated text-fg-primary border-border-hard` }
  }
  if (flag === 'RED') {
    return { text: 'RED', cls: `${base} bg-red-ghost text-red-danger border-red-danger` }
  }
  if (flag.includes('YELLOW')) {
    return { text: flag, cls: `${base} bg-[#2a2414] text-amber-warn border-[#5a4a1e]` }
  }
  if (flag === 'GREEN' || flag === 'CLEAR') return { text: 'GREEN', cls: `${base} bg-[#14241a] text-green-live border-[#2f5a40]` }
  if (flag === 'CHEQUERED') return { text: 'FIN', cls: `${base} bg-bg-surface text-fg-primary border-border-hard` }
  if (category === 'PENALTY') {
    return { text: 'PENALTY', cls: `${base} bg-red-ghost text-red-core border-red-core` }
  }
  return null
}

const msgAccent = (m: RaceControlMessage): { bar: string; bg: string } => {
  const f = norm(m.flag)
  const c = norm(m.category)
  if (c === 'SAFETYCAR') return { bar: 'bg-orange-sc', bg: 'bg-[#1c140d]' }
  if (f === 'GREEN' || f === 'CLEAR') return { bar: 'bg-green-live', bg: 'bg-[#0f1a16]' }
  if (f.includes('YELLOW')) return { bar: 'bg-amber-warn', bg: 'bg-[#1b170c]' }
  if (f === 'RED') return { bar: 'bg-red-danger', bg: 'bg-[#1c0f12]' }
  if (f === 'CHEQUERED') return { bar: 'bg-fg-primary', bg: 'bg-bg-surface' }
  if (c === 'PENALTY') return { bar: 'bg-red-core', bg: 'bg-red-ghost' }
  if (c === 'DRS') return { bar: 'bg-fg-secondary', bg: 'bg-bg-surface' }
  return { bar: 'bg-border-soft', bg: 'bg-bg-base' }
}

const stateBadge = (
  flag: string | null,
  sc: boolean,
  vsc: boolean
): { label: string; cls: string } | null => {
  const base = 'px-1.5 py-[2px] border text-[9px] font-bold uppercase tracking-[0.12em]'
  if (sc) return { label: 'SAFETY CAR', cls: `${base} bg-orange-ghost text-orange-sc border-orange-sc` }
  if (vsc) return { label: 'VSC', cls: `${base} bg-orange-ghost text-orange-sc border-orange-sc` }
  if (!flag) return null
  if (flag === 'GREEN' || flag === 'CLEAR') return { label: 'TRACK CLEAR', cls: `${base} bg-[#14241a] text-green-live border-[#2f5a40]` }
  if (flag.includes('YELLOW')) {
    return { label: flag, cls: `${base} bg-[#2a2414] text-amber-warn border-[#5a4a1e]` }
  }
  if (flag === 'RED') {
    return { label: 'RED FLAG', cls: `${base} bg-red-ghost text-red-danger border-red-danger` }
  }
  if (flag === 'CHEQUERED') return { label: 'FINISHED', cls: `${base} bg-bg-surface text-fg-primary border-border-hard` }
  return { label: flag, cls: `${base} bg-bg-elevated text-fg-secondary border-border-hard` }
}

interface RaceControlMessageRowProps {
  m: OrderedRaceControl
  i: number
  accent: ReturnType<typeof msgAccent>
  tag: ReturnType<typeof eventTag>
  rowKey: string
}

const RaceControlMessageRow = memo(function RaceControlMessageRow({
  m, i, accent, tag, rowKey
}: RaceControlMessageRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    if (ref.current && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true
      animate(ref.current, {
        translateX: [20, 0],
        opacity: [0, 1],
        duration: 400,
        ease: 'outQuint'
      })
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`relative border border-border-micro px-2 py-1.5 transition-colors ${accent.bg}`}
    >
      {/* Left accent bar */}
      <div className={`absolute bottom-0 left-0 top-0 w-[1.5px] ${accent.bar}`} />

      <div className="mb-0.5 flex flex-wrap items-center gap-1.5 pl-2">
        <span className="font-mono text-[9px] text-fg-secondary tracking-[0.12em]">{m.time}</span>
        {m.lap != null && (
          <span className="font-mono text-[9px] text-fg-muted tracking-[0.12em]">LAP {m.lap}</span>
        )}
        {tag && (
          <span className={tag.cls}>
            {tag.text}
          </span>
        )}
        {m.racingNumber != null && (
          <span className="font-mono text-[9px] text-fg-primary font-semibold">CAR {m.racingNumber}</span>
        )}
        {i === 0 && (
          <span className="border border-red-core bg-red-ghost px-1 py-[1px] text-[8px] font-bold uppercase tracking-[0.12em] text-red-core">
            LATEST
          </span>
        )}
      </div>

      <div className="mt-0.5 pl-2 font-mono text-[10px] leading-snug text-fg-primary break-words">{m.message}</div>
    </div>
  )
}, (prev, next) => {
  return (
    prev.m === next.m &&
    prev.i === next.i &&
    prev.accent.bar === next.accent.bar &&
    prev.accent.bg === next.accent.bg
  )
})

export const RaceControlFeed = memo(function RaceControlFeed() {
  const sessionData = useSessionStore((s) => s.sessionData)
  const sessionTime = useSessionTime2s()
  const [filter, setFilter] = useState<FilterKey>('all')

  const messages = useMemo(() => {
    if (!sessionData?.raceControl?.length) return []
    return sessionData.raceControl
      .map((m, idx) => ({ ...m, __seq: idx }))
      .sort((a, b) => a.timestamp - b.timestamp || a.__seq - b.__seq)
  }, [sessionData?.raceControl])

  const upToNow = useMemo(() => {
    if (!messages.length) return []
    const end = ub(messages, sessionTime, true)
    return messages.slice(0, end)
  }, [messages, sessionTime])

  const filteredUpToNow = useMemo(() => {
    if (filter === 'all') return upToNow
    return upToNow.filter((message) => messageFilterKind(message) === filter)
  }, [upToNow, filter])

  const visible = useMemo(() => {
    if (!filteredUpToNow.length) return []
    return filteredUpToNow.slice(-MAX_VISIBLE)
  }, [filteredUpToNow])

  const badge = useMemo(() => {
    if (!messages.length) return null
    const e = upperBoundRaceControlByTimestamp(messages, sessionTime)
    const visible = messages.slice(0, e)
    const s = getRaceControlState(
      visible,
      sessionTime,
      sessionData?.metadata?.raceStartSeconds ?? null
    )
    return stateBadge(s.trackFlag, s.isSafetyCar, s.isVSC)
  }, [messages, sessionTime, sessionData?.metadata?.raceStartSeconds])

  const handleSetFilter = useCallback((key: FilterKey) => {
    setFilter(key)
  }, [])

  const renderItem = useCallback((m: OrderedRaceControl, i: number) => {
    const accent = msgAccent(m)
    const tag = eventTag(m)
    const rowKey = messageKey(m)
    return (
      <RaceControlMessageRow
        key={rowKey}
        rowKey={rowKey}
        m={m}
        i={i}
        accent={accent}
        tag={tag}
      />
    )
  }, [])

  if (!visible.length) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center bg-transparent">
        <div>
          <div className="pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>Race Control</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-muted">
            NO MESSAGES{filter !== 'all' ? ` FOUND FOR ${FILTERS.find((item) => item.key === filter)?.label}` : ''}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-transparent">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-border-hard pb-1.5">
        <div className="flex justify-between items-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>
            Race Control
          </div>

          {badge && (
            <div className={badge.cls}>
              {badge.label}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSetFilter(item.key)}
              className={`rounded-sm border px-2 py-[2px] text-[8px] font-bold uppercase tracking-[0.12em] transition-colors ${filter === item.key
                ? 'border-blue-sel bg-blue-sel/10 text-blue-sel'
                : 'border-border-hard bg-bg-surface text-fg-muted hover:text-fg-primary'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message list — newest first */}
      <div className="mt-1.5 flex-1 space-y-[1px] overflow-y-auto pr-[1px]">
        {visible
          .slice()
          .reverse()
          .map((m, i) => renderItem(m, i))
        }
      </div>
    </div>
  )
})
