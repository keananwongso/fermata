"use client";
// Case rooms inside the dashboard window: every room the year opened, by month, and one room's transcript with the
// question it brought to a person and the answer the recording holds.
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, rpShort } from "../../../convex/lib/format";
import { ChatList } from "../caseRoom";
import { AGENT_LABEL, Pill } from "../ui";
import { MUSIC, R, askedOf, isOpen, openRooms, type Room } from "./data";
import { useDashboardNav } from "./nav";
import { RoomMark, RoomState, ViewHead } from "./parts";

const FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

export function CaseRooms({ room }: { room: string | null }) {
  const open = room ? R.rooms.find((r) => r.key === room) : undefined;
  return open ? <RoomView room={open} /> : <RoomList />;
}

function RoomList() {
  const go = useDashboardNav();
  const months = [...new Set(R.rooms.map((r) => r.month))].sort((a, b) => a - b);
  const closed = R.rooms.length - openRooms.length;
  return (
    <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-6">
      <ViewHead title="Case rooms"
        aside={<span className="num text-[12px] text-faint">{R.rooms.length} rooms · <span className="text-hold-ink">{openRooms.length} waiting</span> · {closed} closed</span>}>
        One room for each held story. The agents meet on it, then ask one person one question.
      </ViewHead>
      {months.map((m) => {
        const rooms = R.rooms.filter((r) => r.month === m);
        return (
          <section key={m} className="card overflow-hidden" aria-label={`${MONTH_LABELS[m - 1]} ${R.year}`}>
            <div className="flex items-center justify-between gap-3 border-b border-hairline bg-well px-4 py-2 lg:px-5">
              <h3 className="eyebrow">{MONTH_LABELS[m - 1]} {R.year}</h3>
              <span className="num text-[11px] text-faint">{rooms.length} {rooms.length === 1 ? "room" : "rooms"}</span>
            </div>
            <ul className="divide-y divide-hairline">
              {rooms.map((r) => (
                <li key={r.key}>
                  <button type="button" onClick={() => go({ view: "case-rooms", room: r.key })}
                    className={`calm flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover lg:px-5 ${FOCUS}`}>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] leading-snug text-ink sm:truncate">{r.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <RoomMark room={r} />
                        <span className="eyebrow">{r.live && r.narrated ? `Story ${r.narrated} · ` : ""}{num(r.count)} lines · {rpShort(r.amount)}</span>
                      </div>
                    </div>
                    <span className="shrink-0"><RoomState room={r} short /></span>
                    <span aria-hidden className="shrink-0 text-faint">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function RoomView({ room }: { room: Room }) {
  const go = useDashboardNav();
  return (
    <div>
      <div className="z-10 flex items-center justify-between gap-3 border-b border-hairline bg-canvas px-3 py-1.5 sm:px-4 lg:sticky lg:top-0 lg:px-6">
        <button type="button" onClick={() => go({ view: "case-rooms", room: null })}
          className="calm -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-[4.5px] px-2 text-[13px] font-medium text-link hover:bg-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-accent lg:min-h-8">
          <span aria-hidden>‹</span>All case rooms
        </button>
        <RoomState room={room} />
      </div>
      <div className="space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="px-1">
          <div className="flex flex-wrap items-center gap-2">
            <RoomMark room={room} />
            <span className="eyebrow">{room.narrated ? `Story ${room.narrated} · ` : ""}{MONTH_LABELS[room.month - 1]} {R.year} · {num(room.count)} lines · {rpShort(room.amount)}</span>
          </div>
          <h2 className="title mt-1.5 text-[20px] leading-tight lg:text-[24px]">{room.title}</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 pb-2" aria-label="Meeting transcript" role="region">
            <ChatList msgs={room.messages} animate={false} />
          </div>
          {room.question ? <QuestionCard room={room} /> : null}
        </div>
      </div>
    </div>
  );
}

// The one question the room brought to a person, its options, and the answer the recording holds. Options the
// recording did not take are greyed out.
function QuestionCard({ room }: { room: Room }) {
  const q = room.question!;
  const who = AGENT_LABEL[askedOf(room) ?? q.askOf];
  const open = isOpen(room);
  return (
    <section className="card min-w-0 self-start overflow-hidden xl:sticky xl:top-16">
      <div className={`flex items-center justify-between gap-2 border-b px-4 py-2.5 ${open ? "border-hold-tint-strong bg-hold-tint/50" : "border-hairline bg-well"}`}>
        <h3 className="title flex items-center gap-2 text-[15px]">{open ? <span className="text-hold" style={MUSIC} aria-hidden>𝄐</span> : null}Question for the {who}</h3>
        {open ? null : <Pill tone="success"><span aria-hidden>✓</span>Answered</Pill>}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[13.5px] leading-snug text-ink">{q.text}</p>
        <ul className="space-y-1.5">
          {q.options.map((o) => {
            const taken = q.answer === o.id;
            return (
              <li key={o.id} className={`rounded-[8px] border px-3 py-2 ${taken ? "border-success/30 bg-success-tint" : "border-hairline bg-well"} ${q.answer && !taken ? "opacity-50" : ""}`}>
                {taken ? <div className="eyebrow text-success">Recorded answer</div> : null}
                <div className="text-[12.5px] font-medium leading-snug text-ink">{o.label}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-secondary">{o.impact}</div>
              </li>
            );
          })}
        </ul>
        {room.resolution ? <p className="text-[12px] leading-snug text-secondary"><span className="font-medium text-ink">What it settled:</span> {room.resolution}</p> : null}
        {open ? <p className="text-[12px] leading-snug text-hold-ink">Still waiting on the {who} when the year closed.</p> : null}
      </div>
    </section>
  );
}
