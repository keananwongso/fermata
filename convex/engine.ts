// Engine batches inside Convex. Each batch evaluates bank lines with the shared engine core and changes
// state only through `transition` / `transitionChain`, so every step lands in audit_log in the same mutation.
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { GAP_LABEL, consumption, evaluate, parseMemo, type DataPort, type Decision, type EngineTxn, type Gap } from "./lib/engineCore";
import type { RuleProgram } from "./lib/rules";
import { transition, transitionChain, type ItemTable, type Step } from "./lib/transition";
import { STORE_BY_CODE, YEAR } from "./lib/domain";

type Row = { _id: Id<"erp_invoices" | "cash_book" | "marketplace_orders" | "gateway_settlements" | "dealer_invoices" | "school_receipts">; key: string; applied: number };

export function convexPort(ctx: MutationCtx, asOf: string, year: number, seen: Map<string, Row>): DataPort {
  const vis = <T extends { recordedOn: string; key: string }>(r: T | null): T | null => (r && r.recordedOn <= asOf ? r : null);
  const remember = <T extends { key: string; applied: number; _id: unknown }>(rows: T[]): T[] => { for (const r of rows) seen.set(r.key, r as unknown as Row); return rows; };
  return {
    async cardSales(store, terminal, date) {
      const rows = await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", store).eq("kind", "card_sales").eq("date", date)).take(40);
      const r = rows.find((x) => x.terminal === terminal && x.year === year) ?? null;
      const ok = vis(r);
      return ok ? (remember([ok])[0] as never) : null;
    },
    async cashDays(store, dates) {
      const out = [];
      for (const d of dates) {
        const r = await ctx.db.query("cash_book").withIndex("by_store_date", (q) => q.eq("store", store).eq("date", d)).first();
        const ok = vis(r && r.year === year ? r : null);
        if (ok) out.push(ok);
      }
      return remember(out) as never;
    },
    async marketOrders(platform, store, week) {
      const rows = await ctx.db.query("marketplace_orders").withIndex("by_platform_store_week", (q) => q.eq("platform", platform).eq("store", store).eq("week", week)).take(2000);
      return remember(rows.filter((o) => o.date <= asOf && o.year === year)) as never;
    },
    async gatewayByBatch(batchRef) {
      const r = await ctx.db.query("gateway_settlements").withIndex("by_batch", (q) => q.eq("batchRef", batchRef)).first();
      const ok = vis(r);
      return ok ? (remember([ok])[0] as never) : null;
    },
    async dealerInvoicesByNo(nos) {
      const out = [];
      for (const n of nos) {
        const r = await ctx.db.query("dealer_invoices").withIndex("by_invoice", (q) => q.eq("invoiceNo", n)).first();
        const ok = vis(r);
        if (ok) out.push(ok);
      }
      return remember(out) as never;
    },
    async dealerInvoicesInWindow(dealer, from, to) {
      const rows = await ctx.db.query("dealer_invoices").withIndex("by_dealer_date", (q) => q.eq("dealer", dealer).gte("date", from).lte("date", to)).take(200);
      return remember(rows.filter((r) => r.recordedOn <= asOf)) as never;
    },
    async installmentSales(store, from, to) {
      const rows = await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", store).eq("kind", "installment_sale").gte("date", from).lte("date", to)).take(200);
      return remember(rows.filter((r) => r.recordedOn <= asOf)) as never;
    },
    async receiptsByStudent(student, from, to) {
      const rows = await ctx.db.query("school_receipts").withIndex("by_student_date", (q) => q.eq("studentRef", student).gte("date", from).lte("date", to)).take(50);
      return remember(rows.filter((r) => r.recordedOn <= asOf && r.year === year)) as never;
    },
    async schoolCashReceipts(store, week) {
      const rows = await ctx.db.query("school_receipts").withIndex("by_store_week", (q) => q.eq("store", store).eq("week", week)).take(200);
      return remember(rows.filter((r) => r.method === "cash" && r.recordedOn <= asOf && r.year === year)) as never;
    },
    async pairLine(account, date, memo) {
      const ref = memo.split(" ").pop();
      const rows = await ctx.db.query("bank_transactions").withIndex("by_account_date", (q) => q.eq("account", account).eq("date", date)).take(400);
      const o = rows.find((b) => b.memo !== memo && b.memo.endsWith(" " + ref));
      return o ? strip(o) : null;
    },
    async applied(key) { return seen.get(key)?.applied ?? 0; },
  };
}

