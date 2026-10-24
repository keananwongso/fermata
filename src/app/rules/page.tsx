"use client";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, pct } from "../../../convex/lib/format";
import { Bar, Card, Eyebrow, Loading, PageHead, Pill, StateBadge, Trace, AGENT_LABEL } from "@/components/ui";
import { RuleApproval } from "@/components/question";

export default function RulesPage() {
  const rules = useQuery(api.queries.rules);
  const [sel, setSel] = useState<string | null>(null);
  if (!rules) return <Loading>Loading rules…</Loading>;
  const id = sel ?? rules[0]?.ruleId;
  return (
    <div className="space-y-10 lg:space-y-14">
      <PageHead tag={`${rules.length} rules`} title="Rules">Small programs the engine runs. Each one approved by the CFO, each settlement records which rule and version allowed it.</PageHead>
      <div className="frame">
      <Card pad={false} className="overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-hairline bg-well">
            <tr className="eyebrow"><th className="px-4 py-3 font-normal lg:px-6">Rule</th><th className="hidden py-3 font-normal md:table-cell">Where it came from</th><th className="hidden py-3 text-right font-normal sm:table-cell">Seen</th><th className="py-3 pl-3 text-right font-normal">Settled</th><th className="px-4 py-3 text-right font-normal lg:px-6">Status</th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r._id} onClick={() => setSel(r.ruleId)} aria-selected={id === r.ruleId} className={`calm cursor-pointer border-b border-hairline last:border-0 ${id === r.ruleId ? "bg-warm shadow-[inset_2px_0_0_var(--color-accent)]" : "hover:bg-hover"}`}>
                <td className="px-4 py-3.5 lg:px-6"><div className="flex items-center gap-2"><span className="num text-faint">{r.ruleId}</span>{r.learnedInMonth ? <span className="text-hold">𝄐</span> : null}<span className={`font-medium ${id === r.ruleId ? "text-heading" : ""}`}>{r.title}</span>{r.scenario ? <Pill>Scenario</Pill> : null}</div></td>
                <td className="hidden py-3.5 text-secondary md:table-cell">{r.origin}</td>
                <td className="num hidden py-3.5 text-right text-secondary sm:table-cell">{r.seen ? `${num(r.seen.count)}` : "—"}</td>
                <td className="num py-3.5 pl-3 text-right">{num(r.settledCount)}</td>
                <td className="px-4 py-3.5 text-right lg:px-6"><StateBadge state={r.state} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      </div>
      {id ? <RuleDetail key={id} ruleId={id} /> : null}
    </div>
  );
}

function RuleDetail({ ruleId }: { ruleId: string }) {
  const d = useQuery(api.queries.rule, { ruleId });
  if (!d) return null;
  const r = d.rule;
  const bt = r.backtest;
  const approval = d.audit.find((a) => a.action === "approve" && a.allowed);
  return (
    <section className="enter space-y-6">
      <div>
        <Eyebrow>Rule detail</Eyebrow>
        <h2 className="title mt-3 text-[clamp(24px,3vw,34px)]"><span className="num text-[0.6em] tracking-normal text-faint">{r.ruleId} v{r.version}</span> {r.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {r.real ? <Pill tone="info">Program written by Claude</Pill> : <Pill>{r.learnedInMonth ? "Scripted program" : "Derived from last year’s rows"}</Pill>}
          {r.learnedInMonth ? <Pill tone="hold"><span className="text-hold">𝄐</span> learned in {MONTH_LABELS[r.learnedInMonth - 1]}</Pill> : null}
          {r.seen ? <Pill>Seen {num(r.seen.count)} times · {r.seen.scope}</Pill> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <Eyebrow>The rule as code</Eyebrow>
          <pre className="panel mt-3 overflow-x-auto p-4 text-[12px] leading-relaxed">{JSON.stringify(JSON.parse(r.program), null, 2)}</pre>
        </Card>
        <div className="space-y-6">
          <Card>
            <Eyebrow>Backtest</Eyebrow>
            {bt ? (
              <div className="mt-3 space-y-4">
                <div><div className="flex justify-between text-[13px]"><span>Precision</span><span className="num">{pct(bt.precision)}</span></div><div className="mt-1.5"><Bar value={bt.precision} max={1} tone="success" /></div></div>
                <div><div className="flex justify-between text-[13px]"><span>Coverage</span><span className="num">{num(bt.covered)} · {pct(bt.coverage)}</span></div><div className="mt-1.5"><Bar value={bt.coverage} max={1} /></div></div>
                <div className="text-[12px] text-faint">{num(bt.correct)} correct, {num(bt.errors)} errors, on {bt.scope}.</div>
                {bt.examples.length ? <div className="num space-y-0.5 text-[12px] text-secondary">{bt.examples.map((e) => <div key={e}>{e}</div>)}</div> : null}
              </div>
            ) : <p className="mt-3 text-[13px] text-secondary">{r.seen ? `Fitted on last year’s rows: seen ${num(r.seen.count)} times (${r.seen.scope}). The fitted parameters are in the code.` : "Not backtested yet."}</p>}
          </Card>
          <Card>
            <Eyebrow>Auditor</Eyebrow>
            <div className="mt-2 flex items-center gap-2">{r.audit ? <Pill tone={r.audit.result === "pass" ? "success" : r.audit.result === "flag" ? "hold" : "danger"}>{r.audit.result === "pass" ? "Passed" : r.audit.result === "flag" ? "Flagged" : "Blocked"}</Pill> : null}<span className="text-[12px] text-faint">{r.audit?.real ? "Claude" : "scripted wording, real counts"}</span></div>
            <p className="mt-2 text-[14px] text-body">{r.audit?.note ?? "No audit yet."}</p>
            <div className="mt-4 text-[13px] text-secondary">{approval ? <>Approved by {AGENT_LABEL[approval.actor]}: “{approval.reason}”</> : "Not approved yet."}</div>
          </Card>
        </div>
      </div>
      {r.state === "PROPOSED" ? <RuleApproval rule={r} /> : null}
      {d.trace.length ? <div><Eyebrow>How it was made</Eyebrow><div className="mt-2"><Trace lines={d.trace.map((t) => ({ _id: t._id, kind: t.kind, text: `${AGENT_LABEL[t.agent]}: ${t.text}`, real: t.real }))} /></div></div> : null}
    </section>
  );
}
