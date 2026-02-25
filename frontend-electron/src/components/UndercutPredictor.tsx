import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useDriverStore } from '../stores/driverStore'
import { useSessionStore } from '../stores/sessionStore'
import type { DriverSummaryResponse, UndercutPredictRequest, UndercutPredictResponse } from '../types'

interface PredictorInputs {
  position_before_pit: number | null
  tyre_age: number | null
  stint_length: number | null
  compound: string | null
  track_temp: number | null
  pit_lap: number | null
  race_name: string | null
}

const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET']

function firstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return Number(value)
  }
  return null
}

function deriveInputs(summary: DriverSummaryResponse | null, raceName: string | null): PredictorInputs {
  if (!summary) {
    return {
      position_before_pit: null,
      tyre_age: null,
      stint_length: null,
      compound: null,
      track_temp: null,
      pit_lap: null,
      race_name: raceName
    }
  }

  return {
    position_before_pit: firstNumber(
      summary.lap_analysis.position,
      summary.driver_performance.end_position,
      summary.driver_performance.start_position
    ),
    tyre_age: firstNumber(summary.tyre_analysis.tyre_age, summary.lap_analysis.tyre_age_laps),
    stint_length: firstNumber(summary.tyre_analysis.stint_length, summary.strategic_analysis.stint_length),
    compound: (summary.tyre_analysis.current_compound || summary.lap_analysis.tyre_compound || null)?.toUpperCase() || null,
    track_temp: firstNumber(summary.race_context.track_temp),
    pit_lap: firstNumber(summary.strategic_analysis.optimal_pit_window, summary.lap_analysis.lap_number),
    race_name: raceName
  }
}

function inputClass(hasValue: boolean): string {
  return `rounded border px-2 py-1 font-mono text-text-primary transition ${
    hasValue
      ? 'border-border bg-bg-secondary'
      : 'border-amber-600/60 bg-amber-500/10'
  }`
}

