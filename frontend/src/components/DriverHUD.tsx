import React from 'react';
import { TelemetryPoint } from '../lib/api';

interface DriverHUDProps {
  driver: string;
  telemetry: TelemetryPoint;
  maxSpeed?: number;
  maxRpm?: number;
}

const DRIVER_COLORS: Record<string, string> = {
    VER: '#ff0000', LEC: '#ff2400', NOR: '#ff8000', PIA: '#ffac2f',
    HAM: '#00d2be', RUS: '#24ffff', SAI: '#ff0000', ALO: '#006f62',
    STR: '#006f62', PER: '#ff0000',
};

export const DriverHUD: React.FC<DriverHUDProps> = ({ 
  driver, 
  telemetry,
  maxSpeed = 340,
  maxRpm = 13000
}) => {
  if (!telemetry) return null;

  const { speed, rpm, gear, throttle, brake, drs } = telemetry;
  
  // Calculate angles for gauge
  // -135 to +135 degrees range
  const speedAngle = (speed / maxSpeed) * 270 - 135;
  const rpmAngle = (rpm / maxRpm) * 270 - 135;
  
  const color = DRIVER_COLORS[driver] || '#ffffff';

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 w-72 backdrop-blur-sm relative overflow-hidden">
        {/* Driver Tag */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-2xl font-bold text-white tracking-tighter">{driver}</span>
        </div>

        {/* DRS Indicator */}
        <div className={`absolute top-5 right-5 px-2 py-0.5 rounded text-xs font-bold transition-colors ${drs ? 'bg-green-500 text-black' : 'bg-slate-800 text-slate-500'}`}>
            DRS
        </div>

        {/* Main Gauge */}
        <div className="relative h-48 mt-4 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full transform rotate-90">
                {/* RPM Background */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#1e293b" strokeWidth="20" strokeDasharray="330 360" strokeLinecap="round" />
                {/* RPM Fill */}
                <circle 
                    cx="100" cy="100" r="80" fill="none" 
                    stroke={rpm > 11000 ? '#ef4444' : color} 
                    strokeWidth="20" 
                    strokeDasharray={`${(rpm / maxRpm) * 330} 360`}
                    strokeLinecap="round"
                    className="transition-all duration-100 ease-linear"
                />
            </svg>
            
            {/* Center Data */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-mono font-bold text-white tracking-tighter">{Math.round(speed)}</span>
                <span className="text-xs text-slate-400">KM/H</span>
                
                <div className="mt-2 flex items-baseline">
                    <span className="text-xl font-mono text-slate-300">{Math.round(rpm)}</span>
                    <span className="text-[10px] text-slate-500 ml-1">RPM</span>
                </div>
            </div>

            {/* Gear Indicator (Floating Bubble) */}
            <div className="absolute bottom-4 w-12 h-12 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{gear}</span>
            </div>
        </div>

        {/* Pedal Bars */}
        <div className="flex gap-2 mt-2 h-24">
            {/* Throttle */}
            <div className="flex-1 bg-slate-800 rounded-lg relative overflow-hidden flex flex-col justify-end p-1">
                <div 
                    className="w-full bg-green-500 rounded-sm transition-all duration-75 ease-linear"
                    style={{ height: `${throttle}%` }}
                />
                <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-slate-400 mix-blend-difference">THR</span>
            </div>
            {/* Brake */}
            <div className="flex-1 bg-slate-800 rounded-lg relative overflow-hidden flex flex-col justify-end p-1">
                 <div 
                    className="w-full bg-red-500 rounded-sm transition-all duration-75 ease-linear"
                    style={{ height: `${brake}%` }}
                />
                <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-slate-400 mix-blend-difference">BRK</span>
            </div>
        </div>
    </div>
  );
};
