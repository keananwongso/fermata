// Records one real run for the public demo, which replays it without Claude or Convex.
//   - The engine's work comes from running the same engine offline on the same generated year (deterministic,
//     identical to the run): every month's numbers and a sample of real lines with how each was decided.
//   - The case rooms, questions and rules come from the real run on Convex, as the agents wrote them.
// Run after a clean close: npx tsx --env-file=.env scripts/export_demo.ts
// With --engine-only it reruns only the offline engine and keeps the recorded run (no Convex needed).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { MONTHLY_TOTALS, STORE_BY_CODE, YEAR, isoDate, monthEnd } from "../convex/lib/domain";
import { consumption, evaluate, parseMemo, type Decision, type EngineTxn } from "../convex/lib/engineCore";
import { generateWorld } from "../convex/lib/generate";
import { SEED_RULES, type RuleProgram } from "../convex/lib/rules";
import type { BankTxn } from "../convex/lib/world";
import { memoryPort } from "./memoryPort";

const strip = (b: BankTxn): EngineTxn => { const { truth: _t, ...rest } = b; void _t; return rest; };
const storeName = (s: string | null | undefined) => (s ? STORE_BY_CODE[s]?.name ?? s : null);

type Line = {
  date: string; account: string; memo: string; amount: number; channel: string;
  outcome: "settled" | "waiting" | "held"; rule: string | null; store: string | null; confidence: number;
  votes: { store: string; score: number; reasons: string[] }[]; fanout: number; matched: string | null; note: string; story: string | null;
};

// learn: false runs the same year without the rules learned from people's answers, as a baseline.
async function engineYear(learn = true) {
  const w = generateWorld();
  const applied = new Map<string, number>();
  let asOf = "";
  const port = memoryPort(w, () => asOf, applied);
  let rules: RuleProgram[] = [...SEED_RULES];
  const state = new Map<string, { status: "settled" | "waiting" | "held"; d: Decision; month: number }>();
  const apply = (t: BankTxn, d: Decision, month: number) => {
    if (d.kind === "settle") for (const c of consumption(d)) applied.set(c.key, (applied.get(c.key) ?? 0) + c.amount);
    state.set(t.key, { status: d.kind === "settle" ? "settled" : d.kind === "wait" ? "waiting" : "held", d, month });
  };
  const year = w.bank.filter((b) => b.year === YEAR);
  // settledLater: waiting lines whose records arrived by this month's end. released: held lines a rule learned this
  // month settled. Together with yearEnd (December's waiting lines, settled in January) they add up to final.settled.
  const months: { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number; released: number }[] = [];
  const lines: Record<number, Line[]> = {};
  const toLine = (t: BankTxn, d: Decision): Line => ({
    date: t.date, account: t.account, memo: t.memo, amount: t.amount, channel: parseMemo(strip(t)).channel,
    outcome: d.kind === "settle" ? "settled" : d.kind === "wait" ? "waiting" : "held",
    rule: d.kind === "settle" ? d.ruleIds.join("+") : null,
    store: storeName(d.placement.store), confidence: d.placement.confidence,
    votes: d.placement.votes.slice(0, 3).map((v) => ({ store: storeName(v.store) ?? v.store, score: v.score, reasons: v.reasons })),
    fanout: d.kind === "settle" ? d.fanout : 0, matched: d.kind === "settle" ? d.counterparts[0]?.table ?? null : null,
    note: d.note, story: d.kind === "hold" ? d.storyKey : null,
  });
  const rerun = async () => {
    let n = 0;
    for (const t of year) {
      const s = state.get(t.key);
      if (s?.status === "held") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); if (d.kind === "settle") { apply(t, d, s.month); n++; } }
    }
    return n;
  };
  for (let m = 1; m <= 12; m++) {
    asOf = monthEnd(YEAR, m);
    let settledLater = 0, released = 0;
    for (const t of year) {
      const s = state.get(t.key);
      if (s?.status === "waiting") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); apply(t, d, s.month); if (d.kind === "settle") settledLater++; }
    }
    let first = 0, waiting = 0, held = 0;
    const sample: Line[] = [];
    const perRule = new Map<string, number>();
    for (const t of year.filter((x) => x.month === m)) {
      const d = await evaluate(strip(t), rules, port, { asOf, firstPass: true });
      apply(t, d, m);
      if (d.kind === "settle") first++; else if (d.kind === "wait") waiting++; else held++;
      // A spread of real lines: a few per rule, every kind of outcome.
      const k = d.kind === "settle" ? d.ruleIds[0] : d.kind;
      const n = perRule.get(k) ?? 0;
      if (n < (d.kind === "settle" ? 4 : 3)) { sample.push(toLine(t, d)); perRule.set(k, n + 1); }
    }
    if (learn && m === 3) { rules = [...rules, { id: "r8", version: 1, title: "Follow the school's receipts", channels: ["school_va"], match: "follow_receipt", params: {}, limitIdr: 50_000_000 }]; released = await rerun(); }
    if (learn && m === 6) { rules = [...rules, { id: "r9", version: 1, title: "FIN_Z payout minus 3.8%", channels: ["lender"], match: "lender_sale", params: { lenders: { FIN_Z: 0.038 }, windowDays: 7 }, limitIdr: 1_000_000_000 }]; released = await rerun(); }
    months.push({ month: m, total: MONTHLY_TOTALS[m - 1], firstSettled: first, waiting, held, settledLater, released });
    lines[m] = sample.sort((a, b) => a.date.localeCompare(b.date));
  }
  asOf = isoDate(YEAR + 1, 1, 20);
  let yearEnd = 0;
  for (const t of year) {
    const s = state.get(t.key);
    if (s?.status === "waiting") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); apply(t, d, s.month); if (d.kind === "settle") yearEnd++; }
  }
  const final = { settled: 0, waiting: 0, held: 0 };
  for (const t of year) final[state.get(t.key)!.status]++;
  // The biggest fan-out of the year: one payout settled against the most records.
  let fan: Line | null = null;
  for (const t of year) { const s = state.get(t.key)!; if (s.d.kind === "settle" && (!fan || s.d.fanout > fan.fanout)) fan = toLine(t, s.d); }
  return { months, yearEnd, lines, final, fan, total: year.length };
}

