"use client";
// How Fermata learns, as one continuous diagram: three layers, bottom to top. Precedents are every decision a person
// made (last year's matched lines, every answer in a case room); policies are what Fermata believes about the business,
// in words, with how much evidence; rules are small programs with a per-payment limit that settle lines with no
// discussion. `step` builds it up and never resets: Day 0 mines last year (1), the year runs (2), a held story becomes a
// rule (3), a no and a rule that falls (4), then the measured result over it (5, the `measured` slot). Drawn on a fixed
// 1680×700 canvas in stage px, like the system diagram. The bottom-right corner is left empty, framed, for the recorded
// demo to be laid over in the video edit. See DESIGN.md, Learning diagram.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { num } from "../../convex/lib/format";
import { ROLES, type Role } from "../../convex/lib/transition";
import { Avatar, PlainAvatars } from "./caseRoom";
import { DAY_ZERO, fitFigure, type Seen } from "./dayZero";

export const LEARN_W = 1680;
export const LEARN_H = 700;

type Program = { match?: string; params?: Record<string, unknown> };
export type OnboardingRule = { id: string; program: Program; seen: Seen | null };
export type LearnedStory = { id: string; program: Program; held: number; covered: number; wrong: number };

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const MUSIC = { fontFamily: "var(--font-music)" };

// ——— Layout, in canvas px. Layer labels on the left, eight columns (seven from Day 0, one learned), people on the right.
const COL_X0 = 160;
const COL_W = 137;
const TILE_W = 127;
const colX = (i: number) => COL_X0 + i * COL_W;
const cx = (i: number) => colX(i) + TILE_W / 2;
const LAYERS_W = colX(8) - 6;
const RULES = { y: 0, h: 144, tile: 12, tileH: 120 };
const POLICIES = { y: 212, h: 146, card: 216, cardH: 138 };
const PRECEDENTS = { y: 368, h: 216, fit: 374, dots: 410 };
const STRIP_Y = 508; // the row where held stories gather
const STREAM_Y = 632;
const PEOPLE_X = 1280;
const PEOPLE_W = LEARN_W - PEOPLE_X;
const INSET = { x: PEOPLE_X, y: 470, w: PEOPLE_W, h: LEARN_H - 470 };

// Step 3's timeline, in seconds after the click: the room meets, one question goes out, the answer becomes a rule.
const T3 = { room: 0.2, row: 1.0, rowGap: 1.4, ask: 9.6, fly: 10.2, yes: 11.6, dot: 12.2, policy: 13.2, fit: 13.8, rule: 15.0, badge: 15.6, stamp: 16.8, flip: 17.4, close: 18.2 };

// A small deterministic scatter, so the dots sit in the same places on every render.
const jitter = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
// Dots per cluster grow with the evidence, on a log scale, so a large shape reads larger without filling the column.
const dotsFor = (n: number | undefined) => Math.max(5, Math.min(15, Math.round(Math.log10(Math.max(10, n ?? 10)) * 4)));
const clusterPt = (col: number, k: number): [number, number] => [colX(col) + 10 + (k % 5) * 22 + (jitter(col, k) - 0.5) * 6, PRECEDENTS.dots + Math.floor(k / 5) * 22 + (jitter(k, col) - 0.5) * 6];

// ——— Pieces.
function Layer({ y, h, name, sub }: { y: number; h: number; name: string; sub: string }) {
  return (
    <div className="absolute left-0 rounded-[16px] border-[1.5px] border-strong bg-warm" style={{ top: y, height: h, width: LAYERS_W }}>
      <div className="absolute left-[16px] top-[12px] w-[128px]">
        <div className="eyebrow text-[18px] text-secondary">{name}</div>
        <div className="mt-1 text-[18px] leading-[22px] text-faint">{sub}</div>
      </div>
    </div>
  );
}

