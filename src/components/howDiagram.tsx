"use client";
// How it's built, for the landing page's How it works: eleven boxes on one quiet canvas, and five paths through them.
// The whole flow plays the paths in turn; pick one and only its boxes and lines light up, numbered, with one phrase per
// step; click a box for what it is underneath. Drawn on a fixed canvas scaled to its container; on a phone the steps
// list stands in for the canvas. See DESIGN.md, How it works.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import recording from "@/demo/recording.json";
import { num } from "../../convex/lib/format";
import { LY } from "./learningYear";

const W = 1180, H = 520;
const BOX = { w: 184, h: 92 };
const COL = (c: number) => c * 249; // 5 columns
const ROW = (r: number) => 14 + r * 206; // 3 rows, with gutters for the lines
const EASE = [0.22, 1, 0.36, 1] as const;

type Id = "history" | "mining" | "rules" | "backtest" | "sources" | "engine" | "hub" | "gateway" | "books" | "room" | "people";
const DAY0 = (recording as unknown as { rules: { learnedInMonth: number }[] }).rules.filter((r) => !r.learnedInMonth).length;
const R8 = LY.rules[0];

// Every box: where it sits, its name, one line under it, and what it is underneath (three short lines).
const NODES: Record<Id, { c: number; r: number; name: string; sub: string; tag: string; detail: string[]; dark?: boolean }> = {
  history: { c: 0, r: 0, name: "Historic books", sub: "every year you already have", tag: "Data", detail: ["Every payment a person matched by hand", "A labelled dataset nobody had to label"] },
  mining: { c: 1, r: 0, name: "Policy mining", sub: "finds the patterns, in code", tag: "Code", detail: ["Groups past payments by kind", "Fits each shape: fee, commission, cut", `${DAY0} rules before the first month`] },
  rules: { c: 2, r: 0, name: "Rules", sub: "approved, with limits", tag: "Data", detail: ["Each rule is a small program", "A per-payment limit it never exceeds", "Versioned; a failing rule drops back"] },
  backtest: { c: 3, r: 0, name: "Backtest", sub: "on historic books", tag: "Code", detail: ["Every proposed rule runs on past books first", R8 ? `${R8.id}: ${num(R8.backtest.covered - R8.backtest.wrong)} of ${num(R8.backtest.covered)} right` : "Right and wrong, counted", "A person sees the result, not a guess"] },
  sources: { c: 0, r: 1, name: "Sources", sub: "bank · ERP · shops", tag: "Sync", detail: ["5 shared bank accounts, every line", "Store sales, Shopee, Tokopedia, dealers, school", "Read in, never edited"] },
  engine: { c: 1, r: 1, name: "Engine", sub: "place · match · decide", tag: "Code, no AI", detail: ["TypeScript, deterministic", "Which store: evidence votes", "Which records: one line to many"] },
  hub: { c: 2, r: 1, name: "System of work", sub: "Convex · transition()", tag: "Convex", dark: true, detail: ["Every change is one transition()", "Roles checked on every step", "Written with its audit row"] },
  gateway: { c: 3, r: 1, name: "Gateway", sub: "the only writer", tag: "Code", detail: ["The only role that posts to the books", "Agents and Claude can't reach it"] },
  books: { c: 4, r: 1, name: "Books + audit log", sub: "one transaction", tag: "Convex", detail: ["Ledger and record written together", "Every refusal is on the record too"] },
  room: { c: 2, r: 2, name: "Case room", sub: "3 Claude agents", tag: "Claude", detail: ["Investigator finds it; Auditor tries to break it", "Learner drafts the rule as code", "Manager is code: 6 turns, asks once"] },
  people: { c: 3, r: 2, name: "Accountant · CFO", sub: "answer · approve", tag: "People", detail: ["Answer one checked question", "Approve rules, not lines, once"] },
};

type Tone = "accent" | "hold" | "danger";
type Path = { key: string; label: string; tone: Tone; title: string; steps: [Id, Id, string][] };
export const PATHS: Path[] = [
  { key: "day0", label: "Day 0", tone: "accent", title: "Historic books become rules.", steps: [
    ["history", "mining", "mines every payment already matched by hand"],
    ["mining", "rules", "turns them into rules the CFO approves once"],
  ] },
  { key: "settle", label: "Matches", tone: "accent", title: "Most payments match on their own.", steps: [
    ["sources", "engine", "every payment comes in"],
    ["rules", "engine", "an approved rule explains it"],
    ["engine", "hub", "matched, within the rule's limit"],
    ["hub", "gateway", "posted to the books"],
    ["gateway", "books", "recorded for the audit"],
  ] },
  { key: "hold", label: "Waits", tone: "hold", title: "When nothing explains it, it waits for a person.", steps: [
    ["sources", "engine", "every payment comes in"],
    ["engine", "hub", "no rule explains it"],
    ["hub", "room", "grouped and sent to a case room"],
    ["room", "people", "one question to a person"],
  ] },
  { key: "learn", label: "Learns", tone: "hold", title: "One answer becomes a tested rule.", steps: [
    ["people", "room", "the answer"],
    ["room", "hub", "the Learner drafts a rule"],
    ["hub", "backtest", "tested on historic books"],
    ["backtest", "rules", "the CFO approves it"],
    ["rules", "engine", "matches payments like it from now on"],
  ] },
  { key: "refuse", label: "Blocked", tone: "danger", title: "Agents can't approve their own work.", steps: [
    ["room", "hub", "an agent tries to approve"],
    ["hub", "books", "blocked by code, and recorded"],
  ] },
];

