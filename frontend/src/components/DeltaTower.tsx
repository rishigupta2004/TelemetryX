import { useMemo } from 'react'
import { useTimingData } from '../hooks/useTimingData'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import type { LapRow } from '../types'

export interface DeltaData {
  driverCode: string
  gapToLeader: string
  intervalToAhead: string
  trend: 'gaining' | 'losing' | 'stable'
  trendValue: number
}

const TREND_THRESHOLD = 0.1

function getTrendColor(trend?: string): string {
  if (trend === 'gaining') return 'text-emerald-400'
  if (trend === 'losing') return 'text-red-400'
  return 'text-amber-400'
}

function parseGapToNumber(gap: string): number | null {
  if (gap === 'LEADER' || gap === '—') return null
  const match = gap.match(/^[\+\-]?(\d+(?:\.\d+)?)/)
  if (!match) return null
  const num = parseFloat(match[1])
  if (gap.includes('L')) return null
  if (gap.startsWith('+')) return num
  if (gap.startsWith('-')) return -num
  return num
}

function calculateTrend(
  driverLaps: LapRow[],
  leaderCode: string,
  lapsFromStore: LapRow[]
): { trend: 'gaining' | 'losing' | 'stable'; trendValue: number } {
  if (!driverLaps.length || !lapsFromStore.length) {
    return { trend: 'stable', trendValue: 0 }
  }

  const sortedDriverLaps = [...driverLaps]
    .filter(l => l.lapTime && l.lapTime > 0 && l.position != null)
    .sort((a, b) => b.lapNumber - a.lapNumber)

  if (sortedDriverLaps.length < 2) {
    return { trend: 'stable', trendValue: 0 }
  }

  const last3Laps = sortedDriverLaps.slice(0, Math.min(3, sortedDriverLaps.length))

  const leaderLaps = lapsFromStore
    .filter(l => l.driverName === leaderCode && l.lapTime && l.lapTime > 0)
    .sort((a, b) => a.lapNumber - b.lapNumber)

  const gaps: number[] = []

  for (const lap of last3Laps) {
    const leaderLap = leaderLaps.find(l => l.lapNumber === lap.lapNumber)
    if (!leaderLap || !leaderLap.lapTime || !lap.lapTime) continue

    const leaderTime = leaderLap.lapTime
    const driverTime = lap.lapTime
    const positionDiff = leaderLap.position! - lap.position!

    if (positionDiff >= 1) {
      gaps.push(-positionDiff * leaderTime)
    } else {
      const gap = driverTime - leaderTime
      gaps.push(gap)
    }
  }

  if (gaps.length < 2) {
    return { trend: 'stable', trendValue: 0 }
  }

  const oldestGap = gaps[gaps.length - 1]
  const newestGap = gaps[0]
  const lapCount = gaps.length

  const trendValue = (newestGap - oldestGap) / lapCount

  let trend: 'gaining' | 'losing' | 'stable'
  if (trendValue < -TREND_THRESHOLD) {
    trend = 'gaining'
  } else if (trendValue > TREND_THRESHOLD) {
    trend = 'losing'
  } else {
    trend = 'stable'
  }

  return { trend, trendValue }
}

function DeltaRow({ label, value, trend, showTrendArrow }: {
  label: string
  value: string
  trend?: 'gaining' | 'losing' | 'stable'
  showTrendArrow?: boolean
}) {
  const getTrendColor = () => {
    if (trend === 'gaining') return 'text-[#4ade80] drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]'
    if (trend === 'losing') return 'text-[#ef4444] drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]'
    return 'text-[#facc15]'
  }

  const getTrendArrow = () => {
    if (trend === 'gaining') return '▲'
    if (trend === 'losing') return '▼'
    return '▶'
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono tabular-nums tracking-tight text-[14px] font-bold text-fg-primary">
          {value}
        </span>
        {showTrendArrow && trend && (
          <span className={`font-mono text-[12px] ${getTrendColor()}`}>
            {getTrendArrow()}
          </span>
        )}
      </div>
    </div>
  )
}

export default function DeltaTower() {
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const { rows, status } = useTimingData()
  const lapsFromStore = useSessionStore((s) => s.laps)

  const deltaData = useMemo((): DeltaData | null => {
    if (status !== 'ready' || !rows.length) return null

    const selectedCode = primaryDriver || rows[0]?.driverCode
    if (!selectedCode) return null

    const driverRow = rows.find(r => r.driverCode === selectedCode) || rows[0]
    if (!driverRow) return null

    const leaderCode = rows[0]?.driverCode || ''
    const isLeader = driverRow.position === 1

    const driverLaps = lapsFromStore.filter(
      l => l.driverName === selectedCode || l.driverName === driverRow.driverName
    )

    const { trend, trendValue } = isLeader
      ? { trend: 'stable' as const, trendValue: 0 }
      : calculateTrend(driverLaps, leaderCode, lapsFromStore)

    return {
      driverCode: driverRow.driverCode,
      gapToLeader: driverRow.gap,
      intervalToAhead: isLeader ? '—' : driverRow.interval,
      trend,
      trendValue
    }
  }, [rows, primaryDriver, status, lapsFromStore])

  if (status !== 'ready' || !deltaData) {
    return (
      <div className="w-[200px] h-[140px] rounded-md border border-border bg-bg-surface p-3 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-border-hard" />
        <span className="text-[10px] text-fg-muted font-bold font-mono uppercase tracking-widest animate-pulse">SYS_LOADING...</span>
      </div>
    )
  }

  return (
    <div className="w-[200px] min-h-[140px] rounded-md border border-border bg-bg-surface p-3 flex flex-col relative overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      <div className="border-b border-border/50 pb-2 mb-2 flex items-baseline">
        <span className="text-[14px] font-bold tracking-wide text-fg-primary" style={{ fontFamily: 'var(--font-heading)' }}>
          {deltaData.driverCode}
        </span>
        <span className="text-[9px] font-bold text-accent ml-2 tracking-[0.2em] font-mono">DELTA_TRK</span>
      </div>

      <div className="flex-1">
        <DeltaRow
          label="Leader"
          value={deltaData.gapToLeader}
          trend={deltaData.gapToLeader !== 'LEADER' ? deltaData.trend : undefined}
          showTrendArrow={deltaData.gapToLeader !== 'LEADER'}
        />
        <DeltaRow
          label="Ahead"
          value={deltaData.intervalToAhead}
        />
      </div>

      {deltaData.gapToLeader !== 'LEADER' && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="text-[9px] font-mono font-bold text-fg-muted uppercase tracking-widest">
            TRK_TREND: <span className={getTrendColor(deltaData.trend)}>{deltaData.trend === 'gaining' ? 'GAINING' : deltaData.trend === 'losing' ? 'LOSING' : 'STABLE'}</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums tracking-tight font-bold text-fg-secondary mt-1">
            {deltaData.trendValue > 0 ? '+' : ''}{deltaData.trendValue.toFixed(3)}s/lap
          </div>
        </div>
      )}
    </div>
  )
}
