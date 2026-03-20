import React from 'react'

interface BoxPlotData {
  label: string
  min: number
  q1: number
  median: number
  mean?: number
  q3: number
  max: number
  outliers?: number[]
  color: string
}

interface BoxPlotChartProps {
  data: BoxPlotData[]
  height: number
  yLabel: string
  formatValue: (v: number) => string
}

export const BoxPlotChart = React.memo(function BoxPlotChart({
  data,
  height,
  yLabel,
  formatValue
}: BoxPlotChartProps) {
  if (!data.length) return null

  const allValues = data.flatMap(d => [d.min, d.max])
  const globalMin = Math.min(...allValues)
  const globalMax = Math.max(...allValues)
  const range = globalMax - globalMin
  const padding = range * 0.1
  const yMin = globalMin - padding
  const yMax = globalMax + padding
  const yRange = yMax - yMin

  const getPos = (val: number) => {
    return ((yMax - val) / yRange) * (height - 40) + 20
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 relative overflow-hidden" style={{ height }}>
        {/* Y-Axis Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const val = yMax - p * yRange
          const y = getPos(val)
          return (
            <React.Fragment key={p}>
              <div 
                className="absolute left-12 right-0 border-t border-border-micro/30" 
                style={{ top: y }}
              />
              <div 
                className="absolute left-0 w-10 text-[9px] font-mono text-fg-muted text-right"
                style={{ top: y - 6 }}
              >
                {formatValue(val)}
              </div>
            </React.Fragment>
          )
        })}

        {/* Box Plots */}
        <div className="absolute left-14 right-4 top-0 bottom-0 flex justify-around items-end pb-8">
          {data.map((d) => (
            <div key={d.label} className="flex flex-col items-center w-8 group">
              {/* Whiskers */}
              <div 
                className="absolute w-px bg-fg-muted/40" 
                style={{ 
                  top: getPos(d.max), 
                  bottom: height - 40 - getPos(d.min) + 20 
                }}
              />
              <div 
                className="absolute w-2 h-px bg-fg-muted/60" 
                style={{ top: getPos(d.max) }}
              />
              <div 
                className="absolute w-2 h-px bg-fg-muted/60" 
                style={{ top: getPos(d.min) }}
              />

              {/* Box */}
              <div 
                className="absolute w-4 rounded-sm border shadow-lg transition-all group-hover:scale-x-110"
                style={{ 
                  top: getPos(d.q3), 
                  height: getPos(d.q1) - getPos(d.q3),
                  backgroundColor: `${d.color}20`,
                  borderColor: d.color,
                  boxShadow: `0 0 12px ${d.color}30`
                }}
              >
                {/* Median Line (Solid) */}
                <div 
                  className="absolute left-0 right-0 h-0.5 bg-white shadow-sm"
                  style={{ top: `${(1 - (d.median - d.q1) / (d.q3 - d.q1)) * 100}%`, transform: 'translateY(-50%)' }}
                />
                
                {/* Mean Line (Dashed) */}
                {d.mean !== undefined && (
                  <div 
                    className="absolute left-0 right-0 h-px border-t border-dashed border-white/70"
                    style={{ top: `${(1 - (d.mean - d.q1) / (d.q3 - d.q1)) * 100}%` }}
                  />
                )}
              </div>

              {/* Outliers (Dots) */}
              {d.outliers?.map((o, idx) => (
                <div 
                  key={idx}
                  className="absolute w-1 h-1 rounded-full bg-fg-muted/60"
                  style={{ top: getPos(o), left: '50%', marginLeft: -2 }}
                />
              ))}

              {/* Label */}
              <div className="absolute bottom-0 text-[10px] font-bold text-fg-secondary font-mono tracking-tighter">
                {d.label}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-widest text-fg-muted font-bold text-center border-t border-border-micro pt-2">
        {yLabel} Distribution
      </div>
    </div>
  )
})
