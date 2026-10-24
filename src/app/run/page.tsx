"use client";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, pct, rp, rpShort, shortDate } from "../../../convex/lib/format";
import { Bar, Button, Card, Eyebrow, LinkArrow, Metric, Pill, Tag } from "@/components/ui";
import { BrandGrid, Reveal, RevealItem, Roll, Splash } from "@/components/motion";
import { QuestionCard, RuleApproval } from "@/components/question";
import { ArrowRight, Play } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import type { Format } from "@number-flow/react";

type Overview = NonNullable<ReturnType<typeof useQuery<typeof api.queries.overview>>>;

export default function RunPage() {
  const o = useQuery(api.queries.overview);
  // The splash shows only on a cold load, and for long enough to read as intentional rather than a flash.
  const [cold] = useState(o === undefined);
  const [minDone, setMinDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 700); return () => clearTimeout(t); }, []);
  const splash = cold && (!o || !minDone);
  return (
    <>
      <AnimatePresence>{splash ? <Splash key="splash" /> : null}</AnimatePresence>
      {o && !splash ? <Run o={o} /> : null}
    </>
  );
}

function Run({ o }: { o: Overview }) {
  return (
    <div className="space-y-12 lg:space-y-16">
      <Hero o={o} />
      <Controls o={o} />
      {o.run?.pausedFor ? <PausePanel o={o} /> : null}
      <Counters o={o} />
      <Pipeline o={o} />
      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]" stagger={0.12}>
        <RevealItem><LearningCurve o={o} /></RevealItem>
        <RevealItem><Meetings o={o} /></RevealItem>
      </Reveal>
      <Showcase />
    </div>
  );
}

// Rolls in the target's unit, so "bn" never flickers through "m" and "k".
function RollRp({ value }: { value: number }) {
  const a = Math.abs(value);
  const [u, suffix] = a >= 1e9 ? [1e9, "bn"] : a >= 1e6 ? [1e6, "m"] : [1e3, "k"];
  const decimals = rpShort(value).match(/\.(\d+)/)?.[1].length ?? 0;
  return <Roll value={a / u} prefix={`${value < 0 ? "−" : ""}Rp `} suffix={suffix} format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }} />;
}

const WHOLE: Format = { maximumFractionDigits: 0 };

function Hero({ o }: { o: Overview }) {
  const done = o.run?.phase === "done";
  return (
    <section className="relative -mx-4 overflow-hidden px-4 pb-2 pt-24 text-center lg:-mx-10 lg:px-10 lg:pt-14">
      <BrandGrid cols={18} rows={6} className="absolute inset-0 hidden h-full w-full [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_70%,transparent)] lg:block" />
      <BrandGrid cols={10} rows={3} className="absolute inset-x-0 top-0 h-20 w-full [mask-image:linear-gradient(to_bottom,#000,transparent)] lg:hidden" />
      <Reveal className="relative mx-auto max-w-[720px]" stagger={0.1}>
        <RevealItem><Tag>{done ? "The year is closed" : "Before the close"}</Tag></RevealItem>
        {done ? (
          <>
            <RevealItem className="display mt-6 text-[clamp(56px,9vw,104px)] tabular-nums"><Roll value={o.counters.settledAuto / Math.max(1, o.counters.processed)} format={{ style: "percent", maximumFractionDigits: 1 }} /></RevealItem>
            <RevealItem><p className="mx-auto mt-6 max-w-[600px] text-[15px] text-body">
              settled automatically: {num(o.counters.settledAuto)} of {num(o.counters.processed)} bank lines. {num(o.counters.everHeld)} were held at some point, in {o.counters.stories} stories. {num(o.counters.held)} are still held at year end, on purpose.
            </p></RevealItem>
          </>
        ) : (
          <>
            <RevealItem className="display mt-6 text-[clamp(56px,9vw,104px)] tabular-nums text-hold"><RollRp value={o.headOffice} /></RevealItem>
            <RevealItem><p className="mx-auto mt-6 max-w-[600px] text-[15px] text-body">
              The head office account in the books. No bank holds this: the bank statement says {rpShort(o.headOfficeBank)}. Five shared accounts are split into 70 store sub accounts, and nothing was cleared during the year.
            </p></RevealItem>
          </>
        )}
        <RevealItem><p className="mt-4 text-[13px] text-faint">Every line settles on its own. Fermata only holds where it should.</p></RevealItem>
        {done ? <RevealItem className="mt-5"><LinkArrow href="/stories">Read the stories</LinkArrow></RevealItem> : null}
      </Reveal>
    </section>
  );
}

