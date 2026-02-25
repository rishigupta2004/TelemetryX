import React from 'react'
import { UPlotChart } from './UPlotChart'

type TickMode = 'default' | 'percent' | 'integer' | 'rpm' | 'binary'

type ChartSeries = { label: string; data: number[]; color: string; width?: number }

type MultiChartMetric = {
  key: string
  title: string
  height?: number
  yRange: [number, number]
  yLabel: string
  yTickMode: TickMode
  yTickUnit?: string
  stepped?: boolean
  timestamps: number[]
  series: ChartSeries[]
  markers: { x: number; label?: string }[]
}

interface TelemetryMultiChartProps {
  metrics: MultiChartMetric[]
  fullLapDuration: number
  height?: number
}

export function TelemetryMultiChart({ metrics, fullLapDuration, height = 760 }: TelemetryMultiChartProps) {
  if (!metrics.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No telemetry data for chart rendering
      </div>
    )
  }

  const metricHeights = metrics.map((metric) => metric.height ?? 100)
  const perMetricHeight = Math.max(60, Math.floor(height / Math.max(1, metrics.length)))

  return (
    <div className="w-full space-y-2">
      {metrics.map((metric, idx) => (
        <UPlotChart
          key={`${metric.key}-${idx}`}
          title={metric.title}
          timestamps={metric.timestamps}
          series={metric.series}
          height={metricHeights[idx] ?? perMetricHeight}
          yRange={metric.yRange}
          xRange={[0, fullLapDuration]}
          xLabel="Lap Time"
          yLabel={metric.yLabel}
          yTickMode={metric.yTickMode}
          yTickUnit={metric.yTickUnit}
          stepped={metric.stepped}
          markers={metric.markers}
        />
      ))}
    </div>
  )
}
