"use client";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { num, pct, shortDate } from "../../../convex/lib/format";
import { Bar, Button, Card, Eyebrow, Metric, PageHead, Pill } from "@/components/ui";
import { Count } from "@/components/motion";
import { FlaskConical } from "lucide-react";

export default function EvaluationPage() {
  const runs = useQuery(api.queries.evaluation);
  const o = useQuery(api.queries.overview);
  const runEval = useAction(api.evaluation.run);
  const [busy, setBusy] = useState(false);
  const r = runs?.[0]?.result;
  const n = (k: string) => (typeof r?.[k] === "number" ? (r[k] as number) : 0);
  const lines = o?.counters.processed ?? 0;
  const manualHours = (104820 * 2) / 60;
  const answered = o ? o.counters.questions : 0;
  const fermataHours = (answered * 5 + 2 * 10) / 60;
  return (
    <div className="space-y-10 lg:space-y-14">
      <PageHead tag="Hidden truth" title="Evaluation"
        actions={
          <Button variant="primary" className="self-start lg:self-auto" disabled={busy || lines === 0} onClick={async () => { setBusy(true); try { await runEval({}); } finally { setBusy(false); } }}>
            <FlaskConical size={16} strokeWidth={1.75} className={busy ? "animate-pulse" : ""} />{busy ? "Running the checks…" : "Run the checks"}
          </Button>
        }>Checked against the generator’s hidden truth, which the engine never reads.</PageHead>

      <div className="frame">
      <Card className="grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Eyebrow>Time</Eyebrow>
          <div className="display mt-3 text-[clamp(36px,5vw,56px)] tabular-nums">~3,500 hours <span className="text-accent">→</span> ~<Count value={Math.max(1, Math.round(fermataHours))} /> hours</div>
          <p className="mt-4 text-[13px] text-secondary">Assumes 2 minutes per manual match for 104,820 bank lines ({num(Math.round(manualHours))} hours), against about 5 minutes per question ({answered} so far) and 10 minutes per rule approval for people using Fermata.</p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Metric label="Wrong postings" value={r ? num(n("wrongStore")) : "—"} sub={r ? `of ${num(n("withStore"))} settled with a store` : "run the checks"} tone={r && n("wrongStore") === 0 ? "success" : undefined} />
          <Metric label="Held out week precision" value={r ? pct(n("weekSettled") ? n("weekCorrect") / n("weekSettled") : 1) : "—"} sub={r ? `${shortDate(String(r.weekFrom))} to ${shortDate(String(r.weekTo))}, ${num(n("weekSettled"))} settled` : ""} />
          <Metric label="Fuzzer mutants posted wrongly" value={r ? num(n("fuzzSettled")) : "—"} sub={r ? `of ${num(n("fuzzTried"))} mutated lines` : ""} tone={r && n("fuzzSettled") === 0 ? "success" : undefined} />
          <Metric label="Settled by people" value={r ? num(n("byPerson")) : "—"} sub={r ? `${num(n("byRule"))} by rules` : ""} />
        </div>
      </Card>
      </div>

      {r ? (
        <div key={runs?.[0]?._id} className="enter grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <Eyebrow>Held out week</Eyebrow>
            <p className="mt-2 text-[13px] text-secondary">Rules r1 to r7 were fitted on one month of last year, so all of this year is unseen data. This week is reported on its own, untouched by any rule written this year.</p>
            <div className="mt-4 space-y-3">
              <div><div className="flex justify-between text-[13px]"><span>Settled automatically</span><span className="num">{num(n("weekSettled"))} of {num(n("weekTotal"))}</span></div><div className="mt-1.5"><Bar value={n("weekSettled")} max={n("weekTotal")} tone="success" /></div></div>
              <div><div className="flex justify-between text-[13px]"><span>Correct store and match</span><span className="num">{num(n("weekCorrect"))}</span></div><div className="mt-1.5"><Bar value={n("weekCorrect")} max={Math.max(1, n("weekSettled"))} /></div></div>
            </div>
          </Card>
          <Card>
            <Eyebrow>Fuzzer</Eyebrow>
            <p className="mt-2 text-[13px] text-secondary">Takes real settled lines and breaks them: a few rupiah off, 1% off, 3% short, or the store code swapped. Every mutant should be held, or still land at the true store for the true amount. A swapped school virtual account is recovered by r8, which follows the receipt; a cash deposit a few rupiah off is inside r3’s Rp 5,000 coin tolerance.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill tone="hold"><span className="text-hold">𝄐</span> {num(n("fuzzHeld"))} held</Pill>
              <Pill>{num(n("fuzzWaiting"))} waiting</Pill>
              <Pill tone="info">{num(n("fuzzRecovered"))} still placed at the true store</Pill>
              <Pill tone={n("fuzzSettled") ? "danger" : "success"}>{num(n("fuzzSettled"))} posted wrongly</Pill>
            </div>
            {r.fuzzSlipped ? <div className="num mt-3 text-[12px] text-danger">{String(r.fuzzSlipped)}</div> : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
