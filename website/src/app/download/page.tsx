"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { Download, Monitor, Activity, ShieldCheck, Terminal, HardDrive } from "lucide-react";
import { useState } from "react";
import { ScrambleText } from "@/components/ui/ScrambleText";

export default function DownloadPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-green)] selection:text-black">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto w-full relative">
        <div className="absolute top-40 right-10 w-96 h-96 bg-[var(--telemetry-green)]/10 blur-[150px] pointer-events-none" />
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center flex flex-col items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-green)] mb-6 w-fit panel-border shadow-[0_0_15px_rgba(0,255,0,0.1)]">
             <Activity className="w-3 h-3 animate-pulse" /> V1.0.0 RELEASE CANDIDATE
          </div>
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter mb-8 glitch-hover" data-text="ACQUIRE THE SYSTEM">
            <ScrambleText text="ACQUIRE THE SYSTEM" speed={30} scrambles={8} />
          </h1>
          <p className="text-zinc-400 font-mono text-xs md:text-sm max-w-2xl leading-relaxed border-l border-zinc-800 bg-[#050505] p-4 text-center">
            TelemetryX is distributed as a pre-compiled Electron binary containing the embedded DuckDB analytics engine and Python strategy nodes.
          </p>
        </motion.div>
      </section>

      <section className="py-12 px-6 max-w-5xl mx-auto w-full relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* macOS Download */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-white transition-all group relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <Monitor className="w-8 h-8 text-white mb-6 group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[10px] bg-white text-black px-2 py-0.5 font-bold">ARM64 / APPLE SILICON</span>
              </div>
              <h3 className="text-3xl font-bold uppercase mb-2 tracking-tight">macOS</h3>
              <p className="font-mono text-[10px] text-zinc-500 mb-8">Requires macOS 13.0+ (Ventura). Universal Binary (.dmg) optimized for M-Series architecture.</p>
            </div>
            
            <button 
              onClick={() => setDownloading('mac')}
              className="w-full bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-widest text-xs py-4 flex items-center justify-center gap-2 panel-border relative"
            >
              {downloading === 'mac' ? <span className="animate-pulse">DOWNLOADING PACKAGE...</span> : <><Download className="w-4 h-4" /> Download .dmg [142 MB]</>}
            </button>
          </motion.div>

          {/* Windows Download */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-50px" }}
            className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-[var(--telemetry-blue)] transition-all group relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--telemetry-blue)] shadow-[0_0_10px_rgba(0,229,255,0.5)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <Terminal className="w-8 h-8 text-[var(--telemetry-blue)] mb-6 group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[10px] bg-[var(--telemetry-blue)]/10 text-[var(--telemetry-blue)] border border-[var(--telemetry-blue)]/30 px-2 py-0.5 font-bold">X86_64</span>
              </div>
              <h3 className="text-3xl font-bold uppercase mb-2 tracking-tight">Windows</h3>
              <p className="font-mono text-[10px] text-zinc-500 mb-8">Requires Windows 10/11. Standalone executable (.exe) with bundled Python runtime.</p>
            </div>
            
            <button 
              onClick={() => setDownloading('win')}
              className="w-full bg-zinc-900 border border-zinc-700 text-white hover:border-[var(--telemetry-blue)] hover:text-[var(--telemetry-blue)] font-bold uppercase tracking-widest text-xs py-4 flex items-center justify-center gap-2 panel-border transition-colors"
            >
              {downloading === 'win' ? <span className="animate-pulse text-[var(--telemetry-blue)]">DOWNLOADING PACKAGE...</span> : <><Download className="w-4 h-4" /> Download .exe [156 MB]</>}
            </button>
          </motion.div>

        </div>
      </section>

      <section className="py-12 px-6 max-w-5xl mx-auto w-full border-t border-zinc-900">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 bg-black border border-zinc-800 p-4 panel-border">
            <ShieldCheck className="w-6 h-6 text-[var(--telemetry-green)]" />
            <div>
              <div className="font-bold text-xs uppercase tracking-widest text-white">Code Signed</div>
              <div className="font-mono text-[9px] text-zinc-500">Apple Notary & Authenticode</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-black border border-zinc-800 p-4 panel-border">
            <HardDrive className="w-6 h-6 text-white" />
            <div>
              <div className="font-bold text-xs uppercase tracking-widest text-white">Local Storage</div>
              <div className="font-mono text-[9px] text-zinc-500">No cloud DB required</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-black border border-zinc-800 p-4 panel-border">
            <Terminal className="w-6 h-6 text-zinc-500" />
            <div>
              <div className="font-bold text-xs uppercase tracking-widest text-white">CLI Available</div>
              <div className="font-mono text-[9px] text-zinc-500">npm i -g telemetryx-cli</div>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
