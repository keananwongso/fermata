"use client";
// The case room as a group chat: the agents' meeting on one held story. Nobody types here; the only thing a
// person does is answer the question card that sits where a chat's input box would be.
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { ROLES, type Role } from "../../convex/lib/transition";
import { AGENT_LABEL, Pill } from "./ui";
import { useLive } from "./motion";

type Msg = Doc<"room_messages">;
export const MAX_TURNS = 6;

const INITIALS: Record<string, string> = { engine: "EN", investigator: "IN", auditor: "AU", learner: "LE", manager: "MG", cfo: "CF", accountant: "AC", gateway: "GW" };
// One colour per participant, all from the palette: agents in blue tones, code in neutrals.
export const AVATAR: Record<string, string> = {
  investigator: "bg-accent text-white",
  auditor: "bg-heading text-white",
  learner: "bg-info text-white",
  engine: "bg-inset text-secondary",
  gateway: "bg-night text-white",
  manager: "bg-inset text-secondary",
  cfo: "bg-hold-tint text-hold-ink",
  accountant: "bg-hold-tint text-hold-ink",
};
const MENTION: Record<string, string> = {
  investigator: "bg-accent-tint text-accent", auditor: "bg-inset text-heading", learner: "bg-info-tint text-info",
  cfo: "bg-hold-tint text-hold-ink", accountant: "bg-hold-tint text-hold-ink", room: "bg-inset text-secondary", engine: "bg-inset text-secondary",
};
const name = (r: string) => (r === "room" ? "everyone" : AGENT_LABEL[r] ?? r);

export function Avatar({ who, size = 32 }: { who: string; size?: number }) {
  return (
    <div className={`num flex shrink-0 items-center justify-center rounded-full text-[10.5px] font-medium ${AVATAR[who] ?? "bg-inset text-secondary"}`} style={{ width: size, height: size }} aria-hidden>
      {INITIALS[who] ?? "··"}
    </div>
  );
}

// "Auditor, try to break this" -> the addressee's name becomes a mention chip. If the text never names them,
// the mention is added in front.
function WithMention({ text, to }: { text: string; to: string }) {
  const label = name(to);
  const chip = <span className={`rounded-[4px] px-1 py-px font-medium ${MENTION[to] ?? "bg-inset"}`}>@{label}</span>;
  const i = to === "room" ? -1 : text.indexOf(label);
  if (i < 0) return <>{to === "room" ? null : <>{chip} </>}{text}</>;
  return <>{text.slice(0, i)}{chip}{text.slice(i + label.length)}</>;
}