export function strip(b: Doc<"bank_transactions">): EngineTxn {
  return { key: b.key, year: b.year, month: b.month, date: b.date, account: b.account as EngineTxn["account"], direction: b.direction, amount: b.amount, memo: b.memo };
}

export async function approvedRules(ctx: MutationCtx): Promise<{ programs: RuleProgram[]; docs: Map<string, Doc<"rules"> | null> }> {
  const all = await ctx.db.query("rules").take(200);
  const docs = new Map<string, Doc<"rules"> | null>();
  const programs: RuleProgram[] = [];
  for (const r of all) {
    if (r.state === "APPROVED" || r.state === "POSTED") {
      const prev = docs.get(r.ruleId);
      if (!prev || prev.version < r.version) docs.set(r.ruleId, r);
    }
  }
  for (const r of docs.values()) if (r) programs.push(JSON.parse(r.program) as RuleProgram);
  return { programs, docs };
}

export function authorityFor(ids: string[], docs: Map<string, Doc<"rules"> | null>): string {
  return ids.map((id) => `rule ${id} v${docs.get(id)?.version ?? 1}, approved by CFO`).join("; ");
}

export interface BatchStats { firstSettled: number; waiting: number; held: number; settledLater: number; processed: number }

// Apply one engine decision to a bank line's work item. On the first pass the item does not exist yet:
// `create` is the sync step, and it is written together with the decision as one chain.
export async function applyDecision(ctx: MutationCtx, item: Doc<"work_items"> | null, txn: EngineTxn, d: Decision, opts: {
  passMonth: number; firstPass: boolean; docs: Map<string, Doc<"rules"> | null>; seen: Map<string, Row>; stats: BatchStats; settledCounts: Map<string, number>;
  create?: Step;
}): Promise<void> {
  const month = opts.passMonth;
  const target = { table: "work_items" as const, id: (item?._id ?? null) as Id<ItemTable> | null, month };
  const lead: Step[] = opts.create ? [opts.create] : [];
  if (d.kind === "settle") {
    const sample = d.counterparts.slice(0, 5).map((c) => ({ key: c.key, amount: c.amount }));
    const authority = authorityFor(d.ruleIds, opts.docs);
    const r = await transitionChain(ctx, target, [
      ...lead,
      { action: "propose", actor: "engine", reason: d.note,
        patch: { proposer: "engine", placement: d.placement, ruleIds: d.ruleIds, note: d.note, counterpartTable: d.counterparts[0]?.table ?? "", counterpartCount: d.fanout, counterpartSample: sample, gap: undefined } },
      { action: "approve", actor: "engine", reason: "Within an approved rule's limit", authority, patch: {} },
      { action: "post", actor: "gateway", reason: "Posted to the books", authority, patch: { settledMonth: month, settledBy: "rule" } },
    ], opts.docs);
    if (!r.ok) return;
    const store = d.placement.store;
    await ctx.db.insert("journal_entries", {
      workItemId: r.id as Id<"work_items">, date: txn.date, store, amount: txn.amount, authority,
      debit: `${txn.account}${store ? "/" + store : ""}`, credit: d.counterparts[0]?.table === "bank_transactions" ? "Reversed same day" : `Receivable cleared${store ? " · " + STORE_BY_CODE[store].name : ""}`,
    });
    for (const c of consumption(d)) {
      const row = opts.seen.get(c.key);
      if (row) { row.applied += c.amount; await ctx.db.patch(row._id, { applied: row.applied }); }
    }
    for (const rid of d.ruleIds) opts.settledCounts.set(rid, (opts.settledCounts.get(rid) ?? 0) + 1);
    if (opts.firstPass) opts.stats.firstSettled++; else opts.stats.settledLater++;
  } else if (d.kind === "wait") {
    await transitionChain(ctx, target, [...lead, { action: "wait", actor: "engine", reason: d.note, patch: { placement: d.placement, note: d.note } }]);
    if (opts.firstPass) opts.stats.waiting++;
  } else {
    const r = await transitionChain(ctx, target, [...lead, {
      action: "hold", actor: "engine", reason: d.note,
      patch: { placement: d.placement, note: d.note, gap: d.gap, storyKey: d.storyKey, facts: d.facts, everHeld: true },
    }]);
    if (!r.ok) return;
    await upsertStory(ctx, d, txn, month);
    opts.stats.held++;
  }
}

