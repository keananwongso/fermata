// Story shapes, the answer key, and the Learner as code. A story's shape is read from its evidence when it opens:
// which person's answer could teach a rule, and which rule. Two shapes meet live with Claude (receipts elsewhere, a new
// lender; see roomAgents.ts). For the other two the Learner is plain code (lib/learn.ts, the same code the offline
// simulator runs), labelled code in the room and on the rule. Every rule waits for the CFO before it settles anything.
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { approvedRules, convexPort, strip } from "./engine";
import { afterword } from "./rooms";
import { MONTH_LABELS, YEAR, addDays, monthEnd, weekday, type StoreCode } from "./lib/domain";
import { parseMemo, type EngineTxn } from "./lib/engineCore";
import { answerKind, fitReversedVoucher, fitSchoolBills, type Draft, type Kind } from "./lib/learn";
import { num, pct } from "./lib/format";
import { transition, type ItemTable, type Role } from "./lib/transition";

export type Shape = "receipt_elsewhere" | "new_lender" | "after_reversed_voucher" | "credit_without_bills";
// The answer that teaches each shape's rule, and the rule it teaches.
export const RULE_ANSWER: Record<Shape, { option: string; ruleId: string; kind: Kind }> = {
  receipt_elsewhere: { option: "receipts", ruleId: "r8", kind: "school_moved" },
  new_lender: { option: "yes", ruleId: "r9", kind: "new_lender" },
  after_reversed_voucher: { option: "voucher", ruleId: "r11", kind: "cash_reversal" },
  credit_without_bills: { option: "advance", ruleId: "r10", kind: "school_advance" },
};
const MATCH: Record<string, string> = { r10: "school_bills", r11: "reversed_voucher" };