const INK: Record<Tone, string> = { accent: "var(--color-accent)", hold: "var(--color-hold)", danger: "var(--color-danger)" };
const BADGE: Record<Tone, string> = { accent: "bg-accent text-white", hold: "bg-hold text-white", danger: "bg-danger text-white" };

// A line between two boxes, through the gutters: side to side when they sit next to each other in a row, top to
// bottom in a column, and otherwise out of one box's top or bottom, along the gutter, and into the other's.
function route(a: Id, b: Id): { d: string; mid: [number, number] } {
  const A = NODES[a], B = NODES[b];
  const ax = COL(A.c), ay = ROW(A.r), bx = COL(B.c), by = ROW(B.r);
  const cy = (y: number) => y + BOX.h / 2, cx = (x: number) => x + BOX.w / 2;
  if (A.r === B.r && Math.abs(A.c - B.c) === 1) {
    const [x1, x2] = A.c < B.c ? [ax + BOX.w, bx] : [ax, bx + BOX.w];
    return { d: `M${x1},${cy(ay)} H${x2}`, mid: [(x1 + x2) / 2, cy(ay)] };
  }
  if (A.c === B.c) {
    const [y1, y2] = A.r < B.r ? [ay + BOX.h, by] : [ay, by + BOX.h];
    return { d: `M${cx(ax)},${y1} V${y2}`, mid: [cx(ax), (y1 + y2) / 2] };
  }
  // Out of the top or bottom, along a gutter, and in. Ports sit off centre on the side the line is heading.
  const off = B.c > A.c ? 28 : -28;
  const down = B.r > A.r || B.r === A.r;
  const x1 = cx(ax) + off, x2 = cx(bx) - off;
  const y1 = down ? ay + BOX.h : ay;
  const y2 = B.r === A.r ? by + BOX.h : down ? by : by + BOX.h;
  const gy = B.r === A.r ? ay + BOX.h + 48 : (y1 + y2) / 2;
  return { d: `M${x1},${y1} V${gy} H${x2} V${y2}`, mid: [(x1 + x2) / 2, gy] };
}

function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

// How long the whole flow holds each path: its lines drawing in, then a moment to read it.
const dwell = (p: Path) => 900 + p.steps.length * 350 + 2600;

