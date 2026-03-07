"use client";
import { Button } from "@/components/ui/Button";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-border/50"
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 group-hover:bg-primary/20 transition-colors">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Telemetry<span className="text-primary">X</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#performance" className="hover:text-foreground transition-colors">Performance</a>
          <a href="#docs" className="hover:text-foreground transition-colors">Docs</a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" className="hidden sm:inline-flex border-border/50">
            GitHub
          </Button>
          <Button className="shadow-primary/30 shadow-lg glow-effect">
            Download
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}
