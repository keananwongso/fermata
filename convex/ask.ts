// Ask the books: one question at a time, read only. The model picks a template and a named query; code runs the
// query and fills the template, so every number on screen comes from the data. The model writes the spoken
// sentence only after it has seen the result, and code checks that sentence's numbers against that result.
//
// The public functions here are the only ones the hosted site calls: `ask` (live answers, for questions no preset
// matches) and `token` (a short-lived Cartesia token for speech). Both are rate limited per visitor and capped per
// day. Nothing here writes to the books: reads are internal queries, and a requested change goes through the
// gateway as the assistant role, which may do nothing, so it is refused and recorded like any other denial.
import { v } from "convex/values";
import { action, internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { RegisteredQuery } from "convex/server";
import type * as AD from "./askData";
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import {
  ACCOUNT_LABEL, CHANNEL_LABEL, LIMITED, QUERIES, uncheckedNumbers, validateParams,
  type AskAnswer, type AskReply, type AskView, type BreakdownView, type LinesView, type Params, type QueryName, type Refusal, type StoryMessage, type StoryView, type Template,
} from "./lib/ask";
import { matchPreset } from "./lib/askPresets";
import { GAP_LABEL, type Gap } from "./lib/engineCore";
import { MONTH_LABELS, STORES, STORE_BY_CODE, BANK_ACCOUNTS, YEAR } from "./lib/domain";
import { num, pct, rpShort } from "./lib/format";
import { transition, type Action, type ItemTable } from "./lib/transition";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const CARTESIA_VERSION = "2026-08-14";
const DAY = 24 * HOUR;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Per visitor: a burst of 3 live answers, then one every 2 minutes. Globally: 100 live answers a day, whoever asks.
// Tokens: a burst of 4, then one every 50 seconds, and 300 a day. A visitor id is only a hint (anyone can make a
// new one), so the daily caps are what bound the spend.
export const LIMITS = {
  askVisitor: { kind: "token bucket", rate: 5, period: 10 * MINUTE, capacity: 3 },
  askDaily: { kind: "fixed window", rate: 100, period: DAY },
  tokenVisitor: { kind: "token bucket", rate: 12, period: 10 * MINUTE, capacity: 4 },
  tokenDaily: { kind: "fixed window", rate: 300, period: DAY },
} as const;
const limiter = new RateLimiter(components.rateLimiter, LIMITS);

const storeName = (s: string | null | undefined) => (s ? STORE_BY_CODE[s]?.name ?? s : "No store");
const visitorOk = (x: string) => /^[A-Za-z0-9_-]{8,64}$/.test(x);

// ---------------- the named queries, filled into templates ----------------

type Overview = {
  months: { month: number; stats: Record<string, number> }[];
  stories: { key: string; title: string; month: number; gap: string; store: string | null; stores: string[]; channel: string; counterparty: string; count: number; amount: number; state: string; askOf: string | null; resolution: string | null }[];
  questions: { storyKey: string; askOf: string; state: string; answer: string | null }[];
  rules: { ruleId: string; title: string; state: string; learnedInMonth: number | null; origin: string; real: boolean }[];
  accounts: { code: string; name: string; statement: number; books: number }[];
};
type Built = { view: AskView; caption: string } | { error: string };
// Annotated from the module itself rather than through `internal`, which would make these types circular.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ret<T> = T extends RegisteredQuery<"internal", any, infer R> ? Awaited<R> : never;
type Held = Ret<typeof AD.held>;
type StoryDetail = Ret<typeof AD.story>;
type RuleDetail = Ret<typeof AD.rule>;
type LinesOut = Ret<typeof AD.linesOf>;
type Target = Ret<typeof AD.target>;

const overview = async (ctx: ActionCtx): Promise<Overview> => await ctx.runQuery(internal.askData.overview, {});
const heldLines = async (ctx: ActionCtx): Promise<Held> => await ctx.runQuery(internal.askData.held, {});
const share = (s: Record<string, number>) => (s.processed ?? s.total ?? 0) ? (s.firstSettled ?? 0) / (s.processed ?? s.total) : 0;

function group<T>(items: T[], key: (x: T) => string, value: (x: T) => number, sub?: (x: T) => number) {
  const m = new Map<string, { value: number; sub: number }>();
  for (const x of items) {
    const k = key(x);
    const g = m.get(k) ?? { value: 0, sub: 0 };
    g.value += value(x);
    g.sub += sub ? sub(x) : 0;
    m.set(k, g);
  }
  return [...m.entries()].map(([label, g]) => ({ label, ...g })).sort((a, b) => b.value - a.value);
}

async function build(ctx: ActionCtx, name: QueryName, p: Params): Promise<Built> {
  switch (name) {
    case "cash_position": {
      const ov = await overview(ctx);
      const accts = p.account ? ov.accounts.filter((a) => a.code === p.account) : ov.accounts;
      const bank = accts.reduce((s, a) => s + a.statement, 0);
      const books = accts.reduce((s, a) => s + a.books, 0);
      const where = p.account ? ACCOUNT_LABEL[String(p.account)] : `${accts.length} bank accounts`;
      const ho = ov.accounts.find((a) => a.code === "HEAD_OFFICE");
      return {
        view: {
          template: "figure", title: p.account ? `Cash in ${where}` : "Cash in the bank", label: "The bank statements say", value: bank, unit: "rp",
          compare: { label: "The books say", value: books, unit: "rp" },
          note: !p.account && ho ? `The head office account alone is ${rpShort(ho.books)} in the books and ${rpShort(ho.statement)} at the bank.` : null,
          source: `Statement balances of ${where}, against the ledger's book balances`,
        },
        caption: `The bank statements hold ${rpShort(bank)} across ${where}. The books say ${rpShort(books)}.`,
      };
    }
    case "first_pass_share": {
      const ov = await overview(ctx);
      const m = Number(p.month ?? 12);
      const at = ov.months.find((x) => x.month === m);
      const jan = ov.months.find((x) => x.month === 1);
      if (!at || !jan) return { error: "the year has not been closed yet" };
      const value = share(at.stats);
      return {
        view: {
          template: "figure", title: `Settled on the first pass in ${MONTHS[m - 1]}`, label: `${num(at.stats.firstSettled ?? 0)} of ${num(at.stats.processed ?? at.stats.total ?? 0)} bank lines`, value, unit: "pct",
          compare: m === 1 ? null : { label: "In January", value: share(jan.stats), unit: "pct" },
          note: null, source: "The close's month counters: lines settled by an approved rule the first time they were seen",
        },
        caption: `${pct(value)} of ${MONTHS[m - 1]}'s bank lines settled on the first pass${m === 1 ? "" : `, up from ${pct(share(jan.stats))} in January`}.`,
      };
    }
    case "held_now": {
      const [ov, held] = await Promise.all([overview(ctx), heldLines(ctx)]);
      const items = held.filter((h) => (!p.store || h.store === p.store) && (!p.channel || h.channel === p.channel));
      const stories = ov.stories.filter((s) => (!p.store || s.store === p.store || s.stores.includes(String(p.store))) && (!p.channel || s.channel === p.channel));
      const ever = stories.reduce((s, x) => s + x.count, 0);
      const amount = items.reduce((s, x) => s + x.amount, 0);
      const scope = [p.store ? storeName(String(p.store)) : null, p.channel ? CHANNEL_LABEL[String(p.channel)]?.toLowerCase() : null].filter(Boolean).join(", ");
      return {
        view: {
          template: "figure", title: `Still held after the close${scope ? `: ${scope}` : ""}`, label: "Bank lines held", value: items.length, unit: "count",
          compare: { label: "Held at some point in the year", value: ever, unit: "count" },
          note: `${rpShort(amount)} in ${new Set(items.map((i) => i.storyKey)).size} stories, each waiting on a person's answer.`,
          source: "Work items in the held state, and every story the close opened",
        },
        caption: `${num(items.length)} bank lines are still held, ${rpShort(amount)}. ${num(ever)} were held at some point in the year.`,
      };
    }
    case "monthly": {
      const ov = await overview(ctx);
      const measure = String(p.measure);
      const value = (m: { month: number; stats: Record<string, number> }): number => {
        const s = m.stats;
        if (measure === "first_pass_share") return share(s);
        if (measure === "first_pass_settled") return s.firstSettled ?? 0;
        if (measure === "held") return s.held ?? 0;
        if (measure === "waiting") return s.waiting ?? 0;
        if (measure === "settled_later") return s.settledLater ?? 0;
        if (measure === "settled_by_new_rule") return s.settledByNewRule ?? 0;
        if (measure === "rooms") return ov.stories.filter((x) => x.month === m.month).length;
        return s.processed ?? s.total ?? 0;
      };
      const TITLE: Record<string, string> = {
        first_pass_share: "Share settled on the first pass", first_pass_settled: "Lines settled on the first pass", held: "Lines held on the first pass",
        waiting: "Lines waiting for records", settled_later: "Waiting lines settled in a later month", settled_by_new_rule: "Held lines settled by a newly learned rule",
        rooms: "Case rooms opened", lines: "Bank lines",
      };
      const points = ov.months.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: value(m) }));
      const marks = ov.rules.filter((r) => r.learnedInMonth && (r.state === "APPROVED" || r.state === "POSTED")).map((r) => ({ at: MONTH_LABELS[r.learnedInMonth! - 1], label: `${r.ruleId} learned` }));
      const unit = measure === "first_pass_share" ? "pct" : "count";
      const first = points[0], last = points[points.length - 1];
      const peak = [...points].sort((a, b) => b.value - a.value)[0];
      return {
        view: { template: "trend", title: `${TITLE[measure]}, by month`, unit, style: measure === "first_pass_share" ? "line" : "bars", points, marks, source: "The close's month counters" },
        caption: measure === "first_pass_share"
          ? `The share settled on the first pass went from ${pct(first.value)} in January to ${pct(last.value)} in December.`
          : `${TITLE[measure]}: most in ${MONTHS[MONTH_LABELS.indexOf(peak.label)]}, with ${num(peak.value)}.`,
      };
    }
    case "held_breakdown": {
      const [ov, held] = await Promise.all([overview(ctx), heldLines(ctx)]);
      const items = held.filter((h) => !p.month || h.month === p.month);
      const by = String(p.by);
      const title = Object.fromEntries(ov.stories.map((s) => [s.key, s.title]));
      const key = (h: (typeof items)[number]) => by === "store" ? storeName(h.store) : by === "channel" ? CHANNEL_LABEL[h.channel] ?? h.channel : by === "account" ? ACCOUNT_LABEL[h.account] ?? h.account : title[h.storyKey ?? ""] ?? "No story";
      const rows = group(items, key, () => 1, (h) => h.amount).slice(0, 14).map((r) => ({ label: r.label, value: r.value, sub: rpShort(r.sub) }));
      const view: BreakdownView = {
        template: "breakdown", title: `Lines still held, by ${by}${p.month ? `, from ${MONTHS[Number(p.month) - 1]}` : ""}`, unit: "count", tone: "hold", rows, total: items.length,
        source: "Work items in the held state after the close",
      };
      return { view, caption: rows.length ? `${rows[0].label} has the most still held: ${num(rows[0].value)} of ${num(items.length)} lines, ${rows[0].sub}.` : "Nothing is held." };
    }
    case "stories_breakdown": {
      const ov = await overview(ctx);
      const by = String(p.by);
      const measure = String(p.measure ?? "lines");
      const key = (s: Overview["stories"][number]) => by === "store" ? (s.store ? storeName(s.store) : s.stores.length === 1 ? storeName(s.stores[0]) : "Several stores")
        : by === "channel" ? CHANNEL_LABEL[s.channel] ?? s.channel : by === "month" ? MONTHS[s.month - 1] : GAP_LABEL[s.gap as Gap] ?? s.gap;
      const val = (s: Overview["stories"][number]) => measure === "amount" ? s.amount : measure === "stories" ? 1 : s.count;
      const rows = group(ov.stories, key, val, (s) => s.count).slice(0, 14).map((r) => ({ label: r.label, value: r.value, sub: measure === "lines" ? null : `${num(r.sub)} lines` }));
      const total = ov.stories.reduce((s, x) => s + val(x), 0);
      const unit = measure === "amount" ? "rp" : "count";
      const what = measure === "amount" ? "Rupiah" : measure === "stories" ? "Stories" : "Lines";
      return {
        view: { template: "breakdown", title: `${what} held this year, by ${by}`, unit, tone: "hold", rows, total, source: "Every story the close opened, including ones settled after an answer" },
        caption: rows.length ? `${rows[0].label} had the most held this year: ${unit === "rp" ? rpShort(rows[0].value) : num(rows[0].value)} of ${unit === "rp" ? rpShort(total) : num(total)}.` : "Nothing was held.",
      };
    }
    case "bank_lines": {
      if (!p.story && p.outcome !== "held" && !p.month && !p.counterparty) return { error: "bank_lines needs a month, a story, a counterparty, or outcome held" };
      const f = { channel: p.channel as string | undefined, store: p.store as string | undefined, account: p.account as string | undefined, outcome: p.outcome as string | undefined, counterparty: p.counterparty as string | undefined, month: p.month as number | undefined };
      const LIMIT = 15;
      let r: LinesOut;
      if (p.story || p.outcome === "held") r = await ctx.runQuery(internal.askData.linesOf, { ...f, story: p.story as string | undefined, limit: LIMIT });
      else {
        r = { rows: [], matched: 0, amount: 0 };
        let cursor: string | null = null;
        do {
          const page: { rows: LinesView["rows"]; matched: number; amount: number; cursor: string | null } = await ctx.runQuery(internal.askData.linesPage, { ...f, cursor, limit: LIMIT - r.rows.length });
          r.rows.push(...page.rows); r.matched += page.matched; r.amount += page.amount; cursor = page.cursor;
        } while (cursor);
      }
      const what = p.counterparty ? `${p.counterparty} lines` : p.channel ? CHANNEL_LABEL[String(p.channel)] : "Bank lines";
      const parts = [p.outcome ? String(p.outcome) : null, p.store ? `at ${storeName(String(p.store))}` : null, p.account ? `into ${ACCOUNT_LABEL[String(p.account)]}` : null, p.month ? `in ${MONTHS[Number(p.month) - 1]}` : null, p.story ? "in this story" : null].filter(Boolean);
      return {
        view: { template: "lines", title: `${what}${parts.length ? ` ${parts.join(" ")}` : ""}`, rows: r.rows, shown: r.rows.length, matched: r.matched, amount: r.amount, source: "Bank lines, with how the engine or a person decided each one" },
        caption: r.matched ? `${num(r.matched)} lines match, ${rpShort(r.amount)}.${r.matched > r.rows.length ? ` Showing the first ${r.rows.length}.` : ""}` : "No bank lines match.",
      };
    }
    case "story": {
      const d: StoryDetail = await ctx.runQuery(internal.askData.story, { key: String(p.story) });
      if (!d) return { error: `no story ${p.story}; call list_stories for the keys` };
      const s = d.story;
      const q = d.question;
      const picked = q?.options.find((o) => o.id === q.answer) ?? null;
      const where = s.store ? storeName(s.store) : s.stores.length ? `${s.stores.length} stores` : "No store";
      const view: StoryView = {
        template: "story", kind: "story", title: s.title, subtitle: `${MONTHS[s.month - 1]} · ${GAP_LABEL[s.gap as Gap] ?? s.gap}`, state: s.state,
        facts: [
          { label: "Lines", value: num(s.count) }, { label: "Amount", value: rpShort(s.amount) }, { label: "Where", value: where },
          { label: "Settled", value: num(d.counts.settled) }, { label: "Still held", value: num(d.counts.held) },
        ],
        messages: d.messages.filter((m) => m.status === "done").slice(0, 24).map(toMessage),
        question: q ? { askOf: q.askOf, text: q.text, answer: picked?.label ?? null, impact: picked?.impact ?? null, real: q.real } : null,
        rule: null,
        record: d.audit.slice(-10).map((x) => ({ action: x.action, actor: x.actor, allowed: x.allowed, reason: x.reason, denial: x.denial, toState: x.toState })),
        source: "The story, its case room and the record of every step",
      };
      return { view, caption: `${s.title}: ${num(s.count)} lines, ${rpShort(s.amount)}, held in ${MONTHS[s.month - 1]}.${s.resolution ? ` ${s.resolution}` : ""}` };
    }
    case "rule": {
      const d: RuleDetail = await ctx.runQuery(internal.askData.rule, { ruleId: String(p.rule) });
      if (!d) return { error: `no rule ${p.rule}; call list_rules` };
      const r = d.rule;
      const bt = r.backtest ?? null;
      const view: StoryView = {
        template: "story", kind: "rule", title: `${r.ruleId} ${r.title}`, subtitle: r.learnedInMonth ? `Learned in ${MONTHS[r.learnedInMonth - 1]}` : "Derived from last year's books", state: r.state,
        facts: [
          { label: "Version", value: `v${r.version}` },
          { label: "Approved by", value: r.approvedBy ? (r.approvedBy === "cfo" ? "CFO" : r.approvedBy) : r.state === "APPROVED" ? "Seeded" : "Not yet" },
          ...(bt ? [{ label: "Backtest covers", value: num(bt.covered) }, { label: "Precision", value: pct(bt.precision) }, { label: "Errors", value: num(bt.errors) }] : []),
        ],
        messages: d.messages.slice(0, 12).map(toMessage),
        question: null,
        rule: { id: r.ruleId, title: r.title, state: r.state, origin: r.origin, real: r.real, program: JSON.stringify(JSON.parse(r.program), null, 2), backtest: bt, audit: r.audit ? { result: r.audit.result, note: r.audit.note } : null },
        record: d.audit.slice(-10).map((x) => ({ action: x.action, actor: x.actor, allowed: x.allowed, reason: x.reason, denial: x.denial, toState: x.toState })),
        source: "The rule, its backtest, the Auditor's check and the record",
      };
      return { view, caption: `${r.ruleId}: ${r.title}. ${r.origin}.${bt ? ` Its backtest covered ${num(bt.covered)} lines with ${pct(bt.precision)} precision.` : ""}` };
    }
  }
}

function toMessage(m: { speaker: string; to: string; kind: "message" | "manager" | "denied"; source: "claude" | "code" | "scripted"; staged?: boolean; think: string[]; tools: { name: string; input: string; rows: string[][] }[]; text: string; code?: string; question?: StoryMessage["question"] }): StoryMessage {
  return {
    speaker: m.speaker, to: m.to, kind: m.kind, source: m.source, staged: !!m.staged, think: m.think,
    tools: m.tools.map((t) => ({ name: t.name, input: t.input, rows: t.rows.slice(0, 6) })), text: m.text, code: m.code ?? null, question: m.question ?? null,
  };
}

// What the model reads back from show: the view without the room's long tool tables.
function forModel(view: AskView): unknown {
  if (view.template !== "story") return view;
  return { ...view, messages: view.messages.map((m) => ({ speaker: m.speaker, to: m.to, text: m.text.slice(0, 280), findings: m.think.slice(0, 4) })) };
}

// ---------------- the model ----------------

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type Msg = { role: "user" | "assistant"; content: string | unknown[] };

async function claude(system: string, messages: Msg[], tools: unknown[]): Promise<{ content: Block[]; stop_reason: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the Convex deployment");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, messages, tools, tool_choice: { type: "auto" } }),
  });
  if (!res.ok) throw new Error(`Claude returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { content: Block[]; stop_reason: string };
}

const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required });
const TEMPLATES: Template[] = ["figure", "trend", "breakdown", "lines", "story"];
const CHANGE_ACTIONS = ["approve", "post", "settle", "answer", "hold", "block", "edit", "delete"] as const;

const TOOLS = [
  { name: "list_stories", description: "Every story the close opened (held lines grouped by cause): key, title, month, lines, amount, store, who was asked, and how it ended.", input_schema: obj({}) },
  { name: "list_rules", description: "Every rule: id, title, state, the month it was learned, and where it came from.", input_schema: obj({}) },
  {
    name: "show",
    description: "Show the answer on screen: pick the template and the named query that answers the question, with its parameters. Code runs the query, fills the template and returns the result to you. Queries:\n" +
      Object.entries(QUERIES).map(([n, q]) => `- ${n} (${q.template}): ${q.describe} Parameters: ${Object.entries(q.params).map(([k, s]) => `${k}${"required" in s && s.required ? "" : "?"}`).join(", ") || "none"}.`).join("\n"),
    input_schema: obj({ template: { type: "string", enum: TEMPLATES }, query: { type: "string", enum: Object.keys(QUERIES) }, params: { type: "object", description: "The query's parameters" } }, ["template", "query", "params"]),
  },
  {
    name: "request_change",
    description: "Use only when the person asks to change the books (approve, post, settle, answer a question, hold, block, edit or delete). You cannot change anything: the gateway refuses the request and records the refusal.",
    input_schema: obj({ action: { type: "string", enum: CHANGE_ACTIONS }, target: { type: "string", description: "What they asked to change: a rule id like r9, a story key, or their words" } }, ["action", "target"]),
  },
  {
    name: "speak",
    description: "Say your answer aloud. Call exactly once, last, after show. One or two short sentences.",
    input_schema: obj({ sentence: { type: "string", description: "Under 40 words. Every number in it must appear in the show result." } }, ["sentence"]),
  },
];

const SYSTEM = [
  `You answer spoken questions about the books of Fermata: autonomous cash reconciliation for a fictional Indonesian music retailer with 14 stores, Store 1 to Store 14 (codes S01 to S14). Everything is synthetic. The ${YEAR} books were closed month by month: an engine settles every bank line an approved rule explains; the rest are held and grouped into stories, each discussed by agents in a case room that then asks the Accountant or the CFO one question. Answers become rules.`,
  "You are read only. You can explain the books and never change them.",
  "How to answer: the stories and rules are listed with the question. Call show with the template and named query that best answers the question; code runs it and the result appears on screen in that template. Read the result, then call speak.",
  "Every number you say must appear in the show result, exactly as it is or rounded the way the result already rounds it. Never add, subtract, average or estimate. Explain with what the result says, including what the agents found in the case room; never add causes of your own, and never say what the books do not say.",
  "If the person asks you to change anything, call request_change first (the gateway refuses and records it), then show the item they meant if one fits, then speak: say you cannot change the books, and who can (the CFO approves rules; the Accountant or the CFO answers a case room's question).",
  "If no query fits, call speak and say plainly what you can answer instead, with no numbers.",
  "Voice: calm, plain, sentence case, no emoji, no exclamation marks, no dashes. Money like Rp 9.8bn or Rp 412m, counts with thousands separators like 1,186, shares like 98%. Say store names like Store 3. Do not describe the screen.",
  `Channels: ${Object.entries(CHANNEL_LABEL).map(([k, l]) => `${k} (${l.toLowerCase()})`).join(", ")}. Bank accounts: ${BANK_ACCOUNTS.map((b) => `${b.code} (${b.purpose})`).join("; ")}. Stores: ${STORES.map((s) => `${s.code} ${s.city}`).join(", ")}.`,
].join("\n\n");

const storyList = (ov: Overview) => [...ov.stories].sort((a, b) => a.month - b.month).map((s) => ({ key: s.key, title: s.title, month: MONTHS[s.month - 1], lines: s.count, amount: rpShort(s.amount), asked: s.askOf ?? "", outcome: s.resolution ?? "" }));
const ruleList = (ov: Overview) => [...ov.rules].sort((a, b) => Number(a.ruleId.slice(1)) - Number(b.ruleId.slice(1))).map((r) => ({ id: r.ruleId, title: r.title, state: r.state, learned: r.learnedInMonth ? MONTHS[r.learnedInMonth - 1] : "derived from last year", origin: r.origin }));

async function attemptChange(ctx: ActionCtx, input: Record<string, unknown>): Promise<Refusal> {
  const requested = String(input.action ?? "edit");
  const target = String(input.target ?? "").slice(0, 80);
  return await ctx.runMutation(internal.ask.refuse, { requested, target });
}

// The live path: one question in, one answer out. Used by `ask` and by the export script.
async function answerQuestion(ctx: ActionCtx, question: string): Promise<AskAnswer> {
  // The stories and rules go in up front, so most answers take two calls: show, then speak.
  const ov = await overview(ctx);
  const context = `Stories (key | title | month | lines | amount | asked | outcome):\n${storyList(ov).map((s) => Object.values(s).join(" | ")).join("\n")}\n\nRules (id | title | state | learned | origin):\n${ruleList(ov).map((r) => Object.values(r).join(" | ")).join("\n")}`;
  const messages: Msg[] = [{ role: "user", content: `${context}\n\nQuestion: ${question}` }];
  let shown: { view: AskView; caption: string; name: QueryName; params: Params } | null = null;
  let refusal: Refusal | null = null;
  const rejected: string[] = [];
  const done = (spoken: string, checked: boolean): AskAnswer => ({
    question, view: shown?.view ?? null, spoken, refusal, query: shown ? { name: shown.name, params: shown.params } : null, checked, real: checked, rejected,
  });
  const fallback = () => shown?.caption ?? (refusal ? `I can't change the books. ${refusal.denial}.` : "I can answer questions about this year's books: cash, held lines, stores, channels, case rooms and rules.");

  for (let round = 0; round < 7; round++) {
    const res = await claude(SYSTEM, messages, TOOLS);
    if (res.stop_reason === "refusal") break;
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
    if (!uses.length) { messages.push({ role: "user", content: [{ type: "text", text: shown ? "Call speak now." : "Call show, then speak." }] }); continue; }
    const results: unknown[] = [];
    for (const u of uses) {
      let out: unknown;
      if (u.name === "list_stories") out = storyList(ov);
      else if (u.name === "list_rules") out = ruleList(ov);
      else if (u.name === "show") {
        const q = String(u.input.query ?? "");
        const val = validateParams(q, u.input.params);
        if (!val.ok) out = { error: val.error };
        else if (QUERIES[val.name].template !== u.input.template) out = { error: `${q} fills the ${QUERIES[val.name].template} template, not ${String(u.input.template)}` };
        else {
          const b = await build(ctx, val.name, val.params);
          if ("error" in b) out = { error: b.error };
          else { shown = { ...b, name: val.name, params: val.params }; out = { shown: true, result: forModel(b.view) }; }
        }
      } else if (u.name === "request_change") {
        refusal = await attemptChange(ctx, u.input);
        out = { refused: true, denial: refusal.denial, recorded: "The gateway recorded this refusal in the audit log." };
      } else if (u.name === "speak") {
        const sentence = String(u.input.sentence ?? "").trim().replace(/\s+—\s+|\s+–\s+|\s-\s/g, ", ");
        const bad = uncheckedNumbers(sentence, [shown?.view ?? null, refusal, YEAR, YEAR - 1], question);
        if (sentence && !bad.length) return done(sentence, true);
        rejected.push(sentence);
        if (rejected.length > 1) return done(fallback(), false);
        out = { error: `These numbers are not in the result: ${bad.join(", ")}. Say it again using only numbers that appear in the result.` };
      } else out = { error: `unknown tool ${u.name}` };
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 12000) });
    }
    const nudge = round >= 4 ? [{ type: "text", text: "Call speak now." }] : [];
    messages.push({ role: "user", content: [...results, ...nudge] });
  }
  return done(fallback(), false);
}

// A requested change, sent through the gateway as the assistant. ROLES gives the assistant no actions, so the gateway
// refuses and writes the denial to the audit log, as it does for any role. Nothing on the item changes.
export const refuse = internalMutation({
  args: { requested: v.string(), target: v.string() },
  returns: v.object({ action: v.string(), target: v.string(), denial: v.string() }),
  handler: async (ctx, a): Promise<Refusal> => {
    const ACTION: Record<string, Action> = { approve: "approve", post: "post", settle: "post", answer: "answer", hold: "hold", block: "block" };
    const act = ACTION[a.requested] ?? "annotate";
    const t: Target = await ctx.runQuery(internal.askData.target, { target: a.target });
    if (!t) return { action: a.requested, target: a.target, denial: "Assistant may not change anything" };
    const r = await transition(ctx, { table: t.table as ItemTable, id: t.id as Id<ItemTable>, action: act, actor: "assistant", patch: {}, reason: `Asked to ${a.requested} ${a.target} from Ask the books` });
    return { action: a.requested, target: t.label, denial: r.ok ? "Refused" : r.denial };
  },
});

// ---------------- public: rate limited ----------------

export const ask = action({
  args: { question: v.string(), visitor: v.string() },
  handler: async (ctx, a): Promise<AskReply> => {
    const question = a.question.trim().slice(0, 240);
    if (!question) return { kind: "error", message: "Ask a question about the books." };
    if (!visitorOk(a.visitor)) return { kind: "error", message: "Reload the page and try again." };
    // A suggested question never reaches Claude, even when sent here directly.
    const preset = matchPreset(question);
    if (preset) return { kind: "preset", id: preset.id };
    const mine = await limiter.limit(ctx, "askVisitor", { key: a.visitor });
    if (!mine.ok) return { kind: "limited", message: LIMITED, retryAfter: mine.retryAfter };
    const all = await limiter.limit(ctx, "askDaily");
    if (!all.ok) return { kind: "limited", message: LIMITED, retryAfter: all.retryAfter };
    try {
      return { kind: "answer", answer: await answerQuestion(ctx, question) };
    } catch (err) {
      console.error("ask failed", String(err).slice(0, 300));
      return { kind: "error", message: "The books could not be read just now. Try a suggested question." };
    }
  },
});

