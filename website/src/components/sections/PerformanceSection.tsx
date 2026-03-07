"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import anime from "animejs";

function Counter({ from, to, duration, suffix = "" }: { from: number, to: number, duration: number, suffix?: string }) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) => Math.round(latest) + suffix);

  useEffect(() => {
    const controls = animate(count, to, { duration: duration, ease: "easeOut" });
    return controls.stop;
  }, [count, to, duration]);

  return <motion.span>{rounded}</motion.span>;
}

export function PerformanceSection() {
  useEffect(() => {
    anime({
      targets: '.anime-stagger .stagger-item',
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(100),
      easing: 'easeOutExpo',
      duration: 1000
    });
  }, []);

  return (
    <section className="py-24 relative overflow-hidden" id="performance">
      <div className="absolute inset-0 bg-primary/5 blur-[150px] -z-10" />
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="flex flex-col md:flex-row gap-16 items-center">
          <div className="w-full md:w-1/2">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gradient-primary">
              The Speed of Light
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              TelemetryX is heavily profiled and optimized. Every component is tested under rigorous rules. If a single frame drops, the pipeline fails. No visual regression, no flickering.
            </p>
            
            <div className="space-y-6 anime-stagger">
              {[
                { title: "Sustained FPS", value: "90" },
                { title: "End-to-End Latency", value: "<2ms" },
                { title: "Zero Data Discrepancy", value: "100%" }
              ].map((stat, i) => (
                <div key={i} className="stagger-item flex items-center justify-between p-6 rounded-2xl bg-muted/20 border border-border/50">
                  <span className="text-lg font-medium text-muted-foreground">{stat.title}</span>
                  <span className="text-3xl font-black text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2 grid grid-cols-2 gap-6 relative">
             <div className="glass-panel p-8 rounded-3xl col-span-2 shadow-2xl shadow-primary/10">
               <div className="text-primary text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                 Target Enforcement
               </div>
               <div className="text-7xl font-bold text-foreground mb-2 font-mono">
                 <Counter from={0} to={2} duration={2} suffix="ms" />
               </div>
               <div className="text-muted-foreground">End-to-end data latency</div>
             </div>
             
             <div className="glass-panel p-8 rounded-3xl">
               <div className="text-primary text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-purple-sector" />
                 DOM Reflow
               </div>
               <div className="text-4xl font-bold text-foreground mb-2 font-mono">
                 <Counter from={100} to={0} duration={2} />
               </div>
               <div className="text-muted-foreground">Thrashing</div>
             </div>

             <div className="glass-panel p-8 rounded-3xl border-primary/20">
               <div className="text-primary text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-primary" />
                 Memory
               </div>
               <div className="text-4xl font-bold text-foreground mb-2 font-mono">Stable</div>
               <div className="text-muted-foreground">30+ min heap</div>
             </div>
          </div>
        </div>

      </div>
    </section>
  );
}
