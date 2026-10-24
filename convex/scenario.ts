// Scenarios: bank lines injected from the console into the closed year, so a visitor's own case runs the real path.
// Every row it writes carries the scenario id (`scenario`), and so does everything derived from it: work items,
// stories, questions, rules, journal entries and their audit rows. The lines get the first pass under the rules
// approved now; holds group into a story of their own, a case room opens (live by the story's shape, roomAgents.ts),
// a person answers on the usual card (humans.ts), a lender rule is backtested, approved and re-run here.
// Reset deletes every scenario row and what came of it. The audit log is append only, so its rows stay, tagged,
// and views hide the ones whose scenario was reset.
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { firstPassLines, runRecheck } from "./engine";
import { afterword, openRoom, roomMessages } from "./rooms";
import { specOf } from "./roomAgents";
import { getClose } from "./run";
import { BANK_ACCOUNTS, CASH_TOLERANCE, DEALERS, STORES, STORE_BY_CODE, YEAR, addDays, daysInMonth, isoDate, monthEnd, weekday, type StoreCode } from "./lib/domain";
import { parseMemo } from "./lib/engineCore";
import { validateRuleProgram, type RuleProgram } from "./lib/rules";
import { transition, type ItemTable, type Role } from "./lib/transition";
import { num, rpShort } from "./lib/format";
import { CONSOLE_REFUSAL, consoleKey, isConsole, requireConsole } from "./lib/console";

const kind = v.union(v.literal("lender"), v.literal("lender_no"), v.literal("no_store"), v.literal("dealer"));
type Kind = "lender" | "lender_no" | "no_store" | "dealer";
const params = v.object({
  month: v.optional(v.number()),
  lender: v.optional(v.string()), cut: v.optional(v.number()), payouts: v.optional(v.number()), stores: v.optional(v.array(v.string())), unmatched: v.optional(v.number()),
  amount: v.optional(v.number()), account: v.optional(v.string()), count: v.optional(v.number()),
  store: v.optional(v.string()), invoices: v.optional(v.number()), fee: v.optional(v.boolean()),
});

const EXPECT: Record<Kind, string> = {
  lender: "Held on the first pass: no approved rule knows this lender. A live room works out its cut and asks the CFO. Answer yes as the CFO: the Learner's rule is approved, backtested and the payouts settle.",
  lender_no: "The same room and question. Answer no as the CFO: every payout stays held and nothing is booked.",
  no_store: "Held: no store's cash matches. A live room checks every store and asks the Accountant. Answer not ours: they stay held and are never booked as income.",
  dealer: "Settles on the first pass under r6, by the invoice numbers in the memo. No room, no question.",
};

// Same seed, same lines: a scenario is reproducible from its id.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const ddmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7);

type Line = { key: string; date: string; account: string; amount: number; memo: string; store: StoreCode | null; channel: string };

async function nextRuleId(ctx: MutationCtx): Promise<string> {
  const ids = [...(await ctx.db.query("rules").take(200)).map((r) => r.ruleId), ...(await ctx.db.query("scenarios").take(100)).map((s) => s.ruleId ?? "")];
  return `r${Math.max(9, ...ids.map((x) => Number(x.slice(1)) || 0)) + 1}`;
}

// Cash a store recorded for the days a deposit on `date` would cover, as the engine reads it.
async function anyStoreMatches(ctx: MutationCtx, date: string, amount: number): Promise<boolean> {
  const covered = weekday(date) === 1 ? [addDays(date, -3), addDays(date, -2), addDays(date, -1)] : [addDays(date, -1)];
  for (const s of STORES) {
    let sum = 0, days = 0;
    for (const d of covered) {
      const r = await ctx.db.query("cash_book").withIndex("by_store_date", (q) => q.eq("store", s.code).eq("date", d)).first();
      if (r && r.year === YEAR) { sum += r.cashSales; days++; }
    }
    if (days && Math.abs(sum - amount) <= CASH_TOLERANCE) return true;
  }
  return false;
}

