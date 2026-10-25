"use client";
// How Fermata is built, as an architecture diagram: one hub that every change goes through (the system of work in
// Convex, `transition()`), the zones around it, and three kinds of traffic drawn as coloured lines. Blue is a line that
// settles on its own, amber is a line that needs a person, red is a refusal. `step` shows that many flows; each one
// draws in, then a packet travels its whole route on a loop. Drawn on a fixed 1680×700 canvas in stage px (the pitch);
// `size="fit"` scales the same canvas to its container. See DESIGN.md, System diagram.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BANK_ACCOUNTS, PLATFORM_LABEL } from "../../convex/lib/domain";
import { ROLES, type Action, type Role } from "../../convex/lib/transition";
import { Avatar, PlainAvatars } from "./caseRoom";

export const DIAGRAM_W = 1680;
export const DIAGRAM_H = 700;

type Pt = [number, number];
type Box = { x: number; y: number; w: number; h: number };
type Flow = "settle" | "hold" | "refuse";
const FLOWS: Flow[] = ["settle", "hold", "refuse"];
const INK: Record<Flow | "quiet", string> = {
  settle: "var(--color-accent)", hold: "var(--color-hold)", refuse: "var(--color-danger)", quiet: "var(--color-mute)",
};
const TEXT: Record<Flow, string> = { settle: "text-accent", hold: "text-hold", refuse: "text-danger" };
export const FLOW_LABEL: Record<Flow, string> = { settle: "Settles on its own", hold: "Needs a person", refuse: "Refused, and recorded" };

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const GAP = 24; // between parallel lines
const SPEED = 240; // a packet's speed, in stage px per second
const DWELL = 0.35; // a packet's pause inside a tile between two lines

// What a role may do, read from the roles table in code (the actions that matter on a diagram).
const SHOWN: Action[] = ["propose", "ask", "flag", "block", "answer", "approve", "post"];
const may = (r: Role) => SHOWN.filter((a) => a in ROLES[r].actions).join(" · ");

// ——— Layout, in canvas px. Zones on a grid: the left column, the hub column, the right column.
const Z = {
  sources: { x: 0, y: 0, w: 340, h: 424 },
  people: { x: 0, y: 484, w: 340, h: 216 },
  room: { x: 540, y: 0, w: 600, h: 200 },
  engine: { x: 540, y: 500, w: 600, h: 200 },
  books: { x: 1340, y: 210, w: 340, h: 340 },
} satisfies Record<string, Box>;
const HUB: Box = { x: 680, y: 280, w: 320, h: 140 };
const CLAUDE: Box = { x: 1168, y: 12, w: 168, h: 76 };
const ASK: Box = { x: 1340, y: 604, w: 340, h: 96 };
const SOURCE_Y = [52, 144, 236, 328]; // tiles 80 tall
const AGENT_X = [556, 702, 848, 994]; // tiles 130 wide: manager, investigator, auditor, learner
const ENGINE_X = [556, 751, 946]; // tiles 178 wide
const GATE: Box = { x: 1356, y: 280, w: 308, h: 100 };
const LEDGER: Box = { x: 1356, y: 444, w: 146, h: 90 };
const AUDIT: Box = { x: 1518, y: 444, w: 146, h: 90 };
const HX = HUB.x + HUB.w / 2; // the hub's centre line, which the vertical bundles straddle
const mid = (b: Box) => b.x + b.w / 2;

// ——— Lines. Each is a list of corner points, drawn orthogonally with rounded corners.
type Seg = { flow: Flow | "quiet"; pts: Pt[]; end?: "arrow" | "refused" | "none" };
const SYNC_Y = 310;
const BUS_X = 390;
const SEGS = {
  // Blue: sources sync in, the engine matches, the line settles, the gateway posts it.
  sync0: { flow: "settle", pts: [[324, SOURCE_Y[0] + 40], [BUS_X, SOURCE_Y[0] + 40], [BUS_X, SYNC_Y], [HUB.x, SYNC_Y]] },
  sync1: { flow: "settle", pts: [[324, SOURCE_Y[1] + 40], [BUS_X, SOURCE_Y[1] + 40], [BUS_X, SYNC_Y], [HUB.x, SYNC_Y]] },
  sync2: { flow: "settle", pts: [[324, SOURCE_Y[2] + 40], [BUS_X, SOURCE_Y[2] + 40], [BUS_X, SYNC_Y], [HUB.x, SYNC_Y]] },
  sync3: { flow: "settle", pts: [[324, SOURCE_Y[3] + 40], [BUS_X, SOURCE_Y[3] + 40], [BUS_X, SYNC_Y], [HUB.x, SYNC_Y]] },
  match: { flow: "settle", pts: [[HX - 1.5 * GAP, HUB.y + HUB.h], [HX - 1.5 * GAP, Z.engine.y]] },
  settled: { flow: "settle", pts: [[HX - 0.5 * GAP, Z.engine.y], [HX - 0.5 * GAP, HUB.y + HUB.h]] },
  post: { flow: "settle", pts: [[HUB.x + HUB.w, 318], [GATE.x, 318]] },
  ledger: { flow: "settle", pts: [[mid(LEDGER), GATE.y + GATE.h], [mid(LEDGER), LEDGER.y]] },
  // Amber: the engine holds a story, the room meets, one question goes out, the answer becomes a rule.
  held: { flow: "hold", pts: [[HX + 0.5 * GAP, Z.engine.y], [HX + 0.5 * GAP, HUB.y + HUB.h]] },
  meet: { flow: "hold", pts: [[HX - GAP, HUB.y], [HX - GAP, Z.room.y + Z.room.h]] },
  propose: { flow: "hold", pts: [[HX, Z.room.y + Z.room.h], [HX, HUB.y]] },
  ask: { flow: "hold", pts: [[HUB.x, 380], [430, 380], [430, 572], [Z.people.x + Z.people.w, 572]] },
  answer: { flow: "hold", pts: [[Z.people.x + Z.people.w, 596], [430 + GAP, 596], [430 + GAP, 380 + GAP], [HUB.x, 380 + GAP]] },
  rule: { flow: "hold", pts: [[HX + 1.5 * GAP, HUB.y + HUB.h], [HX + 1.5 * GAP, Z.engine.y]] },
  // Red: an agent tries to approve, the gateway refuses, and the refusal is recorded.
  attempt: { flow: "refuse", pts: [[HX + GAP, Z.room.y + Z.room.h], [HX + GAP, HUB.y]] },
  refused: { flow: "refuse", pts: [[HUB.x + HUB.w, 318 + GAP], [GATE.x - 13, 318 + GAP]], end: "refused" },
  recorded: { flow: "refuse", pts: [[mid(AUDIT), GATE.y + GATE.h], [mid(AUDIT), AUDIT.y]] },
  // Quiet: Claude runs the three agents; Ask the books reads from the hub and never writes.
  claude: { flow: "quiet", pts: [[CLAUDE.x, 50], [AGENT_X[1] + 65, 50], [AGENT_X[1] + 65, 64]], end: "none" },
  claude2: { flow: "quiet", pts: [[AGENT_X[2] + 65, 50], [AGENT_X[2] + 65, 64]], end: "none" },
  claude3: { flow: "quiet", pts: [[AGENT_X[3] + 65, 50], [AGENT_X[3] + 65, 64]], end: "none" },
  reads: { flow: "quiet", pts: [[HUB.x + HUB.w, 404], [1250, 404], [1250, ASK.y + ASK.h / 2], [ASK.x, ASK.y + ASK.h / 2]] },
} satisfies Record<string, Seg>;
type SegId = keyof typeof SEGS;

// Each flow's route, in order. A stage's lines run together; a packet pauses in the tile between stages.
const JOURNEY: Record<Flow, { ids: SegId[]; dwell?: number }[]> = {
  settle: [{ ids: ["sync0", "sync1", "sync2", "sync3"] }, { ids: ["match"] }, { ids: ["settled"] }, { ids: ["post"] }, { ids: ["ledger"] }],
  hold: [{ ids: ["held"] }, { ids: ["meet"], dwell: 1.1 }, { ids: ["propose"] }, { ids: ["ask"], dwell: 0.8 }, { ids: ["answer"] }, { ids: ["meet"], dwell: 0.8 }, { ids: ["propose"] }, { ids: ["rule"] }],
  refuse: [{ ids: ["attempt"] }, { ids: ["refused"], dwell: 0.9 }, { ids: ["recorded"] }],
};

// Labels beside the lines, in the flow's colour. `x` is the left edge, or the right edge when `right`.
const LABELS: { flow: Flow; x: number; y: number; right?: boolean; text: string }[] = [
  { flow: "settle", x: 470, y: 282, text: "sync, every line" },
  { flow: "settle", x: HX - 1.5 * GAP - 14, y: 426, right: true, text: "↓ every line, to match" },
  { flow: "settle", x: HX - 1.5 * GAP - 14, y: 452, right: true, text: "↑ settled under a rule" },
  { flow: "settle", x: 1016, y: 286, text: "approved, so posted" },
  { flow: "settle", x: mid(LEDGER) - 12, y: 398, right: true, text: "writes" },
  { flow: "hold", x: HX + 1.5 * GAP + 14, y: 426, text: "↑ the rest, held as a story" },
  { flow: "hold", x: HX + 1.5 * GAP + 14, y: 452, text: "↓ the rule, from then on" },
  { flow: "hold", x: HX - GAP - 14, y: 206, right: true, text: "↑ the story, then the answer" },
  { flow: "hold", x: HX - GAP - 14, y: 232, right: true, text: "↓ one question, then a rule" },
  { flow: "hold", x: 430 - 12, y: 440, right: true, text: "↓ asks once" },
  { flow: "hold", x: 430 + GAP + 12, y: 440, text: "↑ the answer" },
  { flow: "refuse", x: HX + GAP + 14, y: 219, text: "↓ an agent tries to approve" },
  { flow: "refuse", x: 1016, y: 352, text: "refused by the gateway" },
  { flow: "refuse", x: mid(AUDIT) - 12, y: 398, right: true, text: "recorded" },
];

// ——— Geometry helpers.
const len = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.abs(p[0] - pts[i][0]) + Math.abs(p[1] - pts[i][1]), 0);
// Move the last point `by` px along the last segment (negative pulls it back, so an arrowhead lands on the edge).
function stretch(pts: Pt[], by: number): Pt[] {
  const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
  const l = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) || 1;
  return [...pts.slice(0, -1), [b[0] + ((b[0] - a[0]) / l) * by, b[1] + ((b[1] - a[1]) / l) * by]];
}
// An orthogonal route with rounded corners.
function route(pts: Pt[], r = 14): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const l2 = Math.hypot(n[0] - c[0], n[1] - c[1]);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a: Pt = [c[0] - ((c[0] - p[0]) / l1) * rr, c[1] - ((c[1] - p[1]) / l1) * rr];
    const b: Pt = [c[0] + ((n[0] - c[0]) / l2) * rr, c[1] + ((n[1] - c[1]) / l2) * rr];
    d += ` L${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}
const drawn = (s: Seg) => (s.end === "arrow" || s.end === undefined ? stretch(s.pts, -5) : s.pts);

// When each line of a flow starts drawing, and when the whole flow has drawn.
function drawOrder(flow: Flow) {
  const at = new Map<SegId, number>();
  JOURNEY[flow].forEach((st, i) => st.ids.forEach((id) => { if (!at.has(id)) at.set(id, i * 0.16); }));
  return { at, done: (JOURNEY[flow].length - 1) * 0.16 + 0.55 };
}

// A packet's timetable: each journey entry gets a start and a duration inside one loop of `period` seconds.
function timetable(flow: Flow) {
  let t = 0;
  const legs: { id: SegId; start: number; dur: number }[] = [];
  for (const st of JOURNEY[flow]) {
    const durs = st.ids.map((id) => Math.max(0.45, len(SEGS[id].pts) / SPEED));
    const dur = Math.max(...durs);
    // Lines in one stage arrive together, so packets from the four sources merge on the bus.
    st.ids.forEach((id, i) => legs.push({ id, start: t + dur - durs[i], dur: durs[i] }));
    t += dur + (st.dwell ?? DWELL);
  }
  return { legs, period: t + 0.6 };
}

// ——— Icons: simple line drawings, 24 units, in the current colour.
const ICON = {
  bank: "M3 10h18M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18M12 3.5l8.5 4.5h-17z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  bag: "M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8",
  school: "M2.5 9 12 4.5 21.5 9 12 13.5zM6.5 11v4.5c3 2.2 8 2.2 11 0V11M21.5 9v5",
  pin: "M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21zM12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  code: "M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5",
  store: "M4 7.5c0-2 3.6-3.5 8-3.5s8 1.5 8 3.5-3.6 3.5-8 3.5-8-1.5-8-3.5zM4 7.5v9c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-9M4 12c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5",
  shield: "M12 3 19.5 6v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6zM9 12l2 2 4-4",
  book: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3",
  list: "M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01",
  spark: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21",
  inbox: "M3 13.5h5l1.2 3h5.6l1.2-3h5M3 13.5 6 5h12l3 8.5V19H3z",
  chat: "M4 5h16v10.5H9.5L5 19.5V15.5H4z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.2 2.5 3.5 5.2",
  cpu: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
};
function Icon({ d, size = 24, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

const at = (b: Box) => ({ left: b.x, top: b.y, width: b.w, height: b.h });

// A zone: a warm tray with its badge in the top-left corner and a short note on the right.
function Zone({ box, icon, label, note }: { box: Box; icon: string; label: string; note?: string }) {
  return (
    <div className="absolute rounded-[16px] border-[1.5px] border-strong bg-warm" style={at(box)}>
      <div className="absolute left-0 top-0 grid size-[36px] place-items-center rounded-br-[10px] rounded-tl-[14px] border-b-[1.5px] border-r-[1.5px] border-strong bg-ground text-secondary"><Icon d={icon} size={20} /></div>
      <div className="absolute left-[48px] right-[14px] top-[8px] flex items-baseline justify-between gap-3">
        <span className="eyebrow text-[15px] text-secondary">{label}</span>
        {note ? <span className="truncate text-[15px] text-faint">{note}</span> : null}
      </div>
    </div>
  );
}

// An icon tile: a white card with a line icon, a name, a sub line and, for a role, what it may do.
function Tile({ box, icon, avatar, title, sub, acts }: { box: Box; icon?: string; avatar?: Role; title: string; sub?: string; acts?: string }) {
  return (
    <div className="absolute flex items-center gap-4 rounded-[10px] border border-hairline bg-ground px-4 shadow-[0_1px_2px_rgb(85_40_20/0.06)]" style={at(box)}>
      {avatar ? <span style={{ zoom: 1.35 }}><Avatar who={avatar} size={32} /></span>
        : icon ? <span className="grid size-[44px] shrink-0 place-items-center rounded-[8px] bg-well text-heading-2"><Icon d={icon} /></span> : null}
      <div className="min-w-0">
        <div className="text-[20px] font-medium leading-tight text-ink">{title}</div>
        {sub ? <div className="mt-0.5 text-[16px] leading-snug text-faint">{sub}</div> : null}
        {acts ? <div className="mt-0.5 whitespace-nowrap text-[15px] leading-snug text-secondary">{acts}</div> : null}
      </div>
    </div>
  );
}

// A small tile with the icon over the words: the agents, the engine's parts, the ledger and the audit log.
function Stack({ box, icon, avatar, title, sub, acts }: { box: Box; icon?: string; avatar?: Role; title: string; sub?: string; acts?: string }) {
  return (
    <div className="absolute flex flex-col items-center justify-center rounded-[10px] border border-hairline bg-ground px-2 text-center shadow-[0_1px_2px_rgb(85_40_20/0.06)]" style={at(box)}>
      {avatar ? <span style={{ zoom: 1.35 }}><Avatar who={avatar} size={32} /></span>
        : icon ? <span className="grid size-[40px] place-items-center rounded-[8px] bg-well text-heading-2"><Icon d={icon} size={22} /></span> : null}
      <div className="mt-2 text-[19px] font-medium leading-tight text-ink">{title}</div>
      {sub ? <div className="mt-0.5 text-[15px] leading-snug text-faint">{sub}</div> : null}
      {acts ? <div className="mt-0.5 whitespace-nowrap text-[15px] leading-snug text-secondary">{acts}</div> : null}
    </div>
  );
}

function Line({ uid, id, seg, shown, dim, delay }: { uid: string; id: string; seg: Seg; shown: boolean; dim: boolean; delay: number }) {
  const pts = drawn(seg);
  const d = route(pts);
  const ink = INK[seg.flow];
  const end = seg.end ?? "arrow";
  return (
    <motion.g initial={false} animate={{ opacity: shown ? (dim ? 0.55 : 1) : 0 }} transition={{ duration: 0.45 }}>
      <mask id={`${uid}-m-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={DIAGRAM_W} height={DIAGRAM_H}>
        <motion.path d={route(stretch(pts, 10))} fill="none" stroke="white" strokeWidth={24}
          initial={{ pathLength: 0 }} animate={{ pathLength: shown ? 1 : 0 }} transition={{ duration: shown ? 0.55 : 0.2, delay: shown ? delay : 0, ease: EASE_OUT }} />
      </mask>
      <g mask={`url(#${uid}-m-${id})`}>
        <path d={d} fill="none" stroke={ink} strokeWidth={seg.flow === "quiet" ? 2 : 3} strokeLinejoin="round"
          strokeDasharray={seg.flow === "refuse" ? "9 7" : undefined} markerEnd={end === "arrow" ? `url(#${uid}-a-${seg.flow})` : undefined} />
      </g>
    </motion.g>
  );
}

