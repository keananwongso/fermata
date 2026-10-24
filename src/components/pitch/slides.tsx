"use client";
// The pitch, one slide per beat of the video plan. Copy follows the philosophy doc's words; every figure comes
// from `D` (the recording). Notes are the spoken script, shown with N while recording the voice over.
import { motion } from "motion/react";
import { BANK_ACCOUNTS } from "../../../convex/lib/domain";
import { num } from "../../../convex/lib/format";
import { BrandGrid, Roll } from "../motion";
import { D } from "./data";
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

function Big({ figure, label, delay }: { figure: React.ReactNode; label: string; delay: number }) {
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

export const SLIDES: Slide[] = [
  { id: "hook", chapter: "Why", steps: 2, render: Hook, notes: `"This company's books say one of its bank accounts is at minus forty eight point six billion rupiah." (click) "It isn't." (click) "The bank holds three point two four billion."` },
  { id: "mess", chapter: "Why", render: Mess, notes: `"This is built from what I've seen in my family's music business in Indonesia. Money comes in six ways: fourteen stores, Shopee, Tokopedia, a website, dealers and a music school. None of them pays one sale at a time: one Shopee payout covers eight hundred and forty orders. And it all lands in five bank accounts shared by fourteen stores. The books pretend each store has its own, so they keep seventy balances no bank holds."` },
  { id: "cost", chapter: "Why", render: Cost, notes: `"A twenty person accounting team spends about a month matching it by hand. Until they finish, nobody sees the real number."` },
  { id: "title", chapter: "Fermata", render: Title, notes: `"In music, a fermata is the mark that tells you to hold. Fermata closes the year on its own, and only holds where it should."` },
];
