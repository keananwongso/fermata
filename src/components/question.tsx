"use client";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useRole } from "./providers";
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
    <div className="rounded-[22px] border border-hairline p-6">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Question for the {askedOf}</span>
        {q.real ? <Pill tone="info">Written by Claude</Pill> : <Pill>Scripted</Pill>}
        <span className="ml-auto">{q.state === "APPROVED" ? <Pill tone="success"><Check size={12} strokeWidth={1.75} />Answered and confirmed</Pill> : q.state === "PROPOSED" ? <Pill tone="accent">Waiting for confirm back</Pill> : <Pill tone="hold"><span aria-hidden>𝄐</span>Waiting for an answer</Pill>}</span>
      </div>
      <p className="mt-3 text-[17px] font-medium leading-snug tight">{q.text}</p>

      {q.state === "NEEDS_INFO" && q.options.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {q.options.map((o) => (
            <button key={o.id} onClick={() => setPicked(o.id)} disabled={!mine}
              className={`calm rounded-[16px] border px-4 py-3 text-left disabled:cursor-not-allowed ${picked === o.id ? "border-accent bg-accent-tint" : "border-hairline hover:bg-hover"}`}>
              <div className="text-[14px] font-medium">{o.label}</div>
              <div className="mt-0.5 text-[12px] text-secondary">{o.impact}</div>
            </button>
          ))}
          <div className="mt-2 flex items-center gap-3">
            <Button variant="primary" disabled={!mine || !picked || busy} onClick={() => run(() => answer({ questionId: q._id, optionId: picked!, actor: role }))}>Answer as {ROLE_LABEL[role]}</Button>
            {!mine ? <span className="text-[12px] text-faint">Switch to {askedOf} in the header to answer.</span> : null}
          </div>
        </div>
      ) : null}

      {q.state === "PROPOSED" && chosen ? (
        <div className="mt-5 rounded-[16px] bg-well p-4">
          <div className="flex items-start gap-2 text-[14px]">
            <CornerDownRight size={16} strokeWidth={1.75} className="mt-0.5 text-faint" />
            <div>
              <div>The {askedOf} answered <span className="font-medium">{chosen.label}</span>. Fermata understood this as:</div>
              <div className="mt-1 text-secondary">{chosen.impact}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" disabled={!mine || busy} onClick={() => run(() => confirm({ questionId: q._id, actor: role }))}>Confirm</Button>
            {!mine ? <span className="text-[12px] text-faint">Only the {askedOf} can confirm.</span> : null}
          </div>
        </div>
      ) : null}

      {q.state === "APPROVED" && chosen ? <div className="mt-4 text-[13px] text-secondary">{chosen.label}. {chosen.impact}</div> : null}
      {q.options.length === 0 ? <div className="mt-4 text-[13px] text-faint">The Investigator is still writing this question.</div> : null}
      {error ? <div className="mt-3 rounded-[12px] bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div> : null}
    </div>
  );
}

export function RuleApproval({ rule }: { rule: Doc<"rules"> }) {
  const { role } = useRole();
  const approve = useMutation(api.humans.approveRule);
  const [error, setError] = useState<string | null>(null);
  const bt = rule.backtest;
  return (
    <div className="rounded-[22px] border border-hairline p-6">
      <div className="flex items-center gap-2">
        <span className="eyebrow">New rule for the CFO</span>
        {rule.real ? <Pill tone="info">Written by Claude</Pill> : <Pill>Scripted</Pill>}
        <span className="ml-auto"><Pill tone={rule.state === "APPROVED" ? "success" : "accent"}>{rule.state === "APPROVED" ? "Approved" : "Proposed"}</Pill></span>
      </div>
      <p className="mt-3 text-[17px] font-medium tight">{rule.ruleId}: {rule.title}</p>
      {bt ? (
        <div className="mt-3 grid grid-cols-3 gap-6">
          <div><div className="eyebrow">Covers last year</div><div className="num mt-1 text-[20px]">{bt.covered.toLocaleString("en-US")}</div></div>
          <div><div className="eyebrow">Precision</div><div className="num mt-1 text-[20px]">{(bt.precision * 100).toFixed(1)}%</div></div>
          <div><div className="eyebrow">Errors</div><div className="num mt-1 text-[20px]">{bt.errors}</div></div>
        </div>
      ) : <div className="mt-3 text-[13px] text-faint">Backtesting on last year…</div>}
      {rule.audit ? <div className="mt-3 text-[13px] text-secondary"><span className="font-medium text-ink">Auditor: </span>{rule.audit.note}</div> : null}
      {rule.state === "PROPOSED" && rule.audit ? (
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" onClick={async () => { const e = await approve({ ruleDocId: rule._id, actor: role }); setError(e); }}>Approve {rule.ruleId} as {ROLE_LABEL[role]}</Button>
          {role !== "cfo" ? <span className="text-[12px] text-faint">Only the CFO approves rules. Try it as Accountant to see the denial in the record.</span> : null}
        </div>
      ) : null}
      {error ? <div className="mt-3 rounded-[12px] bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div> : null}
    </div>
  );
}
