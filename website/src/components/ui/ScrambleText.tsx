"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':,./<>?";

interface ScrambleTextProps {
  text: string;
  className?: string;
  speed?: number; // ms per frame
  scrambles?: number; // number of scrambles before settling
}

export function ScrambleText({ text, className, speed = 50, scrambles = 10 }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  
  useEffect(() => {
    if (!isInView) return;
    if (typeof window !== "undefined") {
      const visualMode = Boolean((window as { __TELEMETRYX_VISUAL_TEST__?: boolean }).__TELEMETRYX_VISUAL_TEST__)
      if (visualMode) {
        setDisplayText(text)
        return
      }
    }
    
    let frame = 0;
    const interval = setInterval(() => {
      if (frame >= text.length * scrambles) {
        clearInterval(interval);
        setDisplayText(text);
        return;
      }
      
      let scrambled = "";
      for (let i = 0; i < text.length; i++) {
        // Character is done scrambling
        if (frame > i * scrambles) {
          scrambled += text[i];
        } else {
          // Keep scrambling
          if (text[i] === " " || text[i] === "\n") scrambled += text[i];
          else scrambled += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      
      setDisplayText(scrambled);
      frame++;
    }, speed);

    return () => clearInterval(interval);
  }, [isInView, text, speed, scrambles]);

  return (
    <span ref={ref} className={className} style={{ whiteSpace: 'pre-line' }}>
      {displayText}
    </span>
  );
}
