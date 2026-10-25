// The Learner as code: a rule's parameters fitted from held lines, then backtested before anyone approves it.
// Shared by the offline simulator (scripts/simulateYear.ts) and the live close (convex/codeLearner.ts), so both
// learn the same rule from the same lines. No AI here: these are plain computations over the books.
import { addDays, dayDiff, weekday, type StoreCode } from "./domain";
import { evaluate, parseMemo, type DataPort, type EngineTxn } from "./engineCore";
import type { RuleProgram } from "./rules";

// The planted cause behind a held line ("L:" story tags, A and B), read only as the answer key for a person's reply.
export type Kind = "school_moved" | "card_fee" | "new_lender" | "school_advance" | "cash_reversal";
export const LEARNABLE: Record<string, Kind> = {
  "L:school_moved": "school_moved", A: "school_moved", "L:card_fee": "card_fee", "L:new_lender": "new_lender", B: "new_lender",
  "L:school_advance": "school_advance", "L:cash_reversal": "cash_reversal",
};
export const RULE_FOR: Record<Kind, string> = { school_moved: "r8", card_fee: "r3", new_lender: "r9", school_advance: "r10", cash_reversal: "r11" };

// The answer key over some held lines: the learnable cause behind most of them, or null for a one-off.
export function answerKind(tags: (string | null)[]): { kind: Kind | null; n: number } {
  const tally = new Map<Kind, number>();
  for (const t of tags) { const k = t ? LEARNABLE[t] : undefined; if (k) tally.set(k, (tally.get(k) ?? 0) + 1); }
  const [kind, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return !kind || n * 2 < tags.length ? { kind: null, n: 0 } : { kind, n };
}

export interface Backtest { scope: string; covered: number; of: number; wrong: number; pass: boolean; notes: string[] }
export type Draft = { program: RuleProgram; fit: string; backtest: Backtest; stores?: StoreCode[] } | { why: string; backtest?: Backtest };
export interface FitCtx { port: DataPort; rules: RuleProgram[]; asOf: string }

export const pct = (x: number) => (x * 100).toFixed(1) + "%";
export const fee = (x: number) => (x * 100).toFixed(2).replace(/0$/, "") + "%";

// How many of these held lines a candidate rule set would settle now.
export async function covers(c: FitCtx, lines: EngineTxn[], candidate: RuleProgram[]) {
  let n = 0;
  for (const t of lines) if ((await evaluate(t, candidate, c.port, { asOf: c.asOf, firstPass: false })).kind === "settle") n++;
  return { n };
}

// r10: for each held credit, the student's monthly bills (skipping the zero ones the school pre-creates) that run over
// consecutive months and add up to the credit. The longest run seen and the widest gap between when the bills were
// entered and the cash date become the rule's parameters.
export async function fitSchoolBills(c: FitCtx, lines: EngineTxn[]): Promise<Draft> {
  const month = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  let maxMonths = 0, within = 0, fit = 0, zero = 0;
  const lengths = new Map<number, number>();
  for (const t of lines) {
    const p = parseMemo(t);
    if (!p.student) continue;
    const all = (await c.port.receiptsByStudent(p.student, addDays(t.date, -62), addDays(t.date, 400))).sort((a, b) => a.date.localeCompare(b.date));
    zero += all.filter((b) => b.amount === 0).length;
    const open = [];
    for (const b of all) if (b.amount > 0 && (await c.port.applied(b.key)) === 0) open.push(b);
    let run: typeof open | null = null;
    for (let i = 0; i < open.length && !run; i++) {
      let sum = 0;
      for (let j = i; j < open.length; j++) {
        if (j > i && month(open[j].date) !== month(open[j - 1].date) + 1) break;
        sum += open[j].amount;
        if (j > i && sum === t.amount) { run = open.slice(i, j + 1); break; }
      }
    }
    if (!run) continue;
    fit++; maxMonths = Math.max(maxMonths, run.length); lengths.set(run.length, (lengths.get(run.length) ?? 0) + 1);
    for (const b of run) within = Math.max(within, Math.abs(dayDiff(b.recordedOn, t.date)));
  }
  if (fit < 0.9 * lines.length) return { why: `only ${fit} of ${lines.length} credits add up to consecutive monthly bills` };
  const program: RuleProgram = { id: "r10", version: 1, title: `School fees paid ahead: one credit, up to ${maxMonths} monthly bills`, channels: ["school_va"], match: "school_bills", params: { maxMonths, recordedWithinDays: within }, limitIdr: 50_000_000 };
  const now = await covers(c, lines, [...c.rules, program]);
  return {
    program, fit: `up to ${maxMonths} consecutive months, bills entered within ${within} days of the credit; ${fit} of ${lines.length} credits fit a run (${[...lengths.entries()].sort((a, b) => a[0] - b[0]).map(([n, k]) => `${k} of ${n} months`).join(", ")})`,
    backtest: { scope: `this year's ${lines.length} held school credits`, covered: now.n, of: lines.length, wrong: 0, pass: now.n >= 0.9 * lines.length, notes: [`${zero} zero bills near these students skipped`, `${lines.length - now.n} stay held (no single run of bills fits)`] },
  };
}

// r11: held deposits at the named stores whose covered day has a reversed voucher. The round unit is the largest that
// divides the deposits and leaves less than one unit in petty cash; the window is the longest gap from voucher to bank.
export async function fitReversedVoucher(c: FitCtx, lines: EngineTxn[], stores: StoreCode[]): Promise<Draft> {
  const rows: { t: EngineTxn; expected: number; gap: number }[] = [];
  for (const t of lines) {
    const p = parseMemo(t);
    if (!p.subStore || !stores.includes(p.subStore)) continue;
    const covered = weekday(t.date) === 1 ? [addDays(t.date, -3), addDays(t.date, -2), addDays(t.date, -1)] : [addDays(t.date, -1)];
    const days = await c.port.cashDays(p.subStore, covered);
    const rev = days.find((d) => d.reversed);
    if (rev) rows.push({ t, expected: days.reduce((a, d) => a + d.cashSales, 0), gap: dayDiff(rev.date, t.date) });
  }
  if (rows.length < 5) return { why: `only ${rows.length} held deposits follow a reversed voucher` };
  const unit = [1_000_000, 500_000, 100_000, 50_000, 10_000].find((u) => rows.filter((r) => r.t.amount % u === 0 && r.expected - r.t.amount > 0 && r.expected - r.t.amount < u).length >= 0.9 * rows.length);
  if (!unit) return { why: "the deposits are not round" };
  const withinDays = Math.max(...rows.map((r) => r.gap));
  const program: RuleProgram = { id: "r11", version: 1, title: `Reversed cash voucher, deposit rounded to Rp ${unit.toLocaleString("en-US")}: the rest stays in petty cash`, channels: ["cash"], match: "reversed_voucher", params: { roundTo: unit, withinDays }, limitIdr: 100_000_000 };
  const candidate = [...c.rules, program];
  const inScope = rows.map((r) => r.t);
  const now = await covers(c, inScope, candidate);
  const others = await covers(c, lines.filter((t) => !inScope.includes(t)), candidate);
  const kept = rows.reduce((a, r) => a + r.expected - r.t.amount, 0);
  const used = [...new Set(inScope.map((t) => parseMemo(t).subStore!))].sort();
  return {
    program, fit: `round to Rp ${unit.toLocaleString("en-US")}, voucher within ${withinDays} day${withinDays === 1 ? "" : "s"} of the deposit, from ${rows.length} deposits at ${used.join(", ")}`,
    backtest: { scope: `${inScope.length} held deposits after a reversed voucher`, covered: now.n, of: inScope.length, wrong: others.n, pass: now.n >= 0.9 * inScope.length && others.n === 0, notes: [`other held deposits it would settle: ${others.n}`, `Rp ${kept.toLocaleString("en-US")} to petty cash across them`] },
    stores: used,
  };
}

// r9: the cut, as the most common 1 - payout / sale over installment sales with this lender at the same store in the
// week before (as the case room's lender_sales tool does), then each payout must match exactly one sale.
export async function fitLender(c: FitCtx, lines: EngineTxn[]): Promise<Draft> {
  const lender = parseMemo(lines[0]).lender!;
  const rows: { t: EngineTxn; sales: { key: string; amount: number }[] }[] = [];
  const cuts = new Map<string, number>();
  for (const t of lines) {
    const p = parseMemo(t);
    const sales = p.subStore ? (await c.port.installmentSales(p.subStore, addDays(t.date, -7), addDays(t.date, -1))).filter((s) => s.lender === lender) : [];
    rows.push({ t, sales });
    for (const s of sales) { const k = (1 - t.amount / s.amount).toFixed(4); if (Number(k) > 0 && Number(k) < 0.1) cuts.set(k, (cuts.get(k) ?? 0) + 1); }
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
  const now = await covers(c, lines, [...c.rules, program]);
  return {
    program, fit: `cut ${fee(cut)}, the most common implied cut over ${rows.length} payouts`,
    backtest: {
      scope: `this year's ${lines.length} held ${lender} payouts (no history last year)`, covered: now.n, of: lines.length, wrong: two, pass: one >= 0.95 * lines.length && two === 0 && largest <= program.limitIdr,
      notes: [`${one} match exactly one sale, ${two} match two or more, ${none} match none`, `largest payout under the limit: ${largest <= program.limitIdr ? "yes" : "no"}`],
    },
  };
}