export const inject = mutation({
  args: { kind, params, consoleKey },
  returns: v.object({ sid: v.union(v.string(), v.null()), error: v.union(v.string(), v.null()) }),
  handler: async (ctx, a) => {
    if (!isConsole(a.consoleKey)) return { sid: null, error: CONSOLE_REFUSAL };
    const close = await getClose(ctx);
    if (close?.run?.phase !== "done") return { sid: null, error: "Scenarios run on the closed year. Close the year from Run first." };
    const p = a.params;
    const month = Math.round(p.month ?? 12);
    if (month < 1 || month > 12) return { sid: null, error: "Pick a month of the year" };
    const sid = `scn-${Date.now().toString(36)}`;
    const rnd = rng(sid);
    const between = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) / 1000) * 1000;
    const dim = daysInMonth(YEAR, month);
    const lines: Line[] = [];
    const key = (i: number) => `${sid}-${String(i + 1).padStart(2, "0")}`;
    let title = "", ruleId: string | undefined;
    const saved: Record<string, string | number> = { month };

    if (a.kind === "lender" || a.kind === "lender_no") {
      const lender = (p.lender ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(lender)) return { sid: null, error: "Name the lender in letters and digits, like FIN_Q" };
      const cutPct = Math.round((p.cut ?? 0) * 10) / 10;
      if (cutPct < 0.5 || cutPct > 9.5) return { sid: null, error: "The lender's cut must be between 0.5% and 9.5%" };
      const cut = Number((cutPct / 100).toFixed(3));
      const n = Math.round(p.payouts ?? 0);
      if (n < 1 || n > 40) return { sid: null, error: "Between 1 and 40 payouts" };
      const stores = (p.stores ?? []).filter((s): s is StoreCode => !!STORE_BY_CODE[s]);
      if (!stores.length) return { sid: null, error: "Pick at least one store" };
      const unmatched = Math.max(0, Math.min(n - 1, Math.round(p.unmatched ?? 0)));
      ruleId = await nextRuleId(ctx);
      for (let i = 0; i < n; i++) {
        const store = stores[i % stores.length];
        const date = isoDate(YEAR, month, 7 + Math.floor((i * (dim - 8)) / n));
        const sale = between(6_000_000, 45_000_000);
        const amount = Math.round(sale * (1 - cut));
        // The last `unmatched` payouts have no sale behind them: the rule must leave those held.
        if (i < n - unmatched) {
          const saleDate = addDays(date, -(1 + Math.floor(rnd() * 5)));
          await ctx.db.insert("erp_invoices", { key: `${key(i)}-sale`, year: YEAR, kind: "installment_sale", store, date: saleDate, recordedOn: saleDate, lender, amount: sale, applied: 0, scenario: sid });
        }
        lines.push({ key: key(i), date, account: "BANK_B", amount, memo: `${lender} DISB ${store} ${100000 + Math.floor(rnd() * 900000)}`, store, channel: "lender" });
      }
      title = `${num(n)} payouts from ${lender}, a lender the books do not know`;
      Object.assign(saved, { lender, cut: cutPct, payouts: n, stores: stores.join(","), unmatched });
    } else if (a.kind === "no_store") {
      const n = Math.round(p.count ?? 0);
      if (n < 1 || n > 20) return { sid: null, error: "Between 1 and 20 deposits" };
      const base = Math.round(p.amount ?? 0);
      if (base < 100_000 || base > 2_000_000_000) return { sid: null, error: "Each deposit between Rp 100k and Rp 2bn" };
      const account = BANK_ACCOUNTS.find((b) => b.code === p.account)?.code;
      if (!account) return { sid: null, error: "Pick a bank account" };
      for (let i = 0; i < n; i++) {
        let date = isoDate(YEAR, month, 3 + Math.floor((i * (dim - 4)) / n));
        while (weekday(date) === 0 || weekday(date) === 6) date = addDays(date, 1);
        let amount = between(base * 0.85, base * 1.15);
        // Never by chance equal to some store's cash: this scenario is about money no store recorded.
        for (let k = 0; k < 5 && (await anyStoreMatches(ctx, date, amount)); k++) amount += 173_000;
        lines.push({ key: key(i), date, account, amount, memo: `CASH DEP ${ddmm(date)} TELLER SURABAYA`, store: null, channel: "cash" });
      }
      title = `${num(n)} teller deposits no store recorded`;
      Object.assign(saved, { amount: base, account, count: n });
    } else {
      const dealer = DEALERS.find((d) => d.store === p.store);
      if (!dealer) return { sid: null, error: "Pick the dealer's store" };
      const n = Math.round(p.invoices ?? 0);
      if (n < 1 || n > 5) return { sid: null, error: "Between 1 and 5 invoices" };
      const date = isoDate(YEAR, month, Math.min(dim, 18));
      const nos: string[] = [];
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const invDate = addDays(date, -(10 + Math.floor(rnd() * 30)));
        const amount = between(4_000_000, 60_000_000);
        const invoiceNo = `${dealer.code}-${sid.slice(4).toUpperCase()}${i + 1}`;
        await ctx.db.insert("dealer_invoices", { key: `${sid}-inv${i + 1}`, year: Number(invDate.slice(0, 4)), dealer: dealer.name, store: dealer.store, invoiceNo, date: invDate, amount, recordedOn: invDate, applied: 0, scenario: sid });
        nos.push(invoiceNo);
        sum += amount;
      }
      lines.push({ key: key(0), date, account: "BANK_C", amount: sum - (p.fee ? 2500 : 0), memo: `TRF FROM ${dealer.name.toUpperCase()} INV ${nos.join(" ")}`, store: dealer.store, channel: "dealer" });
      title = `${dealer.name} pays ${num(n)} open invoice${n > 1 ? "s" : ""} at ${STORE_BY_CODE[dealer.store].name}`;
      Object.assign(saved, { store: dealer.store, invoices: n, fee: p.fee ? 1 : 0 });
    }

    await ctx.db.insert("scenarios", { sid, kind: a.kind, title, expect: EXPECT[a.kind], month, params: saved, keys: lines.map((l) => l.key), ruleId, at: Date.now() });
    const docs: Doc<"bank_transactions">[] = [];
    for (const l of lines) {
      const id = await ctx.db.insert("bank_transactions", {
        key: l.key, year: YEAR, month, date: l.date, account: l.account, direction: "in", amount: l.amount, memo: l.memo,
        truth: { store: l.store, channel: l.channel, story: "scenario" }, scenario: sid,
      });
      docs.push((await ctx.db.get(id))!);
    }
    // The first pass under the rules approved now, then a room for each story it held.
    await firstPassLines(ctx, docs, month, monthEnd(YEAR, month), sid);
    const keys = new Set<string>();
    for (const l of lines) {
      const it = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", l.key)).first();
      if (it?.storyKey) keys.add(it.storyKey);
    }
    for (const k of keys) {
      const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", k)).first();
      if (s?.state === "NEW") await openRoom(ctx, s, month, !!(await specOf(ctx, s)));
    }
    const scn = await scenarioOf(ctx, sid);
    if (scn && keys.size) await ctx.db.patch(scn._id, { storyKey: [...keys][0] });
    return { sid, error: null };
  },
});

