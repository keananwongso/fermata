// The close: month by month, re-check what was waiting, run the first pass, open a case room per new story,
// pause where a person must decide, then continue. Each step is a scheduled mutation.
import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { runFirstPass, runRecheck, type BatchStats } from "./engine";
import { YEAR, isoDate, monthEnd } from "./lib/domain";
import { openRoom } from "./rooms";
import { LIVE_ROOMS } from "./roomAgents";
import { CONSOLE_REFUSAL, consoleKey, isConsole, requireConsole } from "./lib/console";

const YEAR_END_AS_OF = isoDate(YEAR + 1, 1, 20);
export { STORY_A_KEY, STORY_B_KEY } from "./lib/domain";

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
  args: { autopilot: v.boolean(), consoleKey },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (!isConsole(args.consoleKey)) return CONSOLE_REFUSAL;
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
  args: { on: v.boolean(), consoleKey },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireConsole(args.consoleKey);
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
      if (r.voteRef && !close.note) await ctx.db.patch(close._id, { note: JSON.stringify({ vote: r.voteRef }) });
      if (!r.done) return save({ cursor: r.cursor });
      return save({ phase: "stories", cursor: null });
    }
    if (run.phase === "stories") {
      const fresh = (await ctx.db.query("stories").withIndex("by_month", (q) => q.eq("month", m)).take(100)).filter((s) => s.state === "NEW");
      for (const s of fresh) await openRoom(ctx, s, m, LIVE_ROOMS.has(s.key));
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
