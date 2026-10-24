// What the dashboard reads: the recorded run (src/demo/recording.json) and the demo company's definition. Every
// figure on the dashboard comes from here, never typed by hand, so a re-export updates it.
import recording from "@/demo/recording.json";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { rpShort } from "../../../convex/lib/format";
import type { ChatMessage } from "../caseRoom";

export type Msg = ChatMessage & { speaker: string; kind: string; source: string; text: string };
export type Option = { id: string; label: string; impact: string };
export type Question = { askOf: string; text: string; options: Option[]; answer: string | null; real: boolean };
export type Room = {
  key: string; month: number; title: string; count: number; amount: number; live: boolean; narrated: string | null;
  askOf: string | null; resolution: string | null; question: Question | null; messages: Msg[];
};
export type Backtest = { correct: number; covered: number; coverage: number; errors: number; precision: number; scope: string; examples: string[] };
export type Rule = {
  id: string; title: string; origin: string; learnedInMonth: number; real: boolean; state: string;
  program: Record<string, unknown>; backtest: Backtest | null; audit: { result: string; note: string } | null;
};
// Written by evaluation.run on Convex and carried into the recording by scripts/export_demo.ts, when one was run.
export type Evaluation = Record<string, string | number>;
type Rec = {
  year: number; total: number; headOffice: number; headOfficeBank: number; final: { settled: number; waiting: number; held: number };
  months: { month: number; total: number; firstSettled: number; held: number }[]; rooms: Room[]; rules: Rule[];
  evaluation?: Evaluation | null;
};
export const R = recording as unknown as Rec;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const MUSIC = { fontFamily: "var(--font-music)" };
export const bn = (n: number) => Math.round((Math.abs(n) / 1e9) * 100) / 100;
export const signedRp = (n: number) => (n < 0 ? `−${rpShort(-n)}` : rpShort(n));
export const pctOf = (x: number) => `${Math.round(x * 1000) / 10}%`;
export const monthSpan = (ms: number[]) => {
  if (!ms.length) return "";
  const lo = Math.min(...ms), hi = Math.max(...ms);
  return lo === hi ? MONTH_LABELS[lo - 1] : `${MONTH_LABELS[lo - 1]} to ${MONTH_LABELS[hi - 1]}`;
};

export const shares = R.months.map((m) => m.firstSettled / m.total);
export const firstPass = R.months.reduce((s, m) => s + m.firstSettled, 0);
export const isOpen = (r: Room) => !!r.question && !r.question.answer;
export const openRooms = R.rooms.filter(isOpen);
// Months that still hold a question for a person at year end.
export const openMonths = new Set(openRooms.map((r) => r.month));
export const lastMonth = R.months[R.months.length - 1]?.month ?? 12;

export const learned = R.rules.filter((r) => r.learnedInMonth > 0);
export const denied = R.rooms.flatMap((r) => r.messages).filter((m) => m.kind === "denied").length;

// Who is asked what at year end: open questions per person, largest first, the narrated stories on top.
export const PEOPLE = ["accountant", "cfo"] as const;
export const askedOf = (r: Room) => r.question?.askOf ?? r.askOf;
export const asked = (p: string) => openRooms.filter((r) => askedOf(r) === p)
  .sort((a, b) => Number(!!b.narrated) - Number(!!a.narrated) || b.amount - a.amount);
export const answered = (p: string) => R.rooms.filter((r) => r.question?.answer && askedOf(r) === p).sort((a, b) => b.month - a.month)[0];
export const mostAsked = [...PEOPLE].sort((a, b) => asked(b).length - asked(a).length)[0];
