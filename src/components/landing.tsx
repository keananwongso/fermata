"use client";
// Illustrations for the landing page, built from the recorded run so every number on the page is real.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { LinkArrow, Tag } from "./ui";
import { BrandGrid, addScrollGate, scrollToY, withLenis } from "./motion";
import recording from "@/demo/recording.json";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, rpShort } from "../../convex/lib/format";
import { Avatar } from "./caseRoom";

type Line = { date: string; memo: string; amount: number; outcome: string; rule: string | null; store: string | null; fanout: number };
type Rule = { id: string; title: string; learnedInMonth: number; origin: string; backtest: { covered: number; precision: number } | null };
type Room = { key: string; month: number; live: boolean; narrated: string | null; messages: { speaker: string; to: string; kind: string; source: string; text: string }[] };
const R = recording as unknown as { lines: Record<string, Line[]>; rules: Rule[]; rooms: Room[]; months: { month: number; firstSettled: number; total: number }[] };

// The hero card: an agent closing March, line by line, until something needs a person.
export function AgentWorking() {
  const lines = (R.lines["3"] ?? []).filter((l) => l.outcome === "settled").slice(0, 5);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { const t = setTimeout(() => setStep(lines.length + 2), 0); return () => clearTimeout(t); }
    const id = setInterval(() => setStep((s) => (s >= lines.length + 4 ? 0 : s + 1)), 900);
    return () => clearInterval(id);
  }, [lines.length]);
  const held = step > lines.length;
  return (
    <div className="card overflow-hidden" aria-label="An agent closing March">
      <div className="flex items-center gap-2 border-b border-hairline bg-well px-4 py-3 text-[13px] text-secondary">
        <span className={`h-2 w-2 rounded-full ${held ? "bg-hold" : "bg-accent breathe-dot"}`} />
        Closing March · {num(8320)} bank lines
      </div>
      <ul className="space-y-1.5 p-4">
        {lines.map((l, i) => (
          <li key={l.memo + l.date} className={`flex items-center gap-3 rounded-[6px] px-2.5 py-2 transition-opacity duration-300 ${i < step ? "opacity-100" : "opacity-25"}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${i < step ? "bg-success text-white" : "border border-strong"}`}>{i < step ? "✓" : ""}</span>
            <span className="num min-w-0 flex-1 truncate text-[12px] text-secondary">{l.memo}</span>
            <span className="num shrink-0 text-[11.5px] text-faint">{l.rule}{l.fanout > 1 ? ` · ${l.fanout} records` : ""}</span>
          </li>
        ))}
        <li className={`flex items-center gap-3 rounded-[6px] border px-2.5 py-2 transition-all duration-300 ${held ? "border-hold-tint-strong bg-hold-tint/50 opacity-100" : "border-transparent opacity-25"}`}>
          <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${held ? "animate-spin border-hold border-t-transparent" : "border-strong"}`} style={{ animationDuration: "1.4s" }} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">1,186 school fees: bank and receipts disagree</span>
        </li>
      </ul>
      <div className="flex justify-center pb-4">
        <span className={`rounded-[6px] px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.06em] transition-all duration-300 ${step > lines.length + 1 ? "bg-hold text-white" : "bg-inset text-faint"}`}>
          𝄐 Input needed · one question
        </span>
      </div>
    </div>
  );
}

// Beat 1: six sources and five shared bank accounts, joined by Fermata.
export function Sources() {
  const banks = ["Main account", "Second account", "Third account", "School fees, virtual", "Head office"];
  const records = ["ERP and cash book", "Shopee", "Tokopedia", "Website gateway", "Dealer invoices", "School receipts"];
  const chip = (t: string) => <li key={t} className="rounded-[6px] border border-hairline bg-ground px-2.5 py-1.5 text-[12px] text-body shadow-[0_1px_1px_rgb(85_40_20/0.04)]">{t}</li>;
  return (
    <div className="frame">
      <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 sm:gap-5 sm:p-6">
        <div><div className="eyebrow mb-2">5 bank accounts</div><ul className="space-y-1.5">{banks.map(chip)}</ul></div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-px bg-strong" aria-hidden />
          <div className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-heading text-[30px] text-hold shadow-[0_8px_24px_-12px_rgb(10_45_102/0.6)]" style={{ fontFamily: "var(--font-music)" }} aria-label="Fermata"><span style={{ transform: "translateY(0.28em)" }}>𝄐</span></div>
          <div className="h-10 w-px bg-strong" aria-hidden />
        </div>
        <div><div className="eyebrow mb-2">6 sources of sales</div><ul className="space-y-1.5">{records.map(chip)}</ul></div>
      </div>
    </div>
  );
}

// Beat 2: rules learned from last year, then from a correction and an answer.
export function Rules() {
  return (
    <div className="frame">
      <ul className="card divide-y divide-hairline">
        {R.rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`num w-7 shrink-0 text-[12px] ${r.learnedInMonth ? "font-medium text-hold-ink" : "text-faint"}`}>{r.id}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-body" title={r.title}>{r.title}</span>
            <span className="shrink-0 text-[11.5px] text-faint">{r.learnedInMonth ? `${MONTH_LABELS[r.learnedInMonth - 1]} · from ${r.id === "r8" ? "a correction" : "an answer"}` : "last year"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Beat 3: a few lines of the real story B meeting, ending where a person comes in.
export function MiniRoom() {
  const room = R.rooms.find((r) => r.narrated === "B") ?? R.rooms.find((r) => r.live);
  const msgs = (room?.messages ?? []).filter((m) => m.kind === "message").slice(0, 3);
  const short = (t: string) => (t.length > 150 ? t.slice(0, t.lastIndexOf(" ", 150)) + "…" : t);
  return (
    <div className="frame">
      <div className="card space-y-3 p-4 sm:p-5">
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2.5">
            <Avatar who={m.speaker} size={28} />
            <div className="min-w-0">
              <div className="text-[11.5px] text-faint"><span className="font-medium text-ink">{m.speaker[0].toUpperCase() + m.speaker.slice(1)}</span> → {m.to === "room" ? "everyone" : m.to}</div>
              <div className="mt-1 rounded-[12px] rounded-tl-[4px] border border-hairline bg-ground px-3 py-2 text-[12.5px] leading-relaxed text-body">{short(m.text)}</div>
            </div>
          </div>
        ))}
        <div className="flex justify-center pt-1"><span className="rounded-full bg-inset px-3 py-1 text-[11.5px] text-secondary"><span className="font-medium text-ink">Meeting manager</span> · one question for the CFO</span></div>
        <div className="flex justify-center"><span className="rounded-[6px] bg-hold px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.06em] text-white">𝄐 Input needed</span></div>
      </div>
    </div>
  );
}

// Beat 4: the record, including what was refused.
export function RecordSample() {
  const rows: { who: string; what: string; tone?: "danger" | "hold" }[] = [
    { who: "engine", what: "Settled a Shopee payout against 840 orders under rule r4, approved by the CFO" },
    { who: "investigator", what: "Tried to approve its own story. Blocked in code: Investigator may not approve", tone: "danger" },
    { who: "manager", what: "People are asked once, after the Auditor has checked. Floor goes to the Auditor" },
    { who: "cfo", what: "Answered Yes on FIN_Z, confirmed back; r9 approved", tone: "hold" },
    { who: "gateway", what: "Posted 738 payouts to the books under r9" },
  ];
  return (
    <div className="frame">
      <ul className="card divide-y divide-hairline">
        {rows.map((r, i) => (
          <li key={i} className={`flex items-center gap-3 px-4 py-2.5 ${r.tone === "danger" ? "bg-danger-tint/60" : ""}`}>
            <Avatar who={r.who} size={24} />
            <span className={`min-w-0 flex-1 text-[12.5px] ${r.tone === "danger" ? "text-danger" : "text-body"}`}>{r.what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Proof: the curve and the meetings, side by side.
export function CurveAndMeetings() {
  const byMonth = Array.from({ length: 12 }, (_, i) => R.rooms.filter((r) => r.month === i + 1).length);
  const max = Math.max(...byMonth);
  return (
    <div className="grid grid-cols-12 items-end gap-1.5" role="img" aria-label="Meetings per month falling as the share settled automatically rises">
      {R.months.map((m, i) => (
        <div key={m.month} className="flex flex-col items-center gap-1">
          <span className="num text-[10.5px] text-accent">{Math.round((m.firstSettled / m.total) * 100)}</span>
          <div className="flex h-20 w-full items-end">
            <motion.div className="w-full rounded-t-[3px] bg-hold/80" initial={{ height: 0 }} whileInView={{ height: byMonth[i] ? `${Math.max(8, (byMonth[i] / max) * 100)}%` : "2px" }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <span className="text-[10.5px] text-faint">{MONTH_LABELS[i][0]}</span>
        </div>
      ))}
    </div>
  );
}

export const FAN = (recording as unknown as { fan: { amount: number; fanout: number } }).fan;
export const fanText = FAN ? `one payout of ${rpShort(FAN.amount)} settled against ${num(FAN.fanout)} orders` : "";

type Beat = { tag: string; title: string; body: ReactNode; visual: ReactNode };

// How it works. On wide screens the whole stage (title, card, description) is pinned while the page scrolls through a
// tall track; how far through the track you are picks the beat, and all three swap together, so only one beat is ever
// on screen. The section resists: scrolling through it is damped and the card visibly gives under the push, a gentle
// scroll glides on to the next beat, and a really fast fling still carries all the way through. The card opens out of a strip as the section arrives. On narrow screens
// the beats simply stack.
const HEAD = 104; // the sticky notice bar and header
export function HowItWorks({ beats }: { beats: Beat[] }) {
  const n = beats.length;
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  // The card gives under the push: it lags against the scroll and dips a little, then springs back when it stops.
  const push = useMotionValue(0);
  const springy = useSpring(push, { stiffness: 260, damping: 24 });
  const lag = useTransform(springy, (v) => Math.max(-26, Math.min(26, -v * 0.8)));
  const give = useTransform(springy, (v) => 1 - Math.min(Math.abs(v), 40) * 0.0016);
  const { scrollYProgress: through } = useScroll({ target: track, offset: [`start ${HEAD}px`, "end end"] });
  useMotionValueEvent(through, "change", (p) => setActive(Math.min(n - 1, Math.max(0, Math.floor(p * n + 0.001)))));
  const { scrollYProgress: arriving } = useScroll({ target: track, offset: ["start end", `start ${HEAD}px`] });
  const open = useSpring(arriving, { stiffness: 140, damping: 30, mass: 0.6 });
  const clip = useTransform(open, [0.3, 1], ["inset(42% 2% 42% 2% round 16px)", "inset(0% 0% 0% 0% round 16px)"]);
  const inner = useTransform(open, [0.75, 1], [0, 1]);
  const marks = useRef<(HTMLDivElement | null)[]>([]);
  const jump = (i: number) => { const m = marks.current[i]; if (m) scrollToY(m.getBoundingClientRect().top + window.scrollY); };
  useEffect(() => withLenis((l) => {
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let gliding = false, timer = 0, rest = 0, dir = 0, lastInput = 0, lastSize = 0;
    const where = () => {
      const el = track.current;
      if (!el || !el.offsetParent) return null;
      const step = window.innerHeight * STEP;
      return { step, start: el.getBoundingClientRect().top + window.scrollY - HEAD, last: (n - 1) * step };
    };
    const glide = (y: number) => {
      gliding = true;
      l.scrollTo(y, { duration: 0.6, easing: ease, force: true, onComplete: () => { gliding = false; } });
    };

    // Resistance: inside the section every wheel or touch movement carries the page only part as far, so the section
    // is heavy to push through. A gentle scroll comes to rest between beats and glides on to the next one; a really
    // fast fling still carries all the way through, just visibly slowed.
    const removeGate = addScrollGate((data) => {
      const g = where();
      if (!g) return true;
      // While gliding onto a beat, leftover momentum is swallowed so the glide lands; a new swipe (input that grows
      // again, or comes after a pause) takes over instead.
      const now = performance.now(), size = Math.abs(data.deltaY);
      const fresh = now - lastInput > 140 || size > lastSize * 1.4 + 6;
      lastInput = now; lastSize = size;
      if (gliding) {
        if (!fresh) return false;
        gliding = false;
      }
      const at = l.targetScroll - g.start;
      if (at > -g.step * 0.3 && at < g.last + g.step * 0.3) data.deltaY *= RESIST;
      return true;
    });

    // When a scroll slows between beats, glide on to the next beat in the direction it was going.
    const settle = () => {
      timer = 0; window.clearTimeout(rest);
      const g = where();
      if (!g || gliding) return;
      const pos = window.scrollY - g.start;
      if (pos < -g.step * 0.4 || pos > g.last + 1) return;
      const target = dir >= 0 ? Math.min(g.last, Math.ceil((pos - 2) / g.step) * g.step) : Math.max(0, Math.floor((pos + 2) / g.step) * g.step);
      if (Math.abs(target - pos) < 2 || (dir < 0 && pos < 0)) return;
      glide(window.scrollY + target - pos);
    };
    const onScroll = () => {
      const g = where();
      const inside = !!g && window.scrollY - g.start > -g.step * 0.3 && window.scrollY - g.start < g.last + g.step * 0.3;
      push.set(inside && !gliding ? l.velocity : 0);
      if (gliding) return;
      if (l.direction) dir = l.direction;
      // Glide early once it slows to a crawl, and in any case once the scroll stops (the last event can still be fast).
      window.clearTimeout(rest); rest = window.setTimeout(settle, 160);
      if (Math.abs(l.velocity) > 3) { window.clearTimeout(timer); timer = 0; }
      else if (!timer) timer = window.setTimeout(settle, 90);
    };
    l.on("scroll", onScroll);
    return () => { removeGate(); window.clearTimeout(timer); window.clearTimeout(rest); l.off("scroll", onScroll); push.set(0); };
  }), [n, push]);
  const swap = { initial: { opacity: 0, y: 18, filter: "blur(6px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -14, filter: "blur(4px)" } };

  return (
    <>
      <div className="space-y-16 lg:hidden">
        {beats.map((b) => (
          <div key={b.tag} className="space-y-6">
            <BeatText beat={b} />
            {b.visual}
          </div>
        ))}
      </div>

      <div ref={track} className="relative hidden lg:block" style={{ height: `calc(${n * STEP * 100}vh + 100vh - ${HEAD}px)` }}>
        {beats.map((b, i) => (
          <div key={b.tag} ref={(el) => { marks.current[i] = el; }} aria-hidden className="pointer-events-none absolute inset-x-0 h-px" style={{ top: `calc(${i * STEP * 100}vh - ${HEAD}px)` }} />
        ))}
        <div className="sticky grid grid-cols-[minmax(0,1fr)_minmax(0,540px)_minmax(0,1fr)] items-center gap-x-12" style={{ top: HEAD, height: `calc(100vh - ${HEAD}px)` }}>
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={active} {...swap} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}><BeatText beat={beats[active]} head /></motion.div>
            </AnimatePresence>
          </div>
          <div>
            <motion.div style={still ? undefined : { y: lag, scale: give }}>
            <motion.div style={still ? undefined : { clipPath: clip }} className="relative aspect-square max-h-[calc(100vh-240px)] w-full overflow-hidden rounded-[16px] border border-hairline bg-warm">
              <BrandGrid cols={12} rows={12} className="absolute inset-0 h-full w-full opacity-50 [mask-image:radial-gradient(ellipse_at_center,transparent_45%,#000_100%)]" />
              <motion.div style={still ? undefined : { opacity: inner }} className="absolute inset-0 flex items-center justify-center p-8">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={active} className="cascade w-full" {...swap} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                    {beats[active].visual}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
            </motion.div>
            <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="How it works">
              {beats.map((b, i) => (
                <button key={b.tag} role="tab" aria-selected={i === active} aria-label={b.tag} onClick={() => jump(i)}
                  className={`calm h-1.5 rounded-full ${i === active ? "w-6 bg-accent" : "w-1.5 bg-mute hover:bg-secondary"}`} />
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={active} {...swap} transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}><BeatText beat={beats[active]} body /></motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
const STEP = 0.8; // screen heights of scrolling per beat
const RESIST = 0.45; // how far a scroll carries inside the section, against 1 outside

function BeatText({ beat, head, body }: { beat: Beat; head?: boolean; body?: boolean }) {
  const all = !head && !body;
  return (
    <div className="min-w-0">
      {all || head ? <>
        <Tag tone="neutral">{beat.tag}</Tag>
        <h3 className="title mt-4 text-[clamp(26px,2.6vw,36px)]">{beat.title}</h3>
      </> : null}
      {all || body ? <>
        <p className={`${all ? "mt-4" : ""} max-w-[440px] text-[15px] leading-relaxed text-body`}>{beat.body}</p>
        <div className="mt-5"><LinkArrow href="/demo">See it in the demo</LinkArrow></div>
      </> : null}
    </div>
  );
}
