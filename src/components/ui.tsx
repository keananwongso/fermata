"use client";
import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { motion } from "motion/react";

export type Tone = "neutral" | "accent" | "hold" | "success" | "danger" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-well text-secondary ring-1 ring-inset ring-hairline",
  accent: "bg-accent-tint text-accent",
  hold: "bg-hold-tint text-hold-ink",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${TONE[tone]}`}>{children}</span>;
}

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={`card ${pad ? "p-5 lg:p-6" : ""} ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Tag({ tone = "accent", children }: { tone?: "accent" | "neutral"; children: ReactNode }) {
  return <span className="tag" data-tone={tone}>{children}</span>;
}

export function PageHead({ tag, title, children, actions }: { tag?: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {tag ? <Tag tone="neutral">{tag}</Tag> : null}
        <h1 className="display mt-4 text-[clamp(34px,4.6vw,52px)]">{title}</h1>
        {children ? <p className="mt-3 max-w-[640px] text-[14px] text-secondary">{children}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Button({ variant = "secondary", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "hold" }) {
  const base = "calm inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[4.5px] text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-9";
  if (variant === "primary") {
    return <button {...rest} className={`btn-brand ${base} ${className}`}><span className="btn-face"><span className="btn-label">{children}</span></span></button>;
  }
  const v = {
    secondary: "border border-hairline bg-ground text-ink shadow-[0_1px_1px_rgb(85_40_20/0.04)] hover:border-strong hover:bg-warm",
    ghost: "text-secondary hover:bg-hover hover:text-ink",
    hold: "bg-hold-tint text-hold-ink hover:bg-hold-tint-strong",
  }[variant];
  return <button {...rest} className={`${base} px-3.5 ${v} ${className}`}>{children}</button>;
}

// The brand button as a link, for calls to action that navigate.
export function LinkButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`btn-brand calm inline-flex min-h-11 items-center justify-center rounded-[4.5px] text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-9 ${className}`}>
      <span className="btn-face"><span className="btn-label">{children}</span></span>
    </Link>
  );
}

export function LinkArrow({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const cls = "arrow-link calm inline-flex items-center gap-1.5 text-[13px] font-medium text-link hover:text-accent";
  const arrow = <path d="M1 5h10.5M8 1.5 11.5 5 8 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
  const inner = (
    <>
      {children}
      <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden style={{ overflow: "hidden" }}>
        <g className="arrow-track">{arrow}<g transform="translate(-13 0)">{arrow}</g></g>
      </svg>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-10 text-[13px] text-faint" role="status">
      <span className="breathe text-[20px] leading-none" style={{ fontFamily: "var(--font-music)" }} aria-hidden>𝄐</span>{children}
    </div>
  );
}

export function Metric({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const color = tone === "hold" ? "text-hold" : tone === "success" ? "text-success" : "text-heading";
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <div className={`figure mt-2 text-[28px] lg:text-[34px] ${color}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-[12px] text-faint">{sub}</div> : null}
    </div>
  );
}

const STATE_WORDS: Record<string, [string, Tone]> = {
  NEW: ["New", "neutral"], PROPOSED: ["Proposed", "accent"], APPROVED: ["Approved", "info"], POSTED: ["Settled", "success"],
  NEEDS_INFO: ["Needs an answer", "hold"], HELD: ["Held", "hold"], WAITING: ["Waiting", "neutral"],
};
// `quiet` keeps only amber (held, needs an answer): everywhere else the state is a neutral pill (the dashboard window).
export function StateBadge({ state, label, quiet = false }: { state: string; label?: string; quiet?: boolean }) {
  const [w, t] = STATE_WORDS[state] ?? [state, "neutral"];
  return <Pill tone={quiet && t !== "hold" ? "neutral" : t}>{state === "HELD" || state === "NEEDS_INFO" ? <span aria-hidden className="text-hold">𝄐</span> : null}{label ?? w}</Pill>;
}

export const AGENT_LABEL: Record<string, string> = {
  investigator: "Investigator", learner: "Learner", auditor: "Auditor", accountant: "Accountant", cfo: "CFO", engine: "Engine", gateway: "Gateway", sync: "Sync", manager: "Meeting manager", assistant: "Assistant",
};

export interface TraceLine { _id: string; kind: string; text: string; real: boolean; staged?: boolean }
export function Trace({ lines, empty = "Nothing yet." }: { lines: TraceLine[]; empty?: string }) {
  return (
    <div className="panel space-y-1 p-4 font-mono text-[12px] leading-relaxed">
      {lines.length === 0 ? <div className="text-faint">{empty}</div> : null}
      {lines.map((l) => (
        <div key={l._id} className="flex gap-3">
          <span className={`w-16 shrink-0 ${l.kind === "denied" ? "text-danger" : l.kind === "decision" ? "text-accent" : "text-faint"}`}>{l.kind}</span>
          <span className={`min-w-0 flex-1 break-words ${l.kind === "denied" ? "text-danger" : "text-ink"}`}>{l.text}</span>
          <span className="hidden shrink-0 text-[11px] text-faint sm:inline">{l.staged ? "staged" : l.real ? "real" : "scripted"}</span>
        </div>
      ))}
    </div>
  );
}

export function Bar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "hold" | "success" | "neutral" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const c = { accent: "bg-accent", hold: "bg-hold", success: "bg-success", neutral: "bg-mute" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-inset">
      <motion.div className={`h-full rounded-full ${c}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.645, 0.045, 0.355, 1] }} />
    </div>
  );
}
