// Read side for the five screens. All reactive.
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { STORE_BY_CODE, YEAR } from "./lib/domain";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const close = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", "close")).first();
    const months = (await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "month")).take(12)).sort((a, b) => a.month - b.month);
    const held = (await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "bank_txn").eq("state", "HELD")).take(4000)).length;
    const waiting = (await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "bank_txn").eq("state", "WAITING")).take(4000)).length;
    const questions = await ctx.db.query("questions").take(200);
    const stories = await ctx.db.query("stories").take(200);
    const rules = await ctx.db.query("rules").take(100);
    const ledger = await ctx.db.query("ledger_accounts").withIndex("by_bank", (q) => q.eq("bankAccount", "HEAD_OFFICE")).take(20);
    const accounts = await ctx.db.query("bank_accounts").take(10);
    const sum = (k: string) => months.reduce((a, m) => a + (m.stats?.[k] ?? 0), 0);
    const processed = sum("processed");
    const settledAuto = sum("firstSettled") + sum("settledLater") + sum("settledByNewRule");
    const everHeld = stories.reduce((a, s) => a + s.count, 0);
    return {
      run: close?.run ?? null,
      months: months.map((m) => ({ month: m.month, stats: m.stats ?? {} })),
      counters: { processed, settledAuto, held, waiting, questions: questions.length, openQuestions: questions.filter((x) => x.state === "NEEDS_INFO" || x.state === "PROPOSED").length, everHeld, stories: stories.length },
      pipeline: { synced: processed, placed: processed - waiting, matched: settledAuto + held, settledByRule: settledAuto, waiting, held },
      headOffice: ledger.reduce((a, l) => a + l.bookBalance, 0),
      headOfficeBank: accounts.find((a) => a.code === "HEAD_OFFICE")?.statementBalance ?? 0,
      rulesLearned: rules.filter((r) => r.learnedInMonth).map((r) => ({ ruleId: r.ruleId, month: r.learnedInMonth ?? 0, state: r.state })),
      pausedQuestion: close?.run?.pausedFor ? questions.find((x) => x.storyKey === (close.run!.pausedFor === "A" ? "placement_conflict|S03|school_va" : "unknown_lender|FIN_Z")) ?? null : null,
      pausedRule: close?.run?.pausedFor === "A" ? rules.find((r) => r.ruleId === "r8") ?? null : null,
    };
  },
});

export const lanes = query({
  args: {},
  handler: async (ctx) => {
    const ev = await ctx.db.query("trace_events").order("desc").take(3000);
    const out: Record<string, Record<number, { n: number; real: number; denied: number }>> = {};
    for (const e of ev) {
      const a = out[e.agent] ?? (out[e.agent] = {});
      const m = a[e.month] ?? (a[e.month] = { n: 0, real: 0, denied: 0 });
      m.n++; if (e.real) m.real++; if (e.kind === "denied") m.denied++;
    }
    const audit = await ctx.db.query("audit_log").withIndex("by_allowed", (q) => q.eq("allowed", true)).order("desc").take(400);
    for (const r of audit) if (r.actor === "accountant" || r.actor === "cfo") {
      const a = out[r.actor] ?? (out[r.actor] = {});
      const m = a[r.month] ?? (a[r.month] = { n: 0, real: 0, denied: 0 });
      m.n++; m.real++;
    }
    return out;
  },
});

export const trace = query({
  args: { agent: v.string(), month: v.number() },
  handler: async (ctx, a) => {
    if (a.agent === "accountant" || a.agent === "cfo") {
      const rows = await ctx.db.query("audit_log").withIndex("by_allowed", (q) => q.eq("allowed", true)).order("desc").take(600);
      return rows.filter((r) => r.actor === a.agent && r.month === a.month).slice(0, 40).reverse()
        .map((r) => ({ _id: r._id as string, kind: "decision", text: `${r.action} ${r.itemRef}: ${r.reason}`, real: true, staged: false, at: r._creationTime }));
    }
    const rows = await ctx.db.query("trace_events").withIndex("by_agent_month", (q) => q.eq("agent", a.agent as Doc<"trace_events">["agent"]).eq("month", a.month)).take(200);
    return rows.map((r) => ({ _id: r._id as string, kind: r.kind, text: r.text, real: r.real, staged: !!r.staged, at: r.at }));
  },
});

