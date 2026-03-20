import React from 'react'

interface Driver {
  code: string
  teamColor: string
}

interface TelemetryLegendProps {
  primaryDriverObj: Driver | undefined
  compareDriverObj: Driver | undefined
}

export const TelemetryLegend = React.memo(function TelemetryLegend({
  primaryDriverObj,
  compareDriverObj,
}: TelemetryLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span className="text-[9px] uppercase tracking-[0.14em] text-fg-muted">Legend</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {primaryDriverObj && (
          <div className="flex items-center gap-1.5">
            <div
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: primaryDriverObj.teamColor, boxShadow: `0 0 6px ${primaryDriverObj.teamColor}` }}
            />
            <span className="text-fg-secondary">{primaryDriverObj.code}</span>
          </div>
        )}
        {compareDriverObj && (
          <div className="flex items-center gap-1.5">
            <div
              className="h-0.5 w-4 rounded-full border-dash"
              style={{
                backgroundColor: compareDriverObj.teamColor,
                borderStyle: 'dashed',
                borderWidth: '0 0 2px 0',
                borderColor: compareDriverObj.teamColor,
              }}
            />
            <span className="text-fg-secondary">{compareDriverObj.code}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-red-core/30" />
          <span className="text-fg-muted">DRS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-amber-warn/30" />
          <span className="text-fg-muted">Brake</span>
        </div>
      </div>
    </div>
  )
})
