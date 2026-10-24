"use client";
// The dashboard's overview: the closed year at a glance. Three metric cards, what each agent did, and the questions
// still waiting on a person.
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, rpShort } from "../../../convex/lib/format";
import { Avatar } from "../caseRoom";
import { Reveal, RevealItem, Roll } from "../motion";
import { AGENT_LABEL, Pill } from "../ui";
import { EASE_OUT, MUSIC, PEOPLE, R, answered, asked, bn, denied, firstPass, lastMonth, learned, monthSpan, mostAsked, openMonths, openRooms, pctOf, shares, signedRp } from "./data";
import { useDashboardNav } from "./nav";

export function Overview() {
  return (
    <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1 pb-1">
        <div>
          <div className="eyebrow">Books for {R.year}</div>
          <h2 className="title mt-1 text-[24px] lg:text-[28px]">Dashboard</h2>
        </div>
        <Pill>Closed through {MONTH_LABELS[lastMonth - 1]}</Pill>
      </div>
      <Reveal className="grid gap-3 sm:grid-cols-3 lg:gap-4" stagger={0.08}>
        <RevealItem className="min-w-0"><CashCard /></RevealItem>
        <RevealItem className="min-w-0"><SettledCard /></RevealItem>
        <RevealItem className="min-w-0"><CloseCard /></RevealItem>
      </Reveal>
      <Reveal className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-4" stagger={0.1} delay={0.15}>
        <RevealItem className="min-w-0"><ActivityCard /></RevealItem>
        <RevealItem className="min-w-0"><WaitingCard /></RevealItem>
      </Reveal>
    </div>
  );
}

// ---- Agent activity ------------------------------------------------------------------------------------------------

// What each agent said, and where it came from. The summary names only Claude or code; the case rooms label every
// message real, scripted or staged.
function spoke(role: string) {
  const own = R.rooms.flatMap((r) => r.messages.filter((m) => m.speaker === role && m.kind === "message").map((m) => ({ m, month: r.month, key: r.key })));
  const by = (s: string) => own.filter((x) => x.m.source === s).length;
  return { rooms: new Set(own.map((x) => x.key)).size, months: own.map((x) => x.month), claude: by("claude"), scripted: by("scripted"), code: by("code") };
}
function sourceLabel(s: { claude: number; code: number }) {
  return [s.claude ? "Claude" : "", s.code ? "Code" : ""].filter(Boolean).join(" · ");
}

const checked = learned.filter((r) => r.audit);
const flagged = checked.filter((r) => r.audit?.result === "flag");
const passed = checked.filter((r) => r.audit?.result === "pass");

type Activity = { who: string; did: ReactNode; sub: string; source: string; blocked?: boolean };
function activity(): Activity[] {
  const inv = spoke("investigator"), aud = spoke("auditor"), lea = spoke("learner");
  const rows: Activity[] = [
    { who: "engine", did: <>settled <b className="num font-medium text-ink">{num(firstPass)}</b> bank lines on first pass</>,
      sub: `${num(R.final.settled)} of ${num(R.total)} settled by ${MONTH_LABELS[lastMonth - 1]}`, source: "Code" },
    { who: "investigator", did: <>worked <b className="num font-medium text-ink">{inv.rooms}</b> held stories</>,
      sub: monthSpan(inv.months), source: sourceLabel(inv) },
    { who: "auditor", did: <>checked <b className="num font-medium text-ink">{checked.length}</b> new rules{flagged.length ? <>, flagged <b className="num font-medium text-hold-ink">{flagged.length}</b></> : null}</>,
      sub: [...flagged.map((r) => `${r.id} flagged: ${r.backtest?.errors ?? 0} counterexamples`), ...passed.map((r) => `${r.id} passed`)].join(" · "), source: sourceLabel(aud) },
    { who: "learner", did: <>learned <b className="num font-medium text-ink">{learned.length}</b> rules from answers, all backtested</>,
      sub: learned.map((r) => (r.backtest ? `${r.id} ${pctOf(r.backtest.precision)} of ${num(r.backtest.covered)}` : `${r.id} not backtested`)).join(" · "), source: sourceLabel(lea) },
  ];
  // The meeting manager is code: it runs every meeting and brings one question to one person.
  const mgr = R.rooms.filter((r) => r.messages.some((m) => m.speaker === "manager"));
  const qs = R.rooms.filter((r) => r.question);
  const to = (p: string) => qs.filter((r) => r.question?.askOf === p).length;
  rows.push({ who: "manager", did: <>ran <b className="num font-medium text-ink">{mgr.length}</b> meetings, one question each</>,
    sub: PEOPLE.filter((p) => to(p)).map((p) => `${to(p)} to the ${AGENT_LABEL[p]}`).join(" · "), source: "Code" });
  // The gateway is the only writer to the books. A refusal shows in red only when the run has one on record.
  rows.push(denied
    ? { who: "gateway", did: <>blocked <b className="num font-medium text-danger">{denied}</b> {denied === 1 ? "attempt" : "attempts"} to approve</>, sub: "No agent may approve · every refusal on record", source: "Code", blocked: true }
    : { who: "gateway", did: <>posted <b className="num font-medium text-ink">{num(R.final.settled)}</b> settled lines to the books</>, sub: "The only writer to the books · nothing refused this run", source: "Code" });
  return rows;
}

