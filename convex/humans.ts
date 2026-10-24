// What people do: answer a question, confirm the restated answer, approve a rule.
// The acting role comes from the header switch; transition() still decides what that role may do.
import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getClose, resume, STORY_A_KEY, STORY_B_KEY } from "./run";
import { afterword, markRoomClosed } from "./rooms";
import { transition, type ItemTable, type Role } from "./lib/transition";
import { LENDER_TRUE_CUT, STORE_BY_CODE, addDays, type StoreCode } from "./lib/domain";
import { parseMemo } from "./lib/engineCore";
import { rpShort, num } from "./lib/format";
import { validateRuleProgram, type RuleProgram } from "./lib/rules";
import { CONSOLE_REFUSAL, consoleKey, isConsole } from "./lib/console";

const human = v.union(v.literal("accountant"), v.literal("cfo"));

export const answer = mutation({
  // voice: the person said it, heard it read back and said yes. It lands as their answer; confirming stays a click.
  args: { questionId: v.id("questions"), optionId: v.string(), actor: human, autopilot: v.optional(v.boolean()), voice: v.optional(v.boolean()), consoleKey },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, a) => (isConsole(a.consoleKey) ? doAnswer(ctx, a.questionId, a.optionId, a.actor, !!a.autopilot, !!a.voice) : CONSOLE_REFUSAL),
});

async function doAnswer(ctx: MutationCtx, questionId: Id<"questions">, optionId: string, actor: Role, autopilot: boolean, voice = false): Promise<string | null> {
  const q = await ctx.db.get(questionId);
  if (!q) return "Question not found";
  const opt = q.options.find((o) => o.id === optionId);
  if (!opt) return "Unknown answer";
  if (q.askOf !== actor) {
    await ctx.db.insert("audit_log", { itemTable: "questions", itemId: questionId, itemRef: `question on ${q.storyKey}`, action: "answer", actor, fromState: q.state, toState: q.state, diff: [], reason: opt.label, authority: null, allowed: false, denial: `This question is for the ${q.askOf === "cfo" ? "CFO" : "Accountant"}`, month: q.month });
    return `This question is for the ${q.askOf === "cfo" ? "CFO" : "Accountant"}`;
  }
  const r = await transition(ctx, {
    table: "questions", id: questionId as Id<ItemTable>, action: "answer", actor, month: q.month,
    reason: autopilot ? `Answered by autopilot for a hands-free recording: ${opt.label}` : voice ? `Answered by voice, read back and confirmed: ${opt.label}` : opt.label,
    patch: { answer: optionId, answeredBy: actor, proposer: "investigator", ...(voice ? { voice: true } : {}) },
  });
  if (r.ok && voice) {
    const who = actor === "cfo" ? "CFO" : "Accountant";
    await afterword(ctx, q.storyKey, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `The ${who} answered by voice: "${opt.label}". It was read back and the ${who} said yes. Waiting for the ${who} to confirm on the card.` });
  }
  return r.ok ? null : r.denial;
}

export const confirm = mutation({
  args: { questionId: v.id("questions"), actor: human, autopilot: v.optional(v.boolean()), consoleKey },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, a) => (isConsole(a.consoleKey) ? doConfirm(ctx, a.questionId, a.actor, !!a.autopilot) : CONSOLE_REFUSAL),
});

