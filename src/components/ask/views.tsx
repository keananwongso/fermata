"use client";
// The five answer templates for Ask the books. Each one renders a view built by code from a named query
// (convex/ask.ts), so every number here comes from the data, never from the model's text.
import { motion } from "motion/react";
import type { AskView, BreakdownView, FigureView, LinesView, Refusal, StoryView, TrendView, Unit } from "../../../convex/lib/ask";
import { formatValue } from "../../../convex/lib/ask";
import { rp, shortDate } from "../../../convex/lib/format";
import { ChatList } from "../caseRoom";
import { AGENT_LABEL, Bar, Pill, StateBadge } from "../ui";
import { Roll } from "../motion";

const EASE = [0.645, 0.045, 0.355, 1] as const;

// A headline number that rolls in: rupiah in bn or m, shares as percentages, counts whole.
function RollValue({ value, unit }: { value: number; unit: Unit }) {
  if (unit === "pct") return <Roll value={Math.round(value * 1000) / 10} suffix="%" format={{ maximumFractionDigits: 1 }} />;
  if (unit === "count") return <Roll value={value} format={{ maximumFractionDigits: 0 }} />;
  const a = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (a >= 1e9) return <Roll value={Math.round(a / 1e7) / 100} prefix={`${sign}Rp `} suffix="bn" format={{ maximumFractionDigits: 2 }} />;
  if (a >= 1e6) return <Roll value={Math.round(a / 1e5) / 10} prefix={`${sign}Rp `} suffix="m" format={{ maximumFractionDigits: 1 }} />;
  return <Roll value={a} prefix={`${sign}Rp `} format={{ maximumFractionDigits: 0 }} />;
}

function Source({ children }: { children: string }) {
  return <p className="mt-5 border-t border-hairline pt-3 text-[12px] text-faint">Source: {children}</p>;
}

function Head({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h3 className="title mt-1.5 text-[clamp(19px,2.2vw,24px)]">{title}</h3>
      </div>
      {right}
    </div>
  );
}

// ---------------- Figure ----------------

export function Figure({ v }: { v: FigureView }) {
  return (
    <div>
      <Head eyebrow="Figure" title={v.title} />
      <div className="mt-5 grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-end">
        <div className="min-w-0">
          <div className="eyebrow">{v.label}</div>
          <div className="display mt-2 text-[clamp(40px,11cqi,76px)] tabular-nums"><RollValue value={v.value} unit={v.unit} /></div>
        </div>
        {v.compare ? (
          <div className="min-w-0 border-hairline sm:border-l sm:pl-6">
            <div className="eyebrow">{v.compare.label}</div>
            <div className="figure mt-2 text-[28px] text-secondary lg:text-[34px]">{formatValue(v.compare.value, v.compare.unit)}</div>
          </div>
        ) : null}
      </div>
      {v.note ? <p className="mt-4 max-w-[560px] text-[13px] text-secondary">{v.note}</p> : null}
      <Source>{v.source}</Source>
    </div>
  );
}

// ---------------- Trend ----------------

export function Trend({ v }: { v: TrendView }) {
  const max = Math.max(...v.points.map((p) => p.value), 0);
  const min = v.unit === "pct" ? Math.max(0, Math.floor((Math.min(...v.points.map((p) => p.value)) - 0.03) * 20) / 20) : 0;
  const hi = v.unit === "pct" ? Math.min(1, Math.ceil(max * 20) / 20) : niceMax(max);
  const first = v.points[0], last = v.points[v.points.length - 1];
  return (
    <div>
      <Head eyebrow="Trend" title={v.title} right={first && last ? (
        <div className="text-right">
          <div className="eyebrow">{first.label} to {last.label}</div>
          <div className="figure mt-1 text-[22px] text-heading">{formatValue(first.value, v.unit)} <span className="text-faint">→</span> {formatValue(last.value, v.unit)}</div>
        </div>
      ) : null} />
      {v.style === "line" ? (
        // A narrower drawing on phones, so its labels stay readable instead of shrinking with the width.
        <><div className="sm:hidden"><LineChart v={v} lo={min} hi={hi} W={340} H={220} /></div><div className="hidden sm:block"><LineChart v={v} lo={min} hi={hi} W={640} H={240} /></div></>
      ) : <BarChart v={v} max={hi} />}
      {v.marks.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.marks.map((m) => <Pill key={m.label} tone="accent">{m.at} · {m.label}</Pill>)}
        </div>
      ) : null}
      <Source>{v.source}</Source>
    </div>
  );
}

