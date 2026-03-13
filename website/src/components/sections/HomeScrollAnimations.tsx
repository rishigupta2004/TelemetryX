"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export function HomeScrollAnimations() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        gsap.set("[data-reveal-item], [data-pin-target], [data-stagger-item]", {
          clearProps: "all",
          opacity: 1,
        });
        return;
      }

      const sectionEntries: Array<[string, string]> = [
        ["hero", "[data-hero-copy], [data-hero-visual]"],
        ["app-preview", "[data-pin-target='app-preview'], [data-stagger-group='app-preview-callouts'] [data-stagger-item]"],
        ["feature-grid", "[data-reveal-item], [data-stagger-group='features'] [data-stagger-item]"],
        ["chart-showcase", "[data-reveal-item], [data-pin-target='chart-showcase']"],
        ["code-showcase", "[data-reveal-item], [data-pin-target='code-showcase']"],
        ["performance", "[data-stagger-group='metrics'] [data-stagger-item]"],
        ["footer", "[data-stagger-group='footer'] [data-stagger-item]"],
      ];

      sectionEntries.forEach(([sectionKey, selector]) => {
        const section = document.querySelector<HTMLElement>(`[data-home-section='${sectionKey}']`);
        if (!section) return;

        const targets = section.querySelectorAll<HTMLElement>(selector);
        if (!targets.length) return;

        gsap.fromTo(
          targets,
          { y: 32, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.8,
            ease: "power2.out",
            stagger: targets.length > 1 ? 0.1 : 0,
            scrollTrigger: {
              trigger: section,
              start: "top 78%",
              once: true,
            },
          }
        );
      });

      gsap.to("[data-home-section='hero'] [data-hero-visual]", {
        yPercent: -10,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-home-section='hero']",
          start: "top top",
          end: "bottom top",
          scrub: 0.5,
        },
      });

      const media = gsap.matchMedia();
      media.add("(min-width: 1024px)", () => {
        const pinnedSections: Array<[string, string]> = [
          ["app-preview", "[data-pin-target='app-preview']"],
          ["chart-showcase", "[data-pin-target='chart-showcase']"],
          ["code-showcase", "[data-pin-target='code-showcase']"],
        ];

        pinnedSections.forEach(([sectionKey, selector]) => {
          const section = document.querySelector<HTMLElement>(`[data-home-section='${sectionKey}']`);
          const pinTarget = section?.querySelector<HTMLElement>(selector);
          if (!section || !pinTarget) return;

          ScrollTrigger.create({
            trigger: section,
            start: "top top+=72",
            end: "+=26%",
            pin: pinTarget,
            pinSpacing: true,
            scrub: 0.2,
            anticipatePin: 1,
          });
        });

        ScrollTrigger.refresh();
      });

      return () => media.revert();
    },
    { scope: root }
  );

  return <div ref={root} className="hidden" aria-hidden="true" />;
}
