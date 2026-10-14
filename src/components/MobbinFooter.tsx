"use client";

import { useEffect, useRef, useState } from "react";

const LETTERS = ["Q", "U", "A", "N", "T", "U", "M"];

export function MobbinFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!footerRef.current) return;
      const rect = footerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Start calculating as footer enters the bottom of the viewport
      if (rect.top < windowHeight) {
        const visibleHeight = windowHeight - rect.top;
        // Total distance for full reveal animation across scroll
        const totalDistance = rect.height + windowHeight * 0.35;
        const progress = Math.min(Math.max(visibleHeight / totalDistance, 0), 1);
        setRevealProgress(progress);
      } else {
        setRevealProgress(0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className="mobbin-footer relative overflow-hidden text-[#E3DFCE] pt-16 pb-20 px-6 sm:px-12 mt-20 transition-all duration-700"
      style={{
        // Smooth luxury gradient that transitions seamlessly from the canvas into the grounding Merlot base
        background: "linear-gradient(180deg, rgba(220, 230, 238, 0.45) 0%, #2A090E 16%, #180507 100%)",
        borderTop: "1.5px solid rgba(76, 5, 12, 0.25)",
        boxShadow: "0 -20px 40px -10px rgba(76, 5, 12, 0.12)",
      }}
    >
      <div className="mx-auto max-w-[1760px] relative z-10 flex flex-wrap items-center justify-between gap-6 text-[12.5px]">
        <div className="flex items-center gap-6">
          <span className="font-extrabold text-[#E3DFCE] tracking-tight">© Quantum 2018–2026.</span>
          <span className="hidden sm:inline text-[#94B1C8]/80 text-[12px]">
            Tax Automation Engine · Maximum Vapor Inc.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-[#E3DFCE]/90">
          <a href="/guide" className="hover:text-white transition-colors">Documentation</a>
          <a href="/portals" className="hover:text-white transition-colors">Portals</a>
          <a href="/config" className="hover:text-white transition-colors">Excise Rates</a>
          <a href="/audit" className="hover:text-white transition-colors">Audit Trail</a>
          <span className="text-[#E3DFCE]/30">|</span>
          <span className="text-[#94B1C8] text-[11px] font-semibold">Pantone 19-1534 TCX Merlot & 13-4306 TCX Ice Melt</span>
        </div>
      </div>

      {/* Mobbin-style Letter-by-Letter Watermark Reveal with Red & Light Red Shades and Pinstripe Lines */}
      <div className="pointer-events-none select-none relative -mb-8 mt-12 flex justify-center items-center overflow-hidden">
        <div className="flex justify-center items-center gap-1 sm:gap-2.5 tracking-tighter uppercase font-sans font-black">
          {LETTERS.map((letter, i) => {
            // Stagger reveal for each letter across the scroll range
            const stepStart = (i / LETTERS.length) * 0.65;
            const stepEnd = stepStart + 0.35;
            const letterT = Math.min(Math.max((revealProgress - stepStart) / (stepEnd - stepStart), 0), 1);
            
            // Smooth sine curve easing
            const eased = Math.sin((letterT * Math.PI) / 2);
            // Clearly visible and vibrant as requested by the user
            const opacity = Math.max(eased * 0.9, 0.04);
            const translateY = (1 - eased) * 55;
            const scale = 0.85 + eased * 0.15;

            return (
              <span
                key={i}
                className="inline-block transition-transform duration-150 ease-out"
                style={{
                  fontSize: "clamp(64px, 15vw, 210px)",
                  lineHeight: 0.82,
                  opacity,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  backgroundImage: "linear-gradient(180deg, #F06A78 0%, #B81324 45%, #4C050C 95%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 4px 18px rgba(184, 19, 36, ${eased * 0.4}))`,
                }}
              >
                {letter}
              </span>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
