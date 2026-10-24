"use client";
// The learning claim, drawn: one year run twice on the same engine, once learning from people's answers and once with
// the rules frozen at onboarding. Learning is accent, solid, with points; the baseline is mute and dashed. A 𝄐 sits
// over each month in which an answer became a rule, and that month turns accent on the axis. Shared by the landing
// page's proof, the pitch and the What if screen, so the comparison looks the same wherever it is shown.
// Three notes read the flat stretch as the point rather than a stall, all worked out from the data: the gap between
// the lines is shaded as what learning did; a month where the baseline drops and only learning recovers is called
// out; and when records arrive late, the band above the ceiling says so (they settle the next month either way).
import { motion } from "motion/react";
import { useId } from "react";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { pct } from "../../convex/lib/format";

export type ChartRun = { months: { month: number; total: number; firstSettled: number; waiting?: number }[]; learned: { id: string; month: number }[] };

// Required wherever the chart appears: the comparison is a simulation, not the recorded year.
export const SIM_CAPTION = "Simulated on the same engine: the same year, with and without learning.";

const EASE = [0.645, 0.045, 0.355, 1] as const;
const MUSIC = { fontFamily: "var(--font-music)" };
const share = (m: ChartRun["months"][number]) => m.firstSettled / m.total;

// Three widths so the labels stay a readable size: a phone chart under `sm`, a mid one, and a wide one from `lg`.
// `stage` draws only the mid one at its own size, for the pitch's fixed 1920×1080 stage, which scales it with `zoom`.
export function LearningChart({ learned, baseline, stage = false, className = "" }: { learned: ChartRun; baseline: ChartRun; stage?: boolean; className?: string }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <Legend />
      {stage ? <Plot L={learned} B={baseline} W={900} H={300} /> : (
        <>
          <div className="sm:hidden"><Plot L={learned} B={baseline} W={340} H={230} /></div>
          <div className="hidden sm:block lg:hidden"><Plot L={learned} B={baseline} W={900} H={280} /></div>
          <div className="hidden lg:block"><Plot L={learned} B={baseline} W={1200} H={320} /></div>
        </>
      )}
      <figcaption className="mt-2 text-[12px] text-faint">{SIM_CAPTION}</figcaption>
    </figure>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-secondary">
      <span className="inline-flex items-center gap-2"><svg width="22" height="8" aria-hidden><line x1="1" x2="21" y1="4" y2="4" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" /><circle cx="11" cy="4" r="3" fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth="1.5" /></svg>With learning</span>
      <span className="inline-flex items-center gap-2"><svg width="22" height="8" aria-hidden><line x1="1" x2="21" y1="4" y2="4" stroke="var(--color-mute)" strokeWidth="2" strokeDasharray="5 4" /></svg>Without learning</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-[19px] leading-none text-hold" style={MUSIC}>𝄐</span>An answer became a rule</span>
    </div>
  );
}

