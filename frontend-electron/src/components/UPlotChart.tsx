import React, { useEffect, useMemo, useRef } from 'react'
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
  xRange?: [number, number]
  yLabel?: string
  stepped?: boolean
}

export function UPlotChart({
  title,
  timestamps,
  series,
  height,
  yRange,
  xRange,
  yLabel,
  stepped
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const seriesCountRef = useRef(0)
  const lastDataLenRef = useRef(0)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const opts = useMemo((): uPlot.Options => ({
    width: 800,
    height,
    padding: [8, 12, 0, 0],
    cursor: {
      show: true,
      sync: { key: 'telemetry-sync', setSeries: false },
      points: { show: false }
    },
    scales: {
      x: {
        time: false,
        range: xRange ? () => xRange : undefined
      },
      y: yRange ? { range: () => yRange } : {}
    },
    axes: [
      {
        show: true,
        stroke: '#666',
        grid: { stroke: '#222', width: 1 },
        ticks: { stroke: '#444', width: 1 },
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
        stroke: '#666',
        grid: { stroke: '#1a1a1a', width: 1 },
        ticks: { stroke: '#444', width: 1 },
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
        paths: stepped ? uPlot.paths.stepped!({ align: 1 }) : uPlot.paths.linear!(),
        points: { show: false }
      }))
    ],
    hooks: {
      init: [
        (u: uPlot) => {
          const canvas = u.root.querySelector('canvas')
          if (canvas) canvas.style.background = '#1a1a1a'
        }
      ]
    }
  }), [
    height,
    yRange?.[0],
    yRange?.[1],
    xRange?.[0],
    xRange?.[1],
    yLabel,
    title,
    stepped,
    series.length,
    series.map((s) => s.color).join(',')
  ])

  useEffect(() => {
    if (!containerRef.current) return

    chartRef.current?.destroy()
    chartRef.current = null
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null

    if (!timestamps.length) return

    const container = containerRef.current
    const width = container.clientWidth || 800
    const optsWithWidth = { ...opts, width }
    const plotData: uPlot.AlignedData = [
      new Float64Array(timestamps),
      ...series.map((s) => new Float64Array(s.data))
    ]

    chartRef.current = new uPlot(optsWithWidth, plotData, container)
    seriesCountRef.current = series.length
    lastDataLenRef.current = timestamps.length

    resizeObserverRef.current = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.setSize({
          width: containerRef.current.clientWidth,
          height
        })
      }
    })
    resizeObserverRef.current.observe(container)

    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
    }
  }, [opts])

  useEffect(() => {
    if (!chartRef.current) return
    if (!timestamps.length) return
    if (series.length !== seriesCountRef.current) return
    if (timestamps.length === lastDataLenRef.current) return
    lastDataLenRef.current = timestamps.length

    const plotData: uPlot.AlignedData = [
      new Float64Array(timestamps),
      ...series.map((s) => new Float64Array(s.data))
    ]
    chartRef.current.setData(plotData)
  }, [timestamps, series])

  useEffect(() => () => {
    resizeObserverRef.current?.disconnect()
    chartRef.current?.destroy()
    chartRef.current = null
  }, [])

  if (!timestamps.length) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm" style={{ height }}>
        No {title.toLowerCase()} data
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="text-text-secondary text-xs uppercase tracking-wider px-2 mb-1">
        {title}
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
