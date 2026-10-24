// Ask the books: what an answer looks like, and the small set of named, read-only queries that fill it.
// The model picks a query and its parameters; code runs the query and fills the template, so every number on
// screen comes from the data. The spoken sentence is checked against the query's result before it is used.
// Shared by the Convex functions, the export script and the browser.
import { BANK_ACCOUNTS, STORES, type Channel } from "./domain";
import { num, pct, rpShort } from "./format";

export type Unit = "rp" | "count" | "pct";
export type Template = "figure" | "trend" | "breakdown" | "lines" | "story";

export type FigureView = {
  template: "figure"; title: string; label: string; value: number; unit: Unit;
  compare: { label: string; value: number; unit: Unit } | null; note: string | null; source: string;
};
export type TrendView = {
  template: "trend"; title: string; unit: Unit; style: "line" | "bars";
  points: { label: string; value: number }[]; marks: { at: string; label: string }[]; source: string;
};
export type BreakdownView = {
  template: "breakdown"; title: string; unit: Unit; tone: "hold" | "accent";
  rows: { label: string; value: number; sub: string | null }[]; total: number; source: string;
};
export type LineRow = {
  date: string; account: string; memo: string; amount: number; outcome: "settled" | "waiting" | "held" | "open";
  rule: string | null; store: string | null; note: string | null;
};
export type LinesView = { template: "lines"; title: string; rows: LineRow[]; shown: number; matched: number; amount: number; source: string };
export type StoryMessage = {
  speaker: string; to: string; kind: "message" | "manager" | "denied"; source: "claude" | "code" | "scripted"; staged: boolean;
  think: string[]; tools: { name: string; input: string; rows: string[][] }[]; text: string; code: string | null;
  question: { askOf: "cfo" | "accountant"; text: string; options: { id: string; label: string; impact: string }[] } | null;
};
export type StoryView = {
  template: "story"; kind: "story" | "rule"; title: string; subtitle: string; state: string;
  facts: { label: string; value: string }[];
  messages: StoryMessage[];
  question: { askOf: string; text: string; answer: string | null; impact: string | null; real: boolean } | null;
  rule: {
    id: string; title: string; state: string; origin: string; real: boolean; program: string;
    backtest: { covered: number; correct: number; errors: number; precision: number; scope: string } | null;
    audit: { result: string; note: string } | null;
  } | null;
  record: { action: string; actor: string; allowed: boolean; reason: string; denial: string | null; toState: string | null }[];
  source: string;
};
export type AskView = FigureView | TrendView | BreakdownView | LinesView | StoryView;
export type Refusal = { action: string; target: string; denial: string };

// What one answer is: the view, the sentence that is spoken, and (when someone asked for a change) the gateway's
// refusal. `checked` says the sentence's numbers were found in the query result; when they were not, the sentence
// is the view's own caption, written by code.
export type AskAnswer = {
  question: string; view: AskView | null; spoken: string; refusal: Refusal | null;
  query: { name: string; params: Record<string, string | number> } | null; checked: boolean; real: boolean;
  // Sentences the number check sent back, kept for review.
  rejected: string[];
};
export type AskReply =
  | { kind: "answer"; answer: AskAnswer }
  | { kind: "preset"; id: string }
  | { kind: "limited"; message: string; retryAfter: number | null }
  | { kind: "error"; message: string };

export const LIMITED = "I can only answer the suggested questions right now.";

// ---------------- named queries ----------------

const CHANNELS: Channel[] = ["card", "cash", "marketplace", "website", "dealer", "lender", "school_va", "school_cash", "transfer_pair", "unknown"];
export const CHANNEL_LABEL: Record<string, string> = {
  card: "Card batches", cash: "Cash deposits", marketplace: "Marketplace payouts", website: "Website settlements", dealer: "Dealer transfers",
  lender: "Lender payouts", school_va: "School fees (virtual)", school_cash: "School fees (cash)", transfer_pair: "Internal transfers", unknown: "Unknown senders",
};
export const ACCOUNT_LABEL: Record<string, string> = Object.fromEntries(BANK_ACCOUNTS.map((b) => [b.code, b.name]));
export const MONTHLY_MEASURES = ["first_pass_share", "first_pass_settled", "held", "waiting", "settled_later", "settled_by_new_rule", "rooms", "lines"] as const;
export type MonthlyMeasure = (typeof MONTHLY_MEASURES)[number];

type ParamKind = "month" | "store" | "channel" | "account" | "outcome" | "counterparty" | "story" | "rule" | { oneOf: readonly string[] };
type ParamSpec = { kind: ParamKind; required?: boolean; describe: string };
export type QuerySpec = { template: Template; describe: string; params: Record<string, ParamSpec> };

export const QUERIES = {
  cash_position: {
    template: "figure", describe: "Cash the bank statements say we hold, compared with what the books say. Optionally one bank account.",
    params: { account: { kind: "account", describe: "Bank account code" } },
  },
  first_pass_share: {
    template: "figure", describe: "Share of a month's bank lines settled on the first pass by approved rules, compared with January. Defaults to December.",
    params: { month: { kind: "month", describe: "Month 1 to 12" } },
  },
  held_now: {
    template: "figure", describe: "Bank lines still held after the year closed, and their amount, compared with all lines held at some point in the year. Optionally one store or channel.",
    params: { store: { kind: "store", describe: "Store code S01 to S14" }, channel: { kind: "channel", describe: "Channel" } },
  },
  monthly: {
    template: "trend", describe: "One measure month by month across the year: first_pass_share (share settled on the first pass), first_pass_settled, held, waiting, settled_later (waiting lines settled in a later month), settled_by_new_rule (held lines settled by a newly learned rule), rooms (case rooms opened), lines (bank lines).",
    params: { measure: { kind: { oneOf: MONTHLY_MEASURES }, required: true, describe: "The measure" } },
  },
  held_breakdown: {
    template: "breakdown", describe: "Bank lines still held after the year closed, grouped by store, channel, bank account or story. Optionally only lines from one month.",
    params: { by: { kind: { oneOf: ["store", "channel", "account", "story"] }, required: true, describe: "How to group" }, month: { kind: "month", describe: "Month 1 to 12" } },
  },
  stories_breakdown: {
    template: "breakdown", describe: "Everything held at some point in the year (every story, including ones later settled), grouped by store, channel, month or kind of gap, measured in lines, rupiah or stories.",
    params: { by: { kind: { oneOf: ["store", "channel", "month", "gap"] }, required: true, describe: "How to group" }, measure: { kind: { oneOf: ["lines", "amount", "stories"] }, describe: "What to count; defaults to lines" } },
  },
  bank_lines: {
    template: "lines", describe: "A table of bank lines with their outcome, rule and store. Filter by any of month, channel, store (where it was booked), account, outcome, counterparty (text in the bank memo, like FIN_Z or SHOPEE) or story. Shows up to 15 and counts all matches.",
    params: {
      month: { kind: "month", describe: "Month 1 to 12" }, channel: { kind: "channel", describe: "Channel" }, store: { kind: "store", describe: "Store code S01 to S14" },
      account: { kind: "account", describe: "Bank account code" }, outcome: { kind: "outcome", describe: "settled, waiting or held" },
      counterparty: { kind: "counterparty", describe: "Text in the bank memo, like FIN_Z, SHOPEE or a dealer name" }, story: { kind: "story", describe: "Story key from list_stories" },
    },
  },
  story: {
    template: "story", describe: "One held story and its case room: what was held, who said what, the question, the answer and the record. Use a key from list_stories.",
    params: { story: { kind: "story", required: true, describe: "Story key from list_stories" } },
  },
  rule: {
    template: "story", describe: "One rule: where it came from, its backtest, the Auditor's check, who approved it and the record.",
    params: { rule: { kind: "rule", required: true, describe: "Rule id like r8" } },
  },
} as const satisfies Record<string, QuerySpec>;
export type QueryName = keyof typeof QUERIES;
export type Params = Record<string, string | number>;

const STORE_CODES = new Set(STORES.map((s) => s.code));
const ACCOUNTS = new Set<string>(BANK_ACCOUNTS.map((b) => b.code));

function normStore(x: unknown): string | null {
  const s = String(x ?? "").trim().toUpperCase().replace(/^STORE\s*/, "");
  const n = Number(s.replace(/^S/, ""));
  const code = Number.isInteger(n) && n >= 1 && n <= 14 ? `S${String(n).padStart(2, "0")}` : s;
  return STORE_CODES.has(code as never) ? code : null;
}