function Person({ who, y, h, sub }: { who: Role; y: number; h: number; sub: string }) {
  return (
    <div className="absolute flex items-center gap-4 rounded-[10px] border border-hairline bg-ground px-5 shadow-[0_1px_2px_rgb(85_40_20/0.06)]" style={{ left: PEOPLE_X, top: y, width: PEOPLE_W, height: h }}>
      <span style={{ zoom: 1.75 }}><Avatar who={who} size={32} /></span>
      <div className="min-w-0">
        <div className="text-[22px] font-medium leading-tight text-ink">{ROLES[who].label}</div>
        <div className="mt-0.5 text-[18px] leading-snug text-faint">{sub}</div>
      </div>
    </div>
  );
}

function Agent({ who, i }: { who: Role; i: number }) {
  const w = (PEOPLE_W - 24) / 3;
  return (
    <div className="absolute flex flex-col items-center justify-center rounded-[10px] border border-hairline bg-ground text-center shadow-[0_1px_2px_rgb(85_40_20/0.06)]" style={{ left: PEOPLE_X + i * (w + 12), top: 152, width: w, height: 120 }}>
      <span style={{ zoom: 1.6 }}><Avatar who={who} size={32} /></span>
      <div className="mt-2 text-[18px] font-medium leading-tight text-ink">{ROLES[who].label}</div>
      <div className="text-[18px] leading-tight text-faint">Claude</div>
    </div>
  );
}

// A fitted number settling on its value: it swings around the value and damps onto it.
function Converge({ values, text, show, delay, x, y }: { values: number[]; text: (v: number[]) => string; show: boolean; delay: number; x: number; y: number }) {
  const still = useReducedMotion();
  const [t, setT] = useState(0);
  const wait = useRef(delay);
  useEffect(() => { wait.current = delay; }, [delay]);
  useEffect(() => {
    if (!show || still) return;
    let raf = 0;
    const t0 = performance.now() + wait.current * 1000;
    const tick = (now: number) => { const p = Math.min(1, Math.max(0, (now - t0) / 1300)); setT(p); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, still]);
  const p = !show ? 0 : still ? 1 : t;
  const swing = Math.exp(-4 * p) * Math.cos(9 * p) * (1 - p);
  const now = values.map((v) => v + (Math.abs(v) * 0.6 || 1) * swing);
  return (
    <motion.div className="num absolute whitespace-nowrap text-[18px] leading-[22px] text-accent" style={{ left: x, top: y }} initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.35, delay: show ? delay : 0 }}>
      {text(now)}
    </motion.div>
  );
}

// A policy: one sentence, and how many precedents it rests on.
function Policy({ col, sentence, count, show, delay, held = false }: { col: number; sentence: string; count: number | null; show: boolean; delay: number; held?: boolean }) {
  return (
    <motion.div className={`absolute flex flex-col rounded-[10px] border bg-ground px-[10px] py-[8px] shadow-[0_1px_2px_rgb(85_40_20/0.06)] transition-colors duration-500 ${held ? "border-hold" : "border-hairline"}`}
      style={{ left: colX(col), top: POLICIES.card, width: TILE_W, height: POLICIES.cardH }}
      initial={{ opacity: 0, y: 150 }} animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 150 }} transition={{ duration: 0.7, delay: show ? delay : 0, ease: EASE_OUT }}>
      <div className="text-[18px] leading-[22px] text-ink">{sentence}</div>
      {count !== null ? (
        <div className="mt-auto">
          <div className="num text-[20px] leading-tight text-heading">{num(count)}</div>
          <div className="text-[18px] leading-tight text-faint">precedents</div>
        </div>
      ) : null}
    </motion.div>
  );
}

const HIDDEN = { opacity: 0, y: 200 };
const SHOWN = { opacity: 1, y: 0 };
const FALL = { opacity: [1, 1, 0], y: [0, POLICIES.card - RULES.tile, POLICIES.card - RULES.tile] };

