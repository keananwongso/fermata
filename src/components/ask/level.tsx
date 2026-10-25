"use client";
// Five small bars that move with the voice: the microphone while someone speaks, the answer while it plays. Read
// once a frame from voice.ts, like the orb. The case room's voice answer and the dock's listening bubble use it.
import { useEffect, useRef } from "react";
import { voiceLevel } from "./voice";

const SHAPE = [0.55, 0.85, 1, 0.8, 0.5];

export function LevelBars({ active, white = false, className = "" }: { active: boolean; white?: boolean; className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (!active) { bars.current.forEach((b) => b && (b.style.transform = "scaleY(0.25)")); return; }
    let raf = 0, level = 0;
    const tick = (t: number) => {
      level += (voiceLevel() - level) * 0.35;
      bars.current.forEach((b, i) => {
        if (!b) return;
        const wobble = 0.75 + 0.25 * Math.sin(t / 140 + i * 1.7);
        b.style.transform = `scaleY(${Math.max(0.25, Math.min(1, level * 1.6 * SHAPE[i] * wobble + 0.18))})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return (
    <span aria-hidden className={`inline-flex h-4 items-center gap-[3px] ${className}`}>
      {SHAPE.map((_, i) => (
        <span key={i} ref={(el) => { bars.current[i] = el; }} className={`h-full w-[3px] origin-center scale-y-25 rounded-full ${white ? "bg-white" : "bg-accent"} transition-transform duration-75`} />
      ))}
    </span>
  );
}
