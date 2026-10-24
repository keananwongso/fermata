"use client";
// Small pieces the dashboard's views share: the head of a view, and how a case room's state and source read.
import type { ReactNode } from "react";
import { AGENT_LABEL, Pill } from "../ui";
import { MUSIC, R, askedOf, isOpen, type Room } from "./data";

export function ViewHead({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1 pb-1">
      <div className="min-w-0">
        <div className="eyebrow">Books for {R.year}</div>
        <h2 className="title mt-1 text-[24px] lg:text-[28px]">{title}</h2>
        {children ? <p className="mt-1.5 max-w-[620px] text-[13px] leading-snug text-secondary">{children}</p> : null}
      </div>
      {aside}
    </div>
  );
}

// A room is asked (waiting on a person, amber) until the recording holds its answer, then closed.
export function RoomState({ room, short = false }: { room: Room; short?: boolean }) {
  if (isOpen(room)) {
    const who = AGENT_LABEL[askedOf(room) ?? "accountant"];
    return <Pill tone="hold"><span aria-hidden className="text-hold" style={MUSIC}>𝄐</span>Asked<span className={short ? "sr-only sm:not-sr-only" : ""}>{" "}the {who}</span></Pill>;
  }
  return <Pill>Closed</Pill>;
}

// The two stories Claude worked live are marked Claude (a neutral pill, like Code); the other narrated stories carry their letter.
export function RoomMark({ room }: { room: Room }) {
  if (room.live) return <Pill>Claude</Pill>;
  if (room.narrated) return <Pill>Story {room.narrated}</Pill>;
  return null;
}
