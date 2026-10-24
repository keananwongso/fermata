"use client";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useRole } from "./providers";
import { CONSOLE_KEY } from "./consoleKey";
import { ROLE_LABEL } from "./header";
import { Button, Pill } from "./ui";
import { Check, CornerDownRight } from "lucide-react";

export function QuestionCard({ q }: { q: Doc<"questions"> }) {
  const { role } = useRole();
  const answer = useMutation(api.humans.answer);
  const confirm = useMutation(api.humans.confirm);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const askedOf = q.askOf === "cfo" ? "CFO" : "Accountant";
  const mine = q.askOf === role;
  const chosen = q.options.find((o) => o.id === (q.answer ?? picked));

  const run = async (f: () => Promise<string | null>) => {
    setBusy(true); setError(null);
    try { const e = await f(); if (e) setError(e); } finally { setBusy(false); }
  };

  return (
    <div className="card p-5 lg:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Question for the {askedOf}</span>
        {q.real ? <Pill tone="info">Written by Claude</Pill> : <Pill>Scripted</Pill>}
        <span className="ml-auto">{q.state === "APPROVED" ? <Pill tone="success"><Check size={12} strokeWidth={1.75} />Answered and confirmed</Pill> : q.state === "PROPOSED" ? <Pill tone="accent">Waiting for confirm back</Pill> : <Pill tone="hold"><span aria-hidden className="text-hold">𝄐</span>Waiting for an answer</Pill>}</span>
      </div>
      <p className="title mt-4 text-[clamp(19px,2vw,22px)] leading-snug">{q.text}</p>

      {q.state === "NEEDS_INFO" && q.options.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {q.options.map((o) => (
            <button key={o.id} onClick={() => setPicked(o.id)} disabled={!mine}
              className={`calm rounded-[6px] border px-4 py-3 text-left disabled:cursor-not-allowed ${picked === o.id ? "border-accent bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]" : "border-hairline hover:border-strong hover:bg-warm"}`}>
              <div className="text-[14px] font-medium">{o.label}</div>
              <div className="mt-0.5 text-[12px] text-secondary">{o.impact}</div>
            </button>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={!mine || !picked || busy} onClick={() => run(() => answer({ questionId: q._id, optionId: picked!, actor: role, consoleKey: CONSOLE_KEY }))}>Answer as {ROLE_LABEL[role]}</Button>
            {!mine ? <span className="text-[12px] text-faint">Switch to {askedOf} in the header to answer.</span> : null}
          </div>
        </div>
      ) : null}

      {q.state === "PROPOSED" && chosen ? (
        <div className="panel enter mt-5 p-4">
          <div className="flex items-start gap-2 text-[14px]">
            <CornerDownRight size={16} strokeWidth={1.75} className="mt-0.5 text-faint" />
            <div>
              <div>The {askedOf} answered <span className="font-medium">{chosen.label}</span>. Fermata understood this as:</div>
              <div className="mt-1 text-secondary">{chosen.impact}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={!mine || busy} onClick={() => run(() => confirm({ questionId: q._id, actor: role, consoleKey: CONSOLE_KEY }))}>Confirm</Button>
            {!mine ? <span className="text-[12px] text-faint">Only the {askedOf} can confirm.</span> : null}
          </div>
        </div>
      ) : null}

      {q.state === "APPROVED" && chosen ? <div className="mt-4 text-[13px] text-secondary">{chosen.label}. {chosen.impact}</div> : null}
      {q.options.length === 0 ? <div className="mt-4 text-[13px] text-faint">The Investigator is still writing this question.</div> : null}
      {error ? <div className="mt-3 rounded-[6px] bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div> : null}
    </div>
  );
}

export function RuleApproval({ rule }: { rule: Doc<"rules"> }) {
  const { role } = useRole();
  const approve = useMutation(api.humans.approveRule);
  const [error, setError] = useState<string | null>(null);
  const bt = rule.backtest;
  return (
    <div className="card p-5 lg:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">New rule for the CFO</span>
        {rule.real ? <Pill tone="info">Written by Claude</Pill> : <Pill>Scripted</Pill>}
        <span className="ml-auto"><Pill tone={rule.state === "APPROVED" ? "success" : "accent"}>{rule.state === "APPROVED" ? "Approved" : "Proposed"}</Pill></span>
      </div>
      <p className="title mt-4 text-[clamp(19px,2vw,22px)]"><span className="num text-[0.8em] text-faint">{rule.ruleId}</span> {rule.title}</p>
      {bt ? (
        <div className="mt-4 grid grid-cols-3 gap-4 sm:gap-6">
          <div><div className="eyebrow">Covers last year</div><div className="figure mt-1.5 text-[26px] text-heading">{bt.covered.toLocaleString("en-US")}</div></div>
          <div><div className="eyebrow">Precision</div><div className="figure mt-1.5 text-[26px] text-heading">{(bt.precision * 100).toFixed(1)}%</div></div>
          <div><div className="eyebrow">Errors</div><div className="figure mt-1.5 text-[26px] text-heading">{bt.errors}</div></div>
        </div>
      ) : <div className="mt-3 text-[13px] text-faint">Backtesting on last year…</div>}
      {rule.audit ? <div className="mt-3 text-[13px] text-secondary"><span className="font-medium text-ink">Auditor: </span>{rule.audit.note}</div> : null}
      {rule.state === "PROPOSED" && rule.audit ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={async () => { const e = await approve({ ruleDocId: rule._id, actor: role, consoleKey: CONSOLE_KEY }); setError(e); }}>Approve {rule.ruleId} as {ROLE_LABEL[role]}</Button>
          {role !== "cfo" ? <span className="text-[12px] text-faint">Only the CFO approves rules. Try it as Accountant to see the denial in the record.</span> : null}
        </div>
      ) : null}
      {error ? <div className="mt-3 rounded-[6px] bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div> : null}
    </div>
  );
}
