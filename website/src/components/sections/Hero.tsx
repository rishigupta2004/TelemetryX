"use client";
import { Button } from "@/components/ui/Button";
import { Activity, Download, ChevronRight, Terminal } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import anime from "animejs";

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

  return <span className="font-mono text-[var(--telemetry-green)] text-glow">{displayed}<span className="animate-pulse">_</span></span>;
}

export function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative min-h-screen pt-40 pb-24 overflow-hidden flex flex-col items-center justify-start bg-grid-pattern">
      {/* Pit-wall subtle vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-black pointer-events-none opacity-80" style={{ background: 'radial-gradient(circle at center, transparent 0%, #000 80%)'}} />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col lg:flex-row gap-16 items-center">
        
        {/* Text Side */}
        <motion.div
          style={{ y, opacity }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full"
        >
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 text-xs font-mono uppercase tracking-widest text-zinc-400 mb-8 w-fit">
            <span className="w-1.5 h-1.5 bg-[var(--telemetry-red)] animate-pulse" /> Live Data Stream
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-[0.9] text-white">
            RAW<br/>
            DATA.<br/>
            <span className="text-zinc-600">ZERO<br/>DELAY.</span>
          </h1>
          
          <div className="text-base md:text-lg text-zinc-400 mb-10 max-w-xl font-mono leading-relaxed border-l border-zinc-800 pl-4">
            <TypewriterEffect text="> INITIATING TELEMETRYX DESKTOP V1.0\n> CONNECTING TO FAST-PATH DUCKDB LOCAL STORAGE...\n> TARGET LATENCY: < 2MS\n> SYSTEM: READY." />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 font-mono">
            <Button size="lg" className="w-full sm:w-auto px-8">
              <Download className="mr-2 w-4 h-4" /> Download for macOS
            </Button>
            <Button size="lg" variant="terminal" className="w-full sm:w-auto px-8">
              <Terminal className="mr-2 w-4 h-4" /> Windows .exe
            </Button>
          </div>
        </motion.div>

        {/* Bento Box Floating Side */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 relative w-full h-[500px]"
        >
           {/* Speed Trap Bento */}
           <div className="absolute top-0 right-0 w-64 glass-bento p-5 border-t-2 border-t-[var(--telemetry-blue)] z-20">
             <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">Speed Trap 1</div>
             <div className="text-4xl font-mono font-bold text-white flex items-end gap-1">
               321<span className="text-lg text-zinc-500 pb-1">.4 kph</span>
             </div>
             <div className="mt-4 h-8 flex items-end gap-1">
               {[40,70,50,90,100,60,80].map((h,i) => (
                 <motion.div 
                   key={i} 
                   className="w-full bg-[var(--telemetry-blue)] opacity-50"
                   initial={{ height: 0 }}
                   animate={{ height: `${h}%` }}
                   transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity, repeatType: 'reverse', repeatDelay: 1 }}
                 />
               ))}
             </div>
           </div>

           {/* Throttle trace Bento */}
           <div className="absolute top-32 left-0 w-80 glass-bento p-5 border-t-2 border-t-[var(--telemetry-purple)] z-10">
             <div className="flex justify-between items-center mb-4">
               <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Throttle Trace</div>
               <div className="w-2 h-2 rounded-full bg-[var(--telemetry-purple)] shadow-[0_0_10px_var(--telemetry-purple)]" />
             </div>
             <div className="h-24 relative overflow-hidden bg-black/50 border border-zinc-800">
               {/* Pure SVG trace for high performance look */}
               <svg viewBox="0 0 100 30" className="absolute inset-0 w-full h-full stroke-[var(--telemetry-purple)] fill-none stroke-[2px]">
                 <motion.path 
                   d="M0,30 L10,30 L15,5 L40,5 L45,25 L60,25 L65,10 L80,10 L90,28 L100,28" 
                   initial={{ pathLength: 0 }}
                   animate={{ pathLength: 1 }}
                   transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 />
               </svg>
             </div>
           </div>
           
           {/* Sector Time Bento */}
           <div className="absolute bottom-10 right-10 w-56 glass-bento p-5 z-30">
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Sector 2</div>
              <div className="text-2xl font-mono text-[var(--telemetry-green)] text-glow mb-1">
                28.431
              </div>
              <div className="text-xs font-mono text-white/50 border-t border-zinc-800 pt-2 mt-2 flex justify-between">
                <span>VER</span>
                <span>-0.124</span>
              </div>
           </div>
        </motion.div>
        
      </div>
    </section>
  );
}
