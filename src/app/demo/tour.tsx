"use client";
// The guided demo (`/demo?guide`): the year stops at six moments and shows what is happening underneath, one idea at a
// time. Each stop is a phrase, a small picture and one button named for what it does next ("Find the store", "Approve
// as CFO"); Space presses it too, so a recording can step through with the keyboard. Every figure is read from the
// recording. See DESIGN.md, Guided demo.
import React, { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import recording from "@/demo/recording.json";
import { num, pct, rpShort } from "../../../convex/lib/format";
import { Avatar } from "@/components/caseRoom";
import { Button, Pill } from "@/components/ui";
import { DAY_ZERO, fitFigure, seenOf } from "@/components/dayZero";
import { LY } from "@/components/learningYear";

type Msg = { speaker: string; kind: string; text: string; staged: boolean };
type Room = { narrated: string | null; title: string; count: number; amount: number; question: { askOf: string; answer: string | null; options: { id: string; label: string }[] } | null; messages: Msg[] };
type Rule = { id: string; title: string; learnedInMonth: number; program: { match?: string; params?: Record<string, unknown> }; seen?: { count: number; scope: string } | null; backtest: { correct: number; covered: number } | null };
type Fan = { memo: string; amount: number; date: string; store: string | null; rule: string | null; fanout: number; note: string; votes: { reasons: string[] }[] };
const R = recording as unknown as { rooms: Room[]; rules: Rule[]; fan: Fan | null };

export type Stop = "day0" | "settle" | "hold" | "learn" | "refuse" | "result";
export const STOPS: Stop[] = ["day0", "settle", "hold", "learn", "refuse", "result"];

const EASE = [0.22, 1, 0.36, 1] as const;
const MUSIC = { fontFamily: "var(--font-music)" };
const DAY0 = R.rules.filter((r) => !r.learnedInMonth);
const ruleById = (id: string | null) => R.rules.find((r) => r.id === id) ?? null;
const STORY_A = R.rooms.find((r) => r.narrated === "A") ?? null;
const STORY_B = R.rooms.find((r) => r.narrated === "B") ?? null;
// The rule story A's answer became, read from the manager's "rN approved" line.
const A_RULE = ruleById(STORY_A?.messages.map((m) => /^(r\d+) approved/.exec(m.text)?.[1]).find(Boolean) ?? null);
const A_ANSWER = STORY_A?.question?.options.find((o) => o.id === STORY_A.question?.answer)?.label ?? null;
const B_DENIED = STORY_B?.messages.find((m) => m.kind === "denied") ?? null;

// What each stop says, and the button for each of its steps; the last button leaves the stop.
const COPY: Record<Stop, { tag: string; title: string; buttons: string[] }> = {
  day0: { tag: "Day 0", title: `Last year's books become ${DAY0.length} rules.`, buttons: ["Approve as CFO", "Close January"] },
  settle: { tag: "Settles on its own", title: "A rule explains it, so it settles.", buttons: ["Find the store", "Find the rule", "Settle it", "Keep going"] },
  hold: { tag: "Holds and asks", title: "No rule fits, so it holds.", buttons: ["Call the agents", "Open the meeting"] },
  learn: { tag: "Learns", title: "One answer becomes one tested rule.", buttons: ["Write the rule", "Backtest it", "Approve as CFO", "Keep going"] },
  refuse: { tag: "Guardrails", title: "Agents propose. Only people approve.", buttons: ["Let it approve itself", "Watch the meeting"] },
  result: { tag: "The result", title: "It got better every month.", buttons: ["See the closed year"] },
};

// Keyed by its stop, so every stop starts at its first step.
export function Tour({ stop, onDone, onSkip }: { stop: Stop; onDone: () => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const c = COPY[stop];
  const last = c.buttons.length - 1;
  const next = () => (step >= last ? onDone() : setStep(step + 1));

  // Space, Enter or → presses the button, unless a control has focus (it handles its own keys).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (![" ", "Enter", "ArrowRight"].includes(e.key)) return;
      if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const n = STOPS.indexOf(stop);
  return (
    <motion.section key={stop} className="card flex min-h-[460px] flex-col overflow-hidden xl:h-[max(520px,calc(100dvh-21.5rem))]" aria-label={c.tag}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-4 lg:px-7 lg:py-5">
        <div className="min-w-0">
          <Pill tone="accent">{c.tag}</Pill>
          <h2 className="display mt-3 text-[clamp(24px,2.8vw,36px)]">{c.title}</h2>
        </div>
        <button onClick={onSkip} className="calm shrink-0 text-[12px] text-faint hover:text-accent">Skip the tour</button>
      </header>
      <div className="scroll-quiet flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-canvas px-5 py-6 lg:px-8">
        <div className="w-full min-w-0 max-w-[1080px]">{VIEW[stop](step, next)}</div>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline px-5 py-3.5 lg:px-7">
        <div className="flex items-center gap-1.5" aria-label={`Stop ${n + 1} of ${STOPS.length}`}>
          {STOPS.map((s, i) => <span key={s} className={`h-1.5 rounded-full transition-all duration-300 ${i === n ? "w-5 bg-accent" : i < n ? "w-1.5 bg-heading-2" : "w-1.5 bg-mute"}`} />)}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11.5px] text-faint sm:inline">or press <span className="kbd">Space</span></span>
          <Button variant="primary" onClick={next}>{c.buttons[step]}</Button>
        </div>
      </footer>
    </motion.section>
  );
}

// ---- The pictures ---------------------------------------------------------------------------------------------------

const VIEW: Record<Stop, (step: number, next: () => void) => ReactNode> = {
  day0: (step) => <DayZero approved={step >= 1} />,
  settle: (step) => <Settle step={step} />,
  hold: (step) => <Hold step={step} />,
  learn: (step) => <Learn step={step} />,
  refuse: (step) => <Refuse tried={step >= 1} />,
  result: () => <Result />,
};

function Show({ when, delay = 0, children, className = "" }: { when: boolean; delay?: number; children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial={false} animate={when ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 8, filter: "blur(4px)" }}
      transition={{ duration: 0.45, delay: when ? delay : 0, ease: EASE }} aria-hidden={!when}>
      {children}
    </motion.div>
  );
}

