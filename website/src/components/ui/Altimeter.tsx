"use client";
import { useScroll, useTransform, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Altimeter() {
  const { scrollYProgress } = useScroll();
  const [scrollY, setScrollY] = useState(0);
  
  const height = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 h-64 w-8 z-50 pointer-events-none hidden lg:flex flex-col items-center">
      {/* Target Marker */}
      <div className="absolute top-0 right-10 flex items-center gap-2 font-mono text-[10px] text-zinc-500 whitespace-nowrap uppercase tracking-widest opacity-80 mix-blend-difference">
        Y_AXIS: <span className="text-white w-8">{Math.round(scrollY)}</span>
      </div>

      {/* Track Background */}
      <div className="w-[1px] h-full bg-zinc-800 relative">
        {/* Fill Indicator */}
        <motion.div 
           className="absolute top-0 w-[2px] bg-[var(--telemetry-blue)] origin-top shadow-[0_0_10px_var(--telemetry-blue)]"
           style={{ height, left: "-0.5px" }}
        />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map(pct => (
          <div key={pct} className="absolute w-2 h-[1px] bg-zinc-600 -left-2" style={{ top: `${pct}%` }} />
        ))}
      </div>
      
      {/* Scanning Head */}
      <motion.div 
         className="w-4 h-4 rounded-full border border-[var(--telemetry-blue)] absolute top-0 -left-[7px] bg-black/80 flex items-center justify-center"
         style={{ top: height }}
      >
        <div className="w-1 h-1 bg-white rounded-full animate-pulse shadow-[0_0_5px_white]" />
      </motion.div>
    </div>
  );
}
