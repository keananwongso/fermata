// Evaluation: wrong postings against the hidden truth, a held out week, and a fuzzer. Runs live.
import { v } from "convex/values";
import { action, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { convexPort, strip } from "./engine";
import { evaluate, type EngineTxn } from "./lib/engineCore";
import type { RuleProgram } from "./lib/rules";
import { YEAR, STORES, isoDate } from "./lib/domain";
import { consoleKey, requireConsole } from "./lib/console";

const WEEK_FROM = `${YEAR}-12-15`, WEEK_TO = `${YEAR}-12-21`;

export const scanPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ posted: v.number(), byRule: v.number(), byPerson: v.number(), withStore: v.number(), wrongStore: v.number(), weekSettled: v.number(), weekCorrect: v.number(), weekHeld: v.number(), weekTotal: v.number(), wrongExamples: v.array(v.string()), cursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, a) => {
    const page = await ctx.db.query("work_items").withIndex("by_kind_state", (q) => q.eq("kind", "bank_txn")).paginate({ cursor: a.cursor, numItems: 400 });
    const r = { posted: 0, byRule: 0, byPerson: 0, withStore: 0, wrongStore: 0, weekSettled: 0, weekCorrect: 0, weekHeld: 0, weekTotal: 0, wrongExamples: [] as string[] };
    for (const it of page.page) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (!b || b.scenario) continue; // scenarios are not part of the year being evaluated
      const inWeek = b.date >= WEEK_FROM && b.date <= WEEK_TO;
      if (inWeek) { r.weekTotal++; if (it.state === "HELD") r.weekHeld++; }
      if (it.state !== "POSTED") continue;
      r.posted++;
      if (it.settledBy === "person") r.byPerson++; else r.byRule++;
      const store = it.placement?.store ?? null;
      if (store) {
        r.withStore++;
        const wrong = store !== b.truth.store;
        if (wrong) { r.wrongStore++; if (r.wrongExamples.length < 5) r.wrongExamples.push(`${b.key} placed at ${store}, truth ${b.truth.store}`); }
        if (inWeek && it.settledBy !== "person") { r.weekSettled++; if (!wrong) r.weekCorrect++; }
      } else if (inWeek && it.settledBy !== "person") { r.weekSettled++; r.weekCorrect++; }
    }
    return { ...r, cursor: page.isDone ? null : page.continueCursor };
  },
});

// The fuzzer mutates real settled lines and checks that none of the mutants settle.
export const fuzz = internalQuery({
  args: { month: v.number(), n: v.number(), seed: v.number() },
  returns: v.object({ tried: v.number(), settled: v.number(), recovered: v.number(), held: v.number(), waiting: v.number(), slipped: v.array(v.string()) }),
  handler: async (ctx, a) => {
    const all = await ctx.db.query("rules").take(100);
    const programs = all.filter((r) => r.state === "APPROVED").map((r) => JSON.parse(r.program) as RuleProgram);
    const items = await ctx.db.query("work_items").withIndex("by_kind_month_state", (q) => q.eq("kind", "bank_txn").eq("month", a.month).eq("state", "POSTED")).take(a.n * 3);
    // Mutants are judged as if their records were still open, so a mutant cannot hide behind "already paid".
    const seen = new Map();
    const port = convexPort(ctx as unknown as MutationCtx, isoDate(YEAR, 12, 31), YEAR, seen);
    const open = { ...port, applied: async () => 0 };
    let tried = 0, settled = 0, recovered = 0, held = 0, waiting = 0;
    const slipped: string[] = [];
    let s = a.seed;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    for (const it of items) {
      if (tried >= a.n) break;
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (!b || b.scenario || b.memo.startsWith("TRF")) continue;
      const t = strip(b);
      const kind = Math.floor(rnd() * 4);
      let m: EngineTxn = t;
      if (kind === 0) m = { ...t, amount: t.amount + 1 + Math.floor(rnd() * 9) };
      else if (kind === 1) m = { ...t, amount: Math.round(t.amount * 1.01) };
      else if (kind === 2) {
        const other = STORES[Math.floor(rnd() * 14)].code.slice(1);
        m = { ...t, memo: t.memo.replace(/(T|SLIP |SHOP-|WB-S|S|8800)(\d\d)/, (_x, p: string) => `${p}${other}`) };
        if (m.memo === t.memo) m = { ...t, amount: t.amount - 7 };
      } else m = { ...t, amount: Math.round(t.amount * 0.97) };
      tried++;
      const d = await evaluate(m, programs, open, { asOf: isoDate(YEAR + 1, 1, 20), firstPass: false });
      if (d.kind === "settle") {
        // A mutant that still settles at the true store for the true amount was recovered, not slipped.
        const withinCoinTolerance = t.memo.startsWith("CASH DEP") && Math.abs(m.amount - t.amount) <= 5000;
        if ((m.amount === t.amount || withinCoinTolerance) && d.placement.store === b.truth.store) recovered++;
        else { settled++; if (slipped.length < 5) slipped.push(`${t.key}: ${m.memo} ${m.amount}`); }
      }
      else if (d.kind === "hold") held++; else waiting++;
    }
    return { tried, settled, recovered, held, waiting, slipped };
  },
});

export const save = internalMutation({
  args: { result: v.record(v.string(), v.union(v.string(), v.number())) },
  returns: v.null(),
  handler: async (ctx, a) => { await ctx.db.insert("eval_runs", { kind: "full", at: Date.now(), result: a.result }); return null; },
});

export const run = action({
  args: { consoleKey },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireConsole(a.consoleKey);
    const tot = { posted: 0, byRule: 0, byPerson: 0, withStore: 0, wrongStore: 0, weekSettled: 0, weekCorrect: 0, weekHeld: 0, weekTotal: 0 };
    const wrongExamples: string[] = [];
    let cursor: string | null = null;
    do {
      const p: ScanPage = await ctx.runQuery(internal.evaluation.scanPage, { cursor });
      for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += p[k];
      wrongExamples.push(...p.wrongExamples);
      cursor = p.cursor;
    } while (cursor);
    const f = { tried: 0, settled: 0, recovered: 0, held: 0, waiting: 0 };
    const slipped: string[] = [];
    for (const m of [2, 5, 8, 11]) {
      const r = await ctx.runQuery(internal.evaluation.fuzz, { month: m, n: 125, seed: m * 7919 });
      f.tried += r.tried; f.settled += r.settled; f.recovered += r.recovered; f.held += r.held; f.waiting += r.waiting; slipped.push(...r.slipped);
    }
    await ctx.runMutation(internal.evaluation.save, { result: {
      ...tot, wrongExamples: wrongExamples.slice(0, 5).join("; "),
      fuzzTried: f.tried, fuzzSettled: f.settled, fuzzRecovered: f.recovered, fuzzHeld: f.held, fuzzWaiting: f.waiting, fuzzSlipped: slipped.slice(0, 5).join("; "),
      weekFrom: WEEK_FROM, weekTo: WEEK_TO,
    } });
    return null;
  },
});
type ScanPage = { posted: number; byRule: number; byPerson: number; withStore: number; wrongStore: number; weekSettled: number; weekCorrect: number; weekHeld: number; weekTotal: number; wrongExamples: string[]; cursor: string | null };
void (null as unknown as Doc<"work_items">);
