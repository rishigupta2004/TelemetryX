"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Zap } from "lucide-react";
import { SmoothScrolling } from "../ui/SmoothScrolling";
import { useTelemetryData } from "@/hooks/useTelemetryData";

gsap.registerPlugin(ScrollTrigger);

export function ChartShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const reduceMotion = prefersReducedMotion;

  // Fetch real telemetry data
  const {
    speed,
    throttle,
    brake,
    timestamp,
    isLoading,
    error
  } = useTelemetryData({
    year: 2023,
    round: 1,
    driverCode: "VER",
    lapNumber: 1
  });

  // Data refs for telemetry data (to avoid re-renders)
  const speedDataRef = useRef(new Float32Array(speed.length));
  const throttleDataRef = useRef(new Float32Array(throttle.length));
  const brakeDataRef = useRef(new Float32Array(brake.length));
  const timestampDataRef = useRef(new Float32Array((timestamp || []).length));
  const DATA_POINTS_TOTAL = speed.length > 0 ? speed.length : 10000;
  const WINDOW_SIZE = 300;

  // Scroll progress state
  const [scrollProgress, setScrollProgress] = useState(0);
  // Fixed progress when paused
  const [fixedProgress, setFixedProgress] = useState(0.5);

  // Update data refs when data changes
  useEffect(() => {
    if (!isLoading && speed.length > 0 && throttle.length > 0 && brake.length > 0) {
      speedDataRef.current = new Float32Array(speed);
      throttleDataRef.current = new Float32Array(throttle);
      brakeDataRef.current = new Float32Array(brake);
      if ((timestamp || []).length > 0) {
        timestampDataRef.current = new Float32Array(timestamp || []);
      }
    }
  }, [speed, throttle, brake, timestamp, isLoading]);

  // Generate fallback telemetry data once (only used if no real data)
  useEffect(() => {
    if (isLoading || speed.length === 0) {
      const dataPoints = DATA_POINTS_TOTAL;
      const speedData = new Float32Array(dataPoints);
      const throttleData = new Float32Array(dataPoints);
      const brakeData = new Float32Array(dataPoints);

      // Initial Noise
      for (let i = 0; i < dataPoints; i++) {
        const t = i / 15;
        speedData[i] = Math.sin(t) * 50 + 220 + Math.random() * 5;
        throttleData[i] = Math.sin(t - 1) > 0 ? 100 : Math.max(0, Math.sin(t * 2) * 100);
        brakeData[i] = throttleData[i] === 0 ? Math.random() * 90 + 10 : 0;
      }

      speedDataRef.current = speedData;
      throttleDataRef.current = throttleData;
      brakeDataRef.current = brakeData;
    }
  }, [isLoading, speed.length, DATA_POINTS_TOTAL]);

  // Update fixed progress when paused
  useEffect(() => {
    if (!isPlaying) {
      setFixedProgress(scrollProgress);
    }
  }, [isPlaying, scrollProgress]);

  // Calculate effective progress
  const effectiveProgress = isPlaying ? scrollProgress : fixedProgress;

  // Set up ScrollTrigger for scroll-based scrubbing
  useEffect(() => {
    if (reduceMotion || !containerRef.current) return;

    const scrollTrigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom top",
      scrub: false, // We'll handle updates manually
      onUpdate: (self) => {
        setScrollProgress(self.progress);
      },
    });

    // Initial update to set progress
    ScrollTrigger.update();

    return () => {
      scrollTrigger.kill();
    };
  }, [reduceMotion, containerRef.current]);

  // Render chart based on effective progress
  useEffect(() => {
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // uPlot style grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.height; i += Math.floor(canvas.height / 5)) {
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
      }
      for (let i = 0; i < canvas.width; i += Math.floor(canvas.width / 10)) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
      }
      ctx.stroke();

      // Calculate start index for data window
      const startIndex = Math.floor(
        effectiveProgress * (DATA_POINTS_TOTAL - WINDOW_SIZE)
      );
      const endIndex = startIndex + WINDOW_SIZE;

      const drawTrace = (
        data: Float32Array,
        color: string,
        scale: number,
        yOffset: number,
        lineW: number,
        isFill: boolean = false
      ) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.lineJoin = "bevel";

        const step = canvas.width / (WINDOW_SIZE - 1);
        for (let i = 0; i < WINDOW_SIZE; i++) {
          const dataIndex = startIndex + i;
          const x = i * step;
          const y = canvas.height - (data[dataIndex] * scale + yOffset);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (isFill) {
          ctx.lineTo(canvas.width, canvas.height);
          ctx.lineTo(0, canvas.height);
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      };

      // Draw Traces like uPlot does in TelemetryX
      drawTrace(speedDataRef.current, "#00e5ff", canvas.height / 500, canvas.height * 0.1, 2);
      drawTrace(throttleDataRef.current, "#00ff00", canvas.height / 400, canvas.height * 0.05, 1.5, true);
      drawTrace(brakeDataRef.current, "#ff2a2a", canvas.height / 400, canvas.height * 0.05, 1.5, true);

      // Scanning playhead line
      const scanX = canvas.width - 40;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [effectiveProgress, reduceMotion, isPlaying]);

  return (
    <SmoothScrolling>
      <section
        className="py-24 relative overflow-hidden bg-[#050505] border-t border-zinc-900"
        id="telemetry"
        ref={containerRef}
        data-home-section="chart-showcase"
      >
        <div className="absolute inset-0 bg-dot-grid opacity-10" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div
              data-reveal-item
              ref={leftPanelRef}
              className="w-full lg:w-1/3 p-6"
            >
              <div className="flex items-center gap-3 mb-6 border border-[var(--telemetry-blue)]/50 bg-[var(--telemetry-blue)]/10 px-3 py-1 w-fit panel-border shadow-[0_0_15px_rgba(0,229,255,0.1)]">
                <Zap className="w-3 h-3 text-[var(--telemetry-blue)] animate-pulse" />
                <span className="font-mono text-[var(--telemetry-blue)] uppercase tracking-widest text-[10px] font-bold">uPLOT CANVAS WORKER</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black mb-6 text-white uppercase tracking-tighter">
                Desktop-Class<br/>Rendering
              </h2>
              <p className="text-zinc-400 font-mono text-xs md:text-sm leading-relaxed mb-8 border-l-2 border-zinc-800 pl-4 bg-black/50 p-4 backdrop-blur-md panel-border">
                We replaced React charting libraries with raw <span className="text-white">uPlot Canvas elements</span> offloaded to Web Workers. TelemetryX can plot 100,000+ data points for Throttle, Brake, Speed, and DRS without dropping a single frame or blocking the UI thread.
              </p>

              <div className="space-y-4 font-mono text-[10px] uppercase text-zinc-500 bg-black border border-zinc-800 p-4 panel-border">
                <div className="flex justify-between border-b border-zinc-900 pb-2 items-center group">
                  <span className="group-hover:text-white transition-colors">DOM Nodes per chart</span>
                  <span className="text-[var(--telemetry-green)] bg-zinc-900 px-2 py-1">1 (Canvas)</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2 items-center group">
                  <span className="group-hover:text-white transition-colors">Data Binding</span>
                  <span className="text-[var(--telemetry-yellow)] bg-zinc-900 px-2 py-1">SharedArrayBuffer</span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="group-hover:text-white transition-colors">Thread</span>
                  <span className="text-[var(--telemetry-blue)] bg-zinc-900 px-2 py-1">telemetry.worker.ts</span>
                </div>
              </div>
            </div>

            <div
              data-pin-target="chart-showcase"
              ref={rightPanelRef}
              className="w-full lg:w-2/3 h-[500px] bg-[#0A0A0A] border border-zinc-800 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] panel-border rounded-xl"
            >
              {/* Window Chrome */}
              <div className="h-8 bg-[#111] border-b border-zinc-800 flex items-center px-4 justify-between select-none">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
              </div>
              <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                TelemetryView.tsx
              </div>
              <div className="w-12" />

              {/* uPlot UI Mimic */}
              <div className="h-10 border-b border-zinc-800 bg-[#050505] flex items-center px-4 justify-between z-10 font-mono text-[10px] text-zinc-500">
                <div className="flex gap-4 items-center">
                  <span className="text-white bg-zinc-800 px-2 py-0.5">VER</span>
                  <span className="text-zinc-600">vs</span>
                  <span className="text-white bg-zinc-800 px-2 py-0.5">NOR</span>
                </div>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--telemetry-blue)]" /> SPEED</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--telemetry-green)]" /> THROTTLE</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--telemetry-red)]" /> BRAKE</span>
                </div>
              </div>

              <canvas ref={canvasRef} className="w-full h-[calc(100%-72px)] block bg-black" />

              {/* Play/Pause control overlay */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={reduceMotion}
                className="absolute bottom-4 right-4 z-10 border border-zinc-700 bg-black/80 hover:bg-zinc-800 text-zinc-400 px-4 py-2 font-mono text-[10px] uppercase cursor-pointer transition-colors backdrop-blur-sm"
              >
                {reduceMotion ? "STATIC VIEW" : isPlaying ? "PAUSE WORKER" : "RESUME WORKER"}
              </button>

              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20" />
            </div>
          </div>
        </div>
      </section>
    </SmoothScrolling>
  );
}