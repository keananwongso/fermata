"use client";
// The public demo: a replay of one recorded run. No Claude calls and no writes; the agents' messages are the
// real output from that run, and the engine's lines are the same engine replayed on the same year.
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import recording from "@/demo/recording.json";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, rp, rpShort } from "../../../convex/lib/format";
import { Avatar, ChatList, type ChatMessage } from "@/components/caseRoom";
import { Button, Pill } from "@/components/ui";
import { CONSOLE_LINK } from "@/components/nav";
import { Arrival, Reveal, RevealItem, Roll, scrollBoxToEnd } from "@/components/motion";
import { AnimatePresence, motion } from "motion/react";

type Line = {
  date: string; account: string; memo: string; amount: number; channel: string; outcome: "settled" | "waiting" | "held";
  rule: string | null; store: string | null; confidence: number; votes: { store: string; score: number; reasons: string[] }[];
  fanout: number; matched: string | null; note: string; story: string | null;
};
type RecMsg = { at: number; speaker: string; to: string; kind: "message" | "manager" | "denied"; source: "claude" | "code" | "scripted"; staged: boolean; think: string[]; tools: { name: string; input: string; rows: string[][] }[]; text: string; code: string | null; question: { askOf: "cfo" | "accountant"; text: string; options: { id: string; label: string; impact: string }[] } | null };
type Room = {
  key: string; month: number; title: string; count: number; amount: number; live: boolean; narrated: string | null; askOf: string | null; resolution: string | null;
  question: { askOf: "cfo" | "accountant"; text: string; options: { id: string; label: string; impact: string }[]; answer: string | null; real: boolean } | null;
  messages: RecMsg[];
};
type Rec = {
  recordedAt: string; year: number; total: number; final: { settled: number; waiting: number; held: number };
  months: { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number }[];
  lines: Record<string, Line[]>; fan: Line | null; rooms: Room[];
  rules: { id: string; title: string; origin: string; learnedInMonth: number; real: boolean; state: string }[];
};

const R = recording as unknown as Rec;
const asChat = (m: RecMsg, extra: Partial<ChatMessage>): ChatMessage => ({ ...m, ...extra });
const MONTH_MS = 3200;
const LIVE = R.rooms.filter((r) => r.live).sort((a, b) => a.month - b.month);
const cum = (upTo: number, f: (m: Rec["months"][number]) => number) => R.months.filter((m) => m.month <= upTo).reduce((a, m) => a + f(m), 0);

type Phase = "idle" | "running" | "meeting" | "question" | "after" | "done";

export default function Page() {
  return <Arrival><DemoPage /></Arrival>;
}

function DemoPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [month, setMonth] = useState(1);
  const [p, setP] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [shown, setShown] = useState<ChatMessage[]>([]);
  const [answered, setAnswered] = useState<string[]>([]);
  const [line, setLine] = useState<Line | null>(null);

  // The engine: each month plays for MONTH_MS, then a live room meets if this month has one.
  useEffect(() => {
    if (phase !== "running" || paused) return;
    const id = setInterval(() => setP((x) => Math.min(1, x + (50 * speed) / MONTH_MS)), 50);
    return () => clearInterval(id);
  }, [phase, paused, speed]);
  useEffect(() => {
    if (phase !== "running" || p < 1) return;
    const t = setTimeout(() => {
      const meet = LIVE.find((r) => r.month === month && !answered.includes(r.key));
      if (meet) { setRoom(meet); setShown([]); setPhase("meeting"); return; }
      if (month === 12) { setPhase("done"); return; }
      setMonth(month + 1); setP(0);
    }, 0);
    return () => clearTimeout(t);
  }, [phase, p, month, answered]);

  // The meeting replays message by message: agents show as working while their queries run.
  const split = useMemo(() => {
    if (!room) return { meeting: [] as RecMsg[], after: [] as RecMsg[] };
    const i = room.messages.findIndex((m) => m.kind === "manager" && m.text.startsWith("Meeting closed"));
    return { meeting: room.messages.slice(0, i + 1), after: room.messages.slice(i + 1) };
  }, [room]);
  useEffect(() => {
    if ((phase !== "meeting" && phase !== "after") || paused || !room) return;
    const list = phase === "meeting" ? split.meeting : split.after;
    const done = shown.filter((m) => m.status !== "working").length - (phase === "after" ? split.meeting.length : 0);
    if (done >= list.length) {
      if (phase === "meeting") { const q = setTimeout(() => setPhase("question"), 400 / speed); return () => clearTimeout(q); }
      const t = setTimeout(() => { setRoom(null); if (month === 12) setPhase("done"); else { setMonth(month + 1); setP(0); setPhase("running"); } }, 1800 / speed);
      return () => clearTimeout(t);
    }
    const next = list[done];
    const agent = next.kind === "message" && next.source !== "code";
    const last = shown[shown.length - 1];
    if (agent && last?.status !== "working") {
      const t = setTimeout(() => setShown((s) => [...s, asChat(next, { status: "working", tools: [], text: "" })]), 500 / speed);
      return () => clearTimeout(t);
    }
    if (agent && last?.status === "working" && last.tools.length < next.tools.length) {
      const t = setTimeout(() => setShown((s) => [...s.slice(0, -1), { ...last, tools: next.tools.slice(0, last.tools.length + 1) }]), 650 / speed);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => [...(agent ? s.slice(0, -1) : s), asChat(next, { status: "done" })]), (agent ? 900 : 1100) / speed);
    return () => clearTimeout(t);
  }, [phase, paused, room, shown, split, speed, month]);

  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollBoxToEnd(end.current); }, [shown, phase]);

  // Starting the year brings the timeline, the counters and the workspace into view together, once; after that
  // the page stays still and each panel scrolls inside itself.
  const stage = useRef<HTMLDivElement>(null);
  const start = () => {
    setPhase("running");
    stage.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const answer = () => {
    if (!room) return;
    setAnswered((a) => [...a, room.key]);
    setPhase("after");
  };
  const restart = () => { setPhase("idle"); setMonth(1); setP(0); setRoom(null); setShown([]); setAnswered([]); setLine(null); setPaused(false); };

  // Counters: everything before this month, plus this month's share so far.
  const m = R.months[month - 1];
  const f = phase === "running" ? p : phase === "idle" ? 0 : 1;
  const processed = phase === "idle" ? 0 : Math.round(cum(month - 1, (x) => x.total) + m.total * f);
  const settled = phase === "idle" ? 0 : Math.round(cum(month - 1, (x) => x.firstSettled + x.settledLater) + (m.firstSettled + m.settledLater) * f);
  const roomsOpen = R.rooms.filter((r) => r.month < month || (r.month === month && (phase !== "running" || p > 0.6)));
  const visibleRooms = phase === "idle" ? [] : roomsOpen;
  const lines = R.lines[String(month)] ?? [];
  const stream = phase === "idle" ? [] : lines.slice(0, Math.max(1, Math.ceil(lines.length * f))).slice(-9).reverse();
  const curve = R.months.filter((x) => phase !== "idle" && (x.month < month || (x.month === month && f >= 1)));
  const rules = R.rules.filter((r) => r.learnedInMonth === 0 || answered.some((k) => R.rooms.find((x) => x.key === k)?.month === r.learnedInMonth));

  return (
    <Reveal className="space-y-5" stagger={0.08}>
      <RevealItem className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Pill tone="accent">Live demo</Pill><span className="text-[12px] text-faint">A replay of a recorded run · {R.recordedAt}</span></div>
          <h1 className="display mt-3 text-[clamp(30px,3.6vw,44px)]">Watch Fermata close a year</h1>
          <p className="mt-2 max-w-[640px] text-[13.5px] text-secondary">
            104,820 bank lines across six channels and five shared accounts. The engine settles what it can explain; when it can&apos;t, the agents meet, and you answer the one question they bring you. The agents&apos; messages are their real output from the recorded run.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "idle" ? <Button variant="primary" onClick={start}>Close the year</Button>
            : phase === "done" ? <Button variant="primary" onClick={restart}>Play again</Button>
            : <Button onClick={() => setPaused((x) => !x)}>{paused ? "Resume" : "Pause"}</Button>}
          <div className="flex rounded-[6px] border border-hairline bg-well p-0.5" role="radiogroup" aria-label="Speed">
            {[1, 2, 4].map((s) => <button key={s} role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)} className={`calm num min-h-9 rounded-[4.5px] px-2.5 text-[12px] lg:min-h-7 ${speed === s ? "bg-accent text-white" : "text-secondary hover:text-ink"}`}>{s}×</button>)}
          </div>
          {phase !== "idle" ? <Button variant="ghost" onClick={restart}>Restart</Button> : null}
        </div>
      </RevealItem>

      <RevealItem><div ref={stage} className="scroll-mt-32"><Timeline month={month} phase={phase} p={p} answered={answered} /></div></RevealItem>

      <RevealItem className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-5 lg:p-5">
        <Stat label="Bank lines processed" value={<Roll value={processed} format={WHOLE} />} sub={`of ${num(R.total)}`} />
        <Stat label="Settled automatically" value={processed ? <Roll value={settled / processed} format={{ style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }} /> : "—"} sub={`${num(settled)} lines`} tone="success" />
        <Stat label="Case rooms opened" value={<Roll value={visibleRooms.length} />} sub="one per held story" tone="hold" />
        <Stat label="Questions to people" value={<Roll value={visibleRooms.length} />} sub={`${answered.length} answered by you`} />
        <Stat label="Rules learned" value={<Roll value={rules.length} />} sub={rules.length > 7 ? `${rules.length - 7} from answers` : "from last year"} />
      </RevealItem>

      <RevealItem className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] xl:h-[max(520px,calc(100dvh-21.5rem))] xl:grid-cols-[320px_minmax(0,1fr)_280px] xl:grid-rows-[minmax(0,1fr)]">
        <Stream stream={stream} month={month} running={phase === "running"} onPick={setLine} picked={line} />
        <section className="card flex min-h-[460px] min-w-0 flex-col overflow-hidden xl:min-h-0" aria-label={room ? "Case room" : "Learning curve"}>
          {room ? (
            <motion.div key={room.key} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
                <Pill tone="hold">Story {room.narrated}</Pill><Pill tone="accent">Live agents</Pill>
                <h2 className="title min-w-0 flex-1 truncate text-[17px]" title={room.title}>{room.title}</h2>
              </header>
              <div className="max-h-[560px] min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas px-4 pb-4 pt-1 xl:max-h-none" role="log" aria-live="polite">
                <ChatList msgs={shown} animate />
                <div ref={end} />
              </div>
              {phase === "question" && room.question ? <Ask room={room} onAnswer={answer} /> : null}
            </motion.div>
          ) : <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{line ? <Inspector line={line} onClose={() => setLine(null)} /> : <Curve curve={curve} answered={answered} phase={phase} />}</div>}
        </section>
        <aside className="card flex min-w-0 flex-col p-4 lg:col-span-2 xl:col-span-1 xl:min-h-0">
          <div className="eyebrow">Case rooms</div>
          {visibleRooms.length === 0 ? <p className="mt-2 text-[12px] text-faint">Rooms open here when the engine holds something it can&apos;t explain.</p> : null}
          <ul className="mt-2 max-h-[420px] min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain xl:max-h-none">
            <AnimatePresence initial={false}>
            {[...visibleRooms].reverse().map((r) => (
              <motion.li key={r.key} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12px] ${r.live ? "bg-accent-tint" : ""}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${answered.includes(r.key) ? "bg-success" : r.live && room?.key === r.key ? "bg-accent breathe-dot" : "bg-hold"}`} />
                <span className="num w-7 shrink-0 text-faint">{MONTH_LABELS[r.month - 1]}</span>
                <span className="min-w-0 flex-1 truncate" title={r.title}>{r.title}</span>
                {r.live ? <span className="text-[10.5px] text-accent">Claude</span> : <span className="text-[10.5px] text-faint">scripted</span>}
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
          {phase === "done" ? (
            <div className="mt-4 border-t border-hairline pt-4 text-[12.5px] text-secondary">
              The year is closed. {num(R.final.settled)} lines settled, {num(R.rooms.length)} rooms, about 40 decisions for people.
              <div className="mt-2"><Link href={CONSOLE_LINK.href} className="text-link hover:text-accent">{CONSOLE_LINK.label} →</Link></div>
            </div>
          ) : null}
        </aside>
      </RevealItem>
    </Reveal>
  );
}

const WHOLE = { maximumFractionDigits: 0 };

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone?: "success" | "hold" }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className={`figure mt-1.5 text-[26px] ${tone === "success" ? "text-success" : tone === "hold" ? "text-hold" : "text-heading"}`}>{value}</div>
      <div className="mt-1 truncate text-[11.5px] text-faint">{sub}</div>
    </div>
  );
}

function Timeline({ month, phase, p, answered }: { month: number; phase: Phase; p: number; answered: string[] }) {
  return (
    <div className="grid grid-cols-12 gap-1" aria-label="Months">
      {MONTH_LABELS.map((label, i) => {
        const mo = i + 1;
        const done = phase !== "idle" && (mo < month || (mo === month && (phase === "done" || (phase === "running" && p >= 1))));
        const cur = phase !== "idle" && phase !== "done" && mo === month;
        const live = LIVE.find((r) => r.month === mo);
        return (
          <div key={label} className="min-w-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-inset"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: done ? "100%" : cur ? `${(phase === "running" ? p : 1) * 100}%` : "0%" }} /></div>
            <div className={`relative mx-auto mt-1 flex w-fit items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${cur ? "font-medium text-accent" : "text-faint"}`}>
              {cur ? <motion.span layoutId="demo-month" aria-hidden className="absolute inset-0 -z-10 rounded-full bg-accent-tint" transition={{ type: "spring", stiffness: 380, damping: 32 }} /> : null}
              {label}{live ? <span className={answered.includes(live.key) ? "text-success" : "text-hold"} style={{ fontFamily: "var(--font-music)" }} aria-label={`story ${live.narrated}`}>𝄐</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stream({ stream, month, running, onPick, picked }: { stream: Line[]; month: number; running: boolean; onPick: (l: Line) => void; picked: Line | null }) {
  return (
    <section className="card flex min-w-0 flex-col p-4 xl:min-h-0" aria-label="The engine">
      <div className="flex items-center justify-between">
        <div className="eyebrow">The engine · {MONTH_LABELS[month - 1]}</div>
        {running ? <span className="flex items-center gap-1.5 text-[11px] text-accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full bg-accent" />settling</span> : null}
      </div>
      <p className="mt-1 text-[11.5px] text-faint">A sample of real lines. Click one to see why.</p>
      <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain">
        {stream.length === 0 ? <li className="hatch rounded-[6px] border border-hairline px-3 py-8 text-center text-[12px] text-faint">Press Close the year</li> : null}
        <AnimatePresence initial={false}>
        {stream.map((l) => (
          <motion.li key={l.memo + l.date + l.amount} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <button onClick={() => onPick(l)} className={`calm w-full rounded-[6px] border px-2.5 py-1.5 text-left ${picked === l ? "border-accent bg-accent-tint" : "border-hairline bg-ground hover:bg-hover"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="num truncate text-[11px] text-secondary" title={l.memo}>{l.memo}</span>
                <span className="num shrink-0 text-[11.5px] text-ink">{rpShort(l.amount)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                {l.outcome === "settled" ? <span className="text-success">settled · {l.rule}</span> : l.outcome === "waiting" ? <span className="text-faint">waiting for its records</span> : <span className="text-hold-ink">held · to a case room</span>}
                {l.store ? <span className="text-faint">· {l.store}</span> : null}
                {l.fanout > 1 ? <span className="text-faint">· {num(l.fanout)} records</span> : null}
              </div>
            </button>
          </motion.li>
        ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function Inspector({ line, onClose }: { line: Line; onClose: () => void }) {
  return (
    <div className="enter p-4 lg:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">Why this line {line.outcome === "settled" ? "settled" : line.outcome === "waiting" ? "is waiting" : "was held"}</div>
        <button onClick={onClose} className="text-[12px] text-link hover:text-accent">Back to the curve</button>
      </div>
      <div className="num mt-2 break-all text-[13px] text-ink">{line.memo}</div>
      <div className="num mt-1 text-[12px] text-secondary">{line.date} · {line.account} · {rp(line.amount)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="panel p-3">
          <div className="eyebrow">Which store</div>
          {line.votes.length ? line.votes.map((v) => (
            <div key={v.store} className="mt-2 text-[12px]">
              <div className="flex justify-between"><span className="font-medium">{v.store}</span><span className="num text-secondary">{v.score.toFixed(2)}</span></div>
              <div className="text-faint">{v.reasons.join(", ")}</div>
            </div>
          )) : <div className="mt-2 text-[12px] text-faint">No store evidence.</div>}
          {line.store ? <div className="mt-2 text-[12px] text-secondary">Placed at <span className="font-medium text-ink">{line.store}</span>, {(line.confidence * 100).toFixed(0)}% confident.</div> : null}
        </div>
        <div className="panel p-3">
          <div className="eyebrow">What it pays for</div>
          <div className="mt-2 text-[12.5px] text-body">{line.note}</div>
          {line.outcome === "settled" ? <div className="mt-2 text-[12px] text-secondary">Matched to <span className="font-medium text-ink">{num(Math.max(1, line.fanout))}</span> {line.matched?.replace(/_/g, " ") ?? "records"}, settled under rule <span className="num font-medium text-ink">{line.rule}</span> within its approved limit.</div> : null}
        </div>
      </div>
      <p className="mt-4 text-[12px] text-faint">Every decision like this is written to the record with its evidence and the rule that allowed it. The engine never approves anything without an approved rule.</p>
    </div>
  );
}

function Curve({ curve, answered, phase }: { curve: Rec["months"]; answered: string[]; phase: Phase }) {
  const W = 560, H = 220, L = 36, Rr = 12, T = 18, B = 26, lo = 0.75;
  const x = (mo: number) => L + ((mo - 1) / 11) * (W - L - Rr);
  const y = (r: number) => T + (1 - (r - lo) / (1 - lo)) * (H - T - B);
  const pts = curve.map((c) => ({ m: c.month, r: c.firstSettled / c.total }));
  const path = pts.map((q, i) => `${i ? "L" : "M"}${x(q.m).toFixed(1)},${y(q.r).toFixed(1)}`).join(" ");
  return (
    <div className="p-4 lg:p-5">
      <div className="flex items-baseline justify-between"><h2 className="title text-[20px]">Learning curve</h2><span className="text-[11.5px] text-faint">settled automatically on first pass</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Share settled automatically on first pass by month">
        {[0.75, 0.8, 0.85, 0.9, 0.95, 1].map((g) => <g key={g}><line x1={L} x2={W - Rr} y1={y(g)} y2={y(g)} stroke="var(--color-hairline)" strokeWidth={0.6} strokeDasharray={g === 0.75 ? "" : "2 4"} /><text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--color-faint)">{Math.round(g * 100)}%</text></g>)}
        {MONTH_LABELS.map((mo, i) => <text key={mo} x={x(i + 1)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-faint)">{mo[0]}</text>)}
        {path ? <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} strokeLinejoin="round" /> : null}
        {pts.map((q) => <g key={q.m}><circle cx={x(q.m)} cy={y(q.r)} r={3.5} fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth={1.75} /><text x={x(q.m)} y={y(q.r) + 16} textAnchor="middle" fontSize="10" fill="var(--color-secondary)">{(q.r * 100).toFixed(0)}</text></g>)}
        {LIVE.filter((r) => answered.includes(r.key)).map((r) => { const q = pts.find((z) => z.m === r.month); return q ? <text key={r.key} x={x(r.month)} y={y(q.r) - 10} textAnchor="middle" fontSize="15" fill="var(--color-hold)" style={{ fontFamily: "var(--font-music)" }}>𝄐</text> : null; })}
      </svg>
      <p className="mt-2 text-[12px] text-faint">{phase === "idle" ? "Press Close the year. The curve climbs as answers become rules." : "Each 𝄐 is an answer you gave that became a rule."}</p>
    </div>
  );
}

function Ask({ room, onAnswer }: { room: Room; onAnswer: () => void }) {
  const q = room.question!;
  const who = q.askOf === "cfo" ? "CFO" : "Accountant";
  return (
    <div className="enter max-h-[60%] shrink-0 overflow-y-auto overscroll-contain border-t border-hairline bg-warm p-4">
      <div className="flex items-center gap-2"><Avatar who={q.askOf} size={24} /><span className="eyebrow">You are the {who} · one question</span></div>
      <p className="title mt-2 text-[17px] leading-snug">{q.text}</p>
      <div className="mt-3 grid gap-2">
        {q.options.map((o) => {
          const rec = o.id === q.answer;
          return (
            <button key={o.id} disabled={!rec} onClick={onAnswer}
              className={`calm rounded-[6px] border px-3.5 py-2.5 text-left ${rec ? "border-accent bg-ground hover:bg-accent-tint" : "cursor-not-allowed border-hairline bg-well opacity-60"}`}>
              <div className="text-[13.5px] font-medium">{o.label}</div>
              <div className="mt-0.5 text-[12px] text-secondary">{o.impact}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">This replay follows the answer given in the recorded run. The live system handles every answer.</p>
    </div>
  );
}
