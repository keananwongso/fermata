// A year of the real engine (convex/lib/engineCore.ts) run offline, month by month, over a generated world, with or
// without learning. The Learner here is deterministic code, not Claude: when a held story comes up at a close, the
// person's answer is read from the generator's answer key (the "L:" story tags), then the rule's parameters are
// fitted from the data in code, backtested, and the rule is applied only if the backtest passes. The live console
// does the same step with Claude in a case room.
import { LAST_YEAR, MONTH_LABELS, YEAR, addDays, isoDate, monthEnd, type StoreCode } from "../convex/lib/domain";
import { cardNet, consumption, evaluate, parseMemo, type DataPort, type Decision, type EngineTxn } from "../convex/lib/engineCore";
import { SEED_RULES, type RuleProgram } from "../convex/lib/rules";
import type { BankTxn, CardSales, World } from "../convex/lib/world";
import { memoryPort } from "./memoryPort";

export const SIM_NOTE = "Learning here is deterministic code, not Claude: answers come from the generator's answer key, rule parameters are fitted from the data and backtested before they apply.";

export interface SimOptions {
  learn: boolean;
  answersPerMonth?: number; // questions people answer at each close (default: all of them)
  learnAt?: Record<string, number>; // a rule's answer comes no earlier than this month (13: never)
}
export interface Backtest { scope: string; covered: number; of: number; wrong: number; pass: boolean; notes: string[] }
export interface Learned { id: string; version: number; month: number; title: string; answeredBy: string; answer: string; fit: string; program: RuleProgram; backtest: Backtest; released: number }
export interface Rejected { id: string; month: number; why: string; backtest: Backtest | null }
export interface Question { month: number; group: string; lines: number; answeredBy: string; answer: string }
export interface SimMonth { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number; released: number; learned: string[] }
export interface SimResult {
  learn: boolean; months: SimMonth[]; yearEnd: number; final: { settled: number; waiting: number; held: number };
  learned: Learned[]; rejected: Rejected[]; questions: Question[]; wrongStore: number; heldAtYearEnd: Record<string, number>; ms: number;
}

const strip = (b: BankTxn): EngineTxn => { const { truth: _t, ...rest } = b; void _t; return rest; };
type Status = { status: "settled" | "waiting" | "held"; d: Decision; month: number };
type Kind = "school_moved" | "card_fee" | "new_lender";
const LEARNABLE: Record<string, Kind> = { "L:school_moved": "school_moved", A: "school_moved", "L:card_fee": "card_fee", "L:new_lender": "new_lender", B: "new_lender" };
const RULE_FOR: Record<Kind, string> = { school_moved: "r8", card_fee: "r3", new_lender: "r9" };
const pct = (x: number) => (x * 100).toFixed(1) + "%";
const fee = (x: number) => (x * 100).toFixed(2).replace(/0$/, "") + "%";

