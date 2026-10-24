// What-ifs, offline: generate a world, run the real engine over the year with and without learning, print both.
//   npx tsx scripts/simulate.ts                                  the learning year, learned vs baseline
//   npx tsx scripts/simulate.ts --no-learn --drift 0.021@4       baseline only, the fee rises to 2.1% in April
//   npx tsx scripts/simulate.ts --lender 0.038@3 --learn r9@8     the new lender in March, its answer in August
//   npx tsx scripts/simulate.ts --preset default                 the recorded demo's world (checks the brief's curve)
// Knobs (learning preset): --seed N --onboarding 0.7 --late 0.05 --school-moved 400 --regional-fee 0.02
//   --drift FEE@MONTH|off --drift-stores S08,S09 --lender CUT@MONTH|off --lender-volume 300 --no-oneoffs
// Learning: --answers N (questions answered per close), --learn RULE@MONTH (repeatable), --skip RULE, --json
import { MONTH_LABELS, type StoreCode } from "../convex/lib/domain";
import { DEFAULT_MESS, LEARNING_DEFAULTS, generateWorld, learningMess, plannedFirstPassSettled, type LearningKnobs, type MessConfig } from "../convex/lib/generate";
import { SIM_NOTE, simulateYear, type SimOptions, type SimResult } from "./simulateYear";

export function parseArgs(argv: string[]) {
  const val = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const all = (name: string) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
  const num = (name: string) => (val(name) !== undefined ? Number(val(name)) : undefined);
  const at = (s: string) => { const [v, m] = s.split("@"); return { v: Number(v), m: Number(m) }; };
  const k: LearningKnobs = {};
  if (num("--seed") !== undefined) k.seed = num("--seed");
  if (num("--onboarding") !== undefined) k.onboarding = num("--onboarding");
  if (num("--late") !== undefined) k.late = num("--late");
  if (num("--school-moved") !== undefined) k.schoolMoved = num("--school-moved");
  if (num("--regional-fee") !== undefined) k.regionalFee = num("--regional-fee");
  if (argv.includes("--no-oneoffs")) k.oneOffs = false;
  const drift = val("--drift"), stores = val("--drift-stores");
  if (drift === "off") k.drift = null;
  else if (drift || stores) {
    const d = drift ? at(drift) : { v: LEARNING_DEFAULTS.drift.creditFee, m: LEARNING_DEFAULTS.drift.month };
    k.drift = { creditFee: d.v, month: d.m, stores: stores ? (stores.split(",") as StoreCode[]) : LEARNING_DEFAULTS.drift.stores };
  }
  const lender = val("--lender"), volume = num("--lender-volume");
  if (lender === "off") k.lender = null;
  else if (lender || volume !== undefined) {
    const l = lender ? at(lender) : { v: LEARNING_DEFAULTS.lender.cut, m: LEARNING_DEFAULTS.lender.month };
    k.lender = { cut: l.v, month: l.m, perMonth: volume ?? LEARNING_DEFAULTS.lender.perMonth };
  }
  const learnAt: Record<string, number> = {};
  for (const s of all("--learn")) { const [r, m] = s.split("@"); learnAt[r] = Number(m); }
  for (const r of all("--skip")) learnAt[r] = 13;
  const preset = val("--preset") ?? "learning";
  const config: MessConfig = preset === "default" ? DEFAULT_MESS : learningMess(k);
  const sim: Omit<SimOptions, "learn"> = { learnAt, answersPerMonth: num("--answers") };
  const runs = argv.includes("--no-learn") ? [false] : argv.includes("--learn-only") ? [true] : [true, false];
  return { preset, config, sim, runs, json: argv.includes("--json") };
}

export function describe(config: MessConfig): string[] {
  const out: string[] = [];
  out.push(`late records: ${config.late === "brief" ? "planted to hit the brief's first-pass rates" : `${(config.late * 100).toFixed(1)}% of each month`}`);
  for (const f of config.cardFees) out.push(`card fee: ${f.stores.join(", ")} at debit ${(f.debitFee * 100).toFixed(2)}%, credit ${(f.creditFee * 100).toFixed(2)}% ${f.from ? `from ${f.from}` : "since before go-live"} (r3 assumes 1.00% / 1.80%)`);
  if (config.schoolMoved) out.push(`school: ${config.schoolMoved} payments a month into S03's virtual accounts for students who moved to S11`);
  if (config.storyA) out.push("school: story A (S03 virtual accounts, receipts at S11 keyed in March)");
  if (config.newLender) out.push(`new lender FIN_Z from ${MONTH_LABELS[config.newLender.month - 1]}, cut ${(config.newLender.cut * 100).toFixed(2)}%, ${config.newLender.launch ? "story B launch then 90" : config.newLender.perMonth} payouts a month`);
  out.push(`one-off anomalies (small stories, C, D): ${config.oneOffs ? "on" : "off"}`);
  return out;
}

