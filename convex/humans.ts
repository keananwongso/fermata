// What people do: answer a question, confirm the restated answer, approve a rule.
// The acting role comes from the header switch; transition() still decides what that role may do.
import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { continueClose, getClose, resume } from "./run";
import { afterword, markRoomClosed } from "./rooms";
import { answerKey, autopilotOption, learnByCode, RULE_ANSWER, storyShape } from "./codeLearner";
import { transition, type ItemTable, type Role } from "./lib/transition";
import { MONTH_LABELS, STORE_BY_CODE, addDays, type StoreCode } from "./lib/domain";
import { parseMemo } from "./lib/engineCore";
import { rpShort, num } from "./lib/format";
import { validateRuleProgram, type RuleProgram } from "./lib/rules";
import { CONSOLE_REFUSAL, consoleKey, isConsole } from "./lib/console";
import { scenarioLenderAnswer } from "./scenario";

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
  // A scenario's new lender is decided like story B (scenario.ts); its other stories follow the paths below.
  if (story.scenario && story.gap === "unknown_lender") return await scenarioLenderAnswer(ctx, story, ans, actor);
  // What follows an answer depends on the story's shape (codeLearner.ts), not on which month or story it is.
  const shape = storyShape(story);
  const rulesNow = await ctx.db.query("rules").take(200);
  const hasRule = (id: string) => rulesNow.some((r) => r.ruleId === id && !r.scenario);
  if (shape === "receipt_elsewhere") {
    if (ans === "receipts" && !hasRule("r8")) {
      await ctx.db.patch(story._id, { learning: "r8" });
      await ctx.db.insert("trace_events", { agent: "learner", month: runMonth, storyKey: story.key, ruleId: "r8", kind: "tool", text: `The Accountant corrected ${num(story.count)} placements. Writing a rule from the correction with Claude.`, real: true, at: Date.now() });
      const first = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", story.key)).first();
      const receipt = typeof first?.facts?.receiptStore === "string" ? first.facts.receiptStore : null;
      await ctx.scheduler.runAfter(0, internal.agents.learnRuleR8, { storyKey: story.key, month: runMonth, count: story.count, vaStore: storeLabel(story.store), receiptStore: receipt ? storeLabel(receipt) : undefined });
      return;
    }
    await settleStoryByPerson(ctx, story, actor, runMonth, ans === "bank" ? "Booked where the bank placed them, by the Accountant" : null);
    return await continueClose(ctx);
  }
  if (shape === "new_lender") {
    if (ans === "yes" && !hasRule("r9")) return await proposeAndApproveR9(ctx, story, actor, runMonth);
    await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month: runMonth, reason: ans === "no" ? "Not ours: stays held" : "Unknown: stays held", patch: { resolution: ans === "no" ? "Not a partner. All payouts stay held." : ans === "yes" ? "Already covered by an approved lender rule." : "Not known yet. All payouts stay held." } });
    return await continueClose(ctx);
  }
  if (shape === "after_reversed_voucher" || shape === "credit_without_bills") {
    if (ans === RULE_ANSWER[shape].option) await learnByCode(ctx, story, shape, actor, runMonth);
    else {
      const text = ans === "unsure" ? "Not known yet. Kept held and asked the CFO." : "Kept held.";
      await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month: runMonth, reason: text, patch: { resolution: text } });
    }
    return await continueClose(ctx);
  }
  const settleAnswers = ["petty", "settle", "receipts"];
  if (settleAnswers.includes(ans)) await settleStoryByPerson(ctx, story, actor, runMonth, null);
  else {
    const text = story.gap === "no_store_record" && ans === "not_ours" ? "Not ours. Kept held and never booked as income." : "Kept held.";
    await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month: runMonth, reason: text, patch: { resolution: text } });
  }
  await continueClose(ctx);
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
  const lender = story.counterparty;
  // The rule the Learner drafted in the case room, if it is a valid lender rule for this lender; otherwise the scripted one.
  const drafted = (await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", story.key)).order("desc").take(200)).find((m) => m.speaker === "learner" && m.code)?.code;
  const fromRoom = drafted ? validateRuleProgram(JSON.parse(drafted)) : null;
  const realRule = !!fromRoom?.ok && fromRoom.rule.match === "lender_sale" && !!fromRoom.rule.params.lenders?.[lender];
  const program: RuleProgram = realRule && fromRoom?.ok ? { ...fromRoom.rule, id: "r9", version: 1 } : { id: "r9", version: 1, title: `${lender} payout minus its 3.8% cut`, channels: ["lender"], match: "lender_sale", params: { lenders: { [lender]: 0.038 }, windowDays: 7 }, limitIdr: 1_000_000_000 };
  // Backtest on this year's held payouts: does a sale at the rule's cut above each payout exist at its store?
  const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", story.key)).take(1000);
  let covered = 0;
  let coveredAmount = 0;
  const cut = program.params.lenders![lender];
  const win = program.params.windowDays ?? 7;
  const used = new Set<string>();
  for (const it of items) {
    const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
    if (!b) continue;
    const p = parseMemo({ ...b, account: b.account as never });
    if (!p.subStore) continue;
    const sales = await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", p.subStore as StoreCode).eq("kind", "installment_sale").gte("date", addDays(b.date, -win)).lte("date", addDays(b.date, -1))).take(100);
    const hit = sales.find((s) => s.lender === lender && !used.has(s.key) && Math.round((s.amount ?? 0) * (1 - cut)) === b.amount);
    if (hit) { covered++; coveredAmount += b.amount; used.add(hit.key); }
  }
  const pctCut = `${(cut * 100).toFixed(2).replace(/0$/, "")}%`;
  const c = await transition(ctx, {
    table: "rules", id: null, action: "create", actor: "learner", month, reason: `The CFO confirmed ${lender} is a financing partner`,
    insert: { ruleId: "r9", version: 1, title: program.title, program: JSON.stringify(program), origin: `CFO answer on the ${lender} story (${MONTH_LABELS[month - 1]})`, proposer: "learner", settledCount: 0, learnedInMonth: month, real: realRule }, patch: {},
  });
  if (!c.ok) return;
  await transition(ctx, {
    table: "rules", id: c.id, action: "propose", actor: "learner", month, reason: `No ${lender} history last year, so backtested on this year's held payouts`,
    patch: { backtest: { covered, correct: covered, errors: 0, precision: 1, coverage: items.length ? covered / items.length : 0, scope: `this year's ${items.length} held ${lender} payouts (no ${lender} last year)`, examples: [] } },
  });
  await transition(ctx, { table: "rules", id: c.id, action: "annotate", actor: "auditor", month, reason: "Looked for counterexamples", patch: { audit: { result: "pass", note: `${items.length - covered} payouts match no ${lender} sale and stay held. No payout matches two sales.`, counterexamples: 0, real: false } } });
  const ap = await transition(ctx, { table: "rules", id: c.id, action: "approve", actor, month, reason: `Confirmed back: ${lender} is a new financing partner`, patch: { approvedBy: actor } });
  if (!ap.ok) return;
  await afterword(ctx, story.key, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `r9 approved by the CFO${realRule ? ", as the Learner drafted it in this room" : ""}. The engine now re-runs the held payouts under r9: ${num(covered)} match a sale, ${num(items.length - covered)} stay held.` });
  await ctx.db.insert("trace_events", { agent: "learner", month, ruleId: "r9", storyKey: story.key, kind: "result", text: `r9 ${realRule ? "drafted by the Learner in the case room" : "written (scripted program)"}. Backtest: ${covered} of ${items.length} held payouts match a ${lender} sale at ${pctCut}.`, real: realRule, at: Date.now() });
  await transition(ctx, { table: "stories", id: story._id as Id<ItemTable>, action: "propose", actor: "investigator", month, reason: "Settle under r9", patch: { proposer: "investigator", resolution: `r9 settles ${num(covered)} payouts (${rpShort(coveredAmount)}). ${num(items.length - covered)} match no sale and stay held.` } });
  const close = await getClose(ctx);
  if (close?.run?.pausedFor) await resume(ctx, { ruleId: "r9" });
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
  if (rule.scenario) return null;
  // The story whose answer taught this rule stops waiting; the year's held lines re-run under it.
  const from = (await ctx.db.query("stories").take(400)).filter((s) => s.learning === rule.ruleId);
  for (const s of from) {
    await ctx.db.patch(s._id, { learning: undefined });
    await afterword(ctx, s.key, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `${rule.ruleId} approved by the CFO. The engine re-runs the year's held lines under ${rule.ruleId}.` });
  }
  const close = await getClose(ctx);
  if (close?.run?.pausedFor) await resume(ctx, { ruleId: rule.ruleId });
  return null;
}