// A rule: its id, its limit, and its backtest badge. A failed rule's badge turns red and the tile drops a layer.
function RuleTile({ col, id, badge, show, delay, stamp, stampDelay, fall = false }: { col: number; id: string; badge: ReactNode; show: boolean; delay: number; stamp: boolean; stampDelay: number; fall?: boolean }) {
  return (
    <motion.div className="absolute z-10 rounded-[10px] border border-hairline bg-ground px-[10px] py-[8px] shadow-[0_2px_6px_-2px_rgb(85_40_20/0.12)]"
      style={{ left: colX(col), top: RULES.tile, width: TILE_W, height: RULES.tileH }}
      initial={{ opacity: 0, y: 200 }}
      animate={!show ? HIDDEN : fall ? FALL : SHOWN}
      transition={fall ? { duration: 1.6, delay: 1.4, times: [0, 0.7, 1], ease: "easeInOut" } : { duration: 0.7, delay: show ? delay : 0, ease: EASE_OUT }}>
      <div className="num text-[20px] leading-[24px] text-ink">{id}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[18px] leading-[22px] text-faint">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>
        limit
      </div>
      <div className="mt-1.5">{badge}</div>
      <motion.span aria-hidden className="absolute right-[6px] top-[6px] rounded-[4px] border-[1.5px] border-heading-2 px-1.5 text-[18px] font-medium leading-[22px] text-heading-2"
        initial={{ opacity: 0, scale: 1.6, rotate: -14 }} animate={stamp ? { opacity: 1, scale: 1, rotate: -8 } : { opacity: 0, scale: 1.6, rotate: -14 }}
        transition={{ duration: 0.35, delay: stamp ? stampDelay : 0, ease: EASE_OUT }}>
        CFO ✓
      </motion.span>
    </motion.div>
  );
}

function Pip({ tone, children }: { tone: "fit" | "fail"; children: ReactNode }) {
  return <span className={`inline-block rounded-[6px] px-2 text-[18px] leading-[22px] transition-colors duration-500 ${tone === "fail" ? "bg-danger-tint text-danger" : "bg-accent-tint text-accent"}`}>{children}</span>;
}

// A held story: amber dots gathered with the gap that holds them.
function Story({ x, y, w, label, n, show, delay, settled = false, flipDelay = 0, wrap = false }: { x: number; y: number; w?: number; label: string; n: number; show: boolean; delay: number; settled?: boolean; flipDelay?: number; wrap?: boolean }) {
  const lag = { transitionDelay: `${flipDelay}s` };
  return (
    <motion.div className={`absolute flex gap-2 rounded-[12px] border-[1.5px] border-dashed px-3 py-2 transition-colors duration-500 ${wrap ? "flex-col items-start" : "items-center"} ${settled ? "border-accent bg-accent-tint" : "border-hold bg-hold-tint"}`}
      style={{ left: x, top: y, width: w, ...lag }}
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.8 }} transition={{ duration: 0.45, delay: show ? delay : 0, ease: EASE_OUT }}>
      <span className="flex shrink-0 gap-1">{Array.from({ length: n }, (_, k) => <span key={k} className={`size-[10px] rounded-full transition-colors duration-500 ${settled ? "bg-accent" : "bg-hold"}`} style={lag} />)}</span>
      <span className={`text-[18px] font-medium leading-[22px] transition-colors duration-500 ${settled ? "text-accent" : "text-hold-ink"}`} style={lag}>{settled ? "settled" : label}</span>
    </motion.div>
  );
}

