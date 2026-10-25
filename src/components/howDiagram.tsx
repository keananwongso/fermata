"use client";
// How it's built, for /how: eleven boxes on one quiet canvas, and five paths through them. Pick a path and only its
// boxes and lines light up, numbered, with one phrase per step; click a box for what it is underneath. The default is
// boxes only, so it reads in a glance and the detail is there when asked for. Drawn on a fixed canvas scaled to its
// container; on a phone the steps list stands in for the canvas. See DESIGN.md, How it works page.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
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
  history: { c: 0, r: 0, name: "Last year's books", sub: "matched by hand", tag: "Data", detail: ["Years of lines a person already matched", "A labelled dataset nobody had to label"] },
  mining: { c: 1, r: 0, name: "Day 0 mining", sub: "one pass over the lines", tag: "Code", detail: ["Groups last year's lines by shape", "Fits each shape: fee, commission, cut", `${DAY0} rules before the first month`] },
  rules: { c: 2, r: 0, name: "Rules", sub: "approved, with limits", tag: "Data", detail: ["Each rule is a small program", "A per-payment limit it never exceeds", "Versioned; a failing rule drops back"] },
  backtest: { c: 3, r: 0, name: "Backtest", sub: "on last year's books", tag: "Code", detail: ["Every proposed rule runs on past books first", R8 ? `${R8.id}: ${num(R8.backtest.covered - R8.backtest.wrong)} of ${num(R8.backtest.covered)} right` : "Right and wrong, counted", "A person sees the result, not a guess"] },
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
  { key: "day0", label: "Day 0", tone: "accent", title: "Last year's books become rules.", steps: [
    ["history", "mining", "one pass over matched lines"],
    ["mining", "rules", "fitted, approved once by the CFO"],
  ] },
  { key: "settle", label: "Settles", tone: "accent", title: "Most lines: no person, no AI.", steps: [
    ["sources", "engine", "every bank line syncs in"],
    ["rules", "engine", "an approved rule explains it"],
    ["engine", "hub", "settled, within its limit"],
    ["hub", "gateway", "approved, so posted"],
    ["gateway", "books", "written with its audit row"],
  ] },
  { key: "hold", label: "Holds", tone: "hold", title: "No rule fits: held, never guessed.", steps: [
    ["sources", "engine", "every bank line syncs in"],
    ["engine", "hub", "no rule explains it"],
    ["hub", "room", "held as a story, one room"],
    ["room", "people", "one checked question"],
  ] },
  { key: "learn", label: "Learns", tone: "hold", title: "One answer becomes a tested rule.", steps: [
    ["people", "room", "the answer"],
    ["room", "hub", "the Learner drafts a rule"],
    ["hub", "backtest", "run on last year's books"],
    ["backtest", "rules", "passes: the CFO approves"],
    ["rules", "engine", "settles that shape from now on"],
  ] },
  { key: "refuse", label: "Refused", tone: "danger", title: "Agents propose. Only people approve.", steps: [
    ["room", "hub", "an agent tries to approve"],
    ["hub", "books", "blocked in code, and recorded"],
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

export function HowDiagram() {
  const [pick, setPick] = useState(1);
  const [node, setNode] = useState<Id | null>(null);
  const path = PATHS[pick];
  const on = new Set(path.steps.flatMap(([a, b]) => [a, b]));
  const n = node ? NODES[node] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap rounded-[8px] border border-hairline bg-well p-1" role="tablist" aria-label="Paths">
          {PATHS.map((p, i) => (
            <button key={p.key} role="tab" aria-selected={i === pick} onClick={() => setPick(i)}
              className={`calm flex min-h-10 items-center gap-2 rounded-[6px] px-3.5 text-[13.5px] lg:min-h-9 ${i === pick ? "bg-ground text-ink shadow-[0_1px_2px_rgb(85_40_20/0.08)]" : "text-secondary hover:text-ink"}`}>
              <span className="size-2 rounded-full" style={{ background: INK[p.tone] }} aria-hidden />{p.label}
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
          </Fit>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="card divide-y divide-hairline">
          {path.steps.map(([a, b, what], i) => (
            <motion.li key={`${path.key}-s${i}`} className="flex items-center gap-3 px-4 py-2.5" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.15 + i * 0.35, ease: EASE }}>
              <span className={`num grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-medium ${BADGE[path.tone]}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 text-[13.5px] text-ink">{what}</span>
              <span className="hidden shrink-0 text-[12px] text-faint sm:inline">{NODES[a].name} → {NODES[b].name}</span>
            </motion.li>
          ))}
        </ol>
        <div className="card p-4">
          {n ? (
            <motion.div key={node} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              <div className="eyebrow">{n.tag}</div>
              <div className="title mt-1 text-[18px]">{n.name}</div>
              <ul className="mt-2 space-y-1">{n.detail.map((d) => <li key={d} className="text-[13px] text-secondary">› {d}</li>)}</ul>
            </motion.div>
          ) : (
            <>
              <div className="eyebrow">Under the hood</div>
              <p className="mt-2 text-[13px] text-secondary">Click any box to see what it is.</p>
            </>
          )}
          {/* On a phone there is no canvas to click, so the boxes are chips. */}
          <div className="mt-3 flex flex-wrap gap-1.5 md:hidden">
            {(Object.keys(NODES) as Id[]).map((id) => <button key={id} onClick={() => setNode(id)} aria-pressed={node === id} className={`calm rounded-full border px-2.5 py-1 text-[12px] ${node === id ? "border-accent text-accent" : "border-hairline text-secondary hover:text-ink"}`}>{NODES[id].name}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