// The packets of the flow in focus: one dot per leg, each visible only during its slot in the loop, so one packet
// appears to travel the whole route in order. HTML dots on a CSS motion path, so they sit under the tiles.
function Packets({ uid, flow, start }: { uid: string; flow: Flow; start: number }) {
  const { legs, period } = timetable(flow);
  const pc = (s: number) => ((Math.max(0, Math.min(period, s)) / period) * 100).toFixed(3);
  const fade = 0.15;
  const css = legs.map((l, i) => `@keyframes ${uid}-p${i}{0%,${pc(l.start)}%{offset-distance:0%;opacity:0}${pc(l.start + fade)}%{opacity:1}${pc(l.start + l.dur - fade)}%{opacity:1}${pc(l.start + l.dur)}%,100%{offset-distance:100%;opacity:0}}`).join("");
  const ink = INK[flow];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <style>{css}</style>
      {legs.map((l, i) => (
        <span key={i} className="absolute left-0 top-0 size-[12px] rounded-full"
          style={{
            background: ink, boxShadow: `0 0 0 4px color-mix(in srgb, ${ink} 22%, transparent)`,
            offsetPath: `path("${route(drawn(SEGS[l.id]))}")`, offsetRotate: "0deg", opacity: 0,
            animation: `${uid}-p${i} ${period.toFixed(3)}s linear ${start}s infinite both`,
          }} />
      ))}
    </div>
  );
}

