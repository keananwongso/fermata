// The one way state changes in Fermata. Every change and every denied attempt writes an audit_log row
// in the same mutation as the change itself.
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { MONTH_LABELS } from "./domain";

export type State = "NEW" | "PROPOSED" | "APPROVED" | "POSTED" | "NEEDS_INFO" | "HELD" | "WAITING";
export type Role = "sync" | "engine" | "investigator" | "learner" | "auditor" | "accountant" | "cfo" | "gateway";
export type Action = "create" | "propose" | "wait" | "hold" | "ask" | "answer" | "approve" | "post" | "flag" | "block" | "annotate";
export type ItemTable = "work_items" | "stories" | "rules" | "questions";

// ROLES: what each role may do, and on which kinds of item.
export const ROLES: Record<Role, { label: string; actions: Partial<Record<Action, ItemTable[]>> }> = {
  sync: { label: "Sync", actions: { create: ["work_items"] } },
  engine: { label: "Engine", actions: {
    create: ["work_items", "stories"], propose: ["work_items"], wait: ["work_items"], hold: ["work_items", "stories"],
    approve: ["work_items"], annotate: ["work_items", "stories", "rules"],
  } },
  investigator: { label: "Investigator", actions: { ask: ["stories", "questions"], annotate: ["stories", "questions"], propose: ["stories", "questions", "work_items"], create: ["questions"] } },
  learner: { label: "Learner", actions: { create: ["rules"], propose: ["rules"], annotate: ["rules"] } },
  auditor: { label: "Auditor", actions: { flag: ["rules", "stories"], block: ["rules"], annotate: ["rules", "stories"] } },
  accountant: { label: "Accountant", actions: { answer: ["questions"], approve: ["work_items", "stories", "questions"], hold: ["work_items", "stories"], propose: ["work_items"] } },
  cfo: { label: "CFO", actions: { answer: ["questions"], approve: ["work_items", "stories", "questions", "rules"], hold: ["work_items", "stories"], block: ["rules"] } },
  gateway: { label: "Gateway", actions: { post: ["work_items", "stories"] } },
};

// TRANSITIONS: which state changes exist at all. `to: null` keeps the state (an annotation).
export const TRANSITIONS: { action: Action; from: (State | null)[]; to: State | null }[] = [
  { action: "create", from: [null], to: "NEW" },
  { action: "propose", from: ["NEW", "WAITING", "HELD", "NEEDS_INFO"], to: "PROPOSED" },
  { action: "wait", from: ["NEW", "WAITING"], to: "WAITING" },
  { action: "hold", from: ["NEW", "WAITING", "PROPOSED", "NEEDS_INFO", "HELD"], to: "HELD" },
  { action: "ask", from: ["NEW", "HELD"], to: "NEEDS_INFO" },
  { action: "answer", from: ["NEEDS_INFO"], to: "PROPOSED" },
  { action: "approve", from: ["PROPOSED"], to: "APPROVED" },
  { action: "post", from: ["APPROVED"], to: "POSTED" },
  { action: "block", from: ["PROPOSED", "NEW"], to: "HELD" },
  { action: "flag", from: ["NEW", "PROPOSED", "APPROVED", "HELD", "NEEDS_INFO"], to: null },
  { action: "annotate", from: ["NEW", "PROPOSED", "APPROVED", "POSTED", "HELD", "NEEDS_INFO", "WAITING"], to: null },
];

export type Patch = Record<string, unknown>;
type AnyItem = Doc<"work_items"> | Doc<"stories"> | Doc<"rules"> | Doc<"questions">;

export interface TransitionArgs {
  table: ItemTable;
  id: Id<ItemTable> | null; // null only for create
  action: Action;
  actor: Role;
  patch: Patch;
  reason: string;
  authority?: string | null;
  staged?: boolean; // a deliberately staged attempt (labelled in the record)
  month?: number;
  insert?: Record<string, unknown>; // the full new document for create
}
export type TransitionResult = { ok: true; id: Id<ItemTable> } | { ok: false; denial: string };

function show(x: unknown): string {
  if (x === undefined || x === null) return "";
  if (typeof x === "number") return String(x);
  if (typeof x === "string") return x;
  const s = JSON.stringify(x);
  return s.length > 160 ? s.slice(0, 157) + "..." : s;
}

function refOf(table: ItemTable, doc: Record<string, unknown>): string {
  if (table === "work_items") return String(doc.ref);
  if (table === "stories") return String(doc.key);
  if (table === "rules") return `${doc.ruleId} v${doc.version}`;
  return `question on ${doc.storyKey}`;
}

