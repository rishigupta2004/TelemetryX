"use client";
import { motion } from "framer-motion";
import { Activity, Clock, AlertTriangle, CloudRain, FastForward, Play, Pause, ThermometerSun, Wind } from "lucide-react";

export function AppMockup() {
  return (
    <div className="relative w-full max-w-[1400px] mx-auto rounded-xl border border-zinc-800 bg-[#0A0A0A] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col mt-12 panel-border z-20">
      
      {/* OS Chrome */}
      <div className="h-8 bg-[#111] border-b border-zinc-800 flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-red-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-yellow-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-green-500 transition-colors cursor-pointer" />
        </div>
        <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-3 h-3 text-[var(--telemetry-blue)]" />
          TelemetryX <span className="text-zinc-700">|</span> 2024_Bahrain_Grand_Prix.parquet
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--telemetry-green)]">
           90 FPS
        </div>
      </div>

      {/* Main App Layout (mimicking TimingView.tsx) */}
      <div className="flex flex-col h-[500px] md:h-[700px] p-2 gap-2 bg-[#050505]">
        
        {/* Top Header / View Selector */}
        <div className="flex items-center justify-between px-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400 font-sans">Live Classification</div>
          <div className="flex gap-2">
             <div className="border border-zinc-800 bg-[#111] px-3 py-1 text-[10px] font-mono tracking-[0.1em] text-white uppercase shadow-[0_0_10px_rgba(0,229,255,0.1)] border-[var(--telemetry-blue)]/50">Timing View</div>
             <div className="border border-zinc-800 bg-[#111] px-3 py-1 text-[10px] font-mono tracking-[0.1em] text-zinc-500 uppercase hover:text-zinc-300 cursor-pointer">Telemetry</div>
             <div className="border border-zinc-800 bg-[#111] px-3 py-1 text-[10px] font-mono tracking-[0.1em] text-zinc-500 uppercase hover:text-zinc-300 cursor-pointer">Strategy</div>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex flex-1 gap-2 overflow-hidden">
          
          {/* LEFT: Timing Tower (38%) */}
          <div className="flex-[0_0_38%] flex flex-col border border-zinc-800 bg-[#0a0a0a] overflow-hidden hidden sm:flex">
             <div className="flex text-[9px] font-mono text-zinc-500 border-b border-zinc-800 p-2 bg-[#111]">
               <span className="w-6">POS</span>
               <span className="w-10">NO</span>
               <span className="flex-1">DRIVER</span>
               <span className="w-16 text-right">GAP</span>
               <span className="w-16 text-right">INT</span>
             </div>
             <div className="flex-1 overflow-hidden p-1 space-y-0.5">
               {[
                 { pos: 1, no: 1, driver: "VER", team: "RBR", gap: "Leader", int: "-", color: "#005aff" },
                 { pos: 2, no: 4, driver: "NOR", team: "MCL", gap: "+1.243", int: "+1.243", color: "#ff8000" },
                 { pos: 3, no: 16, driver: "LEC", team: "FER", gap: "+2.104", int: "+0.861", color: "#dc0000" },
                 { pos: 4, no: 11, driver: "PER", team: "RBR", gap: "+3.455", int: "+1.351", color: "#005aff" },
                 { pos: 5, no: 55, driver: "SAI", team: "FER", gap: "+4.122", int: "+0.667", color: "#dc0000" },
                 { pos: 6, no: 44, driver: "HAM", team: "MER", gap: "+5.001", int: "+0.879", color: "#00d2be" },
                 { pos: 7, no: 63, driver: "RUS", team: "MER", gap: "+6.233", int: "+1.232", color: "#00d2be" },
                 { pos: 8, no: 81, driver: "PIA", team: "MCL", gap: "+8.112", int: "+1.879", color: "#ff8000" },
                 { pos: 9, no: 14, driver: "ALO", team: "AMR", gap: "+9.450", int: "+1.338", color: "#006f62" },
                 { pos: 10, no: 18, driver: "STR", team: "AMR", gap: "+10.11", int: "+0.660", color: "#006f62" },
                 { pos: 11, no: 22, driver: "TSU", team: "RBA", gap: "+12.44", int: "+2.330", color: "#2b4562" },
                 { pos: 12, no: 3, driver: "RIC", team: "RBA", gap: "+13.10", int: "+0.660", color: "#2b4562" },
               ].map((d, i) => (
                 <div key={i} className={`flex items-center text-[10px] font-mono p-1.5 ${i === 0 ? 'bg-zinc-800/80 border border-zinc-700' : 'bg-[#111] hover:bg-zinc-800'}`}>
                   <span className="w-6 text-zinc-500">{d.pos}</span>
                   <span className="w-10 text-white font-bold" style={{ color: d.color }}>{d.no}</span>
                   <span className="flex-1 font-bold text-white tracking-wider">{d.driver}</span>
                   <span className="w-16 text-right text-zinc-300">{d.gap}</span>
                   <span className="w-16 text-right text-zinc-500">{d.int}</span>
                   <div className="w-12 flex justify-end gap-0.5 ml-2">
                     <span className={`w-2 h-3 ${i%3===0 ? 'bg-[var(--telemetry-purple)]' : 'bg-[var(--telemetry-green)]'}`} />
                     <span className={`w-2 h-3 ${i%2===0 ? 'bg-[var(--telemetry-purple)]' : 'bg-[var(--telemetry-green)]'}`} />
                     <span className={`w-2 h-3 ${i%4===0 ? 'bg-[var(--telemetry-yellow)]' : 'bg-[var(--telemetry-green)]'}`} />
                   </div>
                 </div>
               ))}
             </div>
          </div>

          {/* CENTER: Track Map (Flex-1) */}
          <div className="flex-1 border border-zinc-800 bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center">
             <div className="absolute inset-0 bg-dot-grid opacity-10" />
             <div className="absolute top-2 left-2 text-[9px] font-mono text-zinc-500 bg-black/80 px-2 py-1 border border-zinc-800">
               TRACK MAP // SVG CANVAS RENDERER
             </div>
             
             <svg viewBox="0 0 200 200" className="w-[80%] h-[80%] stroke-zinc-700 stroke-[2] fill-none opacity-80">
               <path d="M 50 150 L 150 150 C 160 150, 170 140, 170 130 L 170 50 C 170 40, 160 30, 150 30 L 100 30 C 90 30, 80 40, 80 50 L 80 80 C 80 90, 70 100, 60 100 L 40 100 C 30 100, 20 110, 20 120 L 20 130 C 20 140, 30 150, 50 150" />
               <path d="M 50 150 L 150 150" className="stroke-[var(--telemetry-green)]" strokeDasharray="4 4" />
               <path d="M 170 130 L 170 50" className="stroke-[var(--telemetry-purple)]" />
             </svg>
             
             <motion.div className="absolute w-3 h-3 bg-[#005aff] border border-white rounded-full flex items-center justify-center text-[6px] font-bold text-white z-10 shadow-[0_0_10px_#005aff]" animate={{ x: [-150, 150, 150, -150], y: [100, 100, -100, -100] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>1</motion.div>
             <motion.div className="absolute w-3 h-3 bg-[#ff8000] border border-white rounded-full flex items-center justify-center text-[6px] font-bold text-white z-10 shadow-[0_0_10px_#ff8000]" animate={{ x: [-130, 150, 150, -150], y: [100, 100, -80, -100] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>4</motion.div>
          </div>

          {/* RIGHT: Weather + Race Control (22%) */}
          <div className="flex-[0_0_22%] flex flex-col gap-2 hidden lg:flex">
            
            <div className="border border-zinc-800 bg-[#0a0a0a] p-3">
              <div className="text-[9px] font-mono text-zinc-500 mb-3 uppercase tracking-widest border-b border-zinc-800 pb-1">Live Weather</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#111] p-2 flex flex-col items-center">
                  <ThermometerSun className="w-4 h-4 text-zinc-400 mb-1" />
                  <span className="text-white font-mono text-lg">28°</span>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase">Track</span>
                </div>
                <div className="bg-[#111] p-2 flex flex-col items-center">
                  <CloudRain className="w-4 h-4 text-zinc-400 mb-1" />
                  <span className="text-[var(--telemetry-blue)] font-mono text-lg">0%</span>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase">Rain</span>
                </div>
              </div>
            </div>

            <div className="flex-1 border border-zinc-800 bg-[#0a0a0a] flex flex-col overflow-hidden">
               <div className="text-[9px] font-mono text-zinc-500 p-2 uppercase tracking-widest border-b border-zinc-800 bg-[#111]">Race Control</div>
               <div className="flex-1 p-2 space-y-2 overflow-hidden font-mono text-[9px]">
                 <div className="flex gap-2 text-zinc-400">
                   <span className="text-zinc-600">18:04</span>
                   <span className="text-[var(--telemetry-green)] border border-[var(--telemetry-green)] px-1">TRACK CLEAR</span>
                 </div>
                 <div className="flex gap-2 text-zinc-400">
                   <span className="text-zinc-600">18:02</span>
                   <span>CAR 44 (HAM) TIME 1:34.223 DELETED - TRACK LIMITS TURN 4</span>
                 </div>
                 <div className="flex gap-2 text-zinc-400">
                   <span className="text-zinc-600">18:00</span>
                   <span className="text-[var(--telemetry-yellow)] border border-[var(--telemetry-yellow)] px-1">YELLOW FLAG IN SECTOR 2</span>
                 </div>
                 <div className="flex gap-2 text-zinc-400">
                   <span className="text-zinc-600">17:58</span>
                   <span>DRS ENABLED</span>
                 </div>
               </div>
            </div>

          </div>

        </div>

        {/* BOTTOM: Playback Bar */}
        <div className="h-12 border border-zinc-800 bg-[#0a0a0a] flex items-center px-4 gap-4 font-mono shrink-0">
           <div className="flex items-center gap-2">
             <button className="w-8 h-8 bg-[#111] border border-zinc-700 flex items-center justify-center hover:bg-white hover:text-black transition-colors">
               <Pause className="w-4 h-4 fill-current" />
             </button>
             <button className="w-8 h-8 bg-[#111] border border-zinc-700 flex items-center justify-center hover:bg-white hover:text-black transition-colors text-zinc-400">
               <FastForward className="w-4 h-4 fill-current" />
             </button>
           </div>
           
           <div className="text-[10px] text-[var(--telemetry-green)] font-bold bg-[#022] px-2 py-1 border border-[var(--telemetry-green)]/30 hidden sm:block">
             LIVE
           </div>
           
           <div className="flex-1 flex items-center gap-4">
             <span className="text-[10px] text-zinc-500 hidden sm:block">1:24:03</span>
             <div className="flex-1 h-2 bg-zinc-900 rounded-full relative cursor-pointer border border-zinc-800">
               <div className="absolute top-0 left-0 h-full bg-[var(--telemetry-blue)] w-[85%] rounded-full shadow-[0_0_10px_rgba(0,229,255,0.5)]" />
               <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" style={{ left: '85%' }} />
             </div>
             <span className="text-[10px] text-zinc-500 hidden sm:block">1:30:00</span>
           </div>
        </div>

      </div>
    </div>
  );
}
