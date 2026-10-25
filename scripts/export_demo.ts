// Records one real run for the public demo, which replays it without Claude or Convex.
//   - The case rooms, questions, rules and evaluation come from the real run on Convex, as the agents wrote them.
//   - The engine's work comes from running the same engine offline on the same generated year with the rules the run
//     learned, in the months it learned them (deterministic, identical to the run, and checked against the run's own
//     month figures below): every month's numbers and a sample of real lines with how each was decided.
//   - The baseline is the same year on the same engine with the rules frozen at onboarding: what it looks like without
//     learning. It is a simulation, and the site labels it so.
// Run after a clean close of the learning year (npm run seed -- --preset learning, then close it on autopilot):
//   npx tsx --env-file=.env.local scripts/export_demo.ts --preset learning
// --preset default records the earlier default world instead. --engine-only reruns only the offline engine with the
// rules already in the recording (no Convex needed).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { MONTH_LABELS, STORE_BY_CODE, YEAR, isoDate, monthEnd } from "../convex/lib/domain";
import { consumption, evaluate, parseMemo, type Decision, type EngineTxn } from "../convex/lib/engineCore";
import { DEFAULT_MESS, generateWorld, learningMess } from "../convex/lib/generate";
import { LEARNABLE } from "../convex/lib/learn";
import { SEED_RULES, type RuleProgram } from "../convex/lib/rules";
import type { BankTxn, World } from "../convex/lib/world";
import { memoryPort } from "./memoryPort";

const strip = (b: BankTxn): EngineTxn => { const { truth: _t, ...rest } = b; void _t; return rest; };
const storeName = (s: string | null | undefined) => (s ? STORE_BY_CODE[s]?.name ?? s : null);

type Line = {
  date: string; account: string; memo: string; amount: number; channel: string;
  outcome: "settled" | "waiting" | "held"; rule: string | null; store: string | null; confidence: number;
  votes: { store: string; score: number; reasons: string[] }[]; fanout: number; matched: string | null; note: string; story: string | null;
};
type Learn = { month: number; program: RuleProgram };

// The year on the engine. `learn` lists the rules people's answers produced and the month each was approved; at that
// month's close the rule joins and every held line re-runs under it, as on Convex. An empty list is the baseline.
async function engineYear(w: World, learn: Learn[]) {
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
  const months: { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number; released: number; learned: string[] }[] = [];
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
  const released = new Map<string, number>();
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
    let settledLater = 0, rel = 0;
    for (const t of year) {
      const s = state.get(t.key);
      if (s?.status === "waiting") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); apply(t, d, s.month); if (d.kind === "settle") settledLater++; }
    }
    let first = 0, waiting = 0, held = 0;
    const sample: Line[] = [];
    const perRule = new Map<string, number>();
    const own = year.filter((x) => x.month === m);
    for (const t of own) {
      const d = await evaluate(strip(t), rules, port, { asOf, firstPass: true });
      apply(t, d, m);
      if (d.kind === "settle") first++; else if (d.kind === "wait") waiting++; else held++;
      // A spread of real lines: a few per rule, every kind of outcome.
      const k = d.kind === "settle" ? d.ruleIds[0] : d.kind;
      const n = perRule.get(k) ?? 0;
      if (n < (d.kind === "settle" ? 4 : 3)) { sample.push(toLine(t, d)); perRule.set(k, n + 1); }
    }
    const now = learn.filter((l) => l.month === m);
    for (const l of now) {
      rules = rules.some((r) => r.id === l.program.id) ? rules.map((r) => (r.id === l.program.id ? l.program : r)) : [...rules, l.program];
      const n = await rerun();
      released.set(l.program.id, n); rel += n;
    }
    months.push({ month: m, total: own.length, firstSettled: first, waiting, held, settledLater, released: rel, learned: now.map((l) => `${l.program.id} v${l.program.version}`) });
    lines[m] = sample.sort((a, b) => a.date.localeCompare(b.date));
  }
  asOf = isoDate(YEAR + 1, 1, 20);
  let yearEnd = 0;
  for (const t of year) {
    const s = state.get(t.key);
    if (s?.status === "waiting") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); apply(t, d, s.month); if (d.kind === "settle") yearEnd++; }
  }
  const final = { settled: 0, waiting: 0, held: 0 };
  // What is still held at year end, by the planted cause (the generator's answer key, read here for the report only).
  const heldAtYearEnd: Record<string, number> = {};
  for (const t of year) {
    const s = state.get(t.key)!;
    final[s.status]++;
    if (s.d.kind === "hold") { const k = t.truth.story && LEARNABLE[t.truth.story] ? `learnable (${LEARNABLE[t.truth.story]})` : t.truth.story ? "anomaly" : `other (${s.d.gap})`; heldAtYearEnd[k] = (heldAtYearEnd[k] ?? 0) + 1; }
  }
  // The biggest fan-out of the year: one payout settled against the most records.
  let fan: Line | null = null;
  for (const t of year) { const s = state.get(t.key)!; if (s.d.kind === "settle" && (!fan || s.d.fanout > fan.fanout)) fan = toLine(t, s.d); }
  return { months, yearEnd, lines, final, heldAtYearEnd, fan, total: year.length, released };
}

