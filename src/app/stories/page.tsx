"use client";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { MONTH_LABELS, STORE_BY_CODE } from "../../../convex/lib/domain";
import { num, pct, rp, rpShort, shortDate } from "../../../convex/lib/format";
import { Card, Eyebrow, Pill, StateBadge, Trace } from "@/components/ui";
import { QuestionCard } from "@/components/question";

export default function StoriesPage() {
  const list = useQuery(api.queries.stories);
  const [sel, setSel] = useState<string | null>(null);
  if (!list) return <div className="text-faint">Loading stories…</div>;
  if (!list.length) return <Empty />;
  const key = sel ?? list[0].key;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <div>
        <h1 className="text-[28px] font-semibold tight">Stories</h1>
        <p className="mt-1 text-[13px] text-secondary">Held lines grouped by root cause. One question each.</p>
        <div className="mt-6 space-y-1">
          {list.map((s) => (
            <button key={s.key} onClick={() => setSel(s.key)}
              className={`calm block w-full rounded-[16px] px-4 py-3 text-left ${key === s.key ? "bg-well" : "hover:bg-hover"}`}>
              <div className="flex items-center gap-2 text-[12px] text-faint">
                <span>{MONTH_LABELS[s.month - 1]}</span>
                {s.narrated ? <span className="font-medium text-hold">Story {s.narrated}</span> : null}
                <span className="ml-auto"><StateBadge state={s.state} label={s.state === "POSTED" ? "Resolved" : undefined} /></span>
              </div>
              <div className="mt-1 text-[14px] font-medium leading-snug">{s.title}</div>
              <div className="num mt-1 text-[12px] text-secondary">{num(s.count)} lines · {rpShort(s.amount)}</div>
            </button>
          ))}
        </div>
      </div>
      <CaseFile storyKey={key} />
    </div>
  );
}

function Empty() {
  return <div><h1 className="text-[28px] font-semibold tight">Stories</h1><p className="mt-2 text-secondary">No held lines yet. Close the year from Run and stories appear here as Fermata finds them.</p></div>;
}

function CaseFile({ storyKey }: { storyKey: string }) {
  const d = useQuery(api.queries.story, { key: storyKey });
  if (!d) return <div className="text-faint">Loading the case file…</div>;
  const s = d.story;
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Eyebrow>Case file · {MONTH_LABELS[s.month - 1]}</Eyebrow>
          {s.narrated ? <Pill tone="hold">Story {s.narrated}</Pill> : null}
        </div>
        <h2 className="mt-2 text-[20px] font-semibold tight">{s.title}</h2>
        <div className="num mt-1 text-[13px] text-secondary">
          {num(s.count)} lines · {rp(s.amount)} · {s.stores.length ? s.stores.map((x) => STORE_BY_CODE[x]?.name ?? x).join(", ") : "no store"}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="hold">𝄐 {num(d.counts.held)} held</Pill>
          {d.counts.settled ? <Pill tone="success">{num(d.counts.settled)} settled</Pill> : null}
          {s.resolution ? <Pill tone="info">{s.resolution}</Pill> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <Eyebrow>Bank</Eyebrow>
          <div className="mt-3 space-y-3">
            {d.sample.map((x) => (
              <div key={x.ref} className="text-[12px]">
                <div className="flex justify-between"><span className="num text-secondary">{shortDate(x.date)} · {x.account}</span><span className="num font-medium">{rp(x.amount)}</span></div>
                <div className="num mt-0.5 truncate text-faint" title={x.memo}>{x.memo}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Eyebrow>Books</Eyebrow>
          <div className="mt-3 space-y-3">
            {d.sample.map((x) => (
              <div key={x.ref} className="text-[12px]">
                <div className="text-ink">{x.note}</div>
                <div className="num mt-0.5 text-faint">
                  {Object.entries(x.facts).map(([k, val]) => `${k} ${typeof val === "number" && Math.abs(val) > 1000 ? rp(val) : val}`).join(" · ") || (x.placement?.store ? `placed at ${STORE_BY_CODE[x.placement.store]?.name}, ${pct(x.placement.confidence, 0)}` : "no match")}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Eyebrow>{s.gap === "unknown_lender" ? "Known lenders" : "Placement evidence"}</Eyebrow>
          {s.gap === "unknown_lender" ? (
            <div className="mt-3 space-y-2 text-[13px]">
              {d.knownLenders.map((l) => (
                <div key={l.lender + l.rule} className="flex justify-between"><span>{l.lender}</span><span className="num text-secondary">{(l.cut * 100).toFixed(1)}% · {l.rule}</span></div>
              ))}
              {!d.knownLenders.some((l) => l.lender === "FIN_Z") ? <div className="flex justify-between text-hold"><span>FIN_Z</span><span>not in any approved rule</span></div> : null}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {d.sample.slice(0, 3).map((x) => (
                <div key={x.ref} className="text-[12px]">
                  {(x.placement?.votes ?? []).map((v) => <div key={v.store} className="flex justify-between"><span>{STORE_BY_CODE[v.store]?.name}</span><span className="num text-secondary">{v.score.toFixed(2)} · {v.reasons.join(", ")}</span></div>)}
                  {!x.placement?.votes.length ? <div className="text-faint">No store evidence</div> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-2 flex items-center gap-2"><Eyebrow>Investigator</Eyebrow>{s.investigation ? (s.investigation.real ? <Pill tone="info">Claude</Pill> : <Pill>Scripted</Pill>) : null}</div>
          {s.investigation ? <p className="mb-3 text-[14px]">{s.investigation.summary} <span className="text-secondary">{s.investigation.hypothesis}</span></p> : null}
          <Trace lines={d.trace.filter((t) => t.agent === "investigator").map((t) => ({ _id: t._id, kind: t.kind, text: t.text, real: t.real, staged: t.staged }))} empty="The Investigator has not started on this story." />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2"><Eyebrow>Auditor’s second opinion</Eyebrow>{s.auditorOpinion ? (s.auditorOpinion.real ? <Pill tone="info">Claude</Pill> : <Pill>Scripted</Pill>) : null}</div>
          <Card><p className="text-[14px]">{s.auditorOpinion?.text ?? "Not yet."}</p></Card>
        </div>
      </div>

      {d.question ? <QuestionCard q={d.question} /> : null}
    </div>
  );
}
