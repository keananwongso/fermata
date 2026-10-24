// The Learner turning the Accountant's correction into r8, and its backtest on last year. The case rooms
// (roomAgents.ts) hold the agents' meetings; when the Learner drafted r8 there, that draft is used here.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { transition } from "./lib/transition";
import { parseMemo } from "./lib/engineCore";
import { validateRuleProgram, type RuleProgram } from "./lib/rules";
import { LAST_YEAR, addDays } from "./lib/domain";
import { num, pct } from "./lib/format";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

async function claude(system: string, user: string, maxTokens = 1500): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the Convex deployment");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { content: { type: string; text?: string }[]; stop_reason?: string };
  const text = body.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (!text) throw new Error(`Claude returned no text (stop reason: ${body.stop_reason ?? "unknown"}, blocks: ${body.content.map((c) => c.type).join(",")})`);
  return text;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON in Claude's reply");
  return JSON.parse(text.slice(start, end + 1));
}

// ---------------- Learner writes r8 ----------------

export const backtestPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ rows: v.array(v.object({ va: v.string(), receipt: v.string(), truth: v.string() })), cursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, a) => {
    const page = await ctx.db.query("bank_transactions").withIndex("by_account_date", (q) => q.eq("account", "SCHOOL_VA").gte("date", `${LAST_YEAR}-01-01`).lte("date", `${LAST_YEAR}-12-31`)).paginate({ cursor: a.cursor, numItems: 700 });
    const rows = [];
    for (const b of page.page) {
      if (!b.memo.startsWith("VA ")) continue;
      const p = parseMemo({ ...b, account: b.account as never });
      if (!p.student) continue;
      const recs = await ctx.db.query("school_receipts").withIndex("by_student_date", (q) => q.eq("studentRef", p.student!).gte("date", addDays(b.date, -3)).lte("date", addDays(b.date, 3))).take(20);
      const rec = recs.find((r) => r.amount === b.amount && r.year === LAST_YEAR);
      if (!rec) continue;
      rows.push({ va: p.subStore ?? "", receipt: rec.store, truth: b.truth.store ?? "" });
    }
    return { rows, cursor: page.isDone ? null : page.continueCursor };
  },
});

export const learnRuleR8 = internalAction({
  args: { storyKey: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const system = "You are the Learner inside Fermata. You turn a person's correction into a rule: a small JSON program the engine interprets. " +
      "You never approve rules; the CFO does after a backtest. Reply with JSON only.";
    const user = `Correction: the Accountant said 1,186 school fee payments paid into Store 3's virtual accounts belong to Store 11, because the school's receipts (same student, same amount) are at Store 11. The bank's virtual account range is stale when students change branch.

Write the rule program. Schema:
{"id": "r8", "version": 1, "title": string (sentence case, under 60 chars), "channels": ["school_va"],
 "match": one of "follow_receipt" (place a school payment at the store on the school's receipt when it disagrees with the virtual account) or other kinds that do not apply here,
 "params": {"receiptWeight": number between 0.5 and 0.9, "subAccountWeight": number below 0.2},
 "limitIdr": a per-payment limit in rupiah, above every school fee (fees are Rp 450,000 to Rp 1,750,000)}
Also add a top-level key "why": one sentence for the CFO. Return one JSON object.`;
    let program: RuleProgram;
    let why = "";
    let real = true;
    const drafted: string | null = await ctx.runQuery(internal.roomAgents.roomDraftRule, { storyKey: a.storyKey });
    try {
      const raw = (drafted ? { ...JSON.parse(drafted), why: "Drafted by the Learner in the case room, before the Accountant was asked." } : extractJson(await claude(system, user, 800))) as Record<string, unknown>;
      why = typeof raw.why === "string" ? raw.why : "";
      const val = validateRuleProgram({ ...raw, id: "r8" });
      if (!val.ok) throw new Error(val.error);
      if (val.rule.match !== "follow_receipt" || !val.rule.channels.includes("school_va")) throw new Error("program does not follow receipts for school payments");
      program = { ...val.rule, id: "r8", version: 1 };
    } catch (err) {
      real = false;
      why = `Claude unavailable or invalid (${String(err).slice(0, 80)}); scripted fallback program.`;
      program = { id: "r8", version: 1, title: "Follow the school's receipts", channels: ["school_va"], match: "follow_receipt", params: { receiptWeight: 0.7, subAccountWeight: 0.05 }, limitIdr: 5_000_000 };
    }
    // Backtest on last year's school payments.
    let cursor: string | null = null;
    let covered = 0, correct = 0, total = 0;
    const examples: string[] = [];
    do {
      const page: { rows: { va: string; receipt: string; truth: string }[]; cursor: string | null } = await ctx.runQuery(internal.agents.backtestPage, { cursor });
      for (const r of page.rows) {
        total++;
        if (r.va === r.receipt) continue;
        covered++;
        if (r.receipt === r.truth) correct++;
        else if (examples.length < 7) examples.push(`virtual account ${r.va}, receipt ${r.receipt}, last year booked at ${r.truth}`);
      }
      cursor = page.cursor;
    } while (cursor);
    await ctx.runMutation(internal.agents.writeR8, { programJson: JSON.stringify(program), why, real, covered, correct, total, examples, storyKey: a.storyKey });
    return null;
  },
});

