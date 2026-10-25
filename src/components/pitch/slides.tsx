"use client";
// The pitch, live: the landing page's own pieces as slides (the paths diagram, the case room, the two examples), so
// the deck and the site tell the same story. One slide per beat; Copy follows the philosophy doc's words; every figure comes
// from `D` (the recording). Notes are the spoken script, shown with N while recording the voice over.
import { AnimatePresence, motion } from "motion/react";
import { BANK_ACCOUNTS } from "../../../convex/lib/domain";
import { num, pct } from "../../../convex/lib/format";
import { BrandGrid, Roll } from "../motion";
import { CLOSE_CAPTION, LearningChart } from "../learningChart";
import { usdApprox } from "../money";
import { SystemDiagram } from "../systemDiagram";
import { HowDiagram } from "../howDiagram";
import { HowRoom, ROOM_STEPS } from "../howRoom";
import { HowLearns } from "../howLearns";
import { D, type Evaluation } from "./data";
import { Frame, In, type Slide } from "./deck";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const MUSIC = { fontFamily: "var(--font-music)" };
const bn = (n: number) => Math.round((Math.abs(n) / 1e9) * 100) / 100;
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"];
const words = (n: number) => WORDS[n] ?? num(n);

// The tiles the opening slides share: where money comes from, the shared bank accounts it lands in, and the books'
// balances, one per store per account. `grow` multiplies the stores drawn (a shape, not a measurement); `still` skips
// the entrance, so the second slide picks up the tiles where the first left them.
const ROUTES: [number, string][] = [[0, "BANK_A"], [0, "BANK_B"], [1, "HEAD_OFFICE"], [2, "HEAD_OFFICE"], [3, "BANK_C"], [4, "BANK_C"], [5, "SCHOOL_VA"]];
type Layout = { cols: number; w: number; h: number; gap: number };
const BALANCES: Record<number, Layout> = { 1: { cols: 14, w: 38, h: 44, gap: 8 }, 4: { cols: 28, w: 22, h: 26, gap: 5 }, 12: { cols: 56, w: 10, h: 16, gap: 4 } };
function Ways({ channels, label, grow = 1, alarm = false, still = false }: { channels: string[]; label: string; grow?: number; alarm?: boolean; still?: boolean }) {
  const chY = (i: number) => 14 + i * 64 + 26;
  const acY = (j: number) => 8 + j * 80 + 32;
  const acIndex = (code: string) => BANK_ACCOUNTS.findIndex((a) => a.code === code);
  return (
    <>
      <div className="mb-4 flex gap-10 text-[20px]">
        <div className="eyebrow w-[480px] text-[18px]">Where money comes from</div>
        <div className="eyebrow w-[300px] text-[18px]">The bank keeps {D.accounts} balances</div>
        <div className="eyebrow text-[18px]">{label}</div>
      </div>
      <div className="flex items-start gap-10">
        <div className="relative h-[400px] w-[820px] shrink-0">
          <ul className="absolute left-0 top-[14px] w-[280px] space-y-3">
            {channels.map((c) => <li key={c} className="flex h-[52px] items-center rounded-[8px] border border-hairline bg-ground px-5 text-[24px] text-body shadow-[0_1px_1px_rgb(85_40_20/0.04)]">{c}</li>)}
          </ul>
          <svg aria-hidden className="absolute left-[280px] top-0" width="240" height="400">
            {ROUTES.map(([i, code], k) => (
              <motion.path key={k} d={`M0 ${chY(i)} C120 ${chY(i)} 120 ${acY(acIndex(code))} 240 ${acY(acIndex(code))}`} fill="none" stroke="var(--color-mute)" strokeWidth="2"
                initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.5 + k * 0.06, ease: EASE_OUT }} />
            ))}
          </svg>
          <ul className="absolute left-[520px] top-[8px] w-[300px] space-y-4">
            {BANK_ACCOUNTS.map((a) => (
              <li key={a.code} className={`calm flex h-[64px] items-center rounded-[8px] bg-heading px-5 text-[24px] text-white ${alarm && a.code === "HEAD_OFFICE" ? "ring-4 ring-danger ring-offset-4 ring-offset-canvas" : ""}`}>{a.name}</li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 pt-[8px]">
          <div className="space-y-4">
            {BANK_ACCOUNTS.map((a, j) => (
              <div key={a.code} className="flex h-[64px] items-center">
                <Tiles count={D.stores * grow} layout={BALANCES[grow]} still={still} delay={(s) => (s < D.stores ? 1 + j * 0.08 + s * 0.02 : j * 0.05 + (s / (D.stores * grow)) * 0.6)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// A grid of store tiles that reflows as it grows: the tiles already there move to their new places, new ones rise in.
// `mark` tints the first tiles (the stores the recording has) so they stay findable in a larger grid.
function Tiles({ count, layout, still = false, delay, mark = 0 }: { count: number; layout: Layout; still?: boolean; delay: (s: number) => number; mark?: number }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${layout.cols}, ${layout.w}px)`, gridAutoRows: layout.h, gap: layout.gap }}>
      {Array.from({ length: count }, (_, s) => (
        <motion.span key={s} layout className={`border ${s < mark ? "border-accent bg-accent-tint" : "border-hairline bg-warm"}`} style={{ borderRadius: layout.w < 20 ? 3 : 5 }}
          initial={still && s < D.stores ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: still && s < D.stores ? 0 : delay(s), ease: EASE_OUT, layout: { duration: 0.6, ease: EASE_OUT } }} />
      ))}
    </div>
  );
}

// 1 · My family's business: six ways in, five shared accounts, the books' seventy balances; then the systems that
// disagree; then one piece of evidence, the head office account as the books have it, struck through. Patterns from
// the business Fermata is modelled on, never its numbers; the team size is the demo company's.
const DISAGREE: [string, string][] = [
  ["One lesson fee, typed into three systems.", "One of them is older than the accountant typing it."],
  ["How a customer paid lives in a chat.", "A salesperson's, and nowhere else."],
  ["Head office lives inside one store's books.", "So that store looks like it is losing money."],
];
function Family(step: number) {
  const below = step >= 2 ? "cash" : step === 1 ? "systems" : null;
  return (
    <Frame chapter="Why" n={1}>
      <In><h2 className="title text-[66px]">{words(D.channels.length)} ways in. {words(D.accounts)} bank accounts. {words(D.stores)} stores.</h2></In>
      <In delay={0.2} className="mt-12"><Ways channels={D.channels} label={`The books keep ${D.stores * D.accounts}, one per store`} alarm={step >= 2} /></In>
      <div className="absolute bottom-0 left-0 right-0">
        <AnimatePresence mode="wait">
          {below === "systems" ? (
            <motion.div key="systems" initial={{ opacity: 0, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(8px)" }} transition={{ duration: 0.5, ease: EASE_OUT }}>
              <div className="eyebrow text-[18px]">Three systems of record. None of them agree.</div>
              <div className="mt-3 grid grid-cols-3 gap-6">
                {DISAGREE.map(([head, sub]) => (
                  <div key={head} className="card px-7 py-5">
                    <div className="text-[23px] font-medium leading-snug text-ink">{head}</div>
                    <div className="mt-1 text-[20px] leading-snug text-secondary">{sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : below === "cash" ? (
            <motion.div key="cash" className="card flex items-center justify-between gap-10 px-10 py-5" initial={{ opacity: 0, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
              <div className="min-w-0">
                <div className="eyebrow text-[18px]">Head office account · what the books say on 31 December</div>
                <div className="mt-2 flex items-baseline gap-8 whitespace-nowrap">
                  <div className="relative">
                    <motion.div className="display text-[80px] leading-none" animate={{ opacity: step >= 3 ? 0.28 : 1 }} transition={{ duration: 0.5 }}>
                      <Roll value={bn(D.headOffice)} prefix="−Rp " suffix="bn" format={{ maximumFractionDigits: 1 }} />
                    </motion.div>
                    <motion.div aria-hidden className="absolute left-[-8px] top-[50%] h-[8px] origin-left rounded-full bg-danger"
                      initial={{ scaleX: 0 }} animate={{ scaleX: step >= 3 ? 1 : 0 }} transition={{ duration: 0.55, ease: EASE_OUT }} style={{ width: "calc(100% + 16px)" }} />
                  </div>
                  <span className="text-[30px] text-faint">{usdApprox(D.headOffice)}</span>
                  <In show={step >= 3}><span className="display text-[60px]">It isn&apos;t.</span></In>
                </div>
              </div>
              <div className="display shrink-0 text-right text-[44px] leading-tight">{D.team} people.<br />Weeks. Every month.</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Frame>
  );
}

// 3 · The title: the mark, the name, what the name means.
function Title() {
  return (
    <div className="absolute inset-0 bg-canvas">
      <BrandGrid cols={24} rows={14} className="absolute inset-0 h-full w-full opacity-70 [mask-image:radial-gradient(ellipse_at_center,transparent_42%,#000_100%)]" />
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <motion.div className="card grid size-[200px] place-items-center rounded-[44px]" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
          <span className="text-[128px] leading-none text-hold" style={{ ...MUSIC, transform: "translateY(0.28em)" }} aria-hidden>𝄐</span>
        </motion.div>
        <In delay={0.25}><h1 className="display mt-14 text-[190px]">Fermata</h1></In>
        <In delay={0.45}><p className="mt-8 text-[46px] text-heading-2">A close that runs itself, at any number of stores.</p></In>
        <In delay={0.65}><p className="mt-6 text-[30px] text-faint">In music, a fermata is the mark that means hold.</p></In>
      </div>
    </div>
  );
}


// 7 · How it's built: the architecture, with the three kinds of traffic as builds (settles, needs a person, refused).
// The diagram reads who may do what from the roles table in code, so the old table now lives inside its tiles.
function Built(step: number) {
  return (
    <Frame chapter="Appendix · how it's built" n={9}>
      <In><h2 className="title whitespace-nowrap text-[56px]">Agents propose. People approve. Only the gateway writes.</h2></In>
      <In delay={0.2} className="mt-7"><SystemDiagram step={step} /></In>
    </Frame>
  );
}

// 8 · Self improving: the learning claim. The learning year as Fermata closed it, learning from people's answers,
// against the same year on the same engine with the rules frozen at onboarding (simulated, and labelled so).
function Curve() {
  const L = D.learning;
  return (
    <Frame chapter="Self improving" n={6}>
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
    <Frame chapter="Appendix · proof" n={10}>
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

// 10 · The stack (optional): what runs where. One engine, used live in Convex and offline for the simulator and the export.
const STACK: { place: string; who: string; items: [string, string][] }[] = [
  { place: "The site", who: "Next.js on Vercel", items: [
    ["Landing, demo, dashboard, pitch", "read the exported year, so they load with no backend"],
    ["Ask the books", "hold to talk: Cartesia hears you, Claude picks the answer, code fills every number, Cartesia speaks it"],
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
    <Frame chapter="Appendix · the stack" n={11}>
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

// 11 · How we measure (optional): what each number means and where it comes from, so no figure needs trusting.
const PENDING = "filled in by the final run";
function Measure() {
  const L = D.learning;
  const e: Evaluation | null = D.evaluation;
  const rows: [string, string, string][] = [
    ["Settled on first pass", "Share of bank lines settled on their own the month they arrive. Counted per bank line, not per account.", `${pct(L.first, 0)} → ${pct(L.last, 0)}`],
    ["Lines left for people", "Lines no rule could settle by year end, so a person had to decide them.", num(L.heldLearned)],
    ["What learning did", "The same year on the same engine, closed with learning and with the rules frozen at onboarding.", `${num(L.heldLearned)} vs ${num(L.heldBaseline)}`],
    ["Decisions for people", `One answer per held story plus one approval per rule, at ${D.minutesPerDecision} minutes each (an assumption).`, `~${num(D.decisions)}`],
    ["Rule quality", "Every learned rule is backtested on past books before approval: what it covers, what it gets wrong, and a per payment limit. Day 0 rules are fitted on last year's rows and approved once.", `${L.rules.filter((r) => r.backtest.pass).length} of ${L.rules.length} passed`],
    ["Correctness", "Scored against an answer key the engine never reads: wrong store postings, a week it never saw, and a fuzzer.", e ? `${num(Number(e.wrongStore ?? 0))} wrong store` : PENDING],
  ];
  return (
    <Frame chapter="Appendix · how we measure" n={12}>
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

// 12 · Not just for us, and the close: the stores multiply, the policies and rules stay the same row, and the
// decisions for people (the recorded year's, the old Result slide's figure) stay where they are. Then the two closing
// lines over the dimmed rows. The larger grids are drawn, not measured, and the slide says so.
const STORES_DRAWN: { grow: number; layout: Layout }[] = [
  { grow: 1, layout: { cols: 14, w: 80, h: 80, gap: 14 } },
  { grow: 8, layout: { cols: 28, w: 38, h: 38, gap: 9 } },
  { grow: 40, layout: { cols: 56, w: 17, h: 17, gap: 6 } },
];
// A pattern in two words, by the program's shape: what the rule learned, never which lender or store.
const PATTERN: Record<string, string> = {
  bank_fee: "Bank fee", cancel_pair: "Reversal", card_batch: "Card batch", marketplace_payout: "Platform cut", gateway_settlement: "Gateway fee",
  open_invoices: "Open invoices", lender_sale: "Lender's cut", follow_receipt: "School receipt", school_bills: "Fees paid ahead", reversed_voucher: "Petty cash",
};
function Scale(step: number) {
  const drawn = STORES_DRAWN[Math.min(step, 2)];
  return (
    <Frame chapter="The result" n={7}>
      <motion.div className="h-full" animate={step >= 3 ? { opacity: 0.08, filter: "blur(4px)" } : { opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.6, ease: EASE_OUT }}>
        <In><h2 className="title text-[60px]">Built for scale. More stores, not more questions.</h2></In>
        <div className="mt-12 grid grid-cols-[300px_1fr] items-start gap-x-[60px] gap-y-10">
          <In delay={0.2}>
            <div className="text-[30px] font-medium text-ink">Stores</div>
            <div className="mt-1 text-[21px] leading-snug text-secondary">{step ? "each one adds evidence, not work" : `${words(D.stores).toLowerCase()} in this year`}</div>
          </In>
          <In delay={0.2} className="h-[230px]">
            <Tiles count={D.stores * drawn.grow} layout={drawn.layout} mark={D.stores} delay={(s) => (s < D.stores ? 0.3 + s * 0.03 : ((s - D.stores) / (D.stores * drawn.grow)) * 0.9)} />
          </In>
          <In delay={0.4}>
            <div className="text-[30px] font-medium text-ink">Rules</div>
            <div className="mt-1 text-[21px] leading-snug text-secondary">one per kind of payment, not per store</div>
          </In>
          <In delay={0.4}>
            <div className="grid grid-cols-11 gap-3">
              {D.rules.map((r) => (
                <div key={r.id} className="card flex h-[96px] flex-col justify-between px-3 py-3">
                  <div className="text-[16px] font-medium leading-tight text-ink [overflow-wrap:anywhere]">{PATTERN[r.program.match ?? ""] ?? "Rule"}</div>
                  <div className="eyebrow text-[13px]">{r.learnedInMonth ? "learned" : "fitted"}</div>
                </div>
              ))}
            </div>
          </In>
          <In delay={0.6}>
            <div className="text-[30px] font-medium text-ink">Decisions for people</div>
            <div className="mt-1 text-[21px] leading-snug text-secondary">everything a person did all year</div>
          </In>
          <In delay={0.6}>
            <div className="flex items-baseline gap-8">
              <span className="figure text-[120px] leading-none text-heading"><Roll value={D.decisions} prefix="~" /></span>
              <span className="text-[26px] leading-snug text-secondary">for {num(D.total)} payments:<br />{D.rooms.length} answers and {D.rules.length} approvals.</span>
            </div>
          </In>
        </div>
        <In show={step >= 1 && step < 3} className="absolute bottom-0 left-0 right-0">
          <p className="text-[20px] text-faint">Only the {words(D.stores).toLowerCase()}-store year is measured. The bigger grids show the idea: a pattern is learned once, and more stores only add evidence.</p>
        </In>
      </motion.div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center">
        <In show={step >= 3}><p className="display whitespace-nowrap text-[76px] leading-tight">Everything documented. Audit-ready by default.</p></In>
        <In show={step >= 4} delay={0.1}><p className="display mt-10 text-[150px] leading-none">A close that runs itself.</p></In>
      </div>
    </Frame>
  );
}

// The end card: the mark, the name, the line, where to find it. The title slide's look, so the deck closes where it opened.
function End() {
  return (
    <div className="absolute inset-0 bg-canvas">
      <BrandGrid cols={24} rows={14} className="absolute inset-0 h-full w-full opacity-70 [mask-image:radial-gradient(ellipse_at_center,transparent_42%,#000_100%)]" />
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <In><div className="card grid size-[150px] place-items-center rounded-[34px]"><span className="text-[96px] leading-none text-hold" style={{ ...MUSIC, transform: "translateY(0.28em)" }} aria-hidden>𝄐</span></div></In>
        <In delay={0.2}><h1 className="display mt-12 text-[150px]">Fermata</h1></In>
        <In delay={0.4}><p className="mt-6 text-[46px] text-heading-2">A close that runs itself, at any number of stores.</p></In>
        <In delay={0.6}><p className="mt-16 text-[34px] font-medium text-accent">getfermata.tech</p></In>
        <In delay={0.75}><p className="mt-4 text-[22px] text-faint">github.com/keananwongso/fermata · Built with Claude and Convex</p></In>
      </div>
    </div>
  );
}

// ——— The live middle of the deck: the landing page's components, laid out a little larger for the room.
const BIG = { zoom: 1.32 } as const;
const PATH_STEPS = 4; // Day 0, Matches, Waits, Learns, Blocked: one arrow press each

// 3 · How it's built: the paths diagram, one path per press.
function BuiltLive(step: number) {
  return (
    <Frame chapter="How it's built" n={3}>
      <In><h2 className="title text-[48px]">Code settles. Claude investigates. People approve.</h2></In>
      {/* Sized so the whole canvas, its tabs and its steps fit above the footer. */}
      <In delay={0.2} className="mx-auto mt-6 max-w-[1180px]"><HowDiagram path={Math.min(step, PATH_STEPS)} /></In>
    </Frame>
  );
}

// 4 · A case room: story B's real meeting, one message per press, then the question, the answer and the rest.
function RoomLive(step: number) {
  return (
    <Frame chapter="Case rooms" n={4}>
      <In><h2 className="title text-[60px]">The agents meet. One question comes out.</h2></In>
      <In delay={0.2} className="mt-8"><div style={{ zoom: 1.2 }}><HowRoom step={step} /></div></In>
    </Frame>
  );
}

// 5 · How it learns: from the historic books, then from an answer.
function LearnsLive(step: number) {
  return (
    <Frame chapter="How it learns" n={5}>
      <In><h2 className="title text-[60px]">It learns from the books, and from one answer.</h2></In>
      <In delay={0.2} className="mt-12"><div style={BIG}><HowLearns example={Math.min(step, 1)} /></div></In>
    </Frame>
  );
}

export const SLIDES: Slide[] = [
  { id: "mess", chapter: "Why", steps: 3, render: Family, notes: `"My family runs a multi-store retailer in Indonesia. ${words(D.stores)} stores, and a music school inside them." (click) "Three systems of record, none of which agree. ${words(D.team)} accountants spend weeks after every month-end working out which payment belongs to which store. Until they finish, nobody in leadership sees a real number." (click) "Right now the books say one of its bank accounts is millions of dollars in the red." (click) "It isn't."` },
  { id: "title", chapter: "Fermata", render: Title, notes: `"This is Fermata. A close that runs itself, at any number of stores. In music, a fermata is the mark that means hold, and that's the job: hold only what nobody can explain, and let everything else play on."` },
  { id: "built-live", chapter: "How it's built", steps: PATH_STEPS, render: BuiltLive, notes: `(Day 0) "Before month one, policy mining reads the historic books, every payment someone already matched by hand. Code, not AI, turns each pattern into a rule with a limit. Shopee keeps 6.5%, for example. The CFO approves each rule once."
(click, Matches) "Every payment comes into Convex. The engine is plain code, no AI. It works out which store a payment belongs to and what it pays for. If an approved rule explains it, it's posted to the books, with an audit trail."
(click, Waits) "If nothing explains it, it waits, and goes to a case room."
(click, Learns) "The answer becomes a draft rule. It's backtested on the historic books, the CFO approves it, and from then on that kind of payment matches itself."
(click, Blocked) "And every change goes through one Convex function that checks who's allowed to make it. So an agent can never approve its own work."` },
  { id: "room-live", chapter: "Case rooms", steps: ROOM_STEPS, render: RoomLive, notes: `(Opens on the Engine's message.) "Here's a real one. June: 300 payouts from a lender nobody's seen, so the engine holds them."
(Space · Investigator) "The Investigator finds every payout is one sale, minus 3.8%."
(Space · red line) "And here it tries to approve its own work. Blocked in code."
(Space · Auditor) "The Auditor tries to break the 3.8%, and can't."
(Space · Manager) (Space · Learner's rule) "The Learner drafts the rule as code. That's the whole rule."
(Space · Manager: 2 turns left) "A meeting manager, written in code, keeps them to six turns."
(Space · Auditor) (Space · Meeting closed) "And it lets them ask a person once."
(Space · the question) "One question, to the CFO."
(Space · answered) "Yes."
(Space) (Space · r9 approved) "The answer becomes a rule, and all 300 payments match."
(12 presses in all. The meeting is real Claude output from the recorded run; the self-approval attempt is staged, and labelled.)` },
  { id: "learns-live", chapter: "How it learns", steps: 1, render: LearnsLive, notes: `"So it learns two ways. From the historic books: Shopee sends one transfer for 840 orders, and Fermata worked out from 126 payouts matched by hand that Shopee keeps 6.5%." (click) "And from one answer: the CFO says yes once, FIN_Z keeps 3.8%, and the rule is tested, 300 out of 300, before it counts. Every rule works this way: a kind of payment, and the number that explains it."` },
  { id: "curve", chapter: "Self improving", render: Curve, notes: `"Does the learning matter? Here is the year as Fermata closed it, learning from people's answers, against the same year on the same engine with the rules frozen at onboarding. With learning, the share settled on first pass goes from ${pct(D.learning.first, 0)} in January to ${pct(D.learning.last, 0)} by December. Without it, it ends at ${pct(D.learning.baselineLast, 0)}. At year end that is ${num(D.learning.heldLearned)} lines left for people instead of ${num(D.learning.heldBaseline)}. Each mark is an answer that became a rule, fitted from the data and backtested first."
(Say the line without learning is simulated. With learning is the close itself, run on autopilot: the answers came from the generator's answer key, ${words(D.learning.rules.filter((r) => r.by === "claude").length).toLowerCase()} rules were written by Claude in live case rooms and ${words(D.learning.rules.filter((r) => r.by === "code").length).toLowerCase()} were fitted by code.)` },
  { id: "scale", chapter: "The result", steps: 4, render: Scale, notes: `"It's built for scale. This year has ${words(D.stores).toLowerCase()} stores, and people made about ${num(D.decisions)} decisions in total." (click) "At a thousand stores," (click) "or ten thousand, it doesn't need more questions. It learns kinds of payment, not stores: a marketplace's cut, a lender's cut, a bank's fee. So every new store adds evidence, not work."
(click) "Everything is documented, so everything is audit-ready by default." (click) "It's not a list for the accounting team. It's a close that runs itself."
(Only the ${words(D.stores).toLowerCase()}-store year is measured; the bigger grids are drawn. Never put a number on them.)` },
  { id: "end", chapter: "Fermata", render: End, notes: `(Nothing spoken. Hold on the card for three seconds.)` },
  // After the end card: backup slides for Q&A. Skip past the end to reach them.
  { id: "built", chapter: "Appendix · how it's built", steps: 3, render: Built, notes: `"Here's how it's built. Everything goes through one place in the middle: the system of work, in Convex. Every change, from every agent and every person, is one transition, written together with its audit row." (click) "Blue is a line that settles on its own. It syncs in from the bank, the ERP, the marketplaces and the school. The engine places it and matches it, and if an approved rule explains it, it's settled, and the gateway posts it to the books. That's most of them." (click) "Amber is a line that needs a person. The engine holds it as a story, and the agents meet on it in a case room: the Investigator, the Auditor and the Learner, on Claude, with a meeting manager in code. They ask one person one question. The answer comes back, the Learner turns it into a rule and backtests it, and from then on the engine settles that kind of line on its own." (click) "Red is an agent trying to approve something itself. The gateway refuses, and the refusal is written to the audit log. Agents propose. People approve. Only the gateway writes."`},
  { id: "proof", chapter: "Appendix · proof", render: Proof, notes: `"Every learned rule is fitted from the data and backtested on past books before a person sees it; the Day 0 rules were fitted on last year's rows and approved once. Then we scored the whole year against an answer key the engine never reads: a week it never saw, lines at the wrong store, and altered lines thrown at it by a fuzzer." (Read the three bottom numbers from the slide; never say a number that is not on it.) "All of this data is synthetic, from a fixed seed. The big meetings ran live on Claude; the rest are scripted, and labelled that way."` },
  { id: "stack", chapter: "Appendix · the stack", render: Stack, notes: `"It runs in three places. The site is Next.js on Vercel, and it loads the closed year with no backend. Convex is the whole backend: the engine, the case rooms, the rules and every record. And the same engine runs offline, to generate the year, simulate what-ifs, and export what the site shows."
(Optional: skipped in the three minute video.)` },
  { id: "measure", chapter: "Appendix · how we measure", render: Measure, notes: `"Here's how we measure it, so you don't have to trust a number. We count per bank line. We count what's left for people. We measure learning by closing the same year with and without it. Every learned rule is backtested before approval, every Day 0 rule is fitted on last year's rows and approved once,, and the whole year is scored against an answer key the engine never reads."
(Optional: skipped in the three minute video.)` },
];
