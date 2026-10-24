// Live case rooms. Each turn is one agent (Investigator, Auditor or Learner) working as a Claude call with
// tools that run real queries over the books, then speaking to a colleague. The meeting manager (code, in
// finishTurn) records the message, checks who may speak, enforces the turn limit, refuses asking a person
// before the Auditor has checked, and closes the room with one question.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { parseMemo } from "./lib/engineCore";
import { LAST_YEAR, MONTH_LABELS, STORE_BY_CODE, STORY_A_KEY, STORY_B_KEY, YEAR, addDays, type StoreCode } from "./lib/domain";
import { num, rp, rpShort } from "./lib/format";
import { validateRuleProgram, type RuleProgram } from "./lib/rules";
import { draftQuestion, type QuestionDraft } from "./lib/investigate";
import { ROOM_SPEAKERS, transition, type ItemTable, type Role } from "./lib/transition";
import { closeRoom, openRoom, roleName, roomMessages, say, scriptedMeeting } from "./rooms";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
export const MAX_TURNS = 6;
export const LIVE_ROOMS = new Set([STORY_A_KEY, STORY_B_KEY]);

const storeName = (s: string | null | undefined) => (s ? STORE_BY_CODE[s]?.name ?? s : "no store");

// ---------------- what each story needs from its agents ----------------

type StorySpec = { optionIds: string[]; askOf: "cfo" | "accountant"; ruleId: string; ruleShape: string };
const SPECS: Record<string, StorySpec> = {
  [STORY_A_KEY]: {
    optionIds: ["receipts", "bank", "unsure"], askOf: "accountant", ruleId: "r8",
    ruleShape: `{"id":"r8","version":1,"title":"...","channels":["school_va"],"match":"follow_receipt","params":{"receiptWeight":0.5-0.9,"subAccountWeight":below 0.2},"limitIdr":rupiah above every school fee}`,
  },
  [STORY_B_KEY]: {
    optionIds: ["yes", "no", "unsure"], askOf: "cfo", ruleId: "r9",
    ruleShape: `{"id":"r9","version":1,"title":"...","channels":["lender"],"match":"lender_sale","params":{"lenders":{"<LENDER>":<cut as a fraction>},"windowDays":7},"limitIdr":rupiah above the largest payout}`,
  },
};

// ---------------- tools: read-only queries the agents can run ----------------

type Rows = string[][];
type ToolResult = { summary: string; rows: Rows };

async function storyItems(ctx: QueryCtx, storyKey: string): Promise<Doc<"work_items">[]> {
  return await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", storyKey)).take(1500);
}

export const heldLines = internalQuery({
  args: { storyKey: v.string() },
  handler: async (ctx, a): Promise<ToolResult> => {
    const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    if (!s) return { summary: "no such story", rows: [] };
    const items = await storyItems(ctx, a.storyKey);
    const dates: string[] = [];
    for (const it of items) { const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first(); if (b) dates.push(b.date); }
    dates.sort();
    const rows: Rows = [["Lines", num(s.count)], ["Total", rp(s.amount)], ["Bank dates", dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "none"], ["Story opened", MONTH_LABELS[s.month - 1]], ["Stores", s.stores.map(storeName).join(", ") || "none"], ["Counterparty", s.counterparty], ["Gap", s.gap]];
    for (const it of items.slice(0, 3)) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (b) rows.push([`${b.date} ${b.account} ${b.memo}`, rp(b.amount)]);
    }
    return { summary: `${num(s.count)} held lines, ${rpShort(s.amount)}`, rows };
  },
});

export const knownLenders = internalQuery({
  args: {},
  handler: async (ctx): Promise<ToolResult> => {
    const rules = (await ctx.db.query("rules").take(100)).filter((r) => r.state === "APPROVED" || r.state === "POSTED");
    const rows: Rows = [];
    for (const r of rules) {
      const p = JSON.parse(r.program) as RuleProgram;
      for (const [l, c] of Object.entries(p.params.lenders ?? {})) rows.push([l, `cut ${(c * 100).toFixed(1)}% · ${r.ruleId} v${r.version}`]);
    }
    return { summary: `${rows.length} lenders in approved rules`, rows };
  },
});