export const writeR8 = internalMutation({
  args: { programJson: v.string(), why: v.string(), real: v.boolean(), covered: v.number(), correct: v.number(), total: v.number(), examples: v.array(v.string()), storyKey: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const program = JSON.parse(a.programJson) as RuleProgram;
    const month = 3;
    const now = Date.now();
    const errors = a.covered - a.correct;
    const precision = a.covered ? a.correct / a.covered : 0;
    const c = await transition(ctx, {
      table: "rules", id: null, action: "create", actor: "learner", month, reason: a.real ? "Written by Claude from the Accountant's correction" : "Scripted fallback",
      insert: { ruleId: "r8", version: 1, title: program.title, program: a.programJson, origin: "Accountant's correction of 1,186 school fees (March)", proposer: "learner", settledCount: 0, learnedInMonth: month, real: a.real }, patch: {},
    });
    if (!c.ok) return null;
    await ctx.db.insert("trace_events", { agent: "learner", month, ruleId: "r8", storyKey: a.storyKey, kind: "result", text: `rule written${a.real ? " by Claude" : " (fallback)"}: ${program.title}. ${a.why}`, real: a.real, at: now });
    await transition(ctx, {
      table: "rules", id: c.id, action: "propose", actor: "learner", month, reason: "Backtested on last year's school payments",
      patch: { backtest: { covered: a.covered, correct: a.correct, errors, precision, coverage: a.total ? a.covered / a.total : 0, scope: `last year's ${num(a.total)} school payments with a receipt`, examples: a.examples } },
    });
    await ctx.db.insert("trace_events", { agent: "learner", month, ruleId: "r8", kind: "tool", text: `backtest on last year: covers ${num(a.covered)}, correct ${num(a.correct)}, precision ${pct(precision)}, ${errors} errors`, real: true, at: now + 1 });
    const note = errors ? `Found ${errors} counterexamples last year where the receipt was keyed at the wrong store. Not enough to block; flagged so the CFO sees them.` : "No counterexamples found.";
    await transition(ctx, { table: "rules", id: c.id, action: errors ? "flag" : "annotate", actor: "auditor", month, reason: "Searched last year for counterexamples", patch: { audit: { result: errors ? "flag" : "pass", note, counterexamples: errors, real: false } } });
    await ctx.db.insert("trace_events", { agent: "auditor", month, ruleId: "r8", kind: "result", text: note, real: false, at: now + 2 });
    await ctx.db.insert("trace_events", { agent: "cfo", month, ruleId: "r8", kind: "decision", text: "waiting for the CFO to approve r8", real: true, at: now + 3 });
    return null;
  },
});
