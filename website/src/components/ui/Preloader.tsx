"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Preloader() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    // Only run once per session
    if(sessionStorage.getItem('telemetryx_loaded')) {
       setLoading(false);
       return;
    }

    const bootSequence = [
      "INITIALIZING ELECTRON CONTAINER...",
      "MOUNTING REACT 19 / VITE 7...",
      "ESTABLISHING WEBSOCKET IPC...",
      "LOADING DUCKDB IN-MEMORY STORE...",
      "COMPILING SHADERS (CANVAS 2D)...",
      "WARMING UP ML STRATEGY NODE...",
      "TARGET FRAME RATE 90FPS: LOCKED.",
      "SYSTEM ONLINE."
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < bootSequence.length) {
        setLogs(prev => [...prev, bootSequence[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
          sessionStorage.setItem('telemetryx_loaded', 'true');
        }, 800);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div 
          className="fixed inset-0 z-[1000] bg-black flex flex-col justify-end p-10 font-mono text-xs md:text-sm text-[var(--telemetry-green)]"
          exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay pointer-events-none" />
          
          <div className="max-w-3xl space-y-2 z-10 opacity-90 text-glow">
            {logs.map((log, idx) => (
               <motion.div 
                 key={idx}
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
               >
                 &gt; {log}
               </motion.div>
            ))}
            <motion.div animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.5 }}>
              _
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
