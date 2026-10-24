// Ask the books, the read side: internal queries only. Queries cannot write, so nothing here can change the books.
// ask.ts runs these from its named queries and builds the views from what they return.
import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { YEAR, STORY_A_KEY, STORY_B_KEY, STORE_BY_CODE } from "./lib/domain";
import { parseMemo } from "./lib/engineCore";
import type { LineRow } from "./lib/ask";

const storeName = (s: string | null | undefined) => (s ? STORE_BY_CODE[s]?.name ?? s : null);

// Months, stories, questions, rules and balances: small tables, read whole.
export const overview = internalQuery({
  args: {},
  handler: async (ctx) => {
    const months = (await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "month")).take(12)).sort((a, b) => a.month - b.month);
    const stories = await ctx.db.query("stories").take(200);
    const questions = await ctx.db.query("questions").take(200);
    const rules = await ctx.db.query("rules").take(100);
    const accounts = await ctx.db.query("bank_accounts").take(10);
    const ledger = await ctx.db.query("ledger_accounts").take(200);
    const books: Record<string, number> = {};
    for (const l of ledger) books[l.bankAccount] = (books[l.bankAccount] ?? 0) + l.bookBalance;
    return {
      months: months.map((m) => ({ month: m.month, stats: m.stats ?? {} })),
      stories: stories.map((s) => ({
        key: s.key, title: s.title, month: s.month, gap: s.gap, store: s.store, stores: s.stores, channel: s.channel, counterparty: s.counterparty,
        count: s.count, amount: s.amount, state: s.state, askOf: s.askOf ?? null, resolution: s.resolution ?? null,
      })),
      questions: questions.map((q) => ({ storyKey: q.storyKey, askOf: q.askOf, state: q.state, answer: q.answer ?? null })),
      rules: rules.map((r) => ({ ruleId: r.ruleId, title: r.title, state: r.state, learnedInMonth: r.learnedInMonth ?? null, origin: r.origin, real: r.real })),
      accounts: accounts.map((a) => ({ code: a.code, name: a.name, statement: a.statementBalance, books: books[a.code] ?? 0 })),
    };
  },
});

// Every bank line still held, with where it was booked and which account it landed in.
export const held = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "bank_txn").eq("state", "HELD")).take(4000);
    const out = [];
    for (const it of items) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      out.push({ month: it.month, store: it.placement?.store ?? null, channel: it.channel ?? "unknown", amount: it.amount ?? 0, storyKey: it.storyKey ?? null, account: b?.account ?? "" });
    }
    return out;
  },
});

const lineFilters = {
  channel: v.optional(v.string()), store: v.optional(v.string()), account: v.optional(v.string()),
  outcome: v.optional(v.string()), counterparty: v.optional(v.string()), month: v.optional(v.number()),
};
type Filters = { channel?: string; store?: string; account?: string; outcome?: string; counterparty?: string; month?: number };
type PageOut = { rows: LineRow[]; matched: number; amount: number };

const OUTCOME: Record<string, LineRow["outcome"]> = { POSTED: "settled", WAITING: "waiting", HELD: "held" };

// Cheap tests on the bank line first, then the work item for how it was decided.
function memoPasses(b: Doc<"bank_transactions">, f: Filters): boolean {
  if (f.month && b.month !== f.month) return false;
  if (f.account && b.account !== f.account) return false;
  if (f.counterparty && !b.memo.toUpperCase().includes(f.counterparty)) return false;
  if (f.channel && parseMemo({ ...b, account: b.account as never }).channel !== f.channel) return false;
  return true;
}

async function collectLines(ctx: QueryCtx, lines: Doc<"bank_transactions">[], f: Filters, items: Map<string, Doc<"work_items">> | null, limit: number): Promise<PageOut> {
  const out: PageOut = { rows: [], matched: 0, amount: 0 };
  for (const b of lines) {
    if (!memoPasses(b, f)) continue;
    const it = items ? items.get(b.key) ?? null : await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", b.key)).first();
    const outcome = it ? OUTCOME[it.state] ?? "open" : "open";
    if (f.outcome && outcome !== f.outcome) continue;
    if (f.store && it?.placement?.store !== f.store) continue;
    out.matched++;
    out.amount += b.amount;
    if (out.rows.length < limit) {
      out.rows.push({ date: b.date, account: b.account, memo: b.memo, amount: b.amount, outcome, rule: it?.ruleIds?.length ? it.ruleIds.join(" + ") : null, store: storeName(it?.placement?.store), note: it?.note ?? null });
    }
  }
  return out;
}

