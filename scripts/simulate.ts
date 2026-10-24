// Offline check: run the engine on the generated world month by month and compare with the brief.
// Run: npm run simulate
import { MONTH_LABELS, MONTHLY_TOTALS, YEAR, monthEnd, isoDate, type StoreCode } from "../convex/lib/domain";
import { evaluate, consumption, type DataPort, type Decision, type EngineTxn } from "../convex/lib/engineCore";
import { generateWorld, plannedFirstPassSettled, plannedWaiting } from "../convex/lib/generate";
import { SEED_RULES, type RuleProgram } from "../convex/lib/rules";
import type { BankTxn, World } from "../convex/lib/world";

export function memoryPort(w: World, getAsOf: () => string, applied: Map<string, number>): DataPort {
  const vis = <T extends { recordedOn: string }>(x: T | undefined | null) => (x && x.recordedOn <= getAsOf() ? x : null);
  const card = new Map<string, (typeof w.erp)[number]>();
  const sales = new Map<string, (typeof w.erp)[number][]>();
  for (const e of w.erp) {
    if (e.kind === "card_sales") card.set(`${e.store}|${e.terminal}|${e.date}`, e);
    else { const k = e.store; if (!sales.has(k)) sales.set(k, []); sales.get(k)!.push(e); }
  }
  const cash = new Map(w.cash.map((c) => [`${c.store}|${c.date}`, c] as const));
  const orders = new Map<string, typeof w.orders>();
  for (const o of w.orders) { const k = `${o.platform}|${o.store}|${o.week}`; if (!orders.has(k)) orders.set(k, []); orders.get(k)!.push(o); }
  const gw = new Map(w.gateway.map((g) => [g.batchRef, g] as const));
  const invByNo = new Map(w.dealerInvoices.map((d) => [d.invoiceNo, d] as const));
  const invByDealer = new Map<string, typeof w.dealerInvoices>();
  for (const d of w.dealerInvoices) { if (!invByDealer.has(d.dealer)) invByDealer.set(d.dealer, []); invByDealer.get(d.dealer)!.push(d); }
  const recByStudent = new Map<string, typeof w.receipts>();
  const recCash = new Map<string, typeof w.receipts>();
  for (const r of w.receipts) {
    if (r.method === "va") { if (!recByStudent.has(r.studentRef)) recByStudent.set(r.studentRef, []); recByStudent.get(r.studentRef)!.push(r); }
    else { const k = `${r.store}|${r.week}`; if (!recCash.has(k)) recCash.set(k, []); recCash.get(k)!.push(r); }
  }
  const bankByDay = new Map<string, BankTxn[]>();
  for (const b of w.bank) { const k = `${b.account}|${b.date}`; if (!bankByDay.has(k)) bankByDay.set(k, []); bankByDay.get(k)!.push(b); }
  return {
    async cardSales(s, t, d) { const r = card.get(`${s}|${t}|${d}`); return r && r.kind === "card_sales" ? vis(r) : null; },
    async cashDays(s, ds) { return ds.map((d) => vis(cash.get(`${s}|${d}`))).filter((x): x is NonNullable<typeof x> => !!x); },
    async marketOrders(p, s, wk) { return (orders.get(`${p}|${s}|${wk}`) ?? []).filter((o) => o.date <= getAsOf()); },
    async gatewayByBatch(b) { return vis(gw.get(b)); },
    async dealerInvoicesByNo(nos) { return nos.map((n) => vis(invByNo.get(n))).filter((x): x is NonNullable<typeof x> => !!x); },
    async dealerInvoicesInWindow(d, from, to) { return (invByDealer.get(d) ?? []).filter((i) => i.date >= from && i.date <= to && i.recordedOn <= getAsOf()); },
    async installmentSales(s, from, to) { return (sales.get(s) ?? []).filter((x) => x.date >= from && x.date <= to && x.recordedOn <= getAsOf()) as never; },
    async receiptsByStudent(stu, from, to) { return (recByStudent.get(stu) ?? []).filter((r) => r.date >= from && r.date <= to && r.recordedOn <= getAsOf()); },
    async schoolCashReceipts(s, wk) { return (recCash.get(`${s}|${wk}`) ?? []).filter((r) => r.recordedOn <= getAsOf()); },
    async pairLine(acc, d, memo) {
      const ref = memo.split(" ").pop();
      const o = (bankByDay.get(`${acc}|${d}`) ?? []).find((b) => b.memo !== memo && b.memo.endsWith(" " + ref));
      if (!o) return null; const { truth: _t, ...rest } = o; void _t; return rest;
    },
    async applied(k) { return applied.get(k) ?? 0; },
  };
}

const strip = (b: BankTxn): EngineTxn => { const { truth: _t, ...rest } = b; void _t; return rest; };

