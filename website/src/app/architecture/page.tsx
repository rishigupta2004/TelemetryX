"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { motion, useScroll, useTransform } from "framer-motion";
import { Database, Zap, HardDrive, Cpu, Terminal, ArrowDown } from "lucide-react";

export default function Architecture() {
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-blue)] selection:text-black">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto w-full relative">
        <div className="absolute top-40 left-10 w-64 h-64 bg-[var(--telemetry-purple)]/20 blur-[150px] pointer-events-none" />
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-6 w-fit panel-border">
             TECHNICAL PAPER // V1.0
          </div>
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 glitch-hover" data-text="SYSTEM ARCHITECTURE">
            SYSTEM<br/>ARCHITECTURE
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed border-l-2 border-[var(--telemetry-blue)] pl-4">
            TelemetryX is not a web app. It is a broadcast-grade, desktop-first command center. We threw out the standard web playbook to achieve raw, sustained performance. No React re-renders on every telemetry tick. No massive Redux stores freezing the main thread.
          </p>
        </motion.div>
      </section>

      <section className="py-20 px-6 max-w-7xl mx-auto w-full relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          <div className="space-y-12 relative z-10">
            {/* Electron Core */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
              className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-[var(--telemetry-blue)] transition-colors group"
            >
              <HardDrive className="w-8 h-8 text-[var(--telemetry-blue)] mb-6 group-hover:animate-pulse" />
              <h3 className="text-2xl font-bold uppercase mb-4 tracking-tight">Electron Container</h3>
              <p className="font-mono text-sm text-zinc-400 mb-4">
                Bypassing browser resource throttling. TelemetryX utilizes a customized Electron shell granting direct hardware access and GPU rasterization for multi-window setups.
              </p>
              <ul className="font-mono text-xs text-zinc-500 space-y-2">
                <li className="flex items-center gap-2"><span className="text-[var(--telemetry-blue)]">&gt;&gt;</span> GPU hardware acceleration</li>
                <li className="flex items-center gap-2"><span className="text-[var(--telemetry-blue)]">&gt;&gt;</span> Unrestricted Web Worker threading</li>
              </ul>
            </motion.div>

            {/* Local DuckDB */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
              className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-[var(--telemetry-red)] transition-colors group"
            >
              <Database className="w-8 h-8 text-[var(--telemetry-red)] mb-6 group-hover:animate-pulse" />
              <h3 className="text-2xl font-bold uppercase mb-4 tracking-tight">Embedded DuckDB</h3>
              <p className="font-mono text-sm text-zinc-400 mb-4">
                Cloud databases introduce network latency. We eliminated it. A local DuckDB instance parses millions of parquet telemetry rows instantly, executing complex aggregations in milliseconds.
              </p>
              <ul className="font-mono text-xs text-zinc-500 space-y-2">
                <li className="flex items-center gap-2"><span className="text-[var(--telemetry-red)]">&gt;&gt;</span> Columnar OLAP execution</li>
                <li className="flex items-center gap-2"><span className="text-[var(--telemetry-red)]">&gt;&gt;</span> Zero-network-call queries</li>
              </ul>
            </motion.div>
          </div>

          <div className="relative">
            <div className="sticky top-40">
              <div className="panel-border bg-black border border-zinc-800 p-6 h-[500px] font-mono text-xs text-[var(--telemetry-green)] flex flex-col shadow-[0_0_50px_rgba(0,0,0,1)] relative overflow-hidden">
                <div className="absolute inset-0 bg-dot-grid opacity-10" />
                
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4 z-10">
                  <span className="uppercase tracking-widest text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[var(--telemetry-green)]" /> Pipeline Flow
                  </span>
                  <span className="bg-[var(--telemetry-green)]/10 text-[var(--telemetry-green)] px-2 py-0.5 animate-pulse">LIVE</span>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center gap-4 z-10 opacity-80">
                  <div className="border border-zinc-800 bg-zinc-900 w-full p-4 text-center text-white">PYTHON FASTAPI LAYER</div>
                  <ArrowDown className="text-zinc-600 animate-bounce" />
                  <div className="border border-[var(--telemetry-red)] bg-[#200] w-full p-4 text-center text-[var(--telemetry-red)] shadow-[0_0_10px_rgba(255,0,0,0.2)]">LOCAL DUCKDB AGGREGATION</div>
                  <ArrowDown className="text-zinc-600 animate-bounce" />
                  <div className="border border-zinc-800 bg-zinc-900 w-full p-4 text-center text-white">WEBSOCKET IPC STREAM</div>
                  <ArrowDown className="text-zinc-600 animate-bounce" />
                  <div className="border border-[var(--telemetry-blue)] bg-[#002] w-full p-4 text-center text-[var(--telemetry-blue)] shadow-[0_0_10px_rgba(0,229,255,0.2)]">WEB WORKERS (NON-BLOCKING)</div>
                  <ArrowDown className="text-zinc-600 animate-bounce" />
                  <div className="border border-[var(--telemetry-green)] bg-[#020] w-full p-4 text-center text-[var(--telemetry-green)] shadow-[0_0_10px_rgba(0,255,0,0.2)]">CANVAS / UI RENDER (90FPS)</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>
      
      <Footer />
    </main>
  );
}
