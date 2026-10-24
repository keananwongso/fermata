"use client";
// The public demo: a replay of one recorded run. No Claude calls and no writes; the agents' messages are the
// real output from that run, and the engine's lines are the same engine replayed on the same year.
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import recording from "@/demo/recording.json";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, rp, rpShort } from "../../../convex/lib/format";
import { Avatar, ChatList, type ChatMessage } from "@/components/caseRoom";
import { Button, LinkArrow, LinkButton, Pill } from "@/components/ui";
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
  months: { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number; released: number }[]; yearEnd: number;
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

  const asking = phase === "question" && !!room?.question;

  // Hints for a visitor who pauses: the hint for this moment shows after a while with no click or key.
  const { hint, acted, show, hide } = useHints();
  const waitFor: HintKey | null = phase === "idle" ? "start" : asking ? "answer" : phase === "done" ? "explore" : null;
  useEffect(() => {
    if (!waitFor) return;
    const t = setTimeout(() => show(waitFor), HINT_WAIT[waitFor]);
    return () => clearTimeout(t);
  }, [waitFor, acted, show]);
  // A hint belongs to its moment, so it goes as soon as the phase moves on.
  const tip = (k: HintKey) => hint === k && (k === "stream" ? phase === "running" : k === waitFor);

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

  // Counters: everything before this month, plus this month's share so far. Held lines a new rule releases count once
  // the month's question is answered, and December's waiting lines once the year closes, so done shows final.settled.
  const m = R.months[month - 1];
  const f = phase === "running" ? p : phase === "idle" ? 0 : 1;
  const processed = phase === "idle" ? 0 : Math.round(cum(month - 1, (x) => x.total) + m.total * f);
  const settled = phase === "idle" ? 0 : Math.round(cum(month - 1, (x) => x.firstSettled + x.settledLater + x.released) + (m.firstSettled + m.settledLater) * f
    + (phase === "after" || phase === "done" ? m.released : 0) + (phase === "done" ? R.yearEnd : 0));
  const roomsOpen = R.rooms.filter((r) => r.month < month || (r.month === month && (phase !== "running" || p > 0.6)));
  const visibleRooms = phase === "idle" ? [] : roomsOpen;
  // The engine stream runs on across months and shows at most one new line every 250ms, sampled evenly from the month's
  // real lines, so lines never arrive faster than they can slide in (at 2x and 4x it shows fewer of them).
  const sampled = (mo: number) => {
    const all = R.lines[String(mo)] ?? [];
    const n = Math.max(3, Math.min(all.length, Math.floor(MONTH_MS / speed / 250)));
    return all.filter((_, i) => i % Math.ceil(all.length / n) === 0);
  };
  const now = sampled(month);
  const stream = phase === "idle" ? [] : [...(month > 1 ? sampled(month - 1) : []), ...now.slice(0, Math.max(1, Math.ceil(now.length * f)))].slice(-9).reverse();
  const curve = R.months.filter((x) => phase !== "idle" && (x.month < month || (x.month === month && f >= 1)));
  const rules = R.rules.filter((r) => r.learnedInMonth === 0 || answered.some((k) => R.rooms.find((x) => x.key === k)?.month === r.learnedInMonth));

  return (
    <Reveal className="space-y-5" stagger={0.08}>
      <RevealItem className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Pill tone="accent">Live demo</Pill></div>
          <h1 className="display mt-3 text-[clamp(30px,3.6vw,44px)]">Watch Fermata close a year</h1>
          <p className="mt-2 max-w-[640px] text-[13.5px] text-secondary">
            104,820 bank lines across six channels and five shared accounts. The engine settles what it can explain; when it can&apos;t, the agents meet, and you answer the one question they bring you. Every message from the agents is real Claude output.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "idle" ? (
            <span className="relative">
              <Button variant="primary" onClick={start}>Close the year</Button>
              <Hint show={tip("start")} className="absolute left-0 top-full z-10 mt-2.5 lg:left-auto lg:right-0 lg:[--tip-x:calc(100%-36px)]">{HINT_TEXT.start}</Hint>
            </span>
          )
            : phase === "done" ? <Button onClick={restart}>Play again</Button>
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

      {/* While a room meets, the engine (paused anyway) steps aside so the conversation gets the width, and the
          question takes the right column beside it. The columns resize rather than jump; spacing lives inside the
          columns so a collapsed column leaves no gap. */}
      <RevealItem className={`grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] xl:h-[max(520px,calc(100dvh-21.5rem))] xl:gap-x-0 xl:grid-rows-[minmax(0,1fr)] xl:transition-[grid-template-columns] xl:duration-700 xl:ease-brand ${asking ? "xl:grid-cols-[0px_minmax(0,1fr)_456px]" : room ? "xl:grid-cols-[0px_minmax(0,1fr)_296px]" : "xl:grid-cols-[336px_minmax(0,1fr)_296px]"}`}>
        <div inert={!!room} className={`min-w-0 xl:flex xl:min-h-0 xl:overflow-hidden xl:transition-[opacity,padding] xl:duration-500 xl:ease-brand ${room ? "xl:pointer-events-none xl:pr-0 xl:opacity-0" : "xl:pr-4"}`}>
          <Stream stream={stream} month={month} running={phase === "running"} onPick={setLine} picked={line} hint={tip("stream")} onLinger={() => show("stream")} onLeave={() => hide("stream")} />
        </div>
        <section className="card flex min-h-[460px] min-w-0 flex-col overflow-hidden xl:min-h-0" aria-label={room ? "Case room" : "Learning curve"}>
          {room ? (
            <motion.div key={room.key} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
                <Pill tone="hold">Story {room.narrated}</Pill><Pill tone="accent">Live agents</Pill>
                <h2 className="title min-w-0 flex-1 truncate text-[17px]" title={room.title}>{room.title}</h2>
              </header>
              <div className="scroll-quiet max-h-[560px] min-h-0 flex-1 overflow-y-auto bg-canvas px-4 pb-4 pt-1 lg:px-6 xl:max-h-none" role="log" aria-live="polite">
                <ChatList msgs={shown} animate />
                <div ref={end} />
              </div>
            </motion.div>
          ) : <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">{line ? <Inspector line={line} onClose={() => setLine(null)} /> : <Curve curve={curve} answered={answered} phase={phase} />}</div>}
        </section>
        <div className="flex min-w-0 flex-col lg:col-span-2 xl:col-span-1 xl:min-h-0 xl:pl-4">
          <AnimatePresence mode="wait" initial={false}>
            {asking && room ? (
              <motion.div key="ask" className="card flex min-h-0 flex-1 flex-col overflow-hidden" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <Ask room={room} onAnswer={answer} hint={tip("answer")} />
              </motion.div>
            ) : (
              <motion.aside key="rooms" className="card flex min-h-0 flex-1 flex-col p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div className="eyebrow">Case rooms</div>
                {visibleRooms.length === 0 ? <p className="mt-2 text-[12px] text-faint">Rooms open here when the engine holds something it can&apos;t explain.</p> : null}
                <ul className="scroll-quiet mt-2 max-h-[420px] min-h-0 flex-1 space-y-1 overflow-y-auto xl:max-h-none">
                  <AnimatePresence initial={false}>
                  {[...visibleRooms].reverse().map((r) => (
                    <motion.li key={r.key} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12px] ${r.live ? "bg-accent-tint" : ""}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${answered.includes(r.key) ? "bg-success" : r.live && room?.key === r.key ? "bg-accent breathe-dot" : "bg-hold"}`} />
                      <span className="num w-7 shrink-0 text-faint">{MONTH_LABELS[r.month - 1]}</span>
                      <span className="min-w-0 flex-1 truncate" title={r.title}>{r.title}</span>
                      {r.live ? <span className="text-[10.5px] text-accent">Claude</span> : null}
                    </motion.li>
                  ))}
                  </AnimatePresence>
                </ul>
                {/* The hand-off: the guided path ends in the closed books, where the visitor explores on their own. */}
                {phase === "done" ? (
                  <div className="enter mt-4 border-t border-hairline pt-4">
                    <p className="text-[12.5px] text-secondary">The year is closed. {num(R.final.settled)} lines settled, {num(R.rooms.length)} rooms, about 40 decisions for people. Explore the closed books, or ask them anything.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="relative">
                        <LinkButton href="/dashboard">Explore the closed books</LinkButton>
                        <Hint show={tip("explore")} arrow="down" className="absolute bottom-full left-0 z-10 mb-2.5">{HINT_TEXT.explore}</Hint>
                      </span>
                      <LinkArrow href="/dashboard?view=ask">Ask the books</LinkArrow>
                    </div>
                    <Link href={CONSOLE_LINK.href} className="calm mt-3 inline-block text-[12px] text-faint hover:text-accent">{CONSOLE_LINK.label} →</Link>
                  </div>
                ) : null}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </RevealItem>
    </Reveal>
  );
}

const WHOLE = { maximumFractionDigits: 0 };

// ---- Hints -------------------------------------------------------------------------------------------------------

// Only for a visitor who hesitates: each waits for a pause, shows at most once per visit, one at a time, never takes a
// click, and goes the moment the visitor acts. `?tips=off` turns them off for the visit (for recording).
type HintKey = "start" | "answer" | "explore" | "stream";
const HINT_TEXT: Record<HintKey, string> = {
  start: "Start here. Fermata closes January to December in about two minutes.",
  answer: "Each option shows what it will do. Pick an answer to carry on.",
  explore: "Every figure, rule and case room from this year is in here.",
  stream: "Click a line to see why it settled.",
};
// The first wait includes the splash on a cold load.
const HINT_WAIT: Record<HintKey, number> = { start: 3500, answer: 5000, explore: 3000, stream: 1500 };
const SEEN = new Set<HintKey>();
let hintsOff = false;

function useHints() {
  const [hint, setHint] = useState<HintKey | null>(null);
  const [acted, setActed] = useState(0);
  // Any click, tap or key is the visitor acting: the hint goes, and every pause starts over.
  useEffect(() => {
    const act = () => { setHint(null); setActed((n) => n + 1); };
    window.addEventListener("pointerdown", act, true);
    window.addEventListener("keydown", act, true);
    return () => { window.removeEventListener("pointerdown", act, true); window.removeEventListener("keydown", act, true); };
  }, []);
  const show = useCallback((k: HintKey) => {
    if (new URLSearchParams(window.location.search).get("tips") === "off") hintsOff = true;
    if (hintsOff || SEEN.has(k)) return;
    SEEN.add(k);
    setHint(k);
  }, []);
  const hide = useCallback((k: HintKey) => setHint((h) => (h === k ? null : h)), []);
  return { hint, acted, show, hide };
}

// A `.tip` bubble beside what it explains. It ignores the pointer, so it never gets in the way of a click.
function Hint({ show, arrow = "up", className = "", children }: { show: boolean; arrow?: "up" | "down"; className?: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div data-hint role="status" data-arrow={arrow} className={`tip pointer-events-none ${className}`}
          initial={{ opacity: 0, y: arrow === "up" ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

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

function Stream({ stream, month, running, onPick, picked, hint, onLinger, onLeave }: { stream: Line[]; month: number; running: boolean; onPick: (l: Line) => void; picked: Line | null; hint: boolean; onLinger: () => void; onLeave: () => void }) {
  // A mouse that lingers over the running stream without clicking gets the hint that lines open.
  const linger = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <section className="card relative flex min-w-0 flex-col p-4 xl:min-h-0 xl:w-[320px] xl:shrink-0" aria-label="The engine"
      onPointerEnter={(e) => { if (e.pointerType === "mouse" && running) linger.current = setTimeout(onLinger, HINT_WAIT.stream); }}
      onPointerDown={() => clearTimeout(linger.current)}
      onPointerLeave={() => { clearTimeout(linger.current); onLeave(); }}>
      <Hint show={hint} className="absolute bottom-4 left-4 z-10">{HINT_TEXT.stream}</Hint>
      <div className="flex items-center justify-between">
        <div className="eyebrow">The engine · {MONTH_LABELS[month - 1]}</div>
        {running ? <span className="flex items-center gap-1.5 text-[11px] text-accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full bg-accent" />settling</span> : null}
      </div>
      <p className="mt-1 text-[11.5px] text-faint">A sample of real lines. Click one to see why.</p>
      <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_82%,transparent)]">
        {stream.length === 0 ? <li className="hatch rounded-[6px] border border-hairline px-3 py-8 text-center text-[12px] text-faint">Press Close the year</li> : null}
        {/* New lines slide in at the top; old ones leave at once under the fade, so a new month never overlaps the last. */}
        <AnimatePresence initial={false}>
        {stream.map((l) => (
          <motion.li key={l.memo + l.date + l.amount} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0 } }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
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

function Ask({ room, onAnswer, hint }: { room: Room; onAnswer: () => void; hint: boolean }) {
  const q = room.question!;
  const who = q.askOf === "cfo" ? "CFO" : "Accountant";
  // A white card like the others; only the band at the top is amber, because amber means waiting on a person.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-hold-tint-strong bg-hold-tint px-4 py-2.5 lg:px-5">
        <span className="breathe text-[16px] leading-none" style={{ fontFamily: "var(--font-music)" }} aria-hidden>𝄐</span>
        <span className="text-[12.5px] font-medium text-hold-ink">Waiting on you</span>
        <span className="ml-auto text-[12px] text-hold-ink/80">One question</span>
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
        <div className="flex items-center gap-2"><Avatar who={q.askOf} size={24} /><span className="eyebrow">You are the {who}</span></div>
        <p className="title mt-3 text-[18px] leading-snug">{q.text}</p>
        <div className="mt-4 grid gap-2">
          {q.options.map((o) => {
            const rec = o.id === q.answer;
            return (
              <button key={o.id} disabled={!rec} onClick={onAnswer}
                className={`calm rounded-[6px] border px-3.5 py-2.5 text-left ${rec ? "border-accent bg-ground shadow-[0_1px_2px_rgb(85_40_20/0.06)] hover:bg-accent-tint" : "cursor-not-allowed border-hairline bg-ground opacity-55"}`}>
                <div className="text-[13.5px] font-medium">{o.label}</div>
                <div className="mt-0.5 text-[12px] text-secondary">{o.impact}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-faint">Every answer works in the full console; here the year follows this one.</p>
      </div>
      {/* Under the scroll box rather than in it, so it shows however far the options run; nothing above it moves. */}
      <Hint show={hint} className="mx-4 mb-4 shrink-0 lg:mx-5">{HINT_TEXT.answer}</Hint>
    </div>
  );
}
