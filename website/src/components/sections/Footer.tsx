import { Terminal } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-16 border-t border-zinc-900 bg-black relative z-10">
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
          
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6 text-white font-bold text-xl font-mono uppercase tracking-widest">
              <Terminal className="text-[var(--telemetry-blue)] w-5 h-5" /> TelemetryX
            </div>
            <p className="text-zinc-500 max-w-sm font-mono text-xs leading-relaxed border-l-2 border-zinc-800 pl-4 mb-6">
              A broadcast-grade, desktop-first Formula 1 telemetry command center. Built entirely on an embedded DuckDB Python backend and a React/Electron GPU-accelerated frontend. 
            </p>
            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-600 bg-zinc-950 border border-zinc-900 px-3 py-1.5 w-fit">
              <span className="w-1.5 h-1.5 bg-[var(--telemetry-green)] rounded-full animate-pulse" /> E10 NODE HEALTH: OPTIMAL
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-widest text-[10px] bg-zinc-900 px-2 py-1 border border-zinc-800 w-fit">Deep Dives</h4>
            <ul className="space-y-4 font-mono text-xs text-zinc-500">
              <li><a href="/architecture" className="hover:text-[var(--telemetry-blue)] hover:pl-2 transition-all block">Architecture Overview</a></li>
              <li><a href="/ml-strategy" className="hover:text-[var(--telemetry-purple)] hover:pl-2 transition-all block">Strategy & ML Engine</a></li>
              <li><a href="/protocol" className="hover:text-[var(--telemetry-red)] hover:pl-2 transition-all block">Performance Rules (AGENTS)</a></li>
              <li><a href="/ingestion" className="hover:text-[var(--telemetry-blue)] hover:pl-2 transition-all block">DuckDB Pipeline</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-widest text-[10px] bg-zinc-900 px-2 py-1 border border-zinc-800 w-fit">Interactive</h4>
            <ul className="space-y-4 font-mono text-xs text-zinc-500">
              <li><a href="/cockpit" className="hover:text-white hover:pl-2 transition-all block text-glow">Live 3D Cockpit HUD</a></li>
              <li><a href="/tires" className="hover:text-[var(--telemetry-yellow)] hover:pl-2 transition-all block text-glow">Thermal Tire Model</a></li>
              <li><a href="/pipeline" className="hover:text-[var(--telemetry-green)] hover:pl-2 transition-all block">ReactFlow Routing</a></li>
              <li><a href="/engine" className="hover:text-white hover:pl-2 transition-all block">OLAP Query Exec</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-widest text-[10px] bg-zinc-900 px-2 py-1 border border-zinc-800 w-fit">Terminal</h4>
            <ul className="space-y-4 font-mono text-xs text-zinc-500">
              <li><a href="https://github.com/rishigupta/TelemetryX" className="hover:text-[var(--telemetry-blue)] hover:pl-2 transition-all block">&gt; GitHub_Repo</a></li>
              <li><a href="/download" className="hover:text-white hover:pl-2 transition-all block font-bold text-[var(--telemetry-green)]">&gt; Acquire_System (v1.0)</a></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-zinc-900 text-[10px] font-mono text-zinc-600">
          <p>SYSTEM.DATE: {new Date().getFullYear()} // OPEN SOURCE // AS FAR AS A DEV CAN GO IN GUI</p>
          <div className="flex gap-4 mt-4 md:mt-0 uppercase tracking-widest">
            <span className="text-[var(--telemetry-green)] bg-[var(--telemetry-green)]/10 px-2 py-1 border border-[var(--telemetry-green)]/30">STATUS: ONLINE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
