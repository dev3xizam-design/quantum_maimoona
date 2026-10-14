import Image from "next/image";

export function Logo({ size = 34, showWordmark = false }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="relative flex items-center justify-center flex-none">
      <Image
        src="/brand/q-logo.png"
        alt="Quantum"
        width={128}
        height={128}
        priority
        className="object-contain drop-shadow-sm transition-transform duration-200 hover:scale-105"
        style={{ height: size, width: size }}
      />
    </div>
  );
}
