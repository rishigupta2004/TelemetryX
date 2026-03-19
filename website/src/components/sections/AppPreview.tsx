"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useEffect, useState } from "react";
import { Play, Pause, FastForward, Activity, Map, BarChart2, Database, Settings } from "lucide-react";
import { useTimingData } from "@/hooks/useTimingData";

gsap.registerPlugin(ScrollTrigger);

export function AppPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const car1Ref = useRef<HTMLDivElement>(null);
  const car2Ref = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const { rows, status } = useTimingData(2024, 'bahrain', 'R');

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const reduceMotion = prefersReducedMotion ?? false;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    let mockupTween: gsap.core.Tween | null;
    let car1Tl: gsap.core.Timeline | null;
    let car2Tl: gsap.core.Timeline | null;
    let playheadTween: gsap.core.Tween | null;

    // Giant mockup animation - fade in and move up when in view
    if (!reduceMotion && mockupRef.current) {
      mockupTween = gsap.fromTo(mockupRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "cubic-bezier(0.16, 1, 0.3, 1)",
          scrollTrigger: {
            trigger: mockupRef.current,
            start: "top center",
            toggleActions: "play none none reverse"
          }
        }
      );
    } else if (mockupRef.current) {
      // Set to final state immediately for reduced motion
      gsap.set(mockupRef.current, { opacity: 1, y: 0 });
    }

    // Animated cars in track map
    if (!reduceMotion && car1Ref.current && car2Ref.current) {
      car1Tl = gsap.timeline({ repeat: -1 });
      car1Tl.to(car1Ref.current, {
        x: [-100, 100, 100, -100, -100] as any,
        y: [0, -80, 80, 80, 0] as any,
        duration: 6,
        ease: "none"
      });

      car2Tl = gsap.timeline({ repeat: -1 });
      car2Tl.to(car2Ref.current, {
        x: [-80, 120, 120, -80, -80] as any,
        y: [20, -60, 100, 100, 20] as any,
        duration: 6.2,
        ease: "none"
      });
    } else if (car1Ref.current && car2Ref.current) {
      // Set to a reasonable mid-point for reduced motion
      gsap.set(car1Ref.current, { x: 0, y: 0 });
      gsap.set(car2Ref.current, { x: 0, y: 20 });
    }

    // Playhead line animation
    if (!reduceMotion && playheadRef.current) {
      playheadTween = gsap.to(playheadRef.current, {
        width: "85%",
        duration: 10,
        ease: "linear"
      });
    } else if (playheadRef.current) {
      // Set to final state immediately for reduced motion
      gsap.set(playheadRef.current, { width: "85%" });
    }

    // Cleanup
    return () => {
      gsap.killTweensOf(mockupRef.current);
      gsap.killTweensOf(car1Ref.current);
      gsap.killTweensOf(car2Ref.current);
      gsap.killTweensOf(playheadRef.current);
      if (mockupTween) mockupTween.kill();
      if (car1Tl) car1Tl.kill();
      if (car2Tl) car2Tl.kill();
      if (playheadTween) playheadTween.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [reduceMotion]);

  return (
    <section
        className="py-32 relative bg-[#050505] border-t border-zinc-900 overflow-hidden"
        ref={containerRef}
        data-home-section="app-preview"
      >
      <div className="absolute inset-0 bg-dot-grid opacity-10 pointer-events-none" />
      
      {/* Huge Background Typography */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full overflow-hidden flex justify-center pointer-events-none opacity-5">
        <h2 className="text-[200px] font-black uppercase tracking-tighter whitespace-nowrap text-white">COMMAND CENTER</h2>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-[var(--telemetry-blue)] mb-6 panel-border">
            THE FRONTEND
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-white uppercase tracking-tighter">
            Desktop-Native UI
          </h2>
          <p className="text-zinc-400 font-mono text-sm max-w-2xl mx-auto leading-relaxed border-l-2 border-[var(--telemetry-blue)] pl-4">
            A 1:1 replica of the pit-wall. No browser tabs. No cloud lag. The Electron shell grants raw GPU access to render dense telemetry and virtualized timing towers simultaneously.
          </p>
        </div>

        {/* The Giant Mockup */}
        <div
          data-pin-target="app-preview"
          ref={mockupRef}
          className="relative w-full rounded-xl border border-zinc-800 bg-[#0a0a0a] shadow-[0_0_100px_rgba(0,0,0,1)] panel-border overflow-hidden"
        >
          {/* Title Bar */}
          <div className="h-10 bg-[#111] border-b border-zinc-800 flex items-center px-4 justify-between select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-red-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-yellow-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-green-500 transition-colors" />
            </div>
            <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3 text-[var(--telemetry-blue)]" />
              TELEMETRYX <span className="text-zinc-700">|</span> SESSION_9158
            </div>
            <div className="font-mono text-[10px] text-[var(--telemetry-green)] bg-[#020] px-2 py-0.5 border border-[var(--telemetry-green)]/30">
               90 FPS
            </div>
          </div>

          <div className="flex h-[600px]">
            {/* Sidebar */}
            <div className="w-14 border-r border-zinc-800 bg-black flex flex-col items-center py-4 gap-6 text-zinc-600 hidden sm:flex">
              <div className="w-8 h-8 rounded bg-[var(--telemetry-blue)]/10 text-[var(--telemetry-blue)] flex items-center justify-center border border-[var(--telemetry-blue)]/30">
                <Activity className="w-4 h-4" />
              </div>
              <Map className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <BarChart2 className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <Database className="w-4 h-4 hover:text-white transition-colors cursor-pointer mt-auto" />
              <Settings className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
            </div>

            {/* Layout Grid container like the real app */}
            <div className="flex-1 flex flex-col bg-[#050505] p-2 gap-2 overflow-hidden">
              
              {/* Top View Switcher */}
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2 px-1">
                <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-sans hidden sm:block">Live Classification</div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="border border-zinc-800 bg-[#111] px-4 py-1.5 text-[10px] font-mono text-white shadow-[0_0_10px_rgba(0,229,255,0.1)] border-[var(--telemetry-blue)]/50">TIMING VIEW</div>
                  <div className="border border-zinc-800 bg-[#111] px-4 py-1.5 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors cursor-pointer">TELEMETRY</div>
                </div>
              </div>

              <div className="flex flex-1 gap-2 overflow-hidden">
                {/* Left: Virtualized Timing Tower */}
                <div className="w-full sm:w-[40%] md:w-[30%] flex flex-col border border-zinc-800 bg-black">
                  <div className="flex text-[9px] font-mono text-zinc-500 border-b border-zinc-800 p-2 bg-[#111]">
                    <span className="w-6">POS</span>
                    <span className="w-8">NO</span>
                    <span className="flex-1">DRIVER</span>
                    <span className="w-16 text-right">GAP</span>
                  </div>
                  <div className="flex-1 overflow-hidden p-1 space-y-0.5">
                    {status === 'loading' ? (
                      <div className="flex items-center justify-center h-full text-zinc-500 font-mono text-xs">
                        Loading timing data...
                      </div>
                    ) : status === 'error' ? (
                      <div className="flex items-center justify-center h-full text-red-500 font-mono text-xs">
                        Failed to load data
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-zinc-500 font-mono text-xs">
                        No timing data available
                      </div>
                    ) : (
                      rows.slice(0, 8).map(d => (
                        <div key={d.driverNumber} className={`flex items-center text-[10px] font-mono p-2 ${d.position===1 ? 'bg-zinc-900 border border-zinc-800' : 'hover:bg-zinc-900'}`}>
                          <span className="w-6 text-zinc-500">{d.position}</span>
                          <span className="w-8 text-white font-bold" style={{color: d.teamColor}}>{d.driverNumber}</span>
                          <span className="flex-1 text-white font-bold tracking-wider">{d.driverCode}</span>
                          <span className="w-12 text-right text-zinc-400 mr-4">{d.gap}</span>
                          <div className="flex gap-1 hidden lg:flex">
                            <span className={`w-2 h-3 ${d.s1Color==='purple'?'bg-[var(--telemetry-purple)]':d.s1Color==='green'?'bg-[var(--telemetry-green)]':d.s1Color==='yellow'?'bg-[var(--telemetry-yellow)]':'bg-zinc-600'}`} />
                            <span className={`w-2 h-3 ${d.s2Color==='purple'?'bg-[var(--telemetry-purple)]':d.s2Color==='green'?'bg-[var(--telemetry-green)]':d.s2Color==='yellow'?'bg-[var(--telemetry-yellow)]':'bg-zinc-600'}`} />
                            <span className={`w-2 h-3 ${d.s3Color==='purple'?'bg-[var(--telemetry-purple)]':d.s3Color==='green'?'bg-[var(--telemetry-green)]':d.s3Color==='yellow'?'bg-[var(--telemetry-yellow)]':'bg-zinc-600'}`} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Center: Track Map Canvas */}
                <div className="flex-1 border border-zinc-800 bg-[#0A0A0A] relative flex items-center justify-center overflow-hidden group hidden sm:flex">
                  <div className="absolute inset-0 bg-dot-grid opacity-10" />
                  <div className="absolute top-4 left-4 bg-black/80 border border-zinc-800 px-3 py-1 font-mono text-[9px] text-zinc-500 z-10">
                    SVG TRACK MAP // ZOOM: 100%
                  </div>
                  
                  {/* High-res SVG map */}
                  <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] stroke-zinc-700 stroke-[1.5] fill-none opacity-80">
                    <path d="M20,50 Q20,20 50,20 T80,50 T50,80 T20,50" />
                    <path d="M20,50 Q20,20 50,20" className="stroke-[var(--telemetry-green)]" strokeWidth="2" />
                    <path d="M50,20 T80,50" className="stroke-[var(--telemetry-purple)]" strokeWidth="2" />
                  </svg>

                  {/* Animated Cars */}
                  <div
                    className="absolute w-4 h-4 bg-[#005aff] rounded-full border-2 border-white flex items-center justify-center text-[7px] font-bold text-white shadow-[0_0_15px_#005aff] z-20"
                    ref={car1Ref}
                  >
                    1
                  </div>
                  <div
                    className="absolute w-4 h-4 bg-[#dc0000] rounded-full border-2 border-white flex items-center justify-center text-[7px] font-bold text-white shadow-[0_0_15px_#dc0000] z-20"
                    ref={car2Ref}
                  >
                    16
                  </div>
                </div>
              </div>

              {/* Bottom: Playback Controls */}
              <div className="h-12 border border-zinc-800 bg-[#0A0A0A] flex items-center px-4 gap-4 font-mono shrink-0">
                <div className="flex gap-2">
                  <button className="w-8 h-8 bg-[#111] border border-zinc-700 flex items-center justify-center hover:bg-white hover:text-black transition-colors"><Pause className="w-4 h-4 fill-current"/></button>
                  <button className="w-8 h-8 bg-[#111] border border-zinc-700 flex items-center justify-center text-zinc-500"><FastForward className="w-4 h-4 fill-current"/></button>
                </div>
                <div className="text-[10px] text-[var(--telemetry-green)] font-bold bg-[#020] px-3 py-1 border border-[var(--telemetry-green)]/30 animate-pulse hidden md:block">LIVE</div>
                <div className="flex-1 flex items-center gap-4 px-4">
                  <span className="text-[10px] text-zinc-500 hidden sm:block">14:02:11</span>
                  <div className="flex-1 h-1.5 bg-zinc-900 rounded-full relative overflow-hidden cursor-crosshair">
                    <div
                      className="absolute top-0 left-0 h-full bg-[var(--telemetry-blue)] shadow-[0_0_10px_var(--telemetry-blue)]"
                      ref={playheadRef}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 hidden sm:block">15:30:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Technical Callouts below mockup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 font-mono text-xs" data-stagger-group="app-preview-callouts">
         <div className="border border-zinc-800 bg-black p-4 text-zinc-400 panel-border hover:border-zinc-500 transition-colors" data-stagger-item>
           <span className="text-white font-bold block mb-2">1. Layout Virtualization</span>
           The timing tower renders only the visible rows to the DOM. As positions shuffle, memory remains flat.
         </div>
         <div className="border border-zinc-800 bg-black p-4 text-zinc-400 panel-border hover:border-zinc-500 transition-colors" data-stagger-item>
           <span className="text-white font-bold block mb-2">2. SVG Path Rasterization</span>
           The track map uses SVG for crisp paths, but car position dots are calculated and pushed via GPU transforms to avoid DOM repaints.
         </div>
         <div className="border border-zinc-800 bg-black p-4 text-zinc-400 panel-border hover:border-zinc-500 transition-colors" data-stagger-item>
           <span className="text-white font-bold block mb-2">3. Transient Store sync</span>
           The playback timeline scrubs without triggering React state changes, controlled by Zustand subscribe streams.
         </div>
      </div>
     </div>
    </section>
  );
}