// Checks and normalises the model's parameters. Unknown parameters are refused rather than ignored, so a query
// never silently answers a different question.
export function validateParams(name: string, raw: unknown): { ok: true; name: QueryName; params: Params } | { ok: false; error: string } {
  if (!(name in QUERIES)) return { ok: false, error: `unknown query ${name}; use one of ${Object.keys(QUERIES).join(", ")}` };
  const spec = QUERIES[name as QueryName] as QuerySpec;
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Params = {};
  for (const k of Object.keys(input)) {
    if (input[k] === null || input[k] === undefined || input[k] === "") continue;
    if (!(k in spec.params)) return { ok: false, error: `${name} takes no parameter ${k}; it takes ${Object.keys(spec.params).join(", ") || "none"}` };
  }
  for (const [k, p] of Object.entries(spec.params)) {
    const val = input[k];
    if (val === null || val === undefined || val === "") {
      if (p.required) return { ok: false, error: `${name} needs ${k} (${p.describe})` };
      continue;
    }
    const kind = p.kind;
    if (typeof kind === "object") {
      const s = String(val).toLowerCase();
      if (!kind.oneOf.includes(s)) return { ok: false, error: `${k} must be one of ${kind.oneOf.join(", ")}` };
      out[k] = s;
    } else if (kind === "month") {
      const m = Number(val);
      if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false, error: "month must be a whole number from 1 to 12" };
      out[k] = m;
    } else if (kind === "store") {
      const s = normStore(val);
      if (!s) return { ok: false, error: "store must be a store code from S01 to S14" };
      out[k] = s;
    } else if (kind === "channel") {
      const s = String(val).toLowerCase();
      if (!CHANNELS.includes(s as Channel)) return { ok: false, error: `channel must be one of ${CHANNELS.join(", ")}` };
      out[k] = s;
    } else if (kind === "account") {
      const s = String(val).toUpperCase();
      if (!ACCOUNTS.has(s)) return { ok: false, error: `account must be one of ${[...ACCOUNTS].join(", ")}` };
      out[k] = s;
    } else if (kind === "outcome") {
      const s = String(val).toLowerCase();
      if (!["settled", "waiting", "held"].includes(s)) return { ok: false, error: "outcome must be settled, waiting or held" };
      out[k] = s;
    } else if (kind === "counterparty") {
      const s = String(val).toUpperCase().trim();
      if (!/^[A-Z0-9_ -]{2,30}$/.test(s)) return { ok: false, error: "counterparty must be 2 to 30 letters, digits, spaces or underscores" };
      out[k] = s;
    } else if (kind === "story") {
      const s = String(val).trim();
      if (!/^[a-z_]+\|[A-Za-z0-9_|]+$/.test(s) || s.length > 60) return { ok: false, error: "story must be a key from list_stories" };
      out[k] = s;
    } else if (kind === "rule") {
      const s = String(val).trim().toLowerCase();
      if (!/^r\d{1,2}$/.test(s)) return { ok: false, error: "rule must be an id like r8" };
      out[k] = s;
    }
  }
  return { ok: true, name: name as QueryName, params: out };
}

// ---------------- the number check ----------------

// Number tokens as a sentence writes them: "1,186", "98.1", "54". Commas and a trailing ".0" are dropped.
export function numberTokens(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => t.replace(/,(?=\d{3}\b)/g, "").replace(/\.0+$/, ""));
}

function spellings(n: number): string[] {
  const out = [String(n), num(n), rpShort(n).replace(/^(minus )?Rp /, "")];
  const a = Math.abs(n);
  out.push(String(a));
  if (a > 0 && a <= 1) for (const d of [0, 1, 2]) out.push(pct(a, d).replace("%", ""));
  for (const [div, digits] of [[1e9, [0, 1, 2]], [1e6, [0, 1]], [1e3, [0]]] as const) {
    if (a >= div) for (const d of digits) out.push((a / div).toFixed(d));
  }
  return out;
}

function collect(x: unknown, nums: number[], strs: string[]) {
  if (typeof x === "number") nums.push(x);
  else if (typeof x === "string") strs.push(x);
  else if (Array.isArray(x)) for (const y of x) collect(y, nums, strs);
  else if (x && typeof x === "object") for (const y of Object.values(x)) collect(y, nums, strs);
}

// Every number the spoken sentence uses must appear in what the query returned (or in the question itself).
// Store names, rule ids and lender codes are names, not figures, so they are not checked.
export function uncheckedNumbers(sentence: string, result: unknown, question: string): string[] {
  sentence = sentence.replace(/\bstores? \d{1,2}(?:(?:,| and| or) \d{1,2})*\b/gi, "store").replace(/\b[rS]\d{1,2}\b/g, "id").replace(/\bFIN_[A-Z]\b/g, "lender");
  const nums: number[] = [];
  const strs: string[] = [question];
  collect(result, nums, strs);
  const allowed = new Set<string>();
  for (const n of nums) for (const s of spellings(n)) for (const t of numberTokens(s)) allowed.add(t);
  for (const s of strs) for (const t of numberTokens(s)) allowed.add(t);
  return numberTokens(sentence).filter((t) => !allowed.has(t));
}

// ---------------- display helpers shared by the views ----------------

export function formatValue(v: number, unit: Unit): string {
  return unit === "rp" ? rpShort(v) : unit === "pct" ? pct(v) : num(v);
}