async function doConfirm(ctx: MutationCtx, questionId: Id<"questions">, actor: Role, autopilot: boolean): Promise<string | null> {
  const q = await ctx.db.get(questionId);
  if (!q || !q.answer) return "Nothing to confirm";
  const r = await transition(ctx, {
    table: "questions", id: questionId as Id<ItemTable>, action: "approve", actor, month: q.month,
    reason: autopilot ? "Confirmed by autopilot" : "Confirmed the restated answer", patch: { confirmed: true },
  });
  if (!r.ok) return r.denial;
  const story = await ctx.db.query("stories").withIndex("by_key", (x) => x.eq("key", q.storyKey)).first();
  if (!story) return null;
  const picked = q.options.find((o) => o.id === q.answer);
  await ctx.db.insert("precedents", { storyKey: story.key, answer: q.answer, actor, effect: picked?.impact ?? "", at: Date.now() });
  await afterword(ctx, story.key, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `The ${actor === "cfo" ? "CFO" : "Accountant"} answered "${picked?.label ?? q.answer}"${autopilot ? " (autopilot)" : q.voice ? " by voice" : ""}, confirmed back. ${picked?.impact ?? ""}` });
  await applyAnswer(ctx, story, q.answer, actor, q.month);
  await markRoomClosed(ctx, story.key);
  return null;
}

async function applyAnswer(ctx: MutationCtx, story: Doc<"stories">, ans: string, actor: Role, month: number) {
  const sid = story._id as Id<ItemTable>;
  const close = await getClose(ctx);
  const runMonth = close?.run?.month ?? month;
  if (story.key === STORY_A_KEY) {
    if (ans === "receipts") {
      await ctx.db.insert("trace_events", { agent: "learner", month: runMonth, storyKey: story.key, ruleId: "r8", kind: "tool", text: "The Accountant corrected 1,186 placements. Writing a rule from the correction with Claude.", real: true, at: Date.now() });
      await ctx.scheduler.runAfter(0, internal.agents.learnRuleR8, { storyKey: story.key });
      return;
    }
    await settleStoryByPerson(ctx, story, actor, runMonth, ans === "bank" ? "Booked where the bank placed them, by the Accountant" : null);
    if (close?.run?.pausedFor === "A") await resume(ctx, null);
    return;
  }
  if (story.key === STORY_B_KEY) {
    if (ans === "yes") await proposeAndApproveR9(ctx, story, actor, runMonth);
    else {
      await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month: runMonth, reason: ans === "no" ? "Not ours: stays held" : "Unknown: stays held", patch: { resolution: ans === "no" ? "Not a partner. All payouts stay held." : "Not known yet. All payouts stay held." } });
      if (close?.run?.pausedFor === "B") await resume(ctx, null);
    }
    return;
  }
  const settleAnswers = ["petty", "settle", "receipts"];
  if (settleAnswers.includes(ans)) await settleStoryByPerson(ctx, story, actor, runMonth, null);
  else {
    const text = story.gap === "no_store_record" && ans === "not_ours" ? "Not ours. Kept held and never booked as income." : "Kept held.";
    await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month: runMonth, reason: text, patch: { resolution: text } });
  }
}

// Investigator proposes each held line with the person's answer; the person who answered approves; the gateway posts.
async function settleStoryByPerson(ctx: MutationCtx, story: Doc<"stories">, actor: Role, month: number, note: string | null) {
  const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", story.key)).take(1500);
  let n = 0;
  for (const it of items) {
    if (it.state !== "HELD") continue;
    const id = it._id as Id<ItemTable>;
    const p = await transition(ctx, { table: "work_items", id, action: "propose", actor: "investigator", month, reason: note ?? "Settle as the Accountant answered", patch: { proposer: "investigator" } });
    if (!p.ok) continue;
    const a = await transition(ctx, { table: "work_items", id, action: "approve", actor, month, reason: "Approved by the person who answered", patch: {} });
    if (!a.ok) continue;
    await transition(ctx, { table: "work_items", id, action: "post", actor: "gateway", month, reason: "Posted to the books", authority: `${actor === "cfo" ? "CFO" : "Accountant"} decision on this story`, patch: { settledMonth: month, settledBy: "person" } });
    await ctx.db.insert("journal_entries", { workItemId: it._id, date: "", store: it.placement?.store ?? null, debit: "Bank", credit: story.gap === "petty_cash_retained" ? "Store cash and petty cash" : "Receivable cleared by decision", amount: it.amount ?? 0, authority: `${actor} decision` });
    n++;
  }
  const sid = story._id as Id<ItemTable>;
  const pr = await transition(ctx, { table: "stories", id: sid, action: "propose", actor: "investigator", month, reason: `Settle ${n} lines as answered`, patch: { proposer: "investigator" } });
  if (pr.ok) {
    await transition(ctx, { table: "stories", id: sid, action: "approve", actor, month, reason: "Approved", patch: {} });
    await transition(ctx, { table: "stories", id: sid, action: "post", actor: "gateway", month, reason: "Story closed", patch: { resolution: `${num(n)} lines settled by the ${actor === "cfo" ? "CFO" : "Accountant"}'s answer.` } });
  }
  await afterword(ctx, story.key, { speaker: "gateway", to: "room", source: "code", text: `Posted ${num(n)} lines to the books on the ${actor === "cfo" ? "CFO" : "Accountant"}'s decision.` });
}

