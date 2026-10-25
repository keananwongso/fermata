import type { ReactNode } from "react";
import Link from "next/link";
import { LinkArrow, LinkButton, Tag } from "@/components/ui";
import { CONSOLE_LINK } from "@/components/nav";
import { HowItWorks, LearnedRules, MiniRoom, RecordSample, Rules, Sources, fanText } from "@/components/landing";
import { CLOSE_CAPTION, LearningChart } from "@/components/learningChart";
import { LY } from "@/components/learningYear";
import { usdApprox } from "@/components/money";
import recording from "@/demo/recording.json";
import { num, pct, rpShort } from "../../convex/lib/format";
import { Arrival, BrandGrid, Reveal, RevealItem, Roll, SmoothScroll } from "@/components/motion";
import { Dashboard } from "@/components/dashboard";

// What the books claimed for the head office account on 31 December, read from the recording.
const HEAD_OFFICE = (recording as unknown as { headOffice: number }).headOffice;
// The questions a visitor answers in the demo: one per case room the agents meet live.
const LIVE_ROOMS = (recording as unknown as { rooms: { live: boolean }[] }).rooms.filter((r) => r.live).length;
const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six"];
const signedRp = (n: number) => (n < 0 ? `−${rpShort(-n)}` : rpShort(n));

export default function Page() {
  return <Arrival><SmoothScroll /><Landing /></Arrival>;
}

