"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";
import anime from "animejs";
import { Activity } from "lucide-react";

function SystemMetric({ label, target, value, unit, isWarning = false }: any) {
  return (
    <div className={`p-4 border ${isWarning ? 'border-[var(--telemetry-yellow)]/30 bg-[var(--telemetry-yellow)]/5' : 'border-zinc-800 bg-zinc-900'} font-mono uppercase text-xs flex justify-between items-end relative overflow-hidden group`}>
      {/* Background glow on hover */}
      <div className="absolute inset-0 bg-[var(--telemetry-blue)] opacity-0 group-hover:opacity-[0.03] transition-opacity" />
      
      <div className="flex flex-col gap-1 z-10">
        <span className="text-zinc-500">{label}</span>
        <span className="text-white text-lg font-bold flex items-baseline gap-1">
          {value} <span className="text-zinc-600 text-[10px]">{unit}</span>
        </span>
      </div>
      <div className={`z-10 text-right ${isWarning ? 'text-[var(--telemetry-yellow)] text-glow' : 'text-[var(--telemetry-green)] text-glow'}`}>
        [ {target} ]
      </div>
    </div>
  );
}

export function PerformanceSection() {
  const [fps, setFps] = useState(90);
  const [latency, setLatency] = useState("1.8");
  
  useEffect(() => {
    anime({
      targets: '.perf-block',
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(150),
      easing: 'easeOutExpo',
      duration: 800
    });

    // Simulate system jitter
    const interval = setInterval(() => {
      setFps(Math.floor(Math.random() * 5) + 86); // 86-90
      setLatency((Math.random() * 0.4 + 1.5).toFixed(2)); // 1.5 - 1.9
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden bg-black border-t border-zinc-900" id="performance">
      {/* Background radial gradient to give depth */}
      <div className="absolute inset-0 bg-radial-gradient from-[var(--telemetry-blue)]/5 to-transparent blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col md:flex-row gap-16 items-start">
          <div className="w-full md:w-1/2">
            <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter text-white">
              System<br/>Diagnostics
            </h2>
            <div className="text-zinc-400 font-mono text-sm mb-10 border-l border-[var(--telemetry-blue)] pl-4">
              <p className="mb-4">
                TelemetryX is heavily profiled and optimized. Every component is tested under rigorous engineering rules.
              </p>
              <p>
                If a single frame drops below our targets, the entire pipeline fails. There is zero visual regression and zero flickering permitted.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 w-full">
               <div className="perf-block"><SystemMetric label="Pipeline Latency" target="< 2ms" value={latency} unit="ms" /></div>
               <div className="perf-block"><SystemMetric label="Render Engine" target="90 FPS" value={fps} unit="fps" /></div>
               <div className="perf-block"><SystemMetric label="DOM Thrashing" target="0" value="0" unit="reflows" /></div>
               <div className="perf-block"><SystemMetric label="Data Integrity" target="100%" value="100" unit="%" /></div>
               <div className="perf-block col-span-2"><SystemMetric label="Memory Heap" target="STABLE" value="24.4" unit="MB / 30m" isWarning={true} /></div>
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-[#050505] border border-zinc-800 p-6 font-mono text-xs text-zinc-400 h-[500px] overflow-hidden relative shadow-2xl">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-2">
              <Activity className="w-4 h-4 text-[var(--telemetry-blue)] animate-pulse" /> 
              <span className="uppercase tracking-widest text-zinc-500">System Logs / E10 QA</span>
            </div>
            
            <motion.div 
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              transition={{ duration: 10, ease: "linear", repeat: Infinity }}
              className="space-y-2 uppercase opacity-80"
            >
              {[...Array(20)].map((_, i) => (
                <div key={i} className="flex gap-4 hover:bg-zinc-900 hover:text-white px-2 py-1 transition-colors">
                  <span className="text-zinc-600">[{new Date(Date.now() - (20-i)*100).toISOString().slice(11, 23)}]</span>
                  <span className={i % 5 === 0 ? "text-[var(--telemetry-blue)]" : i % 8 === 0 ? "text-[var(--telemetry-yellow)]" : ""}>
                    {i % 5 === 0 ? "CHECK: COMPONENT TIMING TOWER RENDER OK" : 
                     i % 8 === 0 ? "WARN: DUCKDB QUERY TIME 1.1MS" : 
                     "INFO: WEBSOCKET DATA FRAME PROCESSED"}
                  </span>
                </div>
              ))}
            </motion.div>
            
            {/* Fade out edges */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#050505] to-transparent" />
          </div>
        </div>

      </div>
    </section>
  );
}
