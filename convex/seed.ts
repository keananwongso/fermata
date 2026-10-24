// Master data, month items and the run controller. Bulk rows are loaded with `npx convex import` (npm run seed).
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { BANK_ACCOUNTS, MONTHLY_TOTALS, STORES, YEAR } from "./lib/domain";

export const init = internalMutation({
  args: { ledger: v.array(v.object({ code: v.string(), bankAccount: v.string(), store: v.string(), bookBalance: v.number() })), balances: v.record(v.string(), v.number()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    for (const s of STORES) await ctx.db.insert("stores", { code: s.code, number: s.number, name: s.name, city: s.city, terminals: s.terminals, cardBank: s.cardBank });
    for (const b of BANK_ACCOUNTS) await ctx.db.insert("bank_accounts", { code: b.code, name: b.name, purpose: b.purpose, statementBalance: a.balances[b.code] ?? 0 });
    for (const l of a.ledger) await ctx.db.insert("ledger_accounts", l);
    for (let m = 1; m <= 12; m++)
      await ctx.db.insert("work_items", { kind: "month", ref: `month-${m}`, state: "NEW", year: YEAR, month: m, stats: { total: MONTHLY_TOTALS[m - 1] } });
    await ctx.db.insert("work_items", { kind: "close", ref: "close", state: "NEW", year: YEAR, month: 0, run: { phase: "idle", month: 0, cursor: null, pausedFor: null, autopilot: false, startedAt: 0, finishedAt: null, rerunRule: null } });
    return null;
  },
});

// Clears everything the close produced so it can run again on the same synced data.
const DERIVED = ["work_items", "stories", "questions", "trace_events", "journal_entries", "audit_log", "precedents", "eval_runs"] as const;
export const resetBatch = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx) => {
    let deleted = 0;
    for (const t of DERIVED) {
      const rows = await ctx.db.query(t).take(1500 - deleted);
      for (const r of rows) {
        if (t === "work_items" && "kind" in r && (r.kind === "month" || r.kind === "close")) continue;
        await ctx.db.delete(r._id); deleted++;
      }
      if (deleted >= 1400) return { deleted, done: false };
    }
    return { deleted, done: true };
  },
});

export const resetCounterparts = internalMutation({
  args: { table: v.union(v.literal("erp_invoices"), v.literal("cash_book"), v.literal("marketplace_orders"), v.literal("gateway_settlements"), v.literal("dealer_invoices"), v.literal("school_receipts")), cursor: v.union(v.string(), v.null()) },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, a) => {
    const page = await ctx.db.query(a.table).paginate({ cursor: a.cursor, numItems: 2000 });
    for (const r of page.page) if (r.applied) await ctx.db.patch(r._id, { applied: 0 });
    return page.isDone ? null : page.continueCursor;
  },
});

export const resetRunState = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const items = await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "month")).take(20);
    for (const it of items) await ctx.db.patch(it._id, { stats: { total: MONTHLY_TOTALS[it.month - 1] } });
    const close = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", "close")).first();
    if (close) await ctx.db.patch(close._id, { run: { phase: "idle", month: 0, cursor: null, pausedFor: null, autopilot: false, startedAt: 0, finishedAt: null, rerunRule: null } });
    for (const r of await ctx.db.query("rules").take(100)) {
      if (["r8", "r9"].includes(r.ruleId)) await ctx.db.delete(r._id);
      else await ctx.db.patch(r._id, { settledCount: 0 });
    }
    return null;
  },
});

export const ping = mutation({ args: {}, returns: v.string(), handler: async () => "ok" });
