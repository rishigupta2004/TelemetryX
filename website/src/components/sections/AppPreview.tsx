"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Play, Pause, FastForward, Activity, Map, BarChart2, Database, Settings } from "lucide-react";

export function AppPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section
      className="py-32 relative bg-[#050505] border-t border-zinc-900 overflow-hidden"
      ref={containerRef}
      data-home-section="app-preview"
    >
      <div className="absolute inset-0 bg-dot-grid opacity-10 pointer-events-none" />
      
      {/* Huge Background Typography */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full overflow-hidden flex justify-center pointer-events-none opacity-5">
        <h2 className="text-[200px] font-black uppercase tracking-tighter whitespace-nowrap text-white">COMMAND CENTER</h2>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-blue)] mb-6 panel-border">
             THE FRONTEND
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-white uppercase tracking-tighter">
            Desktop-Native UI
          </h2>
          <p className="text-zinc-400 font-mono text-sm max-w-2xl mx-auto leading-relaxed border-l-2 border-[var(--telemetry-blue)] pl-4">
            A 1:1 replica of the pit-wall. No browser tabs. No cloud lag. The Electron shell grants raw GPU access to render dense telemetry and virtualized timing towers simultaneously.
          </p>
        </div>

        {/* The Giant Mockup */}
        <motion.div
          data-pin-target="app-preview"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full rounded-xl border border-zinc-800 bg-[#0a0a0a] shadow-[0_0_100px_rgba(0,0,0,1)] panel-border overflow-hidden"
        >
          {/* Title Bar */}
          <div className="h-10 bg-[#111] border-b border-zinc-800 flex items-center px-4 justify-between select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-red-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-yellow-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-green-500 transition-colors" />
            </div>
            <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3 text-[var(--telemetry-blue)]" />
              TELEMETRYX <span className="text-zinc-700">|</span> SESSION_9158
            </div>
            <div className="font-mono text-[10px] text-[var(--telemetry-green)] bg-[#020] px-2 py-0.5 border border-[var(--telemetry-green)]/30">
               90 FPS
            </div>
          </div>

          <div className="flex h-[600px]">
            {/* Sidebar */}
            <div className="w-14 border-r border-zinc-800 bg-black flex flex-col items-center py-4 gap-6 text-zinc-600 hidden sm:flex">
              <div className="w-8 h-8 rounded bg-[var(--telemetry-blue)]/10 text-[var(--telemetry-blue)] flex items-center justify-center border border-[var(--telemetry-blue)]/30">
                <Activity className="w-4 h-4" />
              </div>
              <Map className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <BarChart2 className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <Database className="w-4 h-4 hover:text-white transition-colors cursor-pointer mt-auto" />
              <Settings className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
            </div>

            {/* Layout Grid container like the real app */}
            <div className="flex-1 flex flex-col bg-[#050505] p-2 gap-2 overflow-hidden">
              
              {/* Top View Switcher */}
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2 px-1">
                <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-sans hidden sm:block">Live Classification</div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="border border-zinc-800 bg-[#111] px-4 py-1.5 text-[10px] font-mono text-white shadow-[0_0_10px_rgba(0,229,255,0.1)] border-[var(--telemetry-blue)]/50">TIMING VIEW</div>
                  <div className="border border-zinc-800 bg-[#111] px-4 py-1.5 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors cursor-pointer">TELEMETRY</div>
                </div>
              </div>

              <div className="flex flex-1 gap-2 overflow-hidden">
                {/* Left: Virtualized Timing Tower */}
                <div className="w-full sm:w-[40%] md:w-[30%] flex flex-col border border-zinc-800 bg-black">
                  <div className="flex text-[9px] font-mono text-zinc-500 border-b border-zinc-800 p-2 bg-[#111]">
                    <span className="w-6">POS</span>
                    <span className="w-8">NO</span>
                    <span className="flex-1">DRIVER</span>
                    <span className="w-16 text-right">GAP</span>
                  </div>
                  <div className="flex-1 overflow-hidden p-1 space-y-0.5">
                    {[
                      { p: 1, n: 1, d: "VER", g: "Leader", c: "#005aff", s: ["P","P","G"] },
                      { p: 2, n: 4, d: "NOR", g: "+1.2", c: "#ff8000", s: ["G","Y","G"] },
                      { p: 3, n: 16, d: "LEC", g: "+2.1", c: "#dc0000", s: ["Y","G","G"] },
                      { p: 4, n: 11, d: "PER", g: "+3.4", c: "#005aff", s: ["G","G","Y"] },
                      { p: 5, n: 55, d: "SAI", g: "+4.1", c: "#dc0000", s: ["Y","Y","G"] },
                      { p: 6, n: 44, d: "HAM", g: "+5.0", c: "#00d2be", s: ["G","Y","Y"] },
                      { p: 7, n: 63, d: "RUS", g: "+6.2", c: "#00d2be", s: ["Y","G","Y"] },
                      { p: 8, n: 81, d: "PIA", g: "+8.1", c: "#ff8000", s: ["Y","Y","Y"] },
                    ].map(d => (
                      <div key={d.p} className={`flex items-center text-[10px] font-mono p-2 ${d.p===1 ? 'bg-zinc-900 border border-zinc-800' : 'hover:bg-zinc-900'}`}>
                        <span className="w-6 text-zinc-500">{d.p}</span>
                        <span className="w-8 text-white font-bold" style={{color: d.c}}>{d.n}</span>
                        <span className="flex-1 text-white font-bold tracking-wider">{d.d}</span>
                        <span className="w-12 text-right text-zinc-400 mr-4">{d.g}</span>
                        <div className="flex gap-1 hidden lg:flex">
                          {d.s.map((sector, i) => (
                            <span key={i} className={`w-2 h-3 ${sector==='P'?'bg-[var(--telemetry-purple)]':sector==='G'?'bg-[var(--telemetry-green)]':'bg-[var(--telemetry-yellow)]'}`} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Center: Track Map Canvas */}
                <div className="flex-1 border border-zinc-800 bg-[#0A0A0A] relative flex items-center justify-center overflow-hidden group hidden sm:flex">
                  <div className="absolute inset-0 bg-dot-grid opacity-10" />
                  <div className="absolute top-4 left-4 bg-black/80 border border-zinc-800 px-3 py-1 font-mono text-[9px] text-zinc-500 z-10">
                    SVG TRACK MAP // ZOOM: 100%
                  </div>
                  
                  {/* High-res SVG map */}
                  <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] stroke-zinc-700 stroke-[1.5] fill-none opacity-80">
                    <path d="M20,50 Q20,20 50,20 T80,50 T50,80 T20,50" />
                    <path d="M20,50 Q20,20 50,20" className="stroke-[var(--telemetry-green)]" strokeWidth="2" />
                    <path d="M50,20 T80,50" className="stroke-[var(--telemetry-purple)]" strokeWidth="2" />
                  </svg>

                  {/* Animated Cars */}
                  <motion.div className="absolute w-4 h-4 bg-[#005aff] rounded-full border-2 border-white flex items-center justify-center text-[7px] font-bold text-white shadow-[0_0_15px_#005aff] z-20" animate={{ x: [-100, 100, 100, -100, -100], y: [0, -80, 80, 80, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>1</motion.div>
                  <motion.div className="absolute w-4 h-4 bg-[#dc0000] rounded-full border-2 border-white flex items-center justify-center text-[7px] font-bold text-white shadow-[0_0_15px_#dc0000] z-20" animate={{ x: [-80, 120, 120, -80, -80], y: [20, -60, 100, 100, 20] }} transition={{ duration: 6.2, repeat: Infinity, ease: "linear" }}>16</motion.div>
                </div>
              </div>

              {/* Bottom: Playback Controls */}
              <div className="h-12 border border-zinc-800 bg-[#0A0A0A] flex items-center px-4 gap-4 font-mono shrink-0">
                <div className="flex gap-2">
                  <button className="w-8 h-8 bg-[#111] border border-zinc-700 flex items-center justify-center hover:bg-white hover:text-black transition-colors"><Pause className="w-4 h-4 fill-current"/></button>
                  <button className="w-8 h-8 bg-[#111] border border-zinc-700 flex items-center justify-center text-zinc-500"><FastForward className="w-4 h-4 fill-current"/></button>
                </div>
                <div className="text-[10px] text-[var(--telemetry-green)] font-bold bg-[#020] px-3 py-1 border border-[var(--telemetry-green)]/30 animate-pulse hidden md:block">LIVE</div>
                <div className="flex-1 flex items-center gap-4 px-4">
                  <span className="text-[10px] text-zinc-500 hidden sm:block">14:02:11</span>
                  <div className="flex-1 h-1.5 bg-zinc-900 rounded-full relative overflow-hidden cursor-crosshair">
                    <motion.div className="absolute top-0 left-0 h-full bg-[var(--telemetry-blue)] shadow-[0_0_10px_var(--telemetry-blue)]" initial={{ width: "0%" }} animate={{ width: "85%" }} transition={{ duration: 10, ease: "linear" }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 hidden sm:block">15:30:00</span>
                </div>
              </div>

            </div>
          </div>
        </motion.div>

        {/* Technical Callouts below mockup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 font-mono text-xs" data-stagger-group="app-preview-callouts">
           <div className="border border-zinc-800 bg-black p-4 text-zinc-400 panel-border hover:border-zinc-500 transition-colors" data-stagger-item>
             <span className="text-white font-bold block mb-2">1. Layout Virtualization</span>
             The timing tower renders only the visible rows to the DOM. As positions shuffle, memory remains flat.
            </div>
            <div className="border border-zinc-800 bg-black p-4 text-zinc-400 panel-border hover:border-zinc-500 transition-colors" data-stagger-item>
              <span className="text-white font-bold block mb-2">2. SVG Path Rasterization</span>
              The track map uses SVG for crisp paths, but car position dots are calculated and pushed via GPU transforms to avoid DOM repaints.
            </div>
            <div className="border border-zinc-800 bg-black p-4 text-zinc-400 panel-border hover:border-zinc-500 transition-colors" data-stagger-item>
              <span className="text-white font-bold block mb-2">3. Transient Store sync</span>
              The playback timeline scrubs without triggering React state changes, controlled by Zustand subscribe streams.
            </div>
        </div>

      </div>
    </section>
  );
}
