import React, { useEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'animejs'
import { UndercutPredictor } from '../components/UndercutPredictor'
import { PitStrategy } from '../components/PitStrategy'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'
import { api } from '../api/client'
import { useSessionStore } from '../stores/sessionStore'
import type { StrategyRecommendationItem, StrategyRecommendationsResponse } from '../types'

function barWidth(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0%'
  return `${Math.max(2, Math.round((value / max) * 100))}%`
}

const FadeInPanel = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      animate(ref.current, {
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 400,
        delay,
        easing: 'easeOutCubic'
      })
    }
  }, [delay])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export const StrategyView = React.memo(function StrategyView({ active = true }: { active?: boolean }) {
  const sessionData = useSessionStore((s) => s.sessionData)
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)

  if (!sessionData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '13px'
      }}>
        Select a session to begin
      </div>
    )
  }

  const [strategyData, setStrategyData] = useState<StrategyRecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const strategyCacheRef = useRef<
    Map<string, { data: StrategyRecommendationsResponse | null; error: string | null; timestamp: number }>
  >(new Map())
  const CACHE_TTL_MS = 5 * 60 * 1000
  const FETCH_TIMEOUT_MS = 10000

  useEffect(() => {
    if (!active) return
    if (!selectedYear || !selectedRace) {
      setStrategyData(null)
      setError(null)
      return
    }

    const strategyKey = `${selectedYear}|${selectedRace}`
    const cached = strategyCacheRef.current.get(strategyKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && retryToken === 0) {
      setStrategyData(cached.data)
      setError(cached.error)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Strategy analytics request timed out')), FETCH_TIMEOUT_MS)
    })

    Promise.race([
      api.getStrategyRecommendations(selectedYear, selectedRace),
      timeoutPromise
    ])
      .then((data) => {
        if (cancelled) return
        const payload = data as StrategyRecommendationsResponse
        setStrategyData(payload)
        strategyCacheRef.current.set(strategyKey, { data: payload, error: null, timestamp: Date.now() })
      })
      .catch((err) => {
        if (cancelled) return
        const message = String(err)
        setStrategyData(null)
        setError(message)
        strategyCacheRef.current.set(strategyKey, { data: null, error: message, timestamp: Date.now() })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [active, selectedYear, selectedRace, retryToken])

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

  const hasStrategySimulations = (strategyData?.n_simulations ?? 0) > 0 && topStrategies.length > 0
  const fallbackUsed = Boolean(strategyData?.fallback_used)
  const sourceYear = strategyData?.source_year ?? null
  const availabilityReason = strategyData?.availability_reason ?? null
  const retryFetch = () => {
    if (selectedYear && selectedRace) {
      const strategyKey = `${selectedYear}|${selectedRace}`
      strategyCacheRef.current.delete(strategyKey)
    }
    setRetryToken((v) => v + 1)
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex min-h-[540px] flex-col">
        <FadeInPanel delay={0}>
          <ViewErrorBoundary viewName="Pit Strategy">
            <PitStrategy />
          </ViewErrorBoundary>
        </FadeInPanel>
      </div>

      <div className="mt-3 grid min-h-[560px] grid-cols-1 gap-3 pb-8 xl:grid-cols-2">
        <FadeInPanel delay={100}>
          <div className="min-h-0">
            <ViewErrorBoundary viewName="Undercut Predictor">
              <UndercutPredictor />
            </ViewErrorBoundary>
          </div>
        </FadeInPanel>

        <FadeInPanel delay={200} className="min-h-0 flex-1">
          <div className="h-full rounded-md border border-border bg-bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-px w-6 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-fg-secondary">Strategy Analytics</span>
                <div className="h-px w-6 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
              </div>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse rounded-md border border-border bg-bg-panel p-2.5">
                      <div className="mb-1 h-2 w-16 rounded bg-white/10" />
                      <div className="h-4 w-12 rounded bg-white/20" />
                    </div>
                  ))}
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg border border-white/5 bg-white/5 p-2.5">
                    <div className="mb-2 h-3 w-24 rounded bg-white/10" />
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded bg-white/10" />
                      <div className="h-2 w-3/4 rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-[11px] font-semibold text-fg-secondary">No strategy model data available</div>
                <div className="text-[10px] text-fg-muted">
                  Strategy recommendations haven't been generated for <span className="text-fg-secondary">{selectedYear} {selectedRace}</span>.
                </div>
                <div className="mt-1.5 text-[10px] text-fg-muted/60">
                  Verify strategy payload generation for this race, then retry.
                </div>
                <button
                  type="button"
                  onClick={retryFetch}
                  className="mt-2 rounded border border-border px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-fg-secondary hover:border-accent hover:text-fg-primary"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && strategyData && !hasStrategySimulations && (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-bg-secondary py-8 text-center">
                <div className="text-[11px] font-semibold text-fg-secondary">Strategy model has no usable runs yet</div>
                <div className="text-[10px] text-fg-muted">
                  No simulated strategy output was returned for <span className="text-fg-secondary">{selectedYear} {selectedRace}</span>.
                </div>
                {availabilityReason && (
                  <div className="text-[10px] text-fg-muted">{availabilityReason}</div>
                )}
                <button
                  type="button"
                  onClick={retryFetch}
                  className="mt-2 rounded border border-border px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-fg-secondary hover:border-accent hover:text-fg-primary"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && strategyData && hasStrategySimulations && (
              <div className="space-y-2 overflow-y-auto pr-1 text-xs">
                {(fallbackUsed || sourceYear != null) && (
                  <div className="rounded border border-border bg-bg-panel px-2.5 py-1.5 text-[10px] text-fg-secondary">
                    Source year: <span className="font-mono text-fg-primary">{sourceYear ?? selectedYear}</span>
                    {fallbackUsed && <span className="ml-2 text-amber-300">(fallback)</span>}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <FadeInPanel delay={250} className="rounded-md border border-border bg-bg-panel p-2.5">
                    <div className="mb-1 text-[9px] uppercase tracking-[0.1em] text-fg-muted">Best Avg Points</div>
                    <div className="font-mono text-base font-bold text-fg-primary">{strategyData.best_strategy?.avg_points?.toFixed(2) || '-'}</div>
                  </FadeInPanel>
                  <FadeInPanel delay={300} className="rounded-md border border-border bg-bg-panel p-2.5">
                    <div className="mb-1 text-[9px] uppercase tracking-[0.1em] text-fg-muted">Best Finish</div>
                    <div className="font-mono text-base font-bold text-fg-primary">{strategyData.best_strategy?.avg_finish_position?.toFixed(2) || '-'}</div>
                  </FadeInPanel>
                  <FadeInPanel delay={350} className="rounded-md border border-border bg-bg-panel p-2.5">
                    <div className="mb-1 text-[9px] uppercase tracking-[0.1em] text-fg-muted">Simulations</div>
                    <div className="font-mono text-base font-bold text-fg-primary">{strategyData.n_simulations || '-'}</div>
                  </FadeInPanel>
                </div>

                {topStrategies.length === 0 && <div className="text-fg-muted">No strategy rows returned</div>}

                {topStrategies.map((strategy, idx) => (
                  <FadeInPanel key={strategy.strategy} delay={400 + idx * 50}>
                    <div className="group rounded-md border border-border bg-bg-panel p-2.5 transition-all duration-200 hover:border-border-hard hover:bg-bg-hover">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="truncate font-mono text-xs font-semibold text-fg-primary">{strategy.strategy}</div>
                        <div className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                          {strategy.avg_pit_stops.toFixed(1)} stops
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="text-fg-muted">Avg Points</span>
                          <span className="font-mono font-semibold text-green-400">{strategy.avg_points.toFixed(2)}</span>
                        </div>
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/5">
                          <div 
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                            style={{ width: barWidth(strategy.avg_points, maxPoints) }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="text-fg-muted">Podium Probability</span>
                          <span className="font-mono font-semibold text-red-300">{((strategy.podium_probability ?? 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/5">
                          <div 
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-700 to-red-400 shadow-[0_0_10px_rgba(225,6,0,0.35)]"
                            style={{ width: barWidth(strategy.podium_probability || 0, maxPodium) }}
                          />
                        </div>
                      </div>
                    </div>
                  </FadeInPanel>
                ))}
              </div>
            )}
          </div>
        </FadeInPanel>
      </div>
    </div>
  )
})
