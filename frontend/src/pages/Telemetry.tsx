import React, { useState } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { TelemetryChart } from '../components/TelemetryChart';
import { DriverHUD } from '../components/DriverHUD';
import { TelemetryPoint } from '../lib/api';

export function Telemetry() {
  // State for controls
  const [year, setYear] = useState(2024);
  const [race, setRace] = useState('Bahrain Grand Prix');
  const [driver, setDriver] = useState('VER');
  const [lap, setLap] = useState(10);
  
  const [compareDriver, setCompareDriver] = useState<string | undefined>('LEC');
  const [compareLap, setCompareLap] = useState<number | undefined>(10);

  // State for HUD (cursor data)
  const [cursorData, setCursorData] = useState<TelemetryPoint | null>(null);

  // Derived state for comparison HUD
  const compareCursorData = cursorData ? {
      ...cursorData,
      speed: (cursorData as any).speed2 ?? 0,
      rpm: (cursorData as any).rpm2 ?? 0,
      gear: (cursorData as any).gear2 ?? 0,
      throttle: (cursorData as any).throttle2 ?? 0,
      brake: (cursorData as any).brake2 ?? 0,
      drs: 0 // Mock for now as simple join didn't bring drs2 yet
  } : null;

  return (
    <PageWrapper
      title="Telemetry Analysis"
      description="High-fidelity trace analysis and driver comparison"
    >
      <div className="flex flex-col gap-6 h-full">
        
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex flex-col">
                <label className="text-xs text-slate-500 font-bold uppercase">Driver</label>
                <select 
                    value={driver} 
                    onChange={e => setDriver(e.target.value)}
                    className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                >
                    {['VER', 'LEC', 'HAM', 'RUS', 'NOR', 'PIA', 'ALO', 'STR', 'SAI', 'PER'].map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
            </div>
            
            <div className="flex flex-col">
                <label className="text-xs text-slate-500 font-bold uppercase">Lap</label>
                <input 
                    type="number" 
                    value={lap} 
                    onChange={e => setLap(Number(e.target.value))}
                    className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm w-16"
                />
            </div>

            <div className="w-px h-8 bg-slate-700 mx-2" />

            <div className="flex flex-col">
                <label className="text-xs text-slate-500 font-bold uppercase">Compare Driver</label>
                <select 
                    value={compareDriver || ''} 
                    onChange={e => setCompareDriver(e.target.value || undefined)}
                    className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm"
                >
                    <option value="">None</option>
                    {['VER', 'LEC', 'HAM', 'RUS', 'NOR', 'PIA', 'ALO', 'STR', 'SAI', 'PER'].map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left Column: Charts */}
            <div className="lg:col-span-3 min-h-[600px]">
                <TelemetryChart 
                    year={year} 
                    race={race} 
                    driver={driver} 
                    lap={lap}
                    compareDriver={compareDriver}
                    compareLap={compareLap}
                    onCursorMove={setCursorData}
                />
            </div>

            {/* Right Column: HUDs */}
            <div className="flex flex-col gap-6">
                {/* Primary Driver HUD */}
                <div>
                    <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Primary Telemetry</h3>
                    {cursorData ? (
                        <DriverHUD 
                            driver={driver} 
                            telemetry={cursorData} 
                        />
                    ) : (
                        <div className="h-64 flex items-center justify-center border border-slate-800 rounded-xl bg-slate-900/50 text-slate-500 text-sm">
                            Hover over chart
                        </div>
                    )}
                </div>

                {/* Comparison Driver HUD */}
                {compareDriver && (
                    <div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Comparison Telemetry</h3>
                        {cursorData ? (
                            <DriverHUD 
                                driver={compareDriver} 
                                telemetry={compareCursorData as TelemetryPoint} 
                            />
                        ) : (
                            <div className="h-64 flex items-center justify-center border border-slate-800 rounded-xl bg-slate-900/50 text-slate-500 text-sm">
                                Hover over chart
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

      </div>
    </PageWrapper>
  );
}
