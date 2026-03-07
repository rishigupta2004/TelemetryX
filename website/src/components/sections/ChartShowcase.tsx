"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

export function ChartShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isInView) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;
    
    const dataPoints = 300;
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

      if (isPlaying) {
        offset += 1;
        if (offset % 2 === 0) {
          speedData.copyWithin(0, 1);
          throttleData.copyWithin(0, 1);
          brakeData.copyWithin(0, 1);
          
          const t = Date.now() / 400;
          const isBraking = Math.sin(t) < 0;
          const jitter = Math.random() * 3 - 1.5;
          
          speedData[dataPoints - 1] = isBraking 
            ? Math.max(60, speedData[dataPoints - 2] - 8 + jitter)
            : Math.min(345, speedData[dataPoints - 2] + 4 + jitter);
            
          throttleData[dataPoints - 1] = isBraking ? 0 : (Math.sin(t*2) > 0 ? 100 : Math.min(100, throttleData[dataPoints - 2] + 15));
          brakeData[dataPoints - 1] = isBraking ? Math.min(100, brakeData[dataPoints - 2] + 25) : 0;
        }
      }

      const drawTrace = (data: Float32Array, color: string, scale: number, yOffset: number, lineW: number, isFill: boolean = false) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.lineJoin = "bevel";
        
        const step = canvas.width / (dataPoints - 1);
        for (let i = 0; i < dataPoints; i++) {
          const x = i * step;
          const y = canvas.height - (data[i] * scale + yOffset);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (isFill) {
          ctx.lineTo(canvas.width, canvas.height);
          ctx.lineTo(0, canvas.height);
          ctx.fillStyle = color.replace('1)', '0.1)'); // swap opacity if rgba
          // Custom fill logic for hex (simple hack: just use global alpha)
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      };

      // Draw Traces like uPlot does in TelemetryX
      drawTrace(speedData, "#00e5ff", canvas.height / 500, canvas.height * 0.1, 2); 
      drawTrace(throttleData, "#00ff00", canvas.height / 400, canvas.height * 0.05, 1.5, true); 
      drawTrace(brakeData, "#ff2a2a", canvas.height / 400, canvas.height * 0.05, 1.5, true); 

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

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isInView]);

  return (
    <section className="py-24 relative overflow-hidden bg-[#050505] border-t border-zinc-900" id="telemetry" ref={containerRef}>
      <div className="absolute inset-0 bg-dot-grid opacity-10" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/3 p-6"
          >
            <div className="flex items-center gap-3 mb-6 border border-[var(--telemetry-blue)]/50 bg-[var(--telemetry-blue)]/10 px-3 py-1 w-fit">
               <div className="w-2 h-2 bg-[var(--telemetry-blue)] shadow-[0_0_10px_var(--telemetry-blue)] animate-pulse" />
               <span className="font-mono text-[var(--telemetry-blue)] uppercase tracking-widest text-[10px] font-bold">uPLOT WORKER</span>
            </div>
            
            <h2 className="text-4xl font-black mb-6 text-white uppercase tracking-tighter">
              Desktop-Class<br/>Rendering
            </h2>
            <p className="text-zinc-400 font-mono text-xs leading-relaxed mb-8 border-l-2 border-zinc-800 pl-4">
              We replaced React charting libraries with raw <span className="text-white">uPlot Canvas elements</span>. TelemetryX can plot 100,000+ data points for Throttle, Brake, Speed, and DRS without dropping a single frame or blocking the UI thread.
            </p>
            
            <div className="space-y-4 font-mono text-[10px] uppercase text-zinc-500">
              <div className="flex justify-between border-b border-zinc-900 pb-2 items-center group">
                <span className="group-hover:text-white transition-colors">DOM Nodes per chart</span>
                <span className="text-[var(--telemetry-green)] bg-zinc-900 px-2 py-1">1 (Canvas)</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2 items-center group">
                <span className="group-hover:text-white transition-colors">Data Binding</span>
                <span className="text-[var(--telemetry-yellow)] bg-zinc-900 px-2 py-1">SharedArrayBuffer</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-2/3 h-[500px] bg-black border border-zinc-800 relative overflow-hidden shadow-2xl shadow-black panel-border"
          >
            {/* uPlot UI Mimic */}
            <div className="absolute top-0 left-0 right-0 h-10 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 justify-between z-10 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-4">
                <span className="text-white">VER</span>
                <span className="text-zinc-600">vs</span>
                <span className="text-[var(--telemetry-green)]">NOR</span>
              </div>
              <div className="flex gap-4">
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--telemetry-blue)]" /> SPEED</span>
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--telemetry-green)]" /> THROTTLE</span>
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-[var(--telemetry-red)]" /> BRAKE</span>
              </div>
            </div>

            <canvas ref={canvasRef} className="w-full h-[calc(100%-40px)] mt-10 block" />
            
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
