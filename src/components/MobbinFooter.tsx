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
      const startPoint = windowHeight * 0.95;
      const endPoint = windowHeight - rect.height + 40;
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
      className="mobbin-footer relative overflow-hidden bg-[#3F040A] text-[#E3DFCE] pt-14 pb-0 px-6 sm:px-12 border-t border-[rgba(227,223,206,0.14)] mt-16 transition-colors duration-500"
    >
      <div className="mx-auto max-w-[1760px] relative z-10 flex flex-wrap items-center justify-between gap-6 text-[12.5px] pb-10">
        <div className="flex items-center gap-6">
          <span className="font-extrabold text-[#E3DFCE] tracking-tight">© Quantum 2018–2026.</span>
          <span className="hidden sm:inline text-[#E3DFCE]/60 text-[12px]">
            Tax Automation Engine · Maximum Vapor Inc.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-[#E3DFCE]/80">
          <a href="/guide" className="hover:text-white transition-colors">Documentation</a>
          <a href="/portals" className="hover:text-white transition-colors">Portals</a>
          <a href="/config" className="hover:text-white transition-colors">Excise Rates</a>
          <a href="/audit" className="hover:text-white transition-colors">Audit Trail</a>
          <span className="text-[#E3DFCE]/25">|</span>
          <span className="text-[#E3DFCE]/70 text-[11px] font-semibold">Pantone 19-1534 TCX Merlot & 13-4306 TCX Ice Melt</span>
        </div>
      </div>

      {/* Mobbin-style Giant Watermark:
          Positioned at the very bottom edge, submerged so only the top half is showing (like Mobbin).
          Letters (Q - U - A - N - T - U - M) emerge sequentially letter-by-letter on scroll
          in a lighter tone of the #3F040A background (#7E1925), exactly like Mobbin's tone-on-tone */}
      <div className="pointer-events-none select-none relative flex justify-center items-end overflow-hidden w-full">
        <div className="flex justify-center items-end tracking-tighter uppercase font-sans font-black">
          {LETTERS.map((letter, i) => {
            // Stagger reveal for each letter across the scroll range
            const letterWindow = 0.22;
            const stepStart = 0.05 + i * 0.11;
            
            const rawProgress = Math.min(Math.max((revealProgress - stepStart) / letterWindow, 0), 1);
            const eased = Math.sin((rawProgress * Math.PI) / 2);

            // Slides up from 100% (hidden below bottom edge) to 35% (half showing at bottom edge, exactly like Mobbin)
            const translateY = 100 - (eased * 65);
            const opacity = Math.max(eased, 0.02);

            return (
              <span
                key={i}
                className="inline-block transition-transform duration-150 ease-out font-black"
                style={{
                  fontSize: "clamp(80px, 18vw, 250px)",
                  lineHeight: 0.8,
                  opacity,
                  transform: `translateY(${translateY}%)`,
                  color: "#7E1925", // Lighter shade of the #3F040A background
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