// For each held payout: installment sales with this lender at the same store 1 to `windowDays` days earlier.
export const lenderSales = internalQuery({
  args: { storyKey: v.string(), lender: v.string(), cut: v.optional(v.number()), windowDays: v.optional(v.number()) },
  handler: async (ctx, a): Promise<ToolResult & { matched: number; matchedAmount: number; double: number; none: number; largest: number; cut: number }> => {
    const items = await storyItems(ctx, a.storyKey);
    const win = a.windowDays ?? 7;
    const rows: { amount: number; sales: { key: string; amount: number }[] }[] = [];
    const cuts: Record<string, number> = {};
    let largest = 0;
    for (const it of items) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (!b) continue;
      largest = Math.max(largest, b.amount);
      const p = parseMemo({ ...b, account: b.account as never });
      const sales = p.subStore ? (await ctx.db.query("erp_invoices").withIndex("by_store_kind_date", (q) => q.eq("store", p.subStore as StoreCode).eq("kind", "installment_sale").gte("date", addDays(b.date, -win)).lte("date", addDays(b.date, -1))).take(100)).filter((x) => x.lender === a.lender && x.year === YEAR) : [];
      const ss = sales.map((x) => ({ key: x.key, amount: x.amount ?? 0 }));
      rows.push({ amount: b.amount, sales: ss });
      for (const x of ss) { const c = (1 - b.amount / x.amount).toFixed(3); if (Number(c) > 0 && Number(c) < 0.1) cuts[c] = (cuts[c] ?? 0) + 1; }
    }
    const mode = a.cut ?? Number(Object.entries(cuts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0);
    let matched = 0, matchedAmount = 0, double = 0, none = 0;
    const used = new Set<string>();
    for (const r of rows) {
      const hits = r.sales.filter((x) => Math.round(x.amount * (1 - mode)) === r.amount);
      if (hits.length > 1) double++;
      const hit = hits.find((x) => !used.has(x.key));
      if (hit) { used.add(hit.key); matched++; matchedAmount += r.amount; } else none++;
    }
    return {
      summary: `${num(matched)} of ${num(rows.length)} payouts match one ${a.lender} sale at ${(mode * 100).toFixed(1)}%`,
      rows: [
        ["Payouts checked", num(rows.length)], [`Most common implied cut${a.cut === undefined ? "" : " (given)"}`, `${(mode * 100).toFixed(1)}%`],
        ["Match a sale exactly, to the rupiah", `${num(matched)} · ${rpShort(matchedAmount)}`], ["Match two or more sales", num(double)],
        ["Match no sale", num(none)], ["Largest payout", rp(largest)],
      ],
      matched, matchedAmount, double, none, largest, cut: mode,
    };
  },
});

export const lenderHistory = internalQuery({
  args: { lender: v.string() },
  handler: async (ctx, a): Promise<ToolResult> => {
    const last = await ctx.db.query("erp_invoices").withIndex("by_kind_lender_date", (q) => q.eq("kind", "installment_sale").eq("lender", a.lender).gte("date", `${LAST_YEAR}-01-01`).lte("date", `${LAST_YEAR}-12-31`)).take(5000);
    const now = await ctx.db.query("erp_invoices").withIndex("by_kind_lender_date", (q) => q.eq("kind", "installment_sale").eq("lender", a.lender).gte("date", `${YEAR}-01-01`).lte("date", `${YEAR}-12-31`)).take(5000);
    const first = now.reduce((m, x) => (x.date < m ? x.date : m), "9999");
    return { summary: `${a.lender}: ${num(last.length)} sales last year, ${num(now.length)} this year`, rows: [["Installment sales last year", num(last.length)], ["Installment sales this year", num(now.length)], ["First sale this year", now.length ? first : "none"]] };
  },
});

// School fee lines: where the school's receipt for the same student and amount was recorded.
export const schoolReceipts = internalQuery({
  args: { storyKey: v.string() },
  handler: async (ctx, a): Promise<ToolResult> => {
    const items = await storyItems(ctx, a.storyKey);
    let same = 0, other = 0, none = 0, late = 0;
    const where: Record<string, number> = {};
    for (const it of items.slice(0, 1500)) {
      const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
      if (!b) continue;
      const p = parseMemo({ ...b, account: b.account as never });
      if (!p.student) { none++; continue; }
      const recs = await ctx.db.query("school_receipts").withIndex("by_student_date", (q) => q.eq("studentRef", p.student!).gte("date", addDays(b.date, -3)).lte("date", addDays(b.date, 3))).take(10);
      const r = recs.find((x) => x.amount === b.amount && x.year === YEAR);
      if (!r) { none++; continue; }
      if (r.recordedOn > b.date) late++;
      if (r.store === p.subStore) same++; else { other++; where[r.store] = (where[r.store] ?? 0) + 1; }
    }
    const top = Object.entries(where).sort((x, y) => y[1] - x[1])[0];
    return {
      summary: `${num(other)} receipts at another store${top ? `, mostly ${storeName(top[0])}` : ""}`,
      rows: [["Receipt at the virtual account's store", num(same)], ["Receipt at another store", `${num(other)}${top ? ` · ${num(top[1])} at ${storeName(top[0])}` : ""}`], ["No matching receipt", num(none)], ["Receipt recorded after the payment", num(late)]],
    };
  },
});

