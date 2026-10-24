// The close: month by month, re-check what was waiting, run the first pass, investigate new stories,
// pause where a person must decide, then continue. Each step is a scheduled mutation.
import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { runFirstPass, runRecheck, type BatchStats } from "./engine";
import { YEAR, isoDate, monthEnd } from "./lib/domain";
import { draftQuestion } from "./lib/investigate";
import { transition, type ItemTable } from "./lib/transition";

const YEAR_END_AS_OF = isoDate(YEAR + 1, 1, 20);
export const STORY_A_KEY = "placement_conflict|S03|school_va";
export const STORY_B_KEY = "unknown_lender|FIN_Z";

export async function getClose(ctx: MutationCtx): Promise<Doc<"work_items"> | null> {
  return await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", "close")).first();
}

async function monthItem(ctx: MutationCtx, m: number) {
  return await ctx.db.query("work_items").withIndex("by_ref", (q) => q.eq("ref", `month-${m}`)).first();
}

async function addStats(ctx: MutationCtx, m: number, s: Partial<BatchStats> & { questions?: number; stories?: number; settledByNewRule?: number }) {
  const item = await monthItem(ctx, m);
  if (!item) return;
  const stats = { ...(item.stats ?? {}) };
  for (const [k, val] of Object.entries(s)) if (typeof val === "number" && val) stats[k] = (stats[k] ?? 0) + val;
  await ctx.db.patch(item._id, { stats });
}

export const start = mutation({
  args: { autopilot: v.boolean() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const close = await getClose(ctx);
    if (!close) return "Seed the data first";
    if (close.run && close.run.phase !== "idle") return "The close is already running";
    await ctx.db.patch(close._id, {
      run: { phase: "first", month: 1, cursor: null, pausedFor: null, autopilot: args.autopilot, startedAt: Date.now(), finishedAt: null, rerunRule: null },
    });
    await ctx.db.insert("trace_events", { agent: "engine", month: 1, kind: "decision", text: "Close the year: starting with January", real: true, at: Date.now() });
    await ctx.scheduler.runAfter(0, internal.run.step, {});
    return null;
  },
});

export const setAutopilot = mutation({
  args: { on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const close = await getClose(ctx);
    if (!close?.run) return null;
    await ctx.db.patch(close._id, { run: { ...close.run, autopilot: args.on } });
    if (args.on && close.run.pausedFor) await ctx.scheduler.runAfter(1500, internal.humans.autopilotTick, {});
    return null;
  },
});

export const step = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const close = await getClose(ctx);
    if (!close?.run) return null;
    const run = close.run;
    if (run.pausedFor || run.phase === "done" || run.phase === "idle") return null;
    const m = run.month;
    const save = async (patch: Partial<typeof run>, again = true) => {
      await ctx.db.patch(close._id, { run: { ...run, ...patch } });
      if (again) await ctx.scheduler.runAfter(0, internal.run.step, {});
    };

    if (run.phase.startsWith("second:")) {
      const j = Number(run.phase.split(":")[1]);
      const r = await runRecheck(ctx, { fromMonth: j, state: "WAITING", storyKey: null, cursor: run.cursor, asOf: monthEnd(YEAR, m), passMonth: m });
      await addStats(ctx, j, { settledLater: r.stats.settledLater, held: r.stats.held });
      if (!r.done) return save({ cursor: r.cursor });
      return save({ phase: j + 1 < m ? `second:${j + 1}` : "first", cursor: null });
    }
    if (run.phase === "first") {
      const r = await runFirstPass(ctx, m, run.cursor, monthEnd(YEAR, m));
      await addStats(ctx, m, { firstSettled: r.stats.firstSettled, waiting: r.stats.waiting, held: r.stats.held, processed: r.stats.processed });
      if (!r.done) return save({ cursor: r.cursor });
      return save({ phase: "stories", cursor: null });
    }
    if (run.phase === "stories") {
      const fresh = (await ctx.db.query("stories").withIndex("by_month", (q) => q.eq("month", m)).take(100)).filter((s) => s.state === "NEW");
      for (const s of fresh) await investigate(ctx, s, m);
      await addStats(ctx, m, { questions: fresh.length, stories: fresh.length });
      await ctx.db.insert("trace_events", { agent: "engine", month: m, kind: "result", text: `Month closed on first pass. ${fresh.length} new ${fresh.length === 1 ? "story" : "stories"}.`, real: true, at: Date.now() });
      const pauseFor = m === 3 ? "A" : m === 6 ? "B" : null;
      if (pauseFor) {
        await save({ phase: "paused", pausedFor: pauseFor }, false);
        if (run.autopilot) await ctx.scheduler.runAfter(2500, internal.humans.autopilotTick, {});
        return null;
      }
      return next();
    }
    if (run.phase.startsWith("rerun:")) {
      const key = run.phase.slice("rerun:".length);
      const r = await runRecheck(ctx, { fromMonth: m, state: "HELD", storyKey: key, cursor: run.cursor, asOf: monthEnd(YEAR, m), passMonth: m });
      await addStats(ctx, m, { settledByNewRule: r.stats.settledLater });
      if (!r.done) return save({ cursor: r.cursor });
      await ctx.db.insert("trace_events", { agent: "engine", month: m, kind: "result", text: `Re-ran held lines under ${run.rerunRule}. Continuing.`, real: true, at: Date.now() });
      return next();
    }
    if (run.phase.startsWith("yearend:")) {
      const j = Number(run.phase.split(":")[1]);
      const r = await runRecheck(ctx, { fromMonth: j, state: "WAITING", storyKey: null, cursor: run.cursor, asOf: YEAR_END_AS_OF, passMonth: 13 });
      await addStats(ctx, j, { settledLater: r.stats.settledLater, held: r.stats.held });
      if (!r.done) return save({ cursor: r.cursor });
      if (j < 12) return save({ phase: `yearend:${j + 1}`, cursor: null });
      await ctx.db.insert("trace_events", { agent: "engine", month: 12, kind: "decision", text: "Year closed. Every line is settled or held in a story.", real: true, at: Date.now() });
      return save({ phase: "done", cursor: null, finishedAt: Date.now() }, false);
    }
    return null;

    async function next() {
      if (m === 12) return save({ phase: "yearend:1", cursor: null, pausedFor: null });
      return save({ month: m + 1, phase: "second:1", cursor: null, pausedFor: null, rerunRule: null });
    }
  },
});

