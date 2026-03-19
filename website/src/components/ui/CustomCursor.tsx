"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugins
useEffect(() => {
  gsap.registerPlugin(ScrollTrigger);
}, []);

export function CustomCursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  // Refs for cursor elements
  const cursorRef = useRef(null);
  const cursorInnerRef = useRef(null);
  
  // Magnetic cursor refs
  const magneticElements = useRef<
    Map<HTMLElement, { timeoutId: ReturnType<typeof setTimeout> | null }>
  >(new Map());
  
  // Glitch trail refs
  const glitchTrails = useRef<Array<HTMLDivElement>>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Handle magnetic cursor effect
      if (!prefersReducedMotion) {
        handleMagneticEffect(e);
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "A" || 
        target.tagName === "BUTTON" || 
        target.closest("button") || 
        target.closest("a") ||
        target.classList.contains("hover-trigger")
      ) {
        setIsHovering(true);
        
        // Initialize magnetic effect for this element
        if (!prefersReducedMotion) {
          initMagneticElement(target);
        }
      } else {
        setIsHovering(false);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "A" || 
        target.tagName === "BUTTON" || 
        target.closest("button") || 
        target.closest("a") ||
        target.classList.contains("hover-trigger")
      ) {
        setIsHovering(false);
        
        // Reset magnetic effect for this element
        if (!prefersReducedMotion) {
          resetMagneticElement(target);
        }
      }
    };

    window.addEventListener("mousemove", updateMousePosition);
    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("mouseout", handleMouseOut);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("mouseout", handleMouseOut);
      
      // Clean up magnetic elements
      magneticElements.current.forEach((data, element) => {
        resetMagneticElement(element);
        if (data.timeoutId) clearTimeout(data.timeoutId);
      });
      magneticElements.current.clear();
    };
  }, [prefersReducedMotion]);

  // Scroll progress and velocity effect for glitch trail - using Lenis
  useEffect(() => {
    // Create a ScrollTrigger to get scroll progress
    const scrollTrigger = ScrollTrigger.create({
      trigger: "body",
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        setScrollProgress(self.progress);
      }
    });

    // Get scroll velocity from Lenis
    const updateScrollVelocity = () => {
      // Access Lenis instance from window (set by SmoothScrolling component)
      const lenis = (window as any).lenis;
      if (lenis) {
        setScrollVelocity(lenis.velocity?.y ?? 0);
      }
    };

    // Update velocity on Lenis scroll
    const handleLenisScroll = () => {
      updateScrollVelocity();
    };

    // Listen for Lenis scroll events
    if ((window as any).lenis) {
      (window as any).lenis.on("scroll", handleLenisScroll);
    }

    return () => {
      scrollTrigger.kill();
      // Remove Lenis scroll listener
      if ((window as any).lenis) {
        (window as any).lenis.off("scroll", handleLenisScroll);
      }
    };
  }, []);

  // Magnetic cursor effect handler - enhanced with physics-based snapping
  const handleMagneticEffect = useCallback((e: MouseEvent) => {
    if (prefersReducedMotion) return;
    
    const { clientX, clientY } = e;
    
    // Check if we're over a magnetic element
    let isOverMagnetic = false;
    magneticElements.current.forEach((_, element) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.sqrt(
        Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
      );
      
      // If within magnetic range, apply physics-based snapping effect
      if (distance < 120) { // Increased magnetic range for stronger effect
        isOverMagnetic = true;
        
        // Calculate magnetic force with distance-based falloff (physics-based)
        const magneticStrength = Math.max(0, (120 - distance) / 120) * 0.3;
        const offsetX = (centerX - clientX) * magneticStrength;
        const offsetY = (centerY - clientY) * magneticStrength;
        
        // Apply distortion via matrix3d for more realistic effect
        gsap.to(element, {
          duration: 0.4,
          ease: "elastic.out(1, 0.5)",
          transform: `matrix3d(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            ${offsetX}, ${offsetY}, 0, 1
          )`,
        });
      }
    });
    
    // If not over any magnetic element, reset any active distortions with physics-based easing
    if (!isOverMagnetic) {
      magneticElements.current.forEach((_, element) => {
        gsap.to(element, {
          duration: 0.6,
          ease: "elastic.out(1, 0.4)",
          transform: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
        });
      });
    }
  }, [prefersReducedMotion]);

  // Initialize magnetic element
  const initMagneticElement = useCallback((element: HTMLElement) => {
    if (prefersReducedMotion) return;
    
    // Store timeout ID for cleanup
    if (!magneticElements.current.has(element)) {
      magneticElements.current.set(element, {
        timeoutId: null
      });
    }
  }, [prefersReducedMotion]);

  // Reset magnetic element
  const resetMagneticElement = useCallback((element: HTMLElement) => {
    if (prefersReducedMotion) return;
    
    const data = magneticElements.current.get(element);
    if (data) {
      // Clear any existing timeout
      if (data.timeoutId) clearTimeout(data.timeoutId);
      
      // Reset transform with physics-based easing for smooth transition
      data.timeoutId = setTimeout(() => {
        gsap.to(element, {
          duration: 0.5,
          ease: "power3.out",
          transform: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
        });
        
        // Clear timeout after animation
        if (data.timeoutId) clearTimeout(data.timeoutId);
        data.timeoutId = null;
      }, 30);
    }
  }, [prefersReducedMotion]);

  // Create RGB-split glitch trail effect on rapid scroll
  useEffect(() => {
    const createGlitchTrail = () => {
      if (prefersReducedMotion) return;
      
      // Only create glitch trail on rapid scroll (high scroll velocity)
      // Using actual scroll velocity from Lenis
      const velocityThreshold = 1.0; // Minimum velocity to trigger glitch trail
      const velocityFactor = Math.min(Math.abs(scrollVelocity) / 5, 1); // Normalize velocity
      
      // Probability increases with scroll velocity
      const probability = 0.1 + (velocityFactor * 0.6); // 10% to 70% chance based on velocity
      
      if (Math.random() > probability) {
        return; // Skip creating trail based on velocity-adjusted probability
      }
      
      const trail = document.createElement("div");
      trail.className = "glitch-trail";
      trail.style.position = "fixed";
      trail.style.top = `${mousePosition.y}px`;
      trail.style.left = `${mousePosition.x}px`;
      trail.style.width = "2px";
      trail.style.height = "2px";
      trail.style.borderRadius = "50%";
      
      // RGB-split glitch effect
      trail.style.background = `
        linear-gradient(
          90deg,
          rgba(255, 0, 0, 0.6) 0%,
          rgba(255, 0, 0, 0) 30%,
          rgba(0, 255, 0, 0.6) 30%,
          rgba(0, 255, 0, 0) 60%,
          rgba(0, 0, 255, 0.6) 60%,
          rgba(0, 0, 255, 0) 100%
        )
      `;
      trail.style.pointerEvents = "none";
      trail.style.zIndex = "9999";
      trail.style.mixBlendMode = "difference";
      trail.style.opacity = "0.7";
      
      // Add slight random offset for glitch effect
      const offsetX = (Math.random() - 0.5) * 4;
      const offsetY = (Math.random() - 0.5) * 4;
      trail.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      
      document.body.appendChild(trail);
      
      glitchTrails.current.push(trail);
      
      // Animate and remove trail - duration and scale based on scroll velocity
      const baseDuration = 0.2;
      const baseScale = 2;
      const velocityInfluence = Math.min(Math.abs(scrollVelocity) / 3, 1);
      
      gsap.to(trail, {
        duration: baseDuration + (velocityInfluence * 0.3), // 0.2-0.5s based on velocity
        opacity: 0,
        scale: baseScale + (velocityInfluence * 2), // 2-4x scale based on velocity
        ease: "power2.in",
        onComplete: () => {
          if (trail.parentNode) {
            trail.parentNode.removeChild(trail);
          }
          // Remove from array
          const index = glitchTrails.current.indexOf(trail);
          if (index > -1) {
            glitchTrails.current.splice(index, 1);
          }
        }
      });
    };
    
    // Create trail based on scroll updates
    const handleScroll = () => {
      // Create trail based on actual scroll velocity
      createGlitchTrail();
    };
    
    window.addEventListener("scroll", handleScroll);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      // Clean up any remaining trails
      glitchTrails.current.forEach(trail => {
        if (trail.parentNode) {
          trail.parentNode.removeChild(trail);
        }
      });
      glitchTrails.current = [];
    };
  }, [mousePosition, scrollVelocity, prefersReducedMotion]);

  return (
    <>
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-[var(--telemetry-blue)] pointer-events-none z-[100] mix-blend-screen flex items-center justify-center"
      >
        <div
          ref={cursorInnerRef}
          className="w-1 h-1 bg-white rounded-full shadow-[0_0_10px_#fff]"
        />
      </div>
      
      {/* Reduced motion fallback */}
      {prefersReducedMotion && (
        <div
          className="fixed top-0 left-0 w-8 h-8 rounded-full border border-[var(--telemetry-blue)] pointer-events-none z-[100] mix-blend-screen flex items-center justify-center"
        >
          <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_10px_#fff]" />
        </div>
      )}
    </>
  );
}
