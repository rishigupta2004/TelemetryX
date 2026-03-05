import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COMPOUND_COLORS } from '../lib/colors'
import { useDriverStore } from '../stores/driverStore'
import { useF1Flip } from '../hooks/useF1Flip'
import { useFlashObserver } from '../hooks/useFlashObserver'
import type { TimingRow } from '../hooks/useTimingData'

interface TimingTowerProps {
  rows: TimingRow[]
  status: 'loading' | 'ready' | 'empty' | 'error'
  error: string | null
}

const ROW_HEIGHT = 32
const OVERSCAN = 10

function cellLap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toFixed(3)
}

function areRowsEqual(a: TimingRow, b: TimingRow): boolean {
  return (
    a.position === b.position &&
    a.driverCode === b.driverCode &&
    a.driverNumber === b.driverNumber &&
    a.teamColor === b.teamColor &&
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
  const accentClass = tone === 'error' ? 'text-red-danger border-red-danger bg-red-ghost' : 'text-fg-muted border-border-hard bg-bg-panel'
  return (
    <div className={`flex h-full items-center justify-center rounded-[2px] border p-4 ${accentClass}`}>
      <div className="text-center">
        <div className="text-sm font-bold tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>{label}</div>
        <div className="mt-1 text-xs">{detail}</div>
      </div>
    </div>
  )
}

function getSectorBlockStyle(colorCode: string) {
  if (colorCode === 'purple') return 'bg-purple-best text-purple-core'
  if (colorCode === 'green') return 'bg-green-best text-green-live'
  return 'bg-transparent text-fg-primary'
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
  const isPrimary = primaryDriver === row.driverCode
  const isCompare = compareDriver === row.driverCode
  const isSelected = isPrimary || isCompare

  const tyreKey = row.tyreCompound?.toUpperCase()
  const tyreColor = COMPOUND_COLORS[tyreKey] ?? '#666666'

  const isRetired = row.status === 'dnf' || row.status === 'dns' || row.status === 'out'

  const bgClass = isSelected ? 'bg-bg-elevated' : 'bg-transparent hover:bg-bg-elevated'

  // Format LAP TIME conditional coloring based on bestLapTime
  let lapTimeStyle = 'bg-transparent text-fg-primary'
  let bestFlashColor = ''
  if (row.bestLapTime != null && row.lastLap != null) {
    if (sessionBestLap != null && Math.abs(row.bestLapTime - sessionBestLap) < 1e-6) {
      lapTimeStyle = 'bg-purple-best text-purple-core'
      bestFlashColor = '#B138FF'
    } else {
      lapTimeStyle = 'bg-green-best text-green-live'
      bestFlashColor = '#00FF00'
    }
  }

  const posRef = useF1Flip(row.position)
  const gapRef = useF1Flip(row.gap)
  const intervalRef = useF1Flip(row.interval)
  const lastLapRef = useF1Flip(row.lastLap)
  const lapTimeFlashRef = useFlashObserver(row.lastLap, !!bestFlashColor, bestFlashColor)

  const s1FlashColor = row.s1Color === 'purple' ? '#B138FF' : row.s1Color === 'green' ? '#00FF00' : ''
  const s2FlashColor = row.s2Color === 'purple' ? '#B138FF' : row.s2Color === 'green' ? '#00FF00' : ''
  const s3FlashColor = row.s3Color === 'purple' ? '#B138FF' : row.s3Color === 'green' ? '#00FF00' : ''

  const s1Ref = useFlashObserver(row.sector1, !!s1FlashColor, s1FlashColor)
  const s2Ref = useFlashObserver(row.sector2, !!s2FlashColor, s2FlashColor)
  const s3Ref = useFlashObserver(row.sector3, !!s3FlashColor, s3FlashColor)

  return (
    <div
      className={`absolute left-0 top-0 flex w-full cursor-pointer items-center border-b border-border-micro transition-colors ${bgClass}`}
      style={{
        height: ROW_HEIGHT,
        transform: `translateY(${idx * ROW_HEIGHT}px)`,
        opacity: isRetired ? 0.4 : 1,
      }}
      onClick={(event) => onSelect(row.driverCode, event.ctrlKey || event.metaKey)}
    >
      <div className="flex items-center min-w-max mx-auto px-2">
        {/* 1. POS */}
        <div className="w-[32px] text-center shrink-0">
          <span ref={posRef} className="font-mono text-[12px] font-bold text-fg-secondary inline-block">
            {row.position}
          </span>
        </div>

        {/* 2. PIT */}
        <div className="w-[16px] text-center shrink-0 text-red-core font-bold text-[10px]">
          {row.pits > 0 ? 'P' : ''}
        </div>

        {/* 3. TEAM COLOR */}
        <div className="w-[4px] h-[20px] shrink-0 ml-1 rounded-[1px]" style={{ backgroundColor: row.teamColor }} />

        {/* 4. DRIVER CODE */}
        <div className="w-[48px] shrink-0 pl-2">
          <span className="text-[14px] font-bold text-fg-primary leading-none" style={{ fontFamily: 'var(--font-heading)' }}>
            {row.driverCode}
          </span>
        </div>

        {/* 5. TYRE */}
        <div className="w-[24px] shrink-0 flex items-center justify-center gap-[2px]">
          <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: tyreColor }} />
          <span className="text-[11px] font-bold text-fg-muted" style={{ fontFamily: 'var(--font-heading)' }}>
            {tyreKey?.[0] ?? '?'}
          </span>
        </div>

        {/* 6. GAP TO LEADER */}
        <div className="w-[64px] shrink-0 text-right pr-2">
          <span ref={gapRef} className="font-mono text-[13px] text-fg-secondary inline-block">
            {row.gap === 'LEADER' ? '' : row.gap}
          </span>
        </div>

        {/* 7. GAP TO AHEAD */}
        <div className="w-[64px] shrink-0 text-right pr-2">
          <span ref={intervalRef} className="font-mono text-[13px] text-fg-muted inline-block">
            {row.interval === '—' || row.interval === '+0.000s' ? '' : row.interval}
          </span>
        </div>

        {/* 8. S1 */}
        <div ref={s1Ref} className={`w-[56px] h-full shrink-0 flex items-center justify-center font-mono text-[12px] ${getSectorBlockStyle(row.s1Color)}`}>
          {cellLap(row.sector1)}
        </div>

        {/* 8. S2 */}
        <div ref={s2Ref} className={`w-[56px] h-full shrink-0 flex items-center justify-center font-mono text-[12px] ${getSectorBlockStyle(row.s2Color)} border-l border-border-micro`}>
          {cellLap(row.sector2)}
        </div>

        {/* 8. S3 */}
        <div ref={s3Ref} className={`w-[56px] h-full shrink-0 flex items-center justify-center font-mono text-[12px] ${getSectorBlockStyle(row.s3Color)} border-l border-border-micro`}>
          {cellLap(row.sector3)}
        </div>

        {/* 9. LAP TIME */}
        <div ref={lapTimeFlashRef} className={`w-[72px] h-full shrink-0 flex items-center justify-end pr-2 font-mono text-[13px] font-bold border-l border-border-micro ${lapTimeStyle}`}>
          <div ref={lastLapRef}>{row.lastLap || ''}</div>
        </div>
      </div>
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
    return statePanel('DATA ERROR', error || 'UNABLE TO RENDER CLASSIFICATION', 'error')
  }
  if (status === 'loading') {
    return statePanel('INITIALIZING SYSTEM', 'AWAITING TELEMETRY STREAM...')
  }
  if (!rows.length || status === 'empty') {
    return statePanel('NO DATA', 'STANDBY FOR SESSION ACTIVITY')
  }

  // Calculate header padding to center it over the table
  return (
    <div ref={containerRef} className="h-full overflow-x-auto overflow-y-auto w-full border border-border-hard bg-bg-surface flex flex-col items-center">
      <div className="w-full relative min-w-max pb-[24px]">
        {/* Table Header */}
        <div className="sticky top-0 z-10 flex h-6 w-full items-center border-b border-border-hard bg-bg-surface text-[10px] font-bold text-fg-muted tracking-widest px-2" style={{ fontFamily: 'var(--font-heading)' }}>
          <div className="flex items-center mx-auto">
            <div className="w-[32px] text-center">POS</div>
            <div className="w-[16px] text-center">PT</div>
            <div className="w-[4px] ml-1" />
            <div className="w-[48px] pl-2 text-left">DVR</div>
            <div className="w-[24px] text-center">TYR</div>
            <div className="w-[64px] text-center pr-2">LEADER</div>
            <div className="w-[64px] text-center pr-2">AHEAD</div>
            <div className="w-[56px] text-center border-border-micro">S1</div>
            <div className="w-[56px] text-center border-l border-border-micro">S2</div>
            <div className="w-[56px] text-center border-l border-border-micro">S3</div>
            <div className="w-[72px] text-center border-l border-border-micro pr-2">LAP</div>
          </div>
        </div>

        {/* Rows Container */}
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
