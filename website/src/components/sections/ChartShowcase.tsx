"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export function ChartShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;
    
    const dataPoints = 200;
    const speedData = new Float32Array(dataPoints);
    const throttleData = new Float32Array(dataPoints);
    const brakeData = new Float32Array(dataPoints);

    for (let i = 0; i < dataPoints; i++) {
      speedData[i] = Math.sin(i / 10) * 40 + 200 + Math.random() * 5;
      throttleData[i] = Math.max(0, Math.sin(i / 8) * 100);
      brakeData[i] = throttleData[i] === 0 ? Math.random() * 80 + 20 : 0;
    }

    const render = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
      }
      for (let i = 0; i < canvas.width; i += 80) {
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
          
          const t = Date.now() / 500;
          const isBraking = Math.sin(t) < 0;
          
          speedData[dataPoints - 1] = isBraking 
            ? Math.max(80, speedData[dataPoints - 2] - 5 + Math.random() * 2)
            : Math.min(330, speedData[dataPoints - 2] + 3 + Math.random() * 2);
            
          throttleData[dataPoints - 1] = isBraking ? 0 : Math.min(100, throttleData[dataPoints - 2] + 10);
          brakeData[dataPoints - 1] = isBraking ? Math.min(100, brakeData[dataPoints - 2] + 20) : 0;
        }
      }

      const drawTrace = (data: Float32Array, color: string, scale: number, yOffset: number, lineW: number) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.lineJoin = "round";
        
        const step = canvas.width / (dataPoints - 1);
        for (let i = 0; i < dataPoints; i++) {
          const x = i * step;
          const y = canvas.height - (data[i] * scale + yOffset);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      drawTrace(speedData, "#00e5ff", canvas.height / 400, 20, 2); 
      drawTrace(throttleData, "#00ff00", canvas.height / 300, 10, 1.5); 
      drawTrace(brakeData, "#ff2a2a", canvas.height / 300, 10, 1.5); 

      const scanX = canvas.width - 20;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, canvas.height);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  return (
    <section className="py-24 relative overflow-hidden bg-black border-t border-zinc-900" id="telemetry">
      <div className="absolute inset-0 bg-radial-gradient from-[var(--telemetry-purple)]/5 to-transparent blur-[150px] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/3"
          >
            <div className="flex items-center gap-3 mb-6">
               <div className="w-3 h-3 bg-[var(--telemetry-blue)] shadow-[0_0_10px_var(--telemetry-blue)] animate-pulse" />
               <span className="font-mono text-zinc-500 uppercase tracking-widest text-sm">Live Feed</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-white uppercase tracking-tighter">
              Absolute<br/>Precision
            </h2>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed mb-8 border-l border-zinc-800 pl-4">
              Visualizing over 100,000 data points per session. Our custom canvas renderer ensures that every brake trace, throttle lift, and gear shift is plotted instantly without blocking the main thread.
            </p>
            
            <div className="space-y-3 font-mono text-xs uppercase text-zinc-500">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Update Rate</span>
                <span className="text-white">60 Hz</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Channels Rendered</span>
                <span className="text-white">12+</span>
              </div>
              <div className="flex justify-between pb-2">
                <span>DOM Thrashing</span>
                <span className="text-[var(--telemetry-green)]">0%</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-2/3 h-[500px] bg-[#050505] border border-zinc-800 relative rounded-md overflow-hidden shadow-2xl shadow-black"
          >
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 font-mono text-[10px] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <span className="w-3 h-[2px] bg-[var(--telemetry-blue)] shadow-[0_0_5px_var(--telemetry-blue)]" /> SPEED (KPH)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-[2px] bg-[var(--telemetry-green)] shadow-[0_0_5px_var(--telemetry-green)]" /> THROTTLE (%)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-[2px] bg-[var(--telemetry-red)] shadow-[0_0_5px_var(--telemetry-red)]" /> BRAKE (%)
              </div>
            </div>

            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute top-4 right-4 z-10 border border-zinc-700 bg-black/50 hover:bg-zinc-800 text-zinc-400 px-3 py-1 font-mono text-xs uppercase cursor-pointer transition-colors"
            >
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>

            <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-zinc-600 pointer-events-none" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-zinc-600 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-zinc-600 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-zinc-600 pointer-events-none" />

            <canvas ref={canvasRef} className="w-full h-full block" />
            
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
