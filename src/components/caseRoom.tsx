"use client";
// The case room: a live transcript of the agents' meeting on one held story. Nobody types here; people only
// answer the question card the meeting ends with.
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { ROLES, ROOM_SPEAKERS, type Role } from "../../convex/lib/transition";
import { AGENT_LABEL, Eyebrow, Pill } from "./ui";
import { useLive } from "./motion";

type Msg = Doc<"room_messages">;
const MAX_TURNS = 6;

const INITIALS: Record<string, string> = { engine: "EN", investigator: "IN", auditor: "AU", learner: "LE", manager: "MG", cfo: "CF", accountant: "AC", gateway: "GW" };
const isAgent = (r: string) => r === "investigator" || r === "auditor" || r === "learner";
const name = (r: string) => (r === "room" ? "the room" : AGENT_LABEL[r] ?? r);

function Avatar({ who, source }: { who: string; source: Msg["source"] }) {
  const tone = who === "manager" ? "bg-inset text-secondary" : isAgent(who) ? (source === "claude" ? "bg-accent-tint text-accent" : "bg-well text-faint ring-1 ring-inset ring-hairline") : "bg-inset text-secondary";
  return <div className={`num flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-medium ${tone}`} aria-hidden>{INITIALS[who] ?? "··"}</div>;
}

function SourcePill({ m }: { m: Msg }) {
  if (m.source === "claude") return <Pill tone="accent">Claude</Pill>;
  if (m.source === "code") return <Pill>Code</Pill>;
  return <Pill>Scripted</Pill>;
}

// Collapsed to one line; the findings above already say what each query showed.
function Tool({ t }: { t: Msg["tools"][number] }) {
  return (
    <details className="group mt-2 overflow-hidden rounded-[6px] border border-hairline bg-ground">
      <summary className="calm flex min-w-0 cursor-pointer list-none items-baseline gap-2 bg-well px-3 py-1.5 font-mono text-[11.5px] text-secondary hover:bg-hover">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-accent">ran</span>
        <span className="truncate" title={`${t.name}(${t.input})`}>{t.name}({t.input})</span>
        <span className="ml-auto shrink-0 text-faint">{t.rows.length} {t.rows.length === 1 ? "row" : "rows"} <span className="inline-block transition-transform group-open:rotate-90">›</span></span>
      </summary>
      {t.rows.length ? (
        <table className="w-full border-t border-hairline text-[12px]">
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className="border-t border-hairline first:border-0">
                <td className="px-3 py-1.5 text-body">{r[0]}</td>
                <td className="num px-3 py-1.5 text-right text-ink">{r.slice(1).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </details>
  );
}

function Message({ m, animate }: { m: Msg; animate: boolean }) {
  const cls = animate ? "arrive" : "";
  if (m.kind === "manager") {
    return (
      <div className={`flex items-start gap-3 rounded-[6px] px-1 py-2 ${cls}`}>
        <Avatar who="manager" source="code" />
        <div className="min-w-0 pt-1 text-[13px]">
          <span className="font-medium text-secondary">Meeting manager</span> <Pill>Code</Pill>
          <div className="mt-1 text-secondary">{m.text}</div>
        </div>
      </div>
    );
  }
  if (m.kind === "denied") {
    return (
      <div className={`ml-12 rounded-[6px] bg-danger-tint px-4 py-3 text-[13px] text-danger ${cls}`}>
        <div className="flex flex-wrap items-center gap-2 font-medium">Blocked by the gateway {m.staged ? <Pill tone="danger">Staged test</Pill> : null}</div>
        <div className="mt-1">{m.text}</div>
      </div>
    );
  }
  const working = m.status === "working";
  return (
    <div className={`flex items-start gap-3 py-3 ${cls}`}>
      <Avatar who={m.speaker} source={m.source} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="font-medium text-ink">{name(m.speaker)}</span>
          <SourcePill m={m} />
          {!working ? <span className="text-faint">→ {name(m.to)}</span> : <span className="flex items-center gap-1.5 text-hold-ink"><span className="breathe-dot h-1.5 w-1.5 rounded-full" />working</span>}
        </div>
        {m.think.length ? (
          <div className="panel mt-2 space-y-0.5 px-3 py-2 font-mono text-[12px] leading-relaxed text-secondary">
            {m.think.map((t, i) => <div key={i}>› {t}</div>)}
          </div>
        ) : null}
        {m.tools.map((t, i) => <Tool key={i} t={t} />)}
        {m.code ? <pre className="mt-2 overflow-x-auto rounded-[6px] bg-night px-3 py-2.5 text-[12px] leading-relaxed text-white/85">{m.code}</pre> : null}
        {m.text ? <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-body">{m.text}</p> : null}
        {m.question ? (
          <div className="mt-2 rounded-[6px] border border-hold-tint-strong bg-hold-tint/40 px-3 py-2 text-[13px]">
            <span className="eyebrow">Proposed question for the {m.question.askOf === "cfo" ? "CFO" : "Accountant"}</span>
            <div className="mt-1 text-ink">{m.question.text}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RoomTranscript({ story }: { story: Doc<"stories"> }) {
  const msgs = useQuery(api.queries.room, { key: story.key });
  const live = useLive();
  const room = story.room;
  const turns = room?.turns ?? 0;
  const state = room?.state ?? "meeting";
  return (
    <section className="card p-5 lg:p-6" aria-label="Case room">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Case room</Eyebrow>
        {room?.live ? <Pill tone="accent">Live agents</Pill> : <Pill>Scripted meeting</Pill>}
        <span className="ml-auto flex items-center gap-2">
          <span className="num text-[12px] text-faint">Turn {Math.min(turns, MAX_TURNS)} of {MAX_TURNS}</span>
          {state === "meeting" ? <Pill tone="accent"><span className="breathe-dot h-1.5 w-1.5 rounded-full" />In meeting</Pill> : state === "asked" ? <Pill tone="hold"><span aria-hidden className="text-hold">𝄐</span>Asked the {story.askOf === "cfo" ? "CFO" : "Accountant"}</Pill> : <Pill tone="success">Closed</Pill>}
        </span>
      </div>
      <div className="mt-3 divide-y divide-hairline/60">
        {!msgs ? <div className="py-6 text-[13px] text-faint">Opening the room…</div> : null}
        {msgs?.length === 0 ? <div className="py-6 text-[13px] text-faint">The room has not met yet.</div> : null}
        {msgs?.map((m) => <Message key={m._id} m={m} animate={live} />)}
      </div>
    </section>
  );
}

// What each participant may do, read from the roles table in code.
export function RoomPermissions() {
  const people: Role[] = ["manager", "accountant", "cfo", "gateway"];
  return (
    <section className="card p-5 lg:p-6" aria-label="Permissions">
      <Eyebrow>Who may do what</Eyebrow>
      <p className="mt-1 text-[12px] text-faint">From the roles table in code, checked on every call.</p>
      <dl className="mt-3 space-y-2.5 text-[12.5px]">
        {[...ROOM_SPEAKERS, ...people].map((r) => {
          const acts = Object.keys(ROLES[r].actions).map((a) => (a === "approve" && r === "engine" ? "approve under a rule" : a));
          return (
            <div key={r} className="grid grid-cols-[104px_1fr] gap-2">
              <dt className="font-medium text-ink">{ROLES[r].label}</dt>
              <dd className="text-secondary">{acts.join(" · ")}{ROOM_SPEAKERS.includes(r) ? <span className="text-faint"> · speaks in rooms</span> : null}{!Object.keys(ROLES[r].actions).includes("approve") && r !== "gateway" ? <span className="text-danger"> · never approves</span> : null}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
