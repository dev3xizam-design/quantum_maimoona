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

      // Start calculating as footer enters the viewport
      // The animation spans across the entire scrolling travel through the footer
      const startPoint = windowHeight * 0.9;
      const endPoint = windowHeight - rect.height + 60;
      const totalDistance = startPoint - endPoint;

      if (rect.top <= startPoint) {
        const scrolled = startPoint - rect.top;
        const progress = Math.min(Math.max(scrolled / (totalDistance || 1), 0), 1);
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
      className="mobbin-footer relative overflow-hidden bg-[#1A0905] text-[#E3DFCE] pt-14 pb-20 px-6 sm:px-12 border-t border-[rgba(227,223,206,0.12)] mt-16 transition-colors duration-500"
    >
      <div className="mx-auto max-w-[1760px] relative z-10 flex flex-wrap items-center justify-between gap-6 text-[12.5px]">
        <div className="flex items-center gap-6">
          <span className="font-extrabold text-[#E3DFCE] tracking-tight">© Quantum 2018–2026.</span>
          <span className="hidden sm:inline text-[#94B1C8]/70 text-[12px]">
            Tax Automation Engine · Maximum Vapor Inc.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-[#E3DFCE]/80">
          <a href="/guide" className="hover:text-white transition-colors">Documentation</a>
          <a href="/portals" className="hover:text-white transition-colors">Portals</a>
          <a href="/config" className="hover:text-white transition-colors">Excise Rates</a>
          <a href="/audit" className="hover:text-white transition-colors">Audit Trail</a>
          <span className="text-[#E3DFCE]/25">|</span>
          <span className="text-[#94B1C8]/80 text-[11px] font-semibold">Pantone 19-1534 TCX Merlot & 13-4306 TCX Ice Melt</span>
        </div>
      </div>

      {/* Mobbin-style Letter-by-Letter Watermark Reveal:
          Letters (Q - U - A - N - T - U - M) emerge sequentially one by one as you scroll down */}
      <div className="pointer-events-none select-none relative -mb-8 mt-12 flex justify-center items-center overflow-hidden min-h-[140px] sm:min-h-[180px] lg:min-h-[220px]">
        <div className="flex justify-center items-center gap-1 sm:gap-2 tracking-tighter uppercase font-sans font-black">
          {LETTERS.map((letter, i) => {
            // Sequential stagger: each letter has its own dedicated scroll window
            // Q starts at 0.05, U at 0.18, A at 0.32, N at 0.46, T at 0.60, U at 0.74, M at 0.86
            const letterWindow = 0.22;
            const stepStart = 0.05 + i * 0.12;
            const stepEnd = stepStart + letterWindow;
            
            const rawProgress = Math.min(Math.max((revealProgress - stepStart) / letterWindow, 0), 1);
            // Smooth ease out per letter
            const eased = Math.sin((rawProgress * Math.PI) / 2);
            
            // True letter-by-letter reveal: stays 0 until its turn, then rises to elegant maroon tone
            const opacity = eased * 0.85;
            const translateY = (1 - eased) * 50;
            const scale = 0.88 + eased * 0.12;

            return (
              <span
                key={i}
                className="inline-block transition-all duration-200 ease-out"
                style={{
                  fontSize: "clamp(64px, 15vw, 210px)",
                  lineHeight: 0.82,
                  opacity,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  // Luxury Merlot to Wine Red gradient blending seamlessly with brand colors
                  backgroundImage: "linear-gradient(180deg, #8A1522 0%, #630C16 50%, #4C050C 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 4px 14px rgba(76, 5, 12, ${eased * 0.45}))`,
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
