// In-memory data port over a generated world, for running the engine offline (simulate, export).
import type { DataPort } from "../convex/lib/engineCore";
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
