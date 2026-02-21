import React, { useEffect, useMemo, useState } from 'react'
import { UndercutPredictor } from '../components/UndercutPredictor'
import { PitStrategy } from '../components/PitStrategy'
import { api } from '../api/client'
import { useSessionStore } from '../stores/sessionStore'
import type { StrategyRecommendationItem, StrategyRecommendationsResponse } from '../types'

function barWidth(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0%'
  return `${Math.max(2, Math.round((value / max) * 100))}%`
}

function strategyCandidates(seasonYears: number[], selectedYear: number): number[] {
  const fromStore = [...seasonYears].sort((a, b) => b - a).filter((year) => year < selectedYear)
  if (fromStore.length > 0) return fromStore

  const fallback: number[] = []
  for (let year = selectedYear - 1; year >= 2018; year -= 1) fallback.push(year)
  return fallback
}

export const StrategyView = React.memo(function StrategyView() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const seasons = useSessionStore((s) => s.seasons)

  const [strategyData, setStrategyData] = useState<StrategyRecommendationsResponse | null>(null)
  const [strategySourceYear, setStrategySourceYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackYears = useMemo(() => {
    if (!selectedYear) return []
    return strategyCandidates(seasons.map((season) => season.year), selectedYear)
  }, [seasons, selectedYear])

  useEffect(() => {
    if (!selectedYear || !selectedRace) {
      setStrategyData(null)
      setStrategySourceYear(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getStrategyRecommendationsWithFallback(selectedYear, selectedRace, fallbackYears)
      .then(({ data, sourceYear }) => {
        if (cancelled) return
        setStrategyData(data)
        setStrategySourceYear(sourceYear)
      })
      .catch((err) => {
        if (cancelled) return
        setStrategyData(null)
        setStrategySourceYear(null)
        setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedRace, fallbackYears])

  const topStrategies = useMemo(() => {
    if (!strategyData?.all_strategies) return []
    return Object.values(strategyData.all_strategies)
      .filter((row): row is StrategyRecommendationItem => !!row && Number.isFinite(row.avg_points))
      .sort((a, b) => b.avg_points - a.avg_points)
      .slice(0, 6)
  }, [strategyData])

  const maxPoints = useMemo(() => {
    if (!topStrategies.length) return 0
    return Math.max(...topStrategies.map((strategy) => strategy.avg_points))
  }, [topStrategies])

  const maxPodium = useMemo(() => {
    if (!topStrategies.length) return 0
    return Math.max(...topStrategies.map((strategy) => strategy.podium_probability || 0))
  }, [topStrategies])

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="min-h-0 flex-1">
        <PitStrategy />
      </div>

      <div className="grid min-h-[320px] grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="min-h-0">
          <UndercutPredictor />
        </div>

        <div className="min-h-0 rounded-md border border-border bg-bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">Strategy Analytics</div>
            {strategySourceYear != null && selectedYear != null && strategySourceYear !== selectedYear && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                using {strategySourceYear}
              </span>
            )}
          </div>

          {loading && <div className="text-sm text-text-secondary">Loading recommendations...</div>}

          {!loading && error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              Strategy model data unavailable for this selection. {error}
            </div>
          )}

          {!loading && !error && strategyData && (
            <div className="space-y-2 overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-border bg-bg-secondary p-2">
                  <div className="text-[10px] uppercase text-text-muted">Best Avg Points</div>
                  <div className="font-mono text-sm text-text-primary">{strategyData.best_strategy?.avg_points?.toFixed(2) || '-'}</div>
                </div>
                <div className="rounded border border-border bg-bg-secondary p-2">
                  <div className="text-[10px] uppercase text-text-muted">Best Finish</div>
                  <div className="font-mono text-sm text-text-primary">{strategyData.best_strategy?.avg_finish_position?.toFixed(2) || '-'}</div>
                </div>
                <div className="rounded border border-border bg-bg-secondary p-2">
                  <div className="text-[10px] uppercase text-text-muted">Simulations</div>
                  <div className="font-mono text-sm text-text-primary">{strategyData.n_simulations || '-'}</div>
                </div>
              </div>

              {topStrategies.length === 0 && <div className="text-text-muted">No strategy rows returned</div>}

              {topStrategies.map((strategy) => (
                <div key={strategy.strategy} className="rounded border border-border bg-bg-secondary p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="truncate font-mono text-text-primary">{strategy.strategy}</div>
                    <div className="font-mono text-[10px] text-text-muted">stops {strategy.avg_pit_stops.toFixed(1)}</div>
                  </div>

                  <div className="mb-1">
                    <div className="mb-0.5 text-[10px] text-text-muted">Avg Points {strategy.avg_points.toFixed(2)}</div>
                    <div className="h-2 rounded bg-bg-card">
                      <div className="h-2 rounded bg-green-500/80" style={{ width: barWidth(strategy.avg_points, maxPoints) }} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-0.5 text-[10px] text-text-muted">Podium Probability {(strategy.podium_probability * 100).toFixed(1)}%</div>
                    <div className="h-2 rounded bg-bg-card">
                      <div className="h-2 rounded bg-purple-500/80" style={{ width: barWidth(strategy.podium_probability || 0, maxPodium) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
