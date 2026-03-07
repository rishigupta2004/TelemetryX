"use client";
import { Button } from "@/components/ui/Button";
import { Download, Terminal, Activity } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ParticleTrack } from "../three/ParticleTrack";
import { ScrambleText } from "../ui/ScrambleText";

function TypewriterEffect({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text]);

  return <span className="font-mono text-[var(--telemetry-green)] text-glow whitespace-pre-line">{displayed}<span className="animate-pulse">_</span></span>;
}

export function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  const [speed, setSpeed] = useState(321.4);
  const [sectorTime, setSectorTime] = useState(28.431);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed(prev => {
        const newSpeed = prev + (Math.random() * 4 - 2);
        return newSpeed > 340 ? 340 : newSpeed < 100 ? 100 : newSpeed;
      });
      if(Math.random() > 0.8) {
        setSectorTime(prev => prev + (Math.random() * 0.1 - 0.05));
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen pt-32 pb-24 overflow-hidden flex flex-col items-center justify-center bg-black">
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
      <ParticleTrack />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] pointer-events-none opacity-80 z-10" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col lg:flex-row gap-12 items-center">
        
        <motion.div
          style={{ y, opacity }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs font-mono uppercase tracking-widest text-zinc-400 mb-8 w-fit panel-border">
            <span className="w-1.5 h-1.5 bg-[var(--telemetry-red)] animate-pulse" /> LIVE TELEMETRY LINK ESTABLISHED
          </div>
          
          <h1 
            className="text-6xl md:text-8xl lg:text-[100px] font-black tracking-tighter mb-4 leading-[0.85] text-white glitch-hover relative inline-block cursor-default"
            data-text="RAW DATA."
          >
            <ScrambleText text="RAW DATA.\n" speed={20} scrambles={5} />
            <span className="text-zinc-600 block mt-2">
              <ScrambleText text="ZERO DELAY." speed={20} scrambles={10} />
            </span>
          </h1>
          
          <div className="text-sm md:text-base text-zinc-400 mb-10 max-w-xl font-mono leading-relaxed border-l-2 border-[var(--telemetry-blue)] pl-4 bg-zinc-900/30 py-4 pr-4 panel-border h-[120px]">
            <TypewriterEffect text="> INITIATING TELEMETRYX DESKTOP V1.0\n> CONNECTING TO FAST-PATH DUCKDB...\n> TARGET LATENCY: < 2MS\n> SYSTEM: READY." />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 font-mono">
            <Link href="/download" className="w-full sm:w-auto">
              <Button size="lg" className="w-full px-8 panel-border bg-white text-black hover:bg-zinc-200 uppercase tracking-widest font-bold text-xs h-12">
                <Download className="mr-2 w-4 h-4" /> macOS .dmg
              </Button>
            </Link>
            <Link href="/download" className="w-full sm:w-auto">
              <Button size="lg" variant="terminal" className="w-full px-8 h-12">
                <Terminal className="mr-2 w-4 h-4" /> Windows .exe
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 relative w-full h-[550px]"
        >
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[var(--telemetry-blue)]/20 flex items-center justify-center opacity-30 shadow-[0_0_50px_rgba(0,229,255,0.1)]">
             <div className="w-[300px] h-[300px] rounded-full border border-[var(--telemetry-blue)]/20 flex items-center justify-center">
               <div className="w-[200px] h-[200px] rounded-full border border-[var(--telemetry-blue)]/30 overflow-hidden relative">
                 <div className="radar-sweep-bg" />
                 <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[var(--telemetry-blue)]/30" />
                 <div className="absolute left-1/2 top-0 w-[1px] h-full bg-[var(--telemetry-blue)]/30" />
               </div>
             </div>
           </div>

           <div className="absolute top-10 right-0 w-64 glass-bento p-5 panel-border z-20 bg-black/80">
             <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Speed Trap 1</div>
                <Activity className="w-4 h-4 text-[var(--telemetry-blue)] animate-pulse" />
             </div>
             <div className="text-5xl font-mono font-bold text-white flex items-end gap-1 tracking-tighter">
               {speed.toFixed(1).split('.')[0]}<span className="text-2xl text-[var(--telemetry-blue)] pb-1">.{speed.toFixed(1).split('.')[1]}</span>
             </div>
             <div className="text-[10px] font-mono text-zinc-600 mt-1 uppercase">KPH // TURN 1 APEX</div>
             <div className="mt-4 h-12 flex items-end gap-1">
               {[40,70,50,90,100,60,80, 40, 50, 80].map((h,i) => (
                 <motion.div 
                   key={i} 
                   className="w-full bg-[var(--telemetry-blue)] opacity-50 shadow-[0_0_5px_var(--telemetry-blue)]"
                   initial={{ height: 0 }}
                   animate={{ height: `${h}%` }}
                   transition={{ duration: 0.2, delay: i * 0.05, repeat: Infinity, repeatType: 'reverse', repeatDelay: Math.random() }}
                 />
               ))}
             </div>
           </div>

           <div className="absolute top-48 -left-4 w-80 glass-bento p-5 panel-border z-10 bg-black/80">
             <div className="flex justify-between items-center mb-4">
               <div className="text-[10px] font-mono text-[var(--telemetry-purple)] uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[var(--telemetry-purple)] shadow-[0_0_10px_var(--telemetry-purple)] animate-pulse" />
                 Throttle Trace [LIVE]
               </div>
             </div>
             <div className="h-24 relative overflow-hidden bg-[#050505] border border-zinc-800">
               <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
               <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-0 w-full h-full stroke-[var(--telemetry-purple)] fill-none stroke-[2px] filter drop-shadow(0px 0px 4px rgba(176,38,255,0.5))">
                 <motion.path 
                   d="M0,30 L10,30 L15,5 L40,5 L45,25 L60,25 L65,10 L80,10 L90,28 L100,28" 
                   initial={{ pathLength: 0 }}
                   animate={{ pathLength: 1 }}
                   transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 />
               </svg>
               <motion.div 
                  className="absolute top-0 bottom-0 w-[1px] bg-white shadow-[0_0_10px_white]"
                  animate={{ left: ['0%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
               />
             </div>
           </div>
           
           <div className="absolute bottom-16 right-10 w-56 glass-bento p-5 panel-border z-30 bg-black/80">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[var(--telemetry-green)]" />
                Sector 2 Split
              </div>
              <div key={sectorTime} className="text-4xl font-mono font-bold text-[var(--telemetry-green)] text-glow mb-1 data-value-flash tracking-tighter">
                {sectorTime.toFixed(3)}
              </div>
              <div className="text-[10px] font-mono text-white/50 border-t border-zinc-800 pt-3 mt-3 flex justify-between items-center">
                <span className="bg-white text-black px-1 font-bold">VER</span>
                <span className="text-[var(--telemetry-green)]">-0.124 PURPLE</span>
              </div>
           </div>
        </motion.div>
        
      </div>
    </section>
  );
}
