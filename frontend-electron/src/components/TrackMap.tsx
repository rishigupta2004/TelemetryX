import React, { useMemo, useState } from 'react'
import { useCarPositions } from '../hooks/useCarPositions'
import {
  computeArcLengths,
  getBounds,
  interpolateAlongPath,
  normalizeToViewport,
  parseCenterline,
  toPolylinePoints
} from '../lib/trackGeometry'
import { useSessionTime } from '../lib/timeUtils'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

interface TrackMapProps {
  compact?: boolean
}

function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return Object.values(value) as T[]
  return []
}

export function TrackMap({ compact = false }: TrackMapProps) {
  const sessionData = useSessionStore((s) => s.sessionData)
  const sessionTime = useSessionTime()
  const sessionStartTime = usePlaybackStore((s) => s.sessionStartTime)
  const carPositions = useCarPositions()
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)

  const trackData = useMemo(() => {
    const geo = sessionData?.trackGeometry
    const rawCenterline = asArray<number[]>(geo?.centerline)
    if (!rawCenterline.length) return null

    const rawPoints = parseCenterline(rawCenterline)
    const points = normalizeToViewport(rawPoints, 1000, 620, 28)
    const arcLengths = computeArcLengths(points)
    const bounds = getBounds(points, 0)
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY

    return {
      points,
      arcLengths,
      bounds,
      width,
      height,
      corners: asArray(geo?.corners),
      sectors: asArray(geo?.sectors),
      drsZones: asArray(geo?.drsZones)
    }
  }, [sessionData?.trackGeometry])

  const currentFlags = useMemo(() => {
    const raceControl = sessionData?.raceControl || []

    if (!raceControl.length) {
      return {
        latestTrackFlag: null as string | null,
        sectorFlags: {} as Record<number, string>,
        isSafetyCar: false,
        isVSC: false,
        isRedFlag: false
      }
    }
    const activeMessages = raceControl.filter(
      (m: any) => m.timestamp >= sessionStartTime && m.timestamp <= sessionTime
    )

    const trackFlags = activeMessages.filter(
      (m: any) => m.category === 'Flag' && m.scope === 'Track'
    )
    const latestTrackFlag = trackFlags.length > 0 ? trackFlags[trackFlags.length - 1] : null

    const sectorFlags: Record<number, string> = {}
    for (const msg of activeMessages) {
      if (msg.category === 'Flag' && msg.scope === 'Sector' && msg.sector) {
        if (msg.flag === 'CLEAR' || msg.flag === 'GREEN') {
          delete sectorFlags[msg.sector]
        } else {
          sectorFlags[msg.sector] = msg.flag
        }
      }
    }

    const scMessages = activeMessages.filter(
      (m: any) => m.category === 'SafetyCar'
    )
    const lastSC = scMessages.length > 0 ? scMessages[scMessages.length - 1] : null
    const text = (lastSC?.message || '').toUpperCase()
    const isSafetyCar = !!lastSC && (text.includes('DEPLOYED') || text.includes('SAFETY CAR'))
    const isVSC = !!lastSC && text.includes('VIRTUAL')
    const scEnded = !!lastSC && (text.includes('ENDING') || text.includes('IN THIS LAP'))
    const isRedFlag = latestTrackFlag?.flag === 'RED'

    return {
      latestTrackFlag: latestTrackFlag?.flag || null,
      sectorFlags,
      isSafetyCar: isSafetyCar && !scEnded,
      isVSC: isVSC && !scEnded,
      isRedFlag
    }
  }, [sessionData?.raceControl, sessionStartTime, sessionTime])

  if (!trackData) {
    return <div className="flex h-full items-center justify-center text-sm text-text-muted">Track layout not available</div>
  }

  const { points, arcLengths, bounds, width, height, sectors } = trackData
  const viewBox = `${bounds.minX} ${bounds.minY} ${width} ${height}`

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-[radial-gradient(circle_at_20%_20%,#2a2a2a_0%,#1f1f1f_40%,#181818_100%)]">
      {/* Flag status banners — top left, stacked */}
      <div className="absolute left-3 top-2 z-20 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-secondary">
          {sessionData?.trackGeometry?.name || 'Track'}
        </span>
        {currentFlags.isRedFlag && (
          <span className="animate-pulse rounded border border-red-500/50 bg-red-600/40 px-3 py-1 font-mono text-sm font-bold text-red-400">
            🔴 RED FLAG
          </span>
        )}
        {currentFlags.isSafetyCar && !currentFlags.isRedFlag && (
          <span className="rounded border border-orange-500/50 bg-orange-500/30 px-3 py-1 font-mono text-sm font-bold text-orange-400">
            🚗 SAFETY CAR
          </span>
        )}
        {currentFlags.isVSC && !currentFlags.isRedFlag && (
          <span className="rounded border border-orange-500/50 bg-orange-500/30 px-3 py-1 font-mono text-sm font-bold text-orange-400">
            ⚠ VIRTUAL SAFETY CAR
          </span>
        )}
        {currentFlags.latestTrackFlag === 'GREEN' && (
          <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-400">
            🟢 GREEN
          </span>
        )}
      </div>

      <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <polyline
          points={toPolylinePoints(points)}
          fill="none"
          stroke="#232323"
          strokeWidth={22}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={toPolylinePoints(points)}
          fill="none"
          stroke="#6a6a6a"
          strokeOpacity={0.18}
          strokeWidth={28}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="blur(2px)"
        />
        <polyline
          points={toPolylinePoints(points)}
          fill="none"
          stroke="#515151"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.length > 1 && (
          <line
            x1={points[0].x - 8}
            y1={points[0].y}
            x2={points[0].x + 8}
            y2={points[0].y}
            stroke="#ffffff"
            strokeWidth={3}
          />
        )}

        {currentFlags.isRedFlag && (
          <polyline
            points={toPolylinePoints(points)}
            fill="none"
            stroke="#ff1801"
            strokeWidth={20}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.4}
          />
        )}

        {(currentFlags.isSafetyCar || currentFlags.isVSC) && (
          <polyline
            points={toPolylinePoints(points)}
            fill="none"
            stroke="#ffd700"
            strokeWidth={20}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3}
          />
        )}

        {Object.entries(currentFlags.sectorFlags).map(([sector, flag]) => {
          if (flag !== 'DOUBLE YELLOW' && flag !== 'YELLOW') return null
          const sectorNum = Number(sector)
          const startIdx = Math.floor(((sectorNum - 1) / 3) * points.length)
          const endIdx = Math.floor((sectorNum / 3) * points.length)
          const sectorPoints = points.slice(startIdx, endIdx + 1)
          return (
            <polyline
              key={`flag-s${sector}`}
              points={toPolylinePoints(sectorPoints)}
              fill="none"
              stroke="#ffd700"
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
            />
          )
        })}

        {trackData.drsZones?.map((zone: any, i: number) => {
          const startIdx = zone?.startIndex ?? zone?.start ?? -1
          const endIdx = zone?.endIndex ?? zone?.end ?? -1
          if (startIdx < 0 || endIdx <= startIdx || endIdx >= points.length) return null
          const drsPoints = points.slice(startIdx, endIdx + 1)
          return (
            <polyline
              key={`drs-${i}`}
              points={toPolylinePoints(drsPoints)}
              fill="none"
              stroke="#00d846"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.5}
            />
          )
        })}

        {sectors.map((sector: any, i: number) => {
          const idx = sector?.startIndex ?? sector?.start ?? Math.floor((i / 3) * points.length)
          if (idx >= points.length) return null
          const p = points[idx]
          const colors = ['#ff1801', '#ffd700', '#0090ff']
          return (
            <g key={`sector-${i}`}>
              <circle cx={p.x} cy={p.y} r={6} fill={colors[i % 3]} opacity={0.8} />
              <text x={p.x + 10} y={p.y + 4} fill={colors[i % 3]} fontSize="11" fontWeight="bold" fontFamily="monospace">
                S{i + 1}
              </text>
            </g>
          )
        })}

        {carPositions.map((car) => {
          const pos = interpolateAlongPath(points, car.progress, arcLengths)
          const isHovered = hoveredDriver === car.driverCode
          const radius = compact ? 6 : 10

          return (
            <g
              key={car.driverNumber}
              onMouseEnter={() => setHoveredDriver(car.driverCode)}
              onMouseLeave={() => setHoveredDriver(null)}
              style={{
                cursor: 'pointer',
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                transition: 'transform 0.25s linear'
              }}
            >
              <circle
                cx={0}
                cy={0}
                r={isHovered ? radius + 3 : radius}
                fill={car.teamColor}
                stroke={isHovered ? '#ffffff' : 'none'}
                strokeWidth={2}
                opacity={car.isInPit ? 0.4 : 1}
              />
              {(!compact || isHovered) && (
                <text
                  x={radius + 3}
                  y={4}
                  fill="#ffffff"
                  fontSize={compact ? '10' : '12'}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {car.driverCode}
                </text>
              )}
              {isHovered && (
                <circle
                  cx={0}
                  cy={0}
                  r={radius + 7}
                  fill="none"
                  stroke={car.teamColor}
                  strokeWidth={2}
                  strokeOpacity={0.55}
                />
              )}
            </g>
          )
        })}
      </svg>

      <div className="absolute right-3 top-2 z-10 rounded border border-border bg-bg-secondary/80 px-2 py-1 text-[11px] text-text-secondary backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/90" />
          <span>Cars</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/40" />
          <span>PIT (dimmed)</span>
        </div>
      </div>

      {hoveredDriver && !compact && (
        <div className="absolute bottom-2 left-3 z-10 rounded border border-border bg-bg-secondary px-2 py-1 text-xs">
          {(() => {
            const car = carPositions.find((c) => c.driverCode === hoveredDriver)
            if (!car) return null
            return (
              <span>
                <span style={{ color: car.teamColor }}>●</span> {car.driverCode} — P{car.position || '—'} — Lap{' '}
                {car.currentLap}
                {car.isInPit ? ' (PIT)' : ''}
              </span>
            )
          })()}
        </div>
      )}
    </div>
  )
}
