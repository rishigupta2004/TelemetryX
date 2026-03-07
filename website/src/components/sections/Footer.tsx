import { Activity, Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 border-t border-border/50 bg-background relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6 text-foreground font-bold text-xl">
              <Activity className="text-primary w-6 h-6" /> Telemetry<span className="text-primary">X</span>
            </div>
            <p className="text-muted-foreground max-w-sm">
              An advanced, high-performance platform for real-time Formula 1 telemetry, race strategy, and data visualization. Built on a protected baseline of rules.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Architecture</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Community</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors flex items-center gap-2"><Github className="w-4 h-4" /> GitHub</a></li>
              <li><a href="#" className="hover:text-primary transition-colors flex items-center gap-2"><Twitter className="w-4 h-4" /> Twitter</a></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border/50 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} TelemetryX Open Source. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
