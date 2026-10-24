"use client";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { AGENT_LABEL, Card, Pill } from "@/components/ui";
import { Search, ShieldX } from "lucide-react";

const WORDS: Record<string, string> = { NEW: "new", PROPOSED: "proposed", APPROVED: "approved", POSTED: "settled", NEEDS_INFO: "needs an answer", HELD: "held", WAITING: "waiting" };

export default function RecordPage() {
  const [q, setQ] = useState("");
  const [ref, setRef] = useState<string | undefined>(undefined);
  const [denied, setDenied] = useState(false);
  const rows = useQuery(api.queries.record, { itemRef: ref, deniedOnly: denied });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tight">Record</h1>
        <p className="mt-1 text-[13px] text-secondary">Every change Fermata or a person made, written in the same step as the change. Blocked attempts are kept too.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2 rounded-[8px] border border-hairline px-3 py-2" onSubmit={(e) => { e.preventDefault(); setRef(q.trim() || undefined); }}>
          <Search size={16} strokeWidth={1.75} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bank line, story or rule (bt000123, r8)" className="num w-80 bg-transparent text-[13px] outline-none" />
        </form>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-secondary"><input type="checkbox" className="accent-[#1f5fc0]" checked={denied} onChange={(e) => setDenied(e.target.checked)} />Blocked attempts only</label>
        {ref ? <button className="text-[13px] text-accent" onClick={() => { setRef(undefined); setQ(""); }}>Show latest</button> : null}
      </div>
      <Card pad={false} className="overflow-hidden">
        {!rows ? <div className="p-6 text-faint">Loading…</div> : rows.length === 0 ? <div className="p-6 text-faint">Nothing recorded for this.</div> : null}
        {rows?.map((r) => (
          <div key={r._id} className="border-b border-hairline px-6 py-4 last:border-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="num text-[12px] text-faint">{new Date(r._creationTime).toLocaleTimeString("en-GB")}</span>
              <span className="font-medium">{AGENT_LABEL[r.actor]}</span>
              <span className="text-secondary">{r.action}</span>
              <button className="num text-accent" onClick={() => { setRef(r.itemRef.split(" ")[0]); setQ(r.itemRef.split(" ")[0]); }}>{r.itemRef}</button>
              {r.allowed ? <span className="text-secondary">{r.fromState ? WORDS[r.fromState] : "created"} → {r.toState ? WORDS[r.toState] : ""}</span> : <Pill tone="danger"><ShieldX size={12} strokeWidth={1.75} />Blocked: {r.denial}</Pill>}
              {r.staged ? <Pill>staged</Pill> : null}
            </div>
            <div className="mt-1 text-[13px] text-secondary">{r.reason}{r.authority ? <span className="text-faint"> · authority: {r.authority}</span> : null}</div>
            {r.diff.length ? (
              <div className="num mt-2 space-y-0.5 text-[12px]">
                {r.diff.map((d) => (
                  <div key={d.field} className="flex gap-2"><span className="w-36 shrink-0 text-faint">{d.field}</span>{d.before ? <span className="text-danger line-through decoration-1">{d.before}</span> : null}<span className="text-success">{d.after}</span></div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
