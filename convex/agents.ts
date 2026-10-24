// The three Claude agents. Real Claude calls: the Investigator on story B and the Learner writing r8.
// Everything else the agents "say" is scripted and labelled so in trace_events (real: false).
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { transition, type ItemTable } from "./lib/transition";
import { parseMemo } from "./lib/engineCore";
import { validateRuleProgram, type RuleProgram } from "./lib/rules";
import { LAST_YEAR, addDays, type StoreCode } from "./lib/domain";
import { num, rpShort, pct } from "./lib/format";

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

// ---------------- Investigator on story B ----------------

export const storyBEvidence = internalQuery({
  args: { storyKey: v.string() },
  returns: v.object({
    count: v.number(), amount: v.number(), stores: v.number(), matched: v.number(), matchedAmount: v.number(), orphans: v.number(),
    impliedCuts: v.array(v.number()), knownLenders: v.string(), examples: v.array(v.string()), firstDate: v.string(), lastDate: v.string(),
  }),
  handler: async (ctx, a) => {
    const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", a.storyKey)).take(1000);
    const stores = new Set<string>();
    let amount = 0, matched = 0, matchedAmount = 0;
    const cuts: number[] = [];
    const examples: string[] = [];
    let firstDate = "9999", lastDate = "0000";
    const rows: { b: { date: string; memo: string; amount: number }; sales: { amount: number; date: string; key: string }[] }[] = [];
    for (const it of items) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (!b) continue;
      amount += b.amount;
      if (b.date < firstDate) firstDate = b.date;
      if (b.date > lastDate) lastDate = b.date;
      const p = parseMemo({ ...b, account: b.account as never });
      if (p.subStore) stores.add(p.subStore);
      const sales = p.subStore ? await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", p.subStore as StoreCode).eq("kind", "installment_sale").gte("date", addDays(b.date, -7)).lte("date", addDays(b.date, -1))).take(100) : [];
      const fz = sales.filter((s) => s.lender === "FIN_Z").map((s) => ({ amount: s.amount ?? 0, date: s.date, key: s.key }));
      rows.push({ b, sales: fz });
      for (const s of fz) { const c = Math.round((1 - b.amount / s.amount) * 1000) / 1000; if (c > 0 && c < 0.1) cuts.push(c); }
    }
    // The most common implied cut, then an exact rupiah check against it.
    const hist: Record<string, number> = {};
    for (const c of cuts) hist[c.toFixed(3)] = (hist[c.toFixed(3)] ?? 0) + 1;
    const ranked = Object.entries(hist).sort((x, y) => y[1] - x[1]);
    const mode = ranked.length ? Number(ranked[0][0]) : 0;
    const used = new Set<string>();
    for (const r of rows) {
      const hit = r.sales.find((s) => !used.has(s.key) && Math.round(s.amount * (1 - mode)) === r.b.amount);
      if (hit) { used.add(hit.key); matched++; matchedAmount += r.b.amount; if (examples.length < 4) examples.push(`${r.b.date} ${r.b.memo}: payout ${r.b.amount}, FIN_Z installment sale ${hit.amount} on ${hit.date} at the same store`); }
      else if (examples.length < 6) examples.push(`${r.b.date} ${r.b.memo}: payout ${r.b.amount}, no FIN_Z sale at that store matches it exactly`);
    }
    const top = ranked.filter(([, n]) => n >= cuts.length * 0.05).slice(0, 3).map(([k]) => Number(k));
    const rules = await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", "r7")).first();
    const known = rules ? JSON.stringify((JSON.parse(rules.program) as RuleProgram).params.lenders) : "{}";
    return { count: items.length, amount, stores: stores.size, matched, matchedAmount, orphans: items.length - matched, impliedCuts: top, knownLenders: known, examples, firstDate, lastDate };
  },
});

