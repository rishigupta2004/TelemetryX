import React, { useMemo, useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

interface PositionTimelineProps {
  raceLength?: number;
}

interface PositionDataPoint {
  lap: number;
  ver: number;
  lec: number;
  nor: number;
  pia: number;
  ham: number;
  rus: number;
}

interface SafetyCarData {
  startLap: number;
  endLap: number;
  reason: string;
}

const SAMPLE_POSITION_DATA: PositionDataPoint[] = [
  { lap: 0, ver: 1, lec: 2, nor: 3, pia: 4, ham: 5, rus: 6 },
  { lap: 1, ver: 1, lec: 2, nor: 3, pia: 4, ham: 5, rus: 6 },
  { lap: 2, ver: 1, lec: 2, nor: 3, pia: 5, ham: 4, rus: 6 },
  { lap: 3, ver: 1, lec: 2, nor: 3, pia: 5, ham: 4, rus: 6 },
  { lap: 4, ver: 1, lec: 2, nor: 4, pia: 3, ham: 5, rus: 6 },
  { lap: 5, ver: 1, lec: 2, nor: 4, pia: 3, ham: 5, rus: 6 },
  { lap: 6, ver: 1, lec: 2, nor: 5, pia: 3, ham: 4, rus: 6 },
  { lap: 7, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 8, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 9, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 10, ver: 1, lec: 4, nor: 5, pia: 2, ham: 3, rus: 6 },
  { lap: 11, ver: 1, lec: 4, nor: 5, pia: 2, ham: 3, rus: 6 },
  { lap: 12, ver: 1, lec: 4, nor: 5, pia: 2, ham: 3, rus: 6 },
  { lap: 13, ver: 1, lec: 4, nor: 5, pia: 2, ham: 3, rus: 6 },
  { lap: 14, ver: 1, lec: 4, nor: 5, pia: 2, ham: 3, rus: 6 },
  { lap: 15, ver: 1, lec: 4, nor: 5, pia: 2, ham: 3, rus: 6 },
  { lap: 16, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 17, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 18, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 19, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
  { lap: 20, ver: 1, lec: 3, nor: 5, pia: 2, ham: 4, rus: 6 },
];

const SAFETY_CAR_PERIODS: SafetyCarData[] = [
  { startLap: 7, endLap: 9, reason: 'Car Recovery' },
  { startLap: 18, endLap: 20, reason: 'VSC - Debris' },
];

const DRIVER_COLORS: Record<string, string> = {
  VER: '#ff0000',
  LEC: '#0066ff',
  NOR: '#ff8c00',
  PIA: '#ffff00',
  HAM: '#0080ff',
  RUS: '#808080',
};

const DRIVER_NAMES: Record<string, string> = {
  VER: 'Verstappen',
  LEC: 'Leclerc',
  NOR: 'Norris',
  PIA: 'Piastri',
  HAM: 'Hamilton',
  RUS: 'Russell',
};

export const PositionTimeline: React.FC<PositionTimelineProps> = () => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(['VER', 'LEC', 'NOR', 'PIA']);
  const [showSafetyCar, setShowSafetyCar] = useState(true);

  const chartData = useMemo(() => {
    return SAMPLE_POSITION_DATA.map(point => ({
      lap: point.lap,
      ...Object.fromEntries(
        selectedDrivers.map(driver => [driver, point[driver.toLowerCase() as keyof PositionDataPoint]])
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
    <div className="position-timeline-container w-full h-full bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Position Timeline</h3>
          <p className="text-gray-400 text-sm">Race Position Changes</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showSafetyCar}
              onChange={(e) => setShowSafetyCar(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            Show SC/VSC
          </label>
        </div>
      </div>

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

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="lap"
              stroke="#9ca3af"
              label={{ value: 'Lap', position: 'bottom', fill: '#9ca3af' }}
            />
            <YAxis
              stroke="#9ca3af"
              domain={[1, 6]}
              reversed={true}
              ticks={[1, 2, 3, 4, 5, 6]}
              label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              formatter={(value: number, name: string) => [`P${value}`, DRIVER_NAMES[name] || name]}
              labelFormatter={(v) => `Lap ${v}`}
            />
            <Legend />
            {showSafetyCar && SAFETY_CAR_PERIODS.map((sc, index) => (
              <ReferenceLine
                key={index}
                x={sc.startLap}
                stroke="#fbbf24"
                strokeDasharray="5 5"
                label={{
                  value: sc.reason,
                  position: 'top',
                  fill: '#fbbf24',
                  fontSize: 10,
                  angle: 0,
                }}
              />
            ))}
            {showSafetyCar && SAFETY_CAR_PERIODS.map((sc, index) => (
              <ReferenceLine
                key={`end-${index}`}
                x={sc.endLap}
                stroke="#fbbf24"
                strokeDasharray="5 5"
              />
            ))}
            <Area
              type="monotone"
              dataKey="ver"
              stroke="transparent"
              fill="transparent"
            />
            {selectedDrivers.map(driver => (
              <Line
                key={driver}
                type="stepAfter"
                dataKey={driver}
                stroke={DRIVER_COLORS[driver]}
                strokeWidth={2}
                dot={{ r: 4, fill: DRIVER_COLORS[driver], strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {showSafetyCar && (
        <div className="mt-4 flex gap-2 flex-wrap">
          {SAFETY_CAR_PERIODS.map((sc, index) => (
            <div
              key={index}
              className="bg-yellow-900/50 border border-yellow-600 rounded-lg px-3 py-2"
            >
              <span className="text-yellow-400 font-medium text-sm">
                Lap {sc.startLap}-{sc.endLap}: {sc.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-6 gap-4">
        {selectedDrivers.map(driver => {
          const finalPosition = SAMPLE_POSITION_DATA[SAMPLE_POSITION_DATA.length - 1][driver.toLowerCase() as keyof PositionDataPoint];
          const bestPosition = Math.min(...SAMPLE_POSITION_DATA.map(d => d[driver.toLowerCase() as keyof PositionDataPoint] as number));
          const worstPosition = Math.max(...SAMPLE_POSITION_DATA.map(d => d[driver.toLowerCase() as keyof PositionDataPoint] as number));
          
          return (
            <div
              key={driver}
              className="bg-gray-800 rounded-lg p-3 text-center"
              style={{ borderTop: `3px solid ${DRIVER_COLORS[driver]}` }}
            >
              <p className="text-gray-400 text-xs">{DRIVER_NAMES[driver]}</p>
              <p className="text-white font-bold text-xl">P{finalPosition}</p>
              <p className="text-gray-500 text-xs">Best: P{bestPosition} | Worst: P{worstPosition}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PositionTimeline;