function LineChart({ v, lo, hi, W, H }: { v: TrendView; lo: number; hi: number; W: number; H: number }) {
  const L = 44, R = 14, T = 20, B = 30;
  const fill = `ask-fill-${W}`;
  const n = v.points.length;
  const x = (i: number) => L + (n > 1 ? i / (n - 1) : 0.5) * (W - L - R);
  const y = (val: number) => T + (1 - (val - lo) / (hi - lo || 1)) * (H - T - B);
  const path = v.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = n > 1 ? `${path} L${x(n - 1).toFixed(1)},${y(lo)} L${x(0).toFixed(1)},${y(lo)} Z` : "";
  // Round ticks: 5% steps for shares, otherwise a 1, 2 or 5 step that gives four or five lines.
  const span = hi - lo || 1;
  const step = v.unit === "pct" ? 0.05 : [1, 2, 5].map((m) => m * 10 ** Math.floor(Math.log10(span / 4))).find((x) => span / x <= 5) ?? span / 4;
  const grid: number[] = [];
  for (let g = lo; g <= hi + 1e-9; g += step) grid.push(Math.round(g * 1e6) / 1e6);
  const marked = new Set(v.marks.map((m) => m.at));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full max-w-[760px]" role="img" aria-label={`${v.title}: ${v.points.map((p) => `${p.label} ${formatValue(p.value, v.unit)}`).join(", ")}`}>
      <defs>
        <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g, k) => (
        <g key={k}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-hairline)" strokeWidth={k === 0 ? 1 : 0.6} strokeDasharray={k === 0 ? "" : "2 4"} />
          <text x={L - 8} y={y(g) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--color-faint)">{formatValue(g, v.unit)}</text>
        </g>
      ))}
      {v.points.map((p, i) => <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize={W < 400 ? 9.5 : 11} fill={marked.has(p.label) ? "var(--color-accent)" : "var(--color-faint)"}>{p.label}</text>)}
      {area ? <motion.path d={area} fill={`url(#${fill})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} /> : null}
      <motion.path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: EASE }} />
      {v.points.map((p, i) => (
        <motion.circle key={p.label} cx={x(i)} cy={y(p.value)} r={3.5} fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth={1.75}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: (i / Math.max(1, n - 1)) * 1.1 }} />
      ))}
    </svg>
  );
}

const niceMax = (n: number) => { if (n <= 0) return 1; const e = 10 ** Math.floor(Math.log10(n)); return [1, 2, 2.5, 5, 10].map((m) => m * e).find((x) => x >= n) ?? n; };

// Bar labels have little room: thousands as "8.1k".
const compact = (n: number, unit: Unit) => (unit === "count" && n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : formatValue(n, unit));

function BarChart({ v, max }: { v: TrendView; max: number }) {
  const marked = new Set(v.marks.map((m) => m.at));
  return (
    <div className="mt-5 grid h-44 grid-cols-12 items-end gap-1 sm:gap-1.5" role="img" aria-label={`${v.title}: ${v.points.map((p) => `${p.label} ${formatValue(p.value, v.unit)}`).join(", ")}`}>
      {v.points.map((p, i) => (
        <div key={p.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
          <span className="num text-[10px] text-secondary sm:text-[11px]">{p.value ? compact(p.value, v.unit) : ""}</span>
          <motion.div className="w-full rounded-t-[3px] bg-accent" style={{ originY: 1 }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: i * 0.04, ease: EASE }}>
            <div style={{ height: `${Math.max(p.value ? 3 : 0, (p.value / (max || 1)) * 128)}px` }} />
          </motion.div>
          <span className={`text-[10px] sm:text-[11px] ${marked.has(p.label) ? "text-accent" : "text-faint"}`}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- Breakdown ----------------

export function Breakdown({ v }: { v: BreakdownView }) {
  const max = Math.max(1, ...v.rows.map((r) => r.value));
  return (
    <div>
      <Head eyebrow="Breakdown" title={v.title} right={<div className="text-right"><div className="eyebrow">Total</div><div className={`figure mt-1 text-[22px] ${v.tone === "hold" ? "text-hold" : "text-heading"}`}>{formatValue(v.total, v.unit)}</div></div>} />
      <ul className="mt-5 space-y-3">
        {v.rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5">
            <span className="truncate text-[13.5px] text-ink">{r.label}</span>
            <span className="num text-[13px] text-ink">{formatValue(r.value, v.unit)}{r.sub ? <span className="ml-2 text-faint">{r.sub}</span> : null}</span>
            <div className="col-span-2"><Bar value={r.value} max={max} tone={v.tone} /></div>
          </li>
        ))}
      </ul>
      {!v.rows.length ? <div className="hatch mt-5 rounded-[6px] px-4 py-8 text-center text-[13px] text-faint">Nothing here.</div> : null}
      <Source>{v.source}</Source>
    </div>
  );
}

// ---------------- Lines ----------------

const OUTCOME: Record<string, [string, "hold" | "neutral"]> = { settled: ["Settled", "neutral"], held: ["Held", "hold"], waiting: ["Waiting", "neutral"], open: ["Open", "neutral"] };

function Outcome({ o }: { o: string }) {
  const [label, tone] = OUTCOME[o] ?? [o, "neutral"];
  return <Pill tone={tone}>{o === "held" ? <span aria-hidden className="text-hold">𝄐</span> : null}{label}</Pill>;
}

export function Lines({ v }: { v: LinesView }) {
  return (
    <div>
      <Head eyebrow="Bank lines" title={v.title} right={<div className="text-right"><div className="eyebrow">{v.matched.toLocaleString("en-US")} lines</div><div className="figure mt-1 text-[22px] text-heading">{formatValue(v.amount, "rp")}</div></div>} />
      {/* Wide screens get a table; phones get one stacked row per line, so nothing scrolls sideways. */}
      <div className="mt-5 hidden md:block">
        <table className="w-full table-fixed text-[12.5px]">
          <thead>
            <tr className="text-left">
              {["Date", "Bank memo", "Amount", "Outcome", "Rule", "Store"].map((h, i) => <th key={h} className={`eyebrow pb-2 font-normal ${i === 2 ? "text-right" : ""} ${i === 3 ? "pl-4" : ""} ${["w-[64px]", "", "w-[132px]", "w-[112px]", "w-[72px]", "w-[80px]"][i]}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r, i) => (
              <tr key={i} className="border-t border-hairline align-top">
                <td className="num py-2 text-secondary">{shortDate(r.date)}</td>
                <td className="py-2 pr-3"><div className="truncate font-mono text-[11.5px] text-ink" title={r.memo}>{r.memo}</div>{r.note ? <div className="truncate text-[11.5px] text-faint" title={r.note}>{r.note}</div> : null}</td>
                <td className="num py-2 text-right text-ink">{rp(r.amount)}</td>
                <td className="py-2 pl-4"><Outcome o={r.outcome} /></td>
                <td className="num py-2 text-secondary">{r.rule ?? "none"}</td>
                <td className="py-2 text-secondary">{r.store ?? "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 divide-y divide-hairline md:hidden">
        {v.rows.map((r, i) => (
          <li key={i} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="num text-[12px] text-secondary">{shortDate(r.date)}{r.store ? ` · ${r.store}` : ""}</span>
              <span className="num text-[13px] text-ink">{rp(r.amount)}</span>
            </div>
            <div className="mt-1 truncate font-mono text-[11.5px] text-ink">{r.memo}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2"><Outcome o={r.outcome} /><span className="num text-[11.5px] text-faint">{r.rule ? `rule ${r.rule}` : "no rule"}</span></div>
          </li>
        ))}
      </ul>
      {v.matched > v.rows.length ? <p className="mt-3 text-[12px] text-faint">Showing {v.rows.length} of {v.matched.toLocaleString("en-US")}.</p> : null}
      {!v.rows.length ? <div className="hatch mt-5 rounded-[6px] px-4 py-8 text-center text-[13px] text-faint">No bank lines match.</div> : null}
      <Source>{v.source}</Source>
    </div>
  );
}

// ---------------- Story ----------------

export function Story({ v }: { v: StoryView }) {
  const askedOf = v.question?.askOf === "cfo" ? "CFO" : "Accountant";
  return (
    <div>
      <Head eyebrow={v.kind === "rule" ? "Rule" : "Story"} title={v.title} right={<StateBadge state={v.state} label={v.kind === "rule" && v.state === "APPROVED" ? "Approved" : undefined} />} />
      <p className="mt-1 text-[12.5px] text-faint">{v.subtitle}</p>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {v.facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="eyebrow">{f.label}</dt>
            <dd className="figure mt-1.5 truncate text-[20px] text-heading">{f.value}</dd>
          </div>
        ))}
      </dl>

      {v.rule ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-[13px]">
            <div><span className="eyebrow">Where it came from</span><p className="mt-1 text-body">{v.rule.origin}</p></div>
            {v.rule.audit ? <div><span className="eyebrow">Auditor</span><p className="mt-1 text-body"><Pill tone={v.rule.audit.result === "block" ? "danger" : "neutral"}>{v.rule.audit.result}</Pill> {v.rule.audit.note}</p></div> : null}
            {v.rule.backtest ? <p className="text-[12px] text-faint">Backtest scope: {v.rule.backtest.scope}</p> : null}
            <Pill>{v.rule.real ? "Written by Claude" : "Scripted"}</Pill>
          </div>
          <pre className="scroll-quiet max-h-56 overflow-auto rounded-[8px] bg-night px-3 py-2 text-[11.5px] leading-relaxed text-white/85">{v.rule.program}</pre>
        </div>
      ) : null}

      {v.question ? (
        <div className="mt-5 rounded-[8px] border border-hold-tint-strong bg-hold-tint/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2"><span className="eyebrow">Question for the {askedOf}</span><Pill>{v.question.real ? "Written by Claude" : "Scripted"}</Pill></div>
          <p className="mt-1.5 text-[14px] text-ink">{v.question.text}</p>
          {v.question.answer ? <p className="mt-2 text-[13px] text-secondary"><span className="font-medium text-ink">Answered: {v.question.answer}.</span> {v.question.impact}</p> : <p className="mt-2 text-[13px] text-hold-ink"><span aria-hidden>𝄐</span> Waiting for the {askedOf}</p>}
        </div>
      ) : null}

      {v.messages.length ? (
        <div className="mt-5">
          <div className="eyebrow">{v.kind === "rule" ? "Said about it in the case room" : "The case room"}</div>
          <div className="scroll-quiet panel mt-2 max-h-[420px] overflow-y-auto px-3 pb-3 pt-1" role="log" aria-label="Case room transcript">
            <ChatList msgs={v.messages} animate={false} />
          </div>
        </div>
      ) : null}

      {v.record.length ? (
        <div className="mt-5">
          <div className="eyebrow">The record</div>
          <ul className="panel mt-2 space-y-1 p-3 font-mono text-[11.5px] leading-relaxed">
            {v.record.map((r, i) => (
              <li key={i} className={`flex flex-wrap gap-x-3 sm:flex-nowrap ${r.allowed ? "text-ink" : "text-danger"}`}>
                <span className="w-24 shrink-0 truncate text-faint">{AGENT_LABEL[r.actor] ?? r.actor}</span>
                <span className="w-16 shrink-0">{r.action}</span>
                <span className="w-full min-w-0 break-words sm:w-auto sm:flex-1">{r.allowed ? r.reason : `denied: ${r.denial}`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Source>{v.source}</Source>
    </div>
  );
}

// ---------------- refusal ----------------

export function RefusalNote({ r }: { r: Refusal }) {
  return (
    <div className="rounded-[8px] border border-danger/20 bg-danger-tint px-4 py-3 text-[13px] text-danger" role="note">
      <div className="font-medium">Blocked by the gateway</div>
      <div className="mt-0.5">Asked to {r.action} {r.target}. {r.denial}. The refusal is in the record, like every denied step.</div>
    </div>
  );
}

export function View({ v }: { v: AskView }) {
  if (v.template === "figure") return <Figure v={v} />;
  if (v.template === "trend") return <Trend v={v} />;
  if (v.template === "breakdown") return <Breakdown v={v} />;
  if (v.template === "lines") return <Lines v={v} />;
  return <Story v={v} />;
}