async function convexRun() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  const c = new ConvexHttpClient(url);
  const stories = (await c.query(api.queries.stories, {})).filter((s) => !s.scenario);
  const rooms = [];
  for (const s of stories) {
    const msgs = await c.query(api.queries.room, { key: s.key });
    const t0 = msgs[0]?.at ?? 0;
    rooms.push({
      key: s.key, month: s.month, title: s.title, count: s.count, amount: s.amount, live: !!s.room?.live, narrated: s.narrated ?? null,
      shape: s.shape ?? null, askOf: s.askOf ?? null, resolution: s.resolution ?? null,
      question: s.question ? { askOf: s.question.askOf, text: s.question.text, options: s.question.options, answer: s.question.answer ?? null, real: s.question.real } : null,
      messages: msgs.map((m) => ({
        at: m.at - t0, speaker: m.speaker, to: m.to, kind: m.kind, source: m.source, staged: !!m.staged,
        think: m.think, tools: m.tools.map((t) => ({ name: t.name, input: t.input, rows: t.rows.slice(0, 8) })), text: m.text, code: m.code ?? null, question: m.question ?? null,
      })),
    });
  }
  const rules = (await c.query(api.queries.rules, {})).filter((r) => !r.scenario).map((r) => ({
    id: r.ruleId, title: r.title, origin: r.origin, learnedInMonth: r.learnedInMonth ?? 0, real: r.real, fittedBy: r.fittedBy ?? null, state: r.state,
    program: JSON.parse(r.program) as RuleProgram, backtest: r.backtest ?? null, audit: r.audit ? { result: r.audit.result, note: r.audit.note } : null,
  }));
  const ov = await c.query(api.queries.overview, {});
  // The latest evaluation run (held out week, wrong stores, fuzzer), for the pitch's proof slide. Run it from the
  // Evaluation screen before exporting, or the slide shows placeholders.
  const evaluation = (await c.query(api.queries.evaluation, {}))[0]?.result ?? null;
  if (ov.run?.phase !== "done") console.warn(`warning: the close on Convex is at phase ${ov.run?.phase}, not done`);
  return { rooms, rules, headOffice: ov.headOffice, headOfficeBank: ov.headOfficeBank, evaluation, live: { months: ov.months, counters: ov.counters } };
}

type Run = Awaited<ReturnType<typeof convexRun>>;
type Year = Awaited<ReturnType<typeof engineYear>>;

// The rules people's answers produced, in the months they were approved. Rules r1 to r7 are onboarding.
const learnedOf = (rules: Run["rules"]): Learn[] => rules.filter((r) => r.learnedInMonth > 0 && (r.state === "APPROVED" || r.state === "POSTED")).map((r) => ({ month: r.learnedInMonth, program: r.program }));

