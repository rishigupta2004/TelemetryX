"use client";
import { Button } from "@/components/ui/Button";
import { Terminal } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

export function Navbar() {
  const { scrollY } = useScroll();
  const background = useTransform(scrollY, [0, 50], ["rgba(0,0,0,0)", "rgba(5,5,5,0.85)"]);
  const borderBottom = useTransform(scrollY, [0, 50], ["1px solid rgba(255,255,255,0)", "1px solid rgba(255,255,255,0.08)"]);

  return (
    <motion.nav 
      style={{ background, borderBottom, backdropFilter: 'blur(16px)' }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16"
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between font-mono text-xs uppercase tracking-widest">
        <div className="flex items-center gap-3 cursor-pointer text-white">
          <Terminal className="w-4 h-4 text-[var(--telemetry-blue)]" />
          <span className="font-bold">TelemetryX</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-zinc-500">
          <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
          <a href="#telemetry" className="hover:text-white transition-colors">Telemetry</a>
          <a href="#performance" className="hover:text-white transition-colors">Perf</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com/rishigupta/TelemetryX" className="text-zinc-500 hover:text-white transition-colors hidden sm:block">GitHub</a>
          <Button size="sm" variant="outline" className="h-8">Download</Button>
        </div>
      </div>
    </motion.nav>
  );
}
