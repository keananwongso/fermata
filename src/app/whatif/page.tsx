"use client";
// What if: knobs for the generated world, then the real engine over the year with learning and without, computed by
// /api/simulate on this machine (no Convex, no Claude). Every number on the page comes back from that run.
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { MONTH_LABELS, STORES } from "../../../convex/lib/domain";
import { num, pct } from "../../../convex/lib/format";
import { DRIFT_EXAMPLE, LEARNING_DEFAULTS } from "../../../convex/lib/generate";
import type { SimResult } from "../../../scripts/simulateYear";
import { Button, Card, Eyebrow, Loading, Metric, PageHead, Pill } from "@/components/ui";
import { PUBLIC_SITE } from "@/components/nav";
import { FlaskConical } from "lucide-react";

const EASE = [0.645, 0.045, 0.355, 1] as const;
type Knobs = {
  preset: "learning" | "default"; seed: number; late: number; schoolMoved: number; advance: number; reversals: number; oneOffs: boolean;
  onboarding: boolean; onboardingShare: number; regionalFee: number;
  drift: boolean; driftMonth: number; driftFee: number; driftStores: string[];
  lender: boolean; lenderMonth: number; lenderCut: number; lenderVolume: number;
  answers: number; learnAt: Record<string, number>;
};
const D = LEARNING_DEFAULTS;
const START: Knobs = {
  preset: "learning", seed: D.seed, late: D.late, schoolMoved: D.schoolMoved, advance: D.advance, reversals: D.cashReversals?.perMonth ?? 0, oneOffs: D.oneOffs,
  onboarding: false, onboardingShare: 0.7, regionalFee: D.regionalFee,
  drift: false, driftMonth: DRIFT_EXAMPLE.month, driftFee: DRIFT_EXAMPLE.creditFee, driftStores: DRIFT_EXAMPLE.stores,
  lender: true, lenderMonth: D.lender.month, lenderCut: D.lender.cut, lenderVolume: D.lender.perMonth,
  answers: 0, learnAt: {},
};
const RULE_LABEL: Record<string, string> = { r8: "Moved students (r8)", r10: "Fees paid ahead (r10)", r11: "Reversed vouchers (r11)", r9: "New lender (r9)", r3: "Card fees (r3)" };
type Run = { note: string; genMs: number; learned: SimResult; baseline: SimResult; config: { regionalStores?: string[] } };

