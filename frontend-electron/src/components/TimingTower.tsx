import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COMPOUND_COLORS } from '../lib/colors'
import { useDriverStore } from '../stores/driverStore'
import type { TimingRow } from '../hooks/useTimingData'

interface TimingTowerProps {
  rows: TimingRow[]
  status: 'loading' | 'ready' | 'empty' | 'error'
  error: string | null
}

const SECTOR_COLORS = {
  purple: '#c17bff',
  green: '#35e080',
  yellow: '#ffdd57',
  white: '#b6c9e9'
} as const

function cellLap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toFixed(3)
}

const ROW_HEIGHT = 32
const OVERSCAN = 6

const COLS = {
  pos: 'w-9 px-1 shrink-0 text-left',
  driver: 'w-[112px] px-1 shrink-0 text-left',
  gap: 'w-[72px] px-1 shrink-0 text-right',
  int: 'w-[90px] px-1 shrink-0 flex items-center justify-end gap-1.5',
  last: 'w-[80px] px-1 shrink-0 text-right',
  best: 'w-[80px] px-1 shrink-0 text-right',
  tyre: 'w-14 px-1 shrink-0 text-left',
  pits: 'w-10 px-1 shrink-0 text-right',
  s1: 'w-[66px] px-1 shrink-0 text-right',
  s2: 'w-[66px] px-1 shrink-0 text-right',
  s3: 'w-[66px] px-1 shrink-0 text-right',
}

function areRowsEqual(a: TimingRow, b: TimingRow): boolean {
  return (
    a.position === b.position &&
    a.driverCode === b.driverCode &&
    a.driverNumber === b.driverNumber &&
    a.teamColor === b.teamColor &&
    a.driverImage === b.driverImage &&
    a.teamImage === b.teamImage &&
    a.gap === b.gap &&
    a.interval === b.interval &&
    a.lastLap === b.lastLap &&
    a.bestLap === b.bestLap &&
    a.bestLapTime === b.bestLapTime &&
    a.tyreCompound === b.tyreCompound &&
    a.pits === b.pits &&
    a.sector1 === b.sector1 &&
    a.sector2 === b.sector2 &&
    a.sector3 === b.sector3 &&
    a.s1Color === b.s1Color &&
    a.s2Color === b.s2Color &&
    a.s3Color === b.s3Color &&
    a.status === b.status &&
    a.lapsCompleted === b.lapsCompleted
  )
}

function statePanel(label: string, detail: string, tone: 'muted' | 'error' = 'muted') {
  const accentClass = tone === 'error' ? 'text-[#ffb9b9] border-[#7f2e36]/60 bg-[#3a1d22]/35' : 'text-text-muted border-border/60 bg-bg-panel/30'
  return (
    <div className={`glass-panel flex h-full items-center justify-center rounded-2xl border p-4 ${accentClass}`}>
      <div className="text-center">
        <div className="text-sm font-semibold tracking-wide">{label}</div>
        <div className="mt-1 text-xs">{detail}</div>
      </div>
    </div>
  )
}

interface TimingRowItemProps {
  row: TimingRow
  idx: number
  primaryDriver: string | null
  compareDriver: string | null
  sessionBestLap: number | null
  onSelect: (driverCode: string, toggleCompare: boolean) => void
}

