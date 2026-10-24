import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const state = v.union(
  v.literal("NEW"), v.literal("PROPOSED"), v.literal("APPROVED"), v.literal("POSTED"),
  v.literal("NEEDS_INFO"), v.literal("HELD"), v.literal("WAITING"),
);
export const role = v.union(
  v.literal("sync"), v.literal("engine"), v.literal("investigator"), v.literal("learner"),
  v.literal("auditor"), v.literal("accountant"), v.literal("cfo"), v.literal("gateway"), v.literal("manager"), v.literal("assistant"),
);
const store = v.string();
const channel = v.string();

const vote = v.object({ store, score: v.number(), reasons: v.array(v.string()) });
export const placement = v.object({ store: v.union(store, v.null()), confidence: v.number(), votes: v.array(vote) });

export default defineSchema({
  // ---------- master data ----------
  stores: defineTable({ code: store, number: v.number(), name: v.string(), city: v.string(), terminals: v.number(), cardBank: v.string() })
    .index("by_code", ["code"]),
  bank_accounts: defineTable({ code: v.string(), name: v.string(), purpose: v.string(), statementBalance: v.number() })
    .index("by_code", ["code"]),
  ledger_accounts: defineTable({ code: v.string(), bankAccount: v.string(), store, bookBalance: v.number() })
    .index("by_bank", ["bankAccount"]),

  // ---------- synced bank lines and books ----------
  bank_transactions: defineTable({
    key: v.string(), year: v.number(), month: v.number(), date: v.string(), account: v.string(),
    direction: v.union(v.literal("in"), v.literal("out")), amount: v.number(), memo: v.string(),
    // Ground truth for evaluation only. The engine port strips it before evaluation.
    truth: v.object({ store: v.union(store, v.null()), channel, story: v.union(v.string(), v.null()) }),
  })
    .index("by_key", ["key"])
    .index("by_year_month_date", ["year", "month", "date"])
    .index("by_account_date", ["account", "date"]),
  erp_invoices: defineTable({
    key: v.string(), year: v.number(), kind: v.union(v.literal("card_sales"), v.literal("installment_sale")), store,
    date: v.string(), recordedOn: v.string(), terminal: v.optional(v.number()), debitGross: v.optional(v.number()),
    creditGross: v.optional(v.number()), lender: v.optional(v.string()), amount: v.optional(v.number()), applied: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_store_kind_date", ["store", "kind", "date"])
    .index("by_kind_lender_date", ["kind", "lender", "date"]),
  cash_book: defineTable({ key: v.string(), year: v.number(), store, date: v.string(), cashSales: v.number(), pettyCashKept: v.number(), recordedOn: v.string(), applied: v.number() })
    .index("by_key", ["key"])
    .index("by_store_date", ["store", "date"]),
  marketplace_orders: defineTable({ key: v.string(), year: v.number(), platform: v.string(), store, week: v.string(), date: v.string(), amount: v.number(), refund: v.number(), applied: v.number() })
    .index("by_key", ["key"])
    .index("by_platform_store_week", ["platform", "store", "week"]),
  gateway_settlements: defineTable({ key: v.string(), year: v.number(), store, batchRef: v.string(), date: v.string(), gross: v.number(), fee: v.number(), net: v.number(), recordedOn: v.string(), applied: v.number() })
    .index("by_key", ["key"])
    .index("by_batch", ["batchRef"]),
  dealer_invoices: defineTable({ key: v.string(), year: v.number(), dealer: v.string(), store, invoiceNo: v.string(), date: v.string(), amount: v.number(), recordedOn: v.string(), applied: v.number() })
    .index("by_key", ["key"])
    .index("by_invoice", ["invoiceNo"])
    .index("by_dealer_date", ["dealer", "date"]),
  school_receipts: defineTable({ key: v.string(), year: v.number(), store, studentRef: v.string(), method: v.union(v.literal("va"), v.literal("cash")), week: v.string(), date: v.string(), amount: v.number(), recordedOn: v.string(), applied: v.number() })
    .index("by_key", ["key"])
    .index("by_student_date", ["studentRef", "date"])
    .index("by_store_week", ["store", "week"]),

  // ---------- the state machine ----------
  // kind "bank_txn": one per bank line. kind "month": one per month, carries the month's counters.
  // kind "close": the single run controller.
  work_items: defineTable({
    kind: v.union(v.literal("bank_txn"), v.literal("month"), v.literal("close")),
    ref: v.string(),
    state,
    year: v.number(),
    month: v.number(),
    amount: v.optional(v.number()),
    channel: v.optional(channel),
    proposer: v.optional(role),
    placement: v.optional(placement),
    ruleIds: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    gap: v.optional(v.string()),
    storyKey: v.optional(v.string()),
    counterpartTable: v.optional(v.string()),
    counterpartCount: v.optional(v.number()),
    counterpartSample: v.optional(v.array(v.object({ key: v.string(), amount: v.number() }))),
    facts: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    firstPassMonth: v.optional(v.number()),
    settledMonth: v.optional(v.number()),
    everHeld: v.optional(v.boolean()),
    settledBy: v.optional(v.union(v.literal("rule"), v.literal("person"))),
    stats: v.optional(v.record(v.string(), v.number())),
    run: v.optional(v.object({
      phase: v.string(), month: v.number(), cursor: v.union(v.string(), v.null()), pausedFor: v.union(v.string(), v.null()),
      autopilot: v.boolean(), startedAt: v.number(), finishedAt: v.union(v.number(), v.null()), rerunRule: v.union(v.string(), v.null()),
    })),
  })
    .index("by_ref", ["ref"])
    .index("by_kind_state", ["kind", "state"])
    .index("by_kind_month_state", ["kind", "month", "state"])
    .index("by_story", ["storyKey"]),

  stories: defineTable({
    key: v.string(), state, month: v.number(), gap: v.string(), title: v.string(), store: v.union(store, v.null()),
    channel, counterparty: v.string(), count: v.number(), amount: v.number(), stores: v.array(store),
    narrated: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"), v.null()),
    askOf: v.optional(role), resolution: v.optional(v.string()), heldAtYearEnd: v.optional(v.number()), proposer: v.optional(role),
    investigation: v.optional(v.object({ summary: v.string(), hypothesis: v.string(), real: v.boolean() })),
    auditorOpinion: v.optional(v.object({ text: v.string(), real: v.boolean() })),
    // The case room for this story: meeting -> asked (one question out) -> closed (answered).
    room: v.optional(v.object({ state: v.union(v.literal("meeting"), v.literal("asked"), v.literal("closed")), turns: v.number(), live: v.boolean() })),
  })
    .index("by_key", ["key"])
    .index("by_month", ["month"]),
  rules: defineTable({
    ruleId: v.string(), version: v.number(), title: v.string(), state,
    program: v.string(), // JSON of a RuleProgram
    origin: v.string(), proposer: role, approvedBy: v.optional(role),
    seen: v.optional(v.object({ count: v.number(), scope: v.string() })),
    settledCount: v.number(),
    backtest: v.optional(v.object({ covered: v.number(), correct: v.number(), errors: v.number(), precision: v.number(), coverage: v.number(), scope: v.string(), examples: v.array(v.string()) })),
    audit: v.optional(v.object({ result: v.union(v.literal("pass"), v.literal("flag"), v.literal("block")), note: v.string(), counterexamples: v.number(), real: v.boolean() })),
    learnedInMonth: v.optional(v.number()),
    real: v.boolean(), // written by Claude (true) or seeded/scripted (false)
  })
    .index("by_ruleId", ["ruleId"]),
  // One row per thing said in a case room. Agents talk to each other; the manager (code) gives the floor and records.
  room_messages: defineTable({
    storyKey: v.string(), month: v.number(), seq: v.number(), turn: v.number(),
    speaker: v.string(), to: v.string(),
    kind: v.union(v.literal("message"), v.literal("manager"), v.literal("denied")),
    status: v.union(v.literal("working"), v.literal("done")),
    source: v.union(v.literal("claude"), v.literal("code"), v.literal("scripted")),
    staged: v.optional(v.boolean()),
    think: v.array(v.string()),
    tools: v.array(v.object({ name: v.string(), input: v.string(), rows: v.array(v.array(v.string())) })),
    text: v.string(),
    code: v.optional(v.string()),
    // The one question an agent proposes for a person; the manager sends the latest one out when the meeting closes.
    question: v.optional(v.object({ askOf: v.union(v.literal("cfo"), v.literal("accountant")), text: v.string(), options: v.array(v.object({ id: v.string(), label: v.string(), impact: v.string() })) })),
    at: v.number(),
  }).index("by_story_seq", ["storyKey", "seq"]),
  precedents: defineTable({ storyKey: v.string(), answer: v.string(), actor: role, effect: v.string(), at: v.number() })
    .index("by_story", ["storyKey"]),
  questions: defineTable({
    storyKey: v.string(), state, askOf: role, text: v.string(),
    options: v.array(v.object({ id: v.string(), label: v.string(), impact: v.string() })),
    answer: v.optional(v.string()), answeredBy: v.optional(role), confirmed: v.optional(v.boolean()), proposer: v.optional(role),
    real: v.boolean(), month: v.number(),
  })
    .index("by_story", ["storyKey"])
    .index("by_state", ["state"]),
  trace_events: defineTable({
    agent: v.union(v.literal("investigator"), v.literal("learner"), v.literal("auditor"), v.literal("engine"), v.literal("accountant"), v.literal("cfo"), v.literal("gateway")),
    month: v.number(), storyKey: v.optional(v.string()), ruleId: v.optional(v.string()),
    kind: v.union(v.literal("thought"), v.literal("tool"), v.literal("result"), v.literal("denied"), v.literal("decision")),
    text: v.string(), real: v.boolean(), staged: v.optional(v.boolean()), at: v.number(),
  })
    .index("by_agent_month", ["agent", "month"])
    .index("by_story", ["storyKey"])
    .index("by_rule", ["ruleId"]),
  // Lines settled by a rule post as one summary entry per month, account, store and authority (`key`, `lines`).
  // A person's decision posts per line (`workItemId`).
  journal_entries: defineTable({
    workItemId: v.optional(v.id("work_items")), key: v.optional(v.string()), month: v.optional(v.number()), lines: v.optional(v.number()),
    date: v.string(), store: v.union(store, v.null()), debit: v.string(), credit: v.string(),
    amount: v.number(), authority: v.string(),
  }).index("by_work_item", ["workItemId"]).index("by_key", ["key"]),
  eval_runs: defineTable({ kind: v.string(), at: v.number(), result: v.record(v.string(), v.union(v.string(), v.number())) })
    .index("by_kind", ["kind"]),
  audit_log: defineTable({
    itemTable: v.string(), itemId: v.string(), itemRef: v.string(), action: v.string(), actor: role,
    fromState: v.union(state, v.null()), toState: v.union(state, v.null()),
    diff: v.array(v.object({ field: v.string(), before: v.string(), after: v.string() })),
    reason: v.string(), authority: v.union(v.string(), v.null()), allowed: v.boolean(), denial: v.union(v.string(), v.null()),
    month: v.number(), staged: v.optional(v.boolean()),
    // Present when one row records several steps on the same item (sync, engine, gateway settling a line).
    steps: v.optional(v.array(v.object({ action: v.string(), actor: role, toState: v.union(state, v.null()) }))),
  })
    .index("by_item", ["itemId"])
    .index("by_allowed", ["allowed"]),
});
