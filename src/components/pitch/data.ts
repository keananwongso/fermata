// Every figure the pitch shows, read from the recorded run of the learning year (src/demo/recording.json, also
// through learningYear.ts) or the demo company's definition, never typed by hand. Re-export and the deck follows.
import recording from "@/demo/recording.json";
import { BANK_ACCOUNTS, STORES } from "../../../convex/lib/domain";
import { LY } from "../learningYear";

type Msg = { speaker: string; to: string; kind: string; source: string; staged: boolean; think: string[]; tools: { name: string; input: string; rows: string[][] }[]; text: string; code: string | null; question: { askOf: string; text: string } | null };
type Room = { key: string; month: number; title: string; count: number; amount: number; live: boolean; narrated: string | null; askOf: string | null; resolution?: string | null; messages: Msg[] };
type Rule = {
  id: string; title: string; learnedInMonth: number; backtest: { correct: number; covered: number; errors: number; precision: number; scope: string } | null;
  program: { match?: string; params?: Record<string, unknown> }; seen?: { count: number; scope: string } | null;
};
type Line = { channel: string; outcome: string; fanout: number; amount: number };
// Written by evaluation.run on Convex and carried into the recording by scripts/export_demo.ts.
export type Evaluation = Record<string, string | number>;
type Rec = {
  total: number; headOffice: number; headOfficeBank: number; final: { settled: number; waiting: number; held: number };
  months: { month: number; total: number; firstSettled: number }[]; lines: Record<string, Line[]>; fan: Line;
  rooms: Room[]; rules: Rule[]; evaluation?: Evaluation | null;
};
const R = recording as unknown as Rec;

const share = (m: { firstSettled: number; total: number }) => m.firstSettled / m.total;
const sampled = Object.values(R.lines).flat();
const MINUTES_PER_MANUAL_MATCH = 2;
const MINUTES_PER_DECISION = 5;
const TEAM = 20;

export const D = {
  total: R.total,
  stores: STORES.length,
  accounts: BANK_ACCOUNTS.length,
  channels: ["14 stores", "Shopee", "Tokopedia", "Website", "Dealers", "Music school"],
  headOffice: R.headOffice,
  headOfficeBank: R.headOfficeBank,
  // The learning claim is never the recorded curve: it is the learning year, simulated on the same engine with and
  // without learning.
  learning: LY,
  shares: R.months.map(share),
  first: share(R.months[0]),
  last: share(R.months[R.months.length - 1]),
  meetings: Array.from({ length: 12 }, (_, i) => R.rooms.filter((r) => r.month === i + 1).length),
  rooms: R.rooms,
  heldEver: R.rooms.reduce((s, r) => s + r.count, 0),
  heldAtEnd: R.final.held,
  rules: R.rules,
  learned: R.rules.filter((r) => r.learnedInMonth > 0),
  // The human decisions in the year: one answer per case room, one approval per rule.
  decisions: R.rooms.length + R.rules.length,
  fan: R.fan,
  dealerFan: Math.max(0, ...sampled.filter((l) => l.channel === "dealer" && l.outcome === "settled").map((l) => l.fanout)),
  storyA: R.rooms.find((r) => r.narrated === "A") ?? null,
  storyB: R.rooms.find((r) => r.narrated === "B") ?? null,
  evaluation: R.evaluation ?? null,
  team: TEAM,
  minutesPerMatch: MINUTES_PER_MANUAL_MATCH,
  minutesPerDecision: MINUTES_PER_DECISION,
  // Assumptions, labelled wherever they are shown: 2 minutes per manual match, 8-hour days, 5 minutes per decision.
  manualDays: Math.round((R.total * MINUTES_PER_MANUAL_MATCH) / 60 / TEAM / 8),
  fermataHours: ((R.rooms.length + R.rules.length) * MINUTES_PER_DECISION) / 60,
};
