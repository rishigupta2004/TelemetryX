import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface PaceAnalysisProps {
  year?: number;
  round?: number;
  session?: string;
}

interface LapTimeData {
  lapNumber: number;
  ver: number;
  lec: number;
  nor: number;
  pia: number;
  ham: number;
}

interface StintData {
  driver: string;
  stints: { startLap: number; endLap: number; compound: string }[];
}

interface GapData {
  driver: string;
  gap: number;
}

const SAMPLE_LAP_TIMES: LapTimeData[] = [
  { lapNumber: 1, ver: 89400, lec: 90200, nor: 91000, pia: 90500, ham: 90800 },
  { lapNumber: 2, ver: 88100, lec: 89500, nor: 89800, pia: 89200, ham: 89600 },
  { lapNumber: 3, ver: 87800, lec: 88900, nor: 89400, pia: 88800, ham: 89200 },
  { lapNumber: 4, ver: 87600, lec: 88800, nor: 89200, pia: 88700, ham: 89000 },
  { lapNumber: 5, ver: 89500, lec: 91000, nor: 90500, pia: 90800, ham: 90000 },
  { lapNumber: 6, ver: 87400, lec: 88500, nor: 89000, pia: 88400, ham: 88800 },
  { lapNumber: 7, ver: 87200, lec: 88300, nor: 88800, pia: 88200, ham: 88600 },
  { lapNumber: 8, ver: 87100, lec: 88200, nor: 88700, pia: 88100, ham: 88500 },
  { lapNumber: 9, ver: 89000, lec: 90500, nor: 90200, pia: 90000, ham: 89500 },
  { lapNumber: 10, ver: 86900, lec: 88000, nor: 88500, pia: 87900, ham: 88300 },
];

const SAMPLE_STINTS: StintData[] = [
  { driver: 'VER', stints: [{ startLap: 1, endLap: 15, compound: 'SOFT' }, { startLap: 16, endLap: 35, compound: 'MEDIUM' }] },
  { driver: 'LEC', stints: [{ startLap: 1, endLap: 12, compound: 'SOFT' }, { startLap: 13, endLap: 38, compound: 'MEDIUM' }] },
  { driver: 'NOR', stints: [{ startLap: 1, endLap: 14, compound: 'SOFT' }, { startLap: 15, endLap: 36, compound: 'MEDIUM' }] },
  { driver: 'PIA', stints: [{ startLap: 1, endLap: 13, compound: 'SOFT' }, { startLap: 14, endLap: 37, compound: 'MEDIUM' }] },
  { driver: 'HAM', stints: [{ startLap: 1, endLap: 15, compound: 'SOFT' }, { startLap: 16, endLap: 34, compound: 'MEDIUM' }] },
];

const SAMPLE_GAPS: GapData[] = [
  { driver: 'VER', gap: 0 },
  { driver: 'LEC', gap: 2.4 },
  { driver: 'NOR', gap: 5.8 },
  { driver: 'PIA', gap: 4.2 },
  { driver: 'HAM', gap: 8.1 },
];

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#ef4444',
  MEDIUM: '#facc15',
  HARD: '#ffffff',
  INTERMEDIATE: '#22c55e',
  WET: '#3b82f6',
};

const DRIVER_COLORS: Record<string, string> = {
  VER: '#ff0000',
  LEC: '#0066ff',
  NOR: '#ff8c00',
  PIA: '#ffff00',
  HAM: '#0080ff',
};

const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const formatGap = (seconds: number): string => {
  if (seconds === 0) return 'LEADER';
  return `+${seconds.toFixed(1)}s`;
};