// One page of a month's (or the whole year's) bank lines.
export const linesPage = internalQuery({
  args: { ...lineFilters, cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, a) => {
    const base = a.month
      ? ctx.db.query("bank_transactions").withIndex("by_year_month_date", (q) => q.eq("year", YEAR).eq("month", a.month!))
      : ctx.db.query("bank_transactions").withIndex("by_year_month_date", (q) => q.eq("year", YEAR));
    const page = await base.paginate({ cursor: a.cursor, numItems: a.month ? 1500 : 3000 });
    const r = await collectLines(ctx, page.page, a, null, a.limit);
    return { ...r, cursor: page.isDone ? null : page.continueCursor };
  },
});

// A story's lines, or every held line: few enough to read at once.
export const linesOf = internalQuery({
  args: { ...lineFilters, story: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, a) => {
    const items = a.story
      ? await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", a.story!)).take(1500)
      : await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "bank_txn").eq("state", "HELD")).take(4000);
    const byRef = new Map(items.map((it) => [it.ref, it]));
    const lines: Doc<"bank_transactions">[] = [];
    for (const it of items) {
      if (a.month && it.month !== a.month) continue;
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (b) lines.push(b);
    }
    lines.sort((x, y) => x.date.localeCompare(y.date) || x.key.localeCompare(y.key));
    return await collectLines(ctx, lines, a, byRef, a.limit);
  },
});

// One story with its question, its case room and its record.
export const story = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, a) => {
    const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.key)).first();
    if (!s) return null;
    const question = await ctx.db.query("questions").withIndex("by_story", (q) => q.eq("storyKey", a.key)).first();
    const messages = await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", a.key)).take(300);
    const audit = await ctx.db.query("audit_log").withIndex("by_item", (q) => q.eq("itemId", s._id)).take(30);
    const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", a.key)).take(1500);
    const counts = { held: 0, settled: 0, other: 0 };
    for (const it of items) { if (it.state === "HELD") counts.held++; else if (it.state === "POSTED") counts.settled++; else counts.other++; }
    return { story: s, question, messages, audit, counts };
  },
});

const RULE_STORY: Record<string, string> = { r8: STORY_A_KEY, r9: STORY_B_KEY };

// One rule with its record, and what was said about it in the room it came from.
export const rule = internalQuery({
  args: { ruleId: v.string() },
  handler: async (ctx, a) => {
    const r = await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", a.ruleId)).order("desc").first();
    if (!r) return null;
    const audit = await ctx.db.query("audit_log").withIndex("by_item", (q) => q.eq("itemId", r._id)).take(30);
    const key = RULE_STORY[a.ruleId];
    const messages = key ? (await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", key)).take(300)).filter((m) => m.status === "done" && (m.code || m.text.includes(a.ruleId))) : [];
    return { rule: r, audit, messages, storyKey: key ?? null };
  },
});

// What a requested change would have touched, so the refusal is recorded against the real item.
export const target = internalQuery({
  args: { target: v.string() },
  handler: async (ctx, a) => {
    const t = a.target.trim();
    const id = t.toLowerCase().match(/\br(\d{1,2})\b/)?.[0];
    if (id) {
      const r = await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", id)).order("desc").first();
      if (r) return { table: "rules" as const, id: r._id as string, label: `rule ${r.ruleId}` };
    }
    const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", t)).first()
      ?? (await ctx.db.query("stories").take(200)).find((x) => t.toUpperCase().includes(x.counterparty.toUpperCase()) && x.counterparty.length > 2);
    if (s) return { table: "stories" as const, id: s._id as string, label: s.title };
    const close = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", "close")).first();
    return close ? { table: "work_items" as const, id: close._id as string, label: "the year's close" } : null;
  },
});
