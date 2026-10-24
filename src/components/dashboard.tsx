"use client";
// The product dashboard: the closed year at a glance, as an app window. Every figure is read from the recorded
// run (src/demo/recording.json) or the demo company's definition, never typed by hand, so a re-export updates it.
import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import recording from "@/demo/recording.json";
import { MONTH_LABELS, STORES } from "../../convex/lib/domain";
import { num, rpShort } from "../../convex/lib/format";
import { Avatar } from "./caseRoom";
import { Reveal, RevealItem, Roll } from "./motion";
import { PUBLIC_SITE, TABS } from "./nav";
import { AGENT_LABEL, Pill } from "./ui";

type Msg = { speaker: string; kind: string; source: string };
type Room = { key: string; month: number; title: string; count: number; amount: number; narrated: string | null; askOf: string | null; resolution: string | null; question: { askOf: string; answer: string | null } | null; messages: Msg[] };
type Rule = { id: string; learnedInMonth: number; backtest: { covered: number; precision: number; errors: number } | null; audit: { result: string } | null };
type Rec = {
  year: number; total: number; headOffice: number; headOfficeBank: number; final: { settled: number; waiting: number; held: number };
  months: { month: number; total: number; firstSettled: number }[]; rooms: Room[]; rules: Rule[];
};
const R = recording as unknown as Rec;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const MUSIC = { fontFamily: "var(--font-music)" };
const bn = (n: number) => Math.round((Math.abs(n) / 1e9) * 100) / 100;
const signedRp = (n: number) => (n < 0 ? `−${rpShort(-n)}` : rpShort(n));
const pctOf = (x: number) => `${Math.round(x * 1000) / 10}%`;
const monthSpan = (ms: number[]) => {
  if (!ms.length) return "";
  const lo = Math.min(...ms), hi = Math.max(...ms);
  return lo === hi ? MONTH_LABELS[lo - 1] : `${MONTH_LABELS[lo - 1]} to ${MONTH_LABELS[hi - 1]}`;
};

// ---- What the recording says ----------------------------------------------------------------------------------

const shares = R.months.map((m) => m.firstSettled / m.total);
const firstPass = R.months.reduce((s, m) => s + m.firstSettled, 0);
const open = (r: Room) => !!r.question && !r.question.answer;
const openRooms = R.rooms.filter(open);
// Months that still hold a question for a person at year end.
const openMonths = new Set(openRooms.map((r) => r.month));
const lastMonth = R.months[R.months.length - 1]?.month ?? 12;

// What each agent said, and where it came from (Claude, code or scripted).
function spoke(role: string) {
  const own = R.rooms.flatMap((r) => r.messages.filter((m) => m.speaker === role && m.kind === "message").map((m) => ({ m, month: r.month, key: r.key })));
  const by = (s: string) => own.filter((x) => x.m.source === s).length;
  return { rooms: new Set(own.map((x) => x.key)).size, months: own.map((x) => x.month), claude: by("claude"), scripted: by("scripted"), code: by("code") };
}
function sourceLabel(s: { claude: number; scripted: number; code: number }) {
  return [s.claude ? "Claude" : "", s.code ? "Code" : "", s.scripted ? "scripted" : ""].filter(Boolean).join(" · ") || "Code";
}

const learned = R.rules.filter((r) => r.learnedInMonth > 0);
const checked = learned.filter((r) => r.audit);
const flagged = checked.filter((r) => r.audit?.result === "flag");
const passed = checked.filter((r) => r.audit?.result === "pass");
const denied = R.rooms.flatMap((r) => r.messages).filter((m) => m.kind === "denied").length;