function Canvas({ step, focus, legend }: { step: number; focus: boolean; legend: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const still = useReducedMotion();
  const latest = FLOWS[Math.min(step, FLOWS.length) - 1];
  const shownFlow = (f: Flow | "quiet") => f === "quiet" || FLOWS.indexOf(f) < step;
  const dimFlow = (f: Flow | "quiet") => focus && f !== "quiet" && f !== latest;
  const order = Object.fromEntries(FLOWS.map((f) => [f, drawOrder(f)])) as Record<Flow, ReturnType<typeof drawOrder>>;
  const delayOf = (id: SegId, f: Flow | "quiet") => (f === "quiet" ? 0.3 : order[f].at.get(id) ?? 0);
  const gateX: Pt = [GATE.x - 13, 318 + GAP];

  return (
    <PlainAvatars.Provider value>
      <div className="relative" style={{ width: DIAGRAM_W, height: DIAGRAM_H }}>
        {/* Zones */}
        <Zone box={Z.sources} icon={ICON.inbox} label="Sources" note="in through sync" />
        <Zone box={Z.people} icon={ICON.people} label="People" note="answer and approve" />
        <Zone box={Z.room} icon={ICON.chat} label="Case room" note="one per held story" />
        <Zone box={Z.engine} icon={ICON.cpu} label="Engine" note="code, no AI" />
        <Zone box={Z.books} icon={ICON.book} label="Books" note="one writer" />

        {/* Lines */}
        <svg aria-hidden className="absolute inset-0 overflow-visible" width={DIAGRAM_W} height={DIAGRAM_H}>
          <defs>
            {(["settle", "hold", "refuse", "quiet"] as const).map((f) => (
              <marker key={f} id={`${uid}-a-${f}`} viewBox="0 0 12 12" refX={7} refY={6} markerWidth={f === "quiet" ? 10 : 12} markerHeight={f === "quiet" ? 10 : 12} markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0 0 12 6 0 12z" fill={INK[f]} />
              </marker>
            ))}
          </defs>
          {(Object.keys(SEGS) as SegId[]).map((id) => {
            const seg: Seg = SEGS[id];
            return <Line key={id} uid={uid} id={id} seg={seg} shown={shownFlow(seg.flow)} dim={dimFlow(seg.flow)} delay={delayOf(id, seg.flow)} />;
          })}
        </svg>

        {/* Packets, for the flow in focus */}
        {!still && latest ? <Packets key={latest} uid={`${uid}${latest}`} flow={latest} start={order[latest].done + 0.3} /> : null}

        {/* Tiles */}
        {[
          { icon: ICON.bank, title: "Bank feed", sub: `${BANK_ACCOUNTS.length} accounts, every line` },
          { icon: ICON.receipt, title: "ERP", sub: "store sales and receipts" },
          { icon: ICON.bag, title: "Marketplaces", sub: `${PLATFORM_LABEL.SHOPEE} and ${PLATFORM_LABEL.TOKOPEDIA} payouts` },
          { icon: ICON.school, title: "School system", sub: "lesson fees and receipts" },
        ].map((t, i) => <Tile key={t.title} box={{ x: 16, y: SOURCE_Y[i], w: 308, h: 80 }} {...t} />)}

        {(["manager", "investigator", "auditor", "learner"] as Role[]).map((r, i) => (
          <Stack key={r} box={{ x: AGENT_X[i], y: 64, w: 130, h: 124 }} avatar={r} title={r === "manager" ? "Manager" : ROLES[r].label} sub={r === "manager" ? "code" : "Claude"} acts={may(r)} />
        ))}
        <Tile box={CLAUDE} icon={ICON.spark} title="Claude" sub="the model" />

        {[
          { icon: ICON.pin, title: "Placement", sub: "which store" },
          { icon: ICON.link, title: "Matching", sub: "line to record" },
          { icon: ICON.code, title: "Rules", sub: "approved, as code" },
        ].map((t, i) => <Stack key={t.title} box={{ x: ENGINE_X[i], y: 552, w: 178, h: 132 }} {...t} />)}

        {(["accountant", "cfo"] as Role[]).map((r, i) => (
          <Tile key={r} box={{ x: 16, y: 536 + i * 82, w: 308, h: 72 }} avatar={r} title={ROLES[r].label} acts={may(r)} />
        ))}

        <Tile box={GATE} icon={ICON.shield} title="Gateway" sub="the only writer" acts={may("gateway")} />
        <Stack box={LEDGER} icon={ICON.book} title="Ledger" />
        <Stack box={AUDIT} icon={ICON.list} title="Audit log" />
        <Tile box={ASK} icon={ICON.mic} title="Ask the books" sub="read only · Cartesia voice" />

        {/* The hub */}
        <div className="absolute flex flex-col justify-center rounded-[14px] bg-heading px-7 text-white shadow-[0_12px_32px_-16px_rgb(10_45_102/0.55)]" style={at(HUB)}>
          <div className="flex items-center gap-3">
            <span className="grid size-[40px] place-items-center rounded-[8px] bg-white/12 text-white"><Icon d={ICON.store} size={22} /></span>
            <span className="display text-[27px] tracking-[-0.03em]" style={{ color: "white" }}>System of work</span>
          </div>
          <div className="mt-3 text-[17px] text-white/75">Convex · <span className="num text-white">transition()</span></div>
          <div className="mt-0.5 text-[16px] text-white/60">each change with its audit row</div>
        </div>

        {/* Labels and the refusal mark */}
        <div aria-hidden className="absolute whitespace-nowrap text-[17px] leading-[22px] text-faint" style={{ right: DIAGRAM_W - 1238, top: 560 }}>reads only</div>
        {LABELS.map((l, i) => {
          const shown = shownFlow(l.flow);
          return (
            <motion.div key={i} aria-hidden className={`absolute whitespace-nowrap text-[17px] font-medium leading-[22px] ${TEXT[l.flow]}`}
              style={l.right ? { right: DIAGRAM_W - l.x, top: l.y } : { left: l.x, top: l.y }}
              initial={false} animate={{ opacity: shown ? (dimFlow(l.flow) ? 0.75 : 1) : 0 }} transition={{ duration: 0.4, delay: shown && !dimFlow(l.flow) ? order[l.flow].done - 0.2 : 0 }}>
              {l.text}
            </motion.div>
          );
        })}
        <motion.div aria-hidden className="absolute grid size-[26px] place-items-center rounded-full border-[1.5px] border-danger bg-ground text-[15px] font-semibold leading-none text-danger"
          style={{ left: gateX[0] - 13 + 12, top: gateX[1] - 13 }}
          initial={false} animate={{ opacity: step >= 3 ? 1 : 0, scale: step >= 3 ? 1 : 0.6 }} transition={{ duration: 0.35, delay: step >= 3 ? order.refuse.at.get("refused")! + 0.5 : 0, ease: EASE_OUT }}>
          ✕
        </motion.div>

        {/* Legend, top right */}
        {legend ? (
          <div className="absolute" style={{ left: CLAUDE.x + CLAUDE.w + 40, top: 4, right: 0 }}>
            <DiagramLegend step={step} />
            <p className="mt-3 text-[15px] leading-snug text-faint">Under each role, what it may do: read from the roles table in code and checked on every step.</p>
          </div>
        ) : null}
      </div>
    </PlainAvatars.Provider>
  );
}

// A small legend: the three flows in plain words, each appearing with its flow.
export function DiagramLegend({ step, className = "" }: { step: number; className?: string }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {FLOWS.map((f, i) => (
        <motion.li key={f} className="flex items-center gap-3 text-[19px] text-ink" initial={false} animate={{ opacity: step > i ? 1 : 0.35 }} transition={{ duration: 0.4 }}>
          <svg aria-hidden width="44" height="12" className="shrink-0">
            <path d="M0 6h34" stroke={INK[f]} strokeWidth="3" strokeDasharray={f === "refuse" ? "7 5" : undefined} />
            <path d="M32 0 44 6 32 12z" fill={INK[f]} />
          </svg>
          {FLOW_LABEL[f]}
        </motion.li>
      ))}
    </ul>
  );
}

// Scales the stage canvas to its container's width (for pages other than the pitch).
function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / DIAGRAM_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full" style={{ aspectRatio: `${DIAGRAM_W} / ${DIAGRAM_H}` }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: DIAGRAM_W, height: DIAGRAM_H, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

// `step` is how many flows show (0 to 3). `focus` dims the earlier flows so the newest one reads on its own; `legend`
// draws the legend in the top right corner.
export function SystemDiagram({ step, size = "stage", focus = true, legend = true }: { step: number; size?: "stage" | "fit"; focus?: boolean; legend?: boolean }) {
  const canvas = <Canvas step={step} focus={focus} legend={legend} />;
  return (
    <figure role="img" aria-label="How Fermata is built: sources sync into the system of work in Convex, which every change goes through. The engine settles lines under approved rules; held lines go to a case room of agents, which asks one person one question and turns the answer into a rule. Only the gateway writes to the books, and every refusal is recorded in the audit log.">
      {size === "fit" ? <Fit>{canvas}</Fit> : canvas}
    </figure>
  );
}
