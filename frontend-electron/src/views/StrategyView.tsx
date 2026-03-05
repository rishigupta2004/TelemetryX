import React, { useEffect, useMemo, useRef, useState } from 'react'
import { UndercutPredictor } from '../components/UndercutPredictor'
import { PitStrategy } from '../components/PitStrategy'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'
import { api } from '../api/client'
import { useSessionStore } from '../stores/sessionStore'
import { strategyCandidates } from '../lib/strategyUtils'
import type { StrategyRecommendationItem, StrategyRecommendationsResponse } from '../types'

function barWidth(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0%'
  return `${Math.max(2, Math.round((value / max) * 100))}%`
}



export const StrategyView = React.memo(function StrategyView({ active }: { active: boolean }) {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const seasons = useSessionStore((s) => s.seasons)

  const [strategyData, setStrategyData] = useState<StrategyRecommendationsResponse | null>(null)
  const [strategySourceYear, setStrategySourceYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const strategyCacheRef = useRef<
    Map<string, { data: StrategyRecommendationsResponse | null; sourceYear: number | null; error: string | null }>
  >(new Map())

  const fallbackYears = useMemo(() => {
    if (!selectedYear) return []
    return strategyCandidates(seasons.map((season) => season.year), selectedYear)
  }, [seasons, selectedYear])

  useEffect(() => {
    if (!active) return
    if (!selectedYear || !selectedRace) {
      setStrategyData(null)
      setStrategySourceYear(null)
      setError(null)
      return
    }

    const strategyKey = `${selectedYear}|${selectedRace}|${fallbackYears.join(',')}`
    const cached = strategyCacheRef.current.get(strategyKey)
    if (cached) {
      setStrategyData(cached.data)
      setStrategySourceYear(cached.sourceYear)
      setError(cached.error)
      setLoading(false)
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
        strategyCacheRef.current.set(strategyKey, { data, sourceYear, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        const message = String(err)
        setStrategyData(null)
        setStrategySourceYear(null)
        setError(message)
        strategyCacheRef.current.set(strategyKey, { data: null, sourceYear: null, error: message })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [active, selectedYear, selectedRace, fallbackYears])

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
        <ViewErrorBoundary viewName="Pit Strategy">
          <PitStrategy />
        </ViewErrorBoundary>
      </div>

      <div className="grid min-h-[320px] grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="min-h-0">
          <ViewErrorBoundary viewName="Undercut Predictor">
            <UndercutPredictor />
          </ViewErrorBoundary>
        </div>

        <div className="min-h-0 rounded-md border border-border bg-bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-fg-secondary">Strategy Analytics</div>
            {strategySourceYear != null && selectedYear != null && strategySourceYear !== selectedYear && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                using {strategySourceYear}
              </span>
            )}
          </div>

          {loading && <div className="text-sm text-fg-secondary">Loading recommendations...</div>}

          {!loading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 py-6 text-center">
              <div className="text-[11px] font-semibold text-fg-secondary">No strategy model data available</div>
              <div className="text-[10px] text-fg-muted">
                Strategy recommendations haven't been generated for <span className="text-fg-secondary">{selectedYear} {selectedRace}</span>.
              </div>
              <div className="mt-1 text-[10px] text-fg-muted/60">
                Run the strategy model pipeline to generate data for this race.
              </div>
            </div>
          )}

          {!loading && !error && strategyData && (
            <div className="space-y-2 overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-border bg-bg-secondary p-2">
                  <div className="text-[10px] uppercase text-fg-muted">Best Avg Points</div>
                  <div className="font-mono text-sm text-fg-primary">{strategyData.best_strategy?.avg_points?.toFixed(2) || '-'}</div>
                </div>
                <div className="rounded border border-border bg-bg-secondary p-2">
                  <div className="text-[10px] uppercase text-fg-muted">Best Finish</div>
                  <div className="font-mono text-sm text-fg-primary">{strategyData.best_strategy?.avg_finish_position?.toFixed(2) || '-'}</div>
                </div>
                <div className="rounded border border-border bg-bg-secondary p-2">
                  <div className="text-[10px] uppercase text-fg-muted">Simulations</div>
                  <div className="font-mono text-sm text-fg-primary">{strategyData.n_simulations || '-'}</div>
                </div>
              </div>

              {topStrategies.length === 0 && <div className="text-fg-muted">No strategy rows returned</div>}

              {topStrategies.map((strategy) => (
                <div key={strategy.strategy} className="rounded border border-border bg-bg-secondary p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="truncate font-mono text-fg-primary">{strategy.strategy}</div>
                    <div className="font-mono text-[10px] text-fg-muted">stops {strategy.avg_pit_stops.toFixed(1)}</div>
                  </div>

                  <div className="mb-1">
                    <div className="mb-0.5 text-[10px] text-fg-muted">Avg Points {strategy.avg_points.toFixed(2)}</div>
                    <div className="h-2 rounded bg-bg-surface">
                      <div className="h-2 rounded bg-green-500/80" style={{ width: barWidth(strategy.avg_points, maxPoints) }} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-0.5 text-[10px] text-fg-muted">Podium Probability {((strategy.podium_probability ?? 0) * 100).toFixed(1)}%</div>
                    <div className="h-2 rounded bg-bg-surface">
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
