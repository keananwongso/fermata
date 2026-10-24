"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole, type HumanRole } from "./providers";
import { SITE_LINKS, TABS } from "./nav";
import { LinkButton } from "./ui";

export const ROLE_LABEL: Record<HumanRole, string> = { accountant: "Accountant", cfo: "CFO" };
const isActive = (path: string, href: string) => (href === "/" ? path === "/" : !href.includes("#") && path.startsWith(href));

export function Header() {
  const path = usePathname();
  // The landing page and the public demo get the site navigation; the console gets its tabs and role switch.
  const site = path === "/" || path.startsWith("/demo");
  const links = site ? SITE_LINKS : TABS;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <div className="bg-night px-4 py-2 text-center text-[12px] text-white/75">
        A fictional Indonesian music retailer. Every store, amount and person here is synthetic.
      </div>
      <div aria-hidden onClick={() => setOpen(false)}
        className={`fixed inset-0 z-20 bg-ink/25 transition-opacity duration-350 ease-out lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <header className="sticky top-3 z-30 mt-3 px-4 lg:px-6">
        <div className="mx-auto max-w-[1180px] rounded-[8px] border border-hairline bg-ground shadow-[0_1px_2px_rgb(85_40_20/0.05),0_10px_30px_-18px_rgb(85_40_20/0.18)]">
          <div className="flex h-14 items-center gap-6 pl-4 pr-2 lg:pr-3">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2" aria-label="Fermata, home">
              <span className="text-[20px] leading-none text-hold" aria-hidden>𝄐</span>
              <span className="display text-[19px] tracking-[-0.03em]">Fermata</span>
            </Link>
            <Tabs path={path} links={links} />
            <div className="ml-auto hidden items-center gap-3 lg:flex">
              {site ? <LinkButton href="/demo">Watch the live demo</LinkButton> : <>
                <span className="hidden text-[12px] text-faint xl:inline">Acting as</span>
                <RoleSwitch />
              </>}
            </div>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"}
              className="relative ml-auto flex h-11 w-11 items-center justify-center rounded-[6px] hover:bg-hover lg:hidden">
              <span className={`absolute h-[1.5px] w-5 rounded bg-ink transition-transform duration-350 ease-spring ${open ? "rotate-45" : "-translate-y-[4px]"}`} />
              <span className={`absolute h-[1.5px] w-5 rounded bg-ink transition-transform duration-350 ease-spring ${open ? "-rotate-45" : "translate-y-[4px]"}`} />
            </button>
          </div>
          <div id="mobile-nav" inert={!open} className={`grid transition-[grid-template-rows] duration-350 ease-out lg:hidden ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <nav className="space-y-0.5 border-t border-hairline px-2 pb-3 pt-2">
                {links.map((t) => {
                  const active = isActive(path, t.href);
                  return (
                    <Link key={t.href} href={t.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                      className={`calm flex min-h-11 items-center rounded-[6px] px-3 text-[15px] ${active ? "bg-warm text-accent shadow-[inset_2px_0_0_var(--color-accent)]" : "text-ink hover:bg-hover hover:text-accent"}`}>
                      {t.label}
                    </Link>
                  );
                })}
                {site ? <div className="px-3 pt-3"><LinkButton href="/demo">Watch the live demo</LinkButton></div> : <div className="flex items-center justify-between px-3 pt-3 text-[12px] text-faint">Acting as <RoleSwitch /></div>}
              </nav>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

// Labels turn blue on hover, and the current page stays blue.
function Tabs({ path, links }: { path: string; links: { href: string; label: string }[] }) {
  return (
    <nav className="hidden h-9 items-stretch lg:flex">
      {links.map((t) => {
        const active = isActive(path, t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`flex items-center px-4 text-[14px] transition-colors duration-400 ease-brand hover:text-accent ${active ? "text-accent" : "text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RoleSwitch() {
  const { role, setRole } = useRole();
  return (
    <div className="flex rounded-[6px] border border-hairline bg-well p-0.5" role="radiogroup" aria-label="Acting as">
      {(["accountant", "cfo"] as HumanRole[]).map((r) => (
        <button key={r} role="radio" aria-checked={role === r} onClick={() => setRole(r)}
          className={`calm min-h-9 rounded-[4.5px] px-3 text-[12px] font-medium lg:min-h-7 lg:px-2.5 ${role === r ? "bg-accent text-white shadow-[0_1px_2px_rgb(85_0_4/0.25)]" : "text-secondary hover:text-ink"}`}>
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}