const TimingRowItem = memo(function TimingRowItem({
  row,
  idx,
  primaryDriver,
  compareDriver,
  sessionBestLap,
  onSelect
}: TimingRowItemProps) {
  const previousPositionRef = useRef(row.position)
  const [positionPulse, setPositionPulse] = useState(false)

  useEffect(() => {
    if (previousPositionRef.current !== row.position) {
      previousPositionRef.current = row.position
      setPositionPulse(true)
      const timer = window.setTimeout(() => setPositionPulse(false), 220)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [row.position])

  const tyreKey = row.tyreCompound?.toUpperCase()
  const tyreColor = COMPOUND_COLORS[tyreKey] ?? '#666666'
  const tyreTextColor = tyreKey === 'HARD' || tyreKey === 'MEDIUM' ? '#0b0e12' : '#ffffff'
  const bestIsSessionBest = row.bestLapTime != null && sessionBestLap != null && Math.abs(row.bestLapTime - sessionBestLap) < 1e-6
  const baseBg = idx % 2 === 0 ? 'rgba(20,35,60,0.52)' : 'rgba(13,25,46,0.45)'
  const isPrimary = primaryDriver === row.driverCode
  const isCompare = compareDriver === row.driverCode
  const isRetired = row.status === 'dnf' || row.status === 'dns' || row.status === 'out'
  const selectedBg = isPrimary ? 'rgba(49,87,142,0.68)' : baseBg
  const intervalClass = row.interval === '+0.000s' || row.interval === '—' ? 'text-text-muted' : 'text-[#d6eaff]'
  const gapClass =
    row.gap === 'LEADER'
      ? 'text-[#9fd8ff]'
      : row.gap === 'DNF'
        ? 'text-red-400'
        : row.gap === 'DNS'
          ? 'text-amber-400'
          : row.gap === '—'
            ? 'text-text-muted'
            : row.gap.endsWith('L')
              ? 'text-[#ffd98a]'
              : 'text-[#e4efff]'

  return (
    <div
      className="absolute left-0 top-0 flex h-8 w-full cursor-pointer items-center border-b border-border/30 hover:bg-bg-hover/65"
      style={{
        transform: `translateY(${idx * ROW_HEIGHT}px)`,
        backgroundColor: positionPulse ? 'rgba(95, 158, 255, 0.24)' : selectedBg,
        opacity: isRetired ? 0.4 : 1,
        transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 160ms ease-out, opacity 200ms ease-out'
      }}
      onClick={(event) => onSelect(row.driverCode, event.ctrlKey || event.metaKey)}
      title={`${row.teamName} - Lap ${row.lapsCompleted}`}
    >
      <div className={`${COLS.pos} font-bold text-[#edf4ff]`}>{row.position}</div>
      <div className={COLS.driver}>
        <div className="flex items-center gap-1.5 truncate border-l-[3px] pl-1.5 font-semibold" style={{ borderLeftColor: row.teamColor }}>
          {row.driverImage ? (
            <img
              src={row.driverImage}
              alt={row.driverName || row.driverCode}
              className="h-4 w-4 rounded-full border border-border object-cover"
              loading="lazy"
            />
          ) : (
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.teamColor }} />
          )}
          <span className="truncate">{row.driverCode}</span>
          {isRetired && (
            <span className="ml-0.5 rounded bg-red-900/60 px-1 py-px text-[8px] font-bold uppercase leading-none text-red-300">
              {row.status === 'dnf' ? 'DNF' : row.status === 'dns' ? 'DNS' : 'OUT'}
            </span>
          )}
          {row.teamImage && (
            <img
              src={row.teamImage}
              alt={row.teamName}
              className="h-3 w-3 rounded object-contain opacity-85"
              loading="lazy"
            />
          )}
        </div>
      </div>
      <div className={`${COLS.gap} font-mono ${gapClass}`}>{row.gap}</div>
      <div className={`${COLS.int} font-mono ${intervalClass}`}>
        <div className="flex gap-[2px]">
          <div className="h-2 w-1.5 rounded-[1px] opacity-90" style={{ backgroundColor: SECTOR_COLORS[row.s1Color] }} />
          <div className="h-2 w-1.5 rounded-[1px] opacity-90" style={{ backgroundColor: SECTOR_COLORS[row.s2Color] }} />
          <div className="h-2 w-1.5 rounded-[1px] opacity-90" style={{ backgroundColor: SECTOR_COLORS[row.s3Color] }} />
        </div>
        <span>{row.interval}</span>
      </div>
      <div className={`${COLS.last} font-mono`}>{row.lastLap}</div>
      <div className={`${COLS.best} font-mono ${bestIsSessionBest ? 'text-[#c17bff]' : ''}`}>{row.bestLap}</div>
      <div className={COLS.tyre}>
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow-sm transition-shadow duration-150 ${isCompare ? 'ring-2 ring-accent-blue' : 'ring-1 ring-black/40'
            }`}
          style={{ backgroundColor: tyreColor, color: tyreTextColor }}
        >
          {tyreKey?.[0] ?? '?'}
        </div>
      </div>
      <div className={`${COLS.pits} font-mono`}>{row.pits > 0 ? row.pits : '-'}</div>
      <div className={`${COLS.s1} font-mono`} style={{ color: SECTOR_COLORS[row.s1Color] }}>{cellLap(row.sector1)}</div>
      <div className={`${COLS.s2} font-mono`} style={{ color: SECTOR_COLORS[row.s2Color] }}>{cellLap(row.sector2)}</div>
      <div className={`${COLS.s3} font-mono`} style={{ color: SECTOR_COLORS[row.s3Color] }}>{cellLap(row.sector3)}</div>
      <div className="flex-1" />
    </div>
  )
}, (prev, next) => {
  return (
    prev.idx === next.idx &&
    prev.primaryDriver === next.primaryDriver &&
    prev.compareDriver === next.compareDriver &&
    prev.sessionBestLap === next.sessionBestLap &&
    areRowsEqual(prev.row, next.row)
  )
})

export default function TimingTower({ rows, status, error }: TimingTowerProps) {
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(560)
  const frameRef = useRef<number | null>(null)

  const sessionBestLap = useMemo(() => {
    let min: number | null = null
    for (const row of rows) {
      if (row.bestLapTime == null) continue
      min = min == null ? row.bestLapTime : Math.min(min, row.bestLapTime)
    }
    return min
  }, [rows])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const onScroll = () => {
      if (frameRef.current != null) return
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        setScrollTop(node.scrollTop)
      })
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height ?? node.clientHeight
      setViewportHeight(next)
    })
    ro.observe(node)

    return () => {
      node.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [])

  const virtualWindow = useMemo(() => {
    const totalRows = rows.length
    const visibleCount = Math.max(10, Math.ceil(viewportHeight / ROW_HEIGHT))
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const endIndex = Math.min(totalRows, startIndex + visibleCount + OVERSCAN * 2)
    return {
      totalRows,
      startIndex,
      endIndex,
      visibleRows: rows.slice(startIndex, endIndex),
    }
  }, [rows, viewportHeight, scrollTop])

  const onSelect = useCallback(
    (driverCode: string, toggleCompare: boolean) => {
      if (toggleCompare) {
        const isCompare = compareDriver === driverCode
        selectCompare(isCompare ? null : driverCode)
        return
      }
      selectPrimary(driverCode)
    },
    [compareDriver, selectCompare, selectPrimary]
  )

  if (status === 'error') {
    return statePanel('Timing data unavailable', error || 'Unable to render live classification.', 'error')
  }
  if (status === 'loading') {
    return statePanel('Loading timing data', 'Waiting for live lap stream from the current session.')
  }
  if (!rows.length || status === 'empty') {
    return statePanel('No timing rows', 'Session loaded but no classified laps are currently available.')
  }

  return (
    <div ref={containerRef} className="glass-panel h-full overflow-x-auto overflow-y-auto rounded-[22px]">
      <div className="min-w-[800px] w-full text-xs">
        <div className="sticky top-0 z-10 flex h-9 items-center border-b border-border/80 bg-[linear-gradient(180deg,rgba(20,40,74,0.92),rgba(14,28,53,0.9))] text-text-secondary backdrop-blur-sm">
          <div className={COLS.pos}>POS</div>
          <div className={COLS.driver}>DRIVER</div>
          <div className={COLS.gap}>GAP</div>
          <div className={COLS.int}>INT</div>
          <div className={COLS.last}>LAST</div>
          <div className={COLS.best}>BEST</div>
          <div className={COLS.tyre}>TYRE</div>
          <div className={COLS.pits}>PITS</div>
          <div className={COLS.s1}>S1</div>
          <div className={COLS.s2}>S2</div>
          <div className={COLS.s3}>S3</div>
          <div className="flex-1" />
        </div>

        <div className="relative w-full" style={{ height: rows.length * ROW_HEIGHT }}>
          {virtualWindow.visibleRows.map((row, visibleIdx) => (
            <TimingRowItem
              key={row.driverNumber}
              row={row}
              idx={virtualWindow.startIndex + visibleIdx}
              primaryDriver={primaryDriver}
              compareDriver={compareDriver}
              sessionBestLap={sessionBestLap}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