// ---- Metric cards ------------------------------------------------------------------------------------------------

function Metric({ label, figure, sub, children }: { label: string; figure: ReactNode; sub: ReactNode; children: ReactNode }) {
  return (
    <section className="card flex h-full min-w-0 flex-col p-4 lg:p-5">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-2 flex flex-1 items-end justify-between gap-4 sm:flex-col sm:items-stretch sm:justify-start">
        <div className="min-w-0">
          <div className="figure text-[28px] text-heading lg:text-[32px]">{figure}</div>
          <div className="mt-1.5 text-[12px] text-secondary">{sub}</div>
        </div>
        <div className="w-[44%] shrink-0 sm:mt-auto sm:w-full sm:pt-5">{children}</div>
      </div>
    </section>
  );
}

// The head office account: what the bank really holds against what the books claimed.
function CashCard() {
  const max = Math.max(Math.abs(R.headOffice), Math.abs(R.headOfficeBank));
  const bar = (label: string, value: number, cls: string, delay: number) => (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[10.5px] text-faint">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-inset">
        <motion.div className={`h-full rounded-full ${cls}`} initial={{ width: 0 }} whileInView={{ width: `${Math.max(3, (Math.abs(value) / max) * 100)}%` }}
          viewport={{ once: true }} transition={{ duration: 0.8, delay, ease: EASE_OUT }} />
      </div>
    </div>
  );
  return (
    <Metric label="Cash position · head office"
      figure={<Roll value={bn(R.headOfficeBank)} prefix="Rp " suffix="bn" format={{ maximumFractionDigits: 2 }} />}
      sub={<>The books said <span className="num whitespace-nowrap text-ink line-through decoration-faint">{signedRp(R.headOffice)}</span></>}>
      <div className="space-y-2" role="img" aria-label={`The bank holds ${rpShort(R.headOfficeBank)}; the books said ${signedRp(R.headOffice)}`}>
        {bar("Bank", R.headOfficeBank, "bg-accent", 0.3)}
        {bar("Books", R.headOffice, "bg-mute", 0.45)}
      </div>
    </Metric>
  );
}

// First-pass share by month, drawn in as a line.
function SettledCard() {
  const W = 240, H = 34, pad = 4;
  const lo = Math.floor(Math.min(...shares) * 20) / 20, hi = 1;
  const pt = (v: number, i: number) => [(i / (shares.length - 1)) * W, H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2)];
  const pts = shares.map(pt);
  const line = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  const [ex, ey] = pts[pts.length - 1];
  return (
    <Metric label="Settled on its own · first pass"
      figure={<Roll value={shares[shares.length - 1]} format={{ style: "percent", maximumFractionDigits: 0 }} />}
      sub={<>from <span className="num text-ink">{Math.round(shares[0] * 100)}%</span> in {MONTH_LABELS[R.months[0].month - 1]}</>}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`First-pass share by month, ${shares.map((s) => Math.round(s * 100) + "%").join(", ")}`}>
        <motion.path d={`${line} L${W} ${H} L0 ${H} Z`} fill="var(--color-accent-tint)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.8 }} />
        <motion.path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.25, ease: EASE_OUT }} />
        <motion.circle cx={ex} cy={ey} r="3.5" fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth="2"
          initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: 1.35 }} />
      </svg>
      <div className="mt-1 hidden justify-between text-[10.5px] text-faint sm:flex"><span>{MONTH_LABELS[0]}</span><span>{MONTH_LABELS[lastMonth - 1]}</span></div>
    </Metric>
  );
}

