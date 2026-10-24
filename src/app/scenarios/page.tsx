"use client";
import { useMutation, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { BANK_ACCOUNTS, DEALERS, MONTH_LABELS, STORES, STORE_BY_CODE } from "../../../convex/lib/domain";
import { num, rp, rpShort, shortDate } from "../../../convex/lib/format";
import { Button, Card, Eyebrow, LinkArrow, Loading, PageHead, Pill, StateBadge } from "@/components/ui";
import { CONSOLE_KEY } from "@/components/consoleKey";
import { RotateCcw } from "lucide-react";

type Kind = "lender" | "lender_no" | "no_store" | "dealer";
type Params = { month?: number; lender?: string; cut?: number; payouts?: number; stores?: string[]; unmatched?: number; amount?: number; account?: string; count?: number; store?: string; invoices?: number; fee?: boolean };
type Scenario = NonNullable<ReturnType<typeof useQuery<typeof api.scenario.list>>>[number];

// Four cases a judge is likely to ask about. Every field can be changed before injecting.
const PRESETS: { kind: Kind; name: string; expect: string; params: Params }[] = [
  { kind: "lender", name: "New lender", expect: "Held, a live room, a question for the CFO. Answer yes: a rule, a backtest, and the payouts settle.", params: { lender: "FIN_Q", cut: 4.2, payouts: 6, stores: ["S05", "S09"], unmatched: 0, month: 12 } },
  { kind: "lender_no", name: "New lender, the CFO says no", expect: "The same room and question. Answer no: every payout stays held and nothing is booked.", params: { lender: "FIN_R", cut: 5.5, payouts: 4, stores: ["S02"], unmatched: 0, month: 12 } },
  { kind: "no_store", name: "Deposit no store recorded", expect: "Held, a live room, a question for the Accountant. Not ours: kept held, never booked as income.", params: { amount: 12_500_000, account: "BANK_A", count: 3, month: 12 } },
  { kind: "dealer", name: "Dealer pays open invoices", expect: "Settles on the first pass under r6. No room and no question: there is nothing to ask.", params: { store: "S03", invoices: 3, fee: false, month: 12 } },
];
const KIND_NAME: Record<string, string> = Object.fromEntries(PRESETS.map((p) => [p.kind, p.name]));

export default function ScenariosPage() {
  const list = useQuery(api.scenario.list);
  const reset = useMutation(api.scenario.reset);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-10 lg:space-y-14">
      <PageHead tag="Console only" title="Scenarios"
        actions={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <Button disabled={busy || !list?.length} onClick={async () => { setBusy(true); try { setNote(await reset({ consoleKey: CONSOLE_KEY })); } catch (e) { setNote(String(e).replace(/^.*ConvexError: /, "")); } finally { setBusy(false); } }}>
              <RotateCcw size={15} strokeWidth={1.75} />Reset scenarios
            </Button>
            {note ? <span className="max-w-[360px] text-[12px] text-faint lg:text-right">{note}</span> : null}
          </div>
        }>
        Put your own bank lines into the closed year and watch the real engine, agents and people handle them. Scenario rows are tagged, never reach Ask the books, and Reset removes them.
      </PageHead>
      <div className="frame">
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          {PRESETS.map((p) => <Preset key={p.kind} preset={p} />)}
        </div>
      </div>
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="title text-[clamp(22px,2.4vw,28px)]">Injected</h2>
          {list ? <span className="num text-[12px] text-faint">{list.length} scenario{list.length === 1 ? "" : "s"}</span> : null}
        </div>
        {!list ? <Loading>Loading scenarios…</Loading> : list.length === 0 ? (
          <div className="hatch rounded-[10px] border border-hairline px-6 py-12 text-center text-[14px] text-body">Nothing injected yet. Pick a case above.</div>
        ) : list.map((s) => <Injected key={s.sid} s={s} />)}
      </section>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block min-w-0 ${wide ? "col-span-2" : ""}`}><span className="eyebrow mb-1 block">{label}</span>{children}</label>;
}

function Preset({ preset }: { preset: (typeof PRESETS)[number] }) {
  const inject = useMutation(api.scenario.inject);
  const [p, setP] = useState<Params>(preset.params);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Params) => (e: { target: { value: string } }) => setP((x) => ({ ...x, [k]: typeof preset.params[k] === "number" ? Number(e.target.value) : e.target.value }));
  const lender = preset.kind === "lender" || preset.kind === "lender_no";
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const r = await inject({ kind: preset.kind, params: p, consoleKey: CONSOLE_KEY });
      if (r.error) setError(r.error);
      else if (r.sid) document.getElementById(r.sid)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally { setBusy(false); }
  };
  return (
    <Card className="flex flex-col">
      <Eyebrow>{preset.name}</Eyebrow>
      <p className="mt-2 text-[13px] text-secondary">{preset.expect}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {lender ? <>
          <Field label="Lender, as the bank names it"><input className="field num" value={p.lender} onChange={set("lender")} /></Field>
          <Field label="Its cut, %"><input className="field num" type="number" step={0.1} min={0.5} max={9.5} value={p.cut} onChange={set("cut")} /></Field>
          <Field label="Payouts"><input className="field num" type="number" min={1} max={40} value={p.payouts} onChange={set("payouts")} /></Field>
          <Field label="Without a sale"><input className="field num" type="number" min={0} max={39} value={p.unmatched} onChange={set("unmatched")} /></Field>
          <div className="col-span-2 min-w-0">
            <span className="eyebrow mb-1 block">Stores</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Stores">
              {STORES.map((s) => {
                const on = p.stores?.includes(s.code);
                return (
                  <button key={s.code} type="button" aria-pressed={on} title={`${s.name}, ${s.city}`}
                    onClick={() => setP((x) => ({ ...x, stores: on ? x.stores!.filter((c) => c !== s.code) : [...(x.stores ?? []), s.code] }))}
                    className={`calm num min-h-11 min-w-11 rounded-[4.5px] border text-[12px] lg:min-h-8 lg:min-w-8 ${on ? "border-accent bg-accent-tint text-accent" : "border-hairline bg-ground text-secondary hover:border-strong"}`}>
                    {s.number}
                  </button>
                );
              })}
            </div>
          </div>
        </> : preset.kind === "no_store" ? <>
          <Field label="Each deposit, about (Rp)"><input className="field num" type="number" step={100000} min={100000} value={p.amount} onChange={set("amount")} /></Field>
          <Field label="Deposits"><input className="field num" type="number" min={1} max={20} value={p.count} onChange={set("count")} /></Field>
          <Field label="Into the account" wide>
            <select className="field" value={p.account} onChange={set("account")}>{BANK_ACCOUNTS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
          </Field>
        </> : <>
          <Field label="Dealer" wide>
            <select className="field" value={p.store} onChange={set("store")}>{STORES.map((s) => { const d = DEALERS.find((x) => x.store === s.code)!; return <option key={s.code} value={s.code}>{d.name} ({s.name})</option>; })}</select>
          </Field>
          <Field label="Open invoices it pays"><input className="field num" type="number" min={1} max={5} value={p.invoices} onChange={set("invoices")} /></Field>
          <label className="flex min-h-11 cursor-pointer items-end gap-2 pb-2 text-[13px] text-secondary lg:min-h-0"><input type="checkbox" className="size-4 accent-accent" checked={!!p.fee} onChange={(e) => setP((x) => ({ ...x, fee: e.target.checked }))} />Bank kept Rp 2,500</label>
        </>}
        <Field label="Month">
          <select className="field" value={p.month} onChange={set("month")}>{MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        </Field>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        <Button disabled={busy} onClick={go}>{busy ? "Injecting…" : "Inject"}</Button>
        {lender ? <span className="text-[12px] text-faint">Answer as the CFO (switch in the header).</span> : preset.kind === "no_store" ? <span className="text-[12px] text-faint">Answer as the Accountant.</span> : null}
      </div>
      {error ? <div className="mt-3 rounded-[6px] bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div> : null}
    </Card>
  );
}

function RoomPill({ s }: { s: NonNullable<Scenario["story"]> }) {
  const who = s.askOf === "cfo" ? "CFO" : "Accountant";
  if (!s.room || s.room.state === "meeting") return <Pill tone="accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full" />In meeting</Pill>;
  if (s.room.state === "asked") return <Pill tone="hold"><span aria-hidden className="text-hold">𝄐</span>Asked the {who}</Pill>;
  return <Pill tone="success">Closed</Pill>;
}

function Injected({ s }: { s: Scenario }) {
  const count = (st: string) => s.lines.filter((l) => l.state === st).length;
  const settled = count("POSTED"), held = count("HELD"), waiting = count("WAITING");
  const total = s.lines.reduce((a, l) => a + l.amount, 0);
  return (
    <div id={s.sid} className="frame enter scroll-mt-36">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
              <Pill>{KIND_NAME[s.kind] ?? s.kind}</Pill><span>{MONTH_LABELS[s.month - 1]}</span><span className="num">{s.sid}</span>
            </div>
            <h3 className="title mt-2 text-[20px]">{s.title}</h3>
            <p className="mt-1 text-[13px] text-secondary">Expected: {s.expect}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {settled ? <Pill tone="success">{num(settled)} settled</Pill> : null}
            {held ? <Pill tone="hold"><span aria-hidden className="text-hold">𝄐</span>{num(held)} held</Pill> : null}
            {waiting ? <Pill>{num(waiting)} waiting</Pill> : null}
            <Pill>{rpShort(total)}</Pill>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="panel p-4">
            <Eyebrow>Case room</Eyebrow>
            {s.story ? (
              <div className="mt-2 space-y-2 text-[13px]">
                <div className="flex flex-wrap items-center gap-2"><RoomPill s={s.story} /><StateBadge state={s.story.state} /></div>
                {s.question ? <p className="text-body">{s.question.text}</p> : <p className="text-faint">The agents are still talking.</p>}
                {s.question?.answer ? <p className="text-secondary">Answered: <span className="font-medium text-ink">{s.question.answer}</span>{s.question.state === "PROPOSED" ? ", waiting for the confirm back" : ""}</p> : null}
                {s.story.resolution ? <p className="text-secondary">{s.story.resolution}</p> : null}
                <LinkArrow href={`/stories?room=${encodeURIComponent(s.story.key)}`}>Open the case room</LinkArrow>
              </div>
            ) : <p className="mt-2 text-[13px] text-secondary">{held ? "Held lines, no room yet." : "No room: the engine settled every line under an approved rule, so there was nothing to ask anyone."}</p>}
          </div>
          <div className="panel p-4">
            <Eyebrow>Rule</Eyebrow>
            {s.rule ? (
              <div className="mt-2 space-y-2 text-[13px]">
                <div className="flex flex-wrap items-center gap-2"><span className="num text-faint">{s.rule.ruleId}</span><StateBadge state={s.rule.state} />{s.rule.real ? <Pill tone="info">Written by Claude</Pill> : <Pill>Scripted</Pill>}</div>
                <p className="font-medium text-ink">{s.rule.title}</p>
                {s.rule.backtest ? <p className="text-secondary">Backtest: {num(s.rule.backtest.covered)} of {s.rule.backtest.scope} match a sale, {num(s.rule.backtest.errors)} ambiguous. Settled so far: {num(s.rule.settledCount)}.</p> : null}
              </div>
            ) : <p className="mt-2 text-[13px] text-secondary">{s.kind === "dealer" ? `Settled under the rules already approved: ${[...new Set(s.lines.flatMap((l) => l.ruleIds))].join(" + ") || "none"}.` : s.kind === "no_store" ? "None: the Accountant's answer decides these lines, and no rule follows from it." : "None yet. A yes from the CFO creates one."}</p>}
          </div>
        </div>

        <details className="group" open={s.lines.length <= 6}>
          <summary className="calm flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] text-secondary hover:text-ink">
            <span className="inline-block text-faint transition-transform group-open:rotate-90">›</span>{num(s.lines.length)} bank line{s.lines.length === 1 ? "" : "s"} injected
          </summary>
          <div className="scroll-quiet mt-2 max-h-[320px] overflow-y-auto">
            {s.lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-hairline py-2 text-[12px] last:border-0 sm:grid-cols-[64px_minmax(0,1fr)_auto_auto] sm:items-center">
                <span className="num text-faint">{shortDate(l.date)}</span>
                <span className="num order-3 col-span-2 min-w-0 truncate text-body sm:order-none sm:col-span-1" title={`${l.memo} · ${l.account}`}>{l.memo}</span>
                <span className="num text-right">{rp(l.amount)}</span>
                <span className="order-4 col-span-2 flex items-center gap-1.5 sm:order-none sm:col-span-1 sm:justify-end">
                  {l.state ? <StateBadge state={l.state} /> : null}
                  {l.ruleIds.length ? <span className="num text-faint">{l.ruleIds.join(" + ")}</span> : null}
                  {l.store ? <span className="text-faint">{STORE_BY_CODE[l.store]?.name}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </details>
      </Card>
    </div>
  );
}
