"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole, type HumanRole } from "./providers";

const TABS = [
  { href: "/", label: "Run" },
  { href: "/stories", label: "Stories" },
  { href: "/rules", label: "Rules" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/record", label: "Record" },
];
export const ROLE_LABEL: Record<HumanRole, string> = { accountant: "Accountant", cfo: "CFO" };

export function Header() {
  const path = usePathname();
  const { role, setRole } = useRole();
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-8 px-10">
        <Link href="/" className="flex items-baseline gap-1.5 text-[17px] font-semibold tight">
          Fermata <span className="text-hold" aria-hidden>𝄐</span>
        </Link>
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={`calm rounded-[12px] px-3 py-1.5 text-[13px] font-medium ${active ? "bg-well text-ink" : "text-secondary hover:bg-hover hover:text-ink"}`}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-faint">
          <span>Signed in as {ROLE_LABEL[role]} · fictional company · synthetic data</span>
          <div className="flex rounded-full border border-hairline p-0.5" role="radiogroup" aria-label="Acting as">
            {(["accountant", "cfo"] as HumanRole[]).map((r) => (
              <button key={r} role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                className={`calm rounded-full px-2.5 py-0.5 text-[12px] font-medium ${role === r ? "bg-ink text-white" : "text-secondary hover:text-ink"}`}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