const NARRATED: Record<string, "A" | "B" | "C" | "D"> = {
  "placement_conflict|S03|school_va": "A", "unknown_lender|FIN_Z": "B", "petty_cash_retained|cash": "C", "no_store_record|cash": "D",
};

async function upsertStory(ctx: MutationCtx, d: Extract<Decision, { kind: "hold" }>, txn: EngineTxn, month: number) {
  const existing = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", d.storyKey)).first();
  const store = d.placement.store;
  if (existing) {
    const stores = store && !existing.stores.includes(store) ? [...existing.stores, store] : existing.stores;
    await ctx.db.patch(existing._id, { count: existing.count + 1, amount: existing.amount + txn.amount, stores });
    return;
  }
  const p = parseMemo(txn);
  const title = storyTitle(d.gap, store, d.counterparty, p.channel);
  await transition(ctx, {
    table: "stories", id: null, action: "create", actor: "engine", month, reason: "New root cause found among held lines",
    insert: {
      key: d.storyKey, month, gap: d.gap, title, store: d.storyKey.startsWith("unknown_lender") || d.storyKey.startsWith("petty") || d.storyKey.startsWith("no_store") ? null : store,
      channel: p.channel, counterparty: d.counterparty, count: 1, amount: txn.amount, stores: store ? [store] : [], narrated: NARRATED[d.storyKey] ?? null,
    },
    patch: {},
  });
}

export function storyTitle(gap: Gap, store: string | null, counterparty: string, channel: string): string {
  const where = store ? ` at ${STORE_BY_CODE[store]?.name ?? store}` : "";
  if (gap === "unknown_lender") return `Payouts from ${counterparty}, a lender we do not know`;
  if (gap === "placement_conflict") return `School fees paid into ${where.replace(" at ", "")}'s virtual accounts, receipts elsewhere`;
  if (gap === "petty_cash_retained") return "Cash deposits short by exactly the petty cash kept";
  if (gap === "no_store_record") return "Cash deposits that no store recorded";
  void channel;
  return `${GAP_LABEL[gap]}${where}`;
}

const BATCH_ITEMS = 120;
const BATCH_MS = 700;

// First pass over one month's bank lines: sync creates the work item, the engine decides.
export const firstPassBatch = internalMutation({
  args: { month: v.number(), cursor: v.union(v.string(), v.null()), asOf: v.string() },
  returns: v.object({ done: v.boolean(), cursor: v.union(v.string(), v.null()), voteRef: v.union(v.string(), v.null()), stats: v.object({ firstSettled: v.number(), waiting: v.number(), held: v.number(), settledLater: v.number(), processed: v.number() }) }),
  handler: async (ctx, args) => runFirstPass(ctx, args.month, args.cursor, args.asOf),
});

