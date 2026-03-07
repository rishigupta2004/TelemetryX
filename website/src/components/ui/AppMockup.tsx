"use client";
import { motion } from "framer-motion";
import { Activity, Map, BarChart2, Settings, Zap, Database } from "lucide-react";

export function AppMockup() {
  return (
    <div className="relative w-full max-w-6xl mx-auto rounded-xl border border-zinc-800 bg-[#050505] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col mt-12 panel-border z-20">
      {/* Window Chrome */}
      <div className="h-8 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-red-500 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-yellow-500 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-green-500 transition-colors" />
        </div>
        <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
          TelemetryX Desktop <span className="text-zinc-700">|</span> DuckDB Core <span className="text-zinc-700">|</span> 1.0.0-rc
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--telemetry-green)]">
           <Zap className="w-3 h-3" /> 90 FPS
        </div>
      </div>

      {/* App Layout */}
      <div className="flex h-[400px] md:h-[600px]">
        {/* Sidebar */}
        <div className="w-12 md:w-16 border-r border-zinc-800 bg-black flex flex-col items-center py-4 gap-6 text-zinc-600">
          <div className="w-8 h-8 rounded bg-[var(--telemetry-blue)]/10 text-[var(--telemetry-blue)] flex items-center justify-center border border-[var(--telemetry-blue)]/30">
            <Activity className="w-4 h-4" />
          </div>
          <Map className="w-4 h-4 hover:text-white transition-colors" />
          <BarChart2 className="w-4 h-4 hover:text-white transition-colors" />
          <Database className="w-4 h-4 hover:text-white transition-colors mt-auto" />
          <Settings className="w-4 h-4 hover:text-white transition-colors" />
        </div>

        {/* Timing Tower (Left Panel) */}
        <div className="w-48 md:w-64 border-r border-zinc-800 bg-[#0a0a0a] flex flex-col font-mono hidden sm:flex">
          <div className="h-10 border-b border-zinc-800 flex items-center px-4 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Timing Tower
          </div>
          <div className="flex-1 overflow-hidden p-2 space-y-1">
            {[
              { pos: 1, driver: "VER", gap: "Leader", s1: "P", s2: "P", s3: "G" },
              { pos: 2, driver: "NOR", gap: "+1.243", s1: "G", s2: "Y", s3: "G" },
              { pos: 3, driver: "LEC", gap: "+2.104", s1: "Y", s2: "G", s3: "G" },
              { pos: 4, driver: "PER", gap: "+3.455", s1: "G", s2: "G", s3: "Y" },
              { pos: 5, driver: "SAI", gap: "+4.122", s1: "Y", s2: "Y", s3: "G" },
              { pos: 6, driver: "HAM", gap: "+5.001", s1: "G", s2: "Y", s3: "Y" },
              { pos: 7, driver: "RUS", gap: "+6.233", s1: "Y", s2: "G", s3: "Y" },
              { pos: 8, driver: "PIA", gap: "+8.112", s1: "Y", s2: "Y", s3: "Y" },
              { pos: 9, driver: "ALO", gap: "+9.450", s1: "G", s2: "Y", s3: "G" },
              { pos: 10, driver: "STR", gap: "+10.11", s1: "Y", s2: "Y", s3: "Y" },
            ].map((d, i) => (
              <div key={i} className={`flex items-center text-[9px] md:text-[10px] p-1.5 ${i === 0 ? 'bg-zinc-800/50 border border-zinc-700' : 'hover:bg-zinc-900'} cursor-default`}>
                <span className="w-3 md:w-4 text-zinc-500">{d.pos}</span>
                <span className="w-1 h-3 bg-[var(--telemetry-blue)] mx-1.5 md:mx-2" />
                <span className="w-6 md:w-8 font-bold text-white">{d.driver}</span>
                <span className="flex-1 text-right text-zinc-400 mr-2 md:mr-3">{d.gap}</span>
                <div className="flex gap-1">
                  <span className={`w-1.5 h-1.5 md:w-2 md:h-2 ${d.s1 === 'P' ? 'bg-[var(--telemetry-purple)]' : d.s1 === 'G' ? 'bg-[var(--telemetry-green)]' : 'bg-[var(--telemetry-yellow)]'}`} />
                  <span className={`w-1.5 h-1.5 md:w-2 md:h-2 ${d.s2 === 'P' ? 'bg-[var(--telemetry-purple)]' : d.s2 === 'G' ? 'bg-[var(--telemetry-green)]' : 'bg-[var(--telemetry-yellow)]'}`} />
                  <span className={`w-1.5 h-1.5 md:w-2 md:h-2 ${d.s3 === 'P' ? 'bg-[var(--telemetry-purple)]' : d.s3 === 'G' ? 'bg-[var(--telemetry-green)]' : 'bg-[var(--telemetry-yellow)]'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
          <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-4 text-[10px] font-mono text-zinc-500">
            <span className="text-white border-b-2 border-white py-2">Track Map</span>
            <span className="hover:text-white cursor-pointer py-2">Telemetry</span>
            <span className="hover:text-white cursor-pointer py-2">Strategy</span>
          </div>

          <div className="flex-1 relative p-4 md:p-6 grid grid-rows-3 gap-4 md:gap-6">
             {/* Map Placeholder Area */}
             <div className="row-span-2 border border-zinc-800 bg-[#050505] rounded relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-dot-grid opacity-20" />
                <svg viewBox="0 0 100 100" className="w-full h-full max-w-xs md:max-w-md stroke-zinc-700 stroke-[0.5] fill-none opacity-50">
                  <path d="M 20 50 C 20 20, 80 20, 80 50 C 80 80, 20 80, 20 50" />
                </svg>
                {/* Simulated Cars */}
                <motion.div className="absolute w-2 h-2 bg-[var(--telemetry-blue)] rounded-full shadow-[0_0_10px_var(--telemetry-blue)]" animate={{ x: [-100, 100, -100], y: [0, 50, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
                <motion.div className="absolute w-2 h-2 bg-[var(--telemetry-green)] rounded-full shadow-[0_0_10px_var(--telemetry-green)]" animate={{ x: [-80, 120, -80], y: [10, 60, 10] }} transition={{ duration: 4.1, repeat: Infinity, ease: "linear" }} />
                
                <div className="absolute bottom-4 left-4 font-mono text-[9px] text-zinc-500 bg-black/80 px-2 py-1 border border-zinc-800">
                  CANVAS_RENDERER // SCALE: 1.2x
                </div>
             </div>

             {/* Telemetry Trace Area */}
             <div className="row-span-1 border border-zinc-800 bg-[#050505] rounded p-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2 font-mono text-[9px] text-zinc-500">
                  <span>THROTTLE [%]</span>
                  <span className="text-[var(--telemetry-green)]">VER vs NOR</span>
                </div>
                <div className="relative h-full w-full">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]" />
                  <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="w-full h-full absolute inset-0 stroke-[1.5] fill-none">
                    <motion.path d="M0 100 L10 100 L20 20 L50 20 L60 100 L90 100 L100 0" className="stroke-[var(--telemetry-blue)]" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, repeat: Infinity }} />
                    <motion.path d="M0 100 L15 100 L25 30 L55 30 L65 100 L85 100 L100 10" className="stroke-zinc-600" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, repeat: Infinity }} />
                  </svg>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
