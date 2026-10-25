// The learning year, from src/demo/recording.json (written by `npx tsx scripts/export_demo.ts --preset learning`): a
// year of recurring real-world mess closed by Fermata, learning from people's answers, and the same year on the same
// engine with the rules frozen at onboarding (simulated, labelled so wherever it is shown). Every figure the site and
// the pitch show about learning is read from here, never typed, so the demo, the dashboard, the landing page and the
// pitch all tell the same year.
import recording from "@/demo/recording.json";

type Month = { month: number; total: number; firstSettled: number; waiting: number; held: number; settledLater: number; released: number; learned?: string[] };
export type LearnedRule = {
  id: string; version: number; month: number; title: string; by: "claude" | "code" | "scripted"; answeredBy: string; answer: string; origin: string;
  program: { limitIdr: number }; backtest: { scope: string; covered: number; of: number; wrong: number; pass: boolean; notes: string[] }; released: number;
};
type YearRun = { months: Month[]; yearEnd: number; final: { settled: number; waiting: number; held: number }; heldAtYearEnd: Record<string, number> };
const J = recording as unknown as YearRun & { note: string; baseline: YearRun; learnedRules: LearnedRule[] };

const share = (m: Month) => m.firstSettled / m.total;
const last = <T>(xs: T[]) => xs[xs.length - 1];
const rules = J.learnedRules;

export const LY = {
  note: J.note,
  // The chart's two runs: with learning (and the months its rules were approved), and the frozen baseline.
  learned: { months: J.months, learned: rules.map((r) => ({ id: r.id, month: r.month })), final: J.final },
  baseline: { months: J.baseline.months, learned: [] as { id: string; month: number }[], final: J.baseline.final },
  total: J.months.reduce((s, m) => s + m.total, 0),
  // Share settled on first pass: January, and December with and without learning.
  first: share(J.months[0]),
  last: share(last(J.months)),
  baselineFirst: share(J.baseline.months[0]),
  baselineLast: share(last(J.baseline.months)),
  // Lines left for people at year end: the ones no rule could settle, after the year-end pass.
  heldLearned: J.final.held,
  heldBaseline: J.baseline.final.held,
  // How many times fewer, rounded down so the claim never overstates.
  fewer: Math.floor(J.baseline.final.held / Math.max(1, J.final.held)),
  rules,
};
