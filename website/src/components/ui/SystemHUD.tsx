"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "lucide-react";

export function SystemHUD() {
  const [isOpen, setIsOpen] = useState(false);
  const [fps, setFps] = useState(90);
  const [memory, setMemory] = useState(24.4);
  const [latency, setLatency] = useState(1.8);
  const [time, setTime] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setFps(Math.floor(Math.random() * 3) + 88); 
      setLatency(Number((Math.random() * 0.3 + 1.6).toFixed(2)));
      setMemory(Number((24.4 + Math.random() * 0.2).toFixed(1)));
      setTime(new Date().toISOString().slice(11, 23));
    }, 500);
    
    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full border border-zinc-800 bg-black/80 flex items-center justify-center hover:bg-zinc-900 transition-colors shadow-[0_0_15px_rgba(0,0,0,1)] group"
      >
        <Terminal className="w-4 h-4 text-zinc-500 group-hover:text-[var(--telemetry-green)] transition-colors" />
        {isOpen && <div className="absolute top-0 right-0 w-2 h-2 bg-[var(--telemetry-green)] rounded-full animate-pulse shadow-[0_0_5px_var(--telemetry-green)]" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-20 right-6 z-[100] w-64 panel-border bg-black/95 border border-zinc-800 p-4 font-mono text-[10px] text-zinc-400 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
          >
            <div className="flex justify-between border-b border-zinc-900 pb-2 mb-3 items-center">
              <span className="text-[var(--telemetry-blue)] font-bold tracking-widest uppercase">HUD_DIAGNOSTICS</span>
              <span className="text-[var(--telemetry-green)] animate-pulse">ACTIVE</span>
            </div>
            
            <div className="space-y-3 uppercase">
              <div className="flex justify-between items-center group">
                <span className="group-hover:text-white transition-colors">Target FPS</span>
                <span className={fps < 89 ? "text-[var(--telemetry-yellow)]" : "text-white"}>{fps}.0</span>
              </div>
              <div className="flex justify-between items-center group">
                <span className="group-hover:text-white transition-colors">Pipeline Latency</span>
                <span className="text-white">{latency} ms</span>
              </div>
              <div className="flex justify-between items-center group">
                <span className="group-hover:text-white transition-colors">Heap Size</span>
                <span className="text-[var(--telemetry-red)]">{memory} MB</span>
              </div>
              <div className="flex justify-between items-center group">
                <span className="group-hover:text-white transition-colors">SYS_TIME</span>
                <span className="text-zinc-500">{time || "00:00:00.000"}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-900 text-center text-zinc-600 text-[8px]">
              PRESS [CMD+K] TO TOGGLE
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
