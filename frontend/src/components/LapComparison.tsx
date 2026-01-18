import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Bar,
} from 'recharts';

interface LapComparisonProps {
  primaryDriver?: string;
  secondaryDriver?: string;
}

interface LapDataPoint {
  distance: number;
  ver: number;
  lec: number;
  delta: number;
}

interface SectorData {
  sector: number;
  ver: number;
  lec: number;
  delta: number;
}

interface LapSummary {
  driver: string;
  lapTime: number;
  sector1: number;
  sector2: number;
  sector3: number;
  compound: string;
}

const SAMPLE_SPEED_TRACE: LapDataPoint[] = Array.from({ length: 200 }, (_, i) => {
  const baseSpeed = 200 + Math.sin(i * 0.03) * 100;
  const verSpeed = baseSpeed + Math.sin(i * 0.02) * 20;
  const lecSpeed = baseSpeed + Math.sin(i * 0.025) * 25;
  return {
    distance: i * 10,
    ver: verSpeed,
    lec: lecSpeed,
    delta: verSpeed - lecSpeed,
  };
});

const SAMPLE_SECTOR_DATA: SectorData[] = [
  { sector: 1, ver: 28300, lec: 28600, delta: -300 },
  { sector: 2, ver: 35200, lec: 35500, delta: -300 },
  { sector: 3, ver: 24500, lec: 24200, delta: +300 },
];

const SAMPLE_LAP_SUMMARY: LapSummary[] = [
  { driver: 'VER', lapTime: 88000, sector1: 28300, sector2: 35200, sector3: 24500, compound: 'SOFT' },
  { driver: 'LEC', lapTime: 88300, sector1: 28600, sector2: 35500, sector3: 24200, compound: 'SOFT' },
];

const DRIVER_COLORS: Record<string, string> = {
  VER: '#ff0000',
  LEC: '#0066ff',
};

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#ef4444',
  MEDIUM: '#facc15',
  HARD: '#ffffff',
};

