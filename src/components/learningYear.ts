// The learning year (src/demo/learning.json, written by `npx tsx scripts/export_demo.ts --preset learning`): a year of
// recurring real-world mess, run on the same engine with learning and with the rules frozen at onboarding. In that
// simulation the answers come from the generator's answer key and the Learner is code. Every figure the site and the
// pitch show about learning is read from here, never typed.
import learning from "@/demo/learning.json";

type Month = { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number; released: number; learned: string[] };
export type LearnedRule = {
  id: string; version: number; month: number; title: string; answeredBy: string; answer: string; fit: string;
  program: { limitIdr: number }; backtest: { scope: string; covered: number; of: number; wrong: number; pass: boolean; notes: string[] }; released: number;
};
type YearRun = { months: Month[]; yearEnd: number; final: { settled: number; waiting: number; held: number }; heldAtYearEnd: Record<string, number>; learned: LearnedRule[] };
const J = learning as unknown as { note: string; learned: YearRun; baseline: YearRun };

const share = (m: Month) => m.firstSettled / m.total;
const last = <T>(xs: T[]) => xs[xs.length - 1];

export const LY = {
  note: J.note,
  learned: J.learned,
  baseline: J.baseline,
  total: J.learned.months.reduce((s, m) => s + m.total, 0),
  // Share settled on first pass: January, and December with and without learning.
  first: share(J.learned.months[0]),
  last: share(last(J.learned.months)),
  baselineFirst: share(J.baseline.months[0]),
  baselineLast: share(last(J.baseline.months)),
  // Lines left for people at year end: held after the year-end pass.
  heldLearned: J.learned.final.held,
  heldBaseline: J.baseline.final.held,
  // How many times fewer, rounded down so the claim never overstates.
  fewer: Math.floor(J.baseline.final.held / Math.max(1, J.learned.final.held)),
  rules: J.learned.learned,
};
