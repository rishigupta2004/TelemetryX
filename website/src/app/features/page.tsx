"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { Timer, Map, BarChart3, CloudRain, ShieldAlert, CheckCircle2 } from "lucide-react";
import { F1CarModel } from "@/components/three/F1Car";
import { ScrambleText } from "@/components/ui/ScrambleText";

const featuresData = [
  {
    icon: <Timer />, title: "Timing Tower", color: "var(--telemetry-green)",
    points: ["Real-time driver positions", "Interval & gap calculations", "Sector timing (Purple/Green)", "Virtualized Row Scrolling"]
  },
  {
    icon: <Map />, title: "Interactive Track Map", color: "var(--telemetry-blue)",
    points: ["SVG Coordinate Plotting", "Live car position dots", "Dynamic sector coloring", "Zoom & Pan controls"]
  },
  {
    icon: <BarChart3 />, title: "Telemetry Displays", color: "var(--telemetry-purple)",
    points: ["Throttle, Brake, Speed, Gear", "DRS Activation Windows", "Multi-driver comparison", "60 FPS Canvas rendering"]
  },
  {
    icon: <CloudRain />, title: "Live Weather Feed", color: "var(--telemetry-blue)",
    points: ["Track & Air Temperature", "Rain Probability Index", "Wind Speed & Direction", "Session status indicators"]
  },
  {
    icon: <ShieldAlert />, title: "Race Control Logs", color: "var(--telemetry-red)",
    points: ["VSC / SC Deployment Alerts", "Driver Penalties & Warnings", "Track Limit Violations", "Chronological socket feed"]
  },
];

export default function Features() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-blue)] selection:text-black">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      {/* 3D Hero Section */}
      <section className="relative h-[80vh] border-b border-zinc-900 overflow-hidden flex items-center justify-center">
        <F1CarModel />
        
        <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
           className="relative z-10 text-center max-w-4xl px-6"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 border border-[var(--telemetry-blue)]/50 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-blue)] mb-6 mx-auto w-fit panel-border backdrop-blur-md">
             WIND TUNNEL SIMULATION ACTIVE
          </div>
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-6 glitch-hover" data-text="CAPABILITIES">
            <ScrambleText text="CAPABILITIES" speed={30} scrambles={5} />
          </h1>
          <div className="bg-black/50 backdrop-blur-md border border-zinc-800 p-4 font-mono text-sm text-zinc-400 inline-block">
            Analyzing 150+ telemetry channels per driver in real-time.
          </div>
        </motion.div>
      </section>

      <section className="py-20 px-6 max-w-7xl mx-auto w-full relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresData.map((f, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#050505] border border-zinc-800 p-8 panel-border group hover:bg-[#0a0a0a] transition-all relative overflow-hidden"
            >
              <div 
                className="absolute top-0 left-0 w-full h-[2px] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"
                style={{ backgroundColor: f.color, boxShadow: `0 0 15px ${f.color}` }}
              />
              
              <div className="mb-6 p-4 inline-block border border-zinc-800 bg-black rounded-sm" style={{ color: f.color }}>
                {f.icon}
              </div>
              <h3 className="text-2xl font-bold uppercase mb-4 tracking-tight text-white">{f.title}</h3>
              
              <ul className="space-y-3 font-mono text-xs text-zinc-500">
                {f.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: f.color }} />
                    <span className="group-hover:text-zinc-300 transition-colors leading-relaxed">{pt}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