const p1 = (x: number) => (x * 100).toFixed(1).padStart(5) + "%";
const n = (x: number) => x.toLocaleString("en-US");

export function table(runs: SimResult[]): string[] {
  const L = runs.find((r) => r.learn), B = runs.find((r) => !r.learn);
  const out: string[] = [];
  const head = ["Month", "Lines", ...(L ? ["Learned", "Waiting", "Held", "Later", "Released", "Rules"] : []), ...(B ? ["Baseline", "B held"] : [])];
  out.push(head.map((h, i) => (i === 0 ? h.padEnd(5) : i === head.length - 1 && L && !B ? h : h.padStart(i === 6 ? 9 : 8))).join(" "));
  for (let i = 0; i < 12; i++) {
    const r = (L ?? B)!.months[i];
    const cells = [MONTH_LABELS[i].padEnd(5), n(r.total).padStart(8)];
    if (L) { const m = L.months[i]; cells.push(p1(m.firstSettled / m.total).padStart(8), n(m.waiting).padStart(8), n(m.held).padStart(8), n(m.settledLater).padStart(8), n(m.released).padStart(9), (m.learned.join(" ") || "").padStart(8)); }
    if (B) { const m = B.months[i]; cells.push(p1(m.firstSettled / m.total).padStart(8), n(m.held).padStart(8)); }
    out.push(cells.join(" "));
  }
  for (const r of runs) out.push(`${r.learn ? "Learned " : "Baseline"}  year-end pass settles ${n(r.yearEnd)}; final ${n(r.final.settled)} settled, ${n(r.final.waiting)} waiting, ${n(r.final.held)} held (${Object.entries(r.heldAtYearEnd).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${n(v)} ${k}`).join(", ")}); wrong store vs truth ${r.wrongStore}; ${r.ms} ms`);
  return out;
}

export function learnedReport(r: SimResult): string[] {
  const out: string[] = [];
  for (const x of r.learned) {
    out.push(`${MONTH_LABELS[x.month - 1]}  ${x.id} v${x.version}  ${x.title}`);
    out.push(`       answer (${x.answeredBy}, from the answer key): ${x.answer}`);
    out.push(`       fitted from the data: ${x.fit}`);
    out.push(`       backtest on ${x.backtest.scope}: covers ${x.backtest.covered} of ${x.backtest.of}, ${x.backtest.wrong} wrong, ${x.backtest.pass ? "PASS" : "FAIL"}`);
    for (const note of x.backtest.notes) out.push(`         ${note}`);
    out.push(`       released ${n(x.released)} held lines at the close`);
  }
  for (const x of r.rejected) out.push(`${MONTH_LABELS[x.month - 1]}  ${x.id} not applied: ${x.why}${x.backtest ? ` (${x.backtest.notes.join("; ")})` : ""}`);
  const oneOff = r.questions.filter((q) => !r.learned.some((l) => l.month === q.month && l.answer === q.answer)).length;
  out.push(`${r.questions.length} questions answered, ${oneOff} of them one-offs with no rule`);
  return out;
}

async function main() {
  const { preset, config, sim, runs, json } = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const w = generateWorld(config);
  const genMs = Date.now() - t0;
  const results: SimResult[] = [];
  for (const learn of runs) results.push(await simulateYear(w, { ...sim, learn }));
  if (json) { console.log(JSON.stringify({ preset, config, results }, null, 1)); return; }
  console.log(`preset ${preset}, world generated in ${genMs} ms`);
  for (const d of describe(config)) console.log("  " + d);
  console.log(SIM_NOTE + "\n");
  for (const line of table(results)) console.log(line);
  const L = results.find((r) => r.learn);
  if (L) { console.log(""); for (const line of learnedReport(L)) console.log(line); }
  if (preset === "default" && L) {
    const ok = L.months.every((m) => m.firstSettled === plannedFirstPassSettled(m.month));
    console.log(`\nfirst pass vs the brief's planted curve: ${ok ? "matches every month" : "differs"}`);
  }
}

if (process.argv[1]?.endsWith("simulate.ts")) main().catch((e) => { console.error(e); process.exit(1); });
