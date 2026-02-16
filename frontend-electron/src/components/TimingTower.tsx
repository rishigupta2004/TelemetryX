import { useMemo, useState } from 'react'
import { COMPOUND_COLORS } from '../lib/colors'
import type { TimingRow } from '../hooks/useTimingData'

interface TimingTowerProps {
  rows: TimingRow[]
}

const SECTOR_COLORS = {
  purple: '#a855f7',
  green: '#00d846',
  yellow: '#ffd700',
  white: '#a0a0a0'
} as const

function cellLap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(3)
}

export default function TimingTower({ rows }: TimingTowerProps) {
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null)

  const sessionBestLap = useMemo(() => {
    let min: number | null = null
    for (const row of rows) {
      if (row.bestLapTime == null) continue
      min = min == null ? row.bestLapTime : Math.min(min, row.bestLapTime)
    }
    return min
  }, [rows])

  if (!rows.length) {
    return <div className="p-3 text-text-muted">No timing data available</div>
  }

  return (
    <div className="h-full overflow-x-auto overflow-y-auto rounded-md border border-border bg-bg-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <table className="min-w-[676px] table-fixed text-xs">
        <thead className="sticky top-0 z-10 bg-bg-secondary/95 backdrop-blur-sm">
          <tr className="h-7 border-b border-border text-text-secondary">
            <th className="w-9 px-1 text-left">POS</th>
            <th className="w-[60px] px-1 text-left">DRIVER</th>
            <th className="w-[72px] px-1 text-right">GAP</th>
            <th className="w-[72px] px-1 text-right">INT</th>
            <th className="w-[80px] px-1 text-right">LAST</th>
            <th className="w-[80px] px-1 text-right">BEST</th>
            <th className="w-9 px-1 text-left">TYRE</th>
            <th className="w-9 px-1 text-right">PITS</th>
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

            const baseBg = idx % 2 === 0 ? 'var(--bg-card)' : '#202020'
            const selectedBg = selectedDriver === row.driverNumber ? 'var(--bg-selected)' : baseBg

            return (
              <tr
                key={row.driverNumber}
                className="h-7 cursor-pointer border-b border-border/40 hover:bg-bg-hover"
                style={{ backgroundColor: selectedBg }}
                onClick={() => {
                  setSelectedDriver(row.driverNumber)
                }}
                title={`${row.teamName} - Lap ${row.lapsCompleted}`}
              >
                <td className="px-1 font-bold">{row.position}</td>
                <td className="px-1">
                  <div
                    className="truncate border-l-[3px] pl-1.5 font-semibold"
                    style={{ borderLeftColor: row.teamColor }}
                  >
                    {row.driverCode}
                  </div>
                </td>
                <td className="px-1 text-right font-mono">{row.gap}</td>
                <td className="px-1 text-right font-mono">{row.interval}</td>
                <td className="px-1 text-right font-mono">{row.lastLap}</td>
                <td className={`px-1 text-right font-mono ${bestIsSessionBest ? 'text-[#a855f7]' : ''}`}>{row.bestLap}</td>
                <td className="px-1">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: tyreColor, color: tyreTextColor }}
                  >
                    {tyreKey?.[0] ?? '?'}
                  </div>
                </td>
                <td className="px-1 text-right font-mono">{row.pits > 0 ? row.pits : '—'}</td>
                <td className="px-1 text-right font-mono" style={{ color: SECTOR_COLORS[row.s1Color] }}>{cellLap(row.sector1)}</td>
                <td className="px-1 text-right font-mono" style={{ color: SECTOR_COLORS[row.s2Color] }}>{cellLap(row.sector2)}</td>
                <td className="px-1 text-right font-mono" style={{ color: SECTOR_COLORS[row.s3Color] }}>{cellLap(row.sector3)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