// The bank lines, always arriving along the bottom. Grey until the engine runs; then blue settles, amber holds.
function Stream({ step }: { step: number }) {
  const still = useReducedMotion();
  const span = LAYERS_W - COL_X0;
  const gap = 26;
  const n = Math.ceil((span * 2) / gap);
  return (
    <div aria-hidden className="absolute overflow-hidden" style={{ left: COL_X0, top: STREAM_Y - 12, width: span, height: 24 }}>
      <div className="absolute left-0 right-0 top-[11px] h-px bg-hairline" />
      <style>{"@keyframes learn-stream{from{transform:translateX(-50%)}to{transform:translateX(0)}}"}</style>
      <div className="absolute left-0 top-[6px] flex" style={{ width: span * 2, animation: still ? undefined : "learn-stream 16s linear infinite" }}>
        {Array.from({ length: n }, (_, k) => (
          <span key={k} className={`size-[12px] shrink-0 rounded-full transition-colors duration-700 ${step < 2 ? "bg-mute" : k % 10 === 4 ? "bg-hold" : "bg-accent"}`} style={{ marginRight: gap - 12 }} />
        ))}
      </div>
    </div>
  );
}

// Step 2: a burst of new lines rising from the stream. Most climb a rule's line and leave settled (blue); the rest
// rise into the precedents layer and gather into held stories (amber).
function Burst({ cols }: { cols: number }) {
  const still = useReducedMotion();
  if (still) return null;
  const dots = Array.from({ length: 34 }, (_, k) => {
    const col = k % cols;
    const sx = cx(col) + (jitter(k, 3) - 0.5) * 120;
    return { k, col, sx, delay: 0.4 + k * 0.07 };
  });
  return (
    <>
      {dots.map((d) => (
        <motion.span key={d.k} aria-hidden className="absolute left-0 top-0 size-[12px] rounded-full bg-accent"
          initial={{ x: d.sx, y: STREAM_Y - 6, opacity: 0 }}
          animate={{ x: [d.sx, cx(d.col) - 6, cx(d.col) - 6], y: [STREAM_Y - 6, STREAM_Y - 40, RULES.tile + RULES.tileH - 6], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2, delay: d.delay, times: [0, 0.15, 0.92, 1], ease: "easeInOut" }} />
      ))}
    </>
  );
}

// Dots flying from the stream to a held story.
function Rise({ to, n, delay }: { to: [number, number]; n: number; delay: number }) {
  const still = useReducedMotion();
  if (still) return null;
  return (
    <>
      {Array.from({ length: n }, (_, k) => {
        const sx = to[0] - 160 + jitter(k, 7) * 320;
        return (
          <motion.span key={k} aria-hidden className="absolute left-0 top-0 size-[12px] rounded-full bg-hold"
            initial={{ x: sx, y: STREAM_Y - 6, opacity: 0 }}
            animate={{ x: [sx, to[0] + k * 14, to[0] + k * 14], y: [STREAM_Y - 6, to[1], to[1]], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.4, delay: delay + k * 0.12, times: [0, 0.8, 0.95, 1], ease: "easeOut" }} />
        );
      })}
    </>
  );
}