export async function runFirstPass(ctx: MutationCtx, month: number, cursor: string | null, asOf: string) {
  const started = Date.now();
  const { programs, docs } = await approvedRules(ctx);
  const seen = new Map<string, Row>();
  const port = convexPort(ctx, asOf, YEAR, seen);
  const stats: BatchStats = { firstSettled: 0, waiting: 0, held: 0, settledLater: 0, processed: 0 };
  const settledCounts = new Map<string, number>();
  let voteRef: string | null = null;
  const page = await ctx.db.query("bank_transactions").withIndex("by_year_month_date", (q) => q.eq("year", YEAR).eq("month", month))
    .paginate({ cursor, numItems: BATCH_ITEMS, maximumRowsRead: BATCH_ITEMS });
  for (const b of page.page) {
    const txn = strip(b);
    const create: Step = {
      action: "create", actor: "sync", reason: "Synced from the bank statement",
      insert: { kind: "bank_txn", ref: b.key, year: YEAR, month, amount: b.amount, channel: parseMemo(txn).channel, firstPassMonth: month },
      patch: {},
    };
    const d = await evaluate(txn, programs, port, { asOf, firstPass: true });
    await applyDecision(ctx, null, txn, d, { passMonth: month, firstPass: true, docs, seen, stats, settledCounts, create });
    if (!voteRef && d.kind === "settle" && d.placement.confidence < 0.99 && d.placement.votes.length > 1) voteRef = b.key;
    stats.processed++;
    if (Date.now() - started > BATCH_MS * 4) break;
  }
  await bumpRuleCounts(ctx, settledCounts, docs);
  return { done: page.isDone, cursor: page.isDone ? null : page.continueCursor, stats, voteRef };
}

export async function bumpRuleCounts(ctx: MutationCtx, counts: Map<string, number>, docs: Map<string, Doc<"rules"> | null>) {
  for (const [id, n] of counts) {
    const r = docs.get(id);
    if (!r) continue;
    const fresh = (await ctx.db.get(r._id))!;
    await ctx.db.patch(r._id, { settledCount: fresh.settledCount + n });
  }
}

// Later pass: re-check lines that were waiting for their records, or held lines under a newly approved rule.
export async function runRecheck(ctx: MutationCtx, opts: { fromMonth: number; state: "WAITING" | "HELD"; storyKey: string | null; cursor: string | null; asOf: string; passMonth: number }) {
  const { programs, docs } = await approvedRules(ctx);
  const seen = new Map<string, Row>();
  const port = convexPort(ctx, opts.asOf, YEAR, seen);
  const stats: BatchStats = { firstSettled: 0, waiting: 0, held: 0, settledLater: 0, processed: 0 };
  const settledCounts = new Map<string, number>();
  const q = opts.storyKey
    ? ctx.db.query("work_items").withIndex("by_story", (x) => x.eq("storyKey", opts.storyKey!))
    : ctx.db.query("work_items").withIndex("by_kind_month_state", (x) => x.eq("kind", "bank_txn").eq("month", opts.fromMonth).eq("state", opts.state));
  const page = await q.paginate({ cursor: opts.cursor, numItems: BATCH_ITEMS, maximumRowsRead: BATCH_ITEMS });
  let heldBefore = 0;
  for (const item of page.page) {
    if (item.state !== opts.state) continue;
    const b = await ctx.db.query("bank_transactions").withIndex("by_key", (x) => x.eq("key", item.ref)).first();
    if (!b) continue;
    const txn = strip(b);
    const d = await evaluate(txn, programs, port, { asOf: opts.asOf, firstPass: false });
    stats.processed++;
    if (opts.state === "HELD") {
      if (d.kind !== "settle") { heldBefore++; continue; }
      // a held line moves only when a rule now settles it
      await applyDecision(ctx, item, txn, d, { passMonth: opts.passMonth, firstPass: false, docs, seen, stats, settledCounts });
      continue;
    }
    if (d.kind === "wait") { stats.waiting++; continue; } // still waiting, nothing changes
    await applyDecision(ctx, item, txn, d, { passMonth: opts.passMonth, firstPass: false, docs, seen, stats, settledCounts });
  }
  await bumpRuleCounts(ctx, settledCounts, docs);
  void heldBefore;
  return { done: page.isDone, cursor: page.isDone ? null : page.continueCursor, stats };
}