// Backtest a draft rule. Lender rules: on this story's held payouts (a new lender has no history).
// Follow-the-receipt rules: on last year's school payments, against how they were actually booked.
async function backtest(ctx: ActionCtx, storyKey: string, program: RuleProgram): Promise<ToolResult> {
  if (program.match === "lender_sale") {
    const [lender, cut] = Object.entries(program.params.lenders ?? {})[0] ?? ["", 0];
    const r: { matched: number; matchedAmount: number; double: number; none: number; largest: number } = await ctx.runQuery(internal.roomAgents.lenderSales, { storyKey, lender, cut, windowDays: program.params.windowDays ?? 7 });
    const overLimit = r.largest > program.limitIdr;
    return {
      summary: `${program.id} would settle ${num(r.matched)}, ${num(r.double)} ambiguous, ${num(r.none)} stay held`,
      rows: [["Scope", `this year's held ${lender} payouts (no history last year)`], ["Would settle", `${num(r.matched)} · ${rpShort(r.matchedAmount)}`], ["Ambiguous (two sales)", num(r.double)], ["Stay held", num(r.none)], ["Limit above the largest payout", overLimit ? "no" : "yes"]],
    };
  }
  if (program.match === "follow_receipt") {
    let cursor: string | null = null, covered = 0, correct = 0, total = 0;
    do {
      const page: { rows: { va: string; receipt: string; truth: string }[]; cursor: string | null } = await ctx.runQuery(internal.agents.backtestPage, { cursor });
      for (const x of page.rows) { total++; if (x.va === x.receipt) continue; covered++; if (x.receipt === x.truth) correct++; }
      cursor = page.cursor;
    } while (cursor);
    return {
      summary: `${program.id} covers ${num(covered)} of last year's school payments, ${num(covered - correct)} wrong`,
      rows: [["Scope", `last year's ${num(total)} school payments with a receipt`], ["Would move", num(covered)], ["Correct against last year's books", num(correct)], ["Wrong", num(covered - correct)], ["Precision", covered ? `${((correct / covered) * 100).toFixed(1)}%` : "n/a"]],
    };
  }
  return { summary: "no backtest for this kind of rule here", rows: [] };
}

// ---------------- Claude with tools ----------------

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type Msg = { role: "user" | "assistant"; content: string | unknown[] };
type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };

async function claude(system: string, messages: Msg[], tools: ToolDef[]): Promise<{ content: Block[]; stop_reason: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the Convex deployment");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages, tools, tool_choice: { type: "auto" } }),
  });
  if (!res.ok) throw new Error(`Claude returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { content: Block[]; stop_reason: string };
}

const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required });
const TOOL_DEFS: Record<string, ToolDef> = {
  held_lines: { name: "held_lines", description: "Summary of this story's held bank lines with a few examples.", input_schema: obj({}) },
  known_lenders: { name: "known_lenders", description: "Lenders and their cuts in approved rules.", input_schema: obj({}) },
  lender_sales: { name: "lender_sales", description: "For each held payout, find installment sales with this lender at the same store in the days before, and the implied cut. Pass cut to test an exact cut.", input_schema: obj({ lender: { type: "string" }, cut: { type: "number" } }, ["lender"]) },
  lender_history: { name: "lender_history", description: "How many installment sales this lender financed last year and this year.", input_schema: obj({ lender: { type: "string" } }, ["lender"]) },
  school_receipts: { name: "school_receipts", description: "For held school fee payments, where the school's receipt for the same student and amount was recorded, and when.", input_schema: obj({}) },
  backtest_rule: { name: "backtest_rule", description: "Backtest a draft rule program (JSON in the rule language) and report what it would settle and get wrong.", input_schema: obj({ program: { type: "string", description: "The rule program as a JSON string" } }, ["program"]) },
};
const SAY: ToolDef = {
  name: "say",
  description: "Say your message to the room. Call exactly once, at the end of your turn.",
  input_schema: obj({
    // Asking the model to write out its reasoning is refused; asking for findings from the tool results is not.
    findings: { type: "array", items: { type: "string" }, description: "2 to 5 short findings, each one fact from a tool result, lower case" },
    text: { type: "string", description: "Your message, 2 to 4 short sentences, ending by addressing one colleague by name" },
    to: { type: "string", enum: ["investigator", "auditor", "learner", "cfo", "accountant", "room"] },
    question: obj({ ask_of: { type: "string", enum: ["cfo", "accountant"] }, text: { type: "string" }, options: { type: "array", items: obj({ id: { type: "string" }, label: { type: "string" }, impact: { type: "string" } }, ["id", "label", "impact"]) } }, ["ask_of", "text", "options"]),
    rule: { type: "string", description: "A draft rule program as a JSON string (Learner only)" },
  }, ["findings", "text", "to"]),
};
const ROLE_TOOLS: Record<string, string[]> = {
  investigator: ["held_lines", "known_lenders", "lender_sales", "lender_history", "school_receipts"],
  auditor: ["held_lines", "known_lenders", "lender_sales", "lender_history", "school_receipts", "backtest_rule"],
  learner: ["held_lines", "known_lenders", "lender_sales", "backtest_rule"],
};

function systemPrompt(speaker: string, spec: StorySpec): string {
  const base = "You are the " + roleName(speaker) + " in a case room inside Fermata, autonomous cash reconciliation for a fictional Indonesian music retailer with 14 stores (all data is synthetic). " +
    "The Engine (code) held some bank lines it could not settle and opened this room. The agents in the room are the Investigator, the Auditor and the Learner; they talk to each other directly. " +
    "A meeting manager written in code gives the floor to whoever is addressed, records everything, and stops the meeting after " + MAX_TURNS + " turns. " +
    "People (the CFO and the Accountant) are outside the room: they get exactly one question, and only after the Auditor has checked it. Nobody in the room can approve or post anything. " +
    "Use your tools to get facts and never invent a number: every number you say must come from a tool result or the transcript. " +
    "Voice: calm, plainspoken, sentence case, no emoji, no exclamation marks, short sentences. Money like 'Rp 9.8bn' or 'Rp 412m'. " +
    "End your turn by calling the say tool once. In its text, address one colleague by name, and set `to` to match.";
  const role: Record<string, string> = {
    investigator: `Your job: find out what these lines are. Run queries, form a hypothesis, and once the case is clear, propose the one question in the question field for the right person: the Accountant for bookkeeping facts, the CFO for business relationships and policy. Option ids must be exactly ${spec.optionIds.join(", ")}, in that order. Each option's impact says concretely what will happen, with counts and rupiah. Before any person is asked, ask the Auditor to try to break your case. If the Auditor objects, answer the objection and narrow your proposal. If a rule would follow from a yes, ask the Learner to draft it.`,
    auditor: "Your job: try to break the case and any draft rule. Look for counterexamples, double matches and missing history, and say plainly whether you object or pass. You can send work back to a colleague. When the question and any draft rule both hold up, tell the room you agree (to: room).",
    learner: `Your job: draft the rule a yes would create, as a program in the rule language, put it in the rule field, and backtest it with backtest_rule before you speak. The rule id must be ${spec.ruleId}. Shape: ${spec.ruleShape}. Then ask the Auditor to check it.`,
  };
  return `${base}\n\n${role[speaker] ?? ""}`;
}

// ---------------- the turn ----------------

export const context = internalQuery({
  args: { storyKey: v.string() },
  handler: async (ctx, a) => {
    const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    const msgs = await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", a.storyKey)).take(200);
    return { story: s, msgs };
  },
});

