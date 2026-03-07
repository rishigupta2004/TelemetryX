"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { motion, useScroll, useTransform } from "framer-motion";
import { DataSphere } from "@/components/three/DataSphere";
import { BrainCircuit, Timer, AlertTriangle, Zap } from "lucide-react";

export default function MLStrategy() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-purple)] selection:text-black">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden border-b border-zinc-900">
        {/* 3D Background */}
        <DataSphere />
        
        {/* Radial Fade Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)] pointer-events-none z-10" />
        <div className="absolute inset-0 bg-dot-grid opacity-10 z-10 pointer-events-none" />

        <motion.div 
          style={{ y }}
          className="relative z-20 text-center max-w-4xl px-6 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-purple)] mb-6 panel-border backdrop-blur-md">
             <BrainCircuit className="w-3 h-3 animate-pulse" /> E8 NODE // STRATEGY INTELLIGENCE
          </div>
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter mb-6 glitch-hover" data-text="PREDICTIVE ENGINE">
            PREDICTIVE<br/>ENGINE
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed mx-auto bg-black/50 p-4 border border-zinc-800/50 backdrop-blur-sm">
            Telemetry is useless if you only look at the past. Our embedded ML pipeline parses stint history, track temperatures, and compound degradation curves to forecast the race before it happens.
          </p>
        </motion.div>
      </section>

      <section className="py-24 px-6 max-w-7xl mx-auto w-full relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-[var(--telemetry-purple)] transition-colors group"
          >
            <Timer className="w-8 h-8 text-[var(--telemetry-purple)] mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold uppercase mb-4 tracking-tight">Tire Life Modeling</h3>
            <p className="font-mono text-xs text-zinc-400 mb-6 leading-relaxed">
              Calculates the precise drop-off point for Softs, Mediums, and Hards by cross-referencing live sector times with historical stint degradation data.
            </p>
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex">
              <div className="bg-[var(--telemetry-red)] w-1/3" />
              <div className="bg-[var(--telemetry-yellow)] w-1/3" />
              <div className="bg-[var(--telemetry-green)] w-1/3" />
            </div>
            <div className="flex justify-between font-mono text-[10px] mt-2 text-zinc-500">
              <span>0 Laps</span>
              <span>CLIFF (LAP 24)</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
            className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-[var(--telemetry-blue)] transition-colors group"
          >
            <Zap className="w-8 h-8 text-[var(--telemetry-blue)] mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold uppercase mb-4 tracking-tight">Undercut Mapping</h3>
            <p className="font-mono text-xs text-zinc-400 mb-6 leading-relaxed">
              Dynamically maps gap-to-car-behind and pit-lane delta. Instantly flags the exact lap window where an undercut attempt has a &gt;85% success probability.
            </p>
            <div className="border border-zinc-800 bg-black p-3 font-mono text-xs">
               <div className="flex justify-between border-b border-zinc-900 pb-2 mb-2">
                 <span className="text-zinc-500">PIT LOSS:</span> <span className="text-white">22.4s</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-zinc-500">GAP TO SAI:</span> <span className="text-[var(--telemetry-green)]">+23.1s</span>
               </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
            className="panel-border bg-[#050505] p-8 border border-zinc-800 hover:border-[var(--telemetry-red)] transition-colors group lg:col-span-1 md:col-span-2"
          >
            <AlertTriangle className="w-8 h-8 text-[var(--telemetry-red)] mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold uppercase mb-4 tracking-tight">VSC Opportunity Logic</h3>
            <p className="font-mono text-xs text-zinc-400 mb-6 leading-relaxed">
              When Race Control flags a Virtual Safety Car, the ML node instantly recalculates the pit-lane time delta and flashes high-value pitting opportunities.
            </p>
            <div className="text-[var(--telemetry-red)] border border-[var(--telemetry-red)]/30 bg-[var(--telemetry-red)]/10 px-4 py-2 font-mono text-xs animate-pulse text-center font-bold tracking-widest">
              BOX FOR HARDS - DELTA 11.2s
            </div>
          </motion.div>

        </div>
      </section>
      
      <Footer />
    </main>
  );
}