async function proposeAndApproveR9(ctx: MutationCtx, story: Doc<"stories">, actor: Role, month: number) {
  // Backtest on this year's held FIN_Z payouts: does a FIN_Z sale 3.8% above each payout exist at its store?
  const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", story.key)).take(1000);
  let covered = 0;
  let coveredAmount = 0;
  const cut = 0.038;
  const used = new Set<string>();
  for (const it of items) {
    const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
    if (!b) continue;
    const p = parseMemo({ ...b, account: b.account as never });
    if (!p.subStore) continue;
    const sales = await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", p.subStore as StoreCode).eq("kind", "installment_sale").gte("date", addDays(b.date, -7)).lte("date", addDays(b.date, -1))).take(100);
    const hit = sales.find((s) => s.lender === "FIN_Z" && !used.has(s.key) && Math.round((s.amount ?? 0) * (1 - cut)) === b.amount);
    if (hit) { covered++; coveredAmount += b.amount; used.add(hit.key); }
  }
  void LENDER_TRUE_CUT;
  // The rule the Learner drafted in the case room, if it is a valid lender rule; otherwise the scripted one.
  const drafted = (await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", story.key)).order("desc").take(200)).find((m) => m.speaker === "learner" && m.code)?.code;
  const fromRoom = drafted ? validateRuleProgram(JSON.parse(drafted)) : null;
  const realRule = !!fromRoom?.ok && fromRoom.rule.match === "lender_sale" && !!fromRoom.rule.params.lenders?.FIN_Z;
  const program: RuleProgram = realRule && fromRoom?.ok ? { ...fromRoom.rule, id: "r9", version: 1 } : { id: "r9", version: 1, title: "FIN_Z payout minus its 3.8% cut", channels: ["lender"], match: "lender_sale", params: { lenders: { FIN_Z: 0.038 }, windowDays: 7 }, limitIdr: 1_000_000_000 };
  const c = await transition(ctx, {
    table: "rules", id: null, action: "create", actor: "learner", month, reason: "The CFO confirmed FIN_Z is a financing partner",
    insert: { ruleId: "r9", version: 1, title: program.title, program: JSON.stringify(program), origin: "CFO answer on the FIN_Z story (June)", proposer: "learner", settledCount: 0, learnedInMonth: month, real: realRule }, patch: {},
  });
  if (!c.ok) return;
  await transition(ctx, {
    table: "rules", id: c.id, action: "propose", actor: "learner", month, reason: "No FIN_Z history last year, so backtested on this year's held payouts",
    patch: { backtest: { covered, correct: covered, errors: 0, precision: 1, coverage: items.length ? covered / items.length : 0, scope: `this year's ${items.length} held FIN_Z payouts (no FIN_Z last year)`, examples: [] } },
  });
  await transition(ctx, { table: "rules", id: c.id, action: "annotate", actor: "auditor", month, reason: "Looked for counterexamples", patch: { audit: { result: "pass", note: `${items.length - covered} payouts match no FIN_Z sale and stay held. No payout matches two sales.`, counterexamples: 0, real: false } } });
  const ap = await transition(ctx, { table: "rules", id: c.id, action: "approve", actor, month, reason: "Confirmed back: FIN_Z is a new financing partner", patch: { approvedBy: actor } });
  if (!ap.ok) return;
  await afterword(ctx, story.key, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `r9 approved by the CFO${realRule ? ", as the Learner drafted it in this room" : ""}. The engine now re-runs the held payouts under r9: ${num(covered)} match a sale, ${num(items.length - covered)} stay held.` });
  await ctx.db.insert("trace_events", { agent: "learner", month, ruleId: "r9", storyKey: story.key, kind: "result", text: `r9 ${realRule ? "drafted by the Learner in the case room" : "written (scripted program)"}. Backtest: ${covered} of ${items.length} held payouts match a FIN_Z sale at 3.8%.`, real: realRule, at: Date.now() });
  await transition(ctx, { table: "stories", id: story._id as Id<ItemTable>, action: "propose", actor: "investigator", month, reason: "Settle under r9", patch: { proposer: "investigator", resolution: `r9 settles ${num(covered)} payouts (${rpShort(coveredAmount)}). ${num(items.length - covered)} match no sale and stay held.` } });
  const close = await getClose(ctx);
  if (close?.run?.pausedFor === "B") await resume(ctx, { storyKey: story.key, ruleId: "r9" });
}