type Activity = { who: string; did: ReactNode; sub: string; source: string; blocked?: boolean };
function activity(): Activity[] {
  const inv = spoke("investigator"), aud = spoke("auditor"), lea = spoke("learner");
  const split = (s: { claude: number; scripted: number }) => [s.claude ? `${s.claude} on Claude` : "", s.scripted ? `${s.scripted} scripted` : ""].filter(Boolean).join(", ");
  const rows: Activity[] = [
    { who: "engine", did: <>settled <b className="num font-medium text-ink">{num(firstPass)}</b> bank lines on first pass</>,
      sub: `${num(R.final.settled)} of ${num(R.total)} settled by ${MONTH_LABELS[lastMonth - 1]}`, source: "Code" },
    { who: "investigator", did: <>worked <b className="num font-medium text-ink">{inv.rooms}</b> held stories</>,
      sub: `${monthSpan(inv.months)} · ${split(inv)}`, source: sourceLabel(inv) },
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

// Who is asked what at year end: open questions per person, largest first, the narrated stories on top.
const PEOPLE = ["accountant", "cfo"] as const;
const asked = (p: string) => openRooms.filter((r) => (r.question?.askOf ?? r.askOf) === p)
  .sort((a, b) => Number(!!b.narrated) - Number(!!a.narrated) || b.amount - a.amount);
const answered = (p: string) => R.rooms.filter((r) => r.question?.answer && (r.question.askOf ?? r.askOf) === p).sort((a, b) => b.month - a.month)[0];
const mostAsked = [...PEOPLE].sort((a, b) => asked(b).length - asked(a).length)[0];

// ---- The window --------------------------------------------------------------------------------------------------

export function Dashboard({ className = "" }: { className?: string }) {
  return (
    <div className={`frame ${className}`} role="group" aria-label={`Fermata dashboard for ${R.year}, read from a recorded run`}>
      <div className="card grid overflow-hidden lg:grid-cols-[212px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0 bg-canvas">
          <MobileBar />
          <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1 pb-1">
              <div>
                <div className="eyebrow">Books for {R.year}</div>
                <h2 className="title mt-1 text-[24px] lg:text-[28px]">Dashboard</h2>
              </div>
              <Pill tone="success"><span aria-hidden>✓</span>Closed through {MONTH_LABELS[lastMonth - 1]}</Pill>
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
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[18px] leading-none text-hold" style={MUSIC} aria-hidden>𝄐</span>
      <span className="display text-[17px] tracking-[-0.03em]">Fermata</span>
    </span>
  );
}

function Sidebar() {
  const items = [{ href: "/dashboard", label: "Dashboard", count: null as ReactNode }, ...TABS.map((t) => ({
    ...t, count: t.href === "/stories" ? <span className="num rounded-full bg-hold-tint px-1.5 text-[11px] text-hold-ink">{openRooms.length}</span>
      : t.href === "/rules" ? <span className="num text-[11px] text-faint">{R.rules.length}</span> : null,
  }))];
  return (
    <aside className="hidden min-w-0 flex-col border-r border-hairline bg-well p-3 lg:flex">
      <div className="px-2 pb-4 pt-1"><Brand /></div>
      <div className="flex items-center gap-2.5 rounded-[8px] border border-hairline bg-ground px-2.5 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-heading text-[15px] text-white" style={MUSIC} aria-hidden><span style={{ transform: "translateY(0.22em)" }}>♪</span></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[12.5px] font-medium text-ink">Music retailer</span>
          <span className="block truncate text-[11px] text-faint">{STORES.length} stores · fictional</span>
        </span>
      </div>
      <nav className="mt-4 space-y-0.5" aria-label="Dashboard sections">
        {items.map((t, i) => (
          <Link key={t.href} href={PUBLIC_SITE && i > 0 ? "/demo" : t.href} aria-current={i === 0 ? "page" : undefined}
            className={`calm flex items-center justify-between rounded-[6px] px-2.5 py-1.5 text-[13px] ${i === 0 ? "bg-ground text-accent shadow-[0_1px_2px_rgb(85_40_20/0.06)]" : "text-body hover:bg-hover hover:text-ink"}`}>
            {t.label}{t.count}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-hairline px-1 pt-3">
        <div className="eyebrow">Acting as</div>
        <div className="mt-1.5 flex items-center gap-2"><Avatar who={mostAsked} size={24} /><span className="text-[12.5px] font-medium text-ink">{AGENT_LABEL[mostAsked]}</span></div>
      </div>
    </aside>
  );
}

// On a phone the sidebar folds into one bar across the top of the window.
function MobileBar() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline bg-well px-3 py-2.5 lg:hidden">
      <Brand />
      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-faint">
        <span className="truncate">Acting as</span><Avatar who={mostAsked} size={22} /><span className="font-medium text-ink">{AGENT_LABEL[mostAsked]}</span>
      </span>
    </div>
  );
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
      sub={<>The books said <span className="num whitespace-nowrap text-ink line-through decoration-danger/60">{signedRp(R.headOffice)}</span></>}>
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
            <motion.span className="h-6 w-full origin-bottom rounded-[2px] bg-success"
              initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.3 + i * 0.04, ease: EASE_OUT }} />
            <span className={`h-1.5 w-1.5 rounded-full ${openMonths.has(m.month) ? "bg-hold" : "bg-transparent"}`} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 hidden items-center gap-3 text-[10.5px] text-faint sm:flex">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-[1px] bg-success" />closed</span>
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
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white ${r.blocked ? "bg-danger" : "bg-success"}`} aria-label={r.blocked ? "blocked" : "done"}>{r.blocked ? "✕" : "✓"}</span>
            <span className="hidden sm:block"><Avatar who={r.who} size={28} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-snug text-body"><span className="font-medium text-ink">{AGENT_LABEL[r.who]}</span> {r.did}</div>
              <div className="eyebrow mt-0.5 sm:truncate" title={r.sub}>{r.sub}</div>
            </div>
            <span className="hidden shrink-0 sm:inline-flex"><Pill tone={r.source.startsWith("Claude") ? "accent" : "neutral"}>{r.source}</Pill></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WaitingCard() {
  const review = PUBLIC_SITE ? "/demo" : "/stories";
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
                      <Link href={review} className="calm inline-flex min-h-11 shrink-0 items-center rounded-[4.5px] bg-hold-tint px-2.5 font-mono text-[11px] uppercase tracking-[0.04em] text-hold-ink hover:bg-hold-tint-strong lg:min-h-7">Review</Link>
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