// The close: every month done, and which months still hold a question for a person.
function CloseCard() {
  return (
    <Metric label={`Close · ${R.year}`}
      figure={<><Roll value={R.months.length} /><span className="text-[0.6em] text-faint">/12</span></>}
      sub={<>months closed · <span className="num text-hold-ink">{num(R.final.held)}</span> lines held</>}>
      <div className="flex gap-[3px]" role="img" aria-label={`${R.months.length} months closed; ${openMonths.size} still hold a question for a person`}>
        {R.months.map((m, i) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${MONTH_LABELS[m.month - 1]}: closed${openMonths.has(m.month) ? ", holds a question" : ""}`}>
            <motion.span className="h-6 w-full origin-bottom rounded-[2px] bg-mute"
              initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.3 + i * 0.04, ease: EASE_OUT }} />
            <span className={`h-1.5 w-1.5 rounded-full ${openMonths.has(m.month) ? "bg-hold" : "bg-transparent"}`} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 hidden items-center gap-3 text-[10.5px] text-faint sm:flex">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-[1px] bg-mute" />closed</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-hold" />still holds a question</span>
      </div>
    </Metric>
  );
}

// ---- Agent activity and the questions waiting -----------------------------------------------------------------

function ActivityCard() {
  const rows = activity();
  return (
    <section className="card h-full min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 lg:px-5">
        <h3 className="title text-[16px]">Agent activity</h3>
        <span className="eyebrow">{MONTH_LABELS[0]} to {MONTH_LABELS[lastMonth - 1]} {R.year}</span>
      </div>
      <ul className="divide-y divide-hairline">
        {rows.map((r) => (
          <li key={r.who} className="flex items-center gap-3 px-4 py-3 lg:px-5">
            {/* Every row is done, so only a refusal gets a mark (red, with the reason in the row). */}
            {r.blocked ? <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-danger text-[11px] text-white" aria-label="blocked">✕</span> : null}
            <span className="hidden sm:block"><Avatar who={r.who} size={28} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-snug text-body"><span className="font-medium text-ink">{AGENT_LABEL[r.who]}</span> {r.did}</div>
              <div className="eyebrow mt-0.5 sm:truncate" title={r.sub}>{r.sub}</div>
            </div>
            {r.source ? <span className="hidden shrink-0 sm:inline-flex"><Pill>{r.source}</Pill></span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function WaitingCard() {
  // Review opens the room inside the window, in the case rooms view.
  const go = useDashboardNav();
  return (
    <section className="card h-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hold-tint-strong bg-hold-tint/50 px-4 py-3 lg:px-5">
        <h3 className="title flex items-center gap-2 text-[16px]"><span className="text-hold" style={MUSIC} aria-hidden>𝄐</span>Waiting on you</h3>
        <span className="num text-[12px] text-hold-ink">{openRooms.length} {openRooms.length === 1 ? "question" : "questions"}</span>
      </div>
      <div className="divide-y divide-hairline">
        {PEOPLE.map((p) => {
          const list = asked(p);
          const last = answered(p);
          return (
            <div key={p} className="px-4 py-3 lg:px-5">
              <div className="flex items-center gap-2">
                <Avatar who={p} size={22} />
                <span className="text-[12.5px] font-medium text-ink">{AGENT_LABEL[p]}</span>
                <span className="text-[12px] text-faint">{list.length ? `${list.length} waiting` : "nothing waiting"}</span>
              </div>
              {list.length ? (
                <ul className="mt-2 space-y-2">
                  {list.slice(0, p === mostAsked ? 3 : 1).map((r) => (
                    <li key={r.key} className="flex items-center gap-3 rounded-[8px] border border-hairline bg-well px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[12.5px] leading-snug text-body" title={r.title}>{r.title}</div>
                        <div className="eyebrow mt-0.5">{num(r.count)} lines · {rpShort(r.amount)} · {MONTH_LABELS[r.month - 1]}</div>
                      </div>
                      <button type="button" onClick={() => go({ view: "case-rooms", room: r.key })} aria-label={`Review: ${r.title}`} className="calm inline-flex min-h-11 shrink-0 items-center rounded-[4.5px] px-1 text-[12.5px] font-medium text-link hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-7">Review</button>
                    </li>
                  ))}
                  {list.length > (p === mostAsked ? 3 : 1) ? <li className="px-1 text-[11.5px] text-faint">and {list.length - (p === mostAsked ? 3 : 1)} more</li> : null}
                </ul>
              ) : last?.resolution ? (
                <p className="mt-1.5 text-[12px] leading-snug text-secondary">Answered in {MONTH_LABELS[last.month - 1]}: {last.resolution}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
