"use client";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { FileCode2, Terminal, Cpu, Database } from "lucide-react";

const CODE_SNIPPETS = {
  duckdb: `// backend/api/telemetry.py
@router.get("/trace/{session_id}/{driver_id}")
async def get_telemetry_trace(session_id: str, driver_id: str):
    """
    Direct Parquet Execution via Embedded DuckDB.
    Zero-network overhead. 1.2ms latency.
    """
    query = """
        SELECT 
            session_time, 
            speed_kph, 
            throttle_pct, 
            brake_pct, 
            gear 
        FROM read_parquet('data/telemetry_*.parquet')
        WHERE session_id = ? AND driver_id = ?
        ORDER BY session_time ASC
    """
    
    # Executes instantly on local NVMe
    result = duckdb.execute(query, [session_id, driver_id]).df()
    
    return Response(
        content=result.to_json(orient="records"),
        media_type="application/json"
    )`,
  worker: `// frontend-electron/src/workers/telemetry.worker.ts
// ── Offloading Canvas plotting to prevent Main Thread blocking

self.onmessage = (e: MessageEvent) => {
  const { type, payload, sharedBuffer } = e.data;
  
  if (type === 'INIT_STREAM') {
    // Cast SharedArrayBuffer for zero-copy memory access
    const floatView = new Float32Array(sharedBuffer);
    
    // Listen to UDP/WebSocket stream directly in worker
    const socket = new WebSocket('ws://localhost:9000/stream');
    
    socket.onmessage = (msg) => {
      const data = new Float32Array(msg.data); // Binary payload
      // Write directly to shared memory
      floatView.set(data, payload.offset);
      
      // Notify main thread to run requestAnimationFrame
      postMessage({ type: 'RENDER_TICK' });
    };
  }
};`,
  zustand: `// frontend-electron/src/stores/playbackStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface PlaybackState {
  cursorTime: number;
  isPlaying: boolean;
  playbackRate: number;
  setCursor: (t: number) => void;
  tick: (delta: number) => void;
}

// Transient state update loop (no React re-renders)
export const usePlaybackStore = create<PlaybackState>()(
  subscribeWithSelector((set, get) => ({
    cursorTime: 0,
    isPlaying: true,
    playbackRate: 1.0,
    
    setCursor: (t) => set({ cursorTime: t }),
    
    // Called 60 times a second by requestAnimationFrame
    tick: (delta) => {
      const state = get();
      if (state.isPlaying) {
        set({ cursorTime: state.cursorTime + (delta * state.playbackRate) });
      }
    }
  }))
);`
};

export function CodeShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState<'duckdb' | 'worker' | 'zustand'>('duckdb');

  return (
    <section className="py-24 relative bg-[#020202] border-t border-zinc-900" id="code" ref={containerRef}>
      <div className="absolute inset-0 bg-dot-grid opacity-10" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Left: Philosophy */}
          <div className="w-full lg:w-1/3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-purple)] mb-6 w-fit panel-border shadow-[0_0_15px_rgba(176,38,255,0.1)]">
              <FileCode2 className="w-3 h-3" /> INTERNAL SOURCE CODE
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-white uppercase tracking-tighter">
              Bypassing<br/>The Browser
            </h2>
            <div className="text-zinc-400 font-mono text-sm leading-relaxed space-y-6">
              <p>
                Standard web applications crash when asked to render 1.5 million telemetry points per second. We threw out the web playbook.
              </p>
              <div className="border-l-2 border-[var(--telemetry-red)] pl-4 space-y-4 py-2">
                <button 
                  onClick={() => setActiveTab('duckdb')}
                  className={`w-full text-left p-3 border transition-colors ${activeTab === 'duckdb' ? 'bg-zinc-900 border-zinc-700 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <div className="font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-2"><Database className="w-3 h-3" /> Python FastAPI + DuckDB</div>
                  <div className="text-xs">Zero-network Parquet queries via local OLAP engine.</div>
                </button>

                <button 
                  onClick={() => setActiveTab('worker')}
                  className={`w-full text-left p-3 border transition-colors ${activeTab === 'worker' ? 'bg-zinc-900 border-zinc-700 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <div className="font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-2"><Cpu className="w-3 h-3" /> Web Worker IPC</div>
                  <div className="text-xs">Binary WebSocket payloads written to SharedArrayBuffers.</div>
                </button>

                <button 
                  onClick={() => setActiveTab('zustand')}
                  className={`w-full text-left p-3 border transition-colors ${activeTab === 'zustand' ? 'bg-zinc-900 border-zinc-700 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <div className="font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-2"><Terminal className="w-3 h-3" /> Transient State</div>
                  <div className="text-xs">Zustand selectors firing at 60fps without triggering React renders.</div>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Code Editor */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-2/3 h-full min-h-[500px]"
          >
            <div className="bg-[#0A0A0A] border border-zinc-800 rounded-xl overflow-hidden panel-border shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full flex flex-col">
              {/* Editor Tabs */}
              <div className="flex items-end bg-[#111] border-b border-zinc-800 pt-2 px-2 gap-1 font-mono text-[10px] overflow-x-auto">
                <div className={`px-4 py-2 rounded-t-md border border-b-0 cursor-pointer whitespace-nowrap ${activeTab === 'duckdb' ? 'bg-[#0A0A0A] border-zinc-800 text-white' : 'border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50'}`} onClick={() => setActiveTab('duckdb')}>
                  api/telemetry.py
                </div>
                <div className={`px-4 py-2 rounded-t-md border border-b-0 cursor-pointer whitespace-nowrap ${activeTab === 'worker' ? 'bg-[#0A0A0A] border-zinc-800 text-white' : 'border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50'}`} onClick={() => setActiveTab('worker')}>
                  telemetry.worker.ts
                </div>
                <div className={`px-4 py-2 rounded-t-md border border-b-0 cursor-pointer whitespace-nowrap ${activeTab === 'zustand' ? 'bg-[#0A0A0A] border-zinc-800 text-white' : 'border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50'}`} onClick={() => setActiveTab('zustand')}>
                  playbackStore.ts
                </div>
              </div>

              {/* Code Area */}
              <div className="p-6 overflow-auto flex-1 font-mono text-xs md:text-sm leading-loose">
                <pre className="text-zinc-300">
                  <code 
                    dangerouslySetInnerHTML={{ 
                      __html: CODE_SNIPPETS[activeTab]
                        .replace(/(\/\/.*|#.*)/g, '<span class="text-zinc-600">$1</span>')
                        .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-[var(--telemetry-green)]">$1</span>')
                        .replace(/\b(import|from|export|const|let|var|function|return|async|await|if|else|interface|type)\b/g, '<span class="text-[var(--telemetry-purple)]">$1</span>')
                        .replace(/\b(class|new|this)\b/g, '<span class="text-[var(--telemetry-blue)]">$1</span>')
                    }}
                  />
                </pre>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
