import Image from "next/image";

export function Logo({ size = 28, showWordmark = false }: { size?: number; showWordmark?: boolean }) {
  if (showWordmark) {
    return (
      <Image
        src="/brand/quantum-logo-600.png"
        alt="Quantum"
        width={600}
        height={225}
        priority
        style={{ height: size, width: "auto" }}
      />
    );
  }
  return (
    <Image
      src="/brand/quantum-mark-256.png"
      alt="Quantum"
      width={256}
      height={256}
      priority
      style={{ height: size, width: size }}
    />
  );
}
