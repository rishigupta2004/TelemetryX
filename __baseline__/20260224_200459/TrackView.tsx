import React, { useMemo, useState } from 'react'
import { api } from '../api/client'
import { RaceControlFeed } from '../components/RaceControlFeed'
import { TrackMap } from '../components/TrackMap'
import { WeatherPanel } from '../components/WeatherPanel'
import { useCarPositions } from '../hooks/useCarPositions'
import { useSessionStore } from '../stores/sessionStore'
import type { CircuitInsightsResponse } from '../types'

export const TrackView = React.memo(function TrackView() {
  const selectedYear = useSessionStore((s) => s.selectedYear)
  const selectedRace = useSessionStore((s) => s.selectedRace)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [circuitInsights, setCircuitInsights] = useState<CircuitInsightsResponse | null>(null)
  const carPositions = useCarPositions()

  const mappingHealth = useMemo(() => {
    if (!carPositions.length) {
      return { mode: 'NO DATA', avgConfidence: 0, lowCount: 0 }
    }
    let fused = 0
    let timing = 0
    let confidence = 0
    let lowCount = 0
    for (const car of carPositions) {
      if (car.progressSource === 'fused') fused += 1
      else timing += 1
      confidence += car.mappingConfidence
      if (car.mappingConfidence < 0.62) lowCount += 1
    }
    return {
      mode: fused >= timing ? 'FUSED' : 'TIMING',
      avgConfidence: confidence / carPositions.length,
      lowCount
    }
  }, [carPositions])

  React.useEffect(() => {
    if (!selectedYear || !selectedRace) return
    let active = true
    api
      .getCircuitInsights(selectedYear, selectedRace)
      .then((payload) => {
        if (!active) return
        setCircuitInsights(payload)
      })
      .catch(() => {
        if (!active) return
        setCircuitInsights(null)
      })
    return () => {
      active = false
    }
  }, [selectedYear, selectedRace])

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 p-5 xl:gap-5 xl:p-6 ${isMapFullscreen ? '' : 'xl:flex-row'}`}>
      <div className={`glass-panel relative min-w-0 rounded-2xl p-2.5 ${isMapFullscreen ? 'h-full min-h-0 flex-1' : 'min-h-[52vh] xl:min-h-0 xl:flex-1'}`}>
        <button
          type="button"
          onClick={() => setIsMapFullscreen((prev) => !prev)}
          className="absolute right-4 top-3 z-20 rounded border border-border bg-bg-secondary/90 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-text-secondary transition hover:border-accent-blue/70 hover:text-text-primary"
        >
          {isMapFullscreen ? 'Exit Full Screen' : 'Full Screen Map'}
        </button>
        <TrackMap />
      </div>

      {!isMapFullscreen && (
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:w-[420px] xl:flex-shrink-0 xl:flex-col">
          <div className="glass-panel rounded-xl p-3 md:col-span-2 xl:col-span-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-secondary">Mapping Health</div>
            <div className="mt-1 font-mono text-sm text-text-primary">
              {mappingHealth.mode} | Q{Math.round(mappingHealth.avgConfidence * 100)}
            </div>
            <div className="mt-0.5 text-[11px] text-text-muted">
              {mappingHealth.lowCount > 0 ? `${mappingHealth.lowCount} low-confidence cars` : 'All cars above confidence threshold'}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-3 md:col-span-2 xl:col-span-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-secondary">Circuit Insights</div>
            {!circuitInsights ? (
              <div className="mt-1 text-xs text-text-muted">No circuit insights loaded</div>
            ) : (
              <div className="mt-1 space-y-1.5 text-xs">
                <div className="font-mono text-text-primary">
                  {circuitInsights.circuitName || selectedRace || 'Circuit'} · {circuitInsights.country || '-'}
                </div>
                <div className="text-text-muted">
                  {circuitInsights.cornerCount} corners · {circuitInsights.drsZoneCount} DRS zones · {circuitInsights.sectorCount} sectors
                </div>
                <div className="text-text-muted">
                  Length {circuitInsights.facts['Circuit Length'] || '-'} · Laps {circuitInsights.facts['Number of Laps'] || '-'}
                </div>
                <div className="text-text-muted">
                  Distance {circuitInsights.facts['Race Distance'] || '-'} · First GP {circuitInsights.facts['First Grand Prix'] || '-'}
                </div>
                <div className="text-[10px] text-text-muted">
                  Source: {circuitInsights.source}
                </div>
              </div>
            )}
          </div>

          <div className="h-[250px] md:col-span-2 xl:col-span-1">
            <WeatherPanel />
          </div>

          <div className="min-h-[220px] md:col-span-2 xl:min-h-0 xl:flex-1">
            <RaceControlFeed />
          </div>
        </div>
      )}
    </div>
  )
})
