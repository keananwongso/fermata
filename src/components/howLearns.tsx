"use client";
// How it learns, for /how: pick any rule and see the three layers it came through, top to bottom: the precedents it
// came from, the policy (what Fermata believes, in words) and the rule (a program with a limit). Day 0 rules were
// fitted on last year's lines and approved once; rules learned from answers were backtested first. All from the
// recording.
import { useState } from "react";
import { motion } from "motion/react";
import recording from "@/demo/recording.json";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, rpShort } from "../../convex/lib/format";
import { DAY_ZERO, fitFigure, seenOf } from "./dayZero";
import { LY } from "./learningYear";

type Rule = { id: string; title: string; learnedInMonth: number; program: { match?: string; params?: Record<string, unknown>; limitIdr: number }; seen?: { count: number; scope: string } | null };
const RULES = (recording as unknown as { rules: Rule[] }).rules;
const EASE = [0.22, 1, 0.36, 1] as const;
const WHO: Record<string, string> = { accountant: "Accountant", cfo: "CFO" };

function layers(r: Rule) {
  const learned = LY.rules.find((x) => x.id === r.id);
  const fit = fitFigure(r.program);
  if (!learned) return {
    precedents: { figure: num(seenOf(r)?.count ?? 0), sub: "lines matched by hand last year" },
    policy: DAY_ZERO[r.id]?.policy ?? r.title,
    rule: { figure: fit.values.length ? fit.text(fit.values) : r.id, sub: `fitted · up to ${rpShort(r.program.limitIdr)} a payment` },
    check: "Fitted on last year · CFO approved once",
  };
  const bt = learned.backtest;
  return {
    precedents: { figure: `"${learned.answer}"`, sub: `the ${WHO[learned.answeredBy] ?? learned.answeredBy}, ${MONTH_LABELS[learned.month - 1]}`, quote: true },
    policy: learned.title,
    rule: { figure: learned.id, sub: `${learned.by === "claude" ? "written by Claude" : learned.by === "code" ? "fitted in code" : "scripted"} · up to ${rpShort(learned.program.limitIdr)} a payment` },
    check: `Backtest ${num(bt.covered - bt.wrong)} of ${num(bt.covered)} right · CFO approved`,
  };
}

export function HowLearns() {
  const [id, setId] = useState(RULES.find((r) => r.learnedInMonth)?.id ?? RULES[0].id);
  const r = RULES.find((x) => x.id === id)!;
  const L = layers(r);
  const group = (label: string, rs: Rule[]) => (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {rs.map((x) => (
          <button key={x.id} onClick={() => setId(x.id)} aria-pressed={x.id === id}
            className={`calm num min-h-9 rounded-[6px] border px-3 text-[12.5px] ${x.id === id ? "border-accent bg-accent text-white" : "border-hairline bg-ground text-secondary hover:border-strong hover:text-ink"}`}>
            {x.id}
          </button>
        ))}
      </div>
    </div>
  );
  const row = (name: string, sub: string, body: React.ReactNode, i: number) => (
    <motion.div key={`${id}-${name}`} className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.12, ease: EASE }}>
      <div><div className="eyebrow text-secondary">{name}</div><div className="mt-0.5 text-[12px] text-faint">{sub}</div></div>
      <div className="card px-4 py-3">{body}</div>
    </motion.div>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
      <div className="space-y-5">
        {group("From last year, day 0", RULES.filter((x) => !x.learnedInMonth))}
        {group("From answers, this year", RULES.filter((x) => x.learnedInMonth))}
      </div>
      <div className="space-y-2">
        {row("Rule", "a hard do or don't, in code", <><div className="figure text-[24px] text-heading">{L.rule.figure}</div><div className="mt-0.5 text-[12.5px] text-secondary">{L.rule.sub}</div></>, 2)}
        <Arrow />
        {row("Policy", "what it believes", <div className="text-[15px] font-medium text-ink">{L.policy}</div>, 1)}
        <Arrow />
        {row("Precedents", "decisions people made", <><div className={L.precedents.quote ? "text-[15px] font-medium text-ink" : "figure text-[24px] text-heading"}>{L.precedents.figure}</div><div className="mt-0.5 text-[12.5px] text-secondary">{L.precedents.sub}</div></>, 0)}
        <motion.p key={`${id}-check`} className="pt-2 text-[12.5px] text-faint sm:pl-[162px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>{L.check}</motion.p>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center sm:grid sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3" aria-hidden>
      <span className="hidden sm:block" />
      <svg width="14" height="18" className="mx-auto"><path d="M7 17V1M1 7l6-6 6 6" fill="none" stroke="var(--color-mute)" strokeWidth="1.5" /></svg>
    </div>
  );
}
