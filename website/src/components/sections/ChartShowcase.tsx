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

      // Technical Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.height; i += Math.floor(canvas.height / 8)) {
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
      }
      for (let i = 0; i < canvas.width; i += Math.floor(canvas.width / 12)) {
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

      const drawTrace = (data: Float32Array, color: string, scale: number, yOffset: number, lineW: number) => {
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
      };

      // Draw Traces
      drawTrace(speedData, "#00e5ff", canvas.height / 500, canvas.height * 0.1, 2); 
      drawTrace(throttleData, "#00ff00", canvas.height / 400, canvas.height * 0.05, 1.5); 
      drawTrace(brakeData, "#ff2a2a", canvas.height / 400, canvas.height * 0.05, 1.5); 

      // Data Readout Overlay (simulating hovering over the latest point)
      const lastSpeed = speedData[dataPoints - 1].toFixed(1);
      const lastThrottle = throttleData[dataPoints - 1].toFixed(0);
      const lastBrake = brakeData[dataPoints - 1].toFixed(0);
      
      const scanX = canvas.width - 40;
      
      // Vertical Scanline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point Highlights
      const speedY = canvas.height - (speedData[dataPoints - 1] * (canvas.height / 500) + canvas.height * 0.1);
      const throttleY = canvas.height - (throttleData[dataPoints - 1] * (canvas.height / 400) + canvas.height * 0.05);
      const brakeY = canvas.height - (brakeData[dataPoints - 1] * (canvas.height / 400) + canvas.height * 0.05);

      const drawPoint = (x: number, y: number, color: string) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#000";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      };

      drawPoint(scanX, speedY, "#00e5ff");
      drawPoint(scanX, throttleY, "#00ff00");
      drawPoint(scanX, brakeY, "#ff2a2a");

      // Floating Data Box
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(scanX - 110, canvas.height - 80, 100, 70);
      ctx.strokeRect(scanX - 110, canvas.height - 80, 100, 70);
      
      ctx.font = "10px monospace";
      ctx.fillStyle = "#00e5ff";
      ctx.fillText(`SPD: ${lastSpeed} kph`, scanX - 100, canvas.height - 60);
      ctx.fillStyle = "#00ff00";
      ctx.fillText(`THR: ${lastThrottle} %`, scanX - 100, canvas.height - 45);
      ctx.fillStyle = "#ff2a2a";
      ctx.fillText(`BRK: ${lastBrake} %`, scanX - 100, canvas.height - 30);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  return (
    <section className="py-24 relative overflow-hidden bg-black border-t border-zinc-900" id="telemetry">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(0,229,255,0.05)_0%,transparent_50%)] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/3 panel-border p-6 bg-black"
          >
            <div className="flex items-center gap-3 mb-6">
               <div className="w-3 h-3 bg-[var(--telemetry-blue)] shadow-[0_0_10px_var(--telemetry-blue)] animate-pulse" />
               <span className="font-mono text-[var(--telemetry-blue)] uppercase tracking-widest text-[10px] font-bold">STREAM_ACTIVE</span>
            </div>
            
            <h2 className="text-4xl font-black mb-6 text-white uppercase tracking-tighter">
              Engineered<br/>To Plot
            </h2>
            <p className="text-zinc-400 font-mono text-xs leading-relaxed mb-8 border-l-2 border-zinc-800 pl-4">
              Visualizing over <span className="text-white">100,000 data points</span> per session. Our custom canvas renderer ensures that every brake trace, throttle lift, and gear shift is plotted instantly without blocking the main thread.
            </p>
            
            <div className="space-y-4 font-mono text-[10px] uppercase text-zinc-500">
              <div className="flex justify-between border-b border-zinc-900 pb-2 items-center group">
                <span className="group-hover:text-white transition-colors">Render Loop</span>
                <span className="text-white bg-zinc-900 px-2 py-1">requestAnimationFrame</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2 items-center group">
                <span className="group-hover:text-white transition-colors">Target Ticker</span>
                <span className="text-[var(--telemetry-green)] bg-zinc-900 px-2 py-1">60 Hz</span>
              </div>
              <div className="flex justify-between items-center group">
                <span className="group-hover:text-white transition-colors">Memory Allocation</span>
                <span className="text-[var(--telemetry-yellow)] bg-zinc-900 px-2 py-1">Float32Array</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-2/3 h-[500px] bg-[#050505] border border-zinc-800 relative overflow-hidden shadow-2xl shadow-black panel-border"
          >
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 font-mono text-[10px] uppercase tracking-widest">
              <div className="flex items-center gap-2 bg-black/80 px-2 py-1 border border-zinc-800">
                <span className="w-3 h-[2px] bg-[var(--telemetry-blue)] shadow-[0_0_5px_var(--telemetry-blue)]" /> SPEED (KPH)
              </div>
              <div className="flex items-center gap-2 bg-black/80 px-2 py-1 border border-zinc-800">
                <span className="w-3 h-[2px] bg-[var(--telemetry-green)] shadow-[0_0_5px_var(--telemetry-green)]" /> THROTTLE (%)
              </div>
              <div className="flex items-center gap-2 bg-black/80 px-2 py-1 border border-zinc-800">
                <span className="w-3 h-[2px] bg-[var(--telemetry-red)] shadow-[0_0_5px_var(--telemetry-red)]" /> BRAKE (%)
              </div>
            </div>

            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute top-4 right-4 z-10 border border-[var(--telemetry-green)] bg-black/80 hover:bg-[#002200] text-[var(--telemetry-green)] px-4 py-1.5 font-mono text-[10px] uppercase cursor-pointer transition-colors font-bold tracking-widest"
            >
              {isPlaying ? 'PAUSE_STREAM' : 'PLAY_STREAM'}
            </button>

            {/* Corner Bracket decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-zinc-600 pointer-events-none" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-zinc-600 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-zinc-600 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-zinc-600 pointer-events-none" />

            <canvas ref={canvasRef} className="w-full h-full block" />
            
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
