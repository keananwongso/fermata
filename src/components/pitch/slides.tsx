"use client";
// The pitch, one slide per beat of the video plan. Copy follows the philosophy doc's words; every figure comes
// from `D` (the recording). Notes are the spoken script, shown with N while recording the voice over.
import { motion } from "motion/react";
import { BANK_ACCOUNTS, MONTH_LABELS } from "../../../convex/lib/domain";
import { num, pct } from "../../../convex/lib/format";
import { ROLES, type Role } from "../../../convex/lib/transition";
import { Avatar, ChatList, type ChatMessage } from "../caseRoom";
import { BrandGrid, Roll } from "../motion";
import { CLOSE_CAPTION, LearningChart } from "../learningChart";
import { usdApprox } from "../money";
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
        <In delay={0.3}><div className="mt-2 text-[34px] text-faint">{usdApprox(D.headOffice)}</div></In>
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
            <p className="absolute left-0 top-[412px] w-[820px] text-[20px] text-faint">Shopee and Tokopedia are Southeast Asia&apos;s Amazon and eBay.</p>
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

// 3 · Why people can't keep up: the systems disagree with each other. Patterns from the business Fermata is
// modelled on, never its numbers; the team size is the demo company's.
const DISAGREE: [string, string][] = [
  ["One lesson fee, typed into three systems.", "One of them is older than the accountant typing it."],
  ["How a customer paid lives in a chat message.", "A salesperson's, and nowhere else."],
  ["Head office lives inside one store's books.", "So that store looks like it is losing money."],
];
function Cost() {
  return (
    <Frame chapter="Why" n={3}>
      <div className="flex h-full flex-col justify-center">
        <In><h2 className="title text-[72px]">And the systems disagree with each other.</h2></In>
        <div className="mt-16 grid grid-cols-3 gap-8">
          {DISAGREE.map(([head, sub], i) => (
            <In key={head} delay={0.2 + i * 0.15}>
              <div className="card h-full p-10">
                <div className="text-[36px] font-medium leading-snug text-ink">{head}</div>
                <div className="mt-5 text-[26px] leading-snug text-secondary">{sub}</div>
              </div>
            </In>
          ))}
        </div>
        <In delay={0.9}><p className="display mt-20 max-w-[1500px] text-[72px]">So a team of {D.team} works for weeks after every month ends before anyone sees the real cash.</p></In>
      </div>
    </Frame>
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
              {arrow("M935 380 C935 250 700 230 660 112", 5, [872, 236, "approves"])}
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

// 8 · The stack: what runs where. One engine, used live in Convex and offline for the simulator and the export.
const STACK: { place: string; who: string; items: [string, string][] }[] = [
  { place: "The site", who: "Next.js on Vercel", items: [
    ["Landing, demo, dashboard, pitch", "read the exported year, so they load with no backend"],
    ["Ask the books", "hold ⌃ + ⌥ and talk: Claude picks the answer, code fills every number, Cartesia speaks it"],
  ] },
  { place: "The backend", who: "Convex", items: [
    ["Sync and the engine", "every bank line placed, matched and settled under approved rules"],
    ["Case rooms", "Claude agents meet; a manager in code runs the meeting"],
    ["transition()", "every change and its audit row in one transaction; roles checked in code"],
    ["Evaluation and scenarios", "scored against the answer key; judges' own cases run live"],
  ] },
  { place: "Offline", who: "the same engine, in Node", items: [
    ["The generator", "a synthetic year from a fixed seed, with a hidden answer key"],
    ["The simulator", "the year closed twice, with and without learning; what-ifs in seconds"],
    ["The export", "a closed run becomes the data the site reads"],
  ] },
];
function Stack() {
  return (
    <Frame chapter="How it's built" n={8}>
      <In><h2 className="title text-[64px]">One engine, running in three places.</h2></In>
      <div className="mt-10 grid grid-cols-3 gap-8">
        {STACK.map((col, i) => (
          <In key={col.place} delay={0.2 + i * 0.15}>
            <div className={`h-full rounded-[16px] border p-[6px] ${i === 1 ? "border-heading bg-heading" : "border-hairline bg-warm"}`}>
              <div className="card h-full px-8 py-6">
                <div className="flex items-baseline justify-between gap-4"><span className="text-[34px] font-medium text-ink">{col.place}</span><span className="eyebrow text-[16px]">{col.who}</span></div>
                <ul className="mt-4 space-y-3">
                  {col.items.map(([head, sub]) => (
                    <li key={head} className="border-t border-hairline pt-3">
                      <div className="text-[23px] font-medium text-ink">{head}</div>
                      <div className="mt-1 text-[19px] leading-snug text-secondary">{sub}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </In>
        ))}
      </div>
      <In delay={0.8}>
        <div className="mt-7 flex items-center gap-4 text-[21px] text-secondary">
          {["Generate the year", "Close it", "Score it", "Export it", "The site reads it"].map((step, i) => (
            <span key={step} className="flex items-center gap-4">{i ? <span className="text-mute">→</span> : null}<span className="rounded-full border border-hairline bg-ground px-5 py-2">{step}</span></span>
          ))}
        </div>
      </In>
    </Frame>
  );
}

// 9 · How we measure: what each number means and where it comes from, so no figure needs trusting.
const PENDING = "filled in by the final run";
function Measure() {
  const L = D.learning;
  const e: Evaluation | null = D.evaluation;
  const rows: [string, string, string][] = [
    ["Settled on first pass", "Share of bank lines settled on their own the month they arrive. Counted per bank line, not per account.", `${pct(L.first, 0)} → ${pct(L.last, 0)}`],
    ["Lines left for people", "Lines no rule could settle by year end, so a person had to decide them.", num(L.heldLearned)],
    ["What learning did", "The same year on the same engine, closed with learning and with the rules frozen at onboarding.", `${num(L.heldLearned)} vs ${num(L.heldBaseline)}`],
    ["Decisions for people", `One answer per held story plus one approval per rule, at ${D.minutesPerDecision} minutes each (an assumption).`, `~${num(D.decisions)}`],
    ["Rule quality", "Every rule is backtested on past books before approval: what it covers, what it gets wrong, and a per payment limit.", `${L.rules.filter((r) => r.backtest.pass).length} of ${L.rules.length} passed`],
    ["Correctness", "Scored against an answer key the engine never reads: wrong store postings, a week it never saw, and a fuzzer.", e ? `${num(Number(e.wrongStore ?? 0))} wrong store` : PENDING],
  ];
  return (
    <Frame chapter="Proves every step" n={9}>
      <In><h2 className="title text-[64px]">How we measure it.</h2></In>
      <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6">
        {rows.map(([name, def, now], i) => (
          <In key={name} delay={0.15 + i * 0.08}>
            <div className="card flex h-full items-start justify-between gap-8 px-8 py-6">
              <div className="min-w-0">
                <div className="text-[28px] font-medium text-ink">{name}</div>
                <div className="mt-2 text-[20px] leading-snug text-secondary">{def}</div>
              </div>
              <div className={`shrink-0 whitespace-nowrap ${now === PENDING ? "text-[22px] text-faint" : "figure text-[40px] text-heading"}`}>{now}</div>
            </div>
          </In>
        ))}
      </div>
      <In delay={0.8}><p className="mt-8 text-[20px] text-faint">The line without learning is simulated on the same engine. For scale: vendors report 84% to 99.6% matched for mature systems, and APQC&apos;s median close is 6.4 days.</p></In>
    </Frame>
  );
}

// 8 · Self improving: the learning claim. The learning year as Fermata closed it, learning from people's answers,
// against the same year on the same engine with the rules frozen at onboarding (simulated, and labelled so).
function Curve() {
  const L = D.learning;
  return (
    <Frame chapter="Self improving" n={10}>
      <div className="flex items-end justify-between gap-10">
        <In><h2 className="title whitespace-nowrap text-[60px]">It learns in months, then holds.</h2></In>
        <In delay={0.2} className="flex shrink-0 gap-14 whitespace-nowrap text-right">
          <div><div className="figure text-[56px] text-heading">{pct(L.first, 0)} → {pct(L.last, 0)}</div><div className="mt-1 text-[22px] text-secondary">first pass with learning · {pct(L.baselineLast, 0)} without</div></div>
          <div><div className="figure text-[56px] text-hold">{num(L.heldLearned)} <span className="text-[34px] text-secondary">vs</span> {num(L.heldBaseline)}</div><div className="mt-1 text-[22px] text-secondary">lines left for people at year end</div></div>
        </In>
      </div>
      <In delay={0.3} className="mt-10">
        <div style={{ zoom: 1.5 }}><LearningChart learned={L.learned} baseline={L.baseline} stage caption={CLOSE_CAPTION} /></div>
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
    <Frame chapter="Proves every step" n={11}>
      <In><h2 className="title text-[72px]">Tested before anyone is asked to trust it.</h2></In>
      {/* Two rules get a wide card each; more share one row of compact cards so the evaluation still fits. */}
      <div className={`mt-10 grid gap-6 ${backtests.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}>
        {backtests.map((r, i) => backtests.length > 2 ? (
          <In key={r.id} delay={0.2 + i * 0.12} className="h-full">
            <div className="card flex h-full flex-col p-7">
              <div className="eyebrow text-[16px]">{r.id} · backtest before approval</div>
              <div className="mt-3 line-clamp-3 text-[22px] font-medium leading-snug text-ink">{r.title}</div>
              <div className="figure mt-auto pt-5 text-[64px] text-heading">{num(r.backtest!.correct)}</div>
              <div className="text-[20px] text-secondary">of {num(r.backtest!.covered)} right ({pct(r.backtest!.precision)})</div>
              <div className="mt-2 line-clamp-2 min-h-[2.75em] text-[17px] leading-snug text-faint">{r.backtest!.scope}</div>
            </div>
          </In>
        ) : (
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
      <In delay={0.9}><p className="mt-5 text-[19px] text-faint">All data is synthetic, from a fixed seed, and scored against an answer key the engine never reads. The big meetings ran live on Claude; the rest are scripted, and labelled that way.</p></In>
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
    <Frame chapter="The result" n={12} tone="warm">
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
            <p>Next: shadow mode at one store, where it proposes and people still decide.</p>
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
  { id: "hook", chapter: "Why", steps: 2, render: Hook, notes: `"This company's books say one of its bank accounts is at minus ${bn(D.headOffice)} billion rupiah, ${usdApprox(D.headOffice)}." (click) "It isn't." (click) "The bank holds ${bn(D.headOfficeBank)} billion."` },
  { id: "mess", chapter: "Why", render: Mess, notes: `"This is built from what I've seen in my family's music business in Indonesia. Money comes in six ways: fourteen stores, Shopee and Tokopedia, which are Southeast Asia's Amazon and eBay, a website, dealers, and a music school. None of them pays one sale at a time. And it all lands in five bank accounts shared by fourteen stores, so the books keep seventy balances that no bank holds."` },
  { id: "cost", chapter: "Why", render: Cost, notes: `"And the systems disagree with each other. One music lesson fee gets typed into three systems, one of them older than the accountant typing it. How a customer paid lives in a salesperson's chat message, nowhere else. So a twenty person team works for weeks after every month ends before anyone sees the real cash."
(Keanan's call: "weeks" is the safe wording; "about twenty days after every month ends" is a real figure from the family business.)` },
  { id: "title", chapter: "Fermata", render: Title, notes: `"In music, a fermata is the mark that tells you to hold. Fermata closes the books on its own, and only holds where it should."` },
  { id: "how", chapter: "How it works", render: How, notes: `"It settles every line an approved rule can explain. It holds the rest and groups it by cause. Then its agents meet on each story, ask one person one checked question, and turn the answer into a rule that's tested before anyone approves it."` },
  { id: "rooms", chapter: "Case rooms", render: Rooms, notes: `"Most lines never need a meeting. The ones that do, the agents meet on themselves. The Investigator finds the pattern. The Auditor tries to break it. The Learner writes the rule as code. And a meeting manager, written in code, keeps them honest: it stops at six turns, and only lets them ask a person once."

Video: cut to the demo here (/demo?tips=off: close the year, the school story's room in ${MONTH_LABELS[(D.storyA?.month ?? 1) - 1]}, the new lender's room in ${MONTH_LABELS[(D.storyB?.month ?? 6) - 1]}, the no), then hold Control + Option on the landing page and ask "What's our real cash?".` },
  { id: "built", chapter: "How it's built", render: Built, notes: `"Under the hood, a matching engine settles what an approved rule explains. What it can't goes to a case room of Claude agents with separate permissions. Agents propose, people approve, and only the gateway writes to the books. Every change is written together with its record, in Convex."` },
  { id: "stack", chapter: "How it's built", render: Stack, notes: `"It runs in three places. The site is Next.js on Vercel, and it loads the closed year with no backend. Convex is the whole backend: the engine, the case rooms, the rules and every record. And the same engine runs offline, to generate the year, simulate what-ifs, and export what the site shows."` },
  { id: "measure", chapter: "Proves every step", render: Measure, notes: `"Here's how we measure it, so you don't have to trust a number. We count per bank line. We count what's left for people. We measure learning by closing the same year with and without it. Every rule is backtested before approval, and the whole year is scored against an answer key the engine never reads."` },
  { id: "curve", chapter: "Self improving", render: Curve, notes: `"Does the learning matter? Here is the year as Fermata closed it, learning from people's answers, against the same year on the same engine with the rules frozen at onboarding. With learning, the share settled on first pass goes from ${pct(D.learning.first, 0)} in January to ${pct(D.learning.last, 0)} by December. Without it, it ends at ${pct(D.learning.baselineLast, 0)}. At year end that is ${num(D.learning.heldLearned)} lines left for people instead of ${num(D.learning.heldBaseline)}. Each mark is an answer that became a rule, fitted from the data and backtested first."
(Say the line without learning is simulated. With learning is the close itself, run on autopilot: the answers came from the generator's answer key, ${words(D.learning.rules.filter((r) => r.by === "claude").length).toLowerCase()} rules were written by Claude in live case rooms and ${words(D.learning.rules.filter((r) => r.by === "code").length).toLowerCase()} were fitted by code.)` },
  { id: "proof", chapter: "Proves every step", render: Proof, notes: `"Every rule is fitted from the data and tested on past books before a person sees it. Then we scored the whole year against an answer key the engine never reads: a week it never saw, lines at the wrong store, and altered lines thrown at it by a fuzzer." (Read the three bottom numbers from the slide; never say a number that is not on it.) "All of this data is synthetic, from a fixed seed. The big meetings ran live on Claude; the rest are scripted, and labelled that way."` },
  { id: "result", chapter: "The result", render: Result, notes: `"${num(D.total)} bank lines became about ${num(D.decisions)} decisions for people. Weeks of work, down to an afternoon." (Read both numbers from the slide.)` },
  { id: "end", chapter: "Fermata", render: End, notes: `"My family's business is the first design partner. Next is shadow mode at one store: it proposes, people still decide." (Hold on the card for three seconds.)` },
];
