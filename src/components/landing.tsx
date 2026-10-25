"use client";
// Illustrations for the landing page, built from the recorded run (and, for learning, the learning year) so every
// number on the page is real.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { AGENT_LABEL, LinkArrow, Tag } from "./ui";
import { scrollToY, withLenis } from "./motion";
import recording from "@/demo/recording.json";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, pct, rpShort } from "../../convex/lib/format";
import { Avatar, PlainAvatars } from "./caseRoom";
import { LY } from "./learningYear";

type Line = { date: string; memo: string; amount: number; outcome: string; rule: string | null; store: string | null; fanout: number };
type Rule = { id: string; title: string; learnedInMonth: number; origin: string; program: { limitIdr: number }; backtest: { covered: number; precision: number } | null };
type Room = { key: string; month: number; title: string; count: number; live: boolean; narrated: string | null; resolution: string | null; question: { askOf: string; answer: string | null; options: { id: string; label: string }[] } | null; messages: { speaker: string; to: string; kind: string; source: string; text: string }[] };
const R = recording as unknown as { lines: Record<string, Line[]>; rules: Rule[]; rooms: Room[]; months: { month: number; total: number }[] };
const STORY_A = R.rooms.find((r) => r.narrated === "A") ?? null;
const STORY_B = R.rooms.find((r) => r.narrated === "B") ?? null;
// The policies Fermata mined from last year's matched lines before it closed a month, each fitted as a rule.
const DAY0 = R.rules.filter((r) => !r.learnedInMonth);
export const DAY_ZERO = DAY0.length;

