"use client";
// A case room, for the landing page's How it works: story B's real meeting (a lender nobody knew), replayed one message
// at a time once it is on screen, then the one question it brought to the CFO and what the answer settled. The same
// story the guided demo and How it learns tell. Messages keep their Claude, code or staged labels.
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, rpShort } from "../../convex/lib/format";
import { ChatList } from "./caseRoom";
import { R } from "./dashboard/data";
import { QuestionCard } from "./dashboard/rooms";
import { Pill } from "./ui";
import { scrollBoxToEnd } from "./motion";

const ROOM = R.rooms.find((r) => r.narrated === "B") ?? R.rooms.find((r) => r.live) ?? null;
const STEP_MS = 1300;

export function HowRoom() {
  const root = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const seen = useInView(root, { amount: 0.3, once: true });
  const [shown, setShown] = useState(0);
  const total = ROOM?.messages.length ?? 0;
  useEffect(() => {
    if (!seen || shown >= total) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 400 : STEP_MS);
    return () => clearTimeout(t);
  }, [seen, shown, total]);
  useEffect(() => { scrollBoxToEnd(log.current); }, [shown]);
  if (!ROOM) return null;
  const done = shown >= total;

  return (
    <div ref={root} className="frame">
      <div className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-5 py-4 lg:px-6">
          <Pill tone="accent">Claude</Pill>
          <span className="eyebrow">{MONTH_LABELS[ROOM.month - 1]} {R.year} · {num(ROOM.count)} lines · {rpShort(ROOM.amount)}</span>
          <h4 className="title w-full text-[20px] leading-tight lg:text-[22px]">{ROOM.title}</h4>
        </header>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-5">
          <div ref={log} className="scroll-quiet h-[460px] overflow-y-auto rounded-[8px] bg-canvas px-3 pb-3 lg:px-4" role="log" aria-live="polite">
            <ChatList msgs={ROOM.messages.slice(0, shown)} animate />
          </div>
          <div className="min-w-0">
            {done && ROOM.question ? <div className="enter"><QuestionCard room={ROOM} /></div> : (
              <div className="hatch grid h-full min-h-[200px] place-items-center rounded-[8px] border border-hairline px-6 text-center text-[13px] text-faint">
                {seen ? "The agents are meeting…" : "One question comes out of the meeting."}
              </div>
            )}
            {done ? <button onClick={() => setShown(0)} className="calm mt-3 text-[12.5px] text-link hover:text-accent">Replay the meeting</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
