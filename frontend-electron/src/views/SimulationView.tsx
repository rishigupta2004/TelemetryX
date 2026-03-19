import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { api } from '../api/client'
import { useSessionStore } from '../stores/sessionStore'
import type {
  RegulationDiffRow,
  RegulationSimulationCompareResponse,
  RegulationSimulationResponse,
  SimulationDistribution,
  RegulationSimulationBacktestResponse,
} from '../types'

const BASELINE_OPTIONS = [2018, 2021, 2022, 2025] as const
const DEFAULT_BASELINES = [2025]
const DEFAULT_TARGET_YEAR = 2026
const DEFAULT_PROFILE: 'balanced' | 'aggressive' | 'conservative' = 'balanced'
const DEFAULT_SAMPLES = 1200
const DEFAULT_TRACK_TYPE = 'auto'
const BACKTEST_SHIFTS = [
  { label: '2018→2021', baseline: 2018, target: 2021 },
  { label: '2021→2022', baseline: 2021, target: 2022 },
  { label: '2022→2025', baseline: 2022, target: 2025 },
] as const
const SAMPLE_PRESETS = [
  { label: 'Fast', value: 400 },
  { label: 'Balanced', value: 1200 },
  { label: 'Deep', value: 3000 },
] as const
const TRACK_TYPE_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'High Downforce', value: 'high_downforce' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low Downforce', value: 'low_downforce' },
] as const

const DEBOUNCE_MS = 300