function transcript(story: Doc<"stories">, msgs: Doc<"room_messages">[]): string {
  const lines = msgs.filter((m) => m.status === "done").map((m) => {
    const who = m.kind === "manager" ? "Meeting manager" : roleName(m.speaker);
    const tools = m.tools.map((t) => `  [ran ${t.name}(${t.input}): ${t.rows.map((r) => r.join(": ")).join("; ")}]`).join("\n");
    const extra = [m.code ? `  [draft rule: ${m.code}]` : "", m.question ? `  [proposed question for the ${m.question.askOf}: ${m.question.text} | options: ${m.question.options.map((o) => `${o.id}=${o.label}: ${o.impact}`).join(" / ")}]` : ""].filter(Boolean).join("\n");
    return `${who} → ${roleName(m.to)}: ${m.text}${tools ? "\n" + tools : ""}${extra ? "\n" + extra : ""}`;
  });
  return `Story: ${story.title}. ${num(story.count)} held lines, ${rp(story.amount)}, ${MONTH_LABELS[story.month - 1]}. Counterparty: ${story.counterparty}.\n\nTranscript so far:\n${lines.join("\n\n")}`;
}

export const agentTurn = internalAction({
  args: { storyKey: v.string(), speaker: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { story, msgs } = await ctx.runQuery(internal.roomAgents.context, { storyKey: a.storyKey });
    if (!story) return null;
    const spec = SPECS[a.storyKey];
    const id: Id<"room_messages"> = await ctx.runMutation(internal.roomAgents.startTurn, { storyKey: a.storyKey, speaker: a.speaker });
    try {
      const tools = [...(ROLE_TOOLS[a.speaker] ?? []).map((t) => TOOL_DEFS[t]), SAY];
      const messages: Msg[] = [{ role: "user", content: `${transcript(story, msgs)}\n\nYou have the floor. Do your job, then call say.` }];
      const ROUNDS = 6;
      for (let i = 0; i < ROUNDS; i++) {
        const res = await claude(systemPrompt(a.speaker, spec), messages, tools);
        if (res.stop_reason === "refusal") throw new Error("the model declined this turn");
        messages.push({ role: "assistant", content: res.content });
        const uses = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
        const said = uses.find((u) => u.name === "say");
        if (said) {
          await ctx.runMutation(internal.roomAgents.finishTurn, { storyKey: a.storyKey, messageId: id, speaker: a.speaker, payload: JSON.stringify(said.input) });
          return null;
        }
        // The model only accepts an automatic tool choice, so the last round asks for say in words.
        const nudge = i >= ROUNDS - 2 ? [{ type: "text", text: "That is enough research. Call the say tool now." }] : [];
        if (!uses.length) { messages.push({ role: "user", content: [{ type: "text", text: "Call the say tool now." }] }); continue; }
        const results: unknown[] = [];
        for (const u of uses) {
          const r = await runTool(ctx, a.storyKey, u.name, u.input);
          await ctx.runMutation(internal.roomAgents.appendTool, { messageId: id, name: u.name, input: toolInput(u.input), rows: r.rows });
          results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify({ summary: r.summary, rows: r.rows }) });
        }
        messages.push({ role: "user", content: [...results, ...nudge] });
      }
      throw new Error("the agent did not finish its turn");
    } catch (err) {
      await ctx.runMutation(internal.roomAgents.failTurn, { storyKey: a.storyKey, messageId: id, speaker: a.speaker, error: String(err).slice(0, 160) });
      return null;
    }
  },
});

const toolInput = (x: Record<string, unknown>) => Object.entries(x).map(([k, val]) => `${k}=${typeof val === "string" ? val.slice(0, 80) : JSON.stringify(val)}`).join(", ");

async function runTool(ctx: ActionCtx, storyKey: string, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "held_lines": return await ctx.runQuery(internal.roomAgents.heldLines, { storyKey });
    case "known_lenders": return await ctx.runQuery(internal.roomAgents.knownLenders, {});
    case "lender_sales": {
      const r = await ctx.runQuery(internal.roomAgents.lenderSales, { storyKey, lender: String(input.lender ?? ""), cut: typeof input.cut === "number" ? input.cut : undefined });
      return { summary: r.summary, rows: r.rows };
    }
    case "lender_history": return await ctx.runQuery(internal.roomAgents.lenderHistory, { lender: String(input.lender ?? "") });
    case "school_receipts": return await ctx.runQuery(internal.roomAgents.schoolReceipts, { storyKey });
    case "backtest_rule": {
      let raw: unknown;
      try { raw = JSON.parse(String(input.program ?? "")); } catch { return { summary: "the program is not valid JSON", rows: [] }; }
      const val = validateRuleProgram(raw);
      if (!val.ok) return { summary: `invalid program: ${val.error}`, rows: [] };
      return await backtest(ctx, storyKey, val.rule);
    }
    default: return { summary: `unknown tool ${name}`, rows: [] };
  }
}