export const approveRule = mutation({
  args: { ruleDocId: v.id("rules"), actor: human, autopilot: v.optional(v.boolean()), consoleKey },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, a) => (isConsole(a.consoleKey) ? doApproveRule(ctx, a.ruleDocId, a.actor, !!a.autopilot) : CONSOLE_REFUSAL),
});

async function doApproveRule(ctx: MutationCtx, ruleDocId: Id<"rules">, actor: Role, autopilot: boolean): Promise<string | null> {
  const rule = await ctx.db.get(ruleDocId);
  if (!rule) return "Rule not found";
  const r = await transition(ctx, { table: "rules", id: ruleDocId as Id<ItemTable>, action: "approve", actor, month: rule.learnedInMonth ?? 0, reason: autopilot ? "Approved by autopilot for a hands-free recording" : "Approved after reading the backtest", patch: { approvedBy: actor } });
  if (!r.ok) return r.denial;
  if (rule.ruleId === "r8") {
    await afterword(ctx, STORY_A_KEY, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `r8 approved by the CFO. The engine re-runs the held school fees under r8.` });
    const close = await getClose(ctx);
    if (close?.run?.pausedFor === "A") await resume(ctx, { storyKey: STORY_A_KEY, ruleId: "r8" });
  }
  return null;
}

// Hands-free recording: answers exactly what a person would, labelled as autopilot in the record.
export const autopilotTick = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const close = await getClose(ctx);
    const run = close?.run;
    if (!run || !run.autopilot || !run.pausedFor) return null;
    const key = run.pausedFor === "A" ? STORY_A_KEY : STORY_B_KEY;
    const q = await ctx.db.query("questions").withIndex("by_story", (x) => x.eq("storyKey", key)).first();
    let acted = false;
    if (q && q.state === "NEEDS_INFO" && q.options.length) { await doAnswer(ctx, q._id, run.pausedFor === "A" ? "receipts" : "yes", q.askOf, true); acted = true; }
    else if (q && q.state === "PROPOSED") { await doConfirm(ctx, q._id, q.askOf, true); acted = true; }
    else if (run.pausedFor === "A") {
      const r8 = await ctx.db.query("rules").withIndex("by_ruleId", (x) => x.eq("ruleId", "r8")).first();
      if (r8 && r8.state === "PROPOSED" && r8.audit) { await doApproveRule(ctx, r8._id, "cfo", true); acted = true; }
    }
    void acted;
    const after = await getClose(ctx);
    if (after?.run?.pausedFor) await ctx.scheduler.runAfter(2500, internal.humans.autopilotTick, {});
    return null;
  },
});

export const storeLabel = (s: string | null) => (s ? STORE_BY_CODE[s]?.name ?? s : "");
