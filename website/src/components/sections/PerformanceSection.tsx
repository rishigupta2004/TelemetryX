"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import anime from "animejs";
import { Activity, Cpu, Database, Network } from "lucide-react";

function SystemMetric({ label, target, value, unit, isWarning = false, icon: Icon }: any) {
  return (
    <div className={`p-5 border ${isWarning ? 'border-[var(--telemetry-yellow)]/30 bg-[var(--telemetry-yellow)]/5' : 'border-zinc-800 bg-black/60'} font-mono uppercase text-[10px] flex flex-col justify-between relative overflow-hidden group panel-border h-full`}>
      <div className="absolute inset-0 bg-[var(--telemetry-blue)] opacity-0 group-hover:opacity-[0.03] transition-opacity" />
      
      <div className="flex justify-between items-start mb-4 z-10">
        <div className="flex items-center gap-2 text-zinc-500">
           {Icon && <Icon className="w-3 h-3" />}
           {label}
        </div>
        <div className={`text-right ${isWarning ? 'text-[var(--telemetry-yellow)] text-glow' : 'text-[var(--telemetry-green)] text-glow'} tracking-widest`}>
          [{target}]
        </div>
      </div>

      <div className="text-white text-3xl font-bold flex items-baseline gap-1 z-10 tracking-tighter">
        {value} <span className="text-zinc-600 text-xs tracking-widest">{unit}</span>
      </div>
    </div>
  );
}

export function PerformanceSection() {
  const [fps, setFps] = useState(90);
  const [latency, setLatency] = useState("1.82");
  const [memory, setMemory] = useState("24.4");
  
  useEffect(() => {
    anime({
      targets: '.perf-block',
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(100),
      easing: 'easeOutExpo',
      duration: 800
    });

    const interval = setInterval(() => {
      setFps(Math.floor(Math.random() * 3) + 88); 
      setLatency((Math.random() * 0.3 + 1.6).toFixed(2));
      if(Math.random() > 0.7) {
        setMemory((24.4 + Math.random() * 0.2).toFixed(1));
      }
    }, 800);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-32 relative overflow-hidden bg-[#020202] border-t border-zinc-900" id="performance">
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col md:flex-row gap-16 items-start">
          <div className="w-full md:w-1/2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-8 w-fit panel-border">
               E10 // QUALITY ASSURANCE NODE
            </div>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 uppercase tracking-tighter text-white glitch-hover" data-text="SYSTEM DIAGNOSTICS">
              SYSTEM<br/>DIAGNOSTICS
            </h2>
            <div className="text-zinc-400 font-mono text-sm mb-10 border-l-2 border-[var(--telemetry-yellow)] pl-4 bg-zinc-900/20 p-4 panel-border">
              <p className="mb-4">
                TelemetryX is heavily profiled. Every component is tested under rigorous engineering rules. 
                <span className="text-white"> If a single frame drops, the pipeline fails.</span>
              </p>
              <p className="text-[var(--telemetry-green)]">
                &gt; ZERO VISUAL REGRESSION DETECTED.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full">
               <div className="perf-block"><SystemMetric label="Pipeline Latency" target="< 2ms" value={latency} unit="ms" icon={Network} /></div>
               <div className="perf-block"><SystemMetric label="Render Engine" target="90 FPS" value={fps} unit="fps" icon={Activity} /></div>
               <div className="perf-block"><SystemMetric label="DOM Thrashing" target="0" value="0" unit="reflows" /></div>
               <div className="perf-block"><SystemMetric label="Memory Heap" target="STABLE" value={memory} unit="MB / 30m" isWarning={true} icon={Database} /></div>
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-black border border-zinc-800 p-6 font-mono text-xs text-zinc-400 h-[600px] overflow-hidden relative panel-border shadow-[0_0_30px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 text-zinc-500" /> 
                <span className="uppercase tracking-widest text-[10px] text-white">Console Output</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-[var(--telemetry-green)] shadow-[0_0_5px_var(--telemetry-green)] animate-pulse" />
            </div>
            
            <motion.div 
              initial={{ y: 0 }}
              animate={{ y: "-50%" }}
              transition={{ duration: 20, ease: "linear", repeat: Infinity }}
              className="space-y-3 uppercase opacity-90 tracking-wider text-[10px]"
            >
              {[...Array(40)].map((_, i) => {
                const isError = i % 15 === 0;
                const isWarn = i % 7 === 0;
                const time = new Date(Date.now() - (40-i)*150).toISOString().slice(11, 23);
                
                let msg = "[OK] DUCKDB QUERY RETURNED IN 1.2MS";
                if(isError) msg = "[FAIL] INSUFFICIENT DATA POINTS FOR SECTOR 3";
                else if(isWarn) msg = "[WARN] MEMORY SPIKE DETECTED IN WEBSOCKET WORKER";
                else if(i%3===0) msg = "[OK] RENDER LOOP EXECUTED IN 16.6MS";
                else if(i%5===0) msg = "[OK] ML STRATEGY NODE UPDATED PREDICTION";

                return (
                  <div key={i} className="flex gap-4 hover:bg-zinc-900 transition-colors px-2 py-1">
                    <span className="text-zinc-600 w-24 shrink-0">[{time}]</span>
                    <span className={isError ? "text-[var(--telemetry-red)]" : isWarn ? "text-[var(--telemetry-yellow)]" : "text-zinc-400"}>
                      {msg}
                    </span>
                  </div>
                );
              })}
            </motion.div>
            
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 pointer-events-none" />
          </div>
        </div>

      </div>
    </section>
  );
}
