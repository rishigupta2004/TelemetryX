import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { animate } from 'animejs'
import { rafManager } from '../utils/rafManager'

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(128, 128, 128, ${alpha})`
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `${r}, ${g}, ${b}, ${alpha}`
}

const MAX_DATA_POINTS = 2000
const CURSOR_RAF_INTERVAL = 16

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
  /** Mini-sector regions for background colouring: purple (personal best), green (session best), yellow (slower) */
  sectorRegions?: {
    startTime: number
    endTime: number
    color: 'purple' | 'green' | 'yellow'
  }[]
}

export const UPlotChart = React.memo(function UPlotChart({
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
  onSeek,
  sectorRegions
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const markersRef = useRef<{ x: number; label?: string }[]>(markers ?? [])
  const shadingDataRef = useRef(shadingData)
  const sectorRegionsRef = useRef(sectorRegions)
  const onCursorRef = useRef(onCursor)
  const cursorLineRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const onSeekRef = useRef(onSeek)
  const [isAnimatingIn, setIsAnimatingIn] = useState(true)
  const isFirstRenderRef = useRef(true)
  const prevStructureKeyRef = useRef<string>('')
  const chartIdRef = useRef<string>(`uplot-${Math.random().toString(36).slice(2, 9)}`)

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

  const structureKey = useMemo(
    () => {
      const seriesDataSample = series.length > 0 && series[0].data.length > 0
        ? series.map(s => {
            const len = s.data.length
            if (len <= 3) return s.data.join(',')
            return `${s.data[0]},${s.data[Math.floor(len / 2)]},${s.data[len - 1]}`
          }).join(';')
        : ''
      return [
        series.length,
        seriesDataSample,
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
      ].join('|')
    },
    [series, stepped, yLabel, title, yTickMode, yTickUnit, xLabel, xTickMode, xTickUnit, yRange, xRange]
  )

  const downsampledTimestamps = useMemo(() => {
    if (timestamps.length <= MAX_DATA_POINTS) return timestamps
    const step = timestamps.length / MAX_DATA_POINTS
    const result: number[] = new Array(MAX_DATA_POINTS)
    for (let i = 0; i < MAX_DATA_POINTS; i++) {
      result[i] = timestamps[Math.floor(i * step)]
    }
    return result
  }, [timestamps])

  const downsampledSeries = useMemo(() => {
    if (series.length === 0) return series
    return series.map(s => {
      if (s.data.length <= MAX_DATA_POINTS) return s
      const step = s.data.length / MAX_DATA_POINTS
      const result: number[] = new Array(MAX_DATA_POINTS)
      for (let i = 0; i < MAX_DATA_POINTS; i++) {
        result[i] = s.data[Math.floor(i * step)]
      }
      return { ...s, data: result }
    })
  }, [series])

  const plotData = useMemo((): uPlot.AlignedData => {
    // Guard against empty series
    if (!downsampledTimestamps.length || !downsampledSeries.length) {
      return [new Float64Array()]
    }
    return [
      new Float64Array(downsampledTimestamps),
      ...downsampledSeries.map((s) => new Float64Array(s.data?.length ? s.data : []))
    ]
  }, [downsampledTimestamps, downsampledSeries])

  const chartOptions = useMemo(() => {
    const measuredWidth = 800
    return {
      width: measuredWidth,
      height,
      padding: [12, 12, 20, 56],
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
          stroke: 'var(--fg-secondary)',
          grid: { stroke: 'var(--chart-grid)', width: 1, dash: [] },
          ticks: { stroke: 'var(--border-hard)', width: 1, size: 6 },
          font: '11px var(--font-data), monospace',
          values: (_self, values) => values.map((v) => formatXTick(v)),
          labelSize: 12,
          labelFont: '600 11px var(--font-heading), sans-serif',
        },
        {
          show: true,
          label: yLabel || title,
          labelSize: 13,
          labelFont: '600 11px var(--font-heading), sans-serif',
          stroke: 'var(--fg-secondary)',
          grid: { stroke: 'var(--chart-grid)', width: 1, dash: [] },
          ticks: { stroke: 'var(--border-hard)', width: 1, size: 4 },
          font: '11px var(--font-data), monospace',
          size: 52,
          values: (_self, values) => values.map((v) => formatYTick(v))
        }
      ],
      series: [
        { label: 'Time' },
        ...downsampledSeries.map((s, i) => ({
          label: s.label,
          stroke: s.color,
          width: s.width || 2.5,
          fill: `rgba(${hexToRgba(s.color, 0.15)})`,
          dash: i > 0 ? [6, 3] : undefined,
          paths: stepped ? uPlot.paths.stepped!({ align: 1 }) : uPlot.paths.linear!(),
          points: { show: false }
        }))
      ]
    } as uPlot.Options
  }, [height, xRange, xLabel, yLabel, title, yRange, downsampledSeries, stepped])

  const downsampledTimestampsRef = useRef(downsampledTimestamps)
  downsampledTimestampsRef.current = downsampledTimestamps

  useEffect(() => {
    if (isAnimatingIn && containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 400,
        easing: 'easeOutCubic',
        complete: () => setIsAnimatingIn(false)
      })
    }
  }, [structureKey, isAnimatingIn])

  useEffect(() => {
    if (!isAnimatingIn && containerRef.current) {
      containerRef.current.style.opacity = '1'
    }
  }, [isAnimatingIn])

  useEffect(() => {
    markersRef.current = markers ?? []
    shadingDataRef.current = shadingData
    sectorRegionsRef.current = sectorRegions
    onCursorRef.current = onCursor
    onSeekRef.current = onSeek
    chartRef.current?.redraw()
  }, [markers, shadingData, sectorRegions, onCursor, onSeek])

  const lastDataRef = useRef<string>('')

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
    
    let last: number | null = null
    let frameCount = 0
    
    const tick = () => {
      frameCount++
      if (frameCount % 2 !== 0) return
      
      const el = cursorLineRef.current
      if (!el) return
      
      const value = ref.current
      if (value == null || !Number.isFinite(value)) {
        if (el.style.display !== 'none') el.style.display = 'none'
        last = null
      } else {
        const clamped = Math.max(0, Math.min(1, value))
        if (last !== clamped) {
          el.style.display = 'block'
          el.style.transform = `translateX(${clamped * 100}%)`
          el.style.left = '0'
          last = clamped
        }
      }
    }
    
    rafManager.register(chartIdRef.current, tick)
    
    return () => {
      rafManager.unregister(chartIdRef.current)
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

  const seriesRef = useRef(series)
  seriesRef.current = series
  const downsampledSeriesRef = useRef(downsampledSeries)
  downsampledSeriesRef.current = downsampledSeries

  const formatXTickRef = useRef(formatXTick)
  formatXTickRef.current = formatXTick
  const formatYTickRef = useRef(formatYTick)
  formatYTickRef.current = formatYTick

  useEffect(() => {
    const el = containerRef.current
    // Guard against empty data
    if (!el || !timestamps.length || !series.length) return

    const isInitialCreate = isFirstRenderRef.current && !chartRef.current
    const structureKeyChanged = structureKey !== prevStructureKeyRef.current
    
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
    }
    prevStructureKeyRef.current = structureKey

    if (!isInitialCreate && !structureKeyChanged) return

    const measuredWidth = el.getBoundingClientRect().width || el.clientWidth || 800

    const hooks: uPlot.Options['hooks'] = {
      init: [
        (u: uPlot) => {
          const canvas = u.root.querySelector('canvas')
          if (canvas) {
            canvas.style.background = 'transparent'
            canvas.style.borderRadius = '8px'
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

          const currentSeries = downsampledSeriesRef.current
          const fmtX = formatXTickRef.current
          const fmtY = formatYTickRef.current
          const xVal = Number((u.data?.[0] as ArrayLike<number> | undefined)?.[idx])
          const values = currentSeries.map((_, i) => {
            const raw = Number((u.data?.[i + 1] as ArrayLike<number> | undefined)?.[idx])
            return Number.isFinite(raw) ? raw : NaN
          })

          if (handler) handler({ idx, x: Number.isFinite(xVal) ? xVal : null, values })

          if (tooltip) {
            const left = u.cursor.left ?? 0
            const containerRect = u.over.getBoundingClientRect()
            const tipWidth = 160
            const xPos = left + 16 > containerRect.width - tipWidth ? left - tipWidth - 16 : left + 16

            tooltip.style.display = 'block'
            tooltip.style.left = `${xPos}px`
            tooltip.style.top = '12px'

            let html = `<div style="font-size:11px;color:var(--fg-muted);margin-bottom:8px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">${fmtX(xVal)}m</div>`
            currentSeries.forEach((s, i) => {
              const v = values[i]
              if (Number.isFinite(v)) {
                html += `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
                  <span style="width:10px;height:10px;border-radius:3px;background:${s.color};box-shadow:0 0 8px ${s.color}60"></span>
                  <span style="color:var(--fg-secondary);font-size:11px;font-weight:500">${s.label}</span>
                  <span style="color:var(--fg-primary);font-weight:600;margin-left:auto;font-size:12px">${fmtY(v)}</span>
                </div>`
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
          const ts = downsampledTimestampsRef.current

          const xMin = u.scales.x.min
          const xMax = u.scales.x.max
          if (typeof xMin === 'number' && typeof xMax === 'number' && Number.isFinite(xMin) && Number.isFinite(xMax)) {
            const divisions = 12
            const step = (xMax - xMin) / divisions
            ctx.save()
            ctx.strokeStyle = 'rgba(42,42,48,0.4)'
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

          if (shade?.drs?.length && ts.length === shade.drs.length) {
            ctx.save()
            ctx.fillStyle = 'rgba(225, 6, 0, 0.12)'
            for (let i = 0; i < shade.drs.length; i += 1) {
              if ((shade.drs[i] ?? 0) < 0.5) continue
              const x = u.valToPos(ts[i], 'x', true)
              ctx.fillRect(x - 1.6, top, 3.2, bottom - top)
            }
            ctx.restore()
          }

          const sectorRegions = sectorRegionsRef.current
          if (sectorRegions && sectorRegions.length > 0 && sectorRegions.length <= 50) {
            const xMin = u.scales.x.min
            const xMax = u.scales.x.max
            if (typeof xMin === 'number' && typeof xMax === 'number' && Number.isFinite(xMin) && Number.isFinite(xMax)) {
              const colorMap: Record<string, string> = {
                purple: 'rgba(167, 139, 250, 0.1)',
                green: 'rgba(52, 211, 153, 0.1)',
                yellow: 'rgba(251, 191, 36, 0.1)'
              }
              const sortedRegions = [...sectorRegions].sort((a, b) => a.startTime - b.startTime)
              ctx.save()
              let lastColor: string | null = null
              for (const region of sortedRegions) {
                if (region.endTime < xMin || region.startTime > xMax) continue
                const color = colorMap[region.color]
                if (!color) continue
                const startX = Math.max(region.startTime, xMin)
                const endX = Math.min(region.endTime, xMax)
                if (startX >= endX) continue
                const px = u.valToPos(startX, 'x', true)
                const pxEnd = u.valToPos(endX, 'x', true)
                const width = pxEnd - px
                if (width <= 0) continue
                if (color !== lastColor) {
                  ctx.fillStyle = color
                  lastColor = color
                }
                ctx.fillRect(px, top, width, bottom - top)
              }
              ctx.restore()
            }
          }

          if (!markerRows.length) return
          ctx.save()
          ctx.strokeStyle = 'rgba(130, 145, 160, 0.4)'
          ctx.fillStyle = 'rgba(200, 210, 220, 0.9)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 6])
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
              const padX = 6
              const padY = 3
              const boxW = metrics.width + padX * 2
              const boxH = 14
              const boxX = x - boxW / 2
              const boxY = top + 8
              ctx.fillStyle = 'rgba(18, 18, 24, 0.92)'
              ctx.strokeStyle = 'rgba(255,255,255,0.15)'
              ctx.lineWidth = 1
              ctx.beginPath()
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(boxX, boxY, boxW, boxH, 4)
              } else {
                ctx.rect(boxX, boxY, boxW, boxH)
              }
              ctx.fill()
              ctx.stroke()
              ctx.fillStyle = 'rgba(200, 210, 230, 0.95)'
              ctx.fillText(label, boxX + padX, boxY + boxH - padY - 1)
              ctx.setLineDash([4, 6])
            }
          }
          ctx.restore()
        }
      ]
    }

    const opts: uPlot.Options = {
      ...chartOptions,
      hooks,
      width: measuredWidth
    }

    chartRef.current?.destroy()
    chartRef.current = null
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null

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
  }, [structureKey, height])

  const dataRef = useRef(plotData)
  dataRef.current = plotData

  useEffect(() => {
    if (!chartRef.current || !timestamps.length) return
    chartRef.current.setData(dataRef.current)
  }, [plotData])

  if (!timestamps.length || !series.length) {
    return (
      <div className="flex items-center justify-center text-sm text-text-muted" style={{ height }}>
        No {title.toLowerCase()} data
      </div>
    )
  }

  const wrapperClass = frame ? 'w-full rounded-xl border border-border-soft bg-gradient-to-b from-bg-surface to-bg-raised overflow-hidden' : 'w-full'

  return (
    <div className={wrapperClass}>
      {showHeader && (
        <>
          <div className="mb-0.5 px-3 pt-3 text-[11px] font-bold uppercase tracking-widest text-fg-secondary" style={{ fontFamily: 'var(--font-heading)' }}>{title}</div>
          <div className="mb-2 px-3 font-mono text-[10px] text-fg-muted">{subtitle}</div>
        </>
      )}
      <div
        ref={containerRef}
        className="chart-surface w-full"
        style={{ height: `${height}px`, position: 'relative', minWidth: 0, overflow: 'visible', opacity: 0, transition: 'opacity 0.3s ease' }}
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
            width: '2px',
            background: 'linear-gradient(180deg, var(--glow-blue) 0%, rgba(29,78,216,0.15) 100%)',
            pointerEvents: 'none',
            zIndex: 10,
            display: 'none',
            willChange: 'left',
            boxShadow: '0 0 12px var(--glow-blue), 0 0 24px rgba(29,78,216,0.2)'
          }}
        />
        {/* Hover tooltip */}
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            pointerEvents: 'none',
            background: 'var(--chart-tooltip-bg)',
            border: '1px solid var(--chart-tooltip-border)',
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: 'var(--font-data), monospace',
            fontSize: 11,
            lineHeight: '18px',
            color: 'var(--fg-primary)',
            zIndex: 20,
            minWidth: 140,
            boxShadow: 'var(--shadow-elevated)',
            backdropFilter: 'blur(12px)',
            transform: 'translateY(-2px)',
            transition: 'opacity 0.15s ease, transform 0.15s ease'
          }}
        />
      </div>
    </div>
  )
})
