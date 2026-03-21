import { memo, useMemo, useState } from 'react'
import { COMPOUND_COLORS } from '../lib/colors'
import type { TimingRow } from '../hooks/useTimingData'

interface TimingTowerProps {
  rows: TimingRow[]
  status?: 'loading' | 'ready' | 'empty' | 'error'
  error?: string | null
}

const SECTOR_COLORS = {
  purple: '#d8b4fe',
  green: '#4ade80',
  yellow: '#fde047',
  white: '#e2e8f0'
} as const

const ROW_HEIGHT = 26
const OVERSCAN = 4

function cellLap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const mins = Math.floor(value / 60)
  const secs = Math.floor(value % 60)
  const ms = Math.round((value - Math.floor(value)) * 1000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

type RowItemProps = {
  row: TimingRow
  idx: number
  selected: boolean
  sessionBestLap: number | null
  onSelect: (driverNumber: number) => void
}

const TimingRowItem = memo(function TimingRowItem({ row, idx, selected, sessionBestLap, onSelect }: RowItemProps) {
  const tyreKey = row.tyreCompound?.toUpperCase()
  const tyreColor = COMPOUND_COLORS[tyreKey] ?? '#666666'
  const tyreTextColor = tyreKey === 'HARD' ? '#000000' : '#ffffff'
  const bestIsSessionBest =
    row.bestLapTime != null && sessionBestLap != null && Math.abs(row.bestLapTime - sessionBestLap) < 1e-6
  const baseBg = row.status === 'dnf'
    ? 'rgba(255,0,0,0.04)'
    : idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)'
  const selectedBg = selected ? 'var(--bg-selected)' : baseBg
  const progressPct = (row.lapProgress ?? 0) * 100

  return (
    <tr
      key={row.driverNumber}
      aria-label={`${row.driverCode} position ${row.position}`}
      className="group h-[32px] cursor-pointer border-b border-border/10 transition-colors duration-150 hover:bg-white/5"
      style={{ backgroundColor: selectedBg }}
      onClick={() => onSelect(row.driverNumber)}
      title={`${row.teamName} - Lap ${row.lapsCompleted}`}
    >
      <td className="relative px-1 font-mono font-bold text-fg-secondary">
        <div className="relative z-10 flex items-center justify-center">{row.position}</div>
        {/* Lap Progress Bar */}
        <div 
          className="absolute bottom-0 left-0 h-[1.5px] bg-white/20 transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: row.teamColor }}
        />
      </td>
      <td className="px-1">
        <div className="flex items-center gap-2">
          {/* Team Logo / Color Strip */}
          <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-black/40 border border-white/5">
            {row.teamImage ? (
              <img src={row.teamImage} alt="" className="h-full w-full object-contain p-0.5" />
            ) : (
              <div className="h-full w-full" style={{ backgroundColor: row.teamColor }} />
            )}
          </div>
          
          {/* Driver Headshot */}
          <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-800 border border-white/10 shadow-sm">
            {row.driverImage ? (
              <img src={row.driverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[7px] font-bold text-slate-500">
                {row.driverCode.slice(0, 2)}
              </div>
            )}
          </div>

          <span className={`truncate font-bold tracking-[0.05em] text-[11px] ${row.status === 'dnf' ? 'text-fg-muted opacity-50 line-through' : 'text-fg-primary'}`}>
            {row.driverCode}
          </span>
        </div>
      </td>
      <td className="px-1 text-right font-mono tabular-nums text-fg-primary font-medium">{row.gap}</td>
      <td className="px-1 text-right font-mono tabular-nums text-fg-secondary">{row.interval}</td>
      <td className="px-1 text-right font-mono tabular-nums text-white/90">{row.lastLap}</td>
      <td
        className={`px-1 text-right font-mono tabular-nums transition-all ${bestIsSessionBest ? 'text-[#d8b4fe]' : 'text-fg-primary'}`}
        style={{ textShadow: bestIsSessionBest ? '0 0 5px rgba(168,85,247,0.45)' : 'none' }}
      >
        {row.bestLap}
      </td>
      <td className="h-[26px] px-1">
        <div
          className="mx-auto flex h-4.5 w-4.5 items-center justify-center rounded-full text-[8px] font-bold shadow-sm"
          style={{ backgroundColor: tyreColor, color: tyreTextColor, border: `1px solid ${tyreTextColor}40` }}
        >
          {tyreKey?.[0] ?? '?'}
        </div>
      </td>
      <td className="px-1 text-right font-mono tabular-nums text-fg-secondary">{row.pits > 0 ? row.pits : '—'}</td>
      <td className="px-1 text-right font-mono tabular-nums" style={{ color: SECTOR_COLORS[row.s1Color], textShadow: row.s1Color === 'purple' ? '0 0 5px rgba(168,85,247,0.45)' : row.s1Color === 'green' ? '0 0 5px rgba(74,222,128,0.45)' : 'none' }}>{cellLap(row.sector1)}</td>
      <td className="px-1 text-right font-mono tabular-nums" style={{ color: SECTOR_COLORS[row.s2Color], textShadow: row.s2Color === 'purple' ? '0 0 5px rgba(168,85,247,0.45)' : row.s2Color === 'green' ? '0 0 5px rgba(74,222,128,0.45)' : 'none' }}>{cellLap(row.sector2)}</td>
      <td className="px-1 text-right font-mono tabular-nums" style={{ color: SECTOR_COLORS[row.s3Color], textShadow: row.s3Color === 'purple' ? '0 0 5px rgba(168,85,247,0.45)' : row.s3Color === 'green' ? '0 0 5px rgba(74,222,128,0.45)' : 'none' }}>{cellLap(row.sector3)}</td>
    </tr>
  )
}, (prev, next) => {
  if (prev.selected !== next.selected) return false
  if (prev.sessionBestLap !== next.sessionBestLap) return false
  const a = prev.row
  const b = next.row
  return (
    a.driverNumber === b.driverNumber &&
    a.position === b.position &&
    a.gap === b.gap &&
    a.interval === b.interval &&
    a.lastLap === b.lastLap &&
    a.bestLap === b.bestLap &&
    a.tyreCompound === b.tyreCompound &&
    a.pits === b.pits &&
    a.sector1 === b.sector1 &&
    a.sector2 === b.sector2 &&
    a.sector3 === b.sector3 &&
    a.s1Color === b.s1Color &&
    a.s2Color === b.s2Color &&
    a.s3Color === b.s3Color
  )
})

export default function TimingTower({ rows, status = 'ready', error = null }: TimingTowerProps) {
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(420)

  const safeRows = Array.isArray(rows) ? rows : []

  const sessionBestLap = useMemo(() => {
    let min: number | null = null
    for (const row of safeRows) {
      if (row.bestLapTime == null) continue
      min = min == null ? row.bestLapTime : Math.min(min, row.bestLapTime)
    }
    return min
  }, [safeRows])

  const visible = useMemo(() => {
    const visibleCount = Math.max(1, Math.ceil(viewportHeight / ROW_HEIGHT))
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const end = Math.min(safeRows.length, start + visibleCount + OVERSCAN * 2)
    const topPad = start * ROW_HEIGHT
    const bottomPad = Math.max(0, (safeRows.length - end) * ROW_HEIGHT)
    return { start, end, topPad, bottomPad, rows: safeRows.slice(start, end) }
  }, [safeRows, scrollTop, viewportHeight])

  if (status === 'loading' || !Array.isArray(rows)) {
    return <div className="p-3 text-text-muted">Loading timing data...</div>
  }
  if (status === 'error') {
    return <div className="p-3 text-red-400">{error ?? 'Failed to load timing data'}</div>
  }
  if (!safeRows.length) {
    return <div className="p-3 text-text-muted">No timing data available</div>
  }

  return (
    <div
      className="h-full overflow-y-auto rounded-md border border-border bg-bg-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
      ref={(el) => {
        if (!el) return
        const h = el.clientHeight
        if (h > 0 && h !== viewportHeight) setViewportHeight(h)
      }}
    >
      <table className="w-full table-fixed text-[10px]">
        <thead className="sticky top-0 z-20 bg-bg-secondary/95 backdrop-blur-md shadow-[0_1px_0_var(--border-hard)]">
          <tr className="h-[28px] text-[8.5px] font-bold uppercase tracking-[0.15em] text-fg-muted">
            <th className="w-8 px-1 text-center">Pos</th>
            <th className="w-[110px] px-1 text-left">Driver Info</th>
            <th className="w-[56px] px-1 text-right">Gap</th>
            <th className="w-[56px] px-1 text-right">Int</th>
            <th className="w-[60px] px-1 text-right">Last</th>
            <th className="w-[60px] px-1 text-right">Best</th>
            <th className="w-8 px-1 text-center">Tyre</th>
            <th className="w-8 px-1 text-right">Pits</th>
            <th className="w-[54px] px-1 text-right">S1</th>
            <th className="w-[54px] px-1 text-right">S2</th>
            <th className="w-[54px] px-1 text-right">S3</th>
          </tr>
        </thead>
        <tbody>
          {visible.topPad > 0 && (
            <tr style={{ height: `${visible.topPad}px` }}>
              <td colSpan={11} />
            </tr>
          )}
          {visible.rows.map((row, idx) => (
            <TimingRowItem
              key={row.driverNumber}
              row={row}
              idx={visible.start + idx}
              selected={selectedDriver === row.driverNumber}
              sessionBestLap={sessionBestLap}
              onSelect={setSelectedDriver}
            />
          ))}
          {visible.bottomPad > 0 && (
            <tr style={{ height: `${visible.bottomPad}px` }}>
              <td colSpan={11} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
