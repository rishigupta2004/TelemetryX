"use client";
import { Navbar } from "@/components/sections/Navbar";
import { ThermalTire } from "@/components/three/ThermalTire";
import { motion } from "framer-motion";
import { ScrambleText } from "@/components/ui/ScrambleText";

export default function Tires() {
  return (
    <main className="h-screen w-screen bg-black text-white flex flex-col font-sans overflow-hidden selection:bg-[var(--telemetry-red)]">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="relative w-full h-full pt-16 flex flex-col justify-center">
        <ThermalTire />
        
        <motion.div 
           initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.3 }}
           className="relative z-10 px-10 max-w-lg pointer-events-none"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--telemetry-red)]/10 border border-[var(--telemetry-red)]/50 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-red)] mb-6 panel-border backdrop-blur-md shadow-[0_0_15px_rgba(255,42,42,0.2)] w-fit">
             THERMODYNAMIC_SIMULATION // ONLINE
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4 text-white glitch-hover" data-text="THERMAL MAP">
            <ScrambleText text="THERMAL\nMAP" speed={30} scrambles={6} />
          </h1>
          
          <div className="bg-black/80 border border-zinc-800 p-6 font-mono text-[10px] text-zinc-400 panel-border backdrop-blur-md space-y-4">
            <p>
              Tire temperatures are a closely guarded secret on the pit wall. TelemetryX reverse-engineers surface thermal mapping using micro-sector slip angles and localized track temperature.
            </p>
            <p className="text-[var(--telemetry-yellow)]">
              &gt; USE THE [SYS_CTRL] PANEL TO OVERRIDE TIRE TEMP AND WEAR LEVEL.
            </p>
          </div>
        </motion.div>
      </section>

    </main>
  );
}
