"use client";
// The pitch, one slide per beat of the video plan. Copy follows the philosophy doc's words; every figure comes
// from `D` (the recording). Notes are the spoken script, shown with N while recording the voice over.
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { BANK_ACCOUNTS, MONTH_LABELS } from "../../../convex/lib/domain";
import { num, pct } from "../../../convex/lib/format";
import { ROLES, type Role } from "../../../convex/lib/transition";
import { Avatar, ChatList, type ChatMessage } from "../caseRoom";
import { BrandGrid, Roll } from "../motion";
import { Pill } from "../ui";
import { D, type Evaluation } from "./data";
import { Frame, In, type Slide } from "./deck";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const MUSIC = { fontFamily: "var(--font-music)" };
const bn = (n: number) => Math.round((Math.abs(n) / 1e9) * 100) / 100;
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"];
const words = (n: number) => WORDS[n] ?? num(n);

// 1 · The hook: the books' balance, struck through, then what the bank holds.
function Hook(step: number) {
  return (
    <Frame chapter="Why" n={1}>
      <div className="flex h-full flex-col justify-center">
        <In><div className="eyebrow text-[22px]">Head office account · what the books say on 31 December</div></In>
        <In delay={0.15}>
          <div className="relative mt-8 inline-block">
            <motion.div className="display text-[230px]" animate={{ opacity: step >= 1 ? 0.28 : 1 }} transition={{ duration: 0.5 }}>
              <Roll value={bn(D.headOffice)} prefix="−Rp " suffix="bn" format={{ maximumFractionDigits: 1 }} />
            </motion.div>
            <motion.div aria-hidden className="absolute left-[-12px] top-[52%] h-[12px] origin-left rounded-full bg-danger"
              initial={{ scaleX: 0 }} animate={{ scaleX: step >= 1 ? 1 : 0 }} transition={{ duration: 0.55, ease: EASE_OUT }} style={{ width: "calc(100% + 24px)" }} />
          </div>
        </In>
        <div className="mt-6 flex items-baseline gap-12">
          <In show={step >= 1}><div className="display text-[120px]">It isn&apos;t.</div></In>
          <In show={step >= 2} delay={0.1}>
            <div className="text-[40px] text-secondary">The bank holds <span className="display text-[64px] text-success">Rp {bn(D.headOfficeBank)}bn</span></div>
          </In>
        </div>
      </div>
    </Frame>
  );
}