function fmtDelta(value: number, unit = 's'): string {
  if (!Number.isFinite(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(3)}${unit}`
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(1)}%`
}

function fmtMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}ms`
}

function fmtMetricValue(value: number | string | null, unit: string): string {
  if (value == null) return '--'
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return '--'
  const suffix = unit === 'text' ? '' : unit
  return `${value.toFixed(2)}${suffix}`
}

function resetDefaults(
  setBaselineYears: (value: number[]) => void,
  setTeamProfile: (value: 'balanced' | 'aggressive' | 'conservative') => void,
  setNSamples: (value: number) => void,
  setSeed: (value: number | '') => void,
  setTrackType: (value: string) => void
) {
  setBaselineYears([...DEFAULT_BASELINES])
  setTeamProfile(DEFAULT_PROFILE)
  setNSamples(DEFAULT_SAMPLES)
  setSeed('')
  setTrackType(DEFAULT_TRACK_TYPE)
}

function DistributionCard({
  title,
  distribution,
  unit,
}: {
  title: string
  distribution: SimulationDistribution
  unit: string
}) {
  return (
    <div className="rounded-lg border border-border-hard bg-bg-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-fg-muted">{title}</div>
      <div className="mt-1 text-lg font-mono text-fg-primary">{fmtDelta(distribution.p50, unit)}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-fg-muted">
        <div>P10 {fmtDelta(distribution.p10, unit)}</div>
        <div>P50 {fmtDelta(distribution.p50, unit)}</div>
        <div>P90 {fmtDelta(distribution.p90, unit)}</div>
      </div>
    </div>
  )
}

interface UseSimulationParams {
  race: string
  baselineYears: number[]
  teamProfile: 'balanced' | 'aggressive' | 'conservative'
  nSamples: number
  seed?: number
  trackType: string
  enabled: boolean
}

interface UseSimulationResult {
  result: RegulationSimulationCompareResponse | null
  isRefining: boolean
  isRough: boolean
  error: string | null
}

function useSimulation(params: UseSimulationParams): UseSimulationResult {
  const { race, baselineYears, teamProfile, nSamples, seed, trackType, enabled } = params
  
  const [roughResult, setRoughResult] = useState<RegulationSimulationCompareResponse | null>(null)
  const [refinedResult, setRefinedResult] = useState<RegulationSimulationCompareResponse | null>(null)
  const [isRefining, setIsRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const refiningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)
  
  useEffect(() => {
    if (!enabled || !race || baselineYears.length === 0) {
      setRoughResult(null)
      setRefinedResult(null)
      setIsRefining(false)
      setError(null)
      return
    }
    
    cancelledRef.current = false
    setRoughResult(null)
    setRefinedResult(null)
    setIsRefining(false)
    setError(null)
    
    if (refiningTimeoutRef.current) {
      clearTimeout(refiningTimeoutRef.current)
      refiningTimeoutRef.current = null
    }
    
    api.getRegulationSimulationCompare(race, {
      baselineYears,
      targetYear: DEFAULT_TARGET_YEAR,
      teamProfile,
      nSamples,
      seed,
      trackType,
    })
      .then((result: RegulationSimulationCompareResponse) => {
        if (cancelledRef.current) return
        setRoughResult(result)
        setIsRefining(true)
      })
      .catch(err => {
        if (cancelledRef.current) return
        setError(String(err))
      })
    
    refiningTimeoutRef.current = setTimeout(() => {
      if (cancelledRef.current) return

      api.getRegulationSimulationCompare(race, {
        baselineYears,
        targetYear: DEFAULT_TARGET_YEAR,
        teamProfile,
        nSamples: 3000,
        seed,
        trackType,
        asyncMode: true,
      })
        .then(async (result: RegulationSimulationCompareResponse | { job_id: string }) => {
          if (cancelledRef.current) return
          if ('job_id' in result && typeof result.job_id === 'string') {
            const maxAttempts = 120
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
              if (cancelledRef.current) return
              await new Promise((resolve) => setTimeout(resolve, 500))
              const status = await api.getSimulationStatus(result.job_id)
              if (status.status === 'completed' && status.result) {
                setRefinedResult(status.result)
                setIsRefining(false)
                return
              }
              if (status.status === 'failed') {
                throw new Error('Simulation job failed')
              }
            }
            throw new Error('Simulation polling timeout')
          }
          setRefinedResult(result as RegulationSimulationCompareResponse)
          setIsRefining(false)
        })
        .catch(err => {
          if (cancelledRef.current) return
          setError(String(err))
          setIsRefining(false)
        })
    }, 1200)
    
    return () => {
      cancelledRef.current = true
      if (refiningTimeoutRef.current) {
        clearTimeout(refiningTimeoutRef.current)
        refiningTimeoutRef.current = null
      }
    }
  }, [enabled, race, baselineYears, teamProfile, nSamples, seed, trackType])
  
  const result = refinedResult || roughResult
  const isRough = roughResult !== null && refinedResult === null
  
  return { result, isRefining, isRough, error }
}

export const SimulationView = React.memo(function SimulationView({ active }: { active: boolean }) {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)

  const [baselineYears, setBaselineYears] = useState<number[]>([...DEFAULT_BASELINES])
  const [teamProfile, setTeamProfile] = useState<'balanced' | 'aggressive' | 'conservative'>(DEFAULT_PROFILE)
  const [nSamples, setNSamples] = useState(DEFAULT_SAMPLES)
  const [seed, setSeed] = useState<number | ''>('')
  const [trackType, setTrackType] = useState<string>(DEFAULT_TRACK_TYPE)

  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestResult, setBacktestResult] = useState<RegulationSimulationBacktestResponse | null>(null)
  const [backtestError, setBacktestError] = useState<string | null>(null)
  const [selectedShift, setSelectedShift] = useState<{baseline: number; target: number}>({baseline: 2018, target: 2021})

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedControls, setDebouncedControls] = useState({
    baselineYears: baselineYears,
    teamProfile,
    nSamples,
    seed: seed === '' ? undefined : Number(seed),
    trackType,
  })

  const canRun = active && Number.isFinite(selectedYear || NaN) && !!selectedRace && baselineYears.length > 0

  const selectedBaselineLabel = useMemo(
    () => baselineYears.map((year) => String(year)).join(', '),
    [baselineYears]
  )

  const { result, isRefining, isRough, error: simError } = useSimulation({
    race: selectedRace || '',
    baselineYears: debouncedControls.baselineYears,
    teamProfile: debouncedControls.teamProfile,
    nSamples: debouncedControls.nSamples,
    seed: debouncedControls.seed,
    trackType: debouncedControls.trackType,
    enabled: canRun,
  })

  const simulations = useMemo<RegulationSimulationResponse[]>(() => {
    return result?.simulations || []
  }, [result])

  const simulationsWithStats = useMemo(() => {
    return simulations.map((simulation) => {
      const topStrategies = simulation.strategy_projection.slice(0, 6)
      const classificationCounts = simulation.regulation_diff.rows.reduce(
        (acc, row) => {
          if (row.classification === 'official_fixed') acc.official_fixed += 1
          else if (row.classification === 'estimated') acc.estimated += 1
          else acc.unknown += 1
          return acc
        },
        { official_fixed: 0, estimated: 0, unknown: 0 }
      )
      return { simulation, topStrategies, classificationCounts }
    })
  }, [simulations])

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      const newControls = {
        baselineYears,
        teamProfile,
        nSamples,
        seed: seed === '' ? undefined : Number(seed),
        trackType,
      }
      setDebouncedControls(newControls)
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [baselineYears, teamProfile, nSamples, seed, trackType])

  const runBacktest = useCallback(() => {
    setBacktestLoading(true)
    setBacktestError(null)
    api.getRegulationSimulationBacktest({
      baselineYear: selectedShift.baseline,
      targetYear: selectedShift.target,
      teamProfile,
      nSamples,
    })
      .then((result) => {
        setBacktestResult(result)
      })
      .catch((err) => {
        setBacktestError(String(err))
        setBacktestResult(null)
      })
      .finally(() => {
        setBacktestLoading(false)
      })
  }, [selectedShift, teamProfile, nSamples])

  function toggleBaseline(year: number): void {
    setBaselineYears((prev) => {
      if (prev.includes(year)) {
        return prev.filter((value) => value !== year)
      }
      return [...prev, year].sort((a, b) => a - b)
    })
  }

  function rowClass(row: RegulationDiffRow): string {
    if (row.classification === 'official_fixed') return 'text-emerald-300'
    if (row.classification === 'estimated') return 'text-amber-300'
    return 'text-red-300'
  }

  function classificationLabel(value: RegulationDiffRow['classification']): string {
    if (value === 'official_fixed') return 'official-fixed'
    return value
  }

  function classificationChipClass(value: RegulationDiffRow['classification']): string {
    if (value === 'official_fixed') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    if (value === 'estimated') return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
    return 'border-red-500/40 bg-red-500/10 text-red-200'
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        .pulse-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }
      `}</style>
      
      <div className="rounded-xl border border-border-hard bg-bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-secondary">Regulation Simulation</div>
          {isRough && (
            <span className="text-[10px] text-amber-300/80">Estimating...</span>
          )}
          {isRefining && (
            <span className="pulse-dot h-2 w-2 rounded-full bg-amber-400" title="Refining..." />
          )}
          <div className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[10px] font-mono text-fg-muted">
            {selectedYear || '-'} {selectedRace || '-'} {'->'} {DEFAULT_TARGET_YEAR}
          </div>
          <div className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[10px] font-mono text-fg-muted">
            Baselines {selectedBaselineLabel || '--'}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-6">
          <div className="text-[11px] text-fg-muted xl:col-span-2">
            Baselines (user selectable)
            <div className="mt-1 flex flex-wrap gap-1">
              {BASELINE_OPTIONS.map((year) => {
                const selected = baselineYears.includes(year)
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => toggleBaseline(year)}
                    className={`rounded border px-2 py-1 text-[11px] font-mono ${selected
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-border-hard bg-bg-inset text-fg-muted hover:text-fg-primary'}`}
                  >
                    {year}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setBaselineYears([...BASELINE_OPTIONS])}
                className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[11px] text-fg-muted hover:text-fg-primary"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setBaselineYears([])}
                className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[11px] text-fg-muted hover:text-fg-primary"
              >
                Clear
              </button>
            </div>
          </div>
          <label className="text-[11px] text-fg-muted">
            Team profile
            <select
              value={teamProfile}
              onChange={(e) => setTeamProfile(e.target.value as 'balanced' | 'aggressive' | 'conservative')}
              className="mt-1 w-full rounded border border-border-hard bg-bg-inset px-2 py-1 text-fg-primary"
            >
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
              <option value="conservative">Conservative</option>
            </select>
          </label>
          <label className="text-[11px] text-fg-muted">
            Monte Carlo samples
            <input
              type="number"
              min={100}
              max={5000}
              value={nSamples}
              onChange={(e) => setNSamples(Math.max(100, Math.min(5000, Number(e.target.value) || 1200)))}
              className="mt-1 w-full rounded border border-border-hard bg-bg-inset px-2 py-1 font-mono text-fg-primary"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setNSamples(preset.value)}
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${nSamples === preset.value
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                    : 'border-border-hard bg-bg-inset text-fg-muted hover:text-fg-primary'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </label>
          <label className="text-[11px] text-fg-muted">
            Seed (optional)
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 w-full rounded border border-border-hard bg-bg-inset px-2 py-1 font-mono text-fg-primary"
              placeholder="auto"
            />
          </label>
          <label className="text-[11px] text-fg-muted">
            Track type
            <select
              value={trackType}
              onChange={(e) => setTrackType(e.target.value)}
              className="mt-1 w-full rounded border border-border-hard bg-bg-inset px-2 py-1 text-fg-primary"
            >
              {TRACK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <div className="text-[11px] text-fg-muted xl:col-span-1">
            Status
            <div className="mt-1 rounded border border-border-hard bg-bg-inset px-2 py-1 font-mono text-fg-primary">
              {simError ? 'error' : result ? (isRefining ? 'refining...' : 'ready') : 'idle'}
            </div>
            {isRough && (
              <div className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                Quick Estimate
              </div>
            )}
            <button
              type="button"
              onClick={() => resetDefaults(setBaselineYears, setTeamProfile, setNSamples, setSeed, setTrackType)}
              className="mt-1 w-full rounded border border-border-hard bg-bg-inset px-2 py-1 text-[11px] text-fg-muted hover:text-fg-primary"
            >
              Reset defaults
            </button>
          </div>
        </div>
      </div>

      {!canRun && (
        <div className="rounded-xl border border-border-hard bg-bg-surface p-4 text-sm text-fg-muted">
          Select a session year and race first to run the regulation simulation.
        </div>
      )}

      {active && baselineYears.length === 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Select at least one baseline year to run comparison against 2026.
        </div>
      )}

      {canRun && !result && !simError && (
        <div className="rounded-xl border border-border-hard bg-bg-surface p-4 text-sm text-fg-muted">
          Running Monte Carlo projection against the selected regulation profile...
        </div>
      )}

      {canRun && simError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Could not run simulation: {simError}
        </div>
      )}

      {canRun && result && (
        <div className="min-h-0 flex-1 overflow-auto space-y-3">
          <div className="rounded-xl border border-border-hard bg-bg-surface p-3 text-[11px] text-fg-muted">
            <div className="flex flex-wrap items-center gap-3">
              {isRefining && (
                <div className="flex items-center gap-1 text-amber-300">
                  <span className="animate-spin">⟳</span> Refining...
                </div>
              )}
              {isRough && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                  Quick Estimate (400 samples)
                </div>
              )}
              <div>Total run {fmtMs(result?.diagnostics?.elapsed_ms_total ?? null)}</div>
              <div>Avg simulation {fmtMs(result?.diagnostics?.avg_simulation_elapsed_ms ?? null)}</div>
              <div>Cache hits {result?.diagnostics?.cache_hit_count ?? 0}</div>
            </div>
          </div>
          {((result?.failures?.length ?? 0) > 0) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              Missing baseline data for: {result?.failures.map((item) => item.baseline_year).join(', ')}
            </div>
          )}

          {simulationsWithStats.map(({ simulation, topStrategies, classificationCounts }) => {
            return (
              <div key={simulation.baseline_year} className="rounded-xl border border-border-hard bg-bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-fg-secondary">
                      {simulation.baseline_year} {'->'} {simulation.target_year}
                    </div>
                  {simulation.regulation_diff.baseline_generation && (
                    <div className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-mono text-cyan-200">
                      {simulation.regulation_diff.baseline_generation}
                    </div>
                  )}
                  {simulation.regulation_diff.target_generation && (
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-200">
                      {simulation.regulation_diff.target_generation}
                    </div>
                  )}
                  {simulation.source_year !== simulation.baseline_year && (
                    <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-300">
                      Fallback strategy data {simulation.source_year}
                    </div>
                  )}
                  <div className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[10px] text-fg-muted">
                    team {simulation.team_profile}
                  </div>
                  <div className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[10px] text-fg-muted">
                    {simulation.track_type || 'medium'}
                  </div>
                  <div className="rounded border border-border-hard bg-bg-inset px-2 py-1 text-[10px] text-fg-muted">
                    sim {fmtMs(simulation.diagnostics?.elapsed_ms ?? null)}
                  </div>
                  <div className={`rounded border px-2 py-1 text-[10px] font-mono ${simulation.diagnostics?.cache_hit
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-border-hard bg-bg-inset text-fg-muted'}`}>
                    {simulation.diagnostics?.cache_hit ? 'cache hit' : 'fresh run'}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-4">
                  <DistributionCard title="Lap Time Delta" distribution={simulation.metrics.lap_time_delta_seconds} unit="s" />
                  <DistributionCard title="Race Time Delta" distribution={simulation.metrics.race_time_delta_seconds} unit="s" />
                  <DistributionCard title="Tyre Deg Delta" distribution={simulation.metrics.tyre_degradation_delta} unit="" />
                  <DistributionCard title="Pit Loss Delta" distribution={simulation.metrics.pit_loss_delta_seconds} unit="s" />
                </div>

                <div className="mt-3 rounded-lg border border-border/50 bg-bg-raised/30 p-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-fg-secondary">Regulation Diff</div>
                    <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                      <div className={`rounded border px-2 py-0.5 ${classificationChipClass('official_fixed')}`}>
                        {classificationLabel('official_fixed')} {classificationCounts.official_fixed}
                      </div>
                      <div className={`rounded border px-2 py-0.5 ${classificationChipClass('estimated')}`}>
                        {classificationLabel('estimated')} {classificationCounts.estimated}
                      </div>
                      <div className={`rounded border px-2 py-0.5 ${classificationChipClass('unknown')}`}>
                        {classificationLabel('unknown')} {classificationCounts.unknown}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[11px] md:grid-cols-4">
                    {simulation.regulation_diff.rows.map((row) => (
                      <div key={row.key} className="rounded border border-border/40 bg-bg-inset/60 px-2 py-1">
                        <div className="text-fg-muted">{row.label}</div>
                        <div className="font-mono text-fg-primary">
                          {fmtMetricValue(row.baseline, row.unit)} {'->'} {fmtMetricValue(row.target, row.unit)}
                        </div>
                        <div className={`text-[10px] ${rowClass(row)}`}>
                          {classificationLabel(row.classification)} / {row.confidence}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-fg-secondary">Strategy Projection</div>
                <div className="mt-2 space-y-2">
                  {topStrategies.map((row) => (
                    <div key={`${simulation.baseline_year}-${row.strategy}`} className="rounded-lg border border-border/50 bg-bg-raised/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate font-mono text-xs text-fg-primary">{row.strategy}</div>
                        <div className="text-[11px] text-fg-muted">confidence {Math.round(row.confidence * 100)}%</div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-fg-muted md:grid-cols-4">
                        <div>Exp pts <span className="font-mono text-fg-primary">{row.expected_points.toFixed(2)}</span></div>
                        <div>Finish <span className="font-mono text-fg-primary">P{row.avg_finish_position.toFixed(2)}</span></div>
                        <div>Podium <span className="font-mono text-fg-primary">{fmtPct(row.podium_probability)}</span></div>
                        <div>Band <span className="font-mono text-fg-primary">{row.points_band.p10.toFixed(1)}-{row.points_band.p90.toFixed(1)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-fg-muted">{simulation.notes.join(' ')}</div>
              </div>
            )
          })}

          {simulations.length === 0 && (
            <div className="rounded-xl border border-border-hard bg-bg-surface p-4 text-sm text-fg-muted">
              No simulation output available for selected baselines.
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border-hard bg-bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-secondary">Accuracy Backtest</div>
          <div className="text-[11px] text-fg-muted">Historical regulation shift validation</div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-fg-muted">
            Regulation shift
            <select
              value={`${selectedShift.baseline}-${selectedShift.target}`}
              onChange={(e) => {
                const shift = BACKTEST_SHIFTS.find(s => `${s.baseline}-${s.target}` === e.target.value)
                if (shift) setSelectedShift({baseline: shift.baseline, target: shift.target})
              }}
              className="mt-1 rounded border border-border-hard bg-bg-inset px-2 py-1 text-fg-primary"
            >
              {BACKTEST_SHIFTS.map((shift) => (
                <option key={shift.label} value={`${shift.baseline}-${shift.target}`}>
                  {shift.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={runBacktest}
            disabled={backtestLoading}
            className="rounded border border-cyan-400/60 bg-cyan-500/20 px-3 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {backtestLoading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        {backtestLoading && (
          <div className="mt-3 rounded border border-border-hard bg-bg-inset p-3 text-sm text-fg-muted">
            Running backtest simulation...
          </div>
        )}

        {backtestError && (
          <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Backtest error: {backtestError}
          </div>
        )}

        {backtestResult && !backtestLoading && (
          <div className="mt-3 space-y-3">
            {backtestResult.backtest_results.length > 0 ? (
              <>
                <div className="rounded-lg border border-border/50 bg-bg-raised/30 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-fg-secondary mb-2">Accuracy Metrics</div>
                  <div className="grid grid-cols-2 gap-3 text-[11px] md:grid-cols-4">
                    {backtestResult.backtest_results.map((row) => (
                      <div key={row.metric} className="rounded border border-border/40 bg-bg-inset/60 p-2">
                        <div className="text-fg-muted">{row.metric}</div>
                        <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                          <div>
                            <div className="text-fg-muted">Pred</div>
                            <div className="font-mono text-fg-primary">{row.predicted.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-fg-muted">Actual</div>
                            <div className="font-mono text-fg-primary">{row.actual.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-fg-muted">Error</div>
                            <div className={`font-mono ${row.error >= 0 ? 'text-amber-300' : 'text-cyan-300'}`}>
                              {row.error >= 0 ? '+' : ''}{row.error.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {backtestResult.accuracy_summary && backtestResult.accuracy_summary.has_comparison && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200 mb-1">Model Accuracy</div>
                    <div className="flex gap-4 text-[11px]">
                      {backtestResult.accuracy_summary.mae_points != null && (
                        <div className="text-fg-muted">
                          MAE Points: <span className="font-mono text-fg-primary">{backtestResult.accuracy_summary.mae_points}</span>
                        </div>
                      )}
                      {backtestResult.accuracy_summary.mae_position != null && (
                        <div className="text-fg-muted">
                          MAE Position: <span className="font-mono text-fg-primary">{backtestResult.accuracy_summary.mae_position}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded border border-border-hard bg-bg-inset p-3 text-sm text-fg-muted">
                No backtest data available for selected shift.
              </div>
            )}
            <div className="text-[10px] text-fg-muted">{backtestResult.notes.join(' ')}</div>
          </div>
        )}
      </div>
    </div>
  )
})

export default SimulationView