export function HowDiagram() {
  // The whole flow plays by default: every path in turn, from Day 0, once the diagram is on screen. Picking a path stops
  // it there; Whole flow starts it again.
  const [auto, setAuto] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [pick, setPick] = useState(1);
  const [node, setNode] = useState<Id | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const seen = useInView(root, { amount: 0.35 });
  const shown = auto ? cycle : pick;
  const path = PATHS[shown];
  useEffect(() => {
    if (!auto || !seen) return;
    const t = setTimeout(() => setCycle((c) => (c + 1) % PATHS.length), dwell(PATHS[cycle]));
    return () => clearTimeout(t);
  }, [auto, seen, cycle]);
  const on = new Set(path.steps.flatMap(([a, b]) => [a, b]));
  const n = node ? NODES[node] : null;
  const tab = (selected: boolean) => `calm flex min-h-10 items-center gap-2 rounded-[6px] px-3.5 text-[13.5px] lg:min-h-9 ${selected ? "bg-ground text-ink shadow-[0_1px_2px_rgb(85_40_20/0.08)]" : "text-secondary hover:text-ink"}`;

  return (
    <div ref={root} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap rounded-[8px] border border-hairline bg-well p-1" role="tablist" aria-label="Paths">
          <button role="tab" aria-selected={auto} onClick={() => { setAuto(true); setCycle(0); }} className={tab(auto)}>
            <span aria-hidden className="text-[11px] text-accent">▶</span>Whole flow
          </button>
          {PATHS.map((p, i) => (
            <button key={p.key} role="tab" aria-selected={!auto && i === pick} onClick={() => { setAuto(false); setPick(i); }}
              className={`${tab(!auto && i === pick)} relative`}>
              <span className="size-2 rounded-full" style={{ background: INK[p.tone] }} aria-hidden />{p.label}
              {/* While the whole flow plays, the path on screen is marked, and its bar fills as it holds. */}
              {auto && i === shown ? (
                <motion.span key={`bar-${cycle}`} aria-hidden className="absolute inset-x-3 bottom-1 h-[2px] origin-left rounded-full" style={{ background: INK[p.tone] }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 1 : 0 }} transition={{ duration: seen ? dwell(p) / 1000 : 0, ease: "linear" }} />
              ) : null}
            </button>
          ))}
        </div>
        <motion.p key={path.key} className="title text-[18px]" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>{path.title}</motion.p>
      </div>

      <div className="frame hidden md:block">
        <div className="card bg-canvas p-5 lg:p-7">
          <Fit>
            <svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
              {path.steps.map(([a, b], i) => {
                const { d } = route(a, b);
                return (
                  <motion.path key={`${path.key}-${i}`} d={d} fill="none" stroke={INK[path.tone]} strokeWidth={2.25} strokeLinejoin="round"
                    strokeDasharray={path.tone === "danger" ? "7 6" : undefined} markerEnd={`url(#arrow-${path.tone})`}
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.55, delay: 0.15 + i * 0.35, ease: EASE }} />
                );
              })}
              <defs>
                {(Object.keys(INK) as Tone[]).map((t) => (
                  <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={INK[t]} />
                  </marker>
                ))}
              </defs>
            </svg>
            {(Object.keys(NODES) as Id[]).map((id) => {
              const b = NODES[id], lit = on.has(id), picked = node === id;
              return (
                <button key={id} onClick={() => setNode(picked ? null : id)} aria-pressed={picked}
                  className={`calm absolute flex flex-col justify-center rounded-[12px] border-[1.5px] px-4 text-left transition-[opacity,box-shadow,border-color] duration-300
                    ${b.dark ? "border-heading bg-heading text-white" : "bg-ground"} ${picked ? "border-accent! shadow-[0_0_0_4px_var(--color-accent-tint)]" : b.dark ? "" : "border-hairline hover:border-strong"}
                    ${lit ? "opacity-100" : "opacity-40 hover:opacity-80"}`}
                  style={{ left: COL(b.c), top: ROW(b.r), width: BOX.w, height: BOX.h }}>
                  <span className={`font-mono text-[11px] uppercase tracking-[0.06em] ${b.dark ? "text-white/60" : "text-faint"}`}>{b.tag}</span>
                  <span className={`mt-1 text-[17px] font-medium leading-tight ${b.dark ? "text-white" : "text-ink"}`}>{b.name}</span>
                  <span className={`mt-0.5 truncate text-[13px] ${b.dark ? "text-white/70" : "text-secondary"}`}>{b.sub}</span>
                </button>
              );
            })}
            {path.steps.map(([a, b], i) => {
              const { mid } = route(a, b);
              return (
                <motion.span key={`${path.key}-n${i}`} className={`num pointer-events-none absolute grid size-[26px] place-items-center rounded-full text-[13px] font-medium ${BADGE[path.tone]}`}
                  style={{ left: mid[0] - 13, top: mid[1] - 13 }} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.45 + i * 0.35, ease: EASE }}>
                  {i + 1}
                </motion.span>
              );
            })}
            {/* What a box is underneath, in a small card beside the box: under it on the top two rows, over it on the
                bottom row, kept inside the canvas at the right edge. */}
            <AnimatePresence>
              {node && n ? (
                <motion.div key={node} className="absolute z-10 w-[280px] rounded-[12px] border border-hairline bg-ground p-4 shadow-[0_12px_32px_-12px_rgb(85_40_20/0.35)]"
                  style={{ left: Math.min(COL(n.c), W - 280), ...(n.r < 2 ? { top: ROW(n.r) + BOX.h + 10 } : { bottom: H - ROW(n.r) + 10 }) }}
                  initial={{ opacity: 0, y: n.r < 2 ? -6 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[16px] font-medium text-ink">{n.name}</div>
                    <button onClick={() => setNode(null)} aria-label="Close" className="calm -mr-1 -mt-1 grid size-7 place-items-center rounded-[6px] text-faint hover:bg-hover hover:text-ink">×</button>
                  </div>
                  <ul className="mt-1.5 space-y-1">{n.detail.map((d) => <li key={d} className="text-[14px] leading-snug text-secondary">› {d}</li>)}</ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Fit>
        </div>
      </div>

      {/* The path's steps in one numbered row, and the one hint. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <ol className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {path.steps.map(([, , what], i) => (
            <motion.li key={`${path.key}-s${i}`} className="flex items-center gap-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 + i * 0.35, ease: EASE }}>
              <span className={`num grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-medium ${BADGE[path.tone]}`}>{i + 1}</span>
              <span className="text-[14px] text-ink">{what}</span>
            </motion.li>
          ))}
        </ol>
        <span className="hidden text-[12.5px] text-faint md:inline">Click any box to see what it is.</span>
      </div>

      {/* On a phone there is no canvas to click, so the boxes are chips, and the detail shows under them. */}
      <div className="space-y-3 md:hidden">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(NODES) as Id[]).map((id) => <button key={id} onClick={() => setNode(node === id ? null : id)} aria-pressed={node === id} className={`calm rounded-full border px-2.5 py-1 text-[12px] ${node === id ? "border-accent text-accent" : "border-hairline text-secondary hover:text-ink"}`}>{NODES[id].name}</button>)}
        </div>
        {n ? <ul className="card space-y-1 p-4">{n.detail.map((d) => <li key={d} className="text-[13px] text-secondary">› {d}</li>)}</ul> : null}
      </div>
    </div>
  );
}
