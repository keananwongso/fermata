"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPO_URL } from "./nav";
import { AskOverlay } from "./ask/overlay";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export type HumanRole = "accountant" | "cfo";
const RoleContext = createContext<{ role: HumanRole; setRole: (r: HumanRole) => void }>({ role: "cfo", setRole: () => {} });
export const useRole = () => useContext(RoleContext);

const listeners = new Set<() => void>();
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function readRole(): HumanRole { const s = window.localStorage.getItem("fermata.role"); return s === "accountant" ? "accountant" : "cfo"; }

export function Providers({ children }: { children: ReactNode }) {
  const role = useSyncExternalStore(subscribe, readRole, () => "cfo" as HumanRole);
  const setRole = (r: HumanRole) => { window.localStorage.setItem("fermata.role", r); listeners.forEach((l) => l()); };
  const path = usePathname();
  // The site pages work without Convex. Ask the books plays recorded answers without it, and live ones with it.
  // What if runs the engine offline on this machine, so it needs no Convex either.
  const consolePage = !["/", "/demo", "/pitch", "/dashboard", "/ask", "/whatif"].includes(path);
  const page = !convex && consolePage ? <ConsoleIsLocal /> : children;
  // Ask the books on every site page: hold Control + Option, or the floating button on a phone. Not the console,
  // and not the pitch, whose keys step the deck. Keyed by page, so moving on closes it and stops its voice.
  const ask = ["/", "/demo", "/dashboard", "/ask"].includes(path) ? <AskOverlay key={path} fab={path !== "/ask"} /> : null;
  const inner = <RoleContext.Provider value={{ role, setRole }}><MotionConfig reducedMotion="user">{page}{ask}</MotionConfig></RoleContext.Provider>;
  // The hosted site has no Convex URL at all: the landing page and demo replay a recording, and the console
  // pages redirect to the demo (next.config.ts), so nothing on it can reach the deployment.
  return convex ? <ConvexProvider client={convex}>{inner}</ConvexProvider> : inner;
}

// Shown instead of a console page when there is no Convex deployment to talk to (the hosted site).
function ConsoleIsLocal() {
  return (
    <div className="mx-auto max-w-[560px] py-16 text-center">
      <div className="text-[34px] text-hold" style={{ fontFamily: "var(--font-music)" }} aria-hidden>𝄐</div>
      <h1 className="title mt-3 text-[26px]">The console runs on your own machine</h1>
      <p className="mt-3 text-[14px] text-secondary">It makes real Claude calls and writes to the books, so it isn&apos;t hosted here. Watch the recorded run instead, or clone the repo and run it with your own keys.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-5 text-[13px]">
        <Link href="/demo" className="text-link hover:text-accent">Watch the live demo →</Link>
        <Link href={REPO_URL} className="text-link hover:text-accent">Run it yourself →</Link>
      </div>
    </div>
  );
}