// A row of steps joined by arrows; each node fades in when the step reaches it.
function Chain({ step, nodes }: { step: number; nodes: { label: string; body: ReactNode; tone?: "hold" | "accent" | "danger" }[] }) {
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:gap-0" style={{ ["--n" as string]: nodes.length }}>
      {nodes.map((nd, i) => (
        <li key={nd.label} className="flex min-w-0 items-stretch">
          {i > 0 ? (
            <Show when={step >= i} className="hidden w-8 shrink-0 items-center justify-center lg:flex">
              <svg width="28" height="12" aria-hidden><path d="M0 6h24M19 1l5 5-5 5" fill="none" stroke="var(--color-mute)" strokeWidth="1.5" /></svg>
            </Show>
          ) : null}
          <Show when={step >= i} className="min-w-0 flex-1">
            <div className={`h-full rounded-[10px] border bg-ground p-4 shadow-[0_1px_2px_rgb(85_40_20/0.06)] ${nd.tone === "hold" ? "border-hold-tint-strong" : nd.tone === "accent" ? "border-accent" : nd.tone === "danger" ? "border-danger" : "border-hairline"}`}>
              <div className="eyebrow">{nd.label}</div>
              <div className="mt-2">{nd.body}</div>
            </div>
          </Show>
        </li>
      ))}
    </ol>
  );
}

function Big({ children, sub, tone }: { children: ReactNode; sub?: ReactNode; tone?: "hold" | "accent" }) {
  return (
    <>
      <div className={`figure text-[26px] leading-tight ${tone === "hold" ? "text-hold" : tone === "accent" ? "text-accent" : "text-heading"}`}>{children}</div>
      {sub ? <div className="mt-1 text-[12.5px] text-secondary">{sub}</div> : null}
    </>
  );
}

function Stamp({ show, delay = 0 }: { show: boolean; delay?: number }) {
  return (
    <motion.span className="inline-flex shrink-0 items-center gap-1 rounded-[4.5px] border-[1.5px] border-heading-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-heading-2"
      initial={false} animate={show ? { opacity: 1, scale: 1, rotate: -4 } : { opacity: 0, scale: 1.6, rotate: -12 }} transition={{ duration: 0.3, delay: show ? delay : 0, ease: EASE }}>
      CFO ✓
    </motion.span>
  );
}

