"use client";
// The product dashboard: the closed year at a glance, as an app window. Every figure is read from the recorded
// run (src/demo/recording.json) or the demo company's definition, never typed by hand, so a re-export updates it.
import Link from "next/link";
import type { ReactNode } from "react";
import { STORES } from "../../convex/lib/domain";
import { Avatar } from "./caseRoom";
import { PUBLIC_SITE, TABS } from "./nav";
import { AGENT_LABEL } from "./ui";
import { MUSIC, R, mostAsked, openRooms } from "./dashboard/data";
import { Overview } from "./dashboard/overview";

// ---- The window --------------------------------------------------------------------------------------------------

export function Dashboard({ className = "" }: { className?: string }) {
  return (
    <div className={`frame ${className}`} role="group" aria-label={`Fermata dashboard for ${R.year}, read from a recorded run`}>
      <div className="card grid overflow-hidden lg:grid-cols-[212px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0 bg-canvas">
          <MobileBar />
          <Overview />
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[18px] leading-none text-hold" style={MUSIC} aria-hidden>𝄐</span>
      <span className="display text-[17px] tracking-[-0.03em]">Fermata</span>
    </span>
  );
}

function Sidebar() {
  const items = [{ href: "/dashboard", label: "Dashboard", count: null as ReactNode }, ...TABS.map((t) => ({
    ...t, count: t.href === "/stories" ? <span className="num rounded-full bg-hold-tint px-1.5 text-[11px] text-hold-ink">{openRooms.length}</span>
      : t.href === "/rules" ? <span className="num text-[11px] text-faint">{R.rules.length}</span> : null,
  }))];
  return (
    <aside className="hidden min-w-0 flex-col border-r border-hairline bg-well p-3 lg:flex">
      <div className="px-2 pb-4 pt-1"><Brand /></div>
      <div className="flex items-center gap-2.5 rounded-[8px] border border-hairline bg-ground px-2.5 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-heading text-[15px] text-white" style={MUSIC} aria-hidden><span style={{ transform: "translateY(0.22em)" }}>♪</span></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[12.5px] font-medium text-ink">Music retailer</span>
          <span className="block truncate text-[11px] text-faint">{STORES.length} stores · fictional</span>
        </span>
      </div>
      <nav className="mt-4 space-y-0.5" aria-label="Dashboard sections">
        {items.map((t, i) => (
          <Link key={t.href} href={PUBLIC_SITE && i > 0 ? "/demo" : t.href} aria-current={i === 0 ? "page" : undefined}
            className={`calm flex items-center justify-between rounded-[6px] px-2.5 py-1.5 text-[13px] ${i === 0 ? "bg-ground text-accent shadow-[0_1px_2px_rgb(85_40_20/0.06)]" : "text-body hover:bg-hover hover:text-ink"}`}>
            {t.label}{t.count}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-hairline px-1 pt-3">
        <div className="eyebrow">Acting as</div>
        <div className="mt-1.5 flex items-center gap-2"><Avatar who={mostAsked} size={24} /><span className="text-[12.5px] font-medium text-ink">{AGENT_LABEL[mostAsked]}</span></div>
      </div>
    </aside>
  );
}

// On a phone the sidebar folds into one bar across the top of the window.
function MobileBar() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline bg-well px-3 py-2.5 lg:hidden">
      <Brand />
      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-faint">
        <span className="truncate">Acting as</span><Avatar who={mostAsked} size={22} /><span className="font-medium text-ink">{AGENT_LABEL[mostAsked]}</span>
      </span>
    </div>
  );
}
