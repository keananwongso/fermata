"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { MotionConfig } from "motion/react";
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
  if (!convex) return <div className="p-10 text-secondary">Set NEXT_PUBLIC_CONVEX_URL to connect to Convex.</div>;
  return (
    <ConvexProvider client={convex}>
      <RoleContext.Provider value={{ role, setRole }}><MotionConfig reducedMotion="user">{children}</MotionConfig></RoleContext.Provider>
    </ConvexProvider>
  );
}