async function heldItems(ctx: QueryCtx, storyKey: string) {
  return (await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", storyKey)).take(1500)).filter((i) => i.state === "HELD");
}
async function bankLine(ctx: QueryCtx, ref: string) {
  return await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", ref)).first();
}

// Read from the evidence when the story opens. Short cash deposits are this shape only when most of them follow a day
// whose cash voucher was posted and then reversed (the cash book says so).
export async function shapeOf(ctx: QueryCtx, s: Doc<"stories">): Promise<Shape | null> {
  if (s.scenario) return null;
  if (s.gap === "placement_conflict" && s.channel === "school_va") return "receipt_elsewhere";
  if (s.gap === "unknown_lender") return "new_lender";
  if (s.gap === "counterpart_missing" && s.channel === "school_va") return "credit_without_bills";
  if (s.gap === "short_deposit" && s.channel === "cash") {
    const items = (await heldItems(ctx, s.key)).slice(0, 12);
    let after = 0;
    for (const it of items) {
      const b = await bankLine(ctx, it.ref);
      const p = b ? parseMemo(strip(b)) : null;
      if (!b || !p?.subStore) continue;
      const covered = weekday(b.date) === 1 ? [addDays(b.date, -3), addDays(b.date, -2), addDays(b.date, -1)] : [addDays(b.date, -1)];
      for (const d of covered) {
        const r = await ctx.db.query("cash_book").withIndex("by_store_date", (q) => q.eq("store", p.subStore as StoreCode).eq("date", d)).first();
        if (r?.reversed && r.year === YEAR) { after++; break; }
      }
    }
    if (items.length && after * 2 >= items.length) return "after_reversed_voucher";
  }
  return null;
}

// Stories opened before shapes were recorded fall back to the two narrated keys.
export function storyShape(s: Doc<"stories">): Shape | null {
  if (s.shape) return s.shape as Shape;
  if (s.scenario) return null;
  if (s.gap === "placement_conflict" && s.channel === "school_va") return "receipt_elsewhere";
  if (s.gap === "unknown_lender") return "new_lender";
  return null;
}

// The answer key: the planted cause behind most of the story's lines (the generator's story tags). Read only by the
// autopilot, which answers as the person would; the engine and the agents never see it.
export async function answerKey(ctx: QueryCtx, s: Doc<"stories">): Promise<Kind | null> {
  const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", s.key)).take(1500);
  const tags: (string | null)[] = [];
  for (const it of items) tags.push((await bankLine(ctx, it.ref))?.truth.story ?? null);
  return answerKind(tags).kind;
}

// The option the autopilot picks. A learnable cause takes the answer that teaches its rule. A one-off takes the answer
// a person gives for a one-off: settle it by decision, with no rule (petty cash still in the store, for story C), or
// keep it held where the money is not ours (story D) or the lender unknown.
export function autopilotOption(s: Doc<"stories">, q: Doc<"questions">, kind: Kind | null): string {
  const ids = q.options.map((o) => o.id);
  const shape = storyShape(s);
  if (kind && shape && RULE_ANSWER[shape].kind === kind && ids.includes(RULE_ANSWER[shape].option)) return RULE_ANSWER[shape].option;
  for (const id of ["settle", "petty", "not_ours", "no", "hold"]) if (ids.includes(id)) return id;
  return ids[ids.length - 1];
}

const who = (actor: Role) => (actor === "cfo" ? "CFO" : "Accountant");

// The Learner as code, for the shapes whose rule is fitted from data: every open story of this shape's gap and channel
// (not one store's), fitted, backtested, then proposed for the CFO. Nothing settles until the CFO approves.
export async function learnByCode(ctx: MutationCtx, story: Doc<"stories">, shape: Shape, actor: Role, month: number): Promise<void> {
  const ruleId = RULE_ANSWER[shape].ruleId;
  const sid = story._id as Id<ItemTable>;
  const { programs } = await approvedRules(ctx);
  const existing = programs.find((p) => p.match === MATCH[ruleId]);
  if (existing) return await coveredByRule(ctx, story, existing.id, actor, month);

  const all = (await ctx.db.query("stories").take(300)).filter((s) => !s.scenario && s.gap === story.gap && s.channel === story.channel && (s.key === story.key || s.state === "NEEDS_INFO"));
  const lines: EngineTxn[] = [];
  const stores = new Set<StoreCode>();
  for (const s of all) {
    if (storyShape(s) === shape) for (const st of s.stores) stores.add(st as StoreCode);
    for (const it of await heldItems(ctx, s.key)) { const b = await bankLine(ctx, it.ref); if (b) lines.push(strip(b)); }
  }
  const asOf = monthEnd(YEAR, Math.min(month, 12));
  const port = convexPort(ctx, asOf, YEAR, new Map());
  const fc = { port, rules: programs, asOf };
  const draft: Draft = ruleId === "r11" ? await fitReversedVoucher(fc, lines, [...stores].sort()) : await fitSchoolBills(fc, lines);
  const scope = `${num(lines.length)} held lines in ${all.length} ${all.length === 1 ? "story" : "stories"}`;
  await ctx.db.insert("trace_events", { agent: "learner", month, storyKey: story.key, ruleId, kind: "tool", text: `Fitting ${ruleId} in code from ${scope}, after the ${who(actor)}'s answer.`, real: true, at: Date.now() });

  if ("why" in draft || !draft.backtest.pass) {
    const why = "why" in draft ? draft.why : `the backtest failed (${draft.backtest.notes.join("; ")})`;
    await ctx.db.patch(story._id, { learning: undefined });
    await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month, reason: `No rule: ${why}`, patch: { resolution: `The Learner could not fit ${ruleId}: ${why}. The lines stay held.` } });
    await afterword(ctx, story.key, { speaker: "learner", to: "room", source: "code", text: `Could not fit ${ruleId} from ${scope}: ${why}. No rule is proposed; the lines stay held.` });
    return;
  }
  const { program, backtest: bt, fit } = draft;
  const precision = bt.covered + bt.wrong ? bt.covered / (bt.covered + bt.wrong) : 0;
  const c = await transition(ctx, {
    table: "rules", id: null, action: "create", actor: "learner", month, reason: `Fitted in code from the ${who(actor)}'s answer`,
    insert: { ruleId, version: program.version, title: program.title, program: JSON.stringify(program), origin: `${who(actor)}'s answer on ${story.title} (${MONTH_LABELS[month - 1]}), fitted in code`, proposer: "learner", settledCount: 0, learnedInMonth: month, real: false, fittedBy: "code" }, patch: {},
  });
  if (!c.ok) return;
  await transition(ctx, {
    table: "rules", id: c.id, action: "propose", actor: "learner", month, reason: `Backtested on ${bt.scope}`,
    patch: { backtest: { covered: bt.covered, correct: bt.covered, errors: bt.wrong, precision, coverage: bt.of ? bt.covered / bt.of : 0, scope: bt.scope, examples: bt.notes } },
  });
  const note = `${bt.wrong ? `${bt.wrong} counterexamples.` : "No counterexamples."} ${bt.notes.join(". ")}.`;
  await transition(ctx, { table: "rules", id: c.id, action: bt.wrong ? "flag" : "annotate", actor: "auditor", month, reason: "Checked the backtest", patch: { audit: { result: bt.wrong ? "flag" : "pass", note, counterexamples: bt.wrong, real: false } } });
  await ctx.db.patch(story._id, { learning: ruleId });
  await ctx.db.insert("trace_events", { agent: "learner", month, ruleId, storyKey: story.key, kind: "result", text: `${ruleId} fitted in code: ${fit}. Backtest: covers ${num(bt.covered)} of ${num(bt.of)}, ${bt.wrong} wrong.`, real: true, at: Date.now() });
  await ctx.db.insert("trace_events", { agent: "cfo", month, ruleId, kind: "decision", text: `waiting for the CFO to approve ${ruleId}`, real: true, at: Date.now() + 1 });
  await afterword(ctx, story.key, {
    speaker: "learner", to: "auditor", source: "code", code: JSON.stringify(program, null, 2),
    text: `Fitted ${ruleId} in code from ${scope}: ${fit}. Backtest: covers ${num(bt.covered)} of ${num(bt.of)}, ${bt.wrong} wrong.`,
    tools: [{ name: "backtest_rule", input: `${ruleId} on ${bt.scope}`, rows: [["Covered", `${num(bt.covered)} of ${num(bt.of)}`], ["Wrong", String(bt.wrong)], ["Precision", pct(precision)], ...bt.notes.map((n) => ["Note", n])] }],
  });
  await afterword(ctx, story.key, { speaker: "auditor", to: "room", source: "code", text: `${note} Ready for the CFO to approve.` });
}

// A later story of a shape whose rule is already approved: its lines were re-run under that rule when it was approved.
async function coveredByRule(ctx: MutationCtx, story: Doc<"stories">, ruleId: string, actor: Role, month: number) {
  const sid = story._id as Id<ItemTable>;
  const left = (await heldItems(ctx, story.key)).length;
  const text = left ? `Same pattern as ${ruleId}. ${num(left)} lines still do not fit it and stay held.` : `Same pattern as ${ruleId}, which settled these lines when the CFO approved it.`;
  if (left) {
    await transition(ctx, { table: "stories", id: sid, action: "hold", actor, month, reason: text, patch: { resolution: text } });
  } else {
    const p = await transition(ctx, { table: "stories", id: sid, action: "propose", actor: "investigator", month, reason: `Covered by ${ruleId}`, patch: { proposer: "investigator" } });
    if (p.ok) {
      await transition(ctx, { table: "stories", id: sid, action: "approve", actor, month, reason: "Approved", patch: {} });
      await transition(ctx, { table: "stories", id: sid, action: "post", actor: "gateway", month, reason: "Story closed", patch: { resolution: text } });
    }
  }
  await afterword(ctx, story.key, { speaker: "manager", to: "room", kind: "manager", source: "code", text });
}
