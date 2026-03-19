import { useEffect, useMemo, useRef, useState } from 'react'
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

function cellLap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(3)
}

export default function TimingTower({ rows, status = 'ready', error = null }: TimingTowerProps) {
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null)
  const [bufferedGapInterval, setBufferedGapInterval] = useState<Map<number, { gap: string; interval: string }>>(new Map())
  const prevSignatureRef = useRef('')

  if (status === 'loading' || !rows || !Array.isArray(rows)) {
    return <div className="p-3 text-text-muted">Loading timing data...</div>
  }

  if (status === 'error') {
    return <div className="p-3 text-red-400">{error ?? 'Failed to load timing data'}</div>
  }

  if (!rows.length) {
    return <div className="p-3 text-text-muted">No timing data available</div>
  }

  useEffect(() => {
    const signature = rows.map((r) => `${r.driverNumber}:${r.position}:${r.pits}`).join('|')
    const eventChanged = signature !== prevSignatureRef.current
    prevSignatureRef.current = signature

    const commit = () => {
      setBufferedGapInterval(new Map(rows.map((r) => [r.driverNumber, { gap: r.gap, interval: r.interval }])))
    }

    if (!bufferedGapInterval.size || eventChanged) {
      commit()
      return
    }

    const id = window.setTimeout(commit, 2500)
    return () => window.clearTimeout(id)
  }, [rows, bufferedGapInterval.size])

  const sessionBestLap = useMemo(() => {
    let min: number | null = null
    for (const row of rows) {
      if (row.bestLapTime == null) continue
      min = min == null ? row.bestLapTime : Math.min(min, row.bestLapTime)
    }
    return min
  }, [rows])

  return (
    <div className="h-full overflow-x-auto overflow-y-auto rounded-md border border-border bg-bg-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <table className="min-w-[676px] table-fixed text-[11px]">
        <thead className="sticky top-0 z-10 bg-bg-secondary/95 backdrop-blur-md shadow-[0_1px_0_var(--border-hard)]">
          <tr className="h-7 text-[9px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            <th className="w-9 px-1 text-left">Pos</th>
            <th className="w-[60px] px-1 text-left">Driver</th>
            <th className="w-[72px] px-1 text-right">Gap</th>
            <th className="w-[72px] px-1 text-right">Int</th>
            <th className="w-[80px] px-1 text-right">Last</th>
            <th className="w-[80px] px-1 text-right">Best</th>
            <th className="w-9 px-1 text-center">Tyre</th>
            <th className="w-9 px-1 text-right">Pits</th>
            <th className="w-16 px-1 text-right">S1</th>
            <th className="w-16 px-1 text-right">S2</th>
            <th className="w-16 px-1 text-right">S3</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, idx) => {
            const tyreKey = row.tyreCompound?.toUpperCase()
            const tyreColor = COMPOUND_COLORS[tyreKey] ?? '#666666'
            const tyreTextColor = tyreKey === 'HARD' ? '#000000' : '#ffffff'
            const bestIsSessionBest =
              row.bestLapTime != null && sessionBestLap != null && Math.abs(row.bestLapTime - sessionBestLap) < 1e-6

            const baseBg = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)'
            const selectedBg = selectedDriver === row.driverNumber ? 'var(--bg-selected)' : baseBg

            return (
              <tr
                key={row.driverNumber}
                aria-label={`${row.driverCode} position ${row.position}`}
                className="h-7 cursor-pointer border-b border-border/30 transition-colors duration-150 hover:bg-white/5"
                style={{ backgroundColor: selectedBg }}
                onClick={() => {
                  setSelectedDriver(row.driverNumber)
                }}
                title={`${row.teamName} - Lap ${row.lapsCompleted}`}
              >
                <td className="px-1 font-mono font-bold text-fg-secondary">{row.position}</td>
                <td className="px-1">
                  <div
                    className="truncate border-l-[3px] pl-1.5 font-bold tracking-wide"
                    style={{ borderLeftColor: row.teamColor, color: 'var(--fg-primary)' }}
                  >
                    {row.driverCode}
                  </div>
                </td>
                <td className="px-1 text-right font-mono tabular-nums tracking-tighter text-fg-primary">{bufferedGapInterval.get(row.driverNumber)?.gap ?? row.gap}</td>
                <td className="px-1 text-right font-mono tabular-nums tracking-tighter text-fg-secondary">{bufferedGapInterval.get(row.driverNumber)?.interval ?? row.interval}</td>
                <td className="px-1 text-right font-mono tabular-nums tracking-tighter text-white">{row.lastLap}</td>
                <td className={`px-1 text-right font-mono tabular-nums tracking-tighter transition-all ${bestIsSessionBest ? 'text-[#d8b4fe]' : 'text-fg-primary'}`} style={{ textShadow: bestIsSessionBest ? '0 0 8px rgba(168,85,247,0.7)' : 'none' }}>{row.bestLap}</td>
                <td className="px-1 flex justify-center items-center h-7">
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-sm"
                    style={{ backgroundColor: tyreColor, color: tyreTextColor, border: `1px solid ${tyreTextColor}40` }}
                  >
                    {tyreKey?.[0] ?? '?'}
                  </div>
                </td>
                <td className="px-1 text-right font-mono tabular-nums text-fg-secondary">{row.pits > 0 ? row.pits : '—'}</td>
                <td className="px-1 text-right font-mono tabular-nums tracking-tighter" style={{ color: SECTOR_COLORS[row.s1Color], textShadow: row.s1Color === 'purple' ? '0 0 8px rgba(168,85,247,0.6)' : row.s1Color === 'green' ? '0 0 8px rgba(74,222,128,0.6)' : 'none' }}>{cellLap(row.sector1)}</td>
                <td className="px-1 text-right font-mono tabular-nums tracking-tighter" style={{ color: SECTOR_COLORS[row.s2Color], textShadow: row.s2Color === 'purple' ? '0 0 8px rgba(168,85,247,0.6)' : row.s2Color === 'green' ? '0 0 8px rgba(74,222,128,0.6)' : 'none' }}>{cellLap(row.sector2)}</td>
                <td className="px-1 text-right font-mono tabular-nums tracking-tighter" style={{ color: SECTOR_COLORS[row.s3Color], textShadow: row.s3Color === 'purple' ? '0 0 8px rgba(168,85,247,0.6)' : row.s3Color === 'green' ? '0 0 8px rgba(74,222,128,0.6)' : 'none' }}>{cellLap(row.sector3)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
