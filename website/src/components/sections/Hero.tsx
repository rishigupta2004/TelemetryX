"use client";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Download, Monitor, Play } from "lucide-react";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative pt-40 pb-24 overflow-hidden min-h-screen flex flex-col justify-center items-center">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute top-[20%] -left-[10%] w-[500px] h-[500px] bg-purple-sector/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-sm font-medium text-muted-foreground mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            TelemetryX Desktop 1.0 is now live
          </div>
          
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 text-gradient">
            Pro-Grade F1 Telemetry. <br className="hidden md:block" />
            <span className="text-gradient-primary">Zero Compromises.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Experience real-time F1 data visualization with an ultra-low latency pipeline, 
            local DuckDB storage, and built-in ML race strategy predictions.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button size="lg" className="w-full sm:w-auto h-16 px-10 text-lg rounded-2xl group glow-effect">
              <Download className="mr-2 w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              Download for macOS
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-16 px-10 text-lg rounded-2xl group bg-muted/30 border-border/50 hover:bg-muted/60">
              <Monitor className="mr-2 w-5 h-5 group-hover:text-primary transition-colors" />
              Download for Windows
            </Button>
          </div>
        </motion.div>

        {/* Hero Media Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="mt-20 relative w-full aspect-video max-w-5xl mx-auto rounded-3xl border border-white/10 glass-panel overflow-hidden group cursor-pointer shadow-2xl shadow-primary/10"
        >
          <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:scale-110 transition-transform duration-500 ease-out mb-4">
              <Play className="w-8 h-8 text-primary ml-1" />
            </div>
            <p className="text-muted-foreground font-medium tracking-wide">[ Video Placeholder ]</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