// Checks an authority string like "rule r3 v1, approved by CFO" against the rules table.
async function checkRuleAuthority(ctx: MutationCtx, authority: string | null | undefined, amount: number, ruleCache?: Map<string, Doc<"rules"> | null>): Promise<string | null> {
  if (!authority) return "The engine may approve only under an approved rule, and none was given";
  const ids = [...authority.matchAll(/rule (r\d+) v(\d+)/g)];
  if (!ids.length) return "Authority does not name a rule";
  for (const [, ruleId, ver] of ids) {
    let r = ruleCache?.get(ruleId);
    if (r === undefined) {
      r = await ctx.db.query("rules").withIndex("by_ruleId", (q) => q.eq("ruleId", ruleId)).order("desc").first();
      ruleCache?.set(ruleId, r);
    }
    if (!r) return `Rule ${ruleId} does not exist`;
    if (r.state !== "APPROVED" && r.state !== "POSTED") return `Rule ${ruleId} is not approved`;
    if (String(r.version) !== ver) return `Rule ${ruleId} is at v${r.version}, not v${ver}`;
    const program = JSON.parse(r.program) as { limitIdr: number };
    if (amount > program.limitIdr) return `Amount is above rule ${ruleId}'s limit`;
  }
  return null;
}

export async function transition(ctx: MutationCtx, a: TransitionArgs, ruleCache?: Map<string, Doc<"rules"> | null>): Promise<TransitionResult> {
  const doc = a.id ? ((await ctx.db.get(a.id)) as AnyItem | null) : null;
  const from = (doc ? (doc as { state: State }).state : null) as State | null;
  const month = a.month ?? (doc && "month" in doc && typeof doc.month === "number" ? doc.month : 0);
  const ref = doc ? refOf(a.table, doc as unknown as Record<string, unknown>) : refOf(a.table, a.insert ?? {});

  const deny = async (denial: string): Promise<TransitionResult> => {
    await ctx.db.insert("audit_log", {
      itemTable: a.table, itemId: a.id ?? "", itemRef: ref, action: a.action, actor: a.actor, fromState: from, toState: from,
      diff: [], reason: a.reason, authority: a.authority ?? null, allowed: false, denial, month, staged: a.staged,
    });
    return { ok: false, denial };
  };

  const allowedTables = ROLES[a.actor].actions[a.action];
  if (!allowedTables) return deny(`${ROLES[a.actor].label} may not ${a.action}`);
  if (!allowedTables.includes(a.table)) return deny(`${ROLES[a.actor].label} may not ${a.action} a ${a.table.replace("_", " ").replace(/s$/, "")}`);
  if (a.id && !doc) return deny("Item does not exist");
  const rule = TRANSITIONS.find((t) => t.action === a.action && t.from.includes(from));
  if (!rule) return deny(`Cannot ${a.action} an item that is ${from ?? "not created"}`);

  if (a.action === "approve" && doc) {
    const proposer = (doc as { proposer?: Role }).proposer;
    if (a.actor === "engine") {
      if (a.table !== "work_items") return deny("The engine approves only settlements");
      const amount = (doc as Doc<"work_items">).amount ?? 0;
      const why = await checkRuleAuthority(ctx, a.authority, amount, ruleCache);
      if (why) return deny(why);
    } else if (proposer === a.actor) {
      return deny(`${ROLES[a.actor].label} cannot approve its own proposal`);
    }
    if (a.table === "rules" && a.actor !== "cfo") return deny("Only the CFO approves rules");
  }

  const to = rule.to ?? from;
  const diff: { field: string; before: string; after: string }[] = [];
  if (from !== to) diff.push({ field: "state", before: from ?? "", after: to ?? "" });
  const source: Record<string, unknown> = (doc as unknown as Record<string, unknown>) ?? {};
  for (const [k, val] of Object.entries(a.patch)) {
    const before = show(source[k]);
    const after = show(val);
    if (before !== after) diff.push({ field: k, before, after });
  }

  let id = a.id;
  if (a.action === "create") {
    const fields = { ...(a.insert ?? {}), ...a.patch, state: "NEW" } as never;
    id = await ctx.db.insert(a.table, fields) as Id<ItemTable>;
    for (const [k, val] of Object.entries(a.insert ?? {})) if (k !== "state" && ["ref", "key", "ruleId", "amount", "storyKey", "title"].includes(k)) diff.push({ field: k, before: "", after: show(val) });
  } else {
    await ctx.db.patch(a.id!, { ...a.patch, state: to } as never);
  }
  await ctx.db.insert("audit_log", {
    itemTable: a.table, itemId: id!, itemRef: ref, action: a.action, actor: a.actor, fromState: from, toState: to,
    diff, reason: a.reason, authority: a.authority ?? null, allowed: true, denial: null, month, staged: a.staged,
  });
  return { ok: true, id: id! };
}

export function monthLabel(m: number): string { return m >= 1 && m <= 12 ? MONTH_LABELS[m - 1] : "Year end"; }
