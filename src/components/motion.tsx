"use client";
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Eases a number toward its latest value, so live Convex counters count instead of jumping.
export function useTween(target: number, ms = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    let raf = 0;
    if (start === target || reduced()) {
      raf = requestAnimationFrame(() => { from.current = target; setShown(target); });
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

export function Count({ value, format = (n) => String(n), round = true }: { value: number; format?: (n: number) => string; round?: boolean }) {
  const v = useTween(value);
  return <>{format(round ? Math.round(v) : v)}</>;
}

// False for whatever is on screen at first paint, true afterwards, so only rows that arrive later animate in.
export function useLive() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return live;
}

// Stepped brand-blue cells, concentrated at the outer edges and clearing toward a readable centre.
export function BrandGrid({ cols = 18, rows = 6, className = "" }: { cols?: number; rows?: number; className?: string }) {
  const cells: { x: number; y: number; o: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = Math.abs((x + 0.5) / cols - 0.5) * 2;
      const dy = Math.abs((y + 0.5) / rows - 0.5) * 2;
      const edge = Math.max(dx * 1.08, dy * 0.55) + (((x * 7 + y * 13) % 5) - 2) * 0.035;
      const step = edge > 0.94 ? 0.55 : edge > 0.84 ? 0.28 : edge > 0.72 ? 0.13 : edge > 0.6 ? 0.05 : 0;
      if (step) cells.push({ x, y, o: step });
    }
  }
  return (
    <svg aria-hidden viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" className={`pointer-events-none ${className}`}>
      <defs>
        <pattern id="og-lines" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0V1H0" fill="none" stroke="var(--color-hairline)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      {cells.map((c) => <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="1" height="1" fill="var(--color-accent)" fillOpacity={c.o} className="rise" style={{ animationDelay: `${Math.round((1 - c.o) * 400)}ms` }} />)}
      <rect width={cols} height={rows} fill="url(#og-lines)" />
    </svg>
  );
}
