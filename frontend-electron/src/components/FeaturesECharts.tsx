import React, { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart, HeatmapChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, VisualMapComponent, LineChart, HeatmapChart, CanvasRenderer])

type RacePaceSeries = {
  code: string
  color: string
  laps: number[]
  smoothed: number[]
}

type StandingsSeries = {
  code: string
  color: string
  cumulative: number[]
}

type StandingsHeatmapRow = {
  code: string
  color: string
  byRace: number[]
  totalPoints: number
}

function formatLapTime(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value < 60) return `${value.toFixed(3)}s`
  const mins = Math.floor(value / 60)
  const secs = value % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

export function RacePaceEChart({ series }: { series: RacePaceSeries[] }) {
  const option = useMemo(() => {
    if (!series.length) return null

    return {
      backgroundColor: '#111114',
      animation: false,
      legend: {
        top: 10,
        left: 12,
        itemWidth: 10,
        itemHeight: 7,
        textStyle: { color: 'rgba(220,220,225,0.92)', fontSize: 10 },
        data: series.map((item) => item.code),
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(18,18,20,0.95)',
        borderColor: 'rgba(200,200,210,0.25)',
        textStyle: { color: '#e0e0e4', fontSize: 11 },
        valueFormatter: (v: number) => formatLapTime(Number(v)),
      },
      grid: { left: 46, right: 16, top: 38, bottom: 30 },
      xAxis: {
        type: 'value',
        name: 'Lap',
        nameTextStyle: { color: 'rgba(180,180,190,0.9)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(160,160,170,0.35)' } },
        axisLabel: { color: 'rgba(180,180,190,0.92)' },
        splitLine: { lineStyle: { color: 'rgba(160,160,170,0.16)', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Lap Time (s)',
        nameTextStyle: { color: 'rgba(180,180,190,0.9)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(160,160,170,0.35)' } },
        axisLabel: { color: 'rgba(180,180,190,0.92)' },
        splitLine: { lineStyle: { color: 'rgba(160,160,170,0.22)', type: 'dashed' } },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 14,
          bottom: 8,
          borderColor: 'rgba(140, 140, 150, 0.35)',
          fillerColor: 'rgba(100, 100, 110, 0.24)',
          backgroundColor: 'rgba(22, 22, 25, 0.75)',
          handleStyle: { color: 'rgba(200, 200, 210, 0.9)' },
        },
      ],
      series: series.map((item) => ({
        name: item.code,
        type: 'line',
        showSymbol: false,
        smooth: false,
        sampling: 'lttb',
        large: item.laps.length > 800,
        largeThreshold: 800,
        progressive: 500,
        progressiveThreshold: 1000,
        lineStyle: { color: item.color, width: 2.1, opacity: 0.9 },
        data: item.laps.map((lap, idx) => [lap, item.smoothed[idx] ?? null]),
      })),
    }
  }, [series])

  if (!option) return <div className="flex h-[360px] items-center justify-center text-sm text-text-muted">No race-pace data</div>

  return <ReactEChartsCore echarts={echarts} option={option} notMerge lazyUpdate style={{ width: '100%', height: 360 }} />
}