const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const formatDelta = (ms: number): string => {
  const sign = ms >= 0 ? '+' : '';
  const absMs = Math.abs(ms);
  const seconds = Math.floor(absMs / 1000);
  const milliseconds = absMs % 1000;
  return `${sign}${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
};

export const LapComparison: React.FC<LapComparisonProps> = () => {
  const [activeView, setActiveView] = useState<'delta' | 'sectors' | 'overlay'>('delta');
  const [primaryDriver, setPrimaryDriver] = useState<string>('VER');
  const [secondaryDriver, setSecondaryDriver] = useState<string>('LEC');

  const chartData = useMemo(() => {
    return SAMPLE_SPEED_TRACE.map(point => ({
      distance: point.distance,
      [primaryDriver]: point[primaryDriver.toLowerCase() as keyof LapDataPoint],
      [secondaryDriver]: point[secondaryDriver.toLowerCase() as keyof LapDataPoint],
      delta: point.delta,
    }));
  }, [primaryDriver, secondaryDriver]);

  const sectorChartData = useMemo(() => {
    return SAMPLE_SECTOR_DATA.map(point => ({
      sector: `S${point.sector}`,
      [primaryDriver]: point[primaryDriver.toLowerCase() as keyof SectorData],
      [secondaryDriver]: point[secondaryDriver.toLowerCase() as keyof SectorData],
      delta: point.delta,
    }));
  }, [primaryDriver, secondaryDriver]);

  const totalDelta = useMemo(() => {
    const verTotal = SAMPLE_LAP_SUMMARY.find(l => l.driver === primaryDriver)?.lapTime || 0;
    const lecTotal = SAMPLE_LAP_SUMMARY.find(l => l.driver === secondaryDriver)?.lapTime || 0;
    return verTotal - lecTotal;
  }, [primaryDriver, secondaryDriver]);

  return (
    <div className="lap-comparison-container w-full h-full bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Lap Comparison</h3>
          <p className="text-gray-400 text-sm">Delta Time & Sector Analysis</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Primary:</span>
            <select
              value={primaryDriver}
              onChange={(e) => setPrimaryDriver(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium"
              style={{ borderLeft: `3px solid ${DRIVER_COLORS[primaryDriver]}` }}
            >
              {Object.keys(DRIVER_COLORS).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Compare:</span>
            <select
              value={secondaryDriver}
              onChange={(e) => setSecondaryDriver(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium"
              style={{ borderLeft: `3px solid ${DRIVER_COLORS[secondaryDriver]}` }}
            >
              {Object.keys(DRIVER_COLORS).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['delta', 'sectors', 'overlay'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeView === view
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {view === 'delta' ? 'Delta Time' : view === 'sectors' ? 'Sectors' : 'Speed Overlay'}
          </button>
        ))}
      </div>

      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          {activeView === 'delta' ? (
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)}m`}
                label={{ value: 'Distance', position: 'bottom', fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                tickFormatter={(v: number) => formatDelta(v)}
                label={{ value: 'Delta', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => [formatDelta(value), 'Delta']}
                labelFormatter={(v: number) => `Distance: ${Math.round(v)}m`}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#22c55e" strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                name="Delta"
              />
            </ComposedChart>
          ) : activeView === 'sectors' ? (
            <ComposedChart data={sectorChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="sector"
                stroke="#9ca3af"
                label={{ value: 'Sector', position: 'bottom', fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                tickFormatter={(v: number) => formatTime(v)}
                label={{ value: 'Time', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number, name: string) => [formatTime(value), name]}
              />
              <Legend />
              <Bar dataKey={primaryDriver} fill={DRIVER_COLORS[primaryDriver]} name={primaryDriver} radius={[4, 4, 0, 0]} />
              <Bar dataKey={secondaryDriver} fill={DRIVER_COLORS[secondaryDriver]} name={secondaryDriver} radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#fbbf24"
                strokeWidth={3}
                dot={{ r: 6, fill: '#fbbf24', strokeWidth: 0 }}
                name="Delta"
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)}m`}
                label={{ value: 'Distance', position: 'bottom', fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)} km/h`}
                label={{ value: 'Speed', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number, name: string) => [`${Math.round(value)} km/h`, name]}
                labelFormatter={(v: number) => `Distance: ${Math.round(v)}m`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={primaryDriver}
                stroke={DRIVER_COLORS[primaryDriver]}
                strokeWidth={2}
                dot={false}
                name={primaryDriver}
              />
              <Line
                type="monotone"
                dataKey={secondaryDriver}
                stroke={DRIVER_COLORS[secondaryDriver]}
                strokeWidth={2}
                dot={false}
                name={secondaryDriver}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {SAMPLE_LAP_SUMMARY.map(lap => (
          <div
            key={lap.driver}
            className="bg-gray-800 rounded-lg p-4"
            style={{ borderLeft: `4px solid ${DRIVER_COLORS[lap.driver]}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold text-lg">{lap.driver}</span>
              <span
                className="text-xs px-2 py-1 rounded font-medium"
                style={{
                  backgroundColor: COMPOUND_COLORS[lap.compound],
                  color: lap.compound === 'HARD' ? '#000' : '#fff',
                }}
              >
                {lap.compound}
              </span>
            </div>
            <p className="text-gray-400 text-sm">Lap Time: <span className="text-white font-mono">{formatTime(lap.lapTime)}</span></p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <p className="text-gray-500 text-xs">S1</p>
                <p className="text-white font-mono text-sm">{formatTime(lap.sector1)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">S2</p>
                <p className="text-white font-mono text-sm">{formatTime(lap.sector2)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">S3</p>
                <p className="text-white font-mono text-sm">{formatTime(lap.sector3)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-gray-800 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">Total Delta</p>
          <p className={`text-2xl font-bold font-mono ${totalDelta < 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatDelta(totalDelta)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Faster Driver</p>
          <p className="text-white font-bold text-xl" style={{ color: DRIVER_COLORS[totalDelta < 0 ? primaryDriver : secondaryDriver] }}>
            {totalDelta < 0 ? primaryDriver : secondaryDriver}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LapComparison;
