"use client";

import { useEffect, useRef, useState } from "react";

export function MobbinFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!footerRef.current) return;
      const rect = footerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // When the footer enters the viewport from the bottom
      if (rect.top < windowHeight) {
        // Calculate progress: 0 when top of footer just touches bottom of viewport,
        // to 1 when footer is fully visible in viewport
        const visibleHeight = windowHeight - rect.top;
        const progress = Math.min(Math.max(visibleHeight / (rect.height * 0.85), 0), 1);
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

  // Opacity smoothly increases from 0 to 0.07
  const watermarkOpacity = revealProgress * 0.07;
  // Translate smoothly slides up as you scroll to the end
  const watermarkTranslateY = (1 - revealProgress) * 45;

  return (
    <footer
      ref={footerRef}
      className="mobbin-footer relative overflow-hidden bg-[#1A0905] text-[#94B1C8] pt-14 pb-20 px-6 sm:px-12 border-t border-[rgba(227,223,206,0.12)] mt-16 transition-colors duration-500"
    >
      <div className="mx-auto max-w-[1760px] relative z-10 flex flex-wrap items-center justify-between gap-6 text-[12.5px]">
        <div className="flex items-center gap-6">
          <span className="font-bold text-[#E3DFCE] tracking-tight">© Quantum 2018–2026.</span>
          <span className="hidden sm:inline text-[#94B1C8]/60 text-[12px]">
            Tax Automation Engine · Maximum Vapor Inc.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-[#E3DFCE]/80">
          <a href="/guide" className="hover:text-white transition-colors">Documentation</a>
          <a href="/portals" className="hover:text-white transition-colors">Portals</a>
          <a href="/config" className="hover:text-white transition-colors">Excise Rates</a>
          <a href="/audit" className="hover:text-white transition-colors">Audit Trail</a>
          <span className="text-[#E3DFCE]/20">|</span>
          <span className="text-[#94B1C8]/70 text-[11px]">Pantone 19-1534 TCX Merlot & 13-4306 TCX Ice Melt</span>
        </div>
      </div>

      {/* Giant Mobbin.com style brand watermark that ONLY slowly reveals when scrolled to the end */}
      <div className="pointer-events-none select-none relative -mb-12 mt-10 flex justify-center overflow-hidden">
        <span
          className="font-black tracking-tighter uppercase font-sans text-center transition-all duration-300 ease-out"
          style={{
            fontSize: "clamp(80px, 16vw, 240px)",
            lineHeight: 0.82,
            color: "#E3DFCE",
            opacity: watermarkOpacity,
            transform: `translateY(${watermarkTranslateY}px)`,
          }}
        >
          Quantum
        </span>
      </div>
    </footer>
  );
}
