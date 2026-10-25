import Link from "next/link";
import { LinkArrow, LinkButton, Tag } from "@/components/ui";
import { CONSOLE_LINK } from "@/components/nav";
import { HowDiagram } from "@/components/howDiagram";
import { HowLearns } from "@/components/howLearns";
import { LearningChart } from "@/components/learningChart";
import { LY } from "@/components/learningYear";
import { num, pct } from "../../convex/lib/format";
import { Arrival, BrandGrid, Reveal, RevealItem, Roll, SmoothScroll } from "@/components/motion";
import { Dashboard } from "@/components/dashboard";

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
          <RevealItem><Tag tone="neutral">Cash reconciliation for multi-store retail</Tag></RevealItem>
          <RevealItem><h1 className="display mx-auto mt-5 max-w-[820px] text-[clamp(40px,6vw,72px)]">The cash clerk a multi-store retailer can actually hire.</h1></RevealItem>
          <RevealItem><p className="mx-auto mt-5 max-w-[600px] text-[16px] leading-relaxed text-body">
            Fermata closes the books by matching every bank transaction to the store and the sales it pays for. It learns the business from the books it already has,
            holds and asks only about what nobody wrote down, and gets better every month.
          </p></RevealItem>
          <RevealItem className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/demo">Watch the live demo</LinkButton>
            <LinkArrow href="#how">See how it works</LinkArrow>
          </RevealItem>
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
          <RevealItem><p className="mx-auto mt-6 max-w-[600px] text-[15px] text-secondary">
            <span className="num text-ink">{num(LY.heldLearned)}</span> left at year end. <span className="num text-ink">{num(LY.heldBaseline)}</span> without learning, simulated.
          </p></RevealItem>
        </Reveal>
      </section>

      {/* How it works: how it's built (the paths through the system) and how it learns (one rule, three layers). The
          header's How it works link scrolls here. See DESIGN.md, How it works. */}
      <section id="how" className="scroll-mt-28 space-y-20 lg:space-y-24">
        <Reveal className="max-w-[760px]" stagger={0.08}>
          <RevealItem><Tag tone="neutral">How it works</Tag></RevealItem>
          <RevealItem><h2 className="display mt-4 text-[clamp(34px,4.6vw,56px)]">Code settles. Claude investigates. People approve.</h2></RevealItem>
          <RevealItem className="mt-5"><LinkArrow href="/demo?guide">Step through it in the demo</LinkArrow></RevealItem>
        </Reveal>
        <div>
          <h3 className="title mb-6 text-[clamp(24px,2.6vw,32px)]">How it&apos;s built. Pick a path, click a box.</h3>
          <HowDiagram />
        </div>
        <div>
          <h3 className="title mb-6 text-[clamp(24px,2.6vw,32px)]">How it learns. Every rule starts as a decision a person made.</h3>
          <HowLearns />
        </div>
      </section>

      {/* Proof: the year as Fermata closed it, learning, against the same year with the rules frozen (simulated). The
          banner already carries the year-end counts, so this is the curve. */}
      <Reveal className="rounded-[16px] border border-hairline bg-ground p-6 lg:p-10" stagger={0.12}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <RevealItem><Tag tone="neutral">Proof</Tag></RevealItem>
            <RevealItem><h2 className="title mt-4 text-[clamp(26px,2.6vw,36px)]">It got better every month.</h2></RevealItem>
          </div>
          <RevealItem className="text-right">
            <div className="figure whitespace-nowrap text-[clamp(30px,3.4vw,42px)] text-heading"><Roll value={LY.first} format={{ style: "percent" }} /> → <Roll value={LY.last} format={{ style: "percent" }} /></div>
            <div className="mt-1 text-[13px] text-secondary">settled on its own, Jan to Dec · {pct(LY.baselineLast, 0)} without learning</div>
          </RevealItem>
        </div>
        <RevealItem className="mt-8"><LearningChart learned={LY.learned} baseline={LY.baseline} caption="Without learning: the same year, rules frozen at day one, simulated." /></RevealItem>
      </Reveal>

      {/* Closing: what it adds up to, the way in, and the one mention of the design partner. */}
      <section className="relative overflow-hidden rounded-[16px] border border-hairline bg-warm px-6 py-16 text-center lg:py-24">
        <Reveal className="relative" stagger={0.1}>
          <RevealItem><p className="display mx-auto max-w-[900px] text-[clamp(30px,4.6vw,56px)]">Not a list for the accounting team. A close that runs itself.</p></RevealItem>
          <RevealItem className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/demo">Watch the live demo</LinkButton>
            <LinkArrow href={CONSOLE_LINK.href}>{CONSOLE_LINK.label}</LinkArrow>
          </RevealItem>
          <RevealItem><p className="mt-8 text-[12px] text-faint">Modelled on a real multi-store music retailer, the first design partner.</p></RevealItem>
        </Reveal>
      </section>
    </div>
  );
}
