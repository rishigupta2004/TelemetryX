import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { api, TelemetryPoint } from '../lib/api';

interface TelemetryChartProps {
  year: number;
  race: string;
  driver: string;
  lap: number;
  compareDriver?: string; // Optional comparison
  compareLap?: number;
  onCursorMove?: (data: TelemetryPoint | null) => void;
}

const DRIVER_COLORS: Record<string, string> = {
  VER: '#ff0000',
  LEC: '#ff2400',
  NOR: '#ff8000',
  PIA: '#ffac2f',
  HAM: '#00d2be',
  RUS: '#24ffff',
  SAI: '#ff0000',
  ALO: '#006f62',
  STR: '#006f62',
  PER: '#ff0000',
};

const CHART_HEIGHT = 160;

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  year,
  race,
  driver,
  lap,
  compareDriver,
  compareLap,
}) => {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [compareData, setCompareData] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.telemetry.getLapData(year, race, driver, lap);
        setData(response.data);

        if (compareDriver && compareLap) {
          const compResponse = await api.telemetry.getLapData(year, race, compareDriver, compareLap);
          setCompareData(compResponse.data);
        } else {
            setCompareData([]);
        }
      } catch (err) {
        console.error("Failed to fetch telemetry", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, race, driver, lap, compareDriver, compareLap]);

  // Resample/Merge data for comparison (simple distance matching for V1)
  // In a real app, we'd use a more robust interpolation
  const chartData = useMemo(() => {
    if (compareData.length === 0) return data;
    
    // Simple approach: Use primary driver's distance as x-axis
    // Find closest point in compareData for each point in data
    return data.map(p => {
        // Optimization: Assume sorted by distance, could use binary search or sliding window
        // For < 5000 points, find is ok-ish but slow. Let's stick to simple map for prototype.
        const match = compareData.find(cp => Math.abs(cp.distance - p.distance) < 10); // 10m window
        return {
            ...p,
            speed2: match?.speed,
            rpm2: match?.rpm,
            throttle2: match?.throttle,
            brake2: match?.brake,
            gear2: match?.gear,
        };
    });
  }, [data, compareData]);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading telemetry...</div>;
  if (data.length === 0) return <div className="p-10 text-center text-gray-400">No telemetry data available for Lap {lap}</div>;

  const driverColor = DRIVER_COLORS[driver] || '#ffffff';
  const compareColor = compareDriver ? (DRIVER_COLORS[compareDriver] || '#cccccc') : 'transparent';

  return (
    <div className="w-full bg-slate-900 rounded-lg p-4 flex flex-col gap-1">
        
      {/* SPEED */}
      <div style={{ height: CHART_HEIGHT }}>
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-1 ml-2">Speed</h4>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId="telemetry">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="distance" hide type="number" domain={['dataMin', 'dataMax']} />
            <YAxis domain={[0, 360]} hide />
            <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                labelFormatter={(v) => `${Math.round(v)}m`}
                active={true}
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const point = payload[0].payload;
                        if (onCursorMove) onCursorMove(point);
                        return (
                            <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-lg">
                                <p className="text-slate-400 text-xs mb-1">{Math.round(point.distance)}m</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <span style={{ color: driverColor }}>{driver}:</span>
                                    <span className="font-mono text-white">{Math.round(point.speed)} km/h</span>
                                    {compareDriver && (
                                        <>
                                            <span style={{ color: compareColor }}>{compareDriver}:</span>
                                            <span className="font-mono text-white">{Math.round(point.speed2)} km/h</span>
                                            <span className="col-span-1 text-slate-500">Delta:</span>
                                            <span className={`font-mono ${point.speed - point.speed2 > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {(point.speed - point.speed2).toFixed(1)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    }
                    if (onCursorMove) onCursorMove(null);
                    return null;
                }}
            />
            <Line type="monotone" dataKey="speed" stroke={driverColor} strokeWidth={2} dot={false} />
            {compareDriver && <Line type="monotone" dataKey="speed2" stroke={compareColor} strokeWidth={2} dot={false} strokeDasharray="4 4" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RPM & GEAR */}
      <div style={{ height: CHART_HEIGHT }}>
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-1 ml-2">RPM / Gear</h4>
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="distance" hide type="number" domain={['dataMin', 'dataMax']} />
                <YAxis yAxisId="rpm" domain={[0, 13000]} hide />
                <YAxis yAxisId="gear" domain={[0, 9]} hide orientation="right" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                
                <Area yAxisId="rpm" type="monotone" dataKey="rpm" stroke={driverColor} fill={driverColor} fillOpacity={0.1} strokeWidth={1} />
                <Line yAxisId="gear" type="step" dataKey="gear" stroke="#ffffff" strokeWidth={1} dot={false} />
                
                {compareDriver && <Line yAxisId="rpm" type="monotone" dataKey="rpm2" stroke={compareColor} strokeWidth={1} dot={false} strokeDasharray="2 2" />}
            </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* THROTTLE */}
      <div style={{ height: 100 }}>
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-1 ml-2">Throttle</h4>
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="distance" hide type="number" domain={['dataMin', 'dataMax']} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Area type="monotone" dataKey="throttle" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} strokeWidth={2} />
                {compareDriver && <Line type="monotone" dataKey="throttle2" stroke={compareColor} strokeWidth={1} dot={false} />}
            </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* BRAKE */}
      <div style={{ height: 100 }}>
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-1 ml-2">Brake</h4>
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="distance" type="number" domain={['dataMin', 'dataMax']} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => `${Math.round(v)}m`} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Area type="monotone" dataKey="brake" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} strokeWidth={2} />
                {compareDriver && <Line type="monotone" dataKey="brake2" stroke={compareColor} strokeWidth={1} dot={false} />}
            </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default TelemetryChart;
