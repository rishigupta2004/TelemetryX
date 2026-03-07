"use client";
import { motion } from "framer-motion";
import { Map, Cpu, Zap, Flag, Timer, BarChart3 } from "lucide-react";

const features = [
  {
    icon: <Timer className="w-8 h-8 text-primary" />,
    title: "Timing Tower",
    desc: "Live driver positions, intervals per sector, and gap calculations rendered without a single frame drop."
  },
  {
    icon: <Map className="w-8 h-8 text-success" />,
    title: "Interactive Track Map",
    desc: "SVG-based mapping plotting real car coordinates in real-time with sector coloring."
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-purple-sector" />,
    title: "Multi-Channel Telemetry",
    desc: "Throttle, brake, speed, and DRS charts mapped perfectly to live DuckDB query streams."
  },
  {
    icon: <Flag className="w-8 h-8 text-accent" />,
    title: "Race Control Center",
    desc: "Chronological feed of flags, VSC/SC states, penalties, and real-time weather alerts."
  },
  {
    icon: <Cpu className="w-8 h-8 text-primary" />,
    title: "ML Strategy Engine",
    desc: "Built-in predictive models parsing stint history and tire compounds to forecast pit strategies."
  },
  {
    icon: <Zap className="w-8 h-8 text-destructive" />,
    title: "Local DuckDB Backbone",
    desc: "No cloud dependencies during the race. 100% local, high-performance analytical pipeline."
  }
];

export function FeatureGrid() {
  return (
    <section className="py-24 bg-muted/20 relative" id="features">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gradient">
            Engineered for Precision
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A comprehensive suite of tools built on top of a rock-solid, locally hosted data pipeline. 
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass-panel p-8 rounded-2xl hover:bg-muted/30 transition-colors group cursor-default"
            >
              <div className="mb-6 p-4 rounded-xl bg-muted/50 inline-block border border-border group-hover:border-primary/50 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
