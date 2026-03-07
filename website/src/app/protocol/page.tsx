"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { motion, useScroll, useTransform } from "framer-motion";
import { Shield, ShieldAlert, Cpu } from "lucide-react";

export default function Protocol() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-red)] selection:text-white">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="pt-40 pb-20 px-6 max-w-5xl mx-auto w-full relative">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--telemetry-red)]/10 border border-[var(--telemetry-red)]/50 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-red)] mb-6 w-fit panel-border shadow-[0_0_15px_rgba(255,42,42,0.2)]">
             <ShieldAlert className="w-3 h-3 animate-pulse" /> RESTRICTED DOCUMENT
          </div>
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 glitch-hover" data-text="THE PROTOCOL">
            THE<br/>PROTOCOL
          </h1>
          <div className="font-mono text-xs md:text-sm max-w-3xl leading-relaxed bg-[#0a0505] p-6 border-l-4 border-[var(--telemetry-red)] text-zinc-400">
            <p className="mb-4">
              <span className="text-white font-bold">&sect;1 — FALLBACK-FIRST PRINCIPLE</span><br/>
              The current state of the application (UI, backend, data, ML pipeline) is the PROTECTED BASELINE. All changes are ADDITIVE and REVERSIBLE.
            </p>
            <p className="mb-4 text-[var(--telemetry-red)]">
              &gt; IF ANY CHANGE CAUSES A RUNTIME ERROR, VISUAL REGRESSION, OR PERFORMANCE DEGRADATION → IMMEDIATELY REVERT.
            </p>
            <p className="text-white">
              No agent may delete, overwrite, or restructure working code without confirming the replacement works in isolation.
            </p>
          </div>
        </motion.div>
      </section>

      <section className="py-20 px-6 max-w-5xl mx-auto w-full relative">
        <h2 className="text-3xl font-black uppercase mb-12 flex items-center gap-4 text-zinc-100">
          <Cpu className="w-8 h-8 text-[var(--telemetry-blue)]" /> AI Engineering Agents
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: "E1", role: "UI Lead", desc: "Overall architecture, layout system, component hierarchy." },
            { id: "E2", role: "Timing Tower", desc: "Rendering, animations, live data binding, scroll behavior." },
            { id: "E3", role: "Track Map", desc: "SVG/Canvas rendering, real-time position updates." },
            { id: "E4", role: "Telemetry Displays", desc: "Charts bound to live data streams (throttle, speed)." },
            { id: "E5", role: "Race Control", desc: "Real-time updates, flag states, weather notifications." },
            { id: "E7", role: "Backend 1", desc: "Data ingestion, API layer, DuckDB flow." },
            { id: "E8", role: "Backend 2", desc: "ML models, predictive pit strategies." },
            { id: "E10", role: "QA Enforcer", desc: "Latency enforcement (<2ms), FPS enforcement (90fps)." }
          ].map((agent, i) => (
            <motion.div 
              key={agent.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#050505] border border-zinc-800 p-6 hover:border-[var(--telemetry-red)] transition-colors group panel-border flex gap-6 items-start"
            >
              <div className="font-black text-3xl text-zinc-800 group-hover:text-[var(--telemetry-red)] transition-colors tracking-tighter">
                {agent.id}
              </div>
              <div>
                <h3 className="font-bold text-white uppercase text-sm mb-2">{agent.role}</h3>
                <p className="font-mono text-[10px] text-zinc-500 leading-relaxed">{agent.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 max-w-5xl mx-auto w-full border-t border-zinc-900">
        <h2 className="text-3xl font-black uppercase mb-8 text-zinc-100">Performance Mandate</h2>
        <div className="bg-[#050505] p-8 border border-zinc-800 panel-border font-mono text-xs uppercase tracking-widest text-zinc-400 space-y-4">
          <div className="flex justify-between border-b border-zinc-900 pb-2">
            <span>Latency Tolerance</span>
            <span className="text-[var(--telemetry-green)]">&lt; 2MS (Data receipt to Render)</span>
          </div>
          <div className="flex justify-between border-b border-zinc-900 pb-2">
            <span>Frame Delivery</span>
            <span className="text-white">60-90 FPS SUSTAINED</span>
          </div>
          <div className="flex justify-between border-b border-zinc-900 pb-2">
            <span>Memory Target</span>
            <span className="text-white">NO LEAKS OVER 30 MINUTE RUNS</span>
          </div>
          <div className="flex justify-between">
            <span>Mock Data Protocol</span>
            <span className="text-[var(--telemetry-red)] font-bold">STRICTLY PROHIBITED</span>
          </div>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
