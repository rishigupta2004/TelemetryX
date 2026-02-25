import React, { useEffect, useMemo, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface UPlotChartProps {
  title: string
  subtitle?: string
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
  xTickMode?: 'time' | 'distance' | 'integer' | 'default'
  xTickUnit?: string
  yLabel?: string
  yTickMode?: 'default' | 'percent' | 'integer' | 'rpm' | 'binary'
  yTickUnit?: string
  xLabel?: string
  stepped?: boolean
  markers?: { x: number; label?: string }[]
  shadingData?: { drs?: number[]; brake?: number[] }
  frame?: boolean
  showHeader?: boolean
  onCursor?: (payload: { idx: number | null; x: number | null; values: number[] }) => void
}

export function UPlotChart({
  title,
  subtitle,
  timestamps,
  series,
  height,
  yRange,
  xRange,
  yLabel,
  yTickMode = 'default',
  yTickUnit,
  xLabel,
  xTickMode = 'time',
  xTickUnit,
  stepped,
  markers,
  shadingData,
  frame = true,
  showHeader = true,
  onCursor
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const markersRef = useRef<{ x: number; label?: string }[]>(markers ?? [])
  const shadingDataRef = useRef(shadingData)
  const onCursorRef = useRef(onCursor)

  const structureKey = useMemo(
    () =>
      [
        series.length,
        stepped ? 'stepped' : 'linear',
        yLabel || title,
        yTickMode,
        yTickUnit || '',
        xLabel || '',
        xTickMode,
        xTickUnit || '',
        yRange?.[0],
        yRange?.[1],
        xRange?.[0],
        xRange?.[1]
      ].join('|'),
    [series.length, stepped, yLabel, title, yTickMode, yTickUnit, xLabel, xTickMode, xTickUnit, yRange, xRange]
  )

  const formatYTick = (value: number) => {
    if (yTickMode === 'percent') return `${Math.round(value)}%`
    if (yTickMode === 'integer') return `${Math.round(value)}`
    if (yTickMode === 'rpm') return `${Math.round(value).toLocaleString('en-US')}`
    if (yTickMode === 'binary') return value >= 0.5 ? 'ON' : 'OFF'
    if (Math.abs(value) >= 1000) return `${Math.round(value)}${yTickUnit ? ` ${yTickUnit}` : ''}`
    return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}${yTickUnit ? ` ${yTickUnit}` : ''}`
  }

  const formatXTick = (value: number) => {
    if (xTickMode === 'distance') {
      if (!Number.isFinite(value)) return '-'
      const rounded = Math.round(value)
      return xTickUnit ? `${rounded}${xTickUnit}` : `${rounded}`
    }
    if (xTickMode === 'integer') return `${Math.round(value)}`
    if (xTickMode === 'default') return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}`
    if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)}`
    const mins = Math.floor(value / 60)
    const secs = value % 60
    const wholeSecs = Math.floor(secs)
    const tenths = Math.floor((secs - wholeSecs) * 10)
    return `${mins}:${String(wholeSecs).padStart(2, '0')}.${tenths}`
  }

  useEffect(() => {
    markersRef.current = markers ?? []
    shadingDataRef.current = shadingData
    onCursorRef.current = onCursor
    chartRef.current?.redraw()
  }, [markers, shadingData, onCursor])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !timestamps.length) return

    chartRef.current?.destroy()
    chartRef.current = null
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null

    const measuredWidth = el.getBoundingClientRect().width || el.clientWidth || 800

    const opts: uPlot.Options = {
      width: measuredWidth,
      height,
      padding: [12, 14, 16, 10],
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
          label: xLabel,
          stroke: '#b7c4d3',
          grid: { stroke: 'rgba(255,255,255,0.08)', width: 1, dash: [2, 6] },
          ticks: { stroke: 'rgba(255,255,255,0.14)', width: 1, size: 4 },
          font: '12px ui-monospace, monospace',
          values: (_self, values) => values.map((v) => formatXTick(v))
        },
        {
          show: true,
          label: yLabel || title,
          labelSize: 18,
          labelFont: '12px ui-monospace, monospace',
          stroke: '#b7c4d3',
          grid: { stroke: 'rgba(255,255,255,0.08)', width: 1, dash: [2, 7] },
          ticks: { stroke: 'rgba(255,255,255,0.14)', width: 1, size: 4 },
          font: '12px ui-monospace, monospace',
          size: 64,
          values: (_self, values) => values.map((v) => formatYTick(v))
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
            if (canvas) {
              canvas.style.background = '#0b0e12'
              canvas.style.borderRadius = '10px'
            }
          }
        ],
        setCursor: [
          (u: uPlot) => {
            const handler = onCursorRef.current
            if (!handler) return
            const idx = u.cursor.idx
            if (idx == null || idx < 0) {
              handler({ idx: null, x: null, values: [] })
              return
            }
            const xVal = Number((u.data?.[0] as ArrayLike<number> | undefined)?.[idx])
            const values = series.map((_, i) => {
              const raw = Number((u.data?.[i + 1] as ArrayLike<number> | undefined)?.[idx])
              return Number.isFinite(raw) ? raw : NaN
            })
            handler({ idx, x: Number.isFinite(xVal) ? xVal : null, values })
          }
        ],
        draw: [
          (u: uPlot) => {
            const markerRows = markersRef.current
            const shade = shadingDataRef.current
            const ctx = u.ctx
            const top = u.bbox.top
            const bottom = top + u.bbox.height

            if (shade?.drs?.length && timestamps.length === shade.drs.length) {
              ctx.save()
              ctx.fillStyle = 'rgba(160, 170, 185, 0.08)'
              for (let i = 0; i < shade.drs.length; i += 1) {
                if ((shade.drs[i] ?? 0) < 0.5) continue
                const x = u.valToPos(timestamps[i], 'x', true)
                ctx.fillRect(x - 1, top, 2, bottom - top)
              }
              ctx.restore()
            }

            if (!markerRows.length) return
            ctx.save()
            ctx.strokeStyle = 'rgba(130, 145, 160, 0.3)'
            ctx.fillStyle = 'rgba(200, 210, 220, 0.85)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 6])
            for (const marker of markerRows) {
              const x = u.valToPos(marker.x, 'x', true)
              const isPlaybackCursor = String(marker.label || '').toUpperCase() === 'NOW'
              const markerStroke = isPlaybackCursor ? 'rgba(239, 68, 68, 0.92)' : 'rgba(130, 145, 160, 0.3)'
              const markerFill = isPlaybackCursor ? 'rgba(254, 202, 202, 0.95)' : 'rgba(200, 210, 220, 0.85)'
              ctx.strokeStyle = markerStroke
              ctx.fillStyle = markerFill
              ctx.beginPath()
              ctx.moveTo(x, top)
              ctx.lineTo(x, bottom)
              ctx.stroke()
              if (marker.label) {
                ctx.setLineDash([])
                ctx.font = '600 11px ui-monospace, monospace'
                ctx.fillText(marker.label, x - 8, top + 13)
                ctx.setLineDash([3, 6])
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

    chartRef.current = new uPlot(opts, plotData, el)

    resizeObserverRef.current = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return
      const w = containerRef.current.getBoundingClientRect().width || containerRef.current.clientWidth
      if (w <= 0) return
      requestAnimationFrame(() => {
        if (!chartRef.current) return
        chartRef.current.setSize({ width: w, height })
      })
    })
    resizeObserverRef.current.observe(el)

    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      chartRef.current?.destroy()
      chartRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex items-center justify-center text-sm text-text-muted" style={{ height }}>
        No {title.toLowerCase()} data
      </div>
    )
  }

  const wrapperClass = frame ? 'glass-panel w-full rounded-[16px] p-3' : 'w-full'

  return (
    <div className={wrapperClass}>
      {showHeader && (
        <>
          <div className="mb-0.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">{title}</div>
          {subtitle && <div className="mb-1.5 px-1 font-mono text-[10px] text-text-muted">{subtitle}</div>}
        </>
      )}
      <div ref={containerRef} className="w-full overflow-hidden rounded-[10px]" style={{ height: `${height}px`, position: 'relative', minWidth: 0 }} />
    </div>
  )
}
