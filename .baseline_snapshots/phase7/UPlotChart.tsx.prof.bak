import React, { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface UPlotChartProps {
  title: string
  timestamps: number[]
  series: {
    label: string
    data: number[]
    color: string
    width?: number
  }[]
  height: number
  yRange?: [number, number]
  yLabel?: string
  stepped?: boolean
}

export function UPlotChart({ title, timestamps, series, height, yRange, yLabel, stepped }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)

  useEffect(() => {
    if (!containerRef.current || timestamps.length === 0) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const container = containerRef.current
    const width = Math.max(320, container.clientWidth)
    const steppedPath = stepped ? uPlot.paths.stepped({ align: 1 }) : undefined

    const opts: uPlot.Options = {
      width,
      height,
      padding: [8, 12, 0, 0],
      hooks: {
        init: [
          (u: uPlot) => {
            const canvas = u.root.querySelector('canvas')
            if (canvas) canvas.style.background = '#1a1a1a'
          }
        ]
      },
      cursor: {
        show: true,
        x: true,
        y: true,
        points: { show: false },
        sync: { key: 'telemetry-sync', setSeries: false }
      },
      scales: {
        x: { time: false },
        y: yRange ? { range: () => yRange } : {}
      },
      axes: [
        {
          show: true,
          stroke: '#888',
          grid: { stroke: '#1a1a1a', width: 1 },
          ticks: { stroke: '#333', width: 1 },
          font: '10px monospace',
          values: (_self, values) =>
            values.map((v) => {
              if (v < 60) return `${v.toFixed(0)}s`
              const mins = Math.floor(v / 60)
              const secs = Math.floor(v % 60)
              return `${mins}:${String(secs).padStart(2, '0')}`
            })
        },
        {
          show: true,
          label: yLabel || title,
          stroke: '#888',
          grid: { stroke: '#1a1a1a', width: 1 },
          ticks: { stroke: '#333', width: 1 },
          font: '10px monospace',
          size: 50
        }
      ],
      series: [
        { label: 'Time' },
        ...series.map((s, i) => ({
          label: s.label,
          stroke: s.color,
          width: s.width || 1.5,
          dash: i > 0 ? [8, 4] : undefined,
          paths: steppedPath
        }))
      ]
    }

    const plotData: uPlot.AlignedData = [
      new Float64Array(timestamps),
      ...series.map((s) => new Float64Array(s.data))
    ]

    chartRef.current = new uPlot(opts, plotData, container)

    const resizeObserver = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return
      chartRef.current.setSize({
        width: Math.max(320, containerRef.current.clientWidth),
        height
      })
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [timestamps, series, height, yRange, yLabel, title, stepped])

  if (!timestamps.length) {
    return (
      <div className="flex items-center justify-center text-sm text-text-muted" style={{ height }}>
        No {title.toLowerCase()} data
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-1 px-2 text-xs uppercase tracking-wider text-text-secondary">{title}</div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
