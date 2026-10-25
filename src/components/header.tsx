"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole, type HumanRole } from "./providers";
import { REPO_URL, SITE_LINKS, TABS } from "./nav";
import { LinkButton } from "./ui";

export const ROLE_LABEL: Record<HumanRole, string> = { accountant: "Accountant", cfo: "CFO" };
const isActive = (path: string, href: string) => (href === "/" ? path === "/" : !href.includes("#") && path.startsWith(href));

export function Header() {
  const path = usePathname();
  // The landing page, the public demo and the dashboard get the site navigation; the console gets its tabs and role switch.
  const site = path === "/" || ["/how", "/demo", "/dashboard", "/ask", "/pitch"].some((p) => path.startsWith(p));
  const links = site ? SITE_LINKS : TABS;
  // The live demo is the call to action everywhere but the demo itself, where running it is the action.
  const cta = site && !path.startsWith("/demo");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <div aria-hidden onClick={() => setOpen(false)}
        className={`fixed inset-0 z-20 bg-ink/25 transition-opacity duration-350 ease-out lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      {/* The header floats over the page. Only its card takes the pointer, so controls beside it stay clickable. */}
      <div className="pointer-events-none sticky top-0 z-30">
      <header className="mt-3 px-4 lg:px-6">
        {/* On the site the card hugs its contents, centred; the console's tabs and role switch keep the page width. */}
        <div className={`pointer-events-auto mx-auto max-w-[calc(var(--container-page)-60px)] rounded-[8px] border border-hairline bg-ground shadow-[0_1px_2px_rgb(85_40_20/0.05),0_10px_30px_-18px_rgb(85_40_20/0.18)] ${site ? "lg:w-fit" : ""}`}>
          <div className={`flex h-14 items-center pl-4 pr-2 ${site ? "gap-3 lg:pr-2.5" : "gap-6 lg:pr-3"}`}>
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2" aria-label="Fermata, home">
              <span className="text-[20px] leading-none text-hold" aria-hidden>𝄐</span>
              <span className="display text-[19px] tracking-[-0.03em]">Fermata</span>
            </Link>
            <Tabs path={path} links={links} site={site} />
            <div className={`ml-auto hidden items-center lg:flex ${site ? "gap-2" : "gap-3"}`}>
              {site ? <>
                <GitHub />
                {cta ? <LinkButton href="/demo">Watch the live demo</LinkButton> : null}
              </> : <>
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
                {site ? <>
                  <a href={REPO_URL} className="calm flex min-h-11 items-center gap-2.5 rounded-[6px] px-3 text-[15px] text-ink hover:bg-hover hover:text-accent"><GitHubMark />Source on GitHub</a>
                  {cta ? <div className="px-3 pt-3"><LinkButton href="/demo">Watch the live demo</LinkButton></div> : null}
                </> : <div className="flex items-center justify-between px-3 pt-3 text-[12px] text-faint">Acting as <RoleSwitch /></div>}
              </nav>
            </div>
          </div>
        </div>
      </header>
      </div>
    </>
  );
}

// Labels turn blue on hover, and the current page stays blue.
function Tabs({ path, links, site }: { path: string; links: { href: string; label: string }[]; site: boolean }) {
  return (
    <nav className="hidden h-9 items-stretch lg:flex">
      {links.map((t) => {
        const active = isActive(path, t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`flex items-center text-[14px] ${site ? "px-3.5" : "px-4"} transition-colors duration-400 ease-brand hover:text-accent ${active ? "text-accent" : "text-ink"}`}>
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

// The repo as an icon, named by a tooltip on hover and focus.
function GitHub() {
  return (
    <a href={REPO_URL} aria-label="Source on GitHub"
      className="has-tip calm flex h-9 w-9 items-center justify-center rounded-[6px] text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <GitHubMark />
      <span className="tip" data-arrow="up" aria-hidden>Source on GitHub</span>
    </a>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