export default function WhatIfPage() {
  const [k, setK] = useState<Knobs>(START);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Knobs>(key: K, v: Knobs[K]) => setK((x) => ({ ...x, [key]: v }));
  if (PUBLIC_SITE) return <PageHead tag="Runs locally" title="What if">The simulator runs on your own machine. Clone the repository and open this page there.</PageHead>;

  const go = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preset: k.preset, seed: k.seed, late: k.late, schoolMoved: k.schoolMoved, advance: k.advance, reversals: k.reversals || null, oneOffs: k.oneOffs,
          onboarding: k.onboarding ? k.onboardingShare : null, regionalFee: k.regionalFee,
          drift: k.drift ? { month: k.driftMonth, creditFee: k.driftFee, stores: k.driftStores } : null,
          lender: k.lender ? { month: k.lenderMonth, cut: k.lenderCut, perMonth: k.lenderVolume } : null,
          answers: k.answers || undefined, learnAt: k.learnAt,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `the simulator returned ${res.status}`);
      setRun(body as Run);
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  };
  const learningWorld = k.preset === "learning";

  return (
    <div className="space-y-10 lg:space-y-14">
      <PageHead tag="Offline · no Claude" title="What if"
        actions={<Button variant="primary" className="self-start lg:self-auto" disabled={busy} onClick={go}><FlaskConical size={16} strokeWidth={1.75} className={busy ? "animate-pulse" : ""} />{busy ? "Running the year…" : "Run the year"}</Button>}>
        The real engine over a generated year, once learning and once with the rules frozen at onboarding. Here the Learner is code: answers come from the generator’s answer key, and each rule is fitted from the data and backtested before it applies.
      </PageHead>

      <div className="frame">
        <Card className="space-y-7">
          <Group title="World">
            <Segmented label="World" value={k.preset} options={[["learning", "Learning year"], ["default", "Recorded demo"]]} onChange={(v) => set("preset", v as Knobs["preset"])} />
            {learningWorld ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Field label="Late records" suffix="%" value={k.late * 100} step={0.5} onChange={(v) => set("late", v / 100)} />
                <Field label="Moved students" suffix="/mo" value={k.schoolMoved} step={50} onChange={(v) => set("schoolMoved", v)} />
                <Field label="Fees paid ahead" suffix="/mo" value={k.advance} step={50} onChange={(v) => set("advance", v)} />
                <Field label="Reversed vouchers" suffix="/mo" value={k.reversals} step={10} onChange={(v) => set("reversals", Math.max(0, v))} />
                <Field label="Seed" value={k.seed} step={1} onChange={(v) => set("seed", v)} />
                <Check label="One-off anomalies" checked={k.oneOffs} onChange={(v) => set("oneOffs", v)} />
              </div>
            ) : <p className="text-[13px] text-secondary">The world the demo recorded: its late records are planted to hit the brief’s first-pass rates, so its baseline climbs too.</p>}
          </Group>
          {learningWorld ? (
            <>
              <Group title="Card fees r3 does not know (no evidence they happen, off by default)">
                <div className="flex flex-wrap gap-x-6">
                  <Check label="Regional stores on another fee" checked={k.onboarding} onChange={(v) => set("onboarding", v)} />
                  <Check label="A fee rise" checked={k.drift} onChange={(v) => set("drift", v)} />
                </div>
                {k.onboarding ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <Field label="January first pass" suffix="%" value={k.onboardingShare * 100} step={1} onChange={(v) => set("onboardingShare", v / 100)} />
                    <Field label="Regional credit fee" suffix="%" value={k.regionalFee * 100} step={0.05} onChange={(v) => set("regionalFee", v / 100)} />
                  </div>
                ) : null}
                {k.drift ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                      <MonthField label="From" value={k.driftMonth} onChange={(v) => set("driftMonth", v)} />
                      <Field label="Credit fee" suffix="%" value={k.driftFee * 100} step={0.05} onChange={(v) => set("driftFee", v / 100)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Stores the fee rise hits">
                      {STORES.map((s) => {
                        const on = k.driftStores.includes(s.code);
                        return <button key={s.code} aria-pressed={on} onClick={() => set("driftStores", on ? k.driftStores.filter((x) => x !== s.code) : [...k.driftStores, s.code].sort())}
                          className={`calm num min-h-9 rounded-[4.5px] border px-2.5 text-[12px] lg:min-h-7 ${on ? "border-accent bg-accent text-white" : "border-hairline bg-ground text-secondary hover:border-strong"}`}>{s.code}</button>;
                      })}
                    </div>
                  </div>
                ) : null}
              </Group>
              <Group title="New lender FIN_Z" toggle={<Check label="On" checked={k.lender} onChange={(v) => set("lender", v)} />}>
                {k.lender ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <MonthField label="From" value={k.lenderMonth} onChange={(v) => set("lenderMonth", v)} />
                    <Field label="Its cut" suffix="%" value={k.lenderCut * 100} step={0.05} onChange={(v) => set("lenderCut", v / 100)} />
                    <Field label="Payouts" suffix="/mo" value={k.lenderVolume} step={50} onChange={(v) => set("lenderVolume", v)} />
                  </div>
                ) : null}
              </Group>
            </>
          ) : null}
          <Group title="Learning">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Field label="Answers per close" suffix={k.answers ? "" : "all"} value={k.answers} step={1} onChange={(v) => set("answers", Math.max(0, v))} />
              {(["r8", "r10", "r11", "r9", "r3"] as const).map((r) => (
                <label key={r} className="block">
                  <span className="eyebrow">{RULE_LABEL[r]}</span>
                  <select value={k.learnAt[r] ?? 0} onChange={(e) => { const v = Number(e.target.value); setK((x) => { const learnAt = { ...x.learnAt }; if (v) learnAt[r] = v; else delete learnAt[r]; return { ...x, learnAt }; }); }}
                    className="calm mt-1.5 min-h-11 w-full rounded-[6px] border border-hairline bg-ground px-2.5 text-[13px] outline-none focus:border-accent lg:min-h-10">
                    <option value={0}>When asked</option>
                    {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>Not before {m}</option>)}
                    <option value={13}>Never</option>
                  </select>
                </label>
              ))}
            </div>
          </Group>
        </Card>
      </div>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      {busy && !run ? <Loading>Generating the world and closing the year twice…</Loading> : null}
      {run ? <Results key={JSON.stringify(run.learned.months.map((m) => m.firstSettled))} run={run} /> : null}
    </div>
  );
}

