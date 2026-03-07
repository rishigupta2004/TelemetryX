"use client";
import { motion } from "framer-motion";
import { Map, Cpu, Zap, Flag, Timer, BarChart3 } from "lucide-react";

const features = [
  {
    icon: <Timer className="w-6 h-6 text-white" />,
    title: "Zero Drop Timing",
    desc: "Virtualization ensures the 20-driver timing tower scrolls flawlessly without a single dropped frame or layout thrash.",
    color: "var(--telemetry-green)"
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-white" />,
    title: "Multi-Channel uPlot",
    desc: "Canvas-based rendering handles 100,000+ data points for throttle, brake, and DRS in real-time.",
    color: "var(--telemetry-blue)"
  },
  {
    icon: <Map className="w-6 h-6 text-white" />,
    title: "SVG Track Map",
    desc: "Real coordinate plotting binds directly to car positions, coloring sectors dynamically on the fly.",
    color: "var(--telemetry-purple)"
  },
  {
    icon: <Cpu className="w-6 h-6 text-white" />,
    title: "ML Strategy Node",
    desc: "Local machine learning models crunch stint history to forecast compound life and optimal pit windows.",
    color: "var(--telemetry-yellow)"
  },
  {
    icon: <Zap className="w-6 h-6 text-white" />,
    title: "DuckDB Backbone",
    desc: "Columnar OLAP database powers instant telemetry queries entirely locally. No cloud latency.",
    color: "var(--telemetry-red)"
  },
  {
    icon: <Flag className="w-6 h-6 text-white" />,
    title: "Race Control Socket",
    desc: "Chronological WebSocket feed captures VSC/SC, penalties, and track temp changes the millisecond they drop.",
    color: "#fff"
  }
];

export function FeatureGrid() {
  return (
    <section className="py-24 bg-black relative border-t border-zinc-900" id="pipeline">
      <div className="absolute inset-0 bg-grid-dots opacity-20" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 border-l-4 border-[var(--telemetry-red)] pl-6"
        >
          <h2 className="text-3xl md:text-5xl font-black mb-4 uppercase tracking-tighter text-white">
            Architecture Rules
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl font-mono">
            Every component binds to live data. Mock data is prohibited. If the UI flickers, the build fails.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="bg-black p-8 group hover:bg-zinc-950 transition-colors cursor-default relative overflow-hidden"
            >
              {/* Hover Top Border Glow Effect */}
              <div 
                className="absolute top-0 left-0 w-full h-[2px] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"
                style={{ backgroundColor: f.color, boxShadow: `0 0 10px ${f.color}` }}
              />

              <div className="mb-8 p-3 inline-block border border-zinc-800 bg-zinc-900 rounded-sm">
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