// A Cartesia access token for the browser: speech out (TTS) and in (STT), valid for one minute. The API key stays here.
export const token = action({
  args: { visitor: v.string() },
  handler: async (ctx, a): Promise<{ kind: "token"; token: string; expiresIn: number } | { kind: "limited"; message: string } | { kind: "error"; message: string }> => {
    if (!visitorOk(a.visitor)) return { kind: "error", message: "Reload the page and try again." };
    const mine = await limiter.limit(ctx, "tokenVisitor", { key: a.visitor });
    if (!mine.ok) return { kind: "limited", message: "Voice is resting for a minute. Type your question instead." };
    const all = await limiter.limit(ctx, "tokenDaily");
    if (!all.ok) return { kind: "limited", message: "Voice is off for today. Type your question instead." };
    return await mint(60);
  },
});

async function mint(expiresIn: number): Promise<{ kind: "token"; token: string; expiresIn: number } | { kind: "error"; message: string }> {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) return { kind: "error", message: "Voice is not set up on this deployment." };
  const res = await fetch("https://api.cartesia.ai/access-token", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Cartesia-Version": CARTESIA_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ grants: { tts: true, stt: true }, expires_in: expiresIn }),
  });
  if (!res.ok) {
    // Structured errors for this Cartesia-Version: { error_code, title, message, request_id }.
    const body = (await res.json().catch(() => null)) as { error_code?: string | null; title?: string } | null;
    console.error("cartesia token failed", res.status, body?.error_code ?? "", body?.title ?? "");
    return { kind: "error", message: "Voice is unavailable right now." };
  }
  const { token } = (await res.json()) as { token: string };
  return { kind: "token", token, expiresIn };
}

// ---------------- internal: for scripts/export_ask.ts ----------------

// The same live path without the preset match or the limits, so the recording is made by the real thing.
export const answerForRecording = internalAction({
  args: { question: v.string() },
  handler: async (ctx, a): Promise<AskAnswer> => await answerQuestion(ctx, a.question),
});
