// The Learner derives last year's rules r1 to r7 from rows: one full sample month of every channel,
// plus the full year of lender payouts. These are real computations; the wording around them is scripted.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { LAST_YEAR, SAMPLE_MONTH_LAST_YEAR, addDays, weekday, type StoreCode } from "./lib/domain";
import { parseMemo } from "./lib/engineCore";
import { SEED_RULES, type RuleProgram } from "./lib/rules";
import { transition, type ItemTable } from "./lib/transition";

const agg = v.object({
  card: v.object({ n: v.number(), sdd: v.number(), scc: v.number(), sdc: v.number(), sdy: v.number(), scy: v.number() }),
  cashExact: v.number(), cashTotal: v.number(),
  market: v.record(v.string(), v.object({ n: v.number(), sum: v.number() })),
  web: v.object({ n: v.number(), sum: v.number() }),
  dealerExact: v.number(), dealerFee: v.number(), dealerTotal: v.number(),
  lender: v.record(v.string(), v.object({ n: v.number(), sum: v.number() })),
  pairs: v.number(),
});
type Agg = typeof agg.type;

export const derivePage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), month: v.number() },
  returns: v.object({ a: agg, cursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, x) => {
    const a: Agg = { card: { n: 0, sdd: 0, scc: 0, sdc: 0, sdy: 0, scy: 0 }, cashExact: 0, cashTotal: 0, market: {}, web: { n: 0, sum: 0 }, dealerExact: 0, dealerFee: 0, dealerTotal: 0, lender: {}, pairs: 0 };
    const page = await ctx.db.query("bank_transactions").withIndex("by_year_month_date", (q) => q.eq("year", LAST_YEAR).eq("month", x.month)).paginate({ cursor: x.cursor, numItems: 250 });
    for (const b of page.page) {
      const p = parseMemo({ ...b, account: b.account as never });
      if (p.channel === "lender" && p.lender && p.subStore) {
        const sales = await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", p.subStore as StoreCode).eq("kind", "installment_sale").gte("date", addDays(b.date, -7)).lte("date", addDays(b.date, -1))).take(60);
        const cuts = sales.filter((s) => s.lender === p.lender && s.year === LAST_YEAR).map((s) => 1 - b.amount / (s.amount ?? 1)).filter((c) => c > 0 && c < 0.1);
        if (cuts.length === 1) { const l = a.lender[p.lender] ?? { n: 0, sum: 0 }; l.n++; l.sum += cuts[0]; a.lender[p.lender] = l; }
        continue;
      }
      if (x.month !== SAMPLE_MONTH_LAST_YEAR) continue;
      if (p.channel === "card" && p.subStore && p.saleDate) {
        const rows = await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", p.subStore as StoreCode).eq("kind", "card_sales").eq("date", p.saleDate!)).take(40);
        const r = rows.find((z) => z.terminal === p.terminal && z.year === LAST_YEAR);
        if (!r) continue;
        const d = r.debitGross ?? 0, c = r.creditGross ?? 0, y = d + c - b.amount; // y = a*d + b*c
        a.card.n++; a.card.sdd += d * d; a.card.scc += c * c; a.card.sdc += d * c; a.card.sdy += d * y; a.card.scy += c * y;
      } else if (p.channel === "cash" && p.subStore) {
        const covered = weekday(b.date) === 1 ? [-3, -2, -1] : [-1];
        let sum = 0;
        for (const k of covered) { const r = await ctx.db.query("cash_book").withIndex("by_store_date", (q) => q.eq("store", p.subStore as StoreCode).eq("date", addDays(b.date, k))).first(); sum += r && r.year === LAST_YEAR ? r.cashSales : 0; }
        a.cashTotal++; if (Math.abs(sum - b.amount) <= 5000) a.cashExact++;
      } else if (p.channel === "marketplace" && p.platform && p.subStore && p.week) {
        const orders = await ctx.db.query("marketplace_orders").withIndex("by_platform_store_week", (q) => q.eq("platform", p.platform!).eq("store", p.subStore as StoreCode).eq("week", p.week!)).take(500);
        const ly = orders.filter((o) => o.year === LAST_YEAR);
        const gross = ly.reduce((s, o) => s + o.amount, 0), ref = ly.reduce((s, o) => s + o.refund, 0);
        if (gross) { const m = a.market[p.platform] ?? { n: 0, sum: 0 }; m.n++; m.sum += 1 - (b.amount + ref) / gross; a.market[p.platform] = m; }
      } else if (p.channel === "website" && p.batchRef) {
        const g = await ctx.db.query("gateway_settlements").withIndex("by_batch", (q) => q.eq("batchRef", p.batchRef!)).first();
        if (g) { a.web.n++; a.web.sum += 1 - b.amount / g.gross; }
      } else if (p.channel === "dealer" && p.invoiceNos) {
        let sum = 0;
        for (const no of p.invoiceNos) { const r = await ctx.db.query("dealer_invoices").withIndex("by_invoice", (q) => q.eq("invoiceNo", no)).first(); sum += r?.amount ?? 0; }
        a.dealerTotal++; if (sum === b.amount) a.dealerExact++; else if (sum - b.amount === 2500) a.dealerFee++;
      } else if (p.channel === "transfer_pair" && b.memo.startsWith("TRF REVERSAL")) a.pairs++;
    }
    return { a, cursor: page.isDone ? null : page.continueCursor };
  },
});

