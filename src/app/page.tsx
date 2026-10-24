"use client";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, pct, rp, rpShort, shortDate } from "../../convex/lib/format";
import { AGENT_LABEL, Bar, Button, Card, Eyebrow, Metric, Pill, Trace } from "@/components/ui";
import { QuestionCard, RuleApproval } from "@/components/question";
import { ArrowRight, Play } from "lucide-react";

type Overview = NonNullable<ReturnType<typeof useQuery<typeof api.queries.overview>>>;

export default function RunPage() {
  const o = useQuery(api.queries.overview);
  if (!o) return <div className="text-faint">Loading the books…</div>;
  return (
    <div className="space-y-10">
      <Hero o={o} />
      <Controls o={o} />
      {o.run?.pausedFor ? <PausePanel o={o} /> : null}
      <Counters o={o} />
      <Pipeline o={o} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <LearningCurve o={o} />
        <Lanes />
      </div>
      <Showcase />
    </div>
  );
}

function Hero({ o }: { o: Overview }) {
  const done = o.run?.phase === "done";
  return (
    <section className="pt-2">
      <Eyebrow>{done ? "The year is closed" : "Before the close"}</Eyebrow>
      {done ? (
        <>
          <div className="num mt-2 text-[48px] font-medium leading-none tight">{pct(o.counters.settledAuto / Math.max(1, o.counters.processed))}</div>
          <p className="mt-3 max-w-[640px] text-[15px] text-secondary">
            settled automatically: {num(o.counters.settledAuto)} of {num(o.counters.processed)} bank lines. {num(o.counters.everHeld)} were held at some point, in {o.counters.stories} stories. {num(o.counters.held)} are still held at year end, on purpose.
          </p>
        </>
      ) : (
        <>
          <div className="num mt-2 text-[48px] font-medium leading-none tight text-hold">{rpShort(o.headOffice).replace("minus ", "−")}</div>
          <p className="mt-3 max-w-[640px] text-[15px] text-secondary">
            The head office account in the books. No bank holds this: the bank statement says {rpShort(o.headOfficeBank)}. Five shared accounts are split into 70 store sub accounts, and nothing was cleared during the year.
          </p>
        </>
      )}
      <p className="mt-4 text-[13px] text-faint">Every line settles on its own. Fermata only holds where it should.</p>
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
    <section className="flex flex-wrap items-center gap-4">
      <Button variant="primary" disabled={!idle} onClick={() => start({ autopilot: auto })}>
        <Play size={16} strokeWidth={1.75} />{idle ? "Close the year" : done ? (run?.phase === "done" ? "Year closed" : "Final pass") : run?.pausedFor ? "Paused for a person" : `Closing ${MONTH_LABELS[current - 1]}`}
      </Button>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-secondary">
        <input type="checkbox" className="accent-[#1f5fc0]" checked={autopilot}
          onChange={(e) => { if (idle) setAutoLocal(e.target.checked); else void setAuto({ on: e.target.checked }); }} />
        Autopilot answers for a hands-free recording
      </label>
      <div className="ml-auto flex flex-wrap gap-1.5">
        {MONTH_LABELS.map((m, i) => {
          const n = i + 1;
          const isDone = done || n < current;
          const isCur = !done && n === current;
          const paused = isCur && !!run?.pausedFor;
          const cls = paused ? "bg-hold-tint text-hold" : isCur ? "bg-accent-tint text-accent" : isDone ? "bg-well text-ink" : "border border-hairline text-faint";
          return <span key={m} className={`calm rounded-full px-2.5 py-1 text-[12px] font-medium ${cls}`}>{paused ? "𝄐 " : ""}{m}</span>;
        })}
      </div>
    </section>
  );
}

