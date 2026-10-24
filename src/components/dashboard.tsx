"use client";
// The product dashboard: the closed year at a glance, as an app window. Every figure is read from the recorded
// run (src/demo/recording.json) or the demo company's definition, never typed by hand, so a re-export updates it.
// The sidebar switches views inside the window, like an app, so nothing in it navigates away from the page.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { STORES } from "../../convex/lib/domain";
import { Avatar } from "./caseRoom";
import { scrollToY } from "./motion";
import { TABS } from "./nav";
import { AGENT_LABEL } from "./ui";
import { MUSIC, R, mostAsked, openRooms } from "./dashboard/data";
import { DashboardNav, HOME, navFromQuery, navQuery, type Nav } from "./dashboard/nav";
import { Overview } from "./dashboard/overview";
import { CaseRooms } from "./dashboard/rooms";
import { Rules } from "./dashboard/rules";
import { Evaluation, Record, Run } from "./dashboard/screens";

// ---- The views ---------------------------------------------------------------------------------------------------

// One entry per sidebar item. To add a view, add its panel here (and to TABS in nav.ts if the console has it too).
type View = { id: string; label: string; count?: ReactNode; console?: string; Panel: (p: { room: string | null; console?: string }) => ReactNode };
const PANELS: Record<string, { id: string; Panel: View["Panel"]; count?: ReactNode }> = {
  "/run": { id: "run", Panel: Run },
  "/stories": { id: "case-rooms", Panel: CaseRooms, count: <span className="num rounded-full bg-hold-tint px-1.5 text-[11px] text-hold-ink">{openRooms.length}<span className="sr-only"> waiting</span></span> },
  "/rules": { id: "rules", Panel: Rules, count: <span className="num text-[11px] text-faint">{R.rules.length}<span className="sr-only"> rules</span></span> },
  "/evaluation": { id: "evaluation", Panel: Evaluation },
  "/record": { id: "record", Panel: Record },
};
const VIEWS: View[] = [
  { id: HOME.view, label: "Dashboard", Panel: Overview },
  ...TABS.flatMap((t) => (PANELS[t.href] ? [{ ...PANELS[t.href], label: t.label, console: t.href }] : [])),
];
const valid = (n?: Nav): Nav => (n && VIEWS.some((v) => v.id === n.view) && (!n.room || R.rooms.some((r) => r.key === n.room)) ? n : n?.room ? { ...n, room: null } : HOME);

// ---- The window --------------------------------------------------------------------------------------------------