async function scenarioOf(ctx: QueryCtx, sid: string) {
  return await ctx.db.query("scenarios").withIndex("by_sid", (q) => q.eq("sid", sid)).first();
}

// The CFO answered on a scenario's unknown lender. Yes: the rule the Learner drafted in the room (or, if it drafted
// none that fits, a scripted one at the cut the data shows) is backtested, checked, approved and the payouts re-run.
// No, or I don't know: every payout stays held. Called from humans.ts once the answer is confirmed.
export async function scenarioLenderAnswer(ctx: MutationCtx, story: Doc<"stories">, ans: string, actor: Role) {
  const sid = story._id as Id<ItemTable>;
  const month = story.month;
  const scn = await scenarioOf(ctx, story.scenario!);
  if (ans !== "yes" || !scn?.ruleId) {
    const text = ans === "no" ? "Not a partner. All payouts stay held and nothing is booked." : "Not known yet. All payouts stay held.";
    await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month, reason: ans === "no" ? "Not ours: stays held" : "Unknown: stays held", patch: { resolution: text } });
    return;
  }
  const lender = story.counterparty;
  const rid = scn.ruleId;
  const drafted = [...(await roomMessages(ctx, story.key))].reverse().find((m) => m.speaker === "learner" && m.code)?.code;
  let fromRoom: ReturnType<typeof validateRuleProgram> | null = null;
  try { fromRoom = drafted ? validateRuleProgram(JSON.parse(drafted)) : null; } catch { fromRoom = null; }
  const realRule = !!fromRoom?.ok && fromRoom.rule.match === "lender_sale" && !!fromRoom.rule.params.lenders?.[lender];
  type Match = { matched: number; matchedAmount: number; double: number; none: number; largest: number; cut: number };
  const seen: Match = await ctx.runQuery(internal.roomAgents.lenderSales, { storyKey: story.key, lender });
  const program: RuleProgram = realRule && fromRoom?.ok ? { ...fromRoom.rule, id: rid, version: 1 }
    : { id: rid, version: 1, title: `${lender} payout minus its ${(seen.cut * 100).toFixed(1)}% cut`, channels: ["lender"], match: "lender_sale", params: { lenders: { [lender]: seen.cut }, windowDays: 7 }, limitIdr: 1_000_000_000 };
  const bt: Match = await ctx.runQuery(internal.roomAgents.lenderSales, { storyKey: story.key, lender, cut: program.params.lenders![lender], windowDays: program.params.windowDays ?? 7 });
  const total = bt.matched + bt.none;
  const c = await transition(ctx, {
    table: "rules", id: null, action: "create", actor: "learner", month, reason: `The CFO confirmed ${lender} is a financing partner`,
    insert: { ruleId: rid, version: 1, title: program.title, program: JSON.stringify(program), origin: `CFO answer on the ${lender} scenario`, proposer: "learner", settledCount: 0, learnedInMonth: month, real: realRule, scenario: story.scenario }, patch: {},
  });
  if (!c.ok) return;
  await transition(ctx, {
    table: "rules", id: c.id, action: "propose", actor: "learner", month, reason: `No ${lender} history, so backtested on the held payouts`,
    patch: { backtest: { covered: bt.matched, correct: bt.matched, errors: bt.double, precision: bt.matched ? (bt.matched - bt.double) / bt.matched : 0, coverage: total ? bt.matched / total : 0, scope: `the ${num(total)} held ${lender} payouts (no ${lender} history)`, examples: [] } },
  });
  const overLimit = bt.largest > program.limitIdr;
  await transition(ctx, {
    table: "rules", id: c.id, action: "annotate", actor: "auditor", month, reason: "Looked for counterexamples",
    patch: { audit: { result: bt.double || overLimit ? "flag" : "pass", note: `${num(bt.none)} payouts match no ${lender} sale and stay held. ${num(bt.double)} match two sales.${overLimit ? " The largest payout is above the limit and stays held." : ""}`, counterexamples: bt.double, real: false } },
  });
  const ap = await transition(ctx, { table: "rules", id: c.id, action: "approve", actor, month, reason: `Confirmed back: ${lender} is a new financing partner`, patch: { approvedBy: actor } });
  if (!ap.ok) return;
  await afterword(ctx, story.key, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `${rid} approved by the CFO${realRule ? ", as the Learner drafted it in this room" : ", from a scripted program at the cut the data shows: no fitting draft came out of the room"}. The engine now re-runs the held payouts under ${rid}.` });
  await ctx.db.insert("trace_events", { agent: "learner", month, ruleId: rid, storyKey: story.key, kind: "result", text: `${rid} ${realRule ? "drafted by the Learner in the case room" : "written (scripted program)"}. Backtest: ${bt.matched} of ${total} held payouts match a ${lender} sale.`, real: realRule, at: Date.now() });
  await transition(ctx, { table: "stories", id: sid, action: "propose", actor: "investigator", month, reason: `Settle under ${rid}`, patch: { proposer: "investigator" } });
  await ctx.scheduler.runAfter(0, internal.scenario.rerun, { storyKey: story.key, ruleId: rid });
}

