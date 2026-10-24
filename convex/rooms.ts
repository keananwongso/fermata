// Case rooms. Every held story opens a room: the Engine states what it held, the agents talk to each other,
// and the meeting manager (this file, code) gives the floor, records every message, and closes the meeting
// with one question for one person. The manager never writes content; it only enforces.
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { GAP_LABEL, type Gap } from "./lib/engineCore";
import { MONTH_LABELS, STORE_BY_CODE } from "./lib/domain";
import { draftQuestion, type QuestionDraft } from "./lib/investigate";
import { num, rp, rpShort } from "./lib/format";
import { transition, ROLES, type ItemTable, type Role } from "./lib/transition";

export type RoomTool = { name: string; input: string; rows: string[][] };
export type RoomMessage = {
  speaker: string; to: string; kind?: "message" | "manager" | "denied"; source: "claude" | "code" | "scripted";
  text: string; think?: string[]; tools?: RoomTool[]; code?: string; staged?: boolean; status?: "working" | "done";
};

export const roleName = (r: string) => (r === "room" ? "the room" : ROLES[r as Role]?.label ?? r);

async function lastMessage(ctx: MutationCtx, storyKey: string) {
  return await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", storyKey)).order("desc").first();
}

export async function roomMessages(ctx: MutationCtx, storyKey: string) {
  return await ctx.db.query("room_messages").withIndex("by_story_seq", (q) => q.eq("storyKey", storyKey)).take(200);
}

// Write one message into a room. Agent messages count as turns; manager lines share the current turn.
export async function say(ctx: MutationCtx, story: Doc<"stories">, month: number, m: RoomMessage): Promise<Id<"room_messages">> {
  const prev = await lastMessage(ctx, story.key);
  const kind = m.kind ?? "message";
  const isTurn = kind === "message";
  const turn = (prev?.turn ?? 0) + (isTurn ? 1 : 0);
  if (isTurn) {
    const fresh = (await ctx.db.get(story._id))!;
    if (fresh.room) await ctx.db.patch(story._id, { room: { ...fresh.room, turns: fresh.room.turns + 1 } });
  }
  return await ctx.db.insert("room_messages", {
    storyKey: story.key, month, seq: (prev?.seq ?? 0) + 1, turn, speaker: m.speaker, to: m.to, kind, status: m.status ?? "done",
    source: m.source, staged: m.staged, think: m.think ?? [], tools: m.tools ?? [], text: m.text, code: m.code, at: Date.now(),
  });
}

const storeName = (s: string | null | undefined) => (s ? STORE_BY_CODE[s]?.name ?? s : "no store");

// The Engine's opening statement: what it held, and why no approved rule lets it settle these.
export async function engineOpening(ctx: MutationCtx, story: Doc<"stories">): Promise<RoomMessage> {
  const items = await ctx.db.query("work_items").withIndex("by_story", (q) => q.eq("storyKey", story.key)).take(4);
  const rows: string[][] = [];
  for (const it of items) {
    const b = await ctx.db.query("bank_transactions").withIndex("by_key", (q) => q.eq("key", it.ref)).first();
    if (b) rows.push([`${b.date} · ${b.memo}`, rp(b.amount)]);
  }
  const where = story.stores.length === 1 ? ` at ${storeName(story.stores[0])}` : story.stores.length ? ` across ${story.stores.length} stores` : "";
  const why: Partial<Record<Gap, string>> = {
    unknown_lender: `No approved rule knows ${story.counterparty}, so I may not settle these.`,
    placement_conflict: "The bank and the school's receipts point to different stores, so I cannot place them.",
    petty_cash_retained: "Each deposit is short of the day's cash, so no rule lets me settle it.",
    no_store_record: "No store recorded cash that matches these, so I cannot place them at all.",
  };
  return {
    speaker: "engine", to: "investigator", source: "code",
    text: `Held ${num(story.count)} lines in ${MONTH_LABELS[story.month - 1]}, ${rpShort(story.amount)}${where}: ${GAP_LABEL[story.gap as Gap].toLowerCase()}. ${why[story.gap as Gap] ?? "No approved rule covers them within its limit."} Investigator, can you work out what these are?`,
    tools: rows.length ? [{ name: "held_lines", input: `story ${story.key}, first ${rows.length}`, rows }] : [],
  };
}

// Open the room for a newly held story. Live rooms are run by agents (see roomAgents.ts); the rest meet from
// the scripted drafts, labelled scripted on every line.
export async function openRoom(ctx: MutationCtx, story: Doc<"stories">, month: number, live: boolean) {
  await ctx.db.patch(story._id, { room: { state: "meeting", turns: 0, live } });
  await say(ctx, story, month, await engineOpening(ctx, story));
  if (live) await ctx.scheduler.runAfter(0, internal.roomAgents.agentTurn, { storyKey: story.key, speaker: "investigator" });
  else await scriptedMeeting(ctx, (await ctx.db.get(story._id))!, month);
}

// A meeting from the scripted drafts: Investigator to Auditor, Auditor to the room, then one question.
export async function scriptedMeeting(ctx: MutationCtx, story: Doc<"stories">, month: number) {
  const d = draftQuestion(story);
  await say(ctx, story, month, { speaker: "investigator", to: "auditor", source: "scripted", think: d.trace, text: `${d.summary} ${d.hypothesis} Auditor, can you check this before we ask anyone?` });
  await say(ctx, story, month, { speaker: "auditor", to: "room", source: "scripted", text: d.auditor });
  await closeRoom(ctx, (await ctx.db.get(story._id))!, month, d, false);
}

// The manager closes the meeting: the story is asked, and one question goes to one person.
export async function closeRoom(ctx: MutationCtx, story: Doc<"stories">, month: number, d: QuestionDraft, real: boolean) {
  const id = story._id as Id<ItemTable>;
  const turns = story.room?.turns ?? 0;
  await transition(ctx, {
    table: "stories", id, action: "ask", actor: "manager", month, reason: `Meeting closed after ${turns} turns`,
    patch: {
      askOf: d.askOf, investigation: { summary: d.summary, hypothesis: d.hypothesis, real }, auditorOpinion: { text: d.auditor, real },
      room: { state: "asked", turns, live: story.room?.live ?? false },
    },
  });
  const q = await transition(ctx, {
    table: "questions", id: null, action: "create", actor: "manager", month, reason: "The question the meeting agreed on",
    insert: { storyKey: story.key, askOf: d.askOf, text: d.text, options: d.options, real, month }, patch: {},
  });
  if (q.ok) await transition(ctx, { table: "questions", id: q.id, action: "ask", actor: "manager", month, reason: `Asked the ${roleName(d.askOf)}`, patch: {} });
  await say(ctx, story, month, { speaker: "manager", to: d.askOf, kind: "manager", source: "code", text: `Meeting closed after ${turns} turns. One question for the ${roleName(d.askOf)}.` });
}

// Called once the person's answer is confirmed and applied.
export async function markRoomClosed(ctx: MutationCtx, storyKey: string) {
  const s = await ctx.db.query("stories").withIndex("by_key", (q) => q.eq("key", storyKey)).first();
  if (s?.room) await ctx.db.patch(s._id, { room: { ...s.room, state: "closed" } });
}
