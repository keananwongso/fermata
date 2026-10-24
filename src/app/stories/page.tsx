"use client";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { MONTH_LABELS, STORE_BY_CODE } from "../../../convex/lib/domain";
import { num, pct, rp, rpShort, shortDate } from "../../../convex/lib/format";
import { Card, Eyebrow, Loading, PageHead, Pill, StateBadge } from "@/components/ui";
import { QuestionCard } from "@/components/question";
import { RoomPermissions, RoomTranscript } from "@/components/caseRoom";

export default function StoriesPage() {
  const list = useQuery(api.queries.stories);
  const [sel, setSel] = useState<string | null>(null);
  if (!list) return <Loading>Loading stories…</Loading>;
  if (!list.length) return <Empty />;
  const key = sel ?? list[0].key;
  return (
    <div className="space-y-8 lg:space-y-10">
      <PageHead tag={`${list.length} rooms`} title="Case rooms">Every held story gets a meeting. The agents work it out, then ask one person one question.</PageHead>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 min-w-0 lg:sticky lg:top-24 lg:mx-0 lg:block lg:max-h-[calc(100dvh-8rem)] lg:snap-none lg:space-y-1 lg:self-start lg:overflow-y-auto lg:p-0" role="list" aria-label="Case rooms">
          {list.map((s) => (
            <button key={s.key} onClick={() => setSel(s.key)} role="listitem" aria-current={key === s.key ? "true" : undefined}
              className={`calm block w-[78%] max-w-[300px] shrink-0 snap-start rounded-[6px] border px-4 py-3 text-left lg:w-full lg:max-w-none ${key === s.key ? "border-hairline bg-warm shadow-[inset_2px_0_0_var(--color-accent)]" : "border-hairline bg-ground hover:bg-hover lg:border-transparent lg:bg-transparent"}`}>
              <div className="flex items-center gap-2 text-[12px] text-faint">
                <span>{MONTH_LABELS[s.month - 1]}</span>
                {s.narrated ? <span className="font-medium text-hold-ink">Story {s.narrated}</span> : null}
                <span className="ml-auto">{s.room?.state === "meeting" ? <Pill tone="accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full" />In meeting</Pill> : <StateBadge state={s.state} label={s.state === "POSTED" ? "Resolved" : undefined} />}</span>
              </div>
              <div className={`mt-1 text-[14px] font-medium leading-snug ${key === s.key ? "text-heading" : ""}`}>{s.title}</div>
              <div className="num mt-1 text-[12px] text-secondary">{num(s.count)} lines · {rpShort(s.amount)}</div>
            </button>
          ))}
        </div>
        <CaseFile key={key} storyKey={key} />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="space-y-8">
      <PageHead title="Case rooms">Every held story gets a meeting. The agents work it out, then ask one person one question.</PageHead>
      <div className="hatch rounded-[10px] border border-hairline px-6 py-14 text-center">
        <div className="text-[28px] text-hold" style={{ fontFamily: "var(--font-music)" }} aria-hidden>𝄐</div>
        <p className="mx-auto mt-3 max-w-[420px] text-body">No held lines yet. Close the year from Run, and a room opens here for each story Fermata holds.</p>
      </div>
    </div>
  );
}

function CaseFile({ storyKey }: { storyKey: string }) {
  const d = useQuery(api.queries.story, { key: storyKey });
  if (!d) return <Loading>Loading the case file…</Loading>;
  const s = d.story;
  return (
    <div className="enter min-w-0 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Eyebrow>Case file · {MONTH_LABELS[s.month - 1]}</Eyebrow>
          {s.narrated ? <Pill tone="hold">Story {s.narrated}</Pill> : null}
        </div>
        <h2 className="title mt-3 text-[clamp(24px,3vw,34px)]">{s.title}</h2>
        <div className="num mt-2 text-[13px] text-secondary">
          {num(s.count)} lines · {rp(s.amount)} · {s.stores.length ? s.stores.map((x) => STORE_BY_CODE[x]?.name ?? x).join(", ") : "no store"}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="hold"><span className="text-hold">𝄐</span> {num(d.counts.held)} held</Pill>
          {d.counts.settled ? <Pill tone="success">{num(d.counts.settled)} settled</Pill> : null}
          {s.resolution ? <Pill tone="info">{s.resolution}</Pill> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <RoomTranscript story={s} />
          {d.question ? <QuestionCard q={d.question} /> : null}
        </div>
        <div className="xl:sticky xl:top-24 xl:self-start"><RoomPermissions /></div>
      </div>

      <div>
        <Eyebrow>Evidence on file</Eyebrow>
        <div className="mt-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <Eyebrow>Bank</Eyebrow>
            <div className="mt-3 space-y-3">
              {d.sample.map((x) => (
                <div key={x.ref} className="text-[12px]">
                  <div className="flex items-baseline justify-between gap-2"><span className="num truncate text-secondary">{shortDate(x.date)} · {x.account}</span><span className="num shrink-0 whitespace-nowrap font-medium">{rp(x.amount)}</span></div>
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
                  <div key={l.lender + l.rule} className="flex justify-between gap-3"><span>{l.lender}</span><span className="num text-secondary">{(l.cut * 100).toFixed(1)}% · {l.rule}</span></div>
                ))}
                {!d.knownLenders.some((l) => l.lender === "FIN_Z") ? <div className="flex justify-between gap-3 font-medium text-hold-ink"><span><span className="text-hold">𝄐</span> FIN_Z</span><span>not in any approved rule</span></div> : null}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {d.sample.slice(0, 3).map((x) => (
                  <div key={x.ref} className="text-[12px]">
                    {(x.placement?.votes ?? []).map((v) => <div key={v.store}><div className="flex justify-between gap-2"><span className="whitespace-nowrap font-medium">{STORE_BY_CODE[v.store]?.name}</span><span className="num text-secondary">{v.score.toFixed(2)}</span></div><div className="text-faint">{v.reasons.join(", ")}</div></div>)}
                    {!x.placement?.votes.length ? <div className="text-faint">No store evidence</div> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
