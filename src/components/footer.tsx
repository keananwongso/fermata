import Link from "next/link";
import { FOOTER_LINKS, PUBLIC_SITE, TABS } from "./nav";

export function Footer() {
  return (
    <footer className="site-footer relative overflow-hidden bg-heading text-white">
      <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-6 select-none text-[240px] leading-none text-white/[0.06] lg:-bottom-24 lg:text-[360px]" style={{ fontFamily: "var(--font-music)" }}>𝄐</span>
      <div className="relative mx-auto grid max-w-page gap-10 px-4 py-12 lg:grid-cols-[1fr_auto] lg:px-10 lg:py-16">
        <div>
          <div className="display text-[28px] text-white">Fermata</div>
          <p className="mt-3 max-w-[340px] text-[13px] text-white/65">Every line settles on its own. Fermata only holds where it should.</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[13px] sm:grid-cols-3" aria-label="Footer">
          <div className="eyebrow col-span-full mb-1 text-white/45">Screens</div>
          {(PUBLIC_SITE ? FOOTER_LINKS : TABS).map((t) => <Link key={t.href} href={t.href} className="calm text-white/80 hover:text-white">{t.label}</Link>)}
        </nav>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-page flex-wrap justify-between gap-2 px-4 py-4 text-[12px] text-white/50 lg:px-10">
                    <span>A fermata is the music mark that means hold.</span>
        </div>
      </div>
    </footer>
  );
}
