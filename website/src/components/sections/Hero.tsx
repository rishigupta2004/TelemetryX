"use client";
import { Button } from "@/components/ui/Button";
import { Download, Terminal } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ParticleTrack } from "../three/ParticleTrack";
import { ScrambleText } from "../ui/ScrambleText";
import { AppMockup } from "../ui/AppMockup";
import { SmoothScrolling } from "@/components/ui/SmoothScrolling";

function isVisualTestMode(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as { __TELEMETRYX_VISUAL_TEST__?: boolean }).__TELEMETRYX_VISUAL_TEST__);
}

function TypewriterEffect({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
    
  useEffect(() => {
    if (isVisualTestMode()) {
      setDisplayed(text);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text]);

  return <span className="font-mono text-[var(--telemetry-green)] text-glow whitespace-pre-line">{displayed}<span className="animate-pulse">_</span></span>;
}

export function Hero() {
  const copyRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

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
    let copyTween;
    let mockupTween;
    let scrollTween;

    // Initial animation for the copy
    if (!reduceMotion && copyRef.current) {
      copyTween = gsap.fromTo(copyRef.current, 
        { opacity: 0, x: -30 }, 
        { opacity: 1, x: 0, duration: 1, ease: [0.16, 1, 0.3, 1] }
      );
    } else if (copyRef.current) {
      // Set to final state immediately for reduced motion
      gsap.set(copyRef.current, { opacity: 1, x: 0 });
    }

    // Initial animation for the mockup
    if (!reduceMotion && mockupRef.current) {
      mockupTween = gsap.fromTo(mockupRef.current, 
        { opacity: 0, y: 100 }, 
        { opacity: 1, y: 0, duration: 1, delay: 0.5 }
      );
    } else if (mockupRef.current) {
      // Set to final state immediately for reduced motion
      gsap.set(mockupRef.current, { opacity: 1, y: 0 });
    }

    // Scroll-based animation for the copy
    if (!reduceMotion && copyRef.current) {
      scrollTween = gsap.to(copyRef.current, {
        y: 150,
        opacity: 0,
        scrollTrigger: {
          start: "top top",
          end: "+=500",
          scrub: true,
        },
      });
    }
    // If reduce motion, we skip this animation entirely (copy stays at initial position)

    // Cleanup
    return () => {
      const copyEl = copyRef.current;
      const mockupEl = mockupRef.current;
      gsap.killTweensOf(copyEl);
      gsap.killTweensOf(mockupEl);
      if (copyTween) copyTween.kill();
      if (mockupTween) mockupTween.kill();
      if (scrollTween) scrollTween.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [reduceMotion]);

  return (
    <SmoothScrolling>
      <section
        className="relative min-h-screen pt-32 pb-24 overflow-hidden flex flex-col items-center justify-center bg-black"
        data-home-section="hero"
      >
        <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
        <ParticleTrack />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] pointer-events-none opacity-80 z-10" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col lg:flex-row gap-12 items-center">
          
          <div
            data-hero-copy
            ref={copyRef}
            className="flex-1 w-full"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs font-mono uppercase tracking-widest text-zinc-400 mb-8 w-fit panel-border">
              <span className="w-1.5 h-1.5 bg-[var(--telemetry-red)] animate-pulse" /> LIVE TELEMETRY LINK ESTABLISHED
            </div>
            
            <h1 
              className="text-6xl md:text-8xl lg:text-[100px] font-black tracking-tighter mb-4 leading-[0.85] text-white glitch-hover relative inline-block cursor-default"
              data-text="RAW DATA."
            >
              <ScrambleText text="RAW DATA.\n" speed={20} scrambles={5} />
              <span className="text-zinc-600 block mt-2">
                <ScrambleText text="ZERO DELAY." speed={20} scrambles={10} />
              </span>
            </h1>
            
            <div className="text-sm md:text-base text-zinc-400 mb-10 max-w-xl font-mono leading-relaxed border-l-2 border-[var(--telemetry-blue)] pl-4 bg-zinc-900/30 py-4 pr-4 panel-border h-[120px]">
              <TypewriterEffect text="> INITIATING TELEMETRYX DESKTOP V1.0\n> CONNECTING TO FAST-PATH DUCKDB...\n> TARGET LATENCY: < 2MS\n> SYSTEM: READY." />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 font-mono">
              <Link href="/download" className="w-full sm:w-auto">
                <Button size="lg" className="w-full px-8 panel-border bg-white text-black hover:bg-zinc-200 uppercase tracking-widest font-bold text-xs h-12">
                  <Download className="mr-2 w-4 h-4" /> macOS .dmg
                </Button>
              </Link>
              <Link href="/download" className="w-full sm:w-auto">
                <Button size="lg" variant="terminal" className="w-full px-8 h-12">
                  <Terminal className="mr-2 w-4 h-4" /> Windows .exe
                </Button>
              </Link>
            </div>
          </div>
          
          <div
            data-hero-visual
            ref={mockupRef}
            className="w-full relative z-20 mt-12 px-6"
          >
            <AppMockup />
          </div>
        </div>
      </section>
    </SmoothScrolling>
  );
}
