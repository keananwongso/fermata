"use client";
// The pitch deck's player: a fixed 1920×1080 stage scaled to the window, so a slide looks the same in a browser,
// full screen, or a 1080p screen recording. Arrow keys step through each slide's builds, then the slides.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export const W = 1920;
export const H = 1080;

export type Slide = { id: string; chapter: string; steps?: number; notes: string; render: (step: number) => ReactNode };

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// Scale factor that fits the stage inside its box, letterboxed.
function useFit() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, scale };
}

// #4 opens slide 4; the hash follows the deck so a reload lands on the same slide.
const fromHash = (n: number) => {
  if (typeof window === "undefined") return 0;
  const i = Number(window.location.hash.slice(1)) - 1;
  return Number.isInteger(i) && i >= 0 && i < n ? i : 0;
};

export function Deck({ slides }: { slides: Slide[] }) {
  const [at, setAt] = useState({ slide: 0, step: 0 });
  const [notes, setNotes] = useState(false);
  const [chrome, setChrome] = useState(true);
  const { box, scale } = useFit();
  const slide = slides[at.slide];

  const opened = useRef(false);
  useEffect(() => {
    const start = fromHash(slides.length);
    const t = setTimeout(() => { opened.current = true; setAt({ slide: start, step: 0 }); }, 0);
    return () => clearTimeout(t);
  }, [slides.length]);
  useEffect(() => { if (opened.current) window.history.replaceState(null, "", `#${at.slide + 1}`); }, [at.slide]);

  // The deck owns the window while it is open: nothing behind it scrolls.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = before; };
  }, []);

  const next = useCallback(() => setAt(({ slide: s, step }) => {
    if (step < (slides[s].steps ?? 0)) return { slide: s, step: step + 1 };
    return s < slides.length - 1 ? { slide: s + 1, step: 0 } : { slide: s, step };
  }), [slides]);
  const prev = useCallback(() => setAt(({ slide: s, step }) => {
    if (step > 0) return { slide: s, step: step - 1 };
    return s > 0 ? { slide: s - 1, step: slides[s - 1].steps ?? 0 } : { slide: 0, step: 0 };
  }), [slides]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); next(); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
      else if (k === "Home") setAt({ slide: 0, step: 0 });
      else if (k === "End") setAt({ slide: slides.length - 1, step: slides[slides.length - 1].steps ?? 0 });
      else if (k === "n" || k === "N") setNotes((v) => !v);
      else if (k === "h" || k === "H") setChrome((v) => !v);
      else if (k === "f" || k === "F") { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, slides]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-inset" aria-roledescription="slide deck">
      <div ref={box} className="relative min-h-0 flex-1" onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button")) next(); }}>
        {scale ? (
          <div className="absolute left-1/2 top-1/2 overflow-hidden bg-canvas shadow-[0_20px_60px_-30px_rgb(85_40_20/0.35)]"
            style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}>
            <AnimatePresence mode="wait">
              <motion.section key={slide.id} aria-roledescription="slide" aria-label={`${at.slide + 1} of ${slides.length}: ${slide.chapter}`}
                className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                {slide.render(at.step)}
              </motion.section>
            </AnimatePresence>
          </div>
        ) : null}
        {chrome ? (
          <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-3 text-[12px] text-faint">
            <span className="num">{at.slide + 1} / {slides.length}</span>
            <span className="hidden sm:inline">← → to move · N notes · F full screen · H hide this</span>
          </div>
        ) : null}
      </div>
      {notes ? (
        <aside className="max-h-[32vh] shrink-0 overflow-y-auto border-t border-hairline bg-ground px-6 py-4 scroll-quiet" aria-label="Speaker notes">
          <div className="eyebrow">{slide.chapter} · notes</div>
          <p className="mt-2 max-w-[900px] whitespace-pre-line text-[15px] leading-relaxed text-body">{slide.notes}</p>
        </aside>
      ) : null}
    </div>
  );
}

// A child that rises in after the slide appears, or once the slide reaches a build step.
export function In({ children, delay = 0, show = true, className = "" }: { children: ReactNode; delay?: number; show?: boolean; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={show ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 18, filter: "blur(8px)" }}
      transition={{ duration: 0.6, delay: show ? delay : 0, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}

// The frame every content slide shares: margins, the chapter in the corner, the mark and the page number below.
export function Frame({ chapter, n, children, tone = "canvas" }: { chapter: string; n: number; children: ReactNode; tone?: "canvas" | "warm" | "night" }) {
  const bg = { canvas: "bg-canvas", warm: "bg-warm", night: "bg-night" }[tone];
  const dim = tone === "night" ? "text-white/45" : "text-faint";
  return (
    <div className={`absolute inset-0 flex flex-col px-[120px] pb-[120px] pt-[100px] ${bg}`}>
      <div className={`eyebrow text-[18px] ${dim}`}>{chapter}</div>
      <div className="relative mt-8 min-h-0 flex-1">{children}</div>
      <div className={`absolute bottom-[52px] left-[120px] right-[120px] flex items-center justify-between text-[18px] ${dim}`}>
        <span className="flex items-center gap-2.5">
          <span className="text-[26px] leading-none text-hold" aria-hidden>𝄐</span>
          <span className="display text-[20px] tracking-[-0.03em]" style={tone === "night" ? { color: "white" } : undefined}>Fermata</span>
        </span>
        <span className="num">{String(n).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
