"use client";
import { Navbar } from "@/components/sections/Navbar";
import { SteeringWheel } from "@/components/three/SteeringWheel";
import { motion } from "framer-motion";
import { ScrambleText } from "@/components/ui/ScrambleText";

export default function Cockpit() {
  return (
    <main className="h-screen w-screen bg-black text-white flex flex-col font-sans overflow-hidden selection:bg-[var(--telemetry-blue)]">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="relative w-full h-full pt-16">
        <SteeringWheel />
        
        <motion.div 
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}
           className="absolute bottom-10 left-10 pointer-events-none"
        >
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2 text-white glitch-hover" data-text="INTERACTIVE HUD">
            <ScrambleText text="INTERACTIVE HUD" speed={30} scrambles={5} />
          </h1>
          <div className="bg-black/80 border border-[var(--telemetry-blue)]/50 p-4 font-mono text-[10px] text-zinc-400 max-w-sm panel-border backdrop-blur-md">
            This isn't a pre-rendered video. This is a live WebGL DOM environment calculating <span className="text-white">speed</span>, <span className="text-[var(--telemetry-green)]">gear shifts</span>, and <span className="text-[var(--telemetry-purple)]">RPM traces</span> natively inside the 3D geometry of the steering hub. Move your mouse to steer.
          </div>
        </motion.div>
      </section>

    </main>
  );
}
