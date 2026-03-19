"use client";
import { useEffect, useRef, useState } from "react";

const F1_ACRONYMS = ["DRS", "SECTOR", "LAP", "PIT", "FLAG", "SC", "VSC"];
const F1_LETTERS = Array.from(new Set(F1_ACRONYMS.join(""))).join("");
const HEX_CODES = "0123456789ABCDEF";
const CHARS = F1_LETTERS + HEX_CODES;

interface ScrambleTextProps {
  text: string;
  className?: string;
  speed?: number; // ms per frame
  scrambles?: number; // number of scrambles before settling
}

export function ScrambleText({ text, className, speed = 50, scrambles = 10 }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const charStatesRef = useRef<Array<{
    original: string;
    display: string;
    state: 'initial' | 'scrambling' | 'settling' | 'settled';
    progress: number;
    targetTime: number;
  }>>([]);

  // Handle prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);
      setReducedMotion(mediaQuery.matches);
      mediaQuery.addEventListener("update", updateReducedMotion);
      return () => mediaQuery.removeEventListener("update", updateReducedMotion);
    }
  }, []);

  // Get scroll progress from Lenis or fallback
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cleanup: () => void;
    if ((window as any).lenis) {
      const handleLenisScroll = () => {
        const scrollY = (window as any).lenis.scroll;
        const height = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        ) - window.innerHeight;
        const progress = scrollY > 0 && height > 0 ? scrollY / height : 0;
        setScrollProgress(Math.min(1, Math.max(0, progress)));
      };
      (window as any).lenis.on("scroll", handleLenisScroll);
      cleanup = () => (window as any).lenis.off("scroll", handleLenisScroll);
    } else {
      // Fallback to scroll event listener
      const handleScroll = () => {
        const scrollY = window.scrollY;
        const height = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        ) - window.innerHeight;
        const progress = scrollY > 0 && height > 0 ? scrollY / height : 0;
        setScrollProgress(Math.min(1, Math.max(0, progress)));
      };
      window.addEventListener("scroll", handleScroll);
      cleanup = () => window.removeEventListener("scroll", handleScroll);
    }
    return cleanup;
  }, []);

  // Initialize character states
  useEffect(() => {
    if (text && !isInitialized) {
      const states = text.split('').map(char => ({
        original: char,
        display: char,
        state: 'initial' as const,
        progress: 0,
        targetTime: Date.now() + Math.random() * 1000
      }));
      charStatesRef.current = states;
      setIsInitialized(true);
    }
  }, [text, isInitialized]);

  // Update display text based on scroll progress and reduced motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const visualMode = Boolean(
        (window as { __TELEMETRYX_VISUAL_TEST__?: boolean })
          .__TELEMETRYX_VISUAL_TEST__
      );
      if (visualMode) {
        setDisplayText(text);
        return;
      }

      if (reducedMotion) {
        setDisplayText(text);
        return;
      }

      if (!isInitialized) {
        setDisplayText(text);
        return;
      }

      const states = charStatesRef.current;
      const settledCount = Math.min(
        text.length,
        Math.floor(scrollProgress * text.length)
      );

      // Update each character based on its position and scroll progress
      states.forEach((state, index) => {
        if (state.original === " " || state.original === "\n") {
          // Keep spaces and newlines as is
          state.display = state.original;
          state.state = 'settled';
          return;
        }

        if (index < settledCount) {
          // This character should be settled based on scroll progress
          if (state.state !== 'settled') {
            state.state = 'settling';
            state.progress = Math.min(1, state.progress + 0.05);
            
            if (state.progress >= 1) {
              state.state = 'settled';
              state.display = state.original;
              state.progress = 1;
            } else {
              // During settling, occasionally show original character
              if (Math.random() > 0.7) {
                state.display = state.original;
              } else {
                state.display = CHARS[Math.floor(Math.random() * CHARS.length)];
              }
            }
          }
        } else {
          // This character should still be scrambling
          if (state.state === 'settled' || state.state === 'settling') {
            // Reset to scrambling if we scrolled back
            state.state = 'scrambling';
            state.progress = 0;
          }
          
          if (state.state === 'scrambling' || state.state === 'initial') {
            state.state = 'scrambling';
            
            // Update progress toward target time
            const now = Date.now();
            if (now >= state.targetTime) {
              state.targetTime = now + Math.random() * 1000 + 500;
              state.progress = 0;
            } else {
              state.progress = (now - (state.targetTime - Math.random() * 1000 - 500)) / (Math.random() * 1000 + 500);
              state.progress = Math.min(1, Math.max(0, state.progress));
            }
            
            // Scramble based on progress - more structured scrambling
            if (state.progress < 0.3) {
              // Early stage: mostly hex codes
              state.display = HEX_CODES[Math.floor(Math.random() * HEX_CODES.length)];
            } else if (state.progress < 0.6) {
              // Middle stage: mix of hex and F1 letters
              if (Math.random() > 0.5) {
                state.display = HEX_CODES[Math.floor(Math.random() * HEX_CODES.length)];
              } else {
                state.display = F1_LETTERS[Math.floor(Math.random() * F1_LETTERS.length)];
              }
            } else {
              // Late stage: mostly F1 letters, occasional hex
              if (Math.random() > 0.8) {
                state.display = HEX_CODES[Math.floor(Math.random() * HEX_CODES.length)];
              } else {
                state.display = F1_LETTERS[Math.floor(Math.random() * F1_LETTERS.length)];
              }
            }
          }
        }
      });

      // Update display text
      const newDisplayText = states.map(state => state.display).join('');
      setDisplayText(newDisplayText);
    }
  }, [scrollProgress, text, reducedMotion, isInitialized]);

  return (
    <span ref={ref} className={className} style={{ whiteSpace: "pre-line" }}>
      {displayText}
    </span>
  );
}