import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard, DashboardFromUrl } from "@/components/dashboard";
import { Arrival, Reveal, RevealItem } from "@/components/motion";

export const metadata: Metadata = { title: "Dashboard · Fermata" };

// One fixed screen on wide screens, like the demo: no heading, no footer, no page scroll; the window fills what the
// header leaves and every view scrolls inside it (globals.css, `data-fixed-page`). Below 1280px the page scrolls.
export default function DashboardPage() {
  return (
    <Arrival>
      <div data-fixed-page className="xl:h-[calc(100dvh-110px)]">
        {/* `?view=rules` or `?room=<key>` opens a view directly. The prerendered page shows the overview until the address is read. */}
        <Reveal className="h-full"><RevealItem className="h-full"><Suspense fallback={<Dashboard fill />}><DashboardFromUrl fill /></Suspense></RevealItem></Reveal>
      </div>
    </Arrival>
  );
}