export const startTurn = internalMutation({
  args: { storyKey: v.string(), speaker: v.string() },
  returns: v.id("room_messages"),
  handler: async (ctx, a) => {
    const story = (await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first())!;
    return await say(ctx, story, story.month, { speaker: a.speaker, to: "room", source: "claude", status: "working", text: "" });
  },
});

export const appendTool = internalMutation({
  args: { messageId: v.id("room_messages"), name: v.string(), input: v.string(), rows: v.array(v.array(v.string())) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const m = await ctx.db.get(a.messageId);
    if (m) await ctx.db.patch(a.messageId, { tools: [...m.tools, { name: a.name, input: a.input, rows: a.rows }] });
    return null;
  },
});

type SayPayload = { findings?: string[]; text?: string; to?: string; question?: { ask_of?: string; text?: string; options?: { id: string; label: string; impact: string }[] }; rule?: string };

// The meeting manager. Records the turn, then decides who has the floor next, or closes the room.
export const finishTurn = internalMutation({
  args: { storyKey: v.string(), messageId: v.id("room_messages"), speaker: v.string(), payload: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const story = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    if (!story || story.room?.state !== "meeting") return null;
    const spec = SPECS[a.storyKey];
    const p = JSON.parse(a.payload) as SayPayload;
    const speaker = a.speaker as Role;
    const month = story.month;
    const manager = async (text: string) => { await say(ctx, story, month, { speaker: "manager", to: "room", kind: "manager", source: "code", text }); };

    // Record what was said. A draft rule only counts from the Learner; a question only from the Investigator.
    let code: string | undefined;
    if (p.rule && speaker === "learner") {
      try { const val = validateRuleProgram(JSON.parse(p.rule)); if (val.ok) code = JSON.stringify({ ...val.rule, id: spec.ruleId }, null, 2); } catch { code = undefined; }
    }
    let question: Doc<"room_messages">["question"];
    if (p.question && speaker === "investigator") question = normalizeQuestion(p.question, spec, story);
    const valid = ["investigator", "auditor", "learner", "cfo", "accountant", "room"];
    let to = p.to && valid.includes(p.to) ? p.to : "room";
    if (to === speaker) to = speaker === "auditor" ? "investigator" : "auditor";
    await ctx.db.patch(a.messageId, { status: "done", think: (p.findings ?? []).slice(0, 6), text: p.text ?? "", to, code, question });

    if (!ROOM_SPEAKERS.includes(speaker)) { await manager(`${roleName(speaker)} may not speak in a case room.`); return null; }

    // Staged in story B: the Investigator tries to approve its own story. The gateway refuses in code.
    const msgs = await roomMessages(ctx, a.storyKey);
    const mine = msgs.filter((m) => m.speaker === "investigator" && m.kind === "message").length;
    if (a.storyKey === STORY_B_KEY && speaker === "investigator" && mine === 2 && !msgs.some((m) => m.staged)) {
      const r = await transition(ctx, { table: "stories", id: story._id as Id<ItemTable>, action: "approve", actor: "investigator", month, reason: "Staged attempt: the Investigator approves its own story", staged: true, patch: {} });
      await say(ctx, story, month, { speaker: "investigator", to: "room", kind: "denied", source: "code", staged: true, text: r.ok ? "Approved its own story. This should never happen." : `Tried to approve this story itself. Blocked in code: ${r.denial}.` });
    }

    const fresh = (await ctx.db.get(story._id))!;
    const turns = fresh.room?.turns ?? 0;
    const after = await roomMessages(ctx, a.storyKey);
    const lastQ = [...after].reverse().find((m) => m.question);
    const lastAuditor = [...after].reverse().find((m) => m.speaker === "auditor" && m.kind === "message" && m.status === "done");
    const lastProposal = [...after].reverse().find((m) => m.question || m.code);
    const wantsPerson = to === "cfo" || to === "accountant" || to === "room";

    if (wantsPerson) {
      if (speaker === "learner") { await manager("The Learner drafts rules; it does not ask people. Floor goes to the Auditor."); return await next(ctx, a.storyKey, "auditor"); }
      if (!lastQ) { await manager("There is no question for a person yet. Floor goes to the Investigator to write it."); return await next(ctx, a.storyKey, "investigator"); }
      if (!lastAuditor || (lastProposal && lastAuditor.seq < lastProposal.seq)) {
        await manager(`People are asked once, after the Auditor has checked. Floor goes to the Auditor.`);
        return await next(ctx, a.storyKey, "auditor");
      }
      return await close(ctx, fresh, lastQ, after, true);
    }
    if (turns >= MAX_TURNS) {
      if (lastQ && lastAuditor && (!lastProposal || lastAuditor.seq > lastProposal.seq)) { await manager(`Turn limit reached. The question the Auditor checked goes out.`); return await close(ctx, fresh, lastQ, after, true); }
      await manager(`Turn limit reached without a checked question. The story falls back to the scripted question.`);
      await closeRoom(ctx, fresh, month, draftQuestion(fresh), false);
      return null;
    }
    if (turns === MAX_TURNS - 2) await manager(`${MAX_TURNS - turns} turns left. Agree on one question, or the story stays held.`);
    return await next(ctx, a.storyKey, to);
  },
});