function DayZero({ approved }: { approved: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
      <ul className="card min-w-0 divide-y divide-hairline">
        {DAY0.map((r, i) => {
          const fit = fitFigure(r.program);
          return (
            <motion.li key={r.id} className="flex items-center gap-3 px-4 py-2.5" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: EASE }}>
              <span className="num w-6 shrink-0 text-[12px] text-faint">{r.id}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{DAY_ZERO[r.id]?.policy ?? r.title}</span>
              {fit.values.length ? <span className="num hidden shrink-0 rounded-[4.5px] bg-accent-tint px-1.5 py-0.5 text-[11.5px] text-accent sm:inline">{fit.text(fit.values)}</span> : null}
              <span className="num hidden w-24 shrink-0 text-right text-[11.5px] text-faint md:inline">{num(seenOf(r)?.count ?? 0)} lines</span>
              <span className="shrink-0 text-right sm:w-14"><Stamp show={approved} delay={i * 0.08} /></span>
            </motion.li>
          );
        })}
      </ul>
      <div className="text-center lg:text-left">
        <Show when={!approved}><p className="text-[13px] text-secondary">Fitted on last year&apos;s matched lines.</p></Show>
        <Show when={approved} delay={DAY0.length * 0.08}>
          <div className="figure text-[56px] leading-none text-accent">{pct(LY.first, 0)}</div>
          <p className="mt-2 text-[13px] text-secondary">of January settles on day one.</p>
        </Show>
      </div>
    </div>
  );
}

function Settle({ step }: { step: number }) {
  const f = R.fan;
  if (!f) return null;
  const rule = ruleById(f.rule);
  return (
    <div className="space-y-5">
      <Chain step={step} nodes={[
        { label: "Bank line", body: <><div className="num truncate text-[12px] text-secondary" title={f.memo}>{f.memo}</div><Big sub={f.date}>{rpShort(f.amount)}</Big></> },
        { label: "Which store", body: <Big sub={f.votes[0]?.reasons.slice(0, 2).join(" · ")}>{f.store}</Big> },
        { label: "Which rule", body: <><Big>{rule?.id}</Big><div className="mt-1 text-[12.5px] text-secondary">{rule ? DAY_ZERO[rule.id]?.policy ?? rule.title : null}</div></> },
        { label: "Settled", tone: "accent", body: <Big tone="accent" sub={`${num(f.fanout)} orders, one transfer`}>✓ Settled</Big> },
      ]} />
      <Show when={step >= 3} delay={0.3}><p className="text-center text-[13px] text-secondary">No person touched it.</p></Show>
    </div>
  );
}