export const deriveSeedRules = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const total: Agg = { card: { n: 0, sdd: 0, scc: 0, sdc: 0, sdy: 0, scy: 0 }, cashExact: 0, cashTotal: 0, market: {}, web: { n: 0, sum: 0 }, dealerExact: 0, dealerFee: 0, dealerTotal: 0, lender: {}, pairs: 0 };
    for (let m = 1; m <= 12; m++) {
      let cursor: string | null = null;
      do {
        const r: { a: Agg; cursor: string | null } = await ctx.runQuery(internal.learner.derivePage, { cursor, month: m });
        const a = r.a;
        for (const k of ["n", "sdd", "scc", "sdc", "sdy", "scy"] as const) total.card[k] += a.card[k];
        total.cashExact += a.cashExact; total.cashTotal += a.cashTotal; total.web.n += a.web.n; total.web.sum += a.web.sum;
        total.dealerExact += a.dealerExact; total.dealerFee += a.dealerFee; total.dealerTotal += a.dealerTotal; total.pairs += a.pairs;
        for (const [k, val] of Object.entries(a.market)) { const t = total.market[k] ?? { n: 0, sum: 0 }; t.n += val.n; t.sum += val.sum; total.market[k] = t; }
        for (const [k, val] of Object.entries(a.lender)) { const t = total.lender[k] ?? { n: 0, sum: 0 }; t.n += val.n; t.sum += val.sum; total.lender[k] = t; }
        cursor = r.cursor;
      } while (cursor);
    }
    const c = total.card;
    const det = c.sdd * c.scc - c.sdc * c.sdc;
    const debitFee = (c.sdy * c.scc - c.scy * c.sdc) / det;
    const creditFee = (c.scy * c.sdd - c.sdy * c.sdc) / det;
    const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
    const commission: Record<string, number> = {};
    for (const [k, val] of Object.entries(total.market)) commission[k] = round(val.sum / val.n, 3);
    const lenders: Record<string, number> = {};
    let lenderN = 0;
    for (const [k, val] of Object.entries(total.lender)) { lenders[k] = round(val.sum / val.n, 3); lenderN += val.n; }
    const derived: Record<string, { params: RuleProgram["params"]; seen: number; scope: string }> = {
      r1: { params: { feeIdr: 2500 }, seen: total.dealerFee, scope: "sample month (Oct last year)" },
      r2: { params: {}, seen: total.pairs, scope: "sample month (Oct last year), pairs" },
      r3: { params: { debitFee: round(debitFee), creditFee: round(creditFee), toleranceIdr: 5000 }, seen: c.n + total.cashExact, scope: "sample month (Oct last year)" },
      r4: { params: { commission }, seen: Object.values(total.market).reduce((s, x) => s + x.n, 0), scope: "sample month (Oct last year)" },
      r5: { params: { fee: round(total.web.sum / total.web.n, 3) }, seen: total.web.n, scope: "sample month (Oct last year)" },
      r6: { params: { lookbackDays: 90, maxInvoices: 3 }, seen: total.dealerExact + total.dealerFee, scope: "sample month (Oct last year), dealers" },
      r7: { params: { lenders, windowDays: 7 }, seen: lenderN, scope: "all of last year" },
    };
    await ctx.runMutation(internal.learner.writeSeedRules, { derived: JSON.stringify(derived) });
    return null;
  },
});

export const writeSeedRules = internalMutation({
  args: { derived: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const derived = JSON.parse(a.derived) as Record<string, { params: RuleProgram["params"]; seen: number; scope: string }>;
    for (const base of SEED_RULES) {
      const d = derived[base.id];
      const program: RuleProgram = { ...base, params: { ...base.params, ...d.params } };
      const c = await transition(ctx, {
        table: "rules", id: null, action: "create", actor: "learner", month: 0, reason: "Derived from last year's rows",
        insert: { ruleId: base.id, version: 1, title: base.title, program: JSON.stringify(program), origin: `Learned from last year (${d.scope})`, proposer: "learner", settledCount: 0, seen: { count: d.seen, scope: d.scope }, real: false }, patch: {},
      });
      if (!c.ok) continue;
      const id = c.id as Id<ItemTable>;
      await transition(ctx, { table: "rules", id, action: "propose", actor: "learner", month: 0, reason: "Parameters fitted on last year's rows", patch: {} });
      await transition(ctx, { table: "rules", id, action: "annotate", actor: "auditor", month: 0, reason: "Checked at last year's close", patch: { audit: { result: "pass", note: "Approved at last year's close.", counterexamples: 0, real: false } } });
      await transition(ctx, { table: "rules", id, action: "approve", actor: "cfo", month: 0, reason: "Approved at last year's close (seeded)", patch: { approvedBy: "cfo" } });
    }
    return null;
  },
});
