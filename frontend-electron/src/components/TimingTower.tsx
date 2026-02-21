import { useEffect, useMemo, useRef, useState } from 'react'
import { COMPOUND_COLORS } from '../lib/colors'
import { useDriverStore } from '../stores/driverStore'
import type { TimingRow } from '../hooks/useTimingData'

interface TimingTowerProps {
  rows: TimingRow[]
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

export default function TimingTower({ rows }: TimingTowerProps) {
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)
  const selectPrimary = useDriverStore((s) => s.selectPrimary)
  const selectCompare = useDriverStore((s) => s.selectCompare)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(560)

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

    const onScroll = () => setScrollTop(node.scrollTop)
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
    }
  }, [])

  const totalRows = rows.length
  const visibleCount = Math.max(10, Math.ceil(viewportHeight / ROW_HEIGHT))
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(totalRows, startIndex + visibleCount + OVERSCAN * 2)
  const visibleRows = rows.slice(startIndex, endIndex)
  const topSpacer = startIndex * ROW_HEIGHT
  const bottomSpacer = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT)

  if (!rows.length) {
    return <div className="glass-panel flex h-full items-center justify-center rounded-2xl p-3 text-text-muted">No timing data available</div>
  }

  return (
    <div ref={containerRef} className="glass-panel h-full overflow-x-auto overflow-y-auto rounded-[22px]">
      <table className="min-w-[790px] table-fixed text-xs">
        <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(20,40,74,0.92),rgba(14,28,53,0.9))] backdrop-blur-sm">
          <tr className="h-9 border-b border-border/80 text-text-secondary">
            <th className="w-9 px-1 text-left">POS</th>
            <th className="w-[112px] px-1 text-left">DRIVER</th>
            <th className="w-[72px] px-1 text-right">GAP</th>
            <th className="w-[72px] px-1 text-right">INT</th>
            <th className="w-[80px] px-1 text-right">LAST</th>
            <th className="w-[80px] px-1 text-right">BEST</th>
            <th className="w-10 px-1 text-left">TYRE</th>
            <th className="w-10 px-1 text-right">PITS</th>
            <th className="w-[66px] px-1 text-right">S1</th>
            <th className="w-[66px] px-1 text-right">S2</th>
            <th className="w-[66px] px-1 text-right">S3</th>
          </tr>
        </thead>

        <tbody>
          {topSpacer > 0 && (
            <tr aria-hidden="true" style={{ height: topSpacer }}>
              <td colSpan={11} />
            </tr>
          )}
          {visibleRows.map((row, visibleIdx) => {
            const idx = startIndex + visibleIdx
            const tyreKey = row.tyreCompound?.toUpperCase()
            const tyreColor = COMPOUND_COLORS[tyreKey] ?? '#666666'
            const tyreTextColor = tyreKey === 'HARD' ? '#000000' : '#ffffff'
            const bestIsSessionBest =
              row.bestLapTime != null && sessionBestLap != null && Math.abs(row.bestLapTime - sessionBestLap) < 1e-6

            const baseBg = idx % 2 === 0 ? 'rgba(20,35,60,0.52)' : 'rgba(13,25,46,0.45)'
            const isPrimary = primaryDriver === row.driverCode
            const isCompare = compareDriver === row.driverCode
            const selectedBg = isPrimary ? 'rgba(49,87,142,0.68)' : baseBg

            return (
              <tr
                key={row.driverNumber}
                className="h-8 cursor-pointer border-b border-border/30 hover:bg-bg-hover/65"
                style={{ backgroundColor: selectedBg }}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey) {
                    selectCompare(isCompare ? null : row.driverCode)
                    return
                  }
                  selectPrimary(row.driverCode)
                }}
                title={`${row.teamName} - Lap ${row.lapsCompleted}`}
              >
                <td className="px-1 font-bold text-[#edf4ff]">{row.position}</td>
                <td className="px-1">
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
                    {row.teamImage && (
                      <img
                        src={row.teamImage}
                        alt={row.teamName}
                        className="h-3 w-3 rounded object-contain opacity-85"
                        loading="lazy"
                      />
                    )}
                  </div>
                </td>
                <td className="px-1 text-right font-mono">{row.gap}</td>
                <td className="px-1 text-right font-mono">{row.interval}</td>
                <td className="px-1 text-right font-mono">{row.lastLap}</td>
                <td className={`px-1 text-right font-mono ${bestIsSessionBest ? 'text-[#c17bff]' : ''}`}>{row.bestLap}</td>
                <td className="px-1">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isCompare ? 'ring-2 ring-accent-blue' : ''
                    }`}
                    style={{ backgroundColor: tyreColor, color: tyreTextColor }}
                  >
                    {tyreKey?.[0] ?? '?'}
                  </div>
                </td>
                <td className="px-1 text-right font-mono">{row.pits > 0 ? row.pits : '-'}</td>
                <td className="px-1 text-right font-mono" style={{ color: SECTOR_COLORS[row.s1Color] }}>{cellLap(row.sector1)}</td>
                <td className="px-1 text-right font-mono" style={{ color: SECTOR_COLORS[row.s2Color] }}>{cellLap(row.sector2)}</td>
                <td className="px-1 text-right font-mono" style={{ color: SECTOR_COLORS[row.s3Color] }}>{cellLap(row.sector3)}</td>
              </tr>
            )
          })}
          {bottomSpacer > 0 && (
            <tr aria-hidden="true" style={{ height: bottomSpacer }}>
              <td colSpan={11} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