// Step 3: the case room on one held story. The messages are generic, paraphrased from the recorded meeting.
function Room({ story }: { story: LearnedStory }) {
  const rows: { who: string; to?: string; text: ReactNode; denied?: boolean }[] = [
    { who: "engine", to: "investigator", text: <>{num(story.held)} lines held: payouts from a lender no rule knows.</> },
    { who: "investigator", to: "auditor", text: <>Ran a read-only query.<span className="num mt-1 block text-[18px] text-secondary">› sales near these payouts → {num(story.covered)} tie to one sale</span></> },
    { who: "auditor", text: <>Tried to break it: at the other lenders&apos; cuts, none tie.</> },
    { who: "learner", text: <>Drafted the rule as a program and backtested it: <span className="num text-ink">{num(story.covered)}</span> covered · <span className="num text-ink">{num(story.wrong)}</span> wrong.</> },
    { who: "investigator", denied: true, text: <><span className="font-medium">DENIED · approve.</span> The Investigator may not approve. Logged.</> },
    { who: "manager", text: <>Auditor checked. One question goes to the CFO.</> },
  ];
  return (
    <motion.div className="absolute z-30 overflow-hidden rounded-[16px] border-[1.5px] border-strong bg-warm p-[6px] shadow-[0_24px_60px_-30px_rgb(85_40_20/0.45)]"
      style={{ left: colX(1) + 20, top: 150, width: 800, transformOrigin: `${cx(7) - colX(1) - 20}px 300px` }}
      initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.96] }}
      transition={{ duration: T3.close + 0.6 - T3.room, delay: T3.room, times: [0, 0.04, 0.96, 1], ease: "easeOut" }}>
      <div className="card px-6 py-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow text-[18px] text-secondary">Case room · one held story</span>
          <span className="text-[18px] text-faint">manager: code</span>
        </div>
        <ul className="mt-3 space-y-3">
          {rows.map((r, i) => (
            <motion.li key={i} className="flex items-start gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: T3.row + i * T3.rowGap, ease: EASE_OUT }}>
              <span style={{ zoom: 1.75 }}><Avatar who={r.who} size={26} /></span>
              <div className={`min-w-0 flex-1 text-[19px] leading-snug ${r.denied ? "rounded-[6px] bg-danger-tint px-3 py-1.5 text-danger" : "text-body"}`}>
                {!r.denied ? <span className="font-medium text-ink">{r.who === "manager" ? "Manager" : r.who === "engine" ? "Engine" : ROLES[r.who as Role].label}{r.to ? <span className="font-normal text-faint"> → {ROLES[r.to as Role].label}</span> : null} </span> : null}
                {r.text}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

// ——— The canvas.
function Canvas({ step, rules, story, notOurs, measured }: { step: number; rules: OnboardingRule[]; story: LearnedStory | null; notOurs: number; measured?: ReactNode }) {
  // Delay a build only when its own step has just arrived; anything earlier shows at once.
  const at = (k: number, s: number) => (step === k ? s : 0);
  const cols = rules.length;
  const sCol = cols; // the learned story's column
  const fallCol = Math.max(0, rules.findIndex((r) => r.program.match === "gateway_settlement"));
  const day0 = (i: number) => 1.1 + i * 0.32; // when column i's fit starts settling
  const fit = story ? fitFigure(story.program) : null;

  return (
    <PlainAvatars.Provider value>
      <div className="relative" style={{ width: LEARN_W, height: LEARN_H }}>
        <motion.div className="absolute inset-0" initial={false} animate={{ opacity: step >= 5 ? 0.12 : 1, filter: step >= 5 ? "blur(1.5px)" : "blur(0px)" }} transition={{ duration: 0.7 }}>
          {/* The three layers, bottom to top */}
          <Layer y={RULES.y} h={RULES.h} name="Rules" sub="programs, each with a limit" />
          <Layer y={POLICIES.y} h={POLICIES.h} name="Policies" sub="beliefs, in words" />
          <Layer y={PRECEDENTS.y} h={PRECEDENTS.h} name="Precedents" sub="every decision a person made" />
          <div className="eyebrow absolute left-[16px] text-[18px] text-secondary" style={{ top: STREAM_Y - 11 }}>Bank lines</div>

          {/* Catch lines: each rule reaches down to the stream once the year runs */}
          <svg aria-hidden className="absolute inset-0 overflow-visible" width={LEARN_W} height={LEARN_H}>
            {[...rules.map((_, i) => i), sCol].map((i) => {
              const shown = i === sCol ? step >= 3 : step >= 2 && !(i === fallCol && step >= 4);
              const delay = i === sCol ? at(3, T3.flip) : i === fallCol && step === 4 ? 0 : at(2, 0.1 + i * 0.06);
              return (
                <motion.line key={i} x1={cx(i)} x2={cx(i)} y1={RULES.tile + RULES.tileH} y2={STREAM_Y} stroke="var(--color-accent)" strokeWidth={2}
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: shown ? 1 : 0, opacity: shown ? 0.4 : 0 }}
                  transition={{ duration: 0.8, delay: shown ? delay : 0.6, ease: EASE_OUT }} />
              );
            })}
          </svg>

          <Stream step={step} />

          {/* Precedents: last year's lines pour in and cluster by shape */}
          {rules.map((r, col) => Array.from({ length: dotsFor(r.seen?.count) }, (_, k) => {
            const [x, y] = clusterPt(col, k);
            const sx = COL_X0 + jitter(col * 31 + k, 5) * (LAYERS_W - COL_X0 - 20);
            const back = step >= 4 && col === fallCol && k % 2 === 0;
            return (
              <motion.span key={`${r.id}-${k}`} aria-hidden className={`absolute left-0 top-0 size-[12px] rounded-full transition-colors duration-500 ${back ? "bg-hold" : "bg-mute"}`}
                style={{ transitionDelay: back ? "2.6s" : "0s" }}
                initial={{ x: sx, y: STREAM_Y - 6, opacity: 0 }}
                animate={step >= 1 ? { x, y, opacity: 1 } : { x: sx, y: STREAM_Y - 6, opacity: 0 }}
                transition={{ duration: 1.1, delay: at(1, 0.15 + (col * 7 + k) * 0.008), ease: EASE_OUT }} />
            );
          }))}

          {/* Day 0: each cluster's fit settles, rises into a policy, then compiles into a rule the CFO approves once */}
          {rules.map((r, col) => {
            const f = fitFigure(r.program);
            return (
              <div key={r.id}>
                {f.values.length ? <Converge values={f.values} text={f.text} show={step >= 1} delay={at(1, day0(col))} x={colX(col) + 10} y={PRECEDENTS.fit} /> : null}
                <Policy col={col} sentence={DAY_ZERO[r.id]?.policy ?? r.id} count={r.seen?.count ?? null} show={step >= 1} delay={at(1, day0(col) + 0.9)} held={step >= 4 && col === fallCol} />
                <RuleTile col={col} id={r.id} show={step >= 1} delay={at(1, day0(col) + 1.5)} stamp={step >= 1} stampDelay={at(1, day0(col) + 2.1)} fall={step >= 4 && col === fallCol}
                  badge={<Pip tone={step >= 4 && col === fallCol ? "fail" : "fit"}>{step >= 4 && col === fallCol ? "failed" : "fitted"}</Pip>} />
              </div>
            );
          })}

          {/* Step 2: the year runs. New lines climb the rules; the rest gather into held stories */}
          {step >= 2 ? <Burst cols={cols} /> : null}
          {step >= 2 ? <Rise to={[colX(1) + 18, STRIP_Y + 14]} n={3} delay={1.4} /> : null}
          {step >= 2 ? <Rise to={[colX(3) + 18, STRIP_Y + 14]} n={3} delay={1.9} /> : null}
          {step >= 2 && story ? <Rise to={[colX(sCol) + 16, PRECEDENTS.dots + 8]} n={4} delay={2.4} /> : null}
          <Story x={colX(1)} y={STRIP_Y} label="records missing" n={3} show={step >= 2} delay={at(2, 2.6)} />
          <Story x={colX(3)} y={STRIP_Y} label="unknown sender" n={3} show={step >= 2} delay={at(2, 3.1)} />
          {story ? <Story x={colX(sCol)} y={PRECEDENTS.dots - 4} w={TILE_W} label="unknown lender" n={4} wrap show={step >= 2} delay={at(2, 3.6)} settled={step >= 3} flipDelay={at(3, T3.flip)} /> : null}

          {/* Step 3: the story becomes a rule */}
          {story ? (
            <>
              <Policy col={sCol} sentence="A new lender, with its cut" count={story.covered} show={step >= 3} delay={at(3, T3.policy)} />
              {fit?.values.length ? <Converge values={fit.values} text={fit.text} show={step >= 3} delay={at(3, T3.fit)} x={colX(sCol) + 10} y={RULES.tile + RULES.tileH + 22} /> : null}
              <RuleTile col={sCol} id={story.id} show={step >= 3} delay={at(3, T3.rule)} stamp={step >= 3} stampDelay={at(3, T3.stamp)}
                badge={
                  <div className="rounded-[6px] bg-accent-tint px-2 py-0.5 text-[18px] leading-[20px] text-accent">
                    <div><span className="num">{num(story.covered)}</span> covered</div>
                    <div><span className="num">{num(story.wrong)}</span> wrong</div>
                    <motion.div className="mt-1 h-[3px] origin-left rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: step >= 3 ? 1 : 0 }} transition={{ duration: 1, delay: at(3, T3.badge), ease: EASE_OUT }} />
                  </div>
                } />
              {step >= 3 ? <Yes from={step === 3} to={[colX(sCol) + TILE_W - 26, PRECEDENTS.dots + 86]} /> : null}
            </>
          ) : null}

          {/* Step 4: a no stays held, and a rule that fails drops back to a policy */}
          {step >= 4 ? <Rise to={[colX(5) + 18, STRIP_Y + 14]} n={3} delay={0.2} /> : null}
          <Story x={colX(5)} y={STRIP_Y} label={`not ours · ${num(notOurs)} lines, never booked`} n={3} show={step >= 4} delay={at(4, 0.8)} />
          <motion.div className="absolute w-[127px] text-[18px] font-medium leading-[22px] text-hold-ink" style={{ left: colX(fallCol) + 6, top: RULES.tile + RULES.tileH + 14 }}
            initial={{ opacity: 0 }} animate={{ opacity: step >= 4 ? 1 : 0 }} transition={{ duration: 0.4, delay: at(4, 3) }}>
            back to a policy
          </motion.div>

          {/* People and agents */}
          <Person who="cfo" y={RULES.tile} h={RULES.tileH} sub="approves each rule, once" />
          {(["investigator", "auditor", "learner"] as Role[]).map((r, i) => <Agent key={r} who={r} i={i} />)}
          <Person who="accountant" y={PRECEDENTS.y} h={86} sub="matched last year by hand" />

          {/* One honest line under the stream, per step */}
          <motion.p className="absolute text-[18px] text-faint" style={{ left: COL_X0, top: STREAM_Y + 26 }} initial={false} animate={{ opacity: step === 3 ? 1 : 0 }} transition={{ duration: 0.4 }}>
            The room&apos;s messages are paraphrased from the recorded meeting; no lender is named.
          </motion.p>
          <motion.p className="absolute text-[18px] text-faint" style={{ left: COL_X0, top: STREAM_Y + 26 }} initial={false} animate={{ opacity: step === 4 ? 1 : 0 }} transition={{ duration: 0.4, delay: at(4, 3) }}>
            The fall is shown as it would happen: no rule failed in the recorded year.
          </motion.p>
        </motion.div>

        {/* The case room and its one question sit above the dimming, and leave before step 4 */}
        {step === 3 && story ? <Room story={story} /> : null}
        {step === 3 && story ? <Question /> : null}

        {/* Reserved for the recorded demo, laid over in the video edit */}
        <div className="absolute rounded-[16px] border-[1.5px] border-dashed border-strong" style={{ left: INSET.x, top: INSET.y, width: INSET.w, height: INSET.h }}>
          <span className="eyebrow absolute left-[16px] top-[12px] text-[18px] text-faint">Live demo</span>
        </div>

        {/* Step 5: the measured result, over the dimmed diagram */}
        {measured ? (
          <motion.div className="absolute z-40" style={{ left: COL_X0 - 40, top: 10, width: LAYERS_W - COL_X0 + 80 }}
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }} animate={step >= 5 ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 18, filter: "blur(8px)" }}
            transition={{ duration: 0.6, delay: at(5, 0.4), ease: EASE_OUT }}>
            {measured}
          </motion.div>
        ) : null}
      </div>
    </PlainAvatars.Provider>
  );
}

