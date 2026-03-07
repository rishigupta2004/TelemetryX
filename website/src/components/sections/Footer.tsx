import { Terminal } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 border-t border-zinc-900 bg-black relative z-10">
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6 text-white font-bold text-xl font-mono uppercase tracking-widest">
              <Terminal className="text-[var(--telemetry-blue)] w-5 h-5" /> TelemetryX
            </div>
            <p className="text-zinc-500 max-w-sm font-mono text-sm leading-relaxed border-l border-zinc-800 pl-4">
              Advanced, high-performance platform for real-time Formula 1 telemetry, race strategy, and data visualization. Built on a strict, protected baseline.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-sm">System</h4>
            <ul className="space-y-3 font-mono text-sm text-zinc-500">
              <li><a href="#" className="hover:text-white hover:pl-2 transition-all">Documentation</a></li>
              <li><a href="#" className="hover:text-white hover:pl-2 transition-all">Data Pipeline</a></li>
              <li><a href="#" className="hover:text-white hover:pl-2 transition-all">Architecture Rules</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-sm">Terminal</h4>
            <ul className="space-y-3 font-mono text-sm text-zinc-500">
              <li><a href="https://github.com/rishigupta/TelemetryX" className="hover:text-[var(--telemetry-blue)] hover:pl-2 transition-all">&gt; GitHub_Repo</a></li>
              <li><a href="#" className="hover:text-[var(--telemetry-blue)] hover:pl-2 transition-all">&gt; Report_Bug</a></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-zinc-900 text-xs font-mono text-zinc-600">
          <p>SYSTEM.DATE: {new Date().getFullYear()} // OPEN SOURCE</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span className="text-[var(--telemetry-green)]">STATUS: ONLINE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
