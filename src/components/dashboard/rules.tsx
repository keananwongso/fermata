"use client";
// Rules inside the dashboard window: the small programs the engine runs, where each came from, and for the rules
// learned this year the backtest and what the Auditor found.
import { useState } from "react";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num } from "../../../convex/lib/format";
import { AGENT_LABEL, Bar, Pill, StateBadge } from "../ui";
import { DAY_ZERO, fitSentence, seenOf } from "../dayZero";
import { R, learned, pctOf, type Rule } from "./data";
import { ViewHead } from "./parts";

// Last year for the fitted rules; for a learned rule, whose correction or answer it came from, and when.
function source(r: Rule) {
  if (!r.learnedInMonth) return "Learned from last year";
  const who = /^cfo/i.test(r.origin) ? "cfo" : /^accountant/i.test(r.origin) ? "accountant" : null;
  const kind = /correction/i.test(r.origin) ? "correction" : "answer";
  return `From ${who ? `the ${AGENT_LABEL[who]}'s` : "a person's"} ${kind} in ${MONTH_LABELS[r.learnedInMonth - 1]}`;
}

const AUDIT: Record<string, ["neutral" | "hold" | "danger", string]> = { pass: ["neutral", "Passed"], flag: ["hold", "Flagged"], block: ["danger", "Blocked"] };

export function Rules() {
  const [openId, setOpenId] = useState<string | null>(learned[0]?.id ?? null);
  const fitted = R.rules.length - learned.length;
  const onboarding = R.rules.filter((r) => !r.learnedInMonth);
  return (
    <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-6">
      <ViewHead title="Rules"
        aside={<span className="num text-[12px] text-faint">{R.rules.length} rules · {fitted} mined from last year · {learned.length} learned this year</span>}>
        Small programs the engine runs. Each settlement records which rule allowed it.
      </ViewHead>
      {onboarding.length ? <DayZero rules={onboarding} /> : null}
      <ul className="card divide-y divide-hairline overflow-hidden">
        {R.rules.map((r) => {
          const open = openId === r.id;
          return (
            <li key={r.id}>
              <button type="button" aria-expanded={open} aria-controls={`rule-${r.id}`} onClick={() => setOpenId(open ? null : r.id)}
                className={`calm flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left lg:px-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${open ? "bg-warm" : "hover:bg-hover"}`}>
                <span className="num w-6 shrink-0 text-[12px] text-faint">{r.id}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] leading-snug ${open ? "font-medium text-heading" : "text-ink"}`}>{r.title}</span>
                  <span className="mt-0.5 block text-[11.5px] text-faint">{source(r)}</span>
                </span>
                <span className="shrink-0"><StateBadge state={r.state} quiet /></span>
                <span aria-hidden className={`calm shrink-0 text-faint ${open ? "rotate-90" : ""}`}>›</span>
              </button>
              {open ? <RuleDetail r={r} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Day 0: one pass over last year's matched lines before the first close. Each row is the question asked of the old
// books, the fit that answered it (read from the rule's program), and how many lines it saw. Open by default.
function DayZero({ rules }: { rules: Rule[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="card overflow-hidden">
      <button type="button" aria-expanded={open} aria-controls="day-zero" onClick={() => setOpen(!open)}
        className="calm flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left hover:bg-hover lg:px-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-heading">Day 0 · what it learned from last year</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-secondary">One pass over last year&apos;s matched lines. Code, not a model: each shape&apos;s parameters are fitted and written as a program, and the CFO approves each one once.</span>
        </span>
        <span aria-hidden className={`calm mt-0.5 shrink-0 text-faint ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open ? (
        <div id="day-zero" className="enter border-t border-hairline">
          <ul className="divide-y divide-hairline">
            {rules.map((r) => {
              const seen = seenOf(r);
              return (
                <li key={r.id} className="grid gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[1.5rem_1fr_auto] lg:px-5">
                  <span className="num text-[12px] text-faint">{r.id}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] leading-snug text-ink">{DAY_ZERO[r.id]?.question ?? r.title}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-secondary">{fitSentence(r.program)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:text-right">
                    {seen ? <span className="text-[12px] text-secondary"><span className="num text-ink">{num(seen.count)}</span> seen · <span className="text-faint">{seen.scope}</span></span> : null}
                    <Pill>Approved once by the CFO</Pill>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-hairline bg-well/60 px-4 py-2.5 text-[11.5px] leading-snug text-faint lg:px-5">Last year here is one full month plus a full year of lender payouts.</p>
        </div>
      ) : null}
    </section>
  );
}

function RuleDetail({ r }: { r: Rule }) {
  const bt = r.backtest;
  const seen = r.learnedInMonth ? null : seenOf(r);
  const audit = r.audit ? AUDIT[r.audit.result] ?? (["neutral", r.audit.result] as const) : null;
  return (
    <div id={`rule-${r.id}`} className="enter grid gap-4 border-t border-hairline bg-well/60 px-4 py-4 lg:grid-cols-2 lg:px-5">
      <div className="min-w-0 space-y-4">
        <div>
          <div className="eyebrow">Backtest</div>
          {bt ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-body"><span className="num text-ink">{num(bt.correct)}</span> correct of <span className="num text-ink">{num(bt.covered)}</span> covered</span>
                <span className="num text-ink">{pctOf(bt.precision)}</span>
              </div>
              <Bar value={bt.precision} max={1} />
              <p className="text-[12px] leading-snug text-secondary">Precision on {bt.scope}{bt.errors ? <>; <span className="num">{num(bt.errors)}</span> wrong</> : null}.</p>
              {bt.examples.length ? (
                <ul className="panel space-y-0.5 px-3 py-2 font-mono text-[11px] leading-relaxed text-secondary">
                  {bt.examples.slice(0, 3).map((e) => <li key={e}>› {e}</li>)}
                  {bt.examples.length > 3 ? <li className="text-faint">and {bt.examples.length - 3} more</li> : null}
                </ul>
              ) : null}
            </div>
          ) : <p className="mt-2 text-[12.5px] leading-snug text-secondary">{seen
            ? <>Fitted on <span className="num text-ink">{num(seen.count)}</span> of last year&apos;s lines ({seen.scope}) and approved once by the CFO at last year&apos;s close. The recording holds no separate backtest for it.</>
            : <>Fitted on last year&apos;s rows and approved at last year&apos;s close. The recording holds no backtest for it.</>}</p>}
        </div>
        <div>
          <div className="eyebrow">Auditor</div>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            {audit ? <Pill tone={audit[0]}>{audit[1]}</Pill> : null}
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-body">{r.audit?.note ?? "No audit on record."}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="eyebrow">The rule as code · {r.real ? "written by Claude" : r.fittedBy === "code" ? "fitted by code from the data" : r.learnedInMonth ? "scripted" : "derived from last year's rows"}</div>
        <pre className="scroll-quiet mt-2 overflow-x-auto rounded-[8px] bg-night px-3 py-2.5 text-[11.5px] leading-relaxed text-white/85">{JSON.stringify(r.program, null, 2)}</pre>
      </div>
    </div>
  );
}
