export function Logo({ size = 36 }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="relative flex items-center justify-center flex-none" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/quantum-mark-transparent.png?v=20261015_clean"
        alt="Quantum"
        width={size}
        height={size}
        className="object-contain transition-transform duration-200 hover:scale-105 pointer-events-none select-none"
        style={{ width: size, height: size, background: "transparent" }}
      />
    </div>
  );
}
