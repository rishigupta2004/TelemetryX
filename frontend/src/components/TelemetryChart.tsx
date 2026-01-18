import React, { useMemo, useState } from 'react';
import {
  LineChart,
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

interface TelemetryChartProps {
  driver: string;
  session: string;
  lapRange?: { start: number; end: number };
}

interface TelemetryDataPoint {
  timestamp: number;
  distance: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: boolean;
  rpm: number;
}

const SAMPLE_SPEED_DATA: TelemetryDataPoint[] = Array.from({ length: 500 }, (_, i) => {
  const seed = i * 12345;
  const seededRandom = () => {
    const result = (seed * 9301 + 49297) % 233280;
    return result / 233280;
  };
  return {
    timestamp: i * 10,
    distance: i * 5,
    speed: 150 + Math.sin(i * 0.05) * 80 + seededRandom() * 20,
    throttle: Math.max(0, Math.min(100, 60 + Math.sin(i * 0.08) * 40 + seededRandom() * 20)),
    brake: i % 100 < 10 ? 80 + seededRandom() * 20 : seededRandom() * 10,
    gear: Math.floor(2 + (i % 50) / 10),
    drs: i > 150 && i < 200,
    rpm: 8000 + Math.sin(i * 0.1) * 3000,
  };
});

const formatSpeed = (speed: number): string => `${Math.round(speed)}`;

const DRIVER_COLORS: Record<string, string> = {
  VER: '#ff0000',
  LEC: '#0066ff',
  NOR: '#ff8c00',
  PIA: '#ffff00',
  HAM: '#0080ff',
  RUS: '#808080',
};

const generateComparisonData = (baseData: TelemetryDataPoint[]): (TelemetryDataPoint & { speed2: number; throttle2: number })[] => {
  const seed = 12345;
  let seedRandom = seed;
  const seededRandom = () => {
    seedRandom = (seedRandom * 9301 + 49297) % 233280;
    return seedRandom / 233280;
  };
  return baseData.map(point => ({
    ...point,
    speed2: point.speed + (seededRandom() - 0.5) * 30,
    throttle2: point.throttle + (seededRandom() - 0.5) * 20,
  }));
};

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  driver,
  session,
}) => {
  const [activeView, setActiveView] = useState<'speed' | 'throttle' | 'gears' | 'comparison'>('speed');
  const [compareDriver, setCompareDriver] = useState<string>('LEC');
  
  const comparisonData = useMemo(() => {
    return generateComparisonData(SAMPLE_SPEED_DATA);
  }, []);

  return (
    <div className="telemetry-chart-container w-full h-full bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Telemetry Analysis</h3>
          <p className="text-gray-400 text-sm">{driver} - {session}</p>
        </div>
        <div className="flex gap-2">
          {(['speed', 'throttle', 'gears', 'comparison'] as const).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                activeView === view
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'comparison' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-gray-400 text-sm">Compare with:</span>
          <select
            value={compareDriver}
            onChange={(e) => setCompareDriver(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
          >
            {Object.keys(DRIVER_COLORS).filter(d => d !== driver).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {activeView === 'speed' ? (
            <ComposedChart data={SAMPLE_SPEED_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)}m`}
                label={{ value: 'Distance', position: 'bottom', fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                tickFormatter={(v: number) => formatSpeed(v)}
                domain={[0, 'auto']}
                label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelFormatter={(v: number) => `Distance: ${Math.round(v)}m`}
                formatter={(value: number) => [`${Math.round(value)} km/h`, 'Speed']}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="speed"
                stroke="#22c55e"
                fill="url(#speedGradient)"
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              {SAMPLE_SPEED_DATA.filter(d => d.drs).length > 0 && (
                <ReferenceLine
                  y={300}
                  stroke="#06b6d4"
                  strokeDasharray="5 5"
                  label={{ value: 'DRS Zone', fill: '#06b6d4', fontSize: 12 }}
                />
              )}
            </ComposedChart>
          ) : activeView === 'throttle' ? (
            <ComposedChart data={SAMPLE_SPEED_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)}m`}
              />
              <YAxis
                stroke="#9ca3af"
                domain={[0, 100]}
                label={{ value: 'Throttle/Brake %', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number, name: string) => [`${Math.round(value)}%`, name === 'throttle' ? 'Throttle' : 'Brake']}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="throttle"
                stroke="#22c55e"
                fill="url(#throttleGradient)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="brake"
                stroke="#ef4444"
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="throttleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
            </ComposedChart>
          ) : activeView === 'gears' ? (
            <LineChart data={SAMPLE_SPEED_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)}m`}
              />
              <YAxis
                stroke="#9ca3af"
                domain={[1, 8]}
                ticks={[1, 2, 3, 4, 5, 6, 7, 8]}
                tickFormatter={(v: number) => `${v}`}
                label={{ value: 'Gear', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => [`Gear ${value}`, 'Gear']}
              />
              <Legend />
              <Line
                type="step"
                dataKey="gear"
                stroke="#8b5cf6"
                strokeWidth={3}
              />
            </LineChart>
          ) : (
            <ComposedChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${Math.round(v)}m`}
              />
              <YAxis
                stroke="#9ca3af"
                tickFormatter={(v: number) => formatSpeed(v)}
                domain={[0, 'auto']}
                label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number, name: string) => [`${Math.round(value)} km/h`, name.startsWith('speed') ? driver : compareDriver]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="speed"
                stroke={DRIVER_COLORS[driver]}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="speed2"
                stroke={DRIVER_COLORS[compareDriver]}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Max Speed</p>
          <p className="text-white text-xl font-bold">{Math.round(Math.max(...SAMPLE_SPEED_DATA.map(d => d.speed)))} <span className="text-sm font-normal text-gray-400">km/h</span></p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Avg Throttle</p>
          <p className="text-green-400 text-xl font-bold">{Math.round(SAMPLE_SPEED_DATA.reduce((a, b) => a + b.throttle, 0) / SAMPLE_SPEED_DATA.length)} <span className="text-sm font-normal text-gray-400">%</span></p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Top Gear</p>
          <p className="text-purple-400 text-xl font-bold">{Math.max(...SAMPLE_SPEED_DATA.map(d => d.gear))}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">DRS Zones</p>
          <p className="text-cyan-400 text-xl font-bold">{SAMPLE_SPEED_DATA.filter(d => d.drs).length > 0 ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    </div>
  );
};

export default TelemetryChart;