export const PaceAnalysis: React.FC<PaceAnalysisProps> = () => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(['VER', 'LEC']);
  const [viewMode, setViewMode] = useState<'lapTimes' | 'gaps' | 'stints'>('lapTimes');

  const chartData = useMemo(() => {
    return SAMPLE_LAP_TIMES.map(lap => ({
      lap: `Lap ${lap.lapNumber}`,
      ...Object.fromEntries(
        selectedDrivers.map(driver => [driver, lap[driver.toLowerCase() as keyof LapTimeData]])
      ),
    }));
  }, [selectedDrivers]);

  const toggleDriver = (driver: string) => {
    setSelectedDrivers(prev =>
      prev.includes(driver)
        ? prev.filter(d => d !== driver)
        : [...prev, driver]
    );
  };

  return (
    <div className="pace-analysis-container w-full h-full bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Pace Analysis</h3>
          <p className="text-gray-400 text-sm">Race Pace & Strategy</p>
        </div>
        <div className="flex gap-2">
          {(['lapTimes', 'gaps', 'stints'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {mode === 'lapTimes' ? 'Lap Times' : mode === 'gaps' ? 'Gaps' : 'Stints'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'lapTimes' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {Object.keys(DRIVER_COLORS).map(driver => (
              <button
                key={driver}
                onClick={() => toggleDriver(driver)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  selectedDrivers.includes(driver)
                    ? 'text-white'
                    : 'text-gray-500 bg-gray-800'
                }`}
                style={{
                  backgroundColor: selectedDrivers.includes(driver) ? DRIVER_COLORS[driver] : undefined,
                }}
              >
                {driver}
              </button>
            ))}
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="lap" stroke="#9ca3af" />
                <YAxis
                  stroke="#9ca3af"
                  tickFormatter={(v: number) => formatTime(v)}
                  domain={['dataMin - 1000', 'dataMax + 1000']}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [formatTime(value), name]}
                />
                <Legend />
                <ReferenceLine y={88000} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Target Pace', fill: '#22c55e', fontSize: 12 }} />
                {selectedDrivers.map(driver => (
                  <Bar
                    key={driver}
                    dataKey={driver}
                    fill={DRIVER_COLORS[driver]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {viewMode === 'gaps' && (
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SAMPLE_GAPS} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `+${v}s`}
              />
              <YAxis
                type="category"
                dataKey="driver"
                stroke="#9ca3af"
                width={50}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => [formatGap(value), 'Gap']}
                labelFormatter={(v) => `Driver: ${v}`}
              />
              <Legend />
              <Bar dataKey="gap" name="Gap to Leader" radius={[0, 4, 4, 0]}>
                {SAMPLE_GAPS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={DRIVER_COLORS[entry.driver] || '#808080'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {viewMode === 'stints' && (
        <div className="space-y-4">
          {SAMPLE_STINTS.map(driverStints => (
            <div key={driverStints.driver} className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: DRIVER_COLORS[driverStints.driver] }}
                >
                  {driverStints.driver}
                </div>
                <span className="text-white font-medium">Stint Strategy</span>
              </div>
              <div className="flex gap-1 h-8">
                {driverStints.stints.map((stint, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: COMPOUND_COLORS[stint.compound],
                      color: stint.compound === 'HARD' ? '#000' : '#fff',
                    }}
                    title={`Lap ${stint.startLap}-${stint.endLap}: ${stint.compound}`}
                  >
                    {stint.compound}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {driverStints.stints.map((stint, index) => (
                  <span key={index}>{stint.startLap}-{stint.endLap}</span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-4 text-xs">
            {Object.entries(COMPOUND_COLORS).map(([compound, color]) => (
              <div key={compound} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                <span className="text-gray-400">{compound}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-5 gap-4">
        {SAMPLE_GAPS.sort((a, b) => a.gap - b.gap).map((driver, index) => (
          <div
            key={driver.driver}
            className="bg-gray-800 rounded-lg p-3 text-center"
            style={{ borderLeft: `4px solid ${DRIVER_COLORS[driver.driver]}` }}
          >
            <p className="text-gray-400 text-xs">P{index + 1}</p>
            <p className="text-white font-bold text-lg">{driver.driver}</p>
            <p className={`text-sm font-medium ${driver.gap === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {formatGap(driver.gap)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaceAnalysis;