function Results({ run }: { run: Run }) {
  const L = run.learned, B = run.baseline;
  const share = (r: SimResult, i: number) => r.months[i].firstSettled / r.months[i].total;
  const released = L.months.reduce((a, m) => a + m.released, 0);
  return (
    <div className="enter space-y-6">
      <div className="frame">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Settled on first pass</Eyebrow>
              <h2 className="title mt-1.5 text-[clamp(19px,2.2vw,24px)]">Learning against rules frozen at onboarding</h2>
            </div>
            <div className="flex flex-wrap gap-2"><Pill tone="accent">Learning</Pill><Pill>Baseline</Pill></div>
          </div>
          <div className="sm:hidden"><Chart L={L} B={B} W={340} H={220} /></div>
          <div className="hidden sm:block"><Chart L={L} B={B} W={900} H={260} /></div>
          {L.learned.length ? <div className="mt-3 flex flex-wrap gap-2">{L.learned.map((r) => <Pill key={`${r.id}${r.version}`} tone="accent">{MONTH_LABELS[r.month - 1]} · {r.id} v{r.version}</Pill>)}</div> : null}
          <div className="mt-6 grid grid-cols-2 gap-6 border-t border-hairline pt-5 md:grid-cols-4">
            <Metric label="December, learning" value={pct(share(L, 11))} sub={`January ${pct(share(L, 0))}`} />
            <Metric label="December, baseline" value={pct(share(B, 11))} sub={`January ${pct(share(B, 0))}`} />
            <Metric label="Held at year end" value={num(L.final.held)} sub={`${num(B.final.held)} without learning`} tone="hold" />
            <Metric label="Released by learned rules" value={num(released)} sub={`world ${run.genMs} ms, years ${L.ms} and ${B.ms} ms`} />
          </div>
          <p className="mt-5 border-t border-hairline pt-3 text-[12px] text-faint">{run.note} Wrong store against the hidden truth: {L.wrongStore} learning, {B.wrongStore} baseline.</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card pad={false} className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-hairline bg-well">
              <tr className="eyebrow"><th className="px-4 py-3 font-normal lg:px-6">Month</th><th className="py-3 text-right font-normal">Lines</th><th className="py-3 text-right font-normal">Learning</th><th className="hidden py-3 text-right font-normal sm:table-cell">Held</th><th className="hidden py-3 text-right font-normal sm:table-cell">Released</th><th className="py-3 text-right font-normal">Baseline</th><th className="px-4 py-3 text-right font-normal lg:px-6">Held</th></tr>
            </thead>
            <tbody>
              {L.months.map((m, i) => (
                <tr key={m.month} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2.5 lg:px-6">{MONTH_LABELS[i]}{m.learned.length ? <span className="ml-2 text-[12px] text-accent">{m.learned.join(", ")}</span> : null}</td>
                  <td className="num py-2.5 text-right text-secondary">{num(m.total)}</td>
                  <td className="num py-2.5 text-right text-heading">{pct(share(L, i))}</td>
                  <td className="num hidden py-2.5 text-right text-secondary sm:table-cell">{num(m.held)}</td>
                  <td className="num hidden py-2.5 text-right text-secondary sm:table-cell">{m.released ? num(m.released) : "—"}</td>
                  <td className="num py-2.5 text-right text-secondary">{pct(share(B, i))}</td>
                  <td className="num px-4 py-2.5 text-right text-secondary lg:px-6">{num(B.months[i].held)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="space-y-5">
          <Eyebrow>What it learned</Eyebrow>
          {L.learned.length ? L.learned.map((r) => (
            <div key={`${r.id}${r.version}`} className="space-y-2 border-b border-hairline pb-5 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2"><span className="num text-faint">{r.id} v{r.version}</span><span className="font-medium text-heading">{r.title}</span><Pill>Code</Pill><span className="text-[12px] text-faint">{MONTH_LABELS[r.month - 1]}</span></div>
              <p className="text-[13px] text-secondary">{r.answeredBy}, from the answer key: {r.answer}.</p>
              <div className="panel num space-y-1 p-3 text-[12px] text-body">
                <div>› fitted: {r.fit}</div>
                <div>› backtest on {r.backtest.scope}: covers {num(r.backtest.covered)} of {num(r.backtest.of)}, {r.backtest.wrong} wrong</div>
                {r.backtest.notes.map((n) => <div key={n}>› {n}</div>)}
                <div>› released {num(r.released)} held lines</div>
              </div>
            </div>
          )) : <p className="text-[13px] text-secondary">Nothing learned in this run.</p>}
          {L.rejected.length ? <div className="space-y-1">{L.rejected.map((r, i) => <p key={i} className="text-[12px] text-danger">{MONTH_LABELS[r.month - 1]}: {r.id} not applied, {r.why}</p>)}</div> : null}
          <p className="text-[12px] text-faint">{L.questions.length} questions answered at the closes, {L.questions.length - L.learned.length} of them one-offs or answers that taught no rule.</p>
        </Card>
      </div>
    </div>
  );
}

function Chart({ L, B, W, H }: { L: SimResult; B: SimResult; W: number; H: number }) {
  const left = 44, right = 14, top = 20, bottom = 30;
  const vals = [...L.months, ...B.months].map((m) => m.firstSettled / m.total);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.03) * 20) / 20), hi = Math.min(1, Math.ceil(Math.max(...vals) * 20) / 20);
  const x = (i: number) => left + (i / 11) * (W - left - right);
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (H - top - bottom);
  const path = (r: SimResult) => r.months.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m.firstSettled / m.total).toFixed(1)}`).join(" ");
  const grid: number[] = [];
  for (let g = lo; g <= hi + 1e-9; g += 0.05) grid.push(Math.round(g * 100) / 100);
  const marked = new Set(L.learned.map((r) => r.month - 1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img" aria-label={`First pass share by month. Learning: ${L.months.map((m, i) => `${MONTH_LABELS[i]} ${pct(m.firstSettled / m.total)}`).join(", ")}. Baseline: ${B.months.map((m, i) => `${MONTH_LABELS[i]} ${pct(m.firstSettled / m.total)}`).join(", ")}.`}>
      {grid.map((g, k) => (
        <g key={g}>
          <line x1={left} x2={W - right} y1={y(g)} y2={y(g)} stroke="var(--color-hairline)" strokeWidth={k === 0 ? 1 : 0.6} strokeDasharray={k === 0 ? "" : "2 4"} />
          <text x={left - 8} y={y(g) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--color-faint)">{pct(g, 0)}</text>
        </g>
      ))}
      {MONTH_LABELS.map((m, i) => <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize={W < 400 ? 9.5 : 11} fill={marked.has(i) ? "var(--color-accent)" : "var(--color-faint)"}>{m}</text>)}
      <motion.path d={path(B)} fill="none" stroke="var(--color-mute)" strokeWidth={1.75} strokeDasharray="5 4" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: EASE }} />
      <motion.path d={path(L)} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: EASE }} />
      {L.months.map((m, i) => <circle key={i} cx={x(i)} cy={y(m.firstSettled / m.total)} r={3.5} fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth={1.75} />)}
    </svg>
  );
}

function Group({ title, toggle, children }: { title: string; toggle?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4"><Eyebrow>{title}</Eyebrow>{toggle}</div>
      {children}
    </div>
  );
}

function Field({ label, suffix, value, step, onChange }: { label: string; suffix?: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <span className="calm mt-1.5 flex min-h-11 items-center gap-1.5 rounded-[6px] border border-hairline bg-ground px-2.5 focus-within:border-accent lg:min-h-10">
        <input type="number" step={step} value={Math.round(value * 1000) / 1000} onChange={(e) => onChange(Number(e.target.value))} className="num w-full min-w-0 bg-transparent text-[13px] outline-none" />
        {suffix ? <span className="text-[12px] text-faint">{suffix}</span> : null}
      </span>
    </label>
  );
}

function MonthField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="calm mt-1.5 min-h-11 w-full rounded-[6px] border border-hairline bg-ground px-2.5 text-[13px] outline-none focus:border-accent lg:min-h-10">
        {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end text-[13px] text-secondary lg:min-h-0"><input type="checkbox" className="size-4 accent-accent" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-[6px] border border-hairline bg-well p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`calm min-h-9 rounded-[4.5px] px-3 text-[12px] lg:min-h-7 ${value === v ? "bg-accent text-white" : "text-secondary hover:text-ink"}`}>{text}</button>)}
    </div>
  );
}