// The one question, sliding from the room to the CFO, answered yes.
function Question() {
  const from = { x: colX(4), y: 520 };
  const to = { x: PEOPLE_X - 420, y: RULES.tile };
  const span = T3.close - T3.ask;
  const k = (t: number) => (t - T3.ask) / span;
  return (
    <motion.div className="absolute left-0 top-0 z-40 w-[400px] rounded-[10px] border border-hold-tint-strong bg-hold-tint px-5 py-3 shadow-[0_12px_30px_-18px_rgb(85_40_20/0.5)]"
      initial={{ x: from.x, y: from.y, opacity: 0 }}
      animate={{ x: [from.x, from.x, to.x, to.x], y: [from.y, from.y, to.y, to.y], opacity: [0, 1, 1, 1, 0] }}
      transition={{
        x: { duration: span, delay: T3.ask, times: [0, k(T3.fly), k(T3.fly + 1), 1], ease: "easeInOut" },
        y: { duration: span, delay: T3.ask, times: [0, k(T3.fly), k(T3.fly + 1), 1], ease: "easeInOut" },
        opacity: { duration: span + 0.4, delay: T3.ask, times: [0, 0.03, 0.5, 0.97, 1] },
      }}>
      <div className="flex items-center gap-2 text-[18px] font-medium text-hold-ink"><span aria-hidden className="text-[24px] leading-none text-hold" style={MUSIC}>𝄐</span>One question for the CFO</div>
      <div className="mt-1 text-[19px] leading-snug text-ink">Is this a lender we use, at this cut?</div>
      <motion.div className="mt-2 inline-block rounded-full border border-strong bg-ground px-3 text-[18px] font-medium text-ink"
        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: T3.yes, ease: EASE_OUT }}>
        Yes
      </motion.div>
    </motion.div>
  );
}