export async function simulateYear(w: World, opts: SimOptions): Promise<SimResult> {
  const t0 = Date.now();
  const applied = new Map<string, number>();
  let asOf = "";
  const port = memoryPort(w, () => asOf, applied);
  let rules: RuleProgram[] = [...SEED_RULES];
  const state = new Map<string, Status>();
  const year = w.bank.filter((b) => b.year === YEAR);
  const lastYear = w.bank.filter((b) => b.year === LAST_YEAR);
  const months: SimMonth[] = [];
  const learned: Learned[] = [], rejected: Rejected[] = [], questions: Question[] = [];
  const closed = new Set<string>(); // story keys a person has answered

  const apply = (t: BankTxn, d: Decision, month: number) => {
    if (d.kind === "settle") for (const c of consumption(d)) applied.set(c.key, (applied.get(c.key) ?? 0) + c.amount);
    state.set(t.key, { status: d.kind === "settle" ? "settled" : d.kind === "wait" ? "waiting" : "held", d, month });
  };
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
    let settledLater = 0;
    for (const t of year) {
      const s = state.get(t.key);
      if (s?.status === "waiting") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); apply(t, d, s.month); if (d.kind === "settle") settledLater++; }
    }
    let first = 0, waiting = 0, held = 0;
    const lines = year.filter((x) => x.month === m);
    for (const t of lines) {
      const d = await evaluate(strip(t), rules, port, { asOf, firstPass: true });
      apply(t, d, m);
      if (d.kind === "settle") first++; else if (d.kind === "wait") waiting++; else held++;
    }
    const before = learned.length;
    let released = 0;
    if (opts.learn) released = await close(m);
    months.push({ month: m, total: lines.length, firstSettled: first, waiting, held, settledLater, released, learned: learned.slice(before).map((r) => `${r.id} v${r.version}`) });
  }
  asOf = isoDate(YEAR + 1, 1, 20);
  let yearEnd = 0;
  for (const t of year) {
    const s = state.get(t.key);
    if (s?.status === "waiting") { const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false }); apply(t, d, s.month); if (d.kind === "settle") yearEnd++; }
  }
  const final = { settled: 0, waiting: 0, held: 0 };
  const heldAtYearEnd: Record<string, number> = {};
  let wrongStore = 0;
  for (const t of year) {
    const s = state.get(t.key)!;
    final[s.status]++;
    if (s.d.kind === "settle" && s.d.placement.store && s.d.placement.store !== t.truth.store) wrongStore++;
    if (s.d.kind === "hold") { const k = t.truth.story && LEARNABLE[t.truth.story] ? `learnable (${LEARNABLE[t.truth.story]})` : t.truth.story ? "anomaly" : `other (${s.d.gap})`; heldAtYearEnd[k] = (heldAtYearEnd[k] ?? 0) + 1; }
  }
  return { learn: opts.learn, months, yearEnd, final, learned, rejected, questions, wrongStore, heldAtYearEnd, ms: Date.now() - t0 };

  // ---------- the close: questions, answers, rules ----------
  async function close(m: number): Promise<number> {
    const groups = new Map<string, { keys: Set<string>; lines: BankTxn[] }>();
    for (const t of year) {
      const s = state.get(t.key);
      if (s?.status !== "held" || s.d.kind !== "hold" || closed.has(s.d.storyKey)) continue;
      const g = s.d.gap === "unknown_lender" ? s.d.storyKey : `${s.d.gap}|${parseMemo(strip(t)).channel}`;
      const x = groups.get(g) ?? { keys: new Set<string>(), lines: [] };
      x.keys.add(s.d.storyKey); x.lines.push(t); groups.set(g, x);
    }
    let budget = opts.answersPerMonth ?? Infinity;
    let released = 0;
    for (const [group, g] of [...groups.entries()].sort((a, b) => b[1].lines.length - a[1].lines.length)) {
      if (budget <= 0) break;
      const lines = g.lines.filter((t) => state.get(t.key)?.status === "held"); // a rule learned at this close may have settled some
      if (!lines.length) continue;
      const ans = answerKey(lines);
      if (ans.kind && (opts.learnAt?.[RULE_FOR[ans.kind]] ?? 0) > m) continue; // the answer comes later
      budget--;
      questions.push({ month: m, group, lines: lines.length, answeredBy: ans.by, answer: ans.text });
      if (!ans.kind) { for (const k of g.keys) closed.add(k); continue; }
      // A rule that does not fit or fails its backtest is not applied; its stories stay open for the next close.
      const id = RULE_FOR[ans.kind];
      const draft = ans.kind === "school_moved" ? await fitFollowReceipt(lines) : ans.kind === "card_fee" ? await fitCardFees(lines, ans.stores) : await fitLender(lines);
      if ("why" in draft) { rejected.push({ id, month: m, why: draft.why, backtest: draft.backtest ?? null }); continue; }
      if (!draft.backtest.pass) { rejected.push({ id, month: m, why: "backtest failed", backtest: draft.backtest }); continue; }
      for (const k of g.keys) if (!draft.stores || draft.stores.includes(k.split("|")[1] as StoreCode)) closed.add(k);
      rules = rules.some((r) => r.id === draft.program.id) ? rules.map((r) => (r.id === draft.program.id ? draft.program : r)) : [...rules, draft.program];
      const n = await rerun();
      released += n;
      learned.push({ id, version: draft.program.version, month: m, title: draft.program.title, answeredBy: ans.by, answer: ans.text, fit: draft.fit, program: draft.program, backtest: draft.backtest, released: n });
    }
    return released;
  }

  // The person's answer, read from the answer key: the planted cause behind most of the group's lines.
  function answerKey(lines: BankTxn[]): { kind: Kind | null; stores: StoreCode[]; by: string; text: string } {
    const tally = new Map<Kind, number>();
    for (const t of lines) { const k = t.truth.story ? LEARNABLE[t.truth.story] : undefined; if (k) tally.set(k, (tally.get(k) ?? 0) + 1); }
    const [kind, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (!kind || n * 2 < lines.length) return { kind: null, stores: [], by: "Accountant", text: "a one-off error: correct these, no rule" };
    const stores = [...new Set(lines.filter((t) => t.truth.story && LEARNABLE[t.truth.story] === kind).map((t) => t.truth.store!))].sort();
    if (kind === "school_moved") return { kind, stores, by: "Accountant", text: "the students moved class; the receipt's store is right" };
    if (kind === "card_fee") return { kind, stores, by: "CFO", text: `the acquirer's fee changed at ${stores.join(", ")}; the bank paid what the contract says` };
    return { kind, stores, by: "CFO", text: "a new lender we signed; its payouts are real installment sales" };
  }

  // ---------- fitters: a rule's parameters from the data, then its backtest ----------
  type Draft = { program: RuleProgram; fit: string; backtest: Backtest; stores?: StoreCode[] } | { why: string; backtest?: Backtest };

  // How many of these held lines a candidate rule set would settle now.
  async function covers(lines: BankTxn[], candidate: RuleProgram[]) {
    let n = 0;
    for (const t of lines) if ((await evaluate(strip(t), candidate, port, { asOf, firstPass: false })).kind === "settle") n++;
    return { n };
  }

  // r8: no parameters to fit. Backtest on last year's school payments against where last year's books put them.
  async function fitFollowReceipt(lines: BankTxn[]): Promise<Draft> {
    const program: RuleProgram = { id: "r8", version: 1, title: "Follow the school's receipts", channels: ["school_va"], match: "follow_receipt", params: {}, limitIdr: 50_000_000 };
    let total = 0, covered = 0, correct = 0;
    for (const t of lastYear) {
      const p = parseMemo(strip(t));
      if (p.channel !== "school_va" || !p.student) continue;
      const r = (await port.receiptsByStudent(p.student, addDays(t.date, -3), addDays(t.date, 3))).find((x) => x.amount === t.amount && x.year === LAST_YEAR);
      if (!r) continue;
      total++;
      if (r.store === p.subStore) continue;
      covered++; if (r.store === t.truth.store) correct++;
    }
    const now = await covers(lines, [...rules, program]);
    const precision = covered ? correct / covered : 0;
    return {
      program, fit: `no parameters; ${now.n} of ${lines.length} held payments have a receipt for the same student and amount at another store`,
      backtest: { scope: `last year's ${total} school payments with a receipt`, covered, of: total, wrong: covered - correct, pass: covered >= 100 && precision >= 0.99, notes: [`precision ${pct(precision)} against last year's books`, `releases ${now.n} of ${lines.length} held now`] },
    };
  }

  // r3, next version: per store, least squares for the debit and credit fee that explain the held batches (refitted on
  // the closest 80% three times, so a few batches held for something else do not pull it), rounded to a hundredth of a
  // percent, kept only if it reproduces at least 90% of the store's batches to the rupiah. Stores with the same fees merge.
  async function fitCardFees(lines: BankTxn[], stores: StoreCode[]): Promise<Draft> {
    const r3 = rules.find((r) => r.id === "r3")!;
    const recs = new Map<string, CardSales>();
    for (const t of lines) {
      const p = parseMemo(strip(t));
      const rec = p.subStore && p.terminal && p.saleDate ? await port.cardSales(p.subStore, p.terminal, p.saleDate) : null;
      if (rec) recs.set(t.key, rec);
    }
    const fits: { store: StoreCode; debitFee: number; creditFee: number; from?: string; n: number; of: number }[] = [];
    const notes: string[] = [];
    for (const store of stores) {
      const xs = lines.filter((t) => recs.get(t.key)?.store === store);
      if (xs.length < 5) { notes.push(`${store}: ${xs.length} batches, too few to fit`); continue; }
      const ls = (ys: BankTxn[]) => {
        let dd = 0, dc = 0, cc = 0, dy = 0, cy = 0;
        for (const t of ys) { const r = recs.get(t.key)!; const y = r.debitGross + r.creditGross - t.amount; dd += r.debitGross ** 2; dc += r.debitGross * r.creditGross; cc += r.creditGross ** 2; dy += r.debitGross * y; cy += r.creditGross * y; }
        const det = dd * cc - dc * dc;
        return [(dy * cc - cy * dc) / det, (cy * dd - dy * dc) / det];
      };
      let keep = xs;
      for (let i = 0; i < 3; i++) {
        const [df, cf] = ls(keep);
        const off = (t: BankTxn) => { const r = recs.get(t.key)!; return Math.abs(r.debitGross * (1 - df) + r.creditGross * (1 - cf) - t.amount); };
        keep = [...xs].sort((a, b) => off(a) - off(b)).slice(0, Math.ceil(xs.length * 0.8));
      }
      const [debitFee, creditFee] = ls(keep).map((x) => Math.round(x * 10000) / 10000);
      const probe: RuleProgram = { ...r3, params: { ...r3.params, cardFees: [{ stores: [store], debitFee, creditFee }] } };
      const exact = xs.filter((t) => cardNet(probe, recs.get(t.key)!) === t.amount);
      // From when: if this store's batches ever settled at the old fee this year, from the first batch at the new one.
      const settledOld = year.some((t) => { const s = state.get(t.key); return s?.status === "settled" && s.d.kind === "settle" && s.d.ruleIds.includes("r3") && t.memo.startsWith("EDC ") && s.d.placement.store === store; });
      const from = settledOld ? exact.map((t) => recs.get(t.key)!.date).sort()[0] : undefined;
      fits.push({ store, debitFee, creditFee, from, n: exact.length, of: xs.length });
      notes.push(`${store}: debit ${fee(debitFee)}, credit ${fee(creditFee)}${from ? ` from ${from}` : ", always"}, reproduces ${exact.length} of ${xs.length} to the rupiah`);
    }
    const good = fits.filter((f) => f.n >= 0.9 * f.of);
    if (!good.length) return { why: "no store's batches fit one fee", backtest: { scope: "held card batches", covered: 0, of: lines.length, wrong: 0, pass: false, notes } };
    const merged: NonNullable<RuleProgram["params"]["cardFees"]> = [];
    for (const f of good) {
      const same = merged.find((x) => x.debitFee === f.debitFee && x.creditFee === f.creditFee && x.from === f.from);
      if (same) same.stores.push(f.store); else merged.push({ stores: [f.store], debitFee: f.debitFee, creditFee: f.creditFee, ...(f.from ? { from: f.from } : {}) });
    }
    const program: RuleProgram = {
      ...r3, version: r3.version + 1,
      title: `${r3.title.replace(/ \(.*\)$/, "")} (fees by store)`,
      params: { ...r3.params, cardFees: [...(r3.params.cardFees ?? []), ...merged] },
    };
    // Backtest: what it releases now, that no batch settled under the current r3 stops matching, and last October.
    let broken = 0, lyOld = 0, lyNew = 0;
    for (const t of year) {
      const s = state.get(t.key);
      if (s?.status !== "settled" || !t.memo.startsWith("EDC ")) continue;
      const p = parseMemo(strip(t));
      const rec = p.subStore && p.terminal && p.saleDate ? await port.cardSales(p.subStore, p.terminal, p.saleDate) : null;
      if (rec && cardNet(program, rec) !== t.amount) broken++;
    }
    for (const t of lastYear) {
      const p = parseMemo(strip(t));
      if (p.channel !== "card" || !good.some((f) => f.store === p.subStore)) continue;
      const rec = await port.cardSales(p.subStore!, p.terminal!, p.saleDate!);
      if (!rec) continue;
      if (cardNet(r3, rec) === t.amount) lyOld++;
      if (cardNet(program, rec) === t.amount) lyNew++;
    }
    const inScope = lines.filter((t) => good.some((f) => f.store === recs.get(t.key)?.store));
    const now = await covers(inScope, rules.map((r) => (r.id === "r3" ? program : r)));
    notes.push(`settled card batches that would stop matching: ${broken}`, `last October at these stores: ${lyOld} matched the old r3, ${lyNew} match this one`);
    return {
      program, fit: merged.map((x) => `${x.stores.join(", ")}: debit ${fee(x.debitFee)}, credit ${fee(x.creditFee)}${x.from ? ` from ${x.from}` : ""}`).join("; "),
      backtest: { scope: `${inScope.length} held card batches at ${good.map((f) => f.store).join(", ")}`, covered: now.n, of: inScope.length, wrong: broken, pass: broken === 0 && now.n >= 0.9 * inScope.length && lyNew >= lyOld, notes },
      stores: good.map((f) => f.store),
    };
  }

  // r9: the cut, as the most common 1 - payout / sale over installment sales with this lender at the same store in the
  // week before (as the case room's lender_sales tool does), then each payout must match exactly one sale.
  async function fitLender(lines: BankTxn[]): Promise<Draft> {
    const lender = parseMemo(strip(lines[0])).lender!;
    const rows: { t: BankTxn; sales: { key: string; amount: number }[] }[] = [];
    const cuts = new Map<string, number>();
    for (const t of lines) {
      const p = parseMemo(strip(t));
      const sales = p.subStore ? (await port.installmentSales(p.subStore, addDays(t.date, -7), addDays(t.date, -1))).filter((s) => s.lender === lender) : [];
      rows.push({ t, sales });
      for (const s of sales) { const c = (1 - t.amount / s.amount).toFixed(4); if (Number(c) > 0 && Number(c) < 0.1) cuts.set(c, (cuts.get(c) ?? 0) + 1); }
    }
    const cut = Number([...cuts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
    if (!cut) return { why: `no ${lender} sales near the payouts` };
    let one = 0, two = 0, none = 0, largest = 0;
    for (const r of rows) {
      largest = Math.max(largest, r.t.amount);
      const hits = r.sales.filter((s) => Math.round(s.amount * (1 - cut)) === r.t.amount).length;
      if (hits === 1) one++; else if (hits > 1) two++; else none++;
    }
    const program: RuleProgram = { id: "r9", version: 1, title: `${lender} payout minus ${(cut * 100).toFixed(2).replace(/0$/, "")}%`, channels: ["lender"], match: "lender_sale", params: { lenders: { [lender]: cut }, windowDays: 7 }, limitIdr: 1_000_000_000 };
    const now = await covers(lines, [...rules, program]);
    return {
      program, fit: `cut ${fee(cut)}, the most common implied cut over ${rows.length} payouts`,
      backtest: {
        scope: `this year's ${lines.length} held ${lender} payouts (no history last year)`, covered: now.n, of: lines.length, wrong: two, pass: one >= 0.95 * lines.length && two === 0 && largest <= program.limitIdr,
        notes: [`${one} match exactly one sale, ${two} match two or more, ${none} match none`, `largest payout under the limit: ${largest <= program.limitIdr ? "yes" : "no"}`],
      },
    };
  }
}

// One month's line in a table: the share settled on first pass.
export const firstShare = (m: SimMonth) => m.firstSettled / m.total;
export const monthLabel = (m: number) => MONTH_LABELS[m - 1];
export type { DataPort };