// The hero card: an agent closing the month of story A, line by line, until something needs a person.
export function AgentWorking() {
  const mo = STORY_A?.month ?? 1;
  const lines = (R.lines[String(mo)] ?? []).filter((l) => l.outcome === "settled").slice(0, 5);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { const t = setTimeout(() => setStep(lines.length + 2), 0); return () => clearTimeout(t); }
    const id = setInterval(() => setStep((s) => (s >= lines.length + 4 ? 0 : s + 1)), 900);
    return () => clearInterval(id);
  }, [lines.length]);
  const held = step > lines.length;
  return (
    <div className="card overflow-hidden" aria-label={`An agent closing ${MONTH_LABELS[mo - 1]}`}>
      <div className="flex items-center gap-2 border-b border-hairline bg-well px-4 py-3 text-[13px] text-secondary">
        <span className={`h-2 w-2 rounded-full ${held ? "bg-hold" : "bg-accent breathe-dot"}`} />
        Closing {MONTH_LABELS[mo - 1]} · {num(R.months[mo - 1]?.total ?? 0)} bank lines
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
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">{num(STORY_A?.count ?? 0)} school fees: bank and receipts disagree</span>
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

// Day 0: the policies mined from last year, each a rule with its limit, and the share of January they settle.
const dayHead = <><span className="num text-ink">{DAY0.length}</span> policies from last year · <span className="num text-accent">{pct(LY.first, 0)}</span> on day one</>;
export function DayZero() {
  return (
    <div className="frame">
      <div className="card">
        <div className="border-b border-hairline px-4 py-2.5 text-[12px] text-secondary">{dayHead}</div>
        <ul className="divide-y divide-hairline">
          {DAY0.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="num w-7 shrink-0 text-[12px] text-faint">{r.id}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-body" title={r.title}>{r.title}</span>
              <span className="shrink-0 text-[11.5px] text-faint">up to {rpShort(r.program.limitIdr)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Settle: six sources of sales and five shared bank accounts, joined by Fermata.
const BANKS = ["Main account", "Second account", "Third account", "School fees, virtual", "Head office"];
const SOURCES = ["ERP and cash book", "Shopee", "Tokopedia", "Website gateway", "Dealer invoices", "School receipts"];
export function Sources() {
  const chip = (t: string) => <li key={t} className="rounded-[6px] border border-hairline bg-ground px-2.5 py-1.5 text-[12px] text-body shadow-[0_1px_1px_rgb(85_40_20/0.04)]">{t}</li>;
  return (
    <div className="frame">
      <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 sm:gap-5 sm:p-6">
        <div><div className="eyebrow mb-2">{SOURCES.length} sources of sales</div><ul className="space-y-1.5">{SOURCES.map(chip)}</ul></div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-px bg-strong" aria-hidden />
          <div className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-heading text-[30px] text-hold shadow-[0_8px_24px_-12px_rgb(10_45_102/0.6)]" style={{ fontFamily: "var(--font-music)" }} aria-label="Fermata"><span style={{ transform: "translateY(0.28em)" }}>𝄐</span></div>
          <div className="h-10 w-px bg-strong" aria-hidden />
        </div>
        <div><div className="eyebrow mb-2">{BANKS.length} bank accounts</div><ul className="space-y-1.5">{BANKS.map(chip)}</ul></div>
      </div>
    </div>
  );
}

// Learn: the rules from last year, then the ones learned from a correction and from answers.
const learnedFrom = (r: Rule) => (r.learnedInMonth ? `${MONTH_LABELS[r.learnedInMonth - 1]} · from ${/correction/i.test(r.origin) ? "a correction" : "an answer"}` : "last year");
export function Rules() {
  return (
    <div className="frame">
      <ul className="card divide-y divide-hairline">
        {R.rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`num w-7 shrink-0 text-[12px] ${r.learnedInMonth ? "font-medium text-hold-ink" : "text-faint"}`}>{r.id}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-body" title={r.title}>{r.title}</span>
            <span className="shrink-0 text-[11.5px] text-faint">{learnedFrom(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Hold and ask: a few lines of the real story B meeting, ending where a person comes in.
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

// The record, including what was refused. Read from the run: the year's biggest fan-out, story B's answer
// and what r9 then settled.
const RECORD: { who: string; what: string; tone?: "danger" | "hold" }[] = (() => {
  const fan = (recording as unknown as { fan: Line & { channel: string } | null }).fan;
  const answer = STORY_B?.question?.options.find((o) => o.id === STORY_B.question?.answer)?.label;
  const r9 = (recording as unknown as { learnedRules: { id: string; released: number }[] }).learnedRules.find((r) => r.id === "r9");
  return [
    ...(fan ? [{ who: "engine", what: `Settled a payout of ${rpShort(fan.amount)} against ${num(fan.fanout)} records under rule ${fan.rule}, approved by the CFO` }] : []),
    { who: "investigator", what: "Tried to approve its own story. Blocked in code: Investigator may not approve", tone: "danger" },
    { who: "manager", what: "People are asked once, after the Auditor has checked. Floor goes to the Auditor" },
    ...(STORY_B && answer ? [{ who: "cfo", what: `Answered "${answer}" on ${STORY_B.title.replace(/^Payouts from /, "").replace(/, a lender we do not know$/, "")}, confirmed back; r9 approved`, tone: "hold" as const }] : []),
    ...(r9 ? [{ who: "engine", what: `Re-ran the held payouts under r9: ${num(r9.released)} settled and posted` }] : []),
  ];
})();
export function RecordSample() {
  return (
    <div className="frame">
      <ul className="card divide-y divide-hairline">
        {RECORD.map((r, i) => (
          <li key={i} className={`flex items-center gap-3 px-4 py-2.5 ${r.tone === "danger" ? "bg-danger-tint/60" : ""}`}>
            <Avatar who={r.who} size={24} />
            <span className={`min-w-0 flex-1 text-[12.5px] ${r.tone === "danger" ? "text-danger" : "text-body"}`}>{r.what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Trust: the rules the learning year learned from answers, each with its backtest and the most it settles a payment.
export function LearnedRules() {
  return (
    <div className="frame">
      <div className="card">
        <div className="eyebrow border-b border-hairline px-4 py-2.5">Rules learned from answers this year</div>
        <ul className="divide-y divide-hairline">
          {LY.rules.map((r) => (
            <li key={`${r.id}v${r.version}`} className="px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="num w-7 shrink-0 text-[12px] font-medium text-hold-ink">{r.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-body" title={r.title}>{r.title}</span>
                <span className="shrink-0 text-[11.5px] text-faint">{MONTH_LABELS[r.month - 1]} · {r.by === "claude" ? "Claude" : r.by === "code" ? "Code" : "Scripted"}</span>
              </div>
              <div className="mt-1 pl-10 text-[11.5px] leading-snug text-secondary">
                Backtest <span className="num text-ink">{num(r.backtest.covered - r.backtest.wrong)}</span> of <span className="num">{num(r.backtest.covered)}</span> right · <span className="whitespace-nowrap">nothing over <span className="num">{rpShort(r.program.limitIdr)}</span></span> a payment
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const FAN = (recording as unknown as { fan: { amount: number; fanout: number } }).fan;
export const fanText = FAN ? `one payout of ${rpShort(FAN.amount)} settled against ${num(FAN.fanout)} orders` : "";

type Beat = { tag: string; title: string; body: ReactNode; visual: ReactNode };

// How it works. On wide screens the stage (title, card, description) is pinned while the page scrolls through a track,
// and everything on it follows the scroll continuously: the text on either side cross-fades, the dots fill, and one set
// of tiles in the card rearranges from beat to beat (last year's policies become the sources and bank accounts, then
// the case room's cast around its one question, then every rule, then the record). Scrolling is plain Lenis with no resistance. When a scroll
// comes to rest near a beat a magnet eases the page onto it; anywhere else the page stays where it was left, and a fling
// passes straight through. On narrow screens, and under reduced motion, the beats simply stack.
const HEAD = 72; // the floating header
const STEP = 0.8; // screen heights of scrolling per beat
const TAIL = 0.15; // screen heights the last beat holds before the page lets go
const MAGNET = 0.35; // a scroll that comes to rest within this share of a step of a beat eases onto it
const SNAP = 0.9; // seconds the magnet takes
const HOLD = 0.06; // share of a step either side of a beat where the tiles stand still
const DRIFT = 12; // px the card drifts up, either side of its place, through the section

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => { const m = window.matchMedia(REDUCED); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useStill = () => useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

export function HowItWorks({ beats }: { beats: Beat[] }) {
  const n = beats.length;
  const still = useStill();
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress: through } = useScroll({ target: track, offset: [`start ${HEAD}px`, "end end"] });
  // Where the page is, in beats: 0 on the first, 1 on the second, n − 1 on the last.
  const at = useTransform(through, (v) => Math.min(n - 1, Math.max(0, (v * ((n - 1) * STEP + TAIL)) / STEP)));
  useMotionValueEvent(at, "change", (v) => setActive(Math.round(v)));
  const drift = useTransform(at, [0, n - 1], [DRIFT, -DRIFT]);
  const { scrollYProgress: arriving } = useScroll({ target: track, offset: ["start end", `start ${HEAD}px`] });
  const open = useSpring(arriving, { stiffness: 140, damping: 30, mass: 0.6 });
  const clip = useTransform(open, [0.3, 1], ["inset(42% 2% 42% 2% round 16px)", "inset(0% 0% 0% 0% round 16px)"]);
  const inner = useTransform(open, [0.75, 1], [0, 1]);

  // Where the beats sit on the page, measured each time (the page above them can change height).
  const where = useCallback(() => {
    const el = track.current;
    if (!el || !el.offsetParent) return null;
    return { step: window.innerHeight * STEP, start: el.getBoundingClientRect().top + window.scrollY - HEAD };
  }, []);
  const jump = (i: number) => { const g = where(); if (g) scrollToY(g.start + i * g.step); };

  // The magnet. Nothing acts while the page is moving, so a fling passes straight through; once a scroll has come to
  // rest within MAGNET of a beat the page eases onto it, and anywhere else it stays where it was left.
  useEffect(() => withLenis((l) => {
    let timer = 0, snapping = false, lastInput = 0;
    const settle = () => {
      window.clearTimeout(timer); timer = 0;
      const g = where();
      if (!g || snapping) return;
      // Still being pushed (a wheel or finger is still sending input): wait for it to let go.
      if (performance.now() - lastInput < 100) { timer = window.setTimeout(settle, 120); return; }
      const pos = (l.targetScroll - g.start) / g.step;
      if (pos < 0 || pos > n - 1) return;
      const k = Math.round(pos), off = Math.abs(pos - k);
      if (off > MAGNET || off * g.step < 1) return;
      snapping = true;
      l.scrollTo(g.start + k * g.step, { duration: SNAP, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: () => { snapping = false; } });
    };
    const onScroll = () => {
      if (snapping) return;
      window.clearTimeout(timer);
      // Once the wheel or finger has let go and the page has all but stopped, act now; otherwise when it stops.
      if (performance.now() - lastInput > 120 && Math.abs(l.velocity) < 1.5) settle();
      else timer = window.setTimeout(settle, 140);
    };
    // A new wheel or touch always takes over from the magnet.
    const onInput = () => { lastInput = performance.now(); snapping = false; };
    l.on("scroll", onScroll);
    l.on("virtual-scroll", onInput);
    return () => { window.clearTimeout(timer); l.off("scroll", onScroll); l.off("virtual-scroll", onInput); };
  }), [n, where]);

  const side = (part: "head" | "body") => (
    <div className="grid min-w-0 items-center">
      {beats.map((b, i) => <Fade key={b.tag} at={at} i={i} shown={i === active}><BeatText beat={b} head={part === "head"} body={part === "body"} /></Fade>)}
    </div>
  );

  return (
    <PlainAvatars.Provider value>
      <div className={`space-y-16 ${still ? "" : "lg:hidden"}`}>
        {beats.map((b) => (
          <div key={b.tag} className="space-y-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:space-y-0">
            <BeatText beat={b} />
            {b.visual}
          </div>
        ))}
      </div>

      <div ref={track} className={`relative hidden ${still ? "" : "lg:block"}`} style={{ height: `calc(${((n - 1) * STEP + TAIL) * 100}vh + 100vh - ${HEAD}px)` }}>
        <div className="sticky grid grid-cols-[minmax(0,1fr)_minmax(0,540px)_minmax(0,1fr)] items-center gap-x-12" style={{ top: HEAD, height: `calc(100vh - ${HEAD}px)` }}>
          {side("head")}
          <motion.div style={{ y: drift }}>
            <motion.div style={{ clipPath: clip }} className="relative aspect-square max-h-[calc(100vh-240px)] w-full overflow-hidden rounded-[16px] border border-hairline bg-warm">
              <motion.div style={{ opacity: inner }} className="absolute inset-0">
                {n === MORPH_BEATS ? <Morph at={at} active={active} /> : <div className="absolute inset-0 flex items-center justify-center p-8">{beats[active].visual}</div>}
              </motion.div>
            </motion.div>
            <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="How it works">
              {beats.map((b, i) => <Dot key={b.tag} at={at} i={i} label={b.tag} selected={i === active} onClick={() => jump(i)} />)}
            </div>
          </motion.div>
          {side("body")}
        </div>
      </div>
    </PlainAvatars.Provider>
  );
}

// One beat's text on one side of the stage, all beats in the same place: it is clear within a fifth of a step of its
// beat and gone by half way, rising in from below and leaving upward with a short blur.
function Fade({ at, i, shown, children }: { at: MotionValue<number>; i: number; shown: boolean; children: ReactNode }) {
  const opacity = useTransform(at, (v) => clamp01(1 - (Math.abs(v - i) - 0.2) / 0.3));
  const y = useTransform(at, (v) => Math.max(-14, Math.min(14, (i - v) * 28)));
  const filter = useTransform(opacity, (o) => `blur(${((1 - o) * 4).toFixed(2)}px)`);
  return <motion.div inert={!shown} style={{ opacity, y, filter }} className="col-start-1 row-start-1 min-w-0">{children}</motion.div>;
}

// A dot under the card that widens and turns blue as its beat comes in.
function Dot({ at, i, label, selected, onClick }: { at: MotionValue<number>; i: number; label: string; selected: boolean; onClick: () => void }) {
  const near = useTransform(at, (v) => clamp01(1 - Math.abs(v - i)));
  const width = useTransform(near, (o) => 6 + o * 18);
  return (
    <motion.button type="button" role="tab" aria-selected={selected} aria-label={label} onClick={onClick} style={{ width }}
      className="calm relative h-1.5 overflow-hidden rounded-full bg-mute hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <motion.span aria-hidden style={{ opacity: near }} className="absolute inset-0 bg-accent" />
    </motion.button>
  );
}

// ---- The morph: one set of tiles told through all five beats -------------------------------------------------------

// The beats, in the order the page tells them. The morph needs exactly this many beats; HowItWorks falls back to each
// beat's own picture otherwise.
const [DAY, MONEY, ROOM, LEARN, RECORD_BEAT] = [0, 1, 2, 3, 4];
const MORPH_BEATS = 5;
const BEATS = [DAY, MONEY, ROOM, LEARN, RECORD_BEAT];

// Where each tile is on each beat. Day 0: the policy row of its rule when that rule came from last year, or folded
// into the head (worked out from `rule`). Money: a source of sales or a bank account. Room: a seat in the case room (0 at
// the top, then clockwise), or folded into the one question ("c"). Learn: a rule (its index in the recording's rules),
// or merging into one (`into`). Record: a row of the record, or folded into its head. The paths keep a meaning where
// they can: a policy from last year stays the same rule when the rules come back, Shopee becomes the marketplace rule,
// the school's virtual account becomes the correction rule and its receipts the rule for fees paid ahead, head office
// becomes the lender rule the CFO's answer made, and the CFO answers on the record. A rule index past the year's rules
// folds into the head, so a shorter year still lays out.
type Path = { money: { src: number } | { bank: number }; room: number | "c"; rule: number | { into: number }; record: number | "c" };
const PATHS: Path[] = [
  { money: { bank: 0 }, rule: 0, room: 0, record: 1 },
  { money: { src: 0 }, rule: 1, room: 5, record: 2 },
  { money: { bank: 1 }, rule: 2, room: 1, record: 4 },
  { money: { src: 1 }, rule: 3, room: "c", record: "c" },
  { money: { src: 2 }, rule: 10, room: "c", record: "c" },
  { money: { src: 3 }, rule: 4, room: "c", record: "c" },
  { money: { src: 4 }, rule: 5, room: "c", record: "c" },
  { money: { bank: 2 }, rule: 6, room: 4, record: 0 },
  { money: { bank: 3 }, rule: 7, room: 2, record: "c" },
  { money: { src: 5 }, rule: 9, room: "c", record: "c" },
  { money: { bank: 4 }, rule: 8, room: 3, record: 3 },
];
// A tile's policy row on day 0, or −1 when its rule was learned during the year.
const dayRow = (p: Path) => (typeof p.rule === "number" && R.rules[p.rule] ? DAY0.indexOf(R.rules[p.rule]) : -1);
const SEATS = ["investigator", "auditor", "learner", "cfo", "engine", "manager"]; // from the top, clockwise
const LEARNED = R.rules.filter((r) => r.learnedInMonth).length;
const STAGE_LABELS = [
  `${DAY0.length} policies mined from last year's matched lines, ${pct(LY.first, 0)} of January settled on day one`,
  `${SOURCES.length} sources of sales and ${BANKS.length} shared bank accounts, joined by Fermata`,
  "The case room: the agents around one question for the CFO",
  `${R.rules.length} rules, ${LEARNED} of them learned this year`,
  "The record: what each agent did, including an approval that was refused",
];

type Frame = { x: number; y: number; w: number; h: number; o: number; r: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const segment = (q: number) => { const i = Math.min(MORPH_BEATS - 2, Math.max(0, Math.floor(q))); return [i, q - i] as const; };
const mix = (f: Frame[], q: number): Frame => {
  const [i, t] = segment(q), a = f[i], b = f[i + 1];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), o: lerp(a.o, b.o, t), r: lerp(a.r, b.r, t) };
};
const mixN = (v: number[], q: number) => { const [i, t] = segment(q); return lerp(v[i], v[i + 1], t); };
// The tiles stand still for HOLD either side of a beat, so a page at rest on a beat looks settled, and between beats
// move half linearly and half eased, so every bit of scroll moves them but they still land softly.
const eased = (v: number) => { const [i, f] = segment(v); const t = clamp01((f - HOLD) / (1 - 2 * HOLD)); return i + (t + t * t * (3 - 2 * t)) / 2; };
// How much of a beat's own content shows: all of it at the beat, about half a quarter of the way out, none at half way,
// so the labels cross-fade without two of them ever being read over each other.
const weight = (q: number, b: number) => clamp01(1 - (Math.abs(q - b) - 0.05) / 0.42);

function stageLayout(W: number, H: number) {
  const pad = Math.round(Math.min(W, H) * 0.06), cx = W / 2, cy = H / 2;
  // Money: the sources on the left and the bank accounts on the right, joined by the mark in the middle.
  const colW = Math.min(190, (W - 2 * pad - 96) / 2), chip = 34, gap = 8;
  const column = (count: number, x: number) => {
    const top = cy - (count * chip + (count - 1) * gap) / 2 + 12;
    return Array.from({ length: count }, (_, k): Frame => ({ x, y: top + k * (chip + gap), w: colW, h: chip, o: 1, r: 6 }));
  };
  const src = column(SOURCES.length, pad), bank = column(BANKS.length, W - pad - colW);
  const mark: Frame = { x: cx - 32, y: cy - 20, w: 64, h: 64, o: 1, r: 14 };
  // Day 0, Learn and Record: rows under a head, centred together.
  const list = (count: number, most: number, g: number, headW: number) => {
    const h = Math.min(most, (H - 2 * pad - 42 - (count - 1) * g) / count), top = (H - (42 + count * h + (count - 1) * g)) / 2;
    const head: Frame = { x: cx - headW / 2, y: top, w: headW, h: 28, o: 1, r: 14 };
    return { head, rows: Array.from({ length: count }, (_, k): Frame => ({ x: pad, y: top + 42 + k * (h + g), w: W - 2 * pad, h, o: 1, r: 6 })) };
  };
  const dayList = list(DAY0.length, 38, 6, 300), ruleList = list(R.rules.length, 38, 6, 272), recordList = list(RECORD.length, 54, 8, 208);
  const rules = ruleList.rows, record = recordList.rows;
  // Room: the cast seated round the one question.
  const seatW = 160, seatH = 36;
  const rx = (cx - pad - seatW / 2) / Math.cos(Math.PI / 6), ry = cy - pad - seatH / 2;
  const seats = SEATS.map((_, k): Frame => {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    return { x: cx + rx * Math.cos(a) - seatW / 2, y: cy + ry * Math.sin(a) - seatH / 2, w: seatW, h: seatH, o: 1, r: seatH / 2 };
  });
  const question: Frame = { x: cx - 122, y: cy - 18, w: 244, h: 36, o: 1, r: 18 };
  const centre = [dayList.head, mark, question, ruleList.head, recordList.head];
  const tucked = (c: Frame): Frame => ({ x: c.x + c.w / 2 - 40, y: c.y + c.h / 2 - 12, w: 80, h: 24, o: 0, r: 12 });
  // One frame per beat, in BEATS order.
  const tiles = PATHS.map((p): Frame[] => [
    dayList.rows[dayRow(p)] ?? tucked(centre[DAY]),
    "src" in p.money ? src[p.money.src] : bank[p.money.bank],
    p.room === "c" ? tucked(centre[ROOM]) : seats[p.room],
    typeof p.rule === "number" ? rules[p.rule] ?? tucked(centre[LEARN]) : { ...(rules[p.rule.into] ?? centre[LEARN]), o: 0 },
    p.record === "c" ? tucked(centre[RECORD_BEAT]) : record[p.record] ?? tucked(centre[RECORD_BEAT]),
  ]);
  return { pad, tiles, centre, src, bank, mark, seats, question, record };
}

// What a tile says on each beat, laid out at that beat's size so it never reflows while the tile changes shape.
function tileContent(p: Path, b: number): { node: ReactNode; className: string } | null {
  if (b === DAY) {
    const r = DAY0[dayRow(p)];
    return r ? { className: "gap-3 px-3", node: <>
      <span className="num w-6 shrink-0 text-[12px] text-faint">{r.id}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">{r.title}</span>
      <span className="shrink-0 text-[11px] text-faint">up to {rpShort(r.program.limitIdr)}</span>
    </> } : null;
  }
  if (b === MONEY) return { className: "px-2.5", node: <span className="truncate text-[12px] text-body">{"src" in p.money ? SOURCES[p.money.src] : BANKS[p.money.bank]}</span> };
  if (b === LEARN) {
    const r = typeof p.rule === "number" ? R.rules[p.rule] : null;
    return r ? { className: "gap-3 px-3", node: <>
      <span className={`num w-6 shrink-0 text-[12px] ${r.learnedInMonth ? "font-medium text-hold-ink" : "text-faint"}`}>{r.id}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">{r.title}</span>
      <span className="shrink-0 text-[11px] text-faint">{learnedFrom(r)}</span>
    </> } : null;
  }
  if (b === ROOM) return p.room === "c" ? null : { className: "gap-2 pl-1.5 pr-3", node: <>
    <Avatar who={SEATS[p.room]} size={24} /><span className="truncate text-[12.5px] font-medium text-ink">{AGENT_LABEL[SEATS[p.room]]}</span>
  </> };
  const row = p.record === "c" ? null : RECORD[p.record];
  return row ? { className: "gap-2.5 px-3", node: <>
    <Avatar who={row.who} size={24} /><span className={`line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-snug ${row.tone === "danger" ? "text-danger" : "text-body"}`}>{row.what}</span>
  </> } : null;
}

// The centre piece on each beat, in BEATS order: the day 0 head, the mark, the one question, the rules head, the record
// head. Each fill shows on the beats marked 1.
const CENTRE: ReactNode[] = [
  <span key="day" className="text-[12px] text-secondary">{dayHead}</span>,
  <span key="mark" className="text-[34px] text-hold" style={{ fontFamily: "var(--font-music)", transform: "translateY(0.28em)" }}>𝄐</span>,
  <span key="ask" className="font-mono text-[11px] uppercase tracking-[0.06em] text-white">𝄐 One question for the CFO</span>,
  <span key="rules" className="text-[12px] text-secondary"><span className="num text-ink">{R.rules.length}</span> rules · <span className="text-hold-ink">{LEARNED} learned this year</span></span>,
  <span key="record" className="eyebrow">Every step, on record</span>,
];
const CENTRE_FILL = [{ cls: "bg-heading", on: [0, 1, 0, 0, 0] }, { cls: "bg-inset", on: [1, 0, 0, 1, 1] }, { cls: "bg-hold", on: [0, 0, 1, 0, 0] }];

// The card's picture on wide screens. The stage measures itself, works out every tile's place on every beat, and then
// paints straight onto the tiles as the page scrolls, so nothing re-renders while it moves.
function Morph({ at, active }: { at: MotionValue<number>; active: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
      setSize((s) => (w && h && (s?.w !== w || s?.h !== h) ? { w, h } : s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = useMemo(() => (size ? stageLayout(size.w, size.h) : null), [size]);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const centre = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLDivElement | null)[]>([]);
  const words = useRef<(HTMLDivElement | null)[]>([]);
  const decor = useRef<(HTMLDivElement | SVGSVGElement | null)[]>([]);
  const danger = useRef<HTMLDivElement>(null);

  const paint = useCallback((v: number) => {
    if (!L) return;
    const q = eased(v);
    const put = (el: HTMLElement | null, f: Frame) => {
      if (!el) return;
      el.style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
      el.style.width = `${f.w}px`; el.style.height = `${f.h}px`;
      el.style.borderRadius = `${f.r}px`; el.style.opacity = `${f.o}`;
    };
    L.tiles.forEach((f, k) => put(tiles.current[k], mix(f, q)));
    labels.current.forEach((el, k) => { if (el) el.style.opacity = `${weight(q, k % MORPH_BEATS)}`; });
    put(centre.current, mix(L.centre, q));
    fills.current.forEach((el, k) => { if (el) el.style.opacity = `${mixN(CENTRE_FILL[k].on, q)}`; });
    words.current.forEach((el, b) => { if (el) el.style.opacity = `${weight(q, b)}`; });
    decor.current.forEach((el, b) => { if (el) el.style.opacity = `${clamp01(1 - Math.abs(q - b) * 2.5)}`; });
    if (danger.current) danger.current.style.opacity = `${weight(q, RECORD_BEAT)}`;
  }, [L]);
  useMotionValueEvent(at, "change", paint);
  useEffect(() => paint(at.get()), [paint, at]);

  const flow = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
  // Lines meet the mark spread down its side rather than at one point.
  const port = (k: number, count: number) => (L ? L.mark.y + 16 + (k * (L.mark.h - 32)) / Math.max(1, count - 1) : 0);
  const mid = (f: Frame) => [f.x + f.w / 2, f.y + f.h / 2] as const;

  return (
    <div ref={stage} role="img" aria-label={STAGE_LABELS[active]} className="absolute inset-0">
      {L ? <>
        {/* Money: flowing from each source, through Fermata, into the shared accounts, under the column heads. */}
        <div ref={(el) => { decor.current[MONEY] = el; }} aria-hidden className="pointer-events-none absolute inset-0 opacity-0">
          <svg className="absolute inset-0 h-full w-full" fill="none">
            {[...L.src.map((f, k, all) => flow(f.x + f.w, f.y + f.h / 2, L.mark.x, port(k, all.length))), ...L.bank.map((f, k, all) => flow(L.mark.x + L.mark.w, port(k, all.length), f.x, f.y + f.h / 2))].map((d, k) => (
              <g key={k}><path d={d} stroke="var(--color-strong)" /><path d={d} stroke="var(--color-accent)" strokeOpacity={0.55} className="flow" /></g>
            ))}
          </svg>
          <div className="eyebrow absolute" style={{ left: L.src[0].x, top: L.src[0].y - 22 }}>{SOURCES.length} sources of sales</div>
          <div className="eyebrow absolute" style={{ left: L.bank[0].x, top: L.bank[0].y - 22 }}>{BANKS.length} bank accounts</div>
        </div>
        {/* Room: each seat speaks to the one question. */}
        <svg ref={(el) => { decor.current[ROOM] = el; }} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-0" fill="none">
          {L.seats.map((f, k) => { const [x, y] = mid(f), [qx, qy] = mid(L.question); return <line key={k} x1={x} y1={y} x2={qx} y2={qy} stroke="var(--color-strong)" strokeDasharray="3 5" />; })}
        </svg>
        {/* Record: one thread through the record, in order. */}
        <svg ref={(el) => { decor.current[RECORD_BEAT] = el; }} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-0" fill="none">
          <line x1={L.pad + 24} y1={mid(L.record[0])[1]} x2={L.pad + 24} y2={mid(L.record[L.record.length - 1])[1]} stroke="var(--color-strong)" />
        </svg>

        {PATHS.map((p, k) => (
          <div key={k} ref={(el) => { tiles.current[k] = el; }} aria-hidden className="absolute left-0 top-0 overflow-hidden border border-hairline bg-ground opacity-0 shadow-[0_1px_1px_rgb(85_40_20/0.04)]">
            {p.record !== "c" && RECORD[p.record]?.tone === "danger" ? <div ref={danger} className="absolute inset-0 bg-danger-tint/60 opacity-0" /> : null}
            {BEATS.map((b) => {
              const c = tileContent(p, b), f = L.tiles[k][b];
              return (
                <div key={b} ref={(el) => { labels.current[k * MORPH_BEATS + b] = el; }} className={`absolute left-0 top-0 flex items-center opacity-0 ${b !== RECORD_BEAT ? "whitespace-nowrap" : ""} ${c?.className ?? ""}`} style={{ width: f.w - 2, height: f.h - 2 }}>
                  {c?.node}
                </div>
              );
            })}
          </div>
        ))}

        <div ref={centre} aria-hidden className="absolute left-0 top-0 overflow-hidden opacity-0">
          {CENTRE_FILL.map((c, k) => <div key={c.cls} ref={(el) => { fills.current[k] = el; }} className={`absolute inset-0 ${c.cls}`} />)}
          {CENTRE.map((node, b) => (
            <div key={b} ref={(el) => { words.current[b] = el; }} className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center justify-center whitespace-nowrap opacity-0" style={{ width: L.centre[b].w, height: L.centre[b].h }}>{node}</div>
          ))}
        </div>
      </> : null}
    </div>
  );
}

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