function Details({ m }: { m: Msg }) {
  if (!m.think.length && !m.tools.length) return null;
  const parts = [m.think.length ? `${m.think.length} ${m.think.length === 1 ? "finding" : "findings"}` : "", m.tools.length ? `${m.tools.length} ${m.tools.length === 1 ? "query" : "queries"}` : ""].filter(Boolean);
  return (
    <details className="group mt-2">
      <summary className="calm inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-hairline bg-well px-2.5 py-0.5 text-[11.5px] text-secondary hover:bg-hover">
        <span className="inline-block text-faint transition-transform group-open:rotate-90">›</span>{parts.join(" · ")}
      </summary>
      <div className="mt-2 space-y-2">
        {m.think.length ? (
          <ul className="space-y-0.5 font-mono text-[11.5px] leading-relaxed text-secondary">
            {m.think.map((t, i) => <li key={i}>› {t}</li>)}
          </ul>
        ) : null}
        {m.tools.map((t, i) => (
          <div key={i} className="overflow-hidden rounded-[6px] border border-hairline">
            <div className="truncate bg-well px-2.5 py-1 font-mono text-[11px] text-secondary" title={`${t.name}(${t.input})`}><span className="text-accent">ran</span> {t.name}({t.input})</div>
            {t.rows.length ? (
              <table className="w-full text-[11.5px]">
                <tbody>
                  {t.rows.map((r, j) => (
                    <tr key={j} className="border-t border-hairline">
                      <td className="px-2.5 py-1 text-body">{r[0]}</td>
                      <td className="num px-2.5 py-1 text-right text-ink">{r.slice(1).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function SystemLine({ m, animate }: { m: Msg; animate: boolean }) {
  if (m.kind === "denied") {
    return (
      <div className={`mx-auto my-1 flex max-w-[92%] items-start gap-2 rounded-[8px] border border-danger/20 bg-danger-tint px-3 py-2 text-[12.5px] text-danger ${animate ? "arrive" : ""}`} role="note">
        <span className="font-medium">Blocked by the gateway{m.staged ? " (staged test)" : ""}.</span>
        <span className="min-w-0">{m.text.replace(/^Tried to approve this story itself\. /, "The Investigator tried to approve its own story. ")}</span>
      </div>
    );
  }
  return (
    <div className={`my-1 flex justify-center ${animate ? "arrive" : ""}`}>
      <span className="max-w-[92%] rounded-full bg-inset px-3 py-1 text-center text-[11.5px] leading-snug text-secondary">
        <span className="font-medium text-ink">Meeting manager</span> · {m.text}
      </span>
    </div>
  );
}

function Bubble({ m, grouped, animate }: { m: Msg; grouped: boolean; animate: boolean }) {
  const working = m.status === "working";
  return (
    <div className={`flex gap-2.5 ${grouped ? "mt-1" : "mt-3"} ${animate ? "arrive" : ""}`}>
      <div className="w-8 shrink-0">{grouped ? null : <Avatar who={m.speaker} />}</div>
      <div className="min-w-0 max-w-[88%]">
        {grouped ? null : (
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[12px]">
            <span className="font-medium text-ink">{name(m.speaker)}</span>
            <span className="text-faint">{m.source === "claude" ? "Claude" : m.source === "code" ? "code" : "scripted"}</span>
          </div>
        )}
        <div className="rounded-[14px] rounded-tl-[4px] border border-hairline bg-ground px-3.5 py-2.5 shadow-[0_1px_1px_rgb(85_40_20/0.03)]">
          {working ? (
            <div className="flex items-center gap-2 text-[13px] text-secondary">
              <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="breathe-dot h-1.5 w-1.5 rounded-full" style={{ animationDelay: `${i * 160}ms` }} />)}</span>
              {m.tools.length ? <>running <span className="font-mono text-[12px] text-ink">{m.tools[m.tools.length - 1].name}</span></> : "thinking"}
            </div>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed text-body"><WithMention text={m.text} to={m.to} /></p>
              {m.code ? <pre className="mt-2 overflow-x-auto rounded-[8px] bg-night px-3 py-2 text-[11.5px] leading-relaxed text-white/85">{m.code}</pre> : null}
              {m.question ? (
                <div className="mt-2 rounded-[8px] border border-hold-tint-strong bg-hold-tint/50 px-3 py-2 text-[13px]">
                  <span className="eyebrow">Proposed question · {m.question.askOf === "cfo" ? "CFO" : "Accountant"}</span>
                  <div className="mt-0.5 text-ink">{m.question.text}</div>
                </div>
              ) : null}
            </>
          )}
          {!working ? <Details m={m} /> : null}
        </div>
      </div>
    </div>
  );
}

export function RoomChat({ story }: { story: Doc<"stories"> }) {
  const msgs = useQuery(api.queries.room, { key: story.key });
  const live = useLive();
  const end = useRef<HTMLDivElement>(null);
  const count = msgs?.length ?? 0;
  const lastStatus = msgs?.[count - 1]?.status;
  useEffect(() => { if (live) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [count, lastStatus, live]);
  return (
    <div className="px-4 pb-4 pt-2 lg:px-5" role="log" aria-label="Meeting transcript" aria-live="polite">
      {!msgs ? <div className="py-6 text-[13px] text-faint">Opening the room…</div> : null}
      {msgs?.length === 0 ? <div className="py-6 text-[13px] text-faint">The room has not met yet.</div> : null}
      {msgs?.map((m, i) => {
        if (m.kind !== "message") return <SystemLine key={m._id} m={m} animate={live} />;
        const prev = msgs[i - 1];
        const grouped = !!prev && prev.kind === "message" && prev.speaker === m.speaker;
        return <Bubble key={m._id} m={m} grouped={grouped} animate={live} />;
      })}
      <div ref={end} />
    </div>
  );
}

// Who is in the room and what each may do, read from the roles table in code.
export function Participants({ msgs }: { msgs?: Msg[] }) {
  const inRoom: Role[] = ["engine", "investigator", "auditor", "learner", "manager"];
  const outside: Role[] = ["accountant", "cfo", "gateway"];
  const speaking = [...(msgs ?? [])].reverse().find((m) => m.status === "working")?.speaker;
  const row = (r: Role) => {
    const acts = Object.keys(ROLES[r].actions).map((a) => (a === "approve" && r === "engine" ? "approve under a rule" : a));
    const approves = Object.keys(ROLES[r].actions).includes("approve");
    return (
      <li key={r} className="flex gap-2.5">
        <Avatar who={r} size={26} />
        <div className="min-w-0 text-[12px] leading-snug">
          <div className="flex items-center gap-1.5"><span className="font-medium text-ink">{ROLES[r].label}</span>{speaking === r ? <span className="breathe-dot h-1.5 w-1.5 rounded-full" aria-label="working" /> : null}</div>
          <div className="text-faint">{acts.join(" · ")}{!approves && r !== "gateway" ? <span className="text-danger"> · never approves</span> : null}</div>
        </div>
      </li>
    );
  };
  return (
    <div>
      <div className="eyebrow">In the room</div>
      <ul className="mt-2 space-y-2.5">{inRoom.map(row)}</ul>
      <div className="eyebrow mt-4">Outside the room</div>
      <ul className="mt-2 space-y-2.5">{outside.map(row)}</ul>
      <p className="mt-3 text-[11px] text-faint">From the roles table in code, checked on every call.</p>
    </div>
  );
}

export function RoomStatus({ story }: { story: Doc<"stories"> }) {
  const room = story.room;
  const state = room?.state ?? "meeting";
  return (
    <span className="flex items-center gap-2">
      <span className="num text-[11.5px] text-faint">turn {Math.min(room?.turns ?? 0, MAX_TURNS)}/{MAX_TURNS}</span>
      {state === "meeting" ? <Pill tone="accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full" />In meeting</Pill> : state === "asked" ? <Pill tone="hold"><span aria-hidden className="text-hold">𝄐</span>Asked the {story.askOf === "cfo" ? "CFO" : "Accountant"}</Pill> : <Pill tone="success">Closed</Pill>}
    </span>
  );
}
