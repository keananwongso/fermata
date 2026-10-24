import type { ReactNode } from "react";
import { LinkArrow, LinkButton, Tag } from "@/components/ui";
import { CONSOLE_LINK } from "@/components/nav";
import { CurveAndMeetings, HowItWorks, MiniRoom, RecordSample, Rules, Sources, fanText } from "@/components/landing";
import { Arrival, BrandGrid, Reveal, RevealItem, Roll, SmoothScroll } from "@/components/motion";
import { Dashboard } from "@/components/dashboard";

export default function Page() {
  return <Arrival><SmoothScroll /><Landing /></Arrival>;
}

function Landing() {
  return (
    <div className="space-y-24 lg:space-y-32">
      {/* Hero: the headline centred on top, the product window under it. */}
      <section className="pt-2">
        <Reveal className="mx-auto max-w-[880px] text-center" stagger={0.1}>
          <RevealItem><Tag tone="neutral">Autonomous cash reconciliation</Tag></RevealItem>
          <RevealItem><h1 className="display mx-auto mt-5 max-w-[820px] text-[clamp(40px,6vw,72px)]">Every bank line, matched on its own.</h1></RevealItem>
          <RevealItem><p className="mx-auto mt-5 max-w-[600px] text-[16px] leading-relaxed text-body">
            Fermata closes the books for a business that sells everywhere. It matches every bank line to the store and the sales it pays for,
            holds only what nobody wrote down, and asks the right person one question. Then it gets better every month.
          </p></RevealItem>
          <RevealItem className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/demo">Watch the live demo</LinkButton>
            <LinkArrow href="#how">See how it works</LinkArrow>
          </RevealItem>
          <RevealItem><p className="mt-6 text-[12px] text-faint">Shown on a fictional 14-store music retailer. Every number here comes from a real run on synthetic books.</p></RevealItem>
        </Reveal>
        <div className="relative mt-12 lg:mt-16">
          <BrandGrid cols={24} rows={8} className="absolute -inset-x-4 -top-10 h-[70%] w-[calc(100%+2rem)] opacity-50 [mask-image:linear-gradient(to_bottom,transparent,#000_30%,transparent)] lg:-inset-x-10 lg:w-[calc(100%+5rem)]" />
          <Reveal className="relative min-w-0" delay={0.35}><RevealItem><Dashboard /></RevealItem></Reveal>
          <div className="relative mt-4 text-center"><LinkArrow href="/dashboard">Open the dashboard</LinkArrow></div>
        </div>
      </section>

      {/* Banner */}
      <section className="relative overflow-hidden rounded-[16px] border border-hairline bg-warm px-6 py-16 text-center lg:py-24">
        <BrandGrid cols={18} rows={6} className="absolute inset-0 h-full w-full opacity-60 [mask-image:radial-gradient(ellipse_at_center,transparent_35%,#000_100%)]" />
        <Reveal className="relative"><RevealItem>
          <p className="display mx-auto max-w-[900px] text-[clamp(30px,4.6vw,56px)]"><Roll value={0.98} format={{ style: "percent", maximumFractionDigits: 0 }} /> of bank lines settle on their own, so the team only answers what nobody wrote down.</p>
        </RevealItem></Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-36 space-y-16 lg:space-y-10">
        <Reveal className="max-w-[640px]">
          <RevealItem><Tag tone="neutral">How it works</Tag></RevealItem>
          <RevealItem><h2 className="display mt-4 text-[clamp(32px,4vw,48px)]">From messy books to a closed year.</h2></RevealItem>
        </Reveal>
        <HowItWorks beats={[
          { tag: "Runs on the books you have", title: "Connects every place money comes from.",
            body: <>Fourteen stores, Shopee, Tokopedia, a website, dealers and a music school, all landing in five shared bank accounts. The books pretend each store has its own account, so they show balances no bank holds: one account sits at <span className="num text-hold-ink">−Rp 48.6bn</span>.</>,
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

      {/* Proof */}
      <Reveal className="grid gap-8 rounded-[16px] border border-hairline bg-ground p-6 lg:grid-cols-[1fr_1.1fr] lg:p-10" stagger={0.12}>
        <RevealItem className="grid grid-cols-2 gap-6">
          <Proof figure={<Roll value={104820} format={{ maximumFractionDigits: 0 }} />} label="bank lines in a year" />
          <Proof figure={<Roll value={40} prefix="~" />} label="decisions left for people" />
          <Proof figure={<><Roll value={0.81} format={{ style: "percent" }} /> → <Roll value={0.98} format={{ style: "percent" }} /></>} label="settled on first pass, Jan to Dec" />
          <Proof figure={<Roll value={0} />} label="lines placed at the wrong store" />
        </RevealItem>
        <RevealItem>
          <div className="eyebrow">Meetings per month, and the share settled automatically</div>
          <div className="mt-4"><CurveAndMeetings /></div>
          <p className="mt-3 text-[12px] text-faint">Early in the year the agents meet every month. As answers become rules, the meetings stop.</p>
        </RevealItem>
      </Reveal>

      {/* Closing */}
      <Reveal className="pb-6 text-center" stagger={0.1}>
        <RevealItem><h2 className="display mx-auto max-w-[760px] text-[clamp(32px,4.6vw,56px)]">Watch a year close in two minutes.</h2></RevealItem>
        <RevealItem><p className="mx-auto mt-4 max-w-[520px] text-[15px] text-secondary">Watch the agents work through a full year. You answer the two questions they bring you.</p></RevealItem>
        <RevealItem className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <LinkButton href="/demo">Watch the live demo</LinkButton>
          <LinkArrow href={CONSOLE_LINK.href}>{CONSOLE_LINK.label}</LinkArrow>
        </RevealItem>
      </Reveal>
    </div>
  );
}

function Proof({ figure, label }: { figure: ReactNode; label: string }) {
  return (
    <div>
      <div className="figure text-[clamp(30px,3.4vw,42px)] text-heading">{figure}</div>
      <div className="mt-1.5 text-[13px] text-secondary">{label}</div>
    </div>
  );
}
