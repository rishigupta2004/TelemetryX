import React, { useCallback, useEffect, useMemo, useRef } from 'react'
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
  /** 0–1 fraction for playback cursor position within X range. Updated at 60fps via DOM ref. */
  playbackCursorFraction?: number
  /** Optional ref-based cursor control to avoid React re-renders at 60fps. */
  playbackCursorRef?: React.MutableRefObject<number | null>
  /** Called when user clicks the chart: receives the data-space X value */
  onSeek?: (dataX: number) => void
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
  onCursor,
  playbackCursorFraction,
  playbackCursorRef,
  onSeek
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const markersRef = useRef<{ x: number; label?: string }[]>(markers ?? [])
  const shadingDataRef = useRef(shadingData)
  const onCursorRef = useRef(onCursor)
  const cursorLineRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const onSeekRef = useRef(onSeek)

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
    onSeekRef.current = onSeek
    chartRef.current?.redraw()
  }, [markers, shadingData, onCursor, onSeek])

  // Update playback cursor line position via DOM ref — no React re-render
  useEffect(() => {
    if (playbackCursorRef) return
    const el = cursorLineRef.current
    if (!el) return
    if (playbackCursorFraction == null || !Number.isFinite(playbackCursorFraction)) {
      el.style.display = 'none'
      return
    }
    const pct = Math.max(0, Math.min(1, playbackCursorFraction)) * 100
    el.style.display = 'block'
    el.style.left = `${pct}%`
  }, [playbackCursorFraction, playbackCursorRef])

  useEffect(() => {
    const ref = playbackCursorRef
    if (!ref) return
    let rafId: number | null = null
    let last: number | null = null
    const tick = () => {
      const el = cursorLineRef.current
      if (!el) {
        rafId = requestAnimationFrame(tick)
        return
      }
      const value = ref.current
      if (value == null || !Number.isFinite(value)) {
        if (el.style.display !== 'none') el.style.display = 'none'
        last = null
      } else {
        const clamped = Math.max(0, Math.min(1, value))
        if (last !== clamped) {
          el.style.display = 'block'
          el.style.left = `${clamped * 100}%`
          last = clamped
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [playbackCursorRef])

  // Click handler for seek
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const handler = onSeekRef.current
    const chart = chartRef.current
    if (!handler || !chart) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    // uPlot's plot area: chart.bbox is in CSS pixels * devicePixelRatio
    const dpr = window.devicePixelRatio || 1
    const plotLeft = chart.bbox.left / dpr
    const plotWidth = chart.bbox.width / dpr
    const relX = clickX - plotLeft
    if (relX < 0 || relX > plotWidth) return
    const dataX = chart.posToVal(relX, 'x')
    if (Number.isFinite(dataX)) handler(dataX)
  }, [])

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
      padding: [8, 8, 16, 8],
      cursor: {
        show: true,
        sync: { key: 'telemetry-sync', setSeries: false },
        points: { show: false },
        y: true,
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
          stroke: 'var(--fg-muted)',
          grid: { stroke: 'var(--border-micro)', width: 1, dash: [] },
          ticks: { stroke: 'var(--border-hard)', width: 1, size: 4 },
          font: '10px var(--font-data), monospace',
          values: (_self, values) => values.map((v) => formatXTick(v))
        },
        {
          show: true,
          label: yLabel || title,
          labelSize: 14,
          labelFont: '10px var(--font-data), monospace',
          stroke: 'var(--fg-muted)',
          grid: { stroke: 'var(--border-micro)', width: 1, dash: [] },
          ticks: { stroke: 'var(--border-hard)', width: 1, size: 3 },
          font: '10px var(--font-data), monospace',
          size: 48,
          values: (_self, values) => values.map((v) => formatYTick(v))
        }
      ],
      series: [
        { label: 'Time' },
        ...series.map((s, i) => ({
          label: s.label,
          stroke: s.color,
          width: s.width || 2.5,
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
              canvas.style.background = 'transparent'
              canvas.style.borderRadius = '12px'
            }
          }
        ],
        setCursor: [
          (u: uPlot) => {
            const handler = onCursorRef.current
            const tooltip = tooltipRef.current
            const idx = u.cursor.idx

            if (idx == null || idx < 0) {
              if (handler) handler({ idx: null, x: null, values: [] })
              if (tooltip) tooltip.style.display = 'none'
              return
            }

            const xVal = Number((u.data?.[0] as ArrayLike<number> | undefined)?.[idx])
            const values = series.map((_, i) => {
              const raw = Number((u.data?.[i + 1] as ArrayLike<number> | undefined)?.[idx])
              return Number.isFinite(raw) ? raw : NaN
            })

            if (handler) handler({ idx, x: Number.isFinite(xVal) ? xVal : null, values })

            if (tooltip) {
              const left = u.cursor.left ?? 0
              const containerRect = u.over.getBoundingClientRect()
              const tipWidth = 140
              const xPos = left + 12 > containerRect.width - tipWidth ? left - tipWidth - 12 : left + 12

              tooltip.style.display = 'block'
              tooltip.style.left = `${xPos}px`
              tooltip.style.top = '8px'

              let html = `<div style="font-size:10px;color:#a0a0a8;margin-bottom:4px">${formatXTick(xVal)}</div>`
              series.forEach((s, i) => {
                const v = values[i]
                if (Number.isFinite(v)) {
                  html += `<div style="color:${s.color}">${s.label}: <b>${formatYTick(v)}</b></div>`
                }
              })
              tooltip.innerHTML = html
            }
          }
        ],
        draw: [
          (u: uPlot) => {
            const markerRows = markersRef.current
            const shade = shadingDataRef.current
            const ctx = u.ctx
            const top = u.bbox.top
            const bottom = top + u.bbox.height

            // Minor grid for dense telemetry texture
            const xMin = u.scales.x.min
            const xMax = u.scales.x.max
            if (typeof xMin === 'number' && typeof xMax === 'number' && Number.isFinite(xMin) && Number.isFinite(xMax)) {
              const divisions = 14
              const step = (xMax - xMin) / divisions
              ctx.save()
              ctx.strokeStyle = 'var(--border-micro)'
              ctx.lineWidth = 1
              ctx.setLineDash([])
              for (let i = 1; i < divisions; i += 1) {
                const xVal = xMin + step * i
                const x = u.valToPos(xVal, 'x', true)
                ctx.beginPath()
                ctx.moveTo(x, top)
                ctx.lineTo(x, bottom)
                ctx.stroke()
              }
              ctx.restore()
            }

            if (shade?.drs?.length && timestamps.length === shade.drs.length) {
              ctx.save()
              ctx.fillStyle = 'rgba(225, 6, 0, 0.08)'
              for (let i = 0; i < shade.drs.length; i += 1) {
                if ((shade.drs[i] ?? 0) < 0.5) continue
                const x = u.valToPos(timestamps[i], 'x', true)
                ctx.fillRect(x - 1.6, top, 3.2, bottom - top)
              }
              ctx.restore()
            }

            if (!markerRows.length) return
            ctx.save()
            ctx.strokeStyle = 'rgba(130, 145, 160, 0.35)'
            ctx.fillStyle = 'rgba(200, 210, 220, 0.85)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 6])
            for (const marker of markerRows) {
              const x = u.valToPos(marker.x, 'x', true)
              ctx.beginPath()
              ctx.moveTo(x, top)
              ctx.lineTo(x, bottom)
              ctx.stroke()
              if (marker.label) {
                const label = marker.label.toUpperCase()
                ctx.setLineDash([])
                ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace'
                const metrics = ctx.measureText(label)
                const padX = 5
                const padY = 2
                const boxW = metrics.width + padX * 2
                const boxH = 12
                const boxX = x - boxW / 2
                const boxY = top + 6
                ctx.fillStyle = 'rgba(12, 14, 20, 0.85)'
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'
                ctx.lineWidth = 1
                ctx.beginPath()
                if (typeof ctx.roundRect === 'function') {
                  ctx.roundRect(boxX, boxY, boxW, boxH, 4)
                } else {
                  ctx.rect(boxX, boxY, boxW, boxH)
                }
                ctx.fill()
                ctx.stroke()
                ctx.fillStyle = 'rgba(210, 220, 235, 0.9)'
                ctx.fillText(label, boxX + padX, boxY + boxH - padY - 1)
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

  const wrapperClass = frame ? 'w-full p-2 border border-border-hard bg-bg-surface' : 'w-full'

  return (
    <div className={wrapperClass}>
      {showHeader && (
        <>
          <div className="mb-0.5 px-1 text-[10px] font-bold uppercase tracking-widest text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>{title}</div>
          <div className="mb-1.5 px-1 font-mono text-[10px] text-fg-muted">{subtitle}</div>
        </>
      )}
      <div
        ref={containerRef}
        className="chart-surface w-full"
        style={{ height: `${height}px`, position: 'relative', minWidth: 0, overflow: 'visible' }}
        onClick={handleClick}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none' }}
      >
        {/* Playback cursor line — positioned via DOM ref at 60fps */}
        <div
          ref={cursorLineRef}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '1px',
            background: 'var(--brand-core)',
            pointerEvents: 'none',
            zIndex: 10,
            display: 'none',
            willChange: 'left'
          }}
        />
        {/* Hover tooltip */}
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            pointerEvents: 'none',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hard)',
            borderRadius: 2,
            padding: '4px 8px',
            fontFamily: 'var(--font-data), monospace',
            fontSize: 10,
            lineHeight: '16px',
            color: 'var(--fg-primary)',
            zIndex: 20,
            minWidth: 120,
          }}
        />
      </div>
    </div>
  )
}