const CAST: { who: string; name: string; does: string; src: string }[] = [
  { who: "investigator", name: "Investigator", does: "finds the pattern", src: "Claude" },
  { who: "auditor", name: "Auditor", does: "tries to break it", src: "Claude" },
  { who: "learner", name: "Learner", does: "writes the rule", src: "Claude" },
  { who: "manager", name: "Manager", does: "6 turns, asks once", src: "Code" },
];
function Hold({ step }: { step: number }) {
  const a = STORY_A;
  if (!a) return null;
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-[10px] border border-hold-tint-strong bg-hold-tint p-5">
        <div className="flex items-center gap-2"><span className="text-[20px] leading-none text-hold" style={MUSIC} aria-hidden>𝄐</span><span className="eyebrow text-hold-ink">Held</span></div>
        <div className="figure mt-3 text-[34px] leading-none text-hold">{num(a.count)} lines</div>
        <div className="mt-1.5 text-[13px] text-hold-ink">{rpShort(a.amount)} · bank and receipts disagree</div>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CAST.map((c, i) => (
          <li key={c.who}>
            <Show when={step >= 1} delay={i * 0.12}>
              <div className="flex h-full flex-col items-center rounded-[10px] border border-hairline bg-ground p-4 text-center shadow-[0_1px_2px_rgb(85_40_20/0.06)]">
                <Avatar who={c.who} size={36} />
                <div className="mt-2 text-[14px] font-medium text-ink">{c.name}</div>
                <div className="mt-0.5 text-[12.5px] text-secondary">{c.does}</div>
                <div className="mt-2"><Pill tone={c.src === "Claude" ? "accent" : "neutral"}>{c.src}</Pill></div>
              </div>
            </Show>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Learn({ step }: { step: number }) {
  const r = A_RULE, bt = r?.backtest;
  if (!r || !bt) return null;
  return (
    <div className="space-y-5">
      <Chain step={step} nodes={[
        { label: "The answer", tone: "hold", body: <><div className="flex items-center gap-2"><Avatar who={STORY_A?.question?.askOf ?? "accountant"} size={24} /><span className="text-[12px] text-faint">Accountant</span></div><div className="mt-2 text-[14px] font-medium leading-snug text-ink">{A_ANSWER}</div></> },
        { label: "The rule", body: <><Big>{r.id}</Big><div className="mt-1 text-[12.5px] leading-snug text-secondary">{r.title}</div></> },
        { label: "Backtest", body: <Big sub="right, on last year">{num(bt.correct)} <span className="text-[16px] text-faint">of {num(bt.covered)}</span></Big> },
        { label: "Approved", tone: "accent", body: <><div className="pt-1"><Stamp show={step >= 3} delay={0.2} /></div><div className="mt-2 text-[12.5px] text-secondary">Never asked again.</div></> },
      ]} />
    </div>
  );
}

function Refuse({ tried }: { tried: boolean }) {
  return (
    <div className="mx-auto grid max-w-[820px] items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
      <div className="flex flex-col items-center rounded-[10px] border border-hairline bg-ground p-5 text-center shadow-[0_1px_2px_rgb(85_40_20/0.06)]">
        <Avatar who="investigator" size={40} />
        <div className="mt-2 text-[14px] font-medium text-ink">Investigator</div>
        <div className="mt-0.5 text-[12.5px] text-secondary">can propose · can ask</div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className={`num text-[12px] ${tried ? "text-danger" : "text-faint"}`}>approve</span>
        <svg width="120" height="14" aria-hidden className="overflow-visible">
          <motion.path d="M0 7h112M106 1l6 6-6 6" fill="none" strokeWidth="1.75" initial={false} animate={{ stroke: tried ? "var(--color-danger)" : "var(--color-mute)" }} />
          <AnimatePresence>{tried ? <motion.circle cx="0" cy="7" r="5" fill="var(--color-danger)" initial={{ cx: 0, opacity: 1 }} animate={{ cx: 104 }} transition={{ duration: 0.7, ease: EASE }} /> : null}</AnimatePresence>
        </svg>
      </div>
      <div className={`relative flex flex-col items-center rounded-[10px] border p-5 text-center shadow-[0_1px_2px_rgb(85_40_20/0.06)] transition-colors duration-500 ${tried ? "border-danger bg-danger-tint" : "border-hairline bg-ground"}`}>
        <Avatar who="gateway" size={40} />
        <div className="mt-2 text-[14px] font-medium text-ink">Gateway</div>
        <div className="mt-0.5 text-[12.5px] text-secondary">the only key to the books</div>
        <Show when={tried} delay={0.7} className="mt-3"><span className="text-[13px] font-medium text-danger">✕ Blocked in code</span></Show>
      </div>
      <Show when={tried} delay={1.1} className="sm:col-span-3">
        <div className="panel mx-auto mt-2 flex max-w-[560px] items-center justify-between gap-3 px-4 py-2.5">
          <span className="num truncate text-[12px] text-secondary">› {B_DENIED?.text.replace(/^Tried to approve this story itself\. /, "") ?? "Investigator may not approve."}</span>
          {B_DENIED?.staged ? <Pill>Staged</Pill> : null}
        </div>
        <p className="mt-2 text-center text-[12.5px] text-faint">On the record.</p>
      </Show>
    </div>
  );
}

function Result() {
  const tile = (figure: ReactNode, label: string, sub?: string) => (
    <div className="rounded-[10px] border border-hairline bg-ground p-5 text-center shadow-[0_1px_2px_rgb(85_40_20/0.06)]">
      <div className="figure text-[clamp(32px,3.6vw,46px)] leading-none text-heading">{figure}</div>
      <div className="mt-2 text-[13px] text-secondary">{label}</div>
      {sub ? <div className="mt-0.5 text-[12px] text-faint">{sub}</div> : null}
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tile(<>{pct(LY.first, 0)} → <span className="text-accent">{pct(LY.last, 0)}</span></>, "settled on its own, Jan to Dec", `${pct(LY.baselineLast, 0)} without learning`)}
      {tile(num(LY.heldLearned), "lines left for people", `${num(LY.heldBaseline)} without learning`)}
      {tile(num(LY.rules.length), "rules learned from answers", "each backtested first")}
    </div>
  );
}
