"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import NumberFlow, { type Format } from "@number-flow/react";
import { AnimatePresence, motion, useInView, type Variants } from "motion/react";
import Lenis from "lenis";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scrolls the nearest scrolling box around an element to its end. Unlike scrollIntoView it never moves the page,
// so a transcript can follow its newest message while the reader stays where they are.
export function scrollBoxToEnd(el: HTMLElement | null) {
  let box = el?.parentElement ?? null;
  while (box && box !== document.body && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  if (!box || box === document.body) return;
  box.scrollTo({ top: box.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
}

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

// Digits roll to their value instead of counting through every number between. Starts from zero once on screen,
// so a headline figure arrives rather than appearing. Respects reduced motion on its own.
export function Roll({ value, format, prefix, suffix }: { value: number; format?: Format; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "-40px" });
  return (
    <span ref={ref} className="inline-block">
      <NumberFlow value={seen ? value : 0} locales="en-US" format={format} prefix={prefix} suffix={suffix} willChange
        transformTiming={{ duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }} spinTiming={{ duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }} />
    </span>
  );
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const riseIn: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE_OUT } },
};

// A group whose children rise in one after another the first time it scrolls into view.
export function Reveal({ children, className = "", stagger = 0.07, delay = 0 }: { children: ReactNode; className?: string; stagger?: number; delay?: number }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="shown" viewport={{ once: true, margin: "-60px" }}
      variants={{ shown: { transition: { staggerChildren: stagger, delayChildren: delay } } }}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={riseIn}>{children}</motion.div>;
}

// The brand mark alone on the canvas while the first data loads, then the whole screen fades into the page.
export function Splash() {
  return (
    <motion.div role="status" aria-label="Opening the books" className="fixed inset-0 z-[100] grid place-items-center bg-canvas"
      exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
      <motion.div className="card grid size-24 place-items-center rounded-[22px]"
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.06 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
        <span className="breathe text-[60px] leading-none" style={{ fontFamily: "var(--font-music)", transform: "translateY(0.28em)" }} aria-hidden>𝄐</span>
      </motion.div>
    </motion.div>
  );
}

let arrived = false;

// The splash on arrival: once per visit, on the first page opened. The page waits underneath, hidden, so its
// own entrance plays as the splash fades instead of finishing behind it. Later navigations skip it.
export function Arrival({ children, ms = 900 }: { children: ReactNode; ms?: number }) {
  const [splash, setSplash] = useState(() => !arrived);
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => { arrived = true; setSplash(false); }, ms);
    return () => clearTimeout(t);
  }, [splash, ms]);
  return (
    <>
      <AnimatePresence>{splash ? <Splash key="splash" /> : null}</AnimatePresence>
      <div hidden={splash}>{children}</div>
    </>
  );
}

let lenis: Lenis | null = null;
type LenisAttach = (l: Lenis) => (() => void) | void;
const lenisUsers = new Map<LenisAttach, (() => void) | void>();

// Runs `attach` with the page's smooth scroller whenever one exists (now, if it already does), and its cleanup when that
// scroller goes away. Returns an unsubscribe. Survives the scroller being recreated, as React does in development.
export function withLenis(attach: LenisAttach) {
  lenisUsers.set(attach, lenis ? attach(lenis) : undefined);
  return () => { lenisUsers.get(attach)?.(); lenisUsers.delete(attach); };
}

export function scrollToY(y: number) {
  if (lenis) lenis.scrollTo(y);
  else window.scrollTo({ top: y, behavior: reduced() ? "auto" : "smooth" });
}

// Weighted, eased scrolling (Lenis), so the page has a little friction instead of jumping with every wheel notch.
// Used on the landing page; off under reduced motion.
export function SmoothScroll() {
  useEffect(() => {
    if (reduced()) return;
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, autoRaf: true, anchors: { offset: -144 } });
    lenis = l;
    lenisUsers.forEach((_, attach) => lenisUsers.set(attach, attach(l)));
    return () => {
      lenisUsers.forEach((stop, attach) => { stop?.(); lenisUsers.set(attach, undefined); });
      l.destroy();
      lenis = null;
    };
  }, []);
  return null;
}