async function convexRun() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  const c = new ConvexHttpClient(url);
  const stories = await c.query(api.queries.stories, {});
  const rooms = [];
  for (const s of stories) {
    const msgs = await c.query(api.queries.room, { key: s.key });
    const t0 = msgs[0]?.at ?? 0;
    rooms.push({
      key: s.key, month: s.month, title: s.title, count: s.count, amount: s.amount, live: !!s.room?.live, narrated: s.narrated ?? null,
      askOf: s.askOf ?? null, resolution: s.resolution ?? null,
      question: s.question ? { askOf: s.question.askOf, text: s.question.text, options: s.question.options, answer: s.question.answer ?? null, real: s.question.real } : null,
      messages: msgs.map((m) => ({
        at: m.at - t0, speaker: m.speaker, to: m.to, kind: m.kind, source: m.source, staged: !!m.staged,
        think: m.think, tools: m.tools.map((t) => ({ name: t.name, input: t.input, rows: t.rows.slice(0, 8) })), text: m.text, code: m.code ?? null, question: m.question ?? null,
      })),
    });
  }
  const rules = (await c.query(api.queries.rules, {})).map((r) => ({
    id: r.ruleId, title: r.title, origin: r.origin, learnedInMonth: r.learnedInMonth ?? 0, real: r.real, state: r.state,
    program: JSON.parse(r.program) as RuleProgram, backtest: r.backtest ?? null, audit: r.audit ? { result: r.audit.result, note: r.audit.note } : null,
  }));
  const ov = await c.query(api.queries.overview, {});
  // The latest evaluation run (held out week, wrong stores, fuzzer), for the pitch's proof slide. Run it from the
  // Evaluation screen before exporting, or the slide shows placeholders.
  const evaluation = (await c.query(api.queries.evaluation, {}))[0]?.result ?? null;
  return { rooms, rules, headOffice: ov.headOffice, headOfficeBank: ov.headOfficeBank, evaluation };
}

// What the year looks like without learning: per month first pass and the year's final state.
const baselineOf = (b: Awaited<ReturnType<typeof engineYear>>) => ({ months: b.months.map((m) => ({ month: m.month, firstSettled: m.firstSettled, held: m.held })), final: b.final });

async function main() {
  if (process.argv.includes("--engine-only")) {
    const engine = { ...(await engineYear()), baseline: baselineOf(await engineYear(false)) };
    const prev = JSON.parse(readFileSync("src/demo/recording.json", "utf8"));
    writeFileSync("src/demo/recording.json", JSON.stringify({ ...prev, ...engine }));
    console.log(`updated the engine numbers in src/demo/recording.json, final ${JSON.stringify(engine.final)}`);
    return;
  }
  const [learned, run] = await Promise.all([engineYear(), convexRun()]);
  const engine = { ...learned, baseline: baselineOf(await engineYear(false)) };
  const out = { recordedAt: new Date().toISOString().slice(0, 10), year: YEAR, ...engine, ...run };
  mkdirSync("src/demo", { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync("src/demo/recording.json", json);
  console.log(`wrote src/demo/recording.json: ${(json.length / 1024).toFixed(0)} KB, ${run.rooms.length} rooms, ${run.rules.length} rules, final ${JSON.stringify(engine.final)}${run.evaluation ? "" : ", no evaluation run (the pitch's proof slide will show placeholders)"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
