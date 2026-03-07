"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { motion, useScroll, useTransform } from "framer-motion";
import { DataCubes } from "@/components/three/DataCubes";
import { Database, Binary, Combine } from "lucide-react";
import { ScrambleText } from "@/components/ui/ScrambleText";

export default function Ingestion() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-blue)] selection:text-black">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="relative h-[100vh] flex flex-col items-center justify-center overflow-hidden border-b border-zinc-900">
        <DataCubes />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)] pointer-events-none z-10" />
        <div className="absolute inset-0 bg-dot-grid opacity-10 z-10 pointer-events-none" />

        <motion.div 
          style={{ y }}
          className="relative z-20 text-center max-w-4xl px-6 flex flex-col items-center mt-32"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-blue)] mb-6 panel-border backdrop-blur-md shadow-[0_0_15px_rgba(0,229,255,0.2)]">
             <Binary className="w-3 h-3 animate-pulse" /> E7 NODE // INGESTION WORKFLOW
          </div>
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-6 glitch-hover" data-text="DATA INGESTION">
            <ScrambleText text="DATA\nINGESTION" speed={25} scrambles={5} />
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed mx-auto bg-black/80 p-6 border-l-2 border-[var(--telemetry-blue)] backdrop-blur-md panel-border shadow-2xl">
            Formula 1 generates roughly 1.5 million telemetry data points per second across a 20-car grid. Our E7 backend node intercepts these raw UDP streams, compresses them into Parquet blobs, and funnels them directly into DuckDB's in-memory engine.
          </p>
        </motion.div>
      </section>

      <section className="py-32 px-6 max-w-7xl mx-auto w-full relative z-20">
        <h2 className="text-3xl font-black uppercase mb-12 flex items-center gap-4 text-zinc-100">
          <Combine className="w-8 h-8 text-[var(--telemetry-red)]" /> The Funnel
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs text-zinc-400">
           
           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#050505] p-6 border border-zinc-800 panel-border group hover:bg-[#0a0a0a]">
             <div className="text-[var(--telemetry-blue)] mb-4 font-bold text-sm">STAGE 01: RAW UDP</div>
             <p className="mb-4 leading-relaxed">FastAPI workers bind to multicast sockets, receiving raw byte arrays directly from the trackside timing systems.</p>
             <div className="bg-black border border-zinc-800 p-2 text-[8px] text-zinc-600 break-all h-24 overflow-hidden group-hover:text-zinc-400 transition-colors">
               0A 2B 4C 8D 11 F2 33 44 55 66 77 88 99 AA BB CC DD EE FF 00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF 00 11 22 33 44 55 66...
             </div>
           </motion.div>

           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} className="bg-[#050505] p-6 border border-zinc-800 panel-border group hover:bg-[#0a0a0a]">
             <div className="text-[var(--telemetry-purple)] mb-4 font-bold text-sm">STAGE 02: PARQUET</div>
             <p className="mb-4 leading-relaxed">Bytes are decoded into typed arrays and written instantly to columnar Parquet files on disk, maximizing compression.</p>
             <div className="bg-black border border-zinc-800 p-2 text-[10px] space-y-1 text-zinc-500 font-bold h-24 overflow-hidden">
               <div className="flex justify-between"><span>session_id</span> <span className="text-[var(--telemetry-purple)]">UINT32</span></div>
               <div className="flex justify-between"><span>speed_kph</span> <span className="text-[var(--telemetry-purple)]">FLOAT32</span></div>
               <div className="flex justify-between"><span>throttle</span> <span className="text-[var(--telemetry-purple)]">UINT8</span></div>
               <div className="flex justify-between"><span>brake</span> <span className="text-[var(--telemetry-purple)]">UINT8</span></div>
             </div>
           </motion.div>

           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} className="bg-[#050505] p-6 border border-zinc-800 panel-border group hover:bg-[#0a0a0a]">
             <div className="text-[var(--telemetry-red)] mb-4 font-bold text-sm">STAGE 03: DUCKDB CORE</div>
             <p className="mb-4 leading-relaxed">The frontend issues zero-network SQL queries directly against the local Parquet files via the embedded DuckDB WASM/Native connector.</p>
             <div className="bg-black border border-zinc-800 p-2 text-[10px] text-[var(--telemetry-red)] flex items-center justify-center h-24 relative overflow-hidden">
               <div className="absolute inset-0 bg-[var(--telemetry-red)] opacity-5 animate-pulse" />
               <Database className="w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity" />
             </div>
           </motion.div>

        </div>
      </section>

      <Footer />
    </main>
  );
}