// The held payouts again, under the new rule: the same recheck the close runs after story B.
export const rerun = internalMutation({
  args: { storyKey: v.string(), ruleId: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const story = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    if (!story?.scenario) return null;
    let cursor: string | null = null;
    do {
      const r = await runRecheck(ctx, { fromMonth: story.month, state: "HELD", storyKey: story.key, cursor, asOf: monthEnd(YEAR, story.month), passMonth: story.month, scenario: story.scenario });
      cursor = r.cursor;
    } while (cursor);
    const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", story.key)).take(200);
    const settled = items.filter((i) => i.state === "POSTED");
    const held = items.filter((i) => i.state === "HELD").length;
    const amount = settled.reduce((s, i) => s + (i.amount ?? 0), 0);
    const resolution = `${a.ruleId} settled ${num(settled.length)} payouts (${rpShort(amount)}).${held ? ` ${num(held)} match no sale and stay held.` : ""}`;
    await afterword(ctx, story.key, { speaker: "engine", to: "room", source: "code", text: `Re-ran the held payouts under ${a.ruleId}: ${num(settled.length)} settled and posted, ${num(held)} still held.` });
    const sid = story._id as Id<ItemTable>;
    await ctx.db.patch(story._id, { resolution });
    if (!held && settled.length) {
      const ok = await transition(ctx, { table: "stories", id: sid, action: "approve", actor: "cfo", month: story.month, reason: `Every payout settled under ${a.ruleId}`, patch: {} });
      if (ok.ok) await transition(ctx, { table: "stories", id: sid, action: "post", actor: "gateway", month: story.month, reason: "Story closed", patch: { resolution } });
    }
    return null;
  },
});