export const showcase = query({
  args: {},
  handler: async (ctx) => {
    // Placement vote: a January cash deposit where a teller in another city made the vote less than unanimous.
    const jan = await ctx.db.query("work_items").withIndex("by_kind_month_state", (q) => q.eq("kind", "bank_txn").eq("month", 1).eq("state", "POSTED")).take(1500);
    const vote = jan.find((w) => w.channel === "cash" && w.placement && w.placement.confidence < 0.99 && w.placement.store === "S07")
      ?? jan.find((w) => w.channel === "cash" && w.placement && w.placement.confidence < 0.99) ?? null;
    let voteTxn: Doc<"bank_transactions"> | null = null;
    if (vote) voteTxn = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", vote.ref)).first();
    // Fan-out: the largest Shopee payout in the first week of January.
    const lines = await ctx.db.query("bank_transactions").withIndex("by_account_date", (q) => q.eq("account", "HEAD_OFFICE").gte("date", `${YEAR}-01-01`).lte("date", `${YEAR}-01-08`)).take(400);
    const payout = lines.filter((l) => l.memo.startsWith("SHOPEE")).sort((x, y) => y.amount - x.amount)[0] ?? null;
    let fan: null | { amount: number; memo: string; date: string; orders: number; gross: number; refunds: number; store: string; settled: boolean; sample: { key: string; amount: number }[] } = null;
    if (payout) {
      const m = payout.memo.match(/SHOP-(\d\d) (\S+)$/);
      const orders = m ? await ctx.db.query("marketplace_orders").withIndex("by_platform_store_week", (q) => q.eq("platform", "SHOPEE").eq("store", `S${m[1]}`).eq("week", m[2])).take(2000) : [];
      const wi = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", payout.key)).first();
      fan = { amount: payout.amount, memo: payout.memo, date: payout.date, orders: orders.length, gross: orders.reduce((s, o) => s + o.amount, 0), refunds: orders.reduce((s, o) => s + o.refund, 0), store: m ? STORE_BY_CODE[`S${m[1]}`].name : "", settled: wi?.state === "POSTED", sample: orders.slice(0, 12).map((o) => ({ key: o.key, amount: o.amount })) };
    }
    return { vote: vote && voteTxn ? { placement: vote.placement!, memo: voteTxn.memo, amount: voteTxn.amount, date: voteTxn.date } : null, fan };
  },
});

export const stories = query({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db.query("stories").take(200);
    const qs = await ctx.db.query("questions").take(200);
    return s.sort((a, b) => a.month - b.month || b.amount - a.amount).map((x) => ({ ...x, question: qs.find((q) => q.storyKey === x.key) ?? null }));
  },
});

export const story = query({
  args: { key: v.string() },
  handler: async (ctx, a) => {
    const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.key)).first();
    if (!s) return null;
    const question = await ctx.db.query("questions").withIndex("by_story", (q) => q.eq("storyKey", a.key)).first();
    const trace = await ctx.db.query("trace_events").withIndex("by_story", (q) => q.eq("storyKey", a.key)).take(100);
    const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", a.key)).take(2000);
    const counts = { held: 0, settled: 0, other: 0 };
    for (const it of items) { if (it.state === "HELD") counts.held++; else if (it.state === "POSTED") counts.settled++; else counts.other++; }
    const sample = [];
    for (const it of items.slice(0, 8)) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (b) sample.push({ ref: it.ref, date: b.date, memo: b.memo, amount: b.amount, account: b.account, state: it.state, facts: it.facts ?? {}, placement: it.placement ?? null, note: it.note ?? "" });
    }
    const lenderRules = (await ctx.db.query("rules").take(100)).filter((r) => r.ruleId === "r7" || r.ruleId === "r9");
    const knownLenders: { lender: string; cut: number; rule: string; state: string }[] = [];
    for (const r of lenderRules) {
      const p = JSON.parse(r.program) as { params: { lenders?: Record<string, number> } };
      for (const [l, c] of Object.entries(p.params.lenders ?? {})) knownLenders.push({ lender: l, cut: c, rule: `${r.ruleId} v${r.version}`, state: r.state });
    }
    const audit = await ctx.db.query("audit_log").withIndex("by_item", (q) => q.eq("itemId", s._id)).take(50);
    return { story: s, question, trace: trace.sort((x, y) => x.at - y.at), counts, sample, knownLenders, audit };
  },
});

export const rules = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("rules").take(100)).sort((a, b) => Number(a.ruleId.slice(1)) - Number(b.ruleId.slice(1))),
});

export const rule = query({
  args: { ruleId: v.string() },
  handler: async (ctx, a) => {
    const r = await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", a.ruleId)).order("desc").first();
    if (!r) return null;
    const trace = await ctx.db.query("trace_events").withIndex("by_rule", (q) => q.eq("ruleId", a.ruleId)).take(50);
    const audit = await ctx.db.query("audit_log").withIndex("by_item", (q) => q.eq("itemId", r._id)).take(50);
    return { rule: r, trace: trace.sort((x, y) => x.at - y.at), audit };
  },
});

export const record = query({
  args: { itemRef: v.optional(v.string()), deniedOnly: v.boolean() },
  handler: async (ctx, a) => {
    if (a.itemRef) {
      const wi = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", a.itemRef!)).first();
      const st = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.itemRef!)).first();
      const ru = await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", a.itemRef!)).first();
      const id = wi?._id ?? st?._id ?? ru?._id;
      if (!id) return [];
      return await ctx.db.query("audit_log").withIndex("by_item", (q) => q.eq("itemId", id)).take(100);
    }
    if (a.deniedOnly) return await ctx.db.query("audit_log").withIndex("by_allowed", (q) => q.eq("allowed", false)).order("desc").take(100);
    return await ctx.db.query("audit_log").order("desc").take(120);
  },
});

export const evaluation = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("eval_runs").order("desc").take(20)),
});
