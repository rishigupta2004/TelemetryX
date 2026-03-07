"use client";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Database, Zap, HardDrive } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export default function Engine() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".table-container",
        start: "top center",
        end: "bottom center",
        scrub: 1,
      }
    });

    tl.from(".row", {
      opacity: 0,
      x: 100,
      stagger: 0.1,
      duration: 1,
      ease: "power3.out"
    })
    .to(".row-value", {
      color: "var(--telemetry-green)",
      stagger: 0.05,
      duration: 0.5
    }, "<0.5")
    .from(".query-line", {
      clipPath: "inset(0 100% 0 0)",
      duration: 1.5,
      ease: "steps(40)"
    }, "<");

  }, { scope: container });

  return (
    <main ref={container} className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-red)] selection:text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="pt-40 pb-20 px-6 max-w-5xl mx-auto w-full relative">
        <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 glitch-hover" data-text="THE OLAP CORE">
          THE<br/>OLAP CORE
        </h1>
        <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed border-l-2 border-[var(--telemetry-red)] pl-4">
          Millions of data points. Zero loading screens. TelemetryX utilizes an embedded DuckDB instance—a specialized Columnar Database built for extreme analytical workloads right on your machine.
        </p>
      </section>

      <section className="py-20 px-6 max-w-5xl mx-auto w-full relative table-container min-h-[150vh]">
        <div className="sticky top-40">
          <div className="bg-[#050505] border border-zinc-800 p-8 panel-border mb-12">
            <h3 className="font-mono text-[10px] text-zinc-500 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <Database className="w-4 h-4 text-[var(--telemetry-red)]" /> In-Memory Query Execution
            </h3>
            
            <div className="font-mono text-sm md:text-base text-zinc-300 query-line border-l border-zinc-700 pl-4 py-2 bg-black whitespace-pre-wrap">
              <span className="text-[var(--telemetry-blue)]">SELECT</span> driver_id, session_time, speed, throttle, brake <br/>
              <span className="text-[var(--telemetry-blue)]">FROM</span> telemetry_data <br/>
              <span className="text-[var(--telemetry-blue)]">WHERE</span> session_id = <span className="text-[var(--telemetry-green)]">'9158'</span> <br/>
              <span className="text-[var(--telemetry-blue)]">AND</span> speed &gt; <span className="text-[var(--telemetry-green)]">300</span> <br/>
              <span className="text-[var(--telemetry-blue)]">ORDER BY</span> session_time <span className="text-[var(--telemetry-blue)]">ASC</span>
            </div>
          </div>

          <div className="font-mono text-[10px] border border-zinc-800 bg-black overflow-hidden shadow-[0_0_50px_rgba(255,42,42,0.1)]">
            <div className="grid grid-cols-5 gap-4 p-4 border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 uppercase tracking-widest font-bold">
              <span>Time_MS</span>
              <span>Driver</span>
              <span>Speed</span>
              <span>Throttle</span>
              <span>Brake</span>
            </div>
            <div className="p-4 space-y-2 relative">
              <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
              
              {[
                ["124050", "VER", "305.4", "100", "0"],
                ["124100", "VER", "312.1", "100", "0"],
                ["124150", "VER", "318.5", "100", "0"],
                ["124200", "VER", "324.9", "100", "0"],
                ["124250", "VER", "330.2", "100", "0"],
                ["124300", "VER", "334.8", "100", "0"],
                ["124350", "VER", "338.1", "100", "0"],
                ["124400", "VER", "340.5", "100", "0"],
                ["124450", "VER", "180.2", "0", "100"],
                ["124500", "VER", "110.5", "0", "100"]
              ].map((row, i) => (
                <div key={i} className="row grid grid-cols-5 gap-4 py-2 border-b border-zinc-900/50 opacity-0 transform translate-x-20">
                  <span className="text-zinc-600">{row[0]}</span>
                  <span className="text-white bg-zinc-800 px-1 w-fit">{row[1]}</span>
                  <span className="row-value">{row[2]}</span>
                  <span className="row-value">{row[3]}</span>
                  <span className={i > 7 ? "text-[var(--telemetry-red)] text-glow font-bold" : "text-zinc-600"}>{row[4]}</span>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 p-2 text-center text-zinc-500 text-[9px] uppercase tracking-widest">
              QUERY EXECUTED IN: <span className="text-[var(--telemetry-green)]">1.2ms</span> // 1.4 MILLION ROWS SCANNED
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