// Deletes every scenario row and everything derived from it. Audit rows stay (append only), hidden once reset.
export const reset = mutation({
  args: { consoleKey },
  returns: v.string(),
  handler: async (ctx, a) => {
    requireConsole(a.consoleKey);
    const all = await ctx.db.query("scenarios").take(100);
    let rows = 0;
    const del = async (id: Id<TableNames>) => { await ctx.db.delete(id); rows++; };
    for (const s of all) {
      // Every key a scenario writes starts with its id, so one index range finds them.
      const range = (t: "bank_transactions" | "erp_invoices" | "dealer_invoices" | "journal_entries") =>
        ctx.db.query(t as "bank_transactions").withIndex("by_key", (q) => q.gte("key", s.sid).lte("key", s.sid + "~")).take(500);
      const stories = new Set<string>(s.storyKey ? [s.storyKey] : []);
      for (const b of await range("bank_transactions")) {
        for (const it of await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", b.key)).take(5)) {
          if (it.storyKey) stories.add(it.storyKey);
          for (const j of await ctx.db.query("journal_entries").withIndex("by_work_item", (q) => q.eq("workItemId", it._id)).take(10)) await del(j._id);
          await del(it._id);
        }
        await del(b._id);
      }
      for (const t of ["erp_invoices", "dealer_invoices", "journal_entries"] as const) for (const r of await range(t)) await del(r._id);
      for (const key of stories) {
        const st = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", key)).first();
        if (!st?.scenario) continue; // never a story of the year
        for (const m of await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", key)).take(500)) await del(m._id);
        for (const q of await ctx.db.query("questions").withIndex("by_story", (x) => x.eq("storyKey", key)).take(10)) await del(q._id);
        for (const p of await ctx.db.query("precedents").withIndex("by_story", (x) => x.eq("storyKey", key)).take(10)) await del(p._id);
        for (const t of await ctx.db.query("trace_events").withIndex("by_story", (x) => x.eq("storyKey", key)).take(200)) await del(t._id);
        await del(st._id);
      }
      if (s.ruleId) {
        for (const r of await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", s.ruleId!)).take(10)) if (r.scenario === s.sid) await del(r._id);
        for (const t of await ctx.db.query("trace_events").withIndex("by_rule", (q) => q.eq("ruleId", s.ruleId!)).take(200)) if (!t.storyKey || stories.has(t.storyKey)) await del(t._id);
      }
      await del(s._id);
    }
    return all.length ? `Removed ${num(all.length)} scenario${all.length > 1 ? "s" : ""} (${num(rows)} rows). Their audit rows stay in the append only record, hidden from views.` : "No scenarios to remove.";
  },
});

// The Scenarios screen: each scenario with what it injected and what came of it.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = (await ctx.db.query("scenarios").order("desc").take(20));
    const out = [];
    for (const s of all) {
      const bank = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.gte("key", s.sid).lte("key", s.sid + "~")).take(60);
      const lines = [];
      for (const b of bank) {
        const it = await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", b.key)).first();
        lines.push({ key: b.key, date: b.date, account: b.account, memo: b.memo, amount: b.amount, channel: parseMemo({ ...b, account: b.account as never }).channel, state: it?.state ?? null, ruleIds: it?.ruleIds ?? [], note: it?.note ?? null, store: it?.placement?.store ?? null });
      }
      const story = s.storyKey ? await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", s.storyKey!)).first() : null;
      const question = s.storyKey ? await ctx.db.query("questions").withIndex("by_story", (q) => q.eq("storyKey", s.storyKey!)).first() : null;
      const rule = s.ruleId ? (await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", s.ruleId!)).take(10)).find((r) => r.scenario === s.sid) ?? null : null;
      out.push({
        sid: s.sid, kind: s.kind, title: s.title, expect: s.expect, month: s.month, params: s.params, at: s.at, lines,
        story: story ? { key: story.key, title: story.title, state: story.state, room: story.room ?? null, resolution: story.resolution ?? null, askOf: story.askOf ?? null } : null,
        question: question ? { state: question.state, askOf: question.askOf, text: question.text, answer: question.options.find((o) => o.id === question.answer)?.label ?? null } : null,
        rule: rule ? { ruleId: rule.ruleId, title: rule.title, state: rule.state, real: rule.real, settledCount: rule.settledCount, backtest: rule.backtest ?? null } : null,
      });
    }
    return out;
  },
});