// The CFO's yes becomes a precedent: a dot that drops from the question into the story's column and stays. It flies
// only when it mounts on step 3 itself (`initial` is read once); arriving later, it is already there.
function Yes({ from, to }: { from: boolean; to: [number, number] }) {
  const start: [number, number] = [PEOPLE_X - 380, RULES.tile + 110];
  return (
    <motion.span aria-hidden className="absolute left-0 top-0 z-20 size-[14px] rounded-full bg-heading-2 ring-4 ring-ground"
      initial={from ? { x: start[0], y: start[1], opacity: 0 } : { x: to[0] + 100, y: to[1] - 30, opacity: 1 }}
      animate={{ x: to[0] + 100, y: to[1] - 30, opacity: 1 }}
      transition={{ duration: 0.9, delay: from ? T3.dot : 0, ease: EASE_OUT }} />
  );
}

// `step` is how far the story has built (0 to 5). `rules` are the onboarding rules with their programs and evidence;
// `story` is one held story that became a rule (its program, how many lines were held, the backtest); `notOurs` is how
// many lines a person said were not the business's; `measured` is drawn over the dimmed diagram at step 5.
export function LearningDiagram({ step, rules, story, notOurs, measured }: { step: number; rules: OnboardingRule[]; story: LearnedStory | null; notOurs: number; measured?: ReactNode }) {
  return (
    <figure role="img" aria-label="How Fermata learns: last year's matched lines are precedents; repeated patterns become policies with an evidence count; a policy whose parameters can be fitted becomes a rule with a limit, approved once by the CFO. During the year rules settle most lines; the rest are held as stories, and one answer in a case room becomes a new rule. A no is never booked, and a rule that fails drops back to a policy.">
      <Canvas step={step} rules={rules} story={story} notOurs={notOurs} measured={measured} />
    </figure>
  );
}
