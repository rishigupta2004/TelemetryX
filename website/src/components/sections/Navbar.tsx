"use client";
import { Button } from "@/components/ui/Button";
import { Terminal } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";

export function Navbar() {
  const { scrollY } = useScroll();
  const background = useTransform(scrollY, [0, 50], ["rgba(0,0,0,0)", "rgba(5,5,5,0.85)"]);
  const borderBottom = useTransform(scrollY, [0, 50], ["1px solid rgba(255,255,255,0)", "1px solid rgba(255,255,255,0.08)"]);

  return (
    <motion.nav 
      style={{ background, borderBottom, backdropFilter: 'blur(16px)' }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16"
    >
      <div className="max-w-[90rem] mx-auto px-6 h-full flex items-center justify-between font-mono text-[10px] md:text-xs uppercase tracking-widest">
        <Link href="/" className="flex items-center gap-3 cursor-pointer text-white group">
          <Terminal className="w-4 h-4 text-[var(--telemetry-blue)] group-hover:animate-pulse" />
          <span className="font-bold">TelemetryX</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-zinc-500">
          <Link href="/engine" className="hover:text-white transition-colors relative group">
            Engine
            <span className="absolute -bottom-2 left-0 w-full h-[1px] bg-[var(--telemetry-red)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </Link>
          <Link href="/architecture" className="hover:text-white transition-colors relative group">
            Architecture
            <span className="absolute -bottom-2 left-0 w-full h-[1px] bg-[var(--telemetry-blue)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </Link>
          <Link href="/ml-strategy" className="hover:text-white transition-colors relative group">
            ML Strategy
            <span className="absolute -bottom-2 left-0 w-full h-[1px] bg-[var(--telemetry-purple)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </Link>
          <Link href="/protocol" className="hover:text-[var(--telemetry-red)] transition-colors relative group">
            Protocol
            <span className="absolute -bottom-2 left-0 w-full h-[1px] bg-[var(--telemetry-red)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </Link>
          <Link href="/features" className="hover:text-white transition-colors relative group">
            Features
            <span className="absolute -bottom-2 left-0 w-full h-[1px] bg-[var(--telemetry-green)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com/rishigupta/TelemetryX" className="text-zinc-500 hover:text-[var(--telemetry-purple)] transition-colors hidden sm:block">GitHub</a>
          <Link href="/download"><Button size="sm" variant="terminal" className="h-8 shadow-[0_0_10px_rgba(0,255,0,0.2)]">Download</Button></Link>
        </div>
      </div>
    </motion.nav>
  );
}