// `initial` opens a view directly; `onNavigate` hears every move (the /dashboard page mirrors it into the URL).
// The landing page's hero passes neither, so its state stays local.
export function Dashboard({ className = "", initial, onNavigate }: { className?: string; initial?: Nav; onNavigate?: (n: Nav) => void }) {
  const [nav, setNav] = useState<Nav>(() => valid(initial));
  const win = useRef<HTMLDivElement>(null);
  const uid = useId();
  const go = useCallback((to: Nav) => {
    const next = valid(to);
    setNav(next);
    onNavigate?.(next);
    // On a phone the window grows with its view, so a move made from low down (a Review link) brings its top back.
    const el = win.current;
    if (el && window.matchMedia("(max-width: 1024px)").matches) {
      const top = el.getBoundingClientRect().top;
      if (top < 0) scrollToY(window.scrollY + top - 152);
    }
  }, [onNavigate]);
  const view = VIEWS.find((v) => v.id === nav.view) ?? VIEWS[0];
  const ids = useMemo(() => ({ panel: `${uid}-panel`, tab: (id: string) => `${uid}-tab-${id}`, mtab: (id: string) => `${uid}-mtab-${id}` }), [uid]);
  const home = view.id === HOME.view;
  const panel = { id: ids.panel, role: "tabpanel", "aria-labelledby": ids.tab(view.id), tabIndex: -1 } as const;
  return (
    <DashboardNav.Provider value={go}>
      <div ref={win} className={`frame ${className}`} role="group" aria-label={`Fermata dashboard for ${R.year}, read from a recorded run`}>
        <div className="card grid overflow-hidden lg:grid-cols-[212px_minmax(0,1fr)]">
          <Sidebar nav={nav} go={go} ids={ids} />
          <div className="min-w-0 bg-canvas">
            <MobileBar nav={nav} go={go} ids={ids} />
            {/* The overview always sets the window's height on wide screens; other views sit over it and scroll inside,
                so switching never moves the page. On a phone each view takes its own height instead. */}
            <div className="relative min-w-0">
              <div {...(home ? panel : {})} className={home ? "" : "max-lg:hidden lg:invisible"} inert={!home}><Overview /></div>
              {home ? null : (
                <div key={`${view.id}:${nav.room ?? ""}`} {...panel} data-lenis-prevent
                  className="enter scroll-quiet min-w-0 focus:outline-none lg:absolute lg:inset-0 lg:overflow-y-auto">
                  <view.Panel room={nav.room} console={view.console} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardNav.Provider>
  );
}

// /dashboard: the same window, opened from `?view=` and `?room=` and kept in step with the address bar.
export function DashboardFromUrl({ className = "" }: { className?: string }) {
  const params = useSearchParams();
  const [initial] = useState(() => navFromQuery(params.get("view"), params.get("room")));
  const mirror = useCallback((n: Nav) => window.history.replaceState(window.history.state, "", `${window.location.pathname}${navQuery(n)}`), []);
  return <Dashboard className={className} initial={initial} onNavigate={mirror} />;
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[18px] leading-none text-hold" style={MUSIC} aria-hidden>𝄐</span>
      <span className="display text-[17px] tracking-[-0.03em]">Fermata</span>
    </span>
  );
}

// ---- The tabs ----------------------------------------------------------------------------------------------------

type Ids = { panel: string; tab: (id: string) => string; mtab: (id: string) => string };
type TabsProps = { nav: Nav; go: (n: Nav) => void; ids: Ids };

// Arrow keys move between tabs and open them (Home and End jump to the ends), as a tablist should.
function useTabKeys(nav: Nav, go: (n: Nav) => void, idOf: (id: string) => string) {
  return (e: KeyboardEvent) => {
    const i = VIEWS.findIndex((v) => v.id === nav.view);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const to = e.key === "Home" ? 0 : e.key === "End" ? VIEWS.length - 1 : step ? (i + step + VIEWS.length) % VIEWS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    go({ view: VIEWS[to].id, room: null });
    document.getElementById(idOf(VIEWS[to].id))?.focus();
  };
}

function Tab({ v, nav, go, id, ids, highlight, className }: { v: View; nav: Nav; go: (n: Nav) => void; id: string; ids: Ids; highlight: string; className: string }) {
  const on = v.id === nav.view;
  return (
    <button type="button" role="tab" id={id} aria-selected={on} aria-controls={ids.panel} tabIndex={on ? 0 : -1}
      // Choosing the tab you are on goes back to its start (out of a room to the list).
      onClick={() => go({ view: v.id, room: null })}
      className={`calm relative isolate flex items-center justify-between gap-2 text-[13px] ${on ? "text-accent" : "text-body hover:bg-hover hover:text-ink"} ${className}`}>
      {on ? <motion.span layoutId={highlight} aria-hidden className="absolute inset-0 -z-10 rounded-[inherit] bg-ground shadow-[0_1px_2px_rgb(85_40_20/0.08)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} /> : null}
      {v.label}{v.count ?? null}
    </button>
  );
}

function Sidebar({ nav, go, ids }: TabsProps) {
  const keys = useTabKeys(nav, go, ids.tab);
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
      <div role="tablist" aria-label="Dashboard sections" aria-orientation="vertical" onKeyDown={keys} className="mt-4 space-y-0.5">
        {VIEWS.map((v) => (
          <Tab key={v.id} v={v} nav={nav} go={go} id={ids.tab(v.id)} ids={ids} highlight="dash-tab"
            className="w-full rounded-[6px] px-2.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent" />
        ))}
      </div>
      <div className="mt-auto border-t border-hairline px-1 pt-3">
        <div className="eyebrow">Acting as</div>
        <div className="mt-1.5 flex items-center gap-2"><Avatar who={mostAsked} size={24} /><span className="text-[12.5px] font-medium text-ink">{AGENT_LABEL[mostAsked]}</span></div>
      </div>
    </aside>
  );
}

// On a phone the sidebar folds into one bar across the top of the window, with the views as a row of tabs that
// scrolls sideways inside the window, never the page.
function MobileBar({ nav, go, ids }: TabsProps) {
  const keys = useTabKeys(nav, go, ids.mtab);
  const row = useRef<HTMLDivElement>(null);
  // Keep the open tab in view in the row (by scrolling the row itself; scrollIntoView would move the page too).
  // The row may have no size yet (the page fades in hidden), so this runs again once it is laid out.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const reveal = () => {
      const tab = document.getElementById(ids.mtab(nav.view));
      if (!tab || el.scrollWidth <= el.clientWidth) return;
      const left = tab.offsetLeft - 8, right = tab.offsetLeft + tab.offsetWidth + 8;
      if (left < el.scrollLeft) el.scrollTo({ left });
      else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth });
    };
    reveal();
    const ro = new ResizeObserver(reveal);
    ro.observe(el);
    return () => ro.disconnect();
  }, [nav.view, ids]);
  return (
    <div className="border-b border-hairline bg-well lg:hidden">
      <div className="flex items-center justify-between gap-3 px-3 pb-1.5 pt-2.5">
        <Brand />
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-faint">
          <span className="truncate">Acting as</span><Avatar who={mostAsked} size={22} /><span className="font-medium text-ink">{AGENT_LABEL[mostAsked]}</span>
        </span>
      </div>
      <div ref={row} role="tablist" aria-label="Dashboard sections" onKeyDown={keys} className="scroll-quiet relative flex gap-1 overflow-x-auto px-2 pb-1.5">
        {VIEWS.map((v) => (
          <Tab key={v.id} v={v} nav={nav} go={go} id={ids.mtab(v.id)} ids={ids} highlight="dash-mtab"
            className="min-h-11 shrink-0 whitespace-nowrap rounded-full px-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent" />
        ))}
      </div>
    </div>
  );
}
