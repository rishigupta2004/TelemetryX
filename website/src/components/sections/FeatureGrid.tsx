"use client";
import { motion } from "framer-motion";
import { Database, MonitorPlay, BoxSelect, Gauge, Activity, Cpu } from "lucide-react";

const features = [
  {
    icon: <MonitorPlay className="w-6 h-6 text-white" />,
    title: "Electron Shell",
    desc: "Bypasses standard Chrome memory constraints. Grants direct hardware rasterization allowing 90fps rendering of 10+ views simultaneously.",
    color: "var(--telemetry-blue)"
  },
  {
    icon: <Database className="w-6 h-6 text-white" />,
    title: "DuckDB Embedded",
    desc: "Your data doesn't live in the cloud. A full columnar OLAP engine sits inside the app, querying 10GB Parquet files at 1.2ms latency.",
    color: "var(--telemetry-red)"
  },
  {
    icon: <Activity className="w-6 h-6 text-white" />,
    title: "Web Worker Offloading",
    desc: "Telemetry payloads stream through WebSocket IPC directly into background workers, updating SharedArrayBuffers without touching the React main thread.",
    color: "var(--telemetry-green)"
  },
  {
    icon: <BoxSelect className="w-6 h-6 text-white" />,
    title: "Virtualized DOM",
    desc: "The Timing Tower dynamically mounts and unmounts rows as you scroll. A 20-car grid sorting itself every 50ms causes zero layout thrashing.",
    color: "var(--telemetry-purple)"
  },
  {
    icon: <Gauge className="w-6 h-6 text-white" />,
    title: "uPlot / Canvas 2D",
    desc: "We killed SVG-based charting libraries. Every graph uses raw 2D Context APIs plotting millions of floats directly from the buffer.",
    color: "var(--telemetry-yellow)"
  },
  {
    icon: <Cpu className="w-6 h-6 text-white" />,
    title: "Zustand State",
    desc: "No Redux boilerplate. Lightweight, transient state management handles the playback scrubber timeline and session syncing flawlessly.",
    color: "#ffffff"
  }
];

export function FeatureGrid() {
  return (
    <section className="py-24 bg-black relative border-t border-zinc-900" id="tech">
      <div className="absolute inset-0 bg-dot-grid opacity-10" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 border-l-4 border-[var(--telemetry-red)] pl-6 bg-zinc-900/30 p-6 panel-border inline-block"
        >
          <h2 className="text-3xl md:text-5xl font-black mb-4 uppercase tracking-tighter text-white">
            Architecture Rules
          </h2>
          <p className="text-lg text-zinc-400 font-mono max-w-2xl">
            This is not a web app. It is a broadcast-tier engineering tool. If a component causes a visual flicker or a dropped frame, the build fails.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="bg-black p-8 group hover:bg-[#050505] transition-colors cursor-default relative overflow-hidden"
            >
              <div 
                className="absolute top-0 left-0 w-full h-[2px] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"
                style={{ backgroundColor: f.color, boxShadow: `0 0 10px ${f.color}` }}
              />

              <div className="mb-6 p-3 inline-block border border-zinc-800 bg-zinc-900 rounded-sm">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-zinc-100 font-sans tracking-tight">{f.title}</h3>
              <p className="text-zinc-500 font-mono text-sm leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