export const UndercutPredictor = React.memo(function UndercutPredictor() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const selectedSession = useSessionStore((s) => s.selectedSession)
  const sessionData = useSessionStore((s) => s.sessionData)
  const primaryDriver = useDriverStore((s) => s.primaryDriver)
  const compareDriver = useDriverStore((s) => s.compareDriver)

  const primaryDriverQuery = useMemo(() => {
    if (!primaryDriver) return null
    const driver = (sessionData?.drivers ?? []).find((item) => item.code === primaryDriver)
    return driver ? String(driver.driverNumber) : null
  }, [primaryDriver, sessionData?.drivers])

  const [driverSummary, setDriverSummary] = useState<DriverSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [inputs, setInputs] = useState<PredictorInputs>(() => deriveInputs(null, selectedRace ?? null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UndercutPredictResponse | null>(null)

  useEffect(() => {
    if (!selectedYear || !selectedRace || !selectedSession || !primaryDriverQuery) {
      setDriverSummary(null)
      setSummaryError(null)
      setSummaryLoading(false)
      setInputs(deriveInputs(null, selectedRace ?? null))
      return
    }

    let cancelled = false
    setSummaryLoading(true)
    setSummaryError(null)

    api
      .getDriverSummary(selectedYear, selectedRace, selectedSession, primaryDriverQuery)
      .then((payload) => {
        if (cancelled) return
        setDriverSummary(payload)
        setInputs(deriveInputs(payload, selectedRace))
      })
      .catch((err) => {
        if (cancelled) return
        setDriverSummary(null)
        setSummaryError(String(err))
        setInputs(deriveInputs(null, selectedRace))
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedRace, selectedSession, primaryDriverQuery])

  const missingFields = useMemo(() => {
    const required: Array<{ key: keyof PredictorInputs; label: string }> = [
      { key: 'position_before_pit', label: 'position before pit' },
      { key: 'tyre_age', label: 'tyre age' },
      { key: 'stint_length', label: 'stint length' },
      { key: 'compound', label: 'compound' },
      { key: 'pit_lap', label: 'pit lap' },
      { key: 'race_name', label: 'race name' }
    ]

    return required
      .filter((item) => {
        const value = inputs[item.key]
        if (typeof value === 'number') return !Number.isFinite(value)
        return !value
      })
      .map((item) => item.label)
  }, [inputs])

  const updateField = <K extends keyof PredictorInputs>(key: K, value: PredictorInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  const onResetFromData = () => {
    setInputs(deriveInputs(driverSummary, selectedRace ?? null))
    setError(null)
    setResult(null)
  }

  const onPredict = async () => {
    if (missingFields.length > 0) {
      setError(`Missing required data: ${missingFields.join(', ')}`)
      setResult(null)
      return
    }

    const payload: UndercutPredictRequest = {
      position_before_pit: Number(inputs.position_before_pit),
      tyre_age: Number(inputs.tyre_age),
      stint_length: Number(inputs.stint_length),
      compound: String(inputs.compound),
      pit_lap: Number(inputs.pit_lap),
      race_name: String(inputs.race_name)
    }

    if (inputs.track_temp != null && Number.isFinite(inputs.track_temp)) {
      payload.track_temp = Number(inputs.track_temp)
    }

    setLoading(true)
    setError(null)
    try {
      const prediction = await api.predictUndercut(payload)
      setResult(prediction)
    } catch (err) {
      setResult(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-bg-card">
      <div className="border-b border-border px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">Undercut Predictor</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded border border-border bg-bg-secondary px-1.5 py-0.5 font-mono text-text-primary">
            {primaryDriver ? `Primary ${primaryDriver}` : 'No primary driver'}
          </span>
          {compareDriver && (
            <span className="rounded border border-border bg-bg-secondary px-1.5 py-0.5 font-mono text-text-secondary">
              Compare {compareDriver}
            </span>
          )}
          <span className="rounded border border-border bg-bg-secondary px-1.5 py-0.5 text-text-muted">
            {summaryLoading ? 'Source loading' : driverSummary ? 'Source synced' : 'Manual input mode'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 p-3 text-xs md:grid-cols-2">
        <label className="flex flex-col gap-1 text-text-secondary">
          Position Before Pit
          <input
            type="number"
            value={inputs.position_before_pit ?? ''}
            onChange={(e) => updateField('position_before_pit', e.target.value === '' ? null : Number(e.target.value))}
            className={inputClass(inputs.position_before_pit != null)}
          />
        </label>

        <label className="flex flex-col gap-1 text-text-secondary">
          Tyre Age
          <input
            type="number"
            value={inputs.tyre_age ?? ''}
            onChange={(e) => updateField('tyre_age', e.target.value === '' ? null : Number(e.target.value))}
            className={inputClass(inputs.tyre_age != null)}
          />
        </label>

        <label className="flex flex-col gap-1 text-text-secondary">
          Stint Length
          <input
            type="number"
            value={inputs.stint_length ?? ''}
            onChange={(e) => updateField('stint_length', e.target.value === '' ? null : Number(e.target.value))}
            className={inputClass(inputs.stint_length != null)}
          />
        </label>

        <label className="flex flex-col gap-1 text-text-secondary">
          Compound
          <select
            value={inputs.compound ?? ''}
            onChange={(e) => updateField('compound', e.target.value || null)}
            className={inputClass(!!inputs.compound)}
          >
            <option value="">Select</option>
            {COMPOUNDS.map((compound) => (
              <option key={compound} value={compound}>
                {compound}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-text-secondary">
          Track Temp (optional)
          <input
            type="number"
            value={inputs.track_temp ?? ''}
            onChange={(e) => updateField('track_temp', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded border border-border bg-bg-secondary px-2 py-1 font-mono text-text-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-text-secondary">
          Pit Lap
          <input
            type="number"
            value={inputs.pit_lap ?? ''}
            onChange={(e) => updateField('pit_lap', e.target.value === '' ? null : Number(e.target.value))}
            className={inputClass(inputs.pit_lap != null)}
          />
        </label>

        <label className="flex flex-col gap-1 text-text-secondary md:col-span-2">
          Race Name
          <input
            type="text"
            value={inputs.race_name ?? ''}
            onChange={(e) => updateField('race_name', e.target.value || null)}
            className={inputClass(!!inputs.race_name)}
          />
        </label>
      </div>

      <div className="mt-auto border-t border-border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPredict}
            disabled={loading || summaryLoading}
            className="rounded border border-border bg-bg-secondary px-3 py-1.5 text-sm text-text-primary transition hover:bg-bg-hover disabled:opacity-50"
          >
            {loading ? 'Running model...' : 'Predict undercut'}
          </button>

          <button
            type="button"
            onClick={onResetFromData}
            disabled={summaryLoading}
            className="rounded border border-border bg-bg-card px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
          >
            Reload from session data
          </button>

          <span className="text-[11px] text-text-muted">
            {summaryLoading ? 'Loading feature data...' : 'Inputs seeded from /features/.../driver-summary'}
          </span>
        </div>

        {summaryError && <div className="mb-2 text-xs text-red-400">{summaryError}</div>}
        {error && <div className="mb-2 text-xs text-red-400">{error}</div>}

        {missingFields.length > 0 && (
          <div className="mb-2 rounded border border-amber-600/50 bg-amber-500/10 p-2 text-xs text-amber-200">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em]">Waiting for required fields</div>
            <div className="flex flex-wrap gap-1">
              {missingFields.map((field) => (
                <span key={field} className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px]">
                  {field}
                </span>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded border border-border bg-bg-secondary p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-sm text-text-primary">{result.prediction}</div>
              <span className="rounded border border-border bg-bg-card px-1.5 py-0.5 font-mono text-[10px] text-text-primary">
                {(result.success_probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 text-text-secondary">Confidence: {result.confidence}</div>
            <div className="mt-1 text-text-primary">{result.summary}</div>
            <div className="mt-1 text-text-muted">{result.strategy_call}</div>
            {result.recommendations?.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-text-muted">
                {result.recommendations.map((rec, idx) => (
                  <li key={`${rec}-${idx}`}>{rec}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