function Landing() {
  return (
    <div className="space-y-24 lg:space-y-32">
      {/* Hero: the headline centred on top, the product window under it. */}
      <section className="relative pt-2">
        {/* One band of brand cells hangs from the top of the page, behind the header, and clears before the window. */}
        <BrandGrid top cols={24} rows={12} className="absolute left-1/2 -top-40 h-[680px] w-screen -translate-x-1/2 opacity-70 [mask-image:linear-gradient(to_bottom,#000_35%,transparent)] lg:-top-44 lg:h-[820px]" />
        <Reveal className="relative mx-auto max-w-[880px] text-center" stagger={0.1}>
          <RevealItem><Tag tone="neutral">Autonomous cash reconciliation</Tag></RevealItem>
          <RevealItem><h1 className="display mx-auto mt-5 max-w-[820px] text-[clamp(40px,6vw,72px)]">Every bank line, matched on its own.</h1></RevealItem>
          <RevealItem><p className="mx-auto mt-5 max-w-[600px] text-[16px] leading-relaxed text-body">
            Fermata closes the books for a business that sells everywhere. It matches every bank line to the store and the sales it pays for,
            holds only what nobody wrote down, and asks the right person one question. Then it turns the answers into tested rules, so fewer lines need a person.
          </p></RevealItem>
          <RevealItem className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/demo">Watch the live demo</LinkButton>
            <LinkArrow href="#how">See how it works</LinkArrow>
          </RevealItem>
          <RevealItem><p className="mt-6 text-[12px] text-faint">Shown on a fictional 14-store music retailer. Every number here comes from a real run on synthetic books.</p></RevealItem>
        </Reveal>
        <div className="relative mt-12 lg:mt-16">
          <Reveal className="relative min-w-0" delay={0.35}><RevealItem><Dashboard /></RevealItem></Reveal>
          {/* The window is the year already closed: the way on is to watch it close; full screen is the quiet second. */}
          <div className="relative mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <LinkArrow href="/demo">Watch this year close in the live demo</LinkArrow>
            <Link href="/dashboard" className="calm text-[13px] text-secondary hover:text-accent">Open it full screen</Link>
          </div>
        </div>
      </section>

      {/* Banner: the learning claim: the year as Fermata closed it against the same year with the rules frozen
          (src/demo/recording.json, through learningYear.ts). */}
      <section className="relative overflow-hidden rounded-[16px] border border-hairline bg-warm px-6 py-16 text-center lg:py-24">
        <Reveal className="relative" stagger={0.1}>
          <RevealItem><p className="display mx-auto max-w-[900px] text-[clamp(30px,4.6vw,56px)]"><Roll value={LY.fewer} suffix="×" /> fewer lines left for people, once Fermata learns from their answers.</p></RevealItem>
          <RevealItem><p className="mx-auto mt-6 max-w-[600px] text-[15px] leading-relaxed text-secondary">
            <span className="num text-ink">{num(LY.heldLearned)}</span> lines left for people at year end as Fermata closed it, learning from their answers. The same year on the same engine with the rules frozen at onboarding, simulated: <span className="num text-ink">{num(LY.heldBaseline)}</span>.
          </p></RevealItem>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-36 space-y-16 lg:space-y-10">
        <Reveal className="max-w-[640px]">
          <RevealItem><Tag tone="neutral">How it works</Tag></RevealItem>
          <RevealItem><h2 className="display mt-4 text-[clamp(32px,4vw,48px)]">From messy books to a closed year.</h2></RevealItem>
        </Reveal>
        <HowItWorks beats={[
          { tag: "Runs on the books you have", title: "Connects every place money comes from.",
            body: <>Fourteen stores, Shopee and Tokopedia (Southeast Asia&apos;s Amazon and eBay), a website, dealers and a music school, all landing in five shared bank accounts. The books pretend each store has its own account, so they show balances no bank holds: one account sits at <span className="num text-hold-ink">{signedRp(HEAD_OFFICE)}</span> <span className="text-faint">({usdApprox(HEAD_OFFICE)})</span>.</>,
            visual: <Sources /> },
          { tag: "Learns your business", title: "Learns how the money really moves, then keeps learning.",
            body: <>It starts by learning last year&apos;s books: card fees, marketplace commissions, lender cuts. Every rule is a small program, tested on last year before anyone sees it. When an accountant corrects something, it becomes a rule too.</>,
            visual: <Rules /> },
          { tag: "Agents do the work", title: "Does the work, and asks for input only when it must.",
            body: <>The engine settles what it can explain, such as {fanText}. What it can&apos;t, the agents meet on: one investigates, one tries to break the case, one drafts the rule. A meeting manager written in code keeps them honest, and brings one question to one person.</>,
            visual: <MiniRoom /> },
          { tag: "Audit-ready by default", title: "Every step on record, including what was refused.",
            body: <>Every change is written in the same step as the change itself: the evidence, the rule that allowed it, who approved it. No agent can approve or post anything, and when one tries, the refusal is on record too.</>,
            visual: <RecordSample /> },
        ]} />
      </section>

      {/* Proof: the learning claim is the year as Fermata closed it, learning, against the same year on the same engine with
          the rules frozen (simulated). Every figure here is read from the recording through learningYear.ts. */}
      <Reveal className="rounded-[16px] border border-hairline bg-ground p-6 lg:p-10" stagger={0.12}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div>
            <RevealItem><Tag tone="neutral">Proof</Tag></RevealItem>
            <RevealItem><h2 className="title mt-4 text-[clamp(26px,2.6vw,36px)]">Learning is what keeps the work small.</h2></RevealItem>
            <RevealItem><p className="mt-4 max-w-[460px] text-[15px] leading-relaxed text-body">
              A year of the mess that keeps coming back, closed by Fermata learning from people&apos;s answers, against the same year on the same engine with the rules frozen at onboarding, simulated.
            </p></RevealItem>
          </div>
          <RevealItem className="grid grid-cols-2 gap-6 self-end">
            <Proof figure={<><Roll value={LY.first} format={{ style: "percent" }} /> → <Roll value={LY.last} format={{ style: "percent" }} /></>} className="col-span-2 sm:col-span-1" label="settled on first pass with learning, Jan to Dec" sub={`${pct(LY.baselineLast, 0)} in Dec without learning`} />
            <Proof figure={<Roll value={LY.heldLearned} />} label="lines left for people at year end" sub={`${num(LY.heldBaseline)} without learning`} />
            <Proof figure={<Roll value={LY.rules.length} />} label="rules learned from answers, each backtested first" />
            <Proof figure={<Roll value={LY.total} />} className="col-span-2 sm:col-span-1" label="bank lines in the year" />
          </RevealItem>
        </div>
        <RevealItem className="mt-10"><LearningChart learned={LY.learned} baseline={LY.baseline} caption={CLOSE_CAPTION} /></RevealItem>
      </Reveal>

      {/* Trust: what keeps a mistake small. */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal className="min-w-0 max-w-[560px]" stagger={0.1}>
          <RevealItem><Tag tone="neutral">Trust</Tag></RevealItem>
          <RevealItem><h2 className="display mt-4 text-[clamp(32px,4vw,48px)]">What if it gets one wrong?</h2></RevealItem>
          <RevealItem><p className="mt-5 text-[15px] leading-relaxed text-body">
            People approve rules, not lines. Every rule is fitted from the data and backtested against the books before anyone sees it, and it settles nothing above its per-payment limit. What no rule explains is held, never guessed. Every step is on the record, with its evidence and who approved it.
          </p></RevealItem>
          <RevealItem className="mt-5"><LinkArrow href="/dashboard?view=rules">See every rule and its backtest</LinkArrow></RevealItem>
        </Reveal>
        <Reveal className="min-w-0"><RevealItem><LearnedRules /></RevealItem></Reveal>
      </section>

      {/* Closing */}
      <Reveal className="pb-6 text-center" stagger={0.1}>
        <RevealItem><h2 className="display mx-auto max-w-[760px] text-[clamp(32px,4.6vw,56px)]">Watch a year close in two minutes.</h2></RevealItem>
        <RevealItem><p className="mx-auto mt-4 max-w-[520px] text-[15px] text-secondary">Watch the agents work through a full year. You answer the {COUNT_WORD[LIVE_ROOMS] ?? num(LIVE_ROOMS)} {LIVE_ROOMS === 1 ? "question" : "questions"} they bring you.</p></RevealItem>
        <RevealItem className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <LinkButton href="/demo">Watch the live demo</LinkButton>
          <LinkArrow href={CONSOLE_LINK.href}>{CONSOLE_LINK.label}</LinkArrow>
        </RevealItem>
      </Reveal>
    </div>
  );
}

function Proof({ figure, label, sub, className = "" }: { figure: ReactNode; label: string; sub?: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="figure whitespace-nowrap text-[clamp(30px,3.4vw,42px)] text-heading">{figure}</div>
      <div className="mt-1.5 text-[13px] text-secondary">{label}</div>
      {sub ? <div className="mt-0.5 text-[12px] text-faint">{sub}</div> : null}
    </div>
  );
}
