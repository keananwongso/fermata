"use client";
import type { ReactNode, ButtonHTMLAttributes } from "react";

export type Tone = "neutral" | "accent" | "hold" | "success" | "danger" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-well text-secondary",
  accent: "bg-accent-tint text-accent",
  hold: "bg-hold-tint text-hold",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${TONE[tone]}`}>{children}</span>;
}

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={`card ${pad ? "p-6" : ""} ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Button({ variant = "secondary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "hold" }) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "border border-hairline bg-ground text-ink hover:bg-hover",
    ghost: "text-secondary hover:bg-hover hover:text-ink",
    hold: "bg-hold-tint text-hold hover:bg-[#f5e4bb]",
  }[variant];
  return <button {...rest} className={`calm inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3.5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${v} ${className}`} />;
}

export function Metric({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const color = tone === "hold" ? "text-hold" : tone === "success" ? "text-success" : "text-ink";
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className={`num mt-1 text-[30px] leading-tight font-medium tight ${color}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[12px] text-faint">{sub}</div> : null}
    </div>
  );
}

const STATE_WORDS: Record<string, [string, Tone]> = {
  NEW: ["New", "neutral"], PROPOSED: ["Proposed", "accent"], APPROVED: ["Approved", "info"], POSTED: ["Settled", "success"],
  NEEDS_INFO: ["Needs an answer", "hold"], HELD: ["Held", "hold"], WAITING: ["Waiting", "neutral"],
};
export function StateBadge({ state, label }: { state: string; label?: string }) {
  const [w, t] = STATE_WORDS[state] ?? [state, "neutral"];
  return <Pill tone={t}>{state === "HELD" || state === "NEEDS_INFO" ? <span aria-hidden>𝄐</span> : null}{label ?? w}</Pill>;
}

export const AGENT_LABEL: Record<string, string> = {
  investigator: "Investigator", learner: "Learner", auditor: "Auditor", accountant: "Accountant", cfo: "CFO", engine: "Engine", gateway: "Gateway", sync: "Sync",
};

export interface TraceLine { _id: string; kind: string; text: string; real: boolean; staged?: boolean }
export function Trace({ lines, empty = "Nothing yet." }: { lines: TraceLine[]; empty?: string }) {
  return (
    <div className="rounded-[16px] bg-well p-4 font-mono text-[12px] leading-relaxed">
      {lines.length === 0 ? <div className="text-faint">{empty}</div> : null}
      {lines.map((l) => (
        <div key={l._id} className="flex gap-3">
          <span className={`w-16 shrink-0 ${l.kind === "denied" ? "text-danger" : l.kind === "decision" ? "text-accent" : "text-faint"}`}>{l.kind}</span>
          <span className={`flex-1 ${l.kind === "denied" ? "text-danger" : "text-ink"}`}>{l.text}</span>
          <span className="shrink-0 text-[11px] text-faint">{l.staged ? "staged" : l.real ? "real" : "scripted"}</span>
        </div>
      ))}
    </div>
  );
}

export function Bar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "hold" | "success" | "neutral" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const c = { accent: "bg-accent", hold: "bg-hold", success: "bg-success", neutral: "bg-strong" }[tone];
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-well"><div className={`bar h-full rounded-full ${c}`} style={{ width: `${pct}%` }} /></div>;
}
