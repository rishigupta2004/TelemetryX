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
  markers?: { x: number; label?: string }[]
}

export function UPlotChart({
  title,
  timestamps,
  series,
  height,
  yRange,
  xRange,
  yLabel,
  stepped,
  markers
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const markersRef = useRef<{ x: number; label?: string }[]>(markers ?? [])

  const structureKey = useMemo(
    () => [series.length, stepped ? 'stepped' : 'linear', yLabel || title, yRange?.[0], yRange?.[1], xRange?.[0], xRange?.[1]].join('|'),
    [series.length, stepped, yLabel, title, yRange?.[0], yRange?.[1], xRange?.[0], xRange?.[1]]
  )

  useEffect(() => {
    markersRef.current = markers ?? []
    chartRef.current?.redraw()
  }, [markers])

  useEffect(() => {
    if (!containerRef.current || !timestamps.length) return

    chartRef.current?.destroy()
    chartRef.current = null
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth || 800,
      height,
      padding: [12, 12, 10, 0],
      cursor: {
        show: true,
        sync: { key: 'telemetry-sync', setSeries: false },
        points: { show: false },
        y: false,
        x: true
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
          stroke: '#7286a7',
          grid: { stroke: '#33435f', width: 1, dash: [2, 6] },
          ticks: { stroke: '#5f7392', width: 1 },
          font: '11px monospace',
          values: (_self, values) =>
            values.map((v) => {
              if (v < 60) return `${v.toFixed(0)}`
              const mins = Math.floor(v / 60)
              const secs = Math.floor(v % 60)
              return `${mins}:${String(secs).padStart(2, '0')}`
            })
        },
        {
          show: true,
          label: yLabel || title,
          stroke: '#7286a7',
          grid: { stroke: '#2a3952', width: 1, dash: [2, 7] },
          ticks: { stroke: '#5f7392', width: 1 },
          font: '11px monospace',
          size: 56
        }
      ],
      series: [
        { label: 'Time' },
        ...series.map((s, i) => ({
          label: s.label,
          stroke: s.color,
          width: s.width || 2,
          dash: i > 0 ? [6, 3] : undefined,
          paths: stepped ? uPlot.paths.stepped!({ align: 1 }) : uPlot.paths.linear!(),
          points: { show: false }
        }))
      ],
      hooks: {
        init: [
          (u: uPlot) => {
            const canvas = u.root.querySelector('canvas')
            if (canvas) canvas.style.background = '#0a1020'
          }
        ],
        draw: [
          (u: uPlot) => {
            const markerRows = markersRef.current
            if (!markerRows.length) return

            const ctx = u.ctx
            const top = u.bbox.top
            const bottom = top + u.bbox.height

            ctx.save()
            ctx.strokeStyle = 'rgba(136, 163, 201, 0.35)'
            ctx.fillStyle = 'rgba(151, 174, 208, 0.85)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 7])

            for (const marker of markerRows) {
              const x = u.valToPos(marker.x, 'x', true)
              ctx.beginPath()
              ctx.moveTo(x, top)
              ctx.lineTo(x, bottom)
              ctx.stroke()
              if (marker.label) {
                ctx.setLineDash([])
                ctx.font = '600 12px Plus Jakarta Sans'
                ctx.fillText(marker.label, x - 9, top + 13)
                ctx.setLineDash([3, 7])
              }
            }

            ctx.restore()
          }
        ]
      }
    }

    const plotData: uPlot.AlignedData = [
      new Float64Array(timestamps),
      ...series.map((s) => new Float64Array(s.data))
    ]

    chartRef.current = new uPlot(opts, plotData, containerRef.current)

    resizeObserverRef.current = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return
      chartRef.current.setSize({
        width: containerRef.current.clientWidth,
        height
      })
    })
    resizeObserverRef.current.observe(containerRef.current)

    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [structureKey, height, Boolean(timestamps.length)])

  useEffect(() => {
    if (!chartRef.current || !timestamps.length) return
    const plotData: uPlot.AlignedData = [
      new Float64Array(timestamps),
      ...series.map((s) => new Float64Array(s.data))
    ]
    chartRef.current.setData(plotData)
  }, [timestamps, series])

  if (!timestamps.length) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm" style={{ height }}>
        No {title.toLowerCase()} data
      </div>
    )
  }

  return (
    <div className="glass-panel w-full rounded-[18px] p-2.5">
      <div className="mb-1 px-2 text-xs uppercase tracking-[0.18em] text-text-secondary">{title}</div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
