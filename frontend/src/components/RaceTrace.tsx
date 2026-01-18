import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label
} from 'recharts';

interface RaceTraceProps {
  data: Record<string, { lap_number: number; gap_to_leader: number }[]>;
}

const DRIVER_COLORS: Record<string, string> = {
  VER: '#ff0000', LEC: '#ff2400', NOR: '#ff8000', PIA: '#ffac2f',
  HAM: '#00d2be', RUS: '#24ffff', SAI: '#ff0000', ALO: '#006f62',
  STR: '#006f62', PER: '#ff0000', TSU: '#006f62', RIC: '#006f62',
  GAS: '#ff66c4', OCO: '#ff66c4', ALB: '#005aff', SAR: '#005aff',
  BOT: '#52e252', ZHO: '#52e252', HUL: '#b6babd', MAG: '#b6babd'
};

export const RaceTrace: React.FC<RaceTraceProps> = ({ data }) => {
  // Transform data for Recharts: array of objects { lap: 1, VER: 0, HAM: 5.2, ... }
  const drivers = Object.keys(data);
  const maxLaps = Math.max(...drivers.map(d => data[d].length));
  
  const chartData = Array.from({ length: maxLaps }, (_, i) => {
    const lap = i + 1;
    const point: any = { lap };
    drivers.forEach(d => {
      const lapData = data[d].find(l => l.lap_number === lap);
      if (lapData) {
        point[d] = lapData.gap_to_leader;
      }
    });
    return point;
  });

  return (
    <div className="w-full h-[500px] bg-slate-900 rounded-xl p-4 border border-slate-800">
      <h3 className="text-slate-400 text-sm font-bold uppercase mb-4">Race Trace (Gap to Leader)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="lap" 
            type="number" 
            domain={[1, 'auto']} 
            stroke="#94a3b8"
            label={{ value: 'Lap Number', position: 'bottom', fill: '#94a3b8' }}
          />
          <YAxis 
            reversed 
            stroke="#94a3b8"
            label={{ value: 'Gap (s)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            itemSorter={(item) => item.value as number}
          />
          <Legend />
          {drivers.map(driver => (
            <Line
              key={driver}
              type="monotone"
              dataKey={driver}
              stroke={DRIVER_COLORS[driver] || '#888888'}
              dot={false}
              strokeWidth={driver === 'VER' || driver === 'NOR' ? 3 : 1}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
