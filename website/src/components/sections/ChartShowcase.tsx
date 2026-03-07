"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from "framer-motion";

const generateData = () => {
  return Array.from({ length: 50 }).map((_, i) => ({
    time: i,
    speed: 100 + Math.sin(i / 5) * 150 + Math.random() * 20,
    throttle: Math.max(0, Math.sin(i / 4) * 100 + Math.random() * 10),
  }));
};

export function ChartShowcase() {
  const [data, setData] = useState(generateData());

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prevData) => {
        const newTime = prevData[prevData.length - 1].time + 1;
        const newData = {
          time: newTime,
          speed: 100 + Math.sin(newTime / 5) * 150 + Math.random() * 20,
          throttle: Math.max(0, Math.sin(newTime / 4) * 100 + Math.random() * 10),
        };
        return [...prevData.slice(1), newData];
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden" id="features">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gradient">
              Live Telemetry Traces
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Experience zero-latency data visualization. Every brake, throttle application, and speed trace is plotted exactly as it happens on track.
            </p>
            
            <ul className="space-y-4">
              {['Ultra-low latency < 2ms', '60-90 FPS sustained rendering', 'Synchronized multi-channel plotting'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 text-primary text-xs font-bold">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full h-[400px] glass-panel rounded-2xl p-6 relative"
          >
            <div className="absolute top-4 left-6 z-10 flex gap-4">
              <span className="text-primary font-mono text-sm uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Speed (kph)
              </span>
              <span className="text-purple-sector font-mono text-sm uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-sector" /> Throttle (%)
              </span>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 40, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <YAxis hide domain={[0, 350]} />
                <Line 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="var(--primary)" 
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="throttle" 
                  stroke="var(--purple-sector)" 
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