function Controls({ o }: { o: Overview }) {
  const start = useMutation(api.run.start);
  const setAuto = useMutation(api.run.setAutopilot);
  const [auto, setAutoLocal] = useState(false);
  const run = o.run;
  const idle = !run || run.phase === "idle";
  const current = run && !idle ? run.month : 0;
  const done = run?.phase === "done" || run?.phase.startsWith("yearend");
  const autopilot = idle ? auto : !!run?.autopilot;
  return (
    <section className="flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-center">
      <Button variant="primary" disabled={!idle} onClick={() => start({ autopilot: auto })}>
        <Play size={16} strokeWidth={1.75} />{idle ? "Close the year" : done ? (run?.phase === "done" ? "Year closed" : "Final pass") : run?.pausedFor ? "Paused for a person" : `Closing ${MONTH_LABELS[current - 1]}`}
      </Button>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-secondary">
        <input type="checkbox" className="size-4 accent-accent" checked={autopilot}
          onChange={(e) => { if (idle) setAutoLocal(e.target.checked); else void setAuto({ on: e.target.checked }); }} />
        Autopilot answers for a hands-free recording
      </label>
      <div className="flex flex-wrap gap-1.5 lg:ml-auto">
        {MONTH_LABELS.map((m, i) => {
          const n = i + 1;
          const isDone = done || n < current;
          const isCur = !done && n === current;
          const paused = isCur && !!run?.pausedFor;
          const cls = paused ? "text-hold-ink" : isCur ? "text-accent" : isDone ? "bg-inset text-ink" : "border border-hairline text-faint";
          return (
            <span key={m} className={`calm relative isolate inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${cls}`}>
              {isCur ? <motion.span layoutId="month-now" aria-hidden className={`absolute inset-0 -z-10 rounded-full ${paused ? "bg-hold-tint" : "bg-accent-tint"}`} transition={{ type: "spring", stiffness: 380, damping: 32 }} /> : null}
              {paused ? <span className="text-hold">𝄐</span> : isCur ? <span className="breathe-dot size-1.5 rounded-full" aria-hidden /> : null}{m}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function PausePanel({ o }: { o: Overview }) {
  const which = o.run?.pausedFor;
  return (
    <section key={which} className="enter space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="breathe text-[24px]" aria-hidden>𝄐</span>
        <h2 className="title text-[clamp(22px,2.6vw,30px)]">{which === "A" ? "Held in March: a correction becomes a rule" : "Held in June: a question only the CFO can answer"}</h2>
      </div>
      <p className="max-w-[720px] text-body">
        {which === "A"
          ? "1,186 school fees landed in Store 3’s virtual accounts while the school’s receipts put the students at Store 11. Fermata will not guess where money belongs. It asks the Accountant once, then turns the answer into a rule and tests it on last year before the CFO approves it."
          : "742 payouts arrived from FIN_Z, a lender that was not in last year’s books. Fermata asks the CFO one question instead of settling them on a pattern alone."}
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {o.pausedQuestion ? <QuestionCard q={o.pausedQuestion} /> : null}
        {o.pausedRule ? <RuleApproval rule={o.pausedRule} /> : null}
      </div>
    </section>
  );
}

function Counters({ o }: { o: Overview }) {
  return (
    <Reveal className="frame">
      <Card className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-5">
        <RevealItem><Metric label="Processed" value={<Roll value={o.counters.processed} format={WHOLE} />} sub="of 104,820 bank lines" /></RevealItem>
        <RevealItem><Metric label="Settled automatically" value={<Roll value={o.counters.settledAuto} format={WHOLE} />} sub={o.counters.processed ? pct(o.counters.settledAuto / o.counters.processed) : "—"} tone="success" /></RevealItem>
        <RevealItem><Metric label="Waiting" value={<Roll value={o.counters.waiting} format={WHOLE} />} sub="records not in the books yet" /></RevealItem>
        <RevealItem><Metric label="Held" value={<Roll value={o.counters.held} format={WHOLE} />} sub={`${num(o.counters.everHeld)} held at some point`} tone="hold" /></RevealItem>
        <RevealItem><Metric label="Questions" value={<Roll value={o.counters.questions} format={WHOLE} />} sub={`${o.counters.openQuestions} open`} /></RevealItem>
      </Card>
    </Reveal>
  );
}

function Pipeline({ o }: { o: Overview }) {
  const p = o.pipeline;
  const max = Math.max(1, p.synced);
  const stages: { label: string; n: number; tone: "accent" | "success" | "neutral" | "hold"; note: string }[] = [
    { label: "Synced", n: p.synced, tone: "neutral", note: "from five bank statements" },
    { label: "Placed at a store", n: p.placed, tone: "accent", note: "evidence weighed into a confidence" },
    { label: "Matched", n: p.matched, tone: "accent", note: "to the sales they pay for" },
    { label: "Settled by a rule", n: p.settledByRule, tone: "success", note: "within an approved rule’s limit" },
    { label: "Waiting", n: p.waiting, tone: "neutral", note: "their records arrive later" },
    { label: "Held in stories", n: p.held, tone: "hold", note: `${o.counters.stories} stories, one question each` },
  ];
  return (
    <section>
      <h2 className="title text-[clamp(22px,2.6vw,30px)]">Pipeline</h2>
      <Reveal className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((s, i) => (
          <RevealItem key={s.label} className="relative">
            <div className="flex items-center gap-1 text-[13px] font-medium">{s.label === "Held in stories" ? <span className="text-hold">𝄐</span> : null}{s.label}{i < stages.length - 1 && i !== 3 ? <ArrowRight size={14} strokeWidth={1.75} className="ml-auto hidden text-mute lg:block" /> : null}</div>
            <div className={`figure mt-2 text-[26px] ${s.tone === "hold" ? "text-hold" : "text-heading"}`}><Roll value={s.n} format={WHOLE} /></div>
            <div className="mt-2"><Bar value={s.n} max={max} tone={s.tone} /></div>
            <div className="mt-1.5 text-[12px] text-faint">{s.note}</div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

function LearningCurve({ o }: { o: Overview }) {
  const W = 640, H = 260, L = 44, R = 16, T = 24, B = 32;
  const lo = 0.75, hi = 1;
  const pts = o.months.filter((m) => (m.stats.processed ?? 0) >= (m.stats.total ?? 1)).map((m) => ({ m: m.month, r: (m.stats.firstSettled ?? 0) / (m.stats.total ?? 1) }));
  const x = (m: number) => L + ((m - 1) / 11) * (W - L - R);
  const y = (r: number) => T + (1 - (r - lo) / (hi - lo)) * (H - T - B);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ");
  const area = pts.length > 1 ? `${path} L${x(pts[pts.length - 1].m).toFixed(1)},${y(lo)} L${x(pts[0].m).toFixed(1)},${y(lo)} Z` : "";
  const learned = o.rulesLearned;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="title text-[22px]">Learning curve</h2>
        <span className="hidden text-[12px] text-faint sm:inline">share settled automatically on first pass</span>
      </div>
      <div className="-mx-5 mt-4 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[540px]" role="img" aria-label="Share settled automatically on first pass, by month">
        <defs>
          <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.75, 0.8, 0.85, 0.9, 0.95, 1].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-hairline)" strokeWidth={g === 0.75 ? 1 : 0.6} strokeDasharray={g === 0.75 ? "" : "2 4"} />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--color-faint)">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {MONTH_LABELS.map((m, i) => <text key={m} x={x(i + 1)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-faint)">{m}</text>)}
        {area ? <motion.path d={area} fill="url(#lc-fill)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.5 }} /> : null}
        {path ? <motion.path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.645, 0.045, 0.355, 1] }} /> : null}
        {pts.map((p) => (
          <motion.g key={p.m} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: ((p.m - 1) / 11) * 1.1 }}>
            <circle cx={x(p.m)} cy={y(p.r)} r={3.5} fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth={1.75} />
            <text x={x(p.m)} y={y(p.r) + 18} textAnchor="middle" className="num" fontSize="11" fill="var(--color-secondary)">{String(Math.round(p.r * 1000) / 10)}</text>
          </motion.g>
        ))}
        {learned.map((r) => {
          const p = pts.find((q) => q.m === r.month);
          if (!p) return null;
          return (
            <motion.g key={r.ruleId} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 320, damping: 18, delay: ((r.month - 1) / 11) * 1.1 + 0.15 }}>
              <text x={x(r.month)} y={y(p.r) - 14} textAnchor="middle" fontSize="18" fill="var(--color-hold)" style={{ fontFamily: "var(--font-music)" }}>𝄐</text>
              <text x={x(r.month)} y={y(p.r) - 32} textAnchor="middle" className="num" fontSize="11" fill="var(--color-hold-ink)">{r.ruleId}</text>
            </motion.g>
          );
        })}
      </svg>
      </div>
    </Card>
  );
}

// The mirror image of the learning curve: how many case rooms opened each month. Early in the year the
// agents meet every month; as answers become rules, the meetings dry up.
function Meetings({ o }: { o: Overview }) {
  const max = Math.max(1, ...o.roomsByMonth);
  const open = o.openRooms;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="title text-[22px]">Meetings per month</h2>
        <span className="num text-[12px] text-faint">{o.roomsByMonth.reduce((a, b) => a + b, 0)} rooms</span>
      </div>
      <p className="mt-1 text-[12px] text-faint">One case room per held story. Fewer as answers become rules.</p>
      <div className="mt-5 grid h-32 grid-cols-12 items-end gap-1.5" role="img" aria-label={`Case rooms per month: ${o.roomsByMonth.map((n, i) => `${MONTH_LABELS[i]} ${n}`).join(", ")}`}>
        {o.roomsByMonth.map((n, i) => (
          <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
            <span className="num text-[11px] text-secondary">{n || ""}</span>
            <motion.div className={`w-full rounded-t-[3px] ${n ? "bg-hold" : "bg-inset"}`} initial={{ height: 0 }} whileInView={{ height: n ? `${Math.max(6, (n / max) * 100)}%` : "2px" }} viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-12 gap-1.5 text-center text-[11px] text-faint">{MONTH_LABELS.map((m) => <span key={m}>{m[0]}</span>)}</div>
      {open.length ? (
        <div className="mt-5 space-y-2 border-t border-hairline pt-4">
          <Eyebrow>Open now</Eyebrow>
          <AnimatePresence initial={false}>
          {open.map((r) => (
            <motion.div key={r.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between gap-3 text-[13px]">
              <Link href={`/stories?room=${encodeURIComponent(r.key)}`} className="calm min-w-0 truncate hover:text-accent">{r.title}</Link>
              {r.state === "meeting" ? <Pill tone="accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full" />In meeting</Pill> : <Pill tone="hold"><span aria-hidden className="text-hold">𝄐</span>Asked</Pill>}
            </motion.div>
          ))}
          </AnimatePresence>
          <div className="pt-1"><LinkArrow href="/stories">Open the case rooms</LinkArrow></div>
        </div>
      ) : null}
    </Card>
  );
}

function Showcase() {
  const s = useQuery(api.queries.showcase);
  if (!s || (!s.vote && !s.fan)) return null;
  return (
    <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-2" stagger={0.12}>
      {s.vote ? (
        <RevealItem><Card>
          <Eyebrow>Placement vote</Eyebrow>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="title text-[24px]">Store {Number(s.vote.placement.store?.slice(1))}</div>
            <div className="figure text-[24px] text-success">{Math.round(s.vote.placement.confidence * 100)}%</div>
          </div>
          <div className="mt-1 text-[12px] text-faint"><span className="num">{shortDate(s.vote.date)} · {rp(s.vote.amount)}</span> · <span className="num">{s.vote.memo}</span></div>
          <div className="mt-4 space-y-3">
            {s.vote.placement.votes.map((v) => (
              <div key={v.store}>
                <div className="flex justify-between text-[13px]"><span>Store {Number(v.store.slice(1))}</span><span className="num text-secondary">{v.score.toFixed(2)}</span></div>
                <div className="mt-1"><Bar value={v.score} max={s.vote!.placement.votes.reduce((a, x) => a + x.score, 0)} tone={v.store === s.vote!.placement.store ? "accent" : "neutral"} /></div>
                <div className="mt-1 text-[12px] text-faint">{v.reasons.join(" · ")}</div>
              </div>
            ))}
          </div>
        </Card></RevealItem>
      ) : null}
      {s.fan ? (
        <RevealItem><Card>
          <Eyebrow>Fan-out</Eyebrow>
          <div className="title mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[22px]">
            <span>One Shopee payout of {rpShort(s.fan.amount)}</span><ArrowRight size={16} strokeWidth={1.75} className="text-faint" /><span className="tabular-nums">{num(s.fan.orders)} orders</span>
          </div>
          <div className="mt-1 text-[12px] text-faint"><span className="num">{shortDate(s.fan.date)}</span> · {s.fan.store} · <span className="num">{s.fan.memo}</span></div>
          <div className="mt-4 grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
            <div><div className="eyebrow">Orders</div><div className="num mt-1">{rp(s.fan.gross)}</div></div>
            <div><div className="eyebrow">Minus 6.5% and refunds</div><div className="num mt-1">{rp(Math.round(s.fan.gross * 0.065) + s.fan.refunds)}</div></div>
            <div><div className="eyebrow">Paid</div><div className="num mt-1">{rp(s.fan.amount)}</div></div>
          </div>
          <OrderDots orders={Math.min(s.fan.orders, 840)} settled={s.fan.settled} />
          <div className="mt-3">{s.fan.settled ? <Pill tone="success">Settled under r4, every order accounted for</Pill> : <Pill>Not processed yet</Pill>}</div>
        </Card></RevealItem>
      ) : null}
    </Reveal>
  );
}

// Every order the payout covers, filling green in reading order the first time the card is on screen.
function OrderDots({ orders, settled }: { orders: number; settled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref} className="mt-4 flex flex-wrap gap-1">
      {Array.from({ length: orders }).map((_, i) => (
        <span key={i} className={`calm block h-1.5 w-1.5 rounded-full ${settled && seen ? "bg-success" : "bg-mute"}`} style={{ transitionDelay: `${Math.round(i * 1.4)}ms` }} />
      ))}
    </div>
  );
}
