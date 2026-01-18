import { GlassCard } from '@/components/ui';
import { useRaceStore } from '@/stores/useRaceStore';
import { useMemo } from 'react';

export function SpeedChart() {
  const { sessionData, currentTime } = useRaceStore();

  const chartData = useMemo(() => {
    if (!sessionData) return [];
    
    const points = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const speed = 180 + Math.sin(t * Math.PI * 2) * 80 + Math.random() * 20;
      points.push({ time: t * 5400, speed: Math.round(speed) });
    }
    return points;
  }, [sessionData]);

  if (!sessionData) {
    return (
      <GlassCard className="h-full flex items-center justify-center">
        <p className="text-white/40 text-sm">No telemetry data available</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Speed Trace</h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-f1-red" />
          <span className="text-xs text-white/60">Selected Driver</span>
        </div>
      </div>

      <div className="h-32 relative">
        <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e10600" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#e10600" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <path
            d={`M 0 120 ${chartData.map((p, i) => 
              `L ${(i / (chartData.length - 1)) * 400} ${120 - (p.speed / 350) * 120}`
            ).join(' ')} L 400 120 Z`}
            fill="url(#speedGradient)"
          />
          
          <path
            d={chartData.map((p, i) => 
              `M ${(i / (chartData.length - 1)) * 400} ${120 - (p.speed / 350) * 120}`
            ).join(' L ')}
            fill="none"
            stroke="#e10600"
            strokeWidth="2"
          />
          
          <line x1="0" y1="120" x2="400" y2="120" stroke="#333" strokeWidth="1" />
          
          <text x="10" y="15" fill="#666" fontSize="10">350</text>
          <text x="10" y="60" fill="#666" fontSize="10">200</text>
          <text x="10" y="110" fill="#666" fontSize="10">50</text>
          
          <line 
            x1={(currentTime / 5400) * 400} 
            y1="0" 
            x2={(currentTime / 5400) * 400} 
            y2="120" 
            stroke="#fff" 
            strokeWidth="2" 
            strokeDasharray="4,4"
          />
        </svg>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-white/40">
        <span>Start</span>
        <span className="text-f1-red">{Math.round(currentTime)}s</span>
        <span>End</span>
      </div>
    </GlassCard>
  );
}

export function ThrottleGauge() {
  return (
    <GlassCard className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-24 h-12">
          <div className="absolute inset-0 bg-surface rounded-full overflow-hidden">
            <div 
              className="absolute inset-0 bg-gradient-to-r from-green-500 to-green-400"
              style={{ width: '75%' }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">75%</span>
          </div>
        </div>
        <span className="text-xs text-white/40 mt-2 block">Throttle</span>
      </div>
    </GlassCard>
  );
}

export function BrakeGauge() {
  return (
    <GlassCard className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          false ? 'bg-red-500/20 border-2 border-red-500' : 'bg-surface'
        }`}>
          <div className={`w-8 h-8 rounded-full ${false ? 'bg-red-500' : 'bg-white/10'}`} />
        </div>
        <span className="text-xs text-white/40 mt-2 block">Brake</span>
      </div>
    </GlassCard>
  );
}