function Plot({ L, B, W, H }: { L: ChartRun; B: ChartRun; W: number; H: number }) {
  const small = W < 400;
  const left = small ? 34 : 42, right = small ? 34 : 44, top = 28, bottom = 28;
  const vals = [...L.months, ...B.months].map(share);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.03) * 20) / 20), hi = Math.min(1, Math.ceil((Math.max(...vals) + 0.01) * 20) / 20);
  const x = (i: number) => left + (i / 11) * (W - left - right);
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (H - top - bottom);
  const path = (r: ChartRun) => r.months.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(share(m)).toFixed(1)}`).join(" ");
  const grid: number[] = [];
  for (let g = lo; g <= hi + 1e-9; g += 0.05) grid.push(Math.round(g * 100) / 100);
  const marked = new Set(L.learned.map((r) => r.month - 1));
  const end = L.months.length - 1;
  const fs = small ? 9.5 : 11;
  // The gap, shaded: the learning line forward, then the baseline back.
  const gapArea = `${path(L)} ${B.months.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => `L${x(i).toFixed(1)},${y(share(m)).toFixed(1)}`).join(" ")} Z`;
  const gapAt = (i: number) => share(L.months[i]) - share(B.months[i]);
  // Its label sits in the second half, where the gap is widest, clear of the end labels.
  const gapI = Array.from({ length: Math.max(1, end - 1 - Math.ceil(end / 2)) }, (_, k) => Math.ceil(end / 2) + k).reduce((a, i) => (gapAt(i) > gapAt(a) ? i : a), Math.ceil(end / 2));
  // Something new: the first month the baseline drops by more than a point and a half while learning recovers next month.
  const dip = B.months.findIndex((m, i) => i > 0 && i < end && share(m) < share(B.months[i - 1]) - 0.015 && share(L.months[i + 1]) > share(L.months[i]) + 0.015);
  // The ceiling: records that arrive late settle the next month, so first pass can't pass 1 minus their share.
  const lastL = L.months[end];
  const ceiling = lastL.waiting != null && lastL.waiting > 0 ? 1 - lastL.waiting / lastL.total : null;
  const said = (r: ChartRun) => r.months.map((m, i) => `${MONTH_LABELS[i]} ${pct(share(m))}`).join(", ");
  const view = { once: true, margin: "0px 0px -10% 0px" } as const;
  const clip = `draw-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible" role="img"
      aria-label={`Share settled on first pass by month, the same simulated year twice. With learning: ${said(L)}. Without learning: ${said(B)}. Rules learned in ${[...marked].sort((a, b) => a - b).map((i) => MONTH_LABELS[i]).join(", ") || "no month"}.`}>
      {grid.map((g, k) => (
        <g key={g}>
          <line x1={left} x2={W - right} y1={y(g)} y2={y(g)} stroke="var(--color-hairline)" strokeWidth={k === 0 ? 1 : 0.6} strokeDasharray={k === 0 ? "" : "2 4"} />
          <text x={left - 8} y={y(g) + 4} textAnchor="end" className="num" fontSize={fs} fill="var(--color-faint)">{pct(g, 0)}</text>
        </g>
      ))}
      {ceiling != null && ceiling < hi ? (
        <g>
          <rect x={left} y={y(hi)} width={W - left - right} height={y(ceiling) - y(hi)} fill="var(--color-warm)" opacity={0.7} />
          {small ? null : <text x={left + 10} y={y(hi) + fs + 6} fontSize={fs} fill="var(--color-faint)">{pct(1 - ceiling, 0)} of records arrive late and settle the next month, so the ceiling is {pct(ceiling, 0)}</text>}
        </g>
      ) : null}
      {MONTH_LABELS.map((m, i) => <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize={fs} fill={marked.has(i) ? "var(--color-accent)" : "var(--color-faint)"}>{small ? m[0] : m}</text>)}
      {/* Both lines draw in left to right behind a growing clip, which keeps the baseline's dashes (pathLength would
          overwrite them). */}
      <defs><clipPath id={clip}><motion.rect x={0} y={0} height={H} initial={{ width: 0 }} whileInView={{ width: W }} viewport={view} transition={{ duration: 1.1, ease: EASE }} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <path d={gapArea} fill="var(--color-accent)" opacity={0.07} />
        <path d={path(B)} fill="none" stroke="var(--color-mute)" strokeWidth={1.75} strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={path(L)} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {L.months.map((m, i) => (
        <motion.circle key={i} cx={x(i)} cy={y(share(m))} r={small ? 3 : 3.5} fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth={1.75}
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={view} transition={{ duration: 0.3, delay: 0.1 + (i / 11) * 1 }} />
      ))}
      {[...marked].map((i) => (
        <motion.text key={i} x={x(i)} y={y(share(L.months[i])) - 9} textAnchor="middle" fontSize={small ? 18 : 22} fill="var(--color-hold)" style={MUSIC}
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={view} transition={{ duration: 0.4, delay: 1.1 }}>𝄐</motion.text>
      ))}
      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={view} transition={{ duration: 0.4, delay: 1.1 }}>
        <text x={x(gapI)} y={(y(share(L.months[gapI])) + y(share(B.months[gapI]))) / 2 + 4} textAnchor="middle" fontSize={fs} fill="var(--color-accent)">What learning did</text>
        {dip > 0 && !small ? (
          <text x={x(dip) + 8} y={y(share(B.months[dip])) + fs + 8} fontSize={fs} fill="var(--color-secondary)">Something new arrives: both dip, only learning recovers</text>
        ) : null}
        <text x={x(end) + 8} y={y(share(L.months[end])) + 4} className="num" fontSize={fs} fill="var(--color-accent)">{pct(share(L.months[end]), 0)}</text>
        <text x={x(end) + 8} y={y(share(B.months[end])) + 4} className="num" fontSize={fs} fill="var(--color-faint)">{pct(share(B.months[end]), 0)}</text>
      </motion.g>
    </svg>
  );
}