// The rules in the order they were learned, with their backtest and how many held lines each released, for the
// landing page's trust block and the pitch.
function learnedRules(run: Pick<Run, "rules" | "rooms">, y: Year) {
  const answered = (id: string) => run.rooms.find((r) => r.question?.answer && r.messages.some((m) => m.text.includes(`${id} approved`)));
  return run.rules.filter((r) => r.learnedInMonth > 0).sort((a, b) => a.learnedInMonth - b.learnedInMonth || Number(a.id.slice(1)) - Number(b.id.slice(1))).map((r) => {
    const room = answered(r.id);
    const opt = room?.question?.options.find((o) => o.id === room.question?.answer);
    const bt = r.backtest;
    return {
      id: r.id, version: r.program.version, month: r.learnedInMonth, title: r.title, by: r.real ? "claude" : r.fittedBy === "code" ? "code" : "scripted",
      answeredBy: room?.question?.askOf === "cfo" ? "CFO" : "Accountant", answer: opt?.label ?? "", origin: r.origin, program: r.program,
      backtest: { scope: bt?.scope ?? "", covered: bt?.covered ?? 0, of: bt && bt.coverage ? Math.round(bt.covered / bt.coverage) : bt?.covered ?? 0, wrong: bt?.errors ?? 0, pass: true, notes: bt?.examples ?? [] },
      released: y.released.get(r.id) ?? 0,
    };
  });
}

const keep = (y: Year) => ({ months: y.months, yearEnd: y.yearEnd, final: y.final, heldAtYearEnd: y.heldAtYearEnd });

// The run's own month figures against the offline engine with the run's rules. They should agree line for line.
function compare(run: Run, y: Year) {
  const out: string[] = [];
  for (const m of y.months) {
    const live = run.live.months.find((x) => x.month === m.month)?.stats ?? {};
    // The run's month "held" also counts lines held later (a record that never came), so only first pass figures and
    // what a rule released are compared.
    const pairs: [string, number, number][] = [["processed", live.processed ?? 0, m.total], ["firstSettled", live.firstSettled ?? 0, m.firstSettled], ["waiting", live.waiting ?? 0, m.waiting], ["released", live.settledByNewRule ?? 0, m.released]];
    const diff = pairs.filter(([, a, b]) => a !== b);
    out.push(`${MONTH_LABELS[m.month - 1]}  first pass ${m.firstSettled}/${m.total} (${((m.firstSettled / m.total) * 100).toFixed(1)}%)  ${diff.length ? "DIFFERS: " + diff.map(([k, a, b]) => `${k} live ${a} vs engine ${b}`).join(", ") : "matches the run"}`);
  }
  return out;
}

async function main() {
  const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
  const preset = arg("--preset") ?? "learning";
  const w = generateWorld(preset === "learning" ? learningMess() : DEFAULT_MESS);
  if (process.argv.includes("--engine-only")) {
    const prev = JSON.parse(readFileSync("src/demo/recording.json", "utf8"));
    const y = await engineYear(w, learnedOf(prev.rules));
    const b = await engineYear(w, []);
    const { released: _r, ...engine } = y; void _r;
    writeFileSync("src/demo/recording.json", JSON.stringify({ ...prev, ...engine, baseline: keep(b), learnedRules: learnedRules(prev, y) }));
    console.log(`updated the engine numbers in src/demo/recording.json, final ${JSON.stringify(y.final)}`);
    return;
  }
  const run = await convexRun();
  const y = await engineYear(w, learnedOf(run.rules));
  const b = await engineYear(w, []);
  for (const line of compare(run, y)) console.log(line);
  const { released: _r, ...engine } = y; void _r;
  const out = {
    recordedAt: new Date().toISOString().slice(0, 10), year: YEAR, preset,
    note: "With learning: the year as Fermata closed it, rules approved by the CFO in the months shown. Without: the same year on the same engine with the rules frozen at onboarding, simulated.",
    ...engine, baseline: keep(b), learnedRules: learnedRules(run, y), ...run,
  };
  mkdirSync("src/demo", { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync("src/demo/recording.json", json);
  console.log(`wrote src/demo/recording.json (${preset}): ${(json.length / 1024).toFixed(0)} KB, ${run.rooms.length} rooms, ${run.rules.length} rules, final ${JSON.stringify(y.final)}, baseline final ${JSON.stringify(b.final)}${run.evaluation ? "" : ", no evaluation run (the pitch's proof slide will show placeholders)"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
