// The one way state changes in Fermata. Every change and every denied attempt writes an audit_log row
// in the same mutation as the change itself.
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { MONTH_LABELS } from "./domain";

export type State = "NEW" | "PROPOSED" | "APPROVED" | "POSTED" | "NEEDS_INFO" | "HELD" | "WAITING";
export type Role = "sync" | "engine" | "investigator" | "learner" | "auditor" | "accountant" | "cfo" | "gateway" | "manager" | "assistant";
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
  // The case room's chair. Code, not an LLM: it records, closes the meeting and sends its one question out.
  manager: { label: "Meeting manager", actions: { create: ["questions"], ask: ["stories", "questions"], annotate: ["stories"] } },
  // Ask the books. It explains the books and may do nothing to them: every attempt is refused here and recorded.
  assistant: { label: "Assistant", actions: {} },
};

// Who may speak in a case room. People and the gateway are outside the room.
export const ROOM_SPEAKERS: Role[] = ["engine", "investigator", "auditor", "learner"];

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

// One step of a chain. A chain runs on one item, checks every step exactly as a lone transition would,
// then writes the item once and one audit row listing the steps. Used where the engine settles a line
// (sync creates, engine proposes and approves, gateway posts): one row instead of four.
export type Step = Omit<TransitionArgs, "table" | "id" | "month">;
type StepRecord = { action: string; actor: Role; toState: State | null };

// Bulky fields are summarised in the diff; the full value stays on the item itself.
function showField(field: string, x: unknown): string {
  if (field === "placement" && x && typeof x === "object") {
    const p = x as { store: string | null; confidence: number };
    return `${p.store ?? "none"} ${Math.round(p.confidence * 100)}%`;
  }
  if (field === "counterpartSample" && Array.isArray(x)) return `${x.length} rows`;
  return show(x);
}

async function check(ctx: MutationCtx, table: ItemTable, a: Step, cur: Record<string, unknown> | null, from: State | null, ruleCache?: Map<string, Doc<"rules"> | null>): Promise<{ denial: string } | { to: State | null }> {
  const allowedTables = ROLES[a.actor].actions[a.action];
  if (!allowedTables) return { denial: `${ROLES[a.actor].label} may not ${a.action}` };
  if (!allowedTables.includes(table)) return { denial: `${ROLES[a.actor].label} may not ${a.action} a ${table.replace("_", " ").replace(/s$/, "")}` };
  if (a.action !== "create" && !cur) return { denial: "Item does not exist" };
  const rule = TRANSITIONS.find((t) => t.action === a.action && t.from.includes(from));
  if (!rule) return { denial: `Cannot ${a.action} an item that is ${from ?? "not created"}` };

  if (a.action === "approve" && cur) {
    const proposer = cur.proposer as Role | undefined;
    if (a.actor === "engine") {
      if (table !== "work_items") return { denial: "The engine approves only settlements" };
      const amount = (cur.amount as number | undefined) ?? 0;
      const why = await checkRuleAuthority(ctx, a.authority, amount, ruleCache);
      if (why) return { denial: why };
    } else if (proposer === a.actor) {
      return { denial: `${ROLES[a.actor].label} cannot approve its own proposal` };
    }
    if (table === "rules" && a.actor !== "cfo") return { denial: "Only the CFO approves rules" };
  }
  return { to: rule.to ?? from };
}

export async function transitionChain(ctx: MutationCtx, target: { table: ItemTable; id: Id<ItemTable> | null; month?: number }, steps: Step[], ruleCache?: Map<string, Doc<"rules"> | null>): Promise<TransitionResult> {
  const { table } = target;
  const original = target.id ? ((await ctx.db.get(target.id)) as AnyItem | null) : null;
  const base: Record<string, unknown> = (original as unknown as Record<string, unknown>) ?? {};
  const month = target.month ?? (typeof base.month === "number" ? base.month : 0);
  const ref = original ? refOf(table, base) : refOf(table, steps[0]?.insert ?? {});
  const startState = (original ? base.state : null) as State | null;

  let state = startState;
  let cur: Record<string, unknown> | null = original ? { ...base } : null;
  let insert: Record<string, unknown> | null = null;
  const patch: Patch = {};
  const done: (Step & { toState: State | null })[] = [];

  // Write what has passed so far: the item once, and one audit row for the steps.
  const flush = async (): Promise<Id<ItemTable> | null> => {
    if (!done.length) return target.id;
    const diff: { field: string; before: string; after: string }[] = [];
    if (startState !== state) diff.push({ field: "state", before: startState ?? "", after: state ?? "" });
    for (const [k, val] of Object.entries(patch)) {
      const before = showField(k, base[k]);
      const after = showField(k, val);
      if (before !== after) diff.push({ field: k, before, after });
    }
    let id = target.id;
    if (insert) {
      id = await ctx.db.insert(table, { ...insert, ...patch, state } as never) as Id<ItemTable>;
      for (const [k, val] of Object.entries(insert)) if (k !== "state" && ["ref", "key", "ruleId", "amount", "storyKey", "title"].includes(k)) diff.push({ field: k, before: "", after: show(val) });
    } else {
      await ctx.db.patch(id!, { ...patch, state } as never);
    }
    const last = done[done.length - 1];
    const authority = [...done].reverse().find((s) => s.authority)?.authority ?? null;
    const reason = done.length === 1 ? last.reason : [...new Set(done.map((s) => s.reason))].join(" · ");
    const chain: StepRecord[] | undefined = done.length > 1 ? done.map((s) => ({ action: s.action, actor: s.actor, toState: s.toState })) : undefined;
    await ctx.db.insert("audit_log", {
      itemTable: table, itemId: id!, itemRef: ref, action: last.action, actor: last.actor, fromState: startState, toState: state,
      diff, reason, authority, allowed: true, denial: null, month, staged: done.some((s) => s.staged) || undefined, steps: chain,
    });
    return id;
  };

  for (const a of steps) {
    const r = await check(ctx, table, a, cur, state, ruleCache);
    if ("denial" in r) {
      const id = await flush();
      await ctx.db.insert("audit_log", {
        itemTable: table, itemId: id ?? "", itemRef: ref, action: a.action, actor: a.actor, fromState: state, toState: state,
        diff: [], reason: a.reason, authority: a.authority ?? null, allowed: false, denial: r.denial, month, staged: a.staged,
      });
      return { ok: false, denial: r.denial };
    }
    if (a.action === "create") insert = { ...(a.insert ?? {}) };
    Object.assign(patch, a.patch);
    cur = { ...(cur ?? {}), ...(a.action === "create" ? a.insert ?? {} : {}), ...a.patch };
    state = r.to;
    done.push({ ...a, toState: r.to });
  }
  const id = await flush();
  return { ok: true, id: id! };
}

export async function transition(ctx: MutationCtx, a: TransitionArgs, ruleCache?: Map<string, Doc<"rules"> | null>): Promise<TransitionResult> {
  const { table, id, month, ...step } = a;
  return transitionChain(ctx, { table, id, month }, [step], ruleCache);
}

export function monthLabel(m: number): string { return m >= 1 && m <= 12 ? MONTH_LABELS[m - 1] : "Year end"; }