function PausePanel({ o }: { o: Overview }) {
  const which = o.run?.pausedFor;
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[20px] text-hold" aria-hidden>𝄐</span>
        <h2 className="text-[20px] font-semibold tight">{which === "A" ? "Held in March: a correction becomes a rule" : "Held in June: a question only the CFO can answer"}</h2>
      </div>
      <p className="max-w-[720px] text-secondary">
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
    <Card className="grid grid-cols-2 gap-6 md:grid-cols-5">
      <Metric label="Processed" value={num(o.counters.processed)} sub="of 104,820 bank lines" />
      <Metric label="Settled automatically" value={num(o.counters.settledAuto)} sub={o.counters.processed ? pct(o.counters.settledAuto / o.counters.processed) : "—"} tone="success" />
      <Metric label="Waiting" value={num(o.counters.waiting)} sub="records not in the books yet" />
      <Metric label="Held" value={num(o.counters.held)} sub={`${num(o.counters.everHeld)} held at some point`} tone="hold" />
      <Metric label="Questions" value={num(o.counters.questions)} sub={`${o.counters.openQuestions} open`} />
    </Card>
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
      <h2 className="text-[17px] font-semibold tight">Pipeline</h2>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-6">
        {stages.map((s, i) => (
          <div key={s.label} className="relative">
            <div className="flex items-center gap-1 text-[13px] font-medium">{s.label === "Held in stories" ? <span className="text-hold">𝄐</span> : null}{s.label}{i < stages.length - 1 && i !== 3 ? <ArrowRight size={14} strokeWidth={1.75} className="ml-auto text-faint" /> : null}</div>
            <div className={`num mt-1 text-[20px] ${s.tone === "hold" ? "text-hold" : ""}`}>{num(s.n)}</div>
            <div className="mt-2"><Bar value={s.n} max={max} tone={s.tone} /></div>
            <div className="mt-1.5 text-[12px] text-faint">{s.note}</div>
          </div>
        ))}
      </div>
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
  const learned = o.rulesLearned;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold tight">Learning curve</h2>
        <span className="text-[12px] text-faint">share settled automatically on first pass</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Share settled automatically on first pass, by month">
        {[0.75, 0.8, 0.85, 0.9, 0.95, 1].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#d6dce5" strokeWidth={g === 0.75 ? 1 : 0.6} strokeDasharray={g === 0.75 ? "" : "2 4"} />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" className="num" fontSize="11" fill="#8b93a1">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {MONTH_LABELS.map((m, i) => <text key={m} x={x(i + 1)} y={H - 10} textAnchor="middle" fontSize="11" fill="#8b93a1">{m}</text>)}
        {path ? <path d={path} fill="none" stroke="#1f5fc0" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {pts.map((p) => (
          <g key={p.m}>
            <circle cx={x(p.m)} cy={y(p.r)} r={3.5} fill="#ffffff" stroke="#1f5fc0" strokeWidth={2} />
            <text x={x(p.m)} y={y(p.r) + 18} textAnchor="middle" className="num" fontSize="11" fill="#5f6775">{String(Math.round(p.r * 1000) / 10)}</text>
          </g>
        ))}
        {learned.map((r) => {
          const p = pts.find((q) => q.m === r.month);
          if (!p) return null;
          return (
            <g key={r.ruleId}>
              <text x={x(r.month)} y={y(p.r) - 14} textAnchor="middle" fontSize="18" fill="#b27d10" style={{ fontFamily: "var(--font-music)" }}>𝄐</text>
              <text x={x(r.month)} y={y(p.r) - 32} textAnchor="middle" className="num" fontSize="11" fill="#b27d10">{r.ruleId}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

const LANE_AGENTS = ["investigator", "learner", "auditor", "accountant", "cfo"];
function Lanes() {
  const lanes = useQuery(api.queries.lanes);
  const [sel, setSel] = useState<{ agent: string; month: number } | null>(null);
  return (
    <Card>
      <h2 className="text-[17px] font-semibold tight">Who did what</h2>
      <p className="mt-1 text-[12px] text-faint">One dot per month with activity. Click a dot for its reasoning.</p>
      <div className="mt-4 space-y-2.5">
        {LANE_AGENTS.map((a) => (
          <div key={a} className="flex items-center gap-3">
            <div className="w-24 text-[13px] text-secondary">{AGENT_LABEL[a]}</div>
            <div className="grid flex-1 grid-cols-12 gap-1">
              {MONTH_LABELS.map((m, i) => {
                const c = lanes?.[a]?.[i + 1];
                const on = !!c && c.n > 0;
                const active = sel?.agent === a && sel.month === i + 1;
                return (
                  <button key={m} title={`${AGENT_LABEL[a]}, ${m}`} disabled={!on} onClick={() => setSel({ agent: a, month: i + 1 })}
                    className="flex h-6 items-center justify-center rounded-full disabled:cursor-default">
                    <span className={`block rounded-full calm ${on ? (c!.denied ? "bg-danger" : a === "accountant" || a === "cfo" ? "bg-hold" : "bg-accent") : "bg-hairline"} ${active ? "ring-2 ring-accent ring-offset-2" : ""}`}
                      style={{ width: on ? 8 : 4, height: on ? 8 : 4 }} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-3 pl-[108px]"><div className="grid flex-1 grid-cols-12 gap-1 text-center text-[11px] text-faint">{MONTH_LABELS.map((m) => <span key={m}>{m[0]}</span>)}</div></div>
      </div>
      {sel ? <TracePanel agent={sel.agent} month={sel.month} /> : null}
    </Card>
  );
}

function TracePanel({ agent, month }: { agent: string; month: number }) {
  const lines = useQuery(api.queries.trace, { agent, month }) ?? [];
  return (
    <div className="mt-5">
      <div className="mb-2 text-[13px] font-medium">{AGENT_LABEL[agent]} · {MONTH_LABELS[month - 1]}</div>
      <Trace lines={lines} />
    </div>
  );
}

function Showcase() {
  const s = useQuery(api.queries.showcase);
  if (!s || (!s.vote && !s.fan)) return null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {s.vote ? (
        <Card>
          <Eyebrow>Placement vote</Eyebrow>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-[20px] font-semibold tight">Store {Number(s.vote.placement.store?.slice(1))}</div>
            <div className="num text-[20px] text-success">{Math.round(s.vote.placement.confidence * 100)}%</div>
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
        </Card>
      ) : null}
      {s.fan ? (
        <Card>
          <Eyebrow>Fan-out</Eyebrow>
          <div className="mt-2 flex items-baseline gap-2 text-[20px] font-semibold tight">
            <span>One Shopee payout of {rpShort(s.fan.amount)}</span><ArrowRight size={16} strokeWidth={1.75} className="text-faint" /><span className="num">{num(s.fan.orders)} orders</span>
          </div>
          <div className="mt-1 text-[12px] text-faint"><span className="num">{shortDate(s.fan.date)}</span> · {s.fan.store} · <span className="num">{s.fan.memo}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-[13px]">
            <div><div className="eyebrow">Orders</div><div className="num mt-1">{rp(s.fan.gross)}</div></div>
            <div><div className="eyebrow">Minus 6.5% and refunds</div><div className="num mt-1">{rp(Math.round(s.fan.gross * 0.065) + s.fan.refunds)}</div></div>
            <div><div className="eyebrow">Paid</div><div className="num mt-1">{rp(s.fan.amount)}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1">
            {Array.from({ length: Math.min(s.fan.orders, 840) }).map((_, i) => <span key={i} className={`block h-1.5 w-1.5 rounded-full ${s.fan!.settled ? "bg-success" : "bg-strong"}`} />)}
          </div>
          <div className="mt-3">{s.fan.settled ? <Pill tone="success">Settled under r4, every order accounted for</Pill> : <Pill>Not processed yet</Pill>}</div>
        </Card>
      ) : null}
    </div>
  );
}