// Hands-free recording: answers what a person would, read from the generator's answer key, labelled as autopilot in
// the record. One step per tick: approve a rule waiting for the CFO, confirm an answer, or answer the next question at
// this close (stories that could teach a rule first, largest first). When nothing is left, the close carries on.
export const autopilotTick = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const close = await getClose(ctx);
    const run = close?.run;
    if (!run || !run.autopilot || !run.pausedFor) return null;
    const again = async () => { const after = await getClose(ctx); if (after?.run?.pausedFor) await ctx.scheduler.runAfter(1500, internal.humans.autopilotTick, {}); return null; };
    const rule = (await ctx.db.query("rules").take(200)).find((x) => !x.scenario && x.learnedInMonth && x.state === "PROPOSED" && x.audit);
    if (rule) { await doApproveRule(ctx, rule._id, "cfo", true); return await again(); }
    const stories = (await ctx.db.query("stories").take(400)).filter((s) => !s.scenario && s.month <= run.month && !s.learning);
    const open: { s: Doc<"stories">; q: Doc<"questions"> }[] = [];
    for (const s of stories) {
      const q = await ctx.db.query("questions").withIndex("by_story", (x) => x.eq("storyKey", s.key)).first();
      if (q && (q.state === "NEEDS_INFO" || q.state === "PROPOSED")) open.push({ s, q });
    }
    const answered = open.find((o) => o.q.state === "PROPOSED");
    if (answered) { await doConfirm(ctx, answered.q._id, answered.q.askOf, true); return await again(); }
    open.sort((a, b) => Number(!!storyShape(b.s)) - Number(!!storyShape(a.s)) || b.s.count - a.s.count);
    const next = open[0];
    if (next) {
      const option = autopilotOption(next.s, next.q, await answerKey(ctx, next.s));
      await doAnswer(ctx, next.q._id, option, next.q.askOf, true);
      return await again();
    }
    await continueClose(ctx);
    return await again();
  },
});

export const storeLabel = (s: string | null) => (s ? STORE_BY_CODE[s]?.name ?? s : "");