// 2 · The mess: six channels into five shared accounts, which the books split into seventy balances.
const ROUTES: [number, string][] = [[0, "BANK_A"], [0, "BANK_B"], [1, "HEAD_OFFICE"], [2, "HEAD_OFFICE"], [3, "BANK_C"], [4, "BANK_C"], [5, "SCHOOL_VA"]];
function Mess() {
  const chY = (i: number) => 14 + i * 64 + 26;
  const acY = (j: number) => 8 + j * 80 + 32;
  const acIndex = (code: string) => BANK_ACCOUNTS.findIndex((a) => a.code === code);
  return (
    <Frame chapter="Why" n={2}>
      <In><h2 className="title text-[66px]">{words(D.channels.length)} ways in. {words(D.accounts)} bank accounts. {words(D.stores)} stores.</h2></In>
      <In delay={0.2} className="mt-12">
        <div className="mb-4 flex gap-10 text-[20px]">
          <div className="eyebrow w-[480px] text-[18px]">Where money comes from</div>
          <div className="eyebrow w-[300px] text-[18px]">The bank keeps {D.accounts} balances</div>
          <div className="eyebrow text-[18px]">The books keep {D.stores * D.accounts}, one per store</div>
        </div>
        <div className="flex items-start gap-10">
          <div className="relative h-[400px] w-[820px] shrink-0">
            <ul className="absolute left-0 top-[14px] w-[280px] space-y-3">
              {D.channels.map((c) => <li key={c} className="flex h-[52px] items-center rounded-[8px] border border-hairline bg-ground px-5 text-[24px] text-body shadow-[0_1px_1px_rgb(85_40_20/0.04)]">{c}</li>)}
            </ul>
            <svg aria-hidden className="absolute left-[280px] top-0" width="240" height="400">
              {ROUTES.map(([i, code], k) => (
                <motion.path key={k} d={`M0 ${chY(i)} C120 ${chY(i)} 120 ${acY(acIndex(code))} 240 ${acY(acIndex(code))}`} fill="none" stroke="var(--color-mute)" strokeWidth="2"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.5 + k * 0.06, ease: EASE_OUT }} />
              ))}
            </svg>
            <ul className="absolute left-[520px] top-[8px] w-[300px] space-y-4">
              {BANK_ACCOUNTS.map((a) => <li key={a.code} className="flex h-[64px] items-center rounded-[8px] bg-heading px-5 text-[24px] text-white">{a.name}</li>)}
            </ul>
          </div>
          <div className="min-w-0 pt-[8px]">
            <div className="space-y-4">
              {BANK_ACCOUNTS.map((a, j) => (
                <div key={a.code} className="flex h-[64px] items-center gap-2">
                  {Array.from({ length: D.stores }, (_, s) => (
                    <motion.span key={s} className="h-[44px] w-[38px] rounded-[5px] border border-hairline bg-warm"
                      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, delay: 1 + j * 0.08 + s * 0.02, ease: EASE_OUT }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </In>
      <In delay={1.4} className="absolute bottom-0 left-0 right-0">
        <div className="grid grid-cols-3 gap-6">
          <Fact figure={`${num(D.fan.fanout)} orders`} text="in one Shopee payout, minus commission" />
          <Fact figure={`${D.dealerFan} invoices`} text="in one dealer transfer, weeks late" />
          <Fact figure={`${num(D.storyA?.count ?? 0)} school fees`} text="paid at one store, receipted at another" />
        </div>
      </In>
    </Frame>
  );
}

function Fact({ figure, text }: { figure: string; text: string }) {
  return (
    <div className="card px-8 py-6">
      <div className="figure text-[48px] text-heading">{figure}</div>
      <div className="mt-2 text-[24px] text-secondary">{text}</div>
    </div>
  );
}

// 3 · The cost: what matching it by hand takes, with its assumption on the slide.
function Cost() {
  return (
    <Frame chapter="Why" n={3}>
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-start justify-between gap-16">
          <Big delay={0} figure={<Roll value={D.total} />} label="bank lines in a year" />
          <Big delay={0.15} figure={<Roll value={D.team} />} label="people in the accounting team" />
          <Big delay={0.3} figure={<Roll value={D.manualDays} prefix="~" />} label="working days to match it by hand" />
        </div>
        <In delay={0.9}><p className="display mt-24 max-w-[1400px] text-[80px]">Until they finish, nobody sees the real number.</p></In>
        <In delay={1.1}><p className="mt-10 text-[22px] text-faint">Assumes {D.minutesPerMatch} minutes per manual match and 8 hour days.</p></In>
      </div>
    </Frame>
  );
}

function Big({ figure, label, delay }: { figure: ReactNode; label: string; delay: number }) {
  return (
    <In delay={delay}>
      <div className="figure text-[140px] text-heading">{figure}</div>
      <div className="mt-4 text-[30px] text-secondary">{label}</div>
    </In>
  );
}

// 4 · The title: the mark, the name, what the name means.
function Title() {
  return (
    <div className="absolute inset-0 bg-canvas">
      <BrandGrid cols={24} rows={14} className="absolute inset-0 h-full w-full opacity-70 [mask-image:radial-gradient(ellipse_at_center,transparent_42%,#000_100%)]" />
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <motion.div className="card grid size-[200px] place-items-center rounded-[44px]" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
          <span className="text-[128px] leading-none text-hold" style={{ ...MUSIC, transform: "translateY(0.28em)" }} aria-hidden>𝄐</span>
        </motion.div>
        <In delay={0.25}><h1 className="display mt-14 text-[190px]">Fermata</h1></In>
        <In delay={0.45}><p className="mt-8 text-[40px] text-secondary">In music, a fermata is the mark that tells you to hold.</p></In>
        <In delay={0.65}><p className="mt-5 text-[30px] text-faint">Every line settles on its own. Fermata only holds where it should.</p></In>
      </div>
    </div>
  );
}


// 5 · How it works: the five things Fermata does, each with what it did in the recorded year.
function How() {
  const steps: { verb: string; line: string; figure: string; sub: string; hold?: boolean }[] = [
    { verb: "Settle", line: "every line an approved rule explains", figure: pct(D.last, 0), sub: "settled on first pass by December" },
    { verb: "Hold", line: "the rest, grouped by cause", figure: num(D.heldEver), sub: `lines held, in ${D.rooms.length} stories`, hold: true },
    { verb: "Meet", line: "agents work out each story together", figure: String(D.rooms.length), sub: "case rooms in the year" },
    { verb: "Ask", line: "one person, one checked question", figure: "1", sub: "question per story, never twice" },
    { verb: "Learn", line: "the answer becomes a tested rule", figure: String(D.learned.length), sub: "rules learned during the year" },
  ];
  return (
    <Frame chapter="How it works" n={5}>
      <In><h2 className="title text-[72px]">Settle, hold, meet, ask, learn.</h2></In>
      <div className="mt-20 grid grid-cols-5 gap-6">
        {steps.map((st, i) => (
          <In key={st.verb} delay={0.25 + i * 0.14}>
            <div className={`card flex h-[460px] flex-col p-8 ${st.hold ? "border-hold-tint-strong" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`num grid size-11 place-items-center rounded-full text-[20px] ${st.hold ? "bg-hold-tint text-hold-ink" : "bg-accent-tint text-accent"}`}>{i + 1}</span>
                {st.hold ? <span className="text-[30px] leading-none text-hold" aria-hidden>𝄐</span> : null}
              </div>
              <div className="title mt-8 text-[48px]">{st.verb}</div>
              <p className="mt-3 text-[26px] leading-snug text-body">{st.line}</p>
              <div className="mt-auto border-t border-hairline pt-6">
                <div className={`figure text-[60px] ${st.hold ? "text-hold" : "text-heading"}`}>{st.figure}</div>
                <div className="mt-2 text-[21px] leading-snug text-faint">{st.sub}</div>
              </div>
            </div>
          </In>
        ))}
      </div>
    </Frame>
  );
}

// 6 · Case rooms: the cast, and the opening of a real meeting from the recording.
const CAST: { who: Role; does: string; source: "Claude" | "Code" }[] = [
  { who: "investigator", does: "finds the pattern, drafts the one question", source: "Claude" },
  { who: "auditor", does: "tries to break it; can block, never approves", source: "Claude" },
  { who: "learner", does: "writes the rule as code, backtests it on last year", source: "Claude" },
  { who: "manager", does: "gives the floor, stops at 6 turns, asks a person once", source: "Code" },
];
function meetingOf(): { title: string; msgs: ChatMessage[] } | null {
  const room = D.rooms.find((r) => r.messages.some((m) => m.kind === "denied")) ?? D.storyB ?? D.storyA;
  if (!room) return null;
  const end = room.messages.findIndex((m) => m.kind === "manager");
  const msgs = room.messages.slice(0, end < 0 ? 5 : end + 1).map((m) => ({ ...m, think: m.think, tools: m.tools.map((t) => ({ ...t, rows: t.rows })) }));
  return { title: room.title, msgs: msgs as unknown as ChatMessage[] };
}
function Rooms() {
  const meeting = meetingOf();
  return (
    <Frame chapter="Case rooms" n={6}>
      <div className="grid h-full grid-cols-[1fr_960px] gap-16">
        <div className="min-w-0">
          <In><h2 className="title text-[64px]">{num(D.total - D.heldEver)} lines never need a meeting. {D.rooms.length} stories do.</h2></In>
          <ul className="mt-14 space-y-7">
            {CAST.map((c, i) => (
              <In key={c.who} delay={0.3 + i * 0.12}>
                <li className="flex items-start gap-5">
                  <span style={{ zoom: 1.75 }}><Avatar who={c.who} size={32} /></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3"><span className="text-[30px] font-medium text-ink">{ROLES[c.who].label}</span><span style={{ zoom: 1.45 }}><Pill tone={c.source === "Claude" ? "accent" : "neutral"}>{c.source}</Pill></span></div>
                    <div className="mt-1 text-[24px] text-secondary">{c.does}</div>
                  </div>
                </li>
              </In>
            ))}
          </ul>
        </div>
        <In delay={0.5} className="min-h-0">
          {meeting ? (
            <div className="frame h-[800px] overflow-hidden">
              <div className="card relative h-full overflow-hidden">
                <div className="border-b border-hairline px-7 py-5 text-[24px] font-medium text-heading">{meeting.title}</div>
                <div className="bg-canvas px-4 pb-6" style={{ zoom: 1.45 }}><ChatList msgs={meeting.msgs} animate={false} /></div>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas to-transparent" />
              </div>
            </div>
          ) : null}
        </In>
      </div>
    </Frame>
  );
}

// 7 · How it's built: the two paths through the system, and who may do what, read from the roles table.
function Node({ x, y, w, title, sub, dark }: { x: number; y: number; w: number; title: string; sub: string; dark?: boolean }) {
  return (
    <div className={`absolute rounded-[10px] border px-6 py-4 ${dark ? "border-heading bg-heading text-white" : "border-hairline bg-ground shadow-[0_1px_2px_rgb(85_40_20/0.05)]"}`} style={{ left: x, top: y, width: w }}>
      <div className={`text-[26px] font-medium ${dark ? "text-white" : "text-ink"}`}>{title}</div>
      <div className={`mt-0.5 text-[19px] ${dark ? "text-white/70" : "text-faint"}`}>{sub}</div>
    </div>
  );
}
const COLS = ["propose", "ask", "block", "approve", "post"] as const;
const TABLE_ROLES: Role[] = ["engine", "investigator", "auditor", "learner", "manager", "accountant", "cfo", "gateway"];
function Built() {
  const arrow = (d: string, k: number, label?: [number, number, string]) => (
    <g key={k}>
      <motion.path d={d} fill="none" stroke="var(--color-mute)" strokeWidth="2.5" markerEnd="url(#arrowhead)"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.5 + k * 0.15, ease: EASE_OUT }} />
      {label ? <text x={label[0]} y={label[1]} fontSize="19" fill="var(--color-secondary)" fontFamily="var(--font-sans)">{label[2]}</text> : null}
    </g>
  );
  return (
    <Frame chapter="How it's built" n={7}>
      <In><h2 className="title text-[64px]">Agents propose. People approve. Only the gateway writes.</h2></In>
      <div className="mt-14 grid grid-cols-[1040px_1fr] gap-16">
        <In delay={0.2}>
          <div className="relative h-[560px]">
            <svg aria-hidden className="absolute inset-0" width="1040" height="560">
              <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="var(--color-mute)" /></marker></defs>
              {arrow("M210 50 H268", 0)}
              {arrow("M490 50 H548", 1, [430, 22, ""])}
              {arrow("M770 50 H828", 2)}
              {arrow("M380 112 V288", 3, [396, 210, `the ${pct(D.heldEver / D.total, 0)} it can't explain`])}
              {arrow("M712 430 H828", 4, [722, 414, "asks once"])}
              {arrow("M935 380 C935 250 700 230 660 112", 5, [868, 520, "approves"])}
            </svg>
            <Node x={0} y={0} w={210} title="Bank lines" sub={`and ${D.channels.length} sources`} />
            <Node x={270} y={0} w={220} title="Engine" sub="code · under a rule" />
            <Node x={550} y={0} w={220} title="Gateway" sub="code · only writer" dark />
            <Node x={830} y={0} w={210} title="Books" sub="and the record" />
            <div className="absolute left-[150px] top-[290px] w-[560px] rounded-[16px] border border-hairline bg-warm p-[6px]">
              <div className="card px-6 py-5">
                <div className="flex items-center justify-between"><span className="text-[26px] font-medium text-ink">Case room</span><span className="text-[19px] text-faint">one per held story</span></div>
                <div className="mt-4 flex gap-6">
                  {(["investigator", "auditor", "learner", "manager"] as Role[]).map((r) => (
                    <div key={r} className="flex flex-col items-center gap-2"><span style={{ zoom: 1.6 }}><Avatar who={r} size={32} /></span><span className="text-[18px] text-secondary">{r === "manager" ? "Manager" : ROLES[r].label}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <Node x={830} y={380} w={210} title="Accountant or CFO" sub="people" />
          </div>
        </In>
        <In delay={0.4}>
          <table className="w-full table-fixed text-[22px]">
            <colgroup><col className="w-[190px]" />{COLS.map((c) => <col key={c} />)}</colgroup>
            <thead><tr>{["", ...COLS].map((c) => <th key={c} className="eyebrow pb-4 text-left text-[14px] font-normal">{c}</th>)}</tr></thead>
            <tbody>
              {TABLE_ROLES.map((r) => (
                <tr key={r} className="border-t border-hairline">
                  <td className="py-[11px] pr-4 text-ink">{r === "manager" ? "Manager" : ROLES[r].label}</td>
                  {COLS.map((c) => {
                    const yes = c in ROLES[r].actions;
                    return <td key={c} className={`py-[11px] ${yes ? (c === "approve" ? "text-success" : "text-accent") : "text-mute"}`}>{yes ? (c === "approve" && r === "engine" ? "rule" : "✓") : "·"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 text-[20px] leading-snug text-faint">From the roles table in code, checked on every step. Each change and its record are written in one Convex transaction.</p>
        </In>
      </div>
    </Frame>
  );
}

// 8 · Self improving: the share settled on first pass climbs while meetings per month fall to none.
function Curve() {
  const w = 1680, top = 70, lineH = 270, barTop = 450, barH = 100;
  const x = (i: number) => 60 + i * ((w - 120) / 11);
  const y = (v: number) => top + (1 - (v - 0.75) / 0.25) * lineH;
  const path = D.shares.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const maxMeet = Math.max(...D.meetings);
  return (
    <Frame chapter="Self improving" n={8}>
      <div className="flex items-end justify-between gap-10">
        <In><h2 className="title text-[72px]">It gets better every month.</h2></In>
        <In delay={0.2} className="flex gap-16 text-right">
          <div><div className="figure text-[64px] text-heading">{pct(D.first, 0)} → {pct(D.last, 0)}</div><div className="mt-1 text-[22px] text-secondary">settled on first pass</div></div>
          <div><div className="figure text-[64px] text-hold">{D.meetings[0]} → {D.meetings[11]}</div><div className="mt-1 text-[22px] text-secondary">meetings a month</div></div>
        </In>
      </div>
      <In delay={0.3} className="mt-10">
        <svg width={w} height={590} role="img" aria-label="Share settled on first pass by month, and meetings per month">
          {[0.8, 0.9, 1].map((g) => <g key={g}><line x1={40} x2={w - 40} y1={y(g)} y2={y(g)} stroke="var(--color-hairline)" /><text x={0} y={y(g) + 6} fontSize="18" fill="var(--color-faint)" fontFamily="var(--font-mono)">{Math.round(g * 100)}</text></g>)}
          {D.learned.map((r) => {
            const i = r.learnedInMonth - 1;
            return (
              <motion.g key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.4 }}>
                <line x1={x(i)} x2={x(i)} y1={22} y2={y(D.shares[i]) - 44} stroke="var(--color-accent)" strokeDasharray="4 6" strokeWidth="2" />
                <rect x={x(i) - 16} y={0} width={r.id.length * 13 + 104} height={30} rx={15} fill="var(--color-accent-tint)" />
                <text x={x(i)} y={21} fontSize="18" fill="var(--color-accent)" fontFamily="var(--font-mono)">{r.id} learned</text>
              </motion.g>
            );
          })}
          <motion.path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="4" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.4, ease: EASE_OUT }} />
          {D.shares.map((v, i) => (
            <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + (i / 11) * 1.4 }}>
              <circle cx={x(i)} cy={y(v)} r={7} fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth="3" />
              <text x={x(i)} y={y(v) - 20} textAnchor="middle" fontSize="20" fill="var(--color-heading)" fontFamily="var(--font-mono)">{Math.round(v * 100)}</text>
            </motion.g>
          ))}
          <text x={0} y={barTop - 52} fontSize="16" fill="var(--color-faint)" fontFamily="var(--font-mono)">MEETINGS</text>
          {D.meetings.map((m, i) => {
            const h = m ? (m / maxMeet) * barH : 3;
            return (
              <g key={i}>
                <motion.rect x={x(i) - 26} width={52} rx={4} fill="var(--color-hold)" fillOpacity={0.85}
                  initial={{ height: 0, y: barTop + barH }} animate={{ height: h, y: barTop + barH - h }} transition={{ duration: 0.6, delay: 0.8 + i * 0.06, ease: EASE_OUT }} />
                {m ? <text x={x(i)} y={barTop + barH - h - 10} textAnchor="middle" fontSize="18" fill="var(--color-hold-ink)" fontFamily="var(--font-mono)">{m}</text> : null}
                <text x={x(i)} y={barTop + barH + 34} textAnchor="middle" fontSize="20" fill="var(--color-secondary)" fontFamily="var(--font-sans)">{MONTH_LABELS[i]}</text>
              </g>
            );
          })}
        </svg>
      </In>
    </Frame>
  );
}

// 9 · Proof: each learned rule's backtest, then the evaluation against the hidden truth when it has been run.
function Proof() {
  const e: Evaluation | null = D.evaluation;
  const n = (k: string) => Number(e?.[k] ?? 0);
  const backtests = D.learned.filter((r) => r.backtest);
  return (
    <Frame chapter="Proves every step" n={9}>
      <In><h2 className="title text-[72px]">Tested before anyone is asked to trust it.</h2></In>
      <div className="mt-14 grid grid-cols-2 gap-6">
        {backtests.map((r, i) => (
          <In key={r.id} delay={0.2 + i * 0.12}>
            <div className="card p-9">
              <div className="eyebrow text-[17px]">{r.id} · backtest before approval</div>
              <div className="mt-4 text-[28px] font-medium text-ink">{r.title}</div>
              <div className="mt-6 flex items-baseline gap-5">
                <span className="figure text-[76px] text-heading">{num(r.backtest!.correct)}</span>
                <span className="text-[26px] text-secondary">of {num(r.backtest!.covered)} right ({pct(r.backtest!.precision)})</span>
              </div>
              <div className="mt-3 text-[21px] text-faint">{r.backtest!.scope}</div>
            </div>
          </In>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-6">
        {e ? (
          <>
            <ProofCard delay={0.5} label="A week it never saw" figure={pct(n("weekSettled") ? n("weekCorrect") / n("weekSettled") : 1)} sub={`precision on ${num(n("weekSettled"))} lines settled from ${e.weekFrom} to ${e.weekTo}`} />
            <ProofCard delay={0.62} label="Wrong store" figure={num(n("wrongStore"))} sub={`of ${num(n("withStore"))} lines placed at a store, checked against the hidden truth`} />
            <ProofCard delay={0.74} label="Fuzzer" figure={num(n("fuzzSettled"))} sub={`of ${num(n("fuzzTried"))} altered lines slipped through; ${num(n("fuzzHeld") + n("fuzzWaiting"))} were held`} />
          </>
        ) : (
          ["A week it never saw", "Wrong store", "Fuzzer"].map((l, i) => (
            <In key={l} delay={0.5 + i * 0.12}>
              <div className="hatch rounded-[10px] border border-dashed border-strong p-9">
                <div className="eyebrow text-[17px]">{l}</div>
                <div className="mt-4 text-[24px] text-faint">Filled in by the final recording (run the evaluation, then export).</div>
              </div>
            </In>
          ))
        )}
      </div>
    </Frame>
  );
}

function ProofCard({ label, figure, sub, delay }: { label: string; figure: string; sub: string; delay: number }) {
  return (
    <In delay={delay}>
      <div className="card p-9">
        <div className="eyebrow text-[17px]">{label}</div>
        <div className="figure mt-4 text-[76px] text-heading">{figure}</div>
        <div className="mt-3 text-[21px] leading-snug text-faint">{sub}</div>
      </div>
    </In>
  );
}

// 10 · The result: before and after, with the assumptions on the slide.
function Result() {
  const hours = Math.round(D.fermataHours);
  return (
    <Frame chapter="The result" n={10} tone="warm">
      <div className="flex h-full flex-col justify-center">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-16">
          <In>
            <div className="eyebrow text-[20px]">By hand</div>
            <div className="figure mt-6 text-[140px] text-secondary"><Roll value={D.total} /></div>
            <div className="mt-3 text-[30px] text-secondary">bank lines to match</div>
            <div className="mt-10 text-[34px] text-secondary">~{D.manualDays} working days for {D.team} people</div>
          </In>
          <In delay={0.3}><svg width="120" height="60" aria-hidden><path d="M0 30h104M84 8l24 22-24 22" fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg></In>
          <In delay={0.5}>
            <div className="eyebrow text-[20px]">With Fermata</div>
            <div className="figure mt-6 text-[140px] text-heading"><Roll value={D.decisions} prefix="~" /></div>
            <div className="mt-3 text-[30px] text-body">decisions for people: {D.rooms.length} answers, {D.rules.length} rule approvals</div>
            <div className="mt-10 text-[34px] text-heading">about {hours} hours, one afternoon</div>
          </In>
        </div>
        <In delay={0.9}><p className="mt-24 text-[22px] text-faint">Assumes {D.minutesPerMatch} minutes per manual match, {D.minutesPerDecision} minutes per decision and 8 hour days.</p></In>
      </div>
    </Frame>
  );
}

// 11 · The end card: the name, the line, what is next, where to find it.
function End() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-night text-white">
      <span aria-hidden className="pointer-events-none absolute -bottom-[260px] -right-[60px] select-none text-[1100px] leading-none text-white/[0.05]" style={MUSIC}>𝄐</span>
      <div className="relative flex h-full flex-col justify-center px-[160px]">
        <In><div className="flex items-center gap-6"><span className="text-[80px] leading-none text-hold" aria-hidden>𝄐</span><span className="display text-[140px]" style={{ color: "white" }}>Fermata</span></div></In>
        <In delay={0.2}><p className="mt-10 max-w-[1500px] text-[44px] leading-snug text-white/85">Every line settles on its own. Fermata only holds where it should.</p></In>
        <In delay={0.45}>
          <div className="mt-20 max-w-[1300px] space-y-4 text-[30px] text-white/70">
            <p>My family&apos;s business is the first design partner.</p>
            <p>Next: shadow mode at one store, where it proposes and people still decide. Then a cash report a bank can trust.</p>
          </div>
        </In>
        <In delay={0.7}>
          <div className="mt-20 flex gap-16 text-[28px]">
            <span className="text-white">getfermata.tech</span>
            <span className="text-white/70">github.com/keananwongso/fermata</span>
            <span className="text-white/50">Built with Claude and Convex</span>
          </div>
        </In>
      </div>
    </div>
  );
}

export const SLIDES: Slide[] = [
  { id: "hook", chapter: "Why", steps: 2, render: Hook, notes: `"This company's books say one of its bank accounts is at minus forty eight point six billion rupiah." (click) "It isn't." (click) "The bank holds three point two four billion."` },
  { id: "mess", chapter: "Why", render: Mess, notes: `"This is built from what I've seen in my family's music business in Indonesia. Money comes in six ways: fourteen stores, Shopee, Tokopedia, a website, dealers and a music school. None of them pays one sale at a time: one Shopee payout covers eight hundred and forty orders. And it all lands in five bank accounts shared by fourteen stores. The books pretend each store has its own, so they keep seventy balances no bank holds."` },
  { id: "cost", chapter: "Why", render: Cost, notes: `"A twenty person accounting team spends about a month matching it by hand. Until they finish, nobody sees the real number."` },
  { id: "title", chapter: "Fermata", render: Title, notes: `"In music, a fermata is the mark that tells you to hold. Fermata closes the year on its own, and only holds where it should."` },
  { id: "how", chapter: "How it works", render: How, notes: `"It settles every line an approved rule can explain. It holds the rest and groups it by cause. Then its agents meet on each story, ask one person one checked question, and turn the answer into a tested rule."` },
  { id: "rooms", chapter: "Case rooms", render: Rooms, notes: `"A hundred and two thousand lines never need a meeting. Thirty one stories do, and the agents hold that meeting themselves. The Investigator finds the pattern. The Auditor tries to break it. The Learner writes the rule as code. And a meeting manager, written in code, keeps them honest: it stops at six turns and only lets them ask a person once."

Video: cut to the demo here (close the year, then story A's room and story B's room).` },
  { id: "built", chapter: "How it's built", render: Built, notes: `"Under the hood: a matching engine settles what an approved rule explains. What it can't goes to a case room of Claude agents with separate permissions. Agents propose, people approve, and only the gateway writes to the books. The permissions are a table in code, checked on every step, and every change is written together with its record, in Convex."` },
  { id: "curve", chapter: "Self improving", render: Curve, notes: `"And it gets better every month. Eighty one percent settled on its own in January, ninety eight by December. The meetings fall the other way: eight in January, none from October, because every answer became a rule."` },
  { id: "proof", chapter: "Proves every step", render: Proof, notes: `"Every rule is tested on last year before a person sees it: the school fee rule got two thousand three hundred and three of two thousand three hundred and ten right, and its seven counterexamples went to the CFO. Then we scored the whole year against the hidden truth: a week it never saw, wrong stores, and a fuzzer that alters real lines to see if any slip through." (Read the three bottom numbers from the slide; never say a number that is not on it.)` },
  { id: "result", chapter: "The result", render: Result, notes: `"A hundred and four thousand bank lines became about forty decisions for people. About a month of the team's work, down to an afternoon."` },
  { id: "end", chapter: "Fermata", render: End, notes: `"My family's business is the first design partner. Next is shadow mode at one store: it proposes, people still decide. Then a cash report a bank can trust." (Hold on the card for three seconds.)` },
];