// Resume after a pause: optionally re-run held lines of one story under a newly approved rule first.
export async function resume(ctx: MutationCtx, rerun: { storyKey: string; ruleId: string } | null) {
  const close = await getClose(ctx);
  if (!close?.run) return;
  const run = close.run;
  if (rerun) await ctx.db.patch(close._id, { run: { ...run, pausedFor: null, phase: `rerun:${rerun.storyKey}`, cursor: null, rerunRule: rerun.ruleId } });
  else {
    const m = run.month;
    const nextRun = m === 12 ? { ...run, pausedFor: null, phase: "yearend:1", cursor: null } : { ...run, pausedFor: null, month: m + 1, phase: "second:1", cursor: null, rerunRule: null };
    await ctx.db.patch(close._id, { run: nextRun });
  }
  await ctx.scheduler.runAfter(0, internal.run.step, {});
}

// Investigator: one question per story. Story B is written by Claude in a scheduled action.
async function investigate(ctx: MutationCtx, s: Doc<"stories">, m: number) {
  const now = Date.now();
  const id = s._id as Id<ItemTable>;
  if (s.key === STORY_B_KEY) {
    await transition(ctx, { table: "stories", id, action: "ask", actor: "investigator", month: m, reason: "Investigating with Claude", patch: { askOf: "cfo" } });
    const q = await transition(ctx, {
      table: "questions", id: null, action: "create", actor: "investigator", month: m, reason: "Question placeholder while Claude investigates",
      insert: { storyKey: s.key, askOf: "cfo", text: "The Investigator is still reading the evidence.", options: [], real: true, month: m }, patch: {},
    });
    if (q.ok) await transition(ctx, { table: "questions", id: q.id, action: "ask", actor: "investigator", month: m, reason: "Asked the CFO", patch: {} });
    await ctx.db.insert("trace_events", { agent: "investigator", month: m, storyKey: s.key, kind: "tool", text: "handing the evidence for this story to Claude", real: true, at: now });
    await ctx.scheduler.runAfter(0, internal.agents.investigateStoryB, { storyKey: s.key });
    return;
  }
  const d = draftQuestion(s);
  await transition(ctx, {
    table: "stories", id, action: "ask", actor: "investigator", month: m, reason: "One question for the whole story",
    patch: { askOf: d.askOf, investigation: { summary: d.summary, hypothesis: d.hypothesis, real: false } },
  });
  for (let i = 0; i < d.trace.length; i++)
    await ctx.db.insert("trace_events", { agent: "investigator", month: m, storyKey: s.key, kind: i === d.trace.length - 1 ? "decision" : "thought", text: d.trace[i], real: false, at: now + i });
  await transition(ctx, { table: "stories", id, action: "annotate", actor: "auditor", month: m, reason: "Second opinion", patch: { auditorOpinion: { text: d.auditor, real: false } } });
  await ctx.db.insert("trace_events", { agent: "auditor", month: m, storyKey: s.key, kind: "result", text: d.auditor, real: false, at: now + 20 });
  const q = await transition(ctx, {
    table: "questions", id: null, action: "create", actor: "investigator", month: m, reason: "Drafted the question",
    insert: { storyKey: s.key, askOf: d.askOf, text: d.text, options: d.options, real: false, month: m }, patch: {},
  });
  if (q.ok) await transition(ctx, { table: "questions", id: q.id, action: "ask", actor: "investigator", month: m, reason: `Asked the ${d.askOf === "cfo" ? "CFO" : "Accountant"}`, patch: {} });
}
