"use client";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { AGENT_LABEL, Card, LinkArrow, Loading, PageHead, Pill } from "@/components/ui";
import { useLive } from "@/components/motion";
import { Search, ShieldX } from "lucide-react";

const WORDS: Record<string, string> = { NEW: "new", PROPOSED: "proposed", APPROVED: "approved", POSTED: "settled", NEEDS_INFO: "needs an answer", HELD: "held", WAITING: "waiting" };

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.queries.record>>>[number];

export default function RecordPage() {
  const [q, setQ] = useState("");
  const [ref, setRef] = useState<string | undefined>(undefined);
  const [denied, setDenied] = useState(false);
  const rows = useQuery(api.queries.record, { itemRef: ref, deniedOnly: denied });
  const pick = (r: string) => { setRef(r); setQ(r); };
  return (
    <div className="space-y-8 lg:space-y-10">
      <PageHead tag="Append only" title="Record">Every change Fermata or a person made, written in the same step as the change. Blocked attempts are kept too.</PageHead>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form className="calm flex min-h-11 w-full items-center gap-2 rounded-[6px] border border-hairline bg-ground px-3 focus-within:border-accent sm:w-96 lg:min-h-10" onSubmit={(e) => { e.preventDefault(); setRef(q.trim() || undefined); }}>
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bank line, story or rule (bt000123, r8)" aria-label="Search the record" className="num w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint" />
        </form>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-secondary lg:min-h-0"><input type="checkbox" className="size-4 accent-accent" checked={denied} onChange={(e) => setDenied(e.target.checked)} />Blocked attempts only</label>
        {ref ? <LinkArrow onClick={() => { setRef(undefined); setQ(""); }}>Show latest</LinkArrow> : null}
      </div>
      <div className="frame">
        <Card pad={false} className="overflow-hidden">
          {!rows ? <div className="px-6"><Loading>Loading…</Loading></div> : rows.length === 0 ? <div className="p-6 text-faint">Nothing recorded for this.</div> : <Rows key={`${ref}-${denied}`} rows={rows} onPick={pick} />}
        </Card>
      </div>
    </div>
  );
}

// Keyed by the filter, so a new search paints at once and only rows written afterwards slide in.
function Rows({ rows, onPick }: { rows: Row[]; onPick: (ref: string) => void }) {
  const live = useLive();
  return <>{rows.map((r) => <Entry key={r._id} r={r} animate={live} onPick={onPick} />)}</>;
}

function Entry({ r, animate, onPick }: { r: Row; animate: boolean; onPick: (ref: string) => void }) {
  const [fresh] = useState(animate);
  const head = r.itemRef.split(" ")[0];
  return (
    <div className={`border-b border-hairline px-4 py-4 last:border-0 lg:px-6 ${fresh ? "arrive" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="num text-[12px] text-faint">{new Date(r._creationTime).toLocaleTimeString("en-GB")}</span>
        {r.steps ? (
          r.steps.map((s, i) => <span key={i} className="text-secondary">{i ? "→ " : ""}<span className="font-medium text-ink">{AGENT_LABEL[s.actor]}</span> {s.action}</span>)
        ) : (
          <>
            <span className="font-medium">{AGENT_LABEL[r.actor]}</span>
            <span className="text-secondary">{r.action}</span>
          </>
        )}
        <button className="num calm text-link underline decoration-hairline underline-offset-4 hover:text-accent hover:decoration-accent" onClick={() => onPick(head)}>{r.itemRef}</button>
        {r.allowed ? <span className="text-secondary">{r.fromState ? WORDS[r.fromState] : "created"} → {r.toState ? WORDS[r.toState] : ""}</span> : <Pill tone="danger"><ShieldX size={12} strokeWidth={1.75} />Blocked: {r.denial}</Pill>}
        {r.staged ? <Pill>staged</Pill> : null}
      </div>
      <div className="mt-1 text-[13px] text-body">{r.reason}{r.authority ? <span className="text-faint"> · authority: {r.authority}</span> : null}</div>
      {r.diff.length ? (
        <div className="num mt-2 space-y-0.5 text-[12px]">
          {r.diff.map((d) => (
            <div key={d.field} className="flex flex-wrap gap-x-2"><span className="w-full shrink-0 text-faint sm:w-36">{d.field}</span>{d.before ? <span className="text-danger line-through decoration-1">{d.before}</span> : null}<span className="text-success">{d.after}</span></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