async function main() {
  const t0 = Date.now();
  const w = generateWorld();
  console.log(`generated in ${Date.now() - t0} ms: ${w.bank.filter((b) => b.year === YEAR).length} bank lines this year, ${w.bank.filter((b) => b.year !== YEAR).length} last year`);
  const applied = new Map<string, number>();
  let asOf = "";
  let passMonth = 1;
  const port = memoryPort(w, () => asOf, applied);
  let rules: RuleProgram[] = [...SEED_RULES];
  const state = new Map<string, { status: "settled" | "waiting" | "held"; d: Decision; month: number }>();
  const stories = new Map<string, { month: number; n: number }>();
  const apply = (t: BankTxn, d: Decision, month: number) => {
    if (d.kind === "settle") for (const c of consumption(d)) applied.set(c.key, (applied.get(c.key) ?? 0) + c.amount);
    state.set(t.key, { status: d.kind === "settle" ? "settled" : d.kind === "wait" ? "waiting" : "held", d, month });
    if (d.kind === "hold") { const s = stories.get(d.storyKey) ?? { month: passMonth, n: 0 }; s.n++; stories.set(d.storyKey, s);
      if (!t.truth.story && process.env.DEBUG) console.log("UNPLANNED HOLD", passMonth, t.key, t.date, t.memo, t.amount, d.gap, d.note, JSON.stringify(d.facts)); }
  };
  const year = w.bank.filter((b) => b.year === YEAR);
  const rows: string[] = [];
  let ok = true;
  for (let m = 1; m <= 12; m++) {
    asOf = monthEnd(YEAR, m);
    passMonth = m;
    for (const t of year) {
      const s = state.get(t.key);
      if (s && s.status === "waiting") apply(t, await evaluate(strip(t), rules, port, { asOf, firstPass: false }), s.month);
    }
    let first = 0, waiting = 0, held = 0;
    for (const t of year.filter((x) => x.month === m)) {
      const d = await evaluate(strip(t), rules, port, { asOf, firstPass: true });
      apply(t, d, m);
      if (d.kind === "settle") first++; else if (d.kind === "wait") waiting++; else held++;
    }
    if (m === 3) {
      rules = [...rules, { id: "r8", version: 1, title: "Follow the school's receipts", channels: ["school_va"], match: "follow_receipt", params: {}, limitIdr: 50_000_000 }];
      await rerun();
    }
    if (m === 6) {
      rules = [...rules, { id: "r9", version: 1, title: "FIN_Z payout minus 3.8%", channels: ["lender"], match: "lender_sale", params: { lenders: { FIN_Z: 0.038 }, windowDays: 7 }, limitIdr: 1_000_000_000 }];
      await rerun();
    }
    const newStories = [...stories.values()].filter((s) => s.month === m).length;
    const want = plannedFirstPassSettled(m);
    const line = `${MONTH_LABELS[m - 1]}  total ${MONTHLY_TOTALS[m - 1]}  first pass ${first} (${(first / MONTHLY_TOTALS[m - 1] * 100).toFixed(1)}%, want ${want})  waiting ${waiting} (want ${plannedWaiting(m)})  held ${held}  new stories ${newStories}`;
    if (first !== want || year.filter((x) => x.month === m).length !== MONTHLY_TOTALS[m - 1]) ok = false;
    rows.push(line); console.log(line);
  }
  asOf = isoDate(YEAR + 1, 1, 20);
  for (const t of year) { const s = state.get(t.key); if (s && s.status === "waiting") apply(t, await evaluate(strip(t), rules, port, { asOf, firstPass: false }), s.month); }

  async function rerun() {
    for (const t of year) {
      const s = state.get(t.key);
      if (s && s.status === "held") {
        const d = await evaluate(strip(t), rules, port, { asOf, firstPass: false });
        if (d.kind === "settle") { apply(t, d, s.month); }
      }
    }
  }

  const everHeld = new Set<string>();
  for (const [k] of state) void k;
  const heldKeys = year.filter((t) => [...stories.keys()].length && t.truth.story !== null);
  void heldKeys;
  const final = { settled: 0, waiting: 0, held: 0 };
  for (const t of year) final[state.get(t.key)!.status]++;
  console.log("final state", final, "stories", stories.size);
  const byStory = [...stories.entries()].sort((a, b) => a[1].month - b[1].month);
  for (const [k, v] of byStory) console.log(`  ${MONTH_LABELS[v.month - 1]}  ${String(v.n).padStart(5)}  ${k}`);
  // evaluation against truth
  let wrongStore = 0, settledPlaced = 0;
  for (const t of year) {
    const s = state.get(t.key)!;
    if (s.d.kind === "settle" && s.d.placement.store) { settledPlaced++; if (s.d.placement.store !== t.truth.store) wrongStore++; }
  }
  console.log(`settled with a store: ${settledPlaced}, wrong store vs truth: ${wrongStore}`);
  const plantedHeldNotHeld = year.filter((t) => t.truth.story && state.get(t.key)!.status === "settled" && !["A", "B"].includes(t.truth.story!) ).length;
  console.log(`planted anomalies that settled anyway: ${plantedHeldNotHeld}`);
  console.log(ok ? "CURVE OK" : "CURVE MISMATCH");
  void everHeld; void ({} as StoreCode);
}
main();