export const investigateStoryB = internalAction({
  args: { storyKey: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const e = await ctx.runQuery(internal.agents.storyBEvidence, { storyKey: a.storyKey });
    const system = "You are the Investigator inside Fermata, an autonomous cash reconciliation system for a fictional Indonesian music retailer. " +
      "You never approve or post anything. You build the evidence for one story of held bank transactions, explain your reasoning in short plain steps, " +
      "and write exactly one question for the one person who can answer it (the Accountant for bookkeeping facts, the CFO for business relationships and policy). " +
      "Voice: calm, plainspoken, sentence case, no emoji, no exclamation marks. Money in rupiah like 'Rp 9.8bn' or 'Rp 412m'. Reply with JSON only.";
    const user = `Story: ${num(e.count)} bank credits on the lender channel from "FIN_Z", ${e.firstDate} to ${e.lastDate}, total ${rpShort(e.amount)}, across ${e.stores} stores.
Known lenders in approved rule r7 (lender: cut): ${e.knownLenders}. FIN_Z is not among them and did not appear last year.
Evidence from the books: ${num(e.matched)} of the payouts have an installment sale booked with lender FIN_Z at the same store 1 to 7 days earlier. Most common implied cut (1 - payout / sale), then checked to the rupiah: ${e.impliedCuts.join(", ")}.
${num(e.orphans)} payouts match no FIN_Z sale.
Examples:
${e.examples.join("\n")}

Return JSON with these keys:
"steps": 4 to 6 short reasoning lines (lower case is fine),
"summary": two sentences of evidence,
"hypothesis": one sentence,
"ask_of": "cfo" or "accountant",
"question": the single question, under 20 words,
"options": exactly three objects {"id","label","impact"} with ids "yes", "no", "unsure"; labels like "Yes", "No, not ours", "I don't know"; each impact says concretely what Fermata will do (counts and rupiah).`;
    let parsed: { steps: string[]; summary: string; hypothesis: string; ask_of: string; question: string; options: { id: string; label: string; impact: string }[] };
    let real = true;
    try {
      let reply: string;
      try { reply = await claude(system, user, 4000); }
      catch (first) {
        // One retry without the example lines if the model declines.
        if (!String(first).includes("refusal")) throw first;
        reply = await claude(system, user.replace(/Examples:[\s\S]*?\n\nReturn JSON/, "Return JSON"), 4000);
      }
      try { parsed = extractJson(reply) as typeof parsed; } catch { throw new Error(`unreadable reply: ${reply.slice(0, 120)}`); }
      if (!Array.isArray(parsed.options) || parsed.options.length !== 3 || !parsed.question) throw new Error("Claude's reply is missing fields");
    } catch (err) {
      real = false;
      parsed = {
        steps: [`claude unavailable (${String(err).slice(0, 80)}), using the scripted fallback`, `${e.matched} of ${e.count} payouts sit 3.8% below a FIN_Z installment sale`, "FIN_Z is not in r7", "this is a business relationship question, so ask the CFO"],
        summary: `${num(e.matched)} payouts are each 3.8% below an installment sale booked with FIN_Z. ${num(e.orphans)} match no sale.`,
        hypothesis: "FIN_Z is a new financing partner taking a 3.8% cut.", ask_of: "cfo", question: "Is FIN_Z a new financing partner?",
        options: [
          { id: "yes", label: "Yes", impact: `Writes rule r9 and settles ${num(e.matched)} payouts (${rpShort(e.matchedAmount)}). ${e.orphans} stay held.` },
          { id: "no", label: "No, not ours", impact: `Keeps all ${num(e.count)} held.` },
          { id: "unsure", label: "I don't know", impact: `Keeps all ${num(e.count)} held and asks the Accountant to check contracts.` },
        ],
      };
    }
    await ctx.runMutation(internal.agents.writeStoryB, { storyKey: a.storyKey, real, steps: parsed.steps.slice(0, 8), summary: parsed.summary, hypothesis: parsed.hypothesis, askOf: parsed.ask_of === "accountant" ? "accountant" : "cfo", question: parsed.question, options: parsed.options.slice(0, 3).map((o) => ({ id: o.id, label: o.label, impact: o.impact })), matched: e.matched, orphans: e.orphans });
    return null;
  },
});

export const writeStoryB = internalMutation({
  args: { storyKey: v.string(), real: v.boolean(), steps: v.array(v.string()), summary: v.string(), hypothesis: v.string(), askOf: v.union(v.literal("cfo"), v.literal("accountant")), question: v.string(), options: v.array(v.object({ id: v.string(), label: v.string(), impact: v.string() })), matched: v.number(), orphans: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const story = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    if (!story) return null;
    const now = Date.now();
    for (let i = 0; i < a.steps.length; i++) await ctx.db.insert("trace_events", { agent: "investigator", month: story.month, storyKey: a.storyKey, kind: i === a.steps.length - 1 ? "decision" : "thought", text: a.steps[i], real: a.real, at: now + i });
    const sid = story._id as Id<ItemTable>;
    await transition(ctx, { table: "stories", id: sid, action: "annotate", actor: "investigator", month: story.month, reason: a.real ? "Investigation written by Claude" : "Scripted fallback investigation", patch: { askOf: a.askOf, investigation: { summary: a.summary, hypothesis: a.hypothesis, real: a.real } } });
    const q = await ctx.db.query("questions").withIndex("by_story", (x) => x.eq("storyKey", a.storyKey)).first();
    if (q) await transition(ctx, { table: "questions", id: q._id as Id<ItemTable>, action: "annotate", actor: "investigator", month: story.month, reason: "Question written", patch: { text: a.question, options: a.options, askOf: a.askOf, real: a.real } });
    // Staged: the Investigator tries to approve the story it just built. The code denies it.
    await ctx.db.insert("trace_events", { agent: "investigator", month: story.month, storyKey: a.storyKey, kind: "tool", text: "staged test: attempting to approve this story myself", real: false, staged: true, at: now + 50 });
    const denied = await transition(ctx, { table: "stories", id: sid, action: "approve", actor: "investigator", month: story.month, reason: "Staged attempt: Investigator approves its own story", staged: true, patch: {} });
    await ctx.db.insert("trace_events", { agent: "investigator", month: story.month, storyKey: a.storyKey, kind: "denied", text: denied.ok ? "unexpectedly allowed" : `denied in code: ${denied.denial}`, real: true, staged: true, at: now + 51 });
    const opinion = `Searched for FIN_Z payouts matching two different sales: none. ${a.orphans} payouts match no sale at all and should stay held whatever the answer.`;
    await transition(ctx, { table: "stories", id: sid, action: "annotate", actor: "auditor", month: story.month, reason: "Second opinion", patch: { auditorOpinion: { text: opinion, real: false } } });
    await ctx.db.insert("trace_events", { agent: "auditor", month: story.month, storyKey: a.storyKey, kind: "result", text: opinion, real: false, at: now + 60 });
    return null;
  },
});

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
    try {
      const raw = extractJson(await claude(system, user, 800)) as Record<string, unknown>;
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