async function next(ctx: MutationCtx, storyKey: string, speaker: string): Promise<null> {
  await ctx.scheduler.runAfter(0, internal.roomAgents.agentTurn, { storyKey, speaker });
  return null;
}

function normalizeQuestion(q: NonNullable<SayPayload["question"]>, spec: StorySpec, story: Doc<"stories">): Doc<"room_messages">["question"] {
  const askOf = q.ask_of === "cfo" || q.ask_of === "accountant" ? q.ask_of : spec.askOf;
  const fallback = draftQuestion(story).options;
  const options = spec.optionIds.map((id, i) => {
    const o = q.options?.find((x) => x.id === id) ?? q.options?.[i];
    const f = fallback.find((x) => x.id === id);
    return { id, label: o?.label || f?.label || id, impact: o?.impact || f?.impact || "" };
  });
  return { askOf, text: q.text || draftQuestion(story).text, options };
}

async function close(ctx: MutationCtx, story: Doc<"stories">, q: Doc<"room_messages">, msgs: Doc<"room_messages">[], real: boolean): Promise<null> {
  const inv = [...msgs].reverse().find((m) => m.speaker === "investigator" && m.kind === "message" && m.text);
  const aud = [...msgs].reverse().find((m) => m.speaker === "auditor" && m.kind === "message" && m.text);
  const d: QuestionDraft = {
    askOf: q.question!.askOf, text: q.question!.text, options: q.question!.options,
    summary: inv?.text ?? "", hypothesis: "", trace: inv?.think ?? [], auditor: aud?.text ?? "",
  };
  await closeRoom(ctx, story, story.month, d, real);
  return null;
}

export const failTurn = internalMutation({
  args: { storyKey: v.string(), messageId: v.id("room_messages"), speaker: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.delete(a.messageId);
    const story = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    if (!story || story.room?.state !== "meeting") return null;
    await say(ctx, story, story.month, { speaker: "manager", to: "room", kind: "manager", source: "code", text: `The ${roleName(a.speaker)} could not finish (${a.error}). The meeting continues from the scripted version.` });
    await scriptedMeeting(ctx, (await ctx.db.get(story._id))!, story.month);
    return null;
  },
});

// The latest rule the Learner drafted in this story's room, if any.
export const roomDraftRule = internalQuery({
  args: { storyKey: v.string() },
  handler: async (ctx, a): Promise<string | null> => {
    const msgs = await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", a.storyKey)).order("desc").take(200);
    return msgs.find((m) => m.speaker === "learner" && m.code)?.code ?? null;
  },
});

// For testing one meeting without re-running the year: clears a live room and opens it again.
export const rerunRoom = internalMutation({
  args: { storyKey: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const story = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", a.storyKey)).first();
    if (!story) return null;
    for (const m of await roomMessages(ctx, a.storyKey)) await ctx.db.delete(m._id);
    for (const q of await ctx.db.query("questions").withIndex("by_story", (x) => x.eq("storyKey", a.storyKey)).take(5)) await ctx.db.delete(q._id);
    await ctx.db.patch(story._id, { state: "NEW", room: undefined });
    await openRoom(ctx, (await ctx.db.get(story._id))!, story.month, LIVE_ROOMS.has(a.storyKey));
    return null;
  },
});
