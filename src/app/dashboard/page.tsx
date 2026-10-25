import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard, DashboardFromUrl } from "@/components/dashboard";
import { LinkArrow, LinkButton, PageHead } from "@/components/ui";
import { Arrival, Reveal, RevealItem } from "@/components/motion";

export const metadata: Metadata = { title: "Dashboard · Fermata" };

export default function DashboardPage() {
  return (
    <Arrival>
      <div className="space-y-8 lg:space-y-10">
        <PageHead tag="Overview" title="The year at a glance."
          actions={<div className="flex flex-wrap items-center gap-4"><LinkArrow href="/how">How it works</LinkArrow><LinkButton href="/demo">Watch the live demo</LinkButton></div>}>
          The closed year from the recorded run: the cash the bank really holds, how much settled on its own, what each agent did and what is still waiting on a person.
        </PageHead>
        {/* `?view=rules` or `?room=<key>` opens a view directly. The prerendered page shows the overview until the address is read. */}
        <Reveal><RevealItem><Suspense fallback={<Dashboard />}><DashboardFromUrl /></Suspense></RevealItem></Reveal>
      </div>
    </Arrival>
  );
}
