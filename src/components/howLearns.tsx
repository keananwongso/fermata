"use client";
// How it learns, for the landing page: two worked examples, one rule learned from last year's books (Day 0) and one
// learned from a person's answer, each told in four steps: the bank line, what it really pays for, the number Fermata
// learned and where from, and the rule it became. Every rule is that pattern; the rest are in the dashboard. All from
// the recording.
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import recording from "@/demo/recording.json";
import { num, rpShort } from "../../convex/lib/format";
import { LinkArrow } from "./ui";
import { seenOf } from "./dayZero";
import { LY } from "./learningYear";

type Rule = { id: string; title: string; learnedInMonth: number; program: { match?: string; params?: Record<string, unknown>; limitIdr: number }; seen?: { count: number; scope: string } | null };
type Fan = { memo: string; amount: number; fanout: number; rule: string | null };
type Room = { narrated: string | null; count: number; amount: number; messages: { kind: string; text: string }[]; question: { askOf: string; answer: string | null; options: { id: string; label: string }[] } | null };
const R = recording as unknown as { rules: Rule[]; fan: Fan | null; rooms: Room[] };
const EASE = [0.22, 1, 0.36, 1] as const;
const rule = (id: string | null | undefined) => R.rules.find((r) => r.id === id) ?? null;

type Step = { label: string; figure: ReactNode; sub: string };
type Example = { key: string; tab: string; title: string; steps: Step[] };

// The one number a rule learned for a given party (a marketplace's commission, a lender's cut), as a percentage.
const rate = (r: Rule | null, group: string, key: string) => {
  const v = (r?.program.params?.[group] as Record<string, number> | undefined)?.[key];
  return v == null ? "" : `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
};

// From old books: one Shopee payout, the commission Fermata worked out from last year's hand-matched payouts, and what
// happens to every Shopee payout after. Told as a story, no rule ids.
function fromBooks(): Example | null {
  const f = R.fan, r = rule(f?.rule);
  const cut = rate(r, "commission", "SHOPEE");
  if (!f || !r || !cut) return null;
  return { key: "books", tab: "From old books", title: `Shopee keeps ${cut}. Fermata worked that out.`, steps: [
    { label: "The bank shows", figure: rpShort(f.amount), sub: "one transfer from Shopee" },
    { label: "It's really", figure: `${num(f.fanout)} orders`, sub: `minus Shopee's ${cut} cut` },
    { label: "Fermata learned", figure: `Shopee keeps ${cut}`, sub: `from ${num(seenOf(r)?.count ?? 0)} payouts your team matched by hand last year` },
    { label: "From then on", figure: "Matched on its own", sub: "every Shopee payout, once the CFO approves it" },
  ] };
}

// From an answer: story B, a lender nobody had seen, and the one question to the CFO that taught Fermata its cut.
function fromAnswer(): Example | null {
  const room = R.rooms.find((x) => x.narrated === "B");
  const id = room?.messages.map((m) => /^(r\d+) approved/.exec(m.text)?.[1]).find(Boolean);
  const r = rule(id), lr = LY.rules.find((x) => x.id === id);
  const cut = rate(r, "lenders", "FIN_Z");
  if (!room || !r || !lr || !cut) return null;
  const lender = "FIN_Z";
  return { key: "answer", tab: "From an answer", title: `${lender} keeps ${cut}. The CFO said so once.`, steps: [
    { label: "The bank shows", figure: `${num(room.count)} payouts`, sub: `${rpShort(room.amount)} from ${lender}, a lender nobody had seen` },
    { label: "It's really", figure: `${num(room.count)} sales`, sub: `each paid by ${lender}, minus a ${cut} cut` },
    { label: "Fermata learned", figure: `${lender} keeps ${cut}`, sub: "from one yes to one question to the CFO" },
    { label: "From then on", figure: "Matched on its own", sub: `tested first: ${num(lr.backtest.covered - lr.backtest.wrong)} of ${num(lr.backtest.covered)} right` },
  ] };
}

const EXAMPLES = [fromBooks(), fromAnswer()].filter((e): e is Example => !!e);

export function HowLearns() {
  const [i, setI] = useState(0);
  const ex = EXAMPLES[i];
  if (!ex) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[8px] border border-hairline bg-well p-1" role="tablist" aria-label="Examples">
          {EXAMPLES.map((e, k) => (
            <button key={e.key} role="tab" aria-selected={k === i} onClick={() => setI(k)}
              className={`calm min-h-10 rounded-[6px] px-3.5 text-[13.5px] lg:min-h-9 ${k === i ? "bg-ground text-ink shadow-[0_1px_2px_rgb(85_40_20/0.08)]" : "text-secondary hover:text-ink"}`}>
              {e.tab}
            </button>
          ))}
        </div>
        <motion.p key={ex.key} className="title text-[18px]" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>{ex.title}</motion.p>
      </div>
      <ol className="grid gap-3 lg:grid-cols-4">
        {ex.steps.map((s, k) => (
          <motion.li key={`${ex.key}-${k}`} className={`card relative p-5 ${k === 3 ? "border-accent" : ""}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: k * 0.15, ease: EASE }}>
            <div className="flex items-center gap-2">
              <span className="num grid size-6 place-items-center rounded-full bg-accent text-[12px] font-medium text-white">{k + 1}</span>
              <span className="eyebrow">{s.label}</span>
            </div>
            <div className={`figure mt-3 text-[26px] leading-tight ${k === 3 ? "text-accent" : "text-heading"}`}>{s.figure}</div>
            <div className="mt-1 text-[13px] leading-snug text-secondary">{s.sub}</div>
          </motion.li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-secondary">
        <span>Every rule works this way: a kind of payment, and the number that explains it.</span>
        <LinkArrow href="/dashboard?view=rules">See all {R.rules.length} rules</LinkArrow>
      </div>
    </div>
  );
}
