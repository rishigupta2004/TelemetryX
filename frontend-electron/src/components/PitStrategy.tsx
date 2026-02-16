import React, { useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { COMPOUND_COLORS } from '../lib/colors'

export const PitStrategy = React.memo(function PitStrategy() {
  const tyreStints = useSessionStore((s) => s.tyreStints)
  const sessionData = useSessionStore((s) => s.sessionData)

  const driverStints = useMemo(() => {
    if (!tyreStints || tyreStints.length === 0) return []

    const grouped = new Map<string, typeof tyreStints>()
    for (const stint of tyreStints) {
      const key = stint.driver_name
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(stint)
    }

    const result = Array.from(grouped.entries()).map(([driver, stints]) => ({
      driver,
      driverNumber: stints[0].driver_number,
      position: stints[0].position,
      strategy: stints[0].tyre_strategy_sequence,
      stints: stints.sort((a, b) => a.stint_number - b.stint_number)
    }))

    result.sort((a, b) => a.position - b.position)
    return result
  }, [tyreStints])

  const totalLaps = useMemo(() => {
    if (!tyreStints || tyreStints.length === 0) return 57
    return Math.max(...tyreStints.map((s) => s.last_lap))
  }, [tyreStints])

  const getTeamColor = (driverCode: string) => {
    const driver = sessionData?.drivers?.find((d) => d.code === driverCode)
    return driver?.teamColor || '#666666'
  }

  if (!driverStints.length) {
    return (
      <div className="bg-bg-card rounded-md p-4 flex items-center justify-center text-text-muted text-sm h-full">
        No pit strategy data available
      </div>
    )
  }

  return (
    <div className="bg-bg-card rounded-md flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-text-secondary text-xs uppercase tracking-wider">
          Pit Strategy
        </span>
        <span className="text-text-muted text-[10px]">{totalLaps} laps</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {driverStints.map(({ driver, position, stints, strategy }) => (
          <div key={`${driver}-${strategy}`} className="flex items-center gap-2 mb-1.5 h-7">
            <div className="flex items-center gap-1.5 w-[72px] flex-shrink-0">
              <span className="text-text-muted text-[10px] font-mono w-5 text-right">
                P{position}
              </span>
              <div
                className="w-1 h-5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: getTeamColor(driver) }}
              />
              <span className="text-text-primary text-xs font-mono font-bold">
                {driver}
              </span>
            </div>

            <div className="flex-1 flex h-5 rounded overflow-hidden gap-px">
              {stints.map((stint) => {
                const widthPct = (stint.tyre_laps_in_stint / totalLaps) * 100
                const compound = stint.tyre_compound.toUpperCase()
                const color = COMPOUND_COLORS[compound] || '#666666'

                return (
                  <div
                    key={`${driver}-${stint.stint_number}`}
                    className="relative flex items-center justify-center overflow-hidden group cursor-default"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: `${color}33`,
                      borderTop: `2px solid ${color}`,
                      minWidth: '20px'
                    }}
                    title={`${compound} — Laps ${stint.first_lap}-${stint.last_lap} (${stint.tyre_laps_in_stint} laps)`}
                  >
                    <span className="text-[10px] font-bold font-mono" style={{ color }}>
                      {compound[0]}
                    </span>

                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] font-mono text-white">
                        L{stint.first_lap}-{stint.last_lap}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <span className="text-text-muted text-[10px] font-mono w-6 text-right flex-shrink-0">
              {stints.length - 1}P
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border flex-shrink-0">
        {Object.entries(COMPOUND_COLORS).slice(0, 5).map(([compound, color]) => (
          <div key={compound} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-text-muted text-[10px]">
              {compound[0] + compound.slice(1).toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