export function SeasonStandingsEChart({ drivers, raceCount }: { drivers: StandingsSeries[]; raceCount: number }) {
  const option = useMemo(() => {
    if (!drivers.length) return null

    return {
      backgroundColor: '#111114',
      animation: false,
      legend: {
        top: 10,
        left: 12,
        itemWidth: 10,
        itemHeight: 7,
        textStyle: { color: 'rgba(220,220,225,0.92)', fontSize: 10 },
        data: drivers.map((item) => item.code),
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(18,18,20,0.95)',
        borderColor: 'rgba(200,200,210,0.25)',
        textStyle: { color: '#e0e0e4', fontSize: 11 },
      },
      grid: { left: 52, right: 16, top: 38, bottom: 30 },
      xAxis: {
        type: 'value',
        min: 1,
        max: Math.max(1, raceCount),
        interval: 1,
        name: 'Race Index',
        nameTextStyle: { color: 'rgba(180,180,190,0.9)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(160,160,170,0.35)' } },
        axisLabel: { color: 'rgba(180,180,190,0.92)', formatter: (v: number) => `R${Math.round(v)}` },
        splitLine: { lineStyle: { color: 'rgba(160,160,170,0.16)', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Cumulative Points',
        nameTextStyle: { color: 'rgba(180,180,190,0.9)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(160,160,170,0.35)' } },
        axisLabel: { color: 'rgba(180,180,190,0.92)' },
        splitLine: { lineStyle: { color: 'rgba(160,160,170,0.22)', type: 'dashed' } },
      },
      series: drivers.map((driver) => ({
        name: driver.code,
        type: 'line',
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        progressive: 300,
        progressiveThreshold: 700,
        lineStyle: { color: driver.color, width: 2.1, opacity: 0.9 },
        itemStyle: { color: driver.color },
        data: driver.cumulative.map((value, idx) => [idx + 1, value]),
      })),
    }
  }, [drivers, raceCount])

  if (!option) return <div className="flex h-[340px] items-center justify-center text-sm text-text-muted">No standings data</div>

  return <ReactEChartsCore echarts={echarts} option={option} notMerge lazyUpdate style={{ width: '100%', height: 340 }} />
}

export function StandingsHeatmapEChart({
  raceNames,
  drivers,
}: {
  raceNames: string[]
  drivers: StandingsHeatmapRow[]
}) {
  const option = useMemo(() => {
    if (!raceNames.length || !drivers.length) return null

    const maxPoint = Math.max(1, ...drivers.flatMap((driver) => driver.byRace.map((value) => Number(value) || 0)))
    const data = drivers.flatMap((driver, yIdx) =>
      driver.byRace.map((value, xIdx) => [xIdx, yIdx, Number(value) || 0])
    )

    return {
      backgroundColor: '#111114',
      animation: false,
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(18,18,20,0.95)',
        borderColor: 'rgba(200,200,210,0.25)',
        textStyle: { color: '#e0e0e4', fontSize: 11 },
        formatter: (params: { value: [number, number, number] }) => {
          const [xIdx, yIdx, value] = params.value
          const race = raceNames[xIdx] || `R${xIdx + 1}`
          const driver = drivers[yIdx]?.code || '-'
          return `${driver}<br/>${race}<br/>${value.toFixed(0)} pts`
        },
      },
      grid: { left: 66, right: 16, top: 14, bottom: 34 },
      xAxis: {
        type: 'category',
        data: raceNames.map((_race, idx) => `R${idx + 1}`),
        axisLine: { lineStyle: { color: 'rgba(160,160,170,0.35)' } },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(180,180,190,0.92)', fontSize: 10 },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: drivers.map((driver) => `${driver.code} (${driver.totalPoints.toFixed(0)})`),
        axisLine: { lineStyle: { color: 'rgba(160,160,170,0.35)' } },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(220,220,225,0.9)', fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: maxPoint,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        textStyle: { color: 'rgba(180,180,190,0.9)', fontSize: 10 },
        inRange: {
          color: ['#1e1e22', '#e10600', '#ff6659'],
        },
        calculable: false,
        itemWidth: 120,
        itemHeight: 8,
      },
      series: [
        {
          name: 'Points',
          type: 'heatmap',
          data,
          progressive: 1000,
          progressiveThreshold: 1200,
          label: {
            show: true,
            color: '#e2eeff',
            fontSize: 10,
            formatter: (params: { value: [number, number, number] }) =>
              params.value[2] > 0 ? `${params.value[2].toFixed(0)}` : '-',
          },
          emphasis: {
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 1,
            },
          },
        },
      ],
    }
  }, [raceNames, drivers])

  if (!option) return <div className="flex h-[280px] items-center justify-center text-sm text-text-muted">No standings heatmap data</div>

  return <ReactEChartsCore echarts={echarts} option={option} notMerge lazyUpdate style={{ width: '100%', height: 300 }} />
}
