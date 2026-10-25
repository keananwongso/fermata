import type { ReactNode } from "react";
import { LinkArrow, LinkButton, Tag } from "@/components/ui";
import { HowDiagram } from "@/components/howDiagram";
import { HowLearns } from "@/components/howLearns";
import { LearningChart } from "@/components/learningChart";
import { LY } from "@/components/learningYear";
import { num, pct } from "../../../convex/lib/format";
import { Reveal, RevealItem } from "@/components/motion";

export const metadata = { title: "How it works · Fermata" };

// How it works: how it's built (the paths through the system), how it learns (one rule, three layers) and the proof.
// One phrase per heading; the detail is in what you click. See DESIGN.md, How it works page.
export default function Page() {
  return (
    <div className="space-y-20 lg:space-y-28">
      <Reveal className="max-w-[760px]" stagger={0.08}>
        <RevealItem><Tag tone="neutral">How it works</Tag></RevealItem>
        <RevealItem><h1 className="display mt-4 text-[clamp(36px,5vw,60px)]">Code settles. Claude investigates. People approve.</h1></RevealItem>
        <RevealItem className="mt-6 flex flex-wrap items-center gap-4">
          <LinkButton href="/demo?guide">Step through it in the demo</LinkButton>
          <LinkArrow href="#learns">How it learns</LinkArrow>
        </RevealItem>
      </Reveal>

      <Section tag="How it's built" title="Pick a path. Click a box.">
        <HowDiagram />
      </Section>

      <Section id="learns" tag="How it learns" title="Every rule starts as a decision a person made.">
        <HowLearns />
      </Section>

      <Section tag="Proof" title="It got better every month.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure value={<>{pct(LY.first, 0)} → {pct(LY.last, 0)}</>} label="settled on its own, Jan to Dec" sub={`${pct(LY.baselineLast, 0)} without learning`} />
          <Figure value={num(LY.heldLearned)} label="lines left for people" sub={`${num(LY.heldBaseline)} without learning`} />
          <Figure value={num(LY.rules.length)} label="rules learned from answers" sub="each backtested first" />
        </div>
        <div className="card mt-4 p-5 lg:p-7"><LearningChart learned={LY.learned} baseline={LY.baseline} caption="Without learning: the same year, rules frozen at day one, simulated." /></div>
      </Section>
    </div>
  );
}

function Section({ id, tag, title, children }: { id?: string; tag: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-36">
      <Tag tone="neutral">{tag}</Tag>
      <h2 className="display mt-4 mb-8 text-[clamp(28px,3.4vw,42px)]">{title}</h2>
      {children}
    </section>
  );
}

function Figure({ value, label, sub }: { value: ReactNode; label: string; sub: string }) {
  return (
    <div className="card p-5">
      <div className="figure text-[clamp(30px,3.2vw,40px)] text-heading">{value}</div>
      <div className="mt-1.5 text-[13px] text-secondary">{label}</div>
      <div className="mt-0.5 text-[12px] text-faint">{sub}</div>
    </div>
  );
}
