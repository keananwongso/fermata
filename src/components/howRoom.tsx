"use client";
// A case room, for the landing page's How it works: story B's real meeting (a lender nobody knew), played on its own
// so nobody has to touch it. Messages arrive one at a time and the transcript follows them down; when the meeting
// closes, its one question goes to the CFO, the recorded answer is picked, the rest of the room plays out (the rule
// drafted and approved), and after a pause it starts again. It runs only while on screen. The same story the guided
// demo and How it learns tell; messages keep their Claude, code or staged labels.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, rpShort } from "../../convex/lib/format";
import { Avatar, ChatList } from "./caseRoom";
import { R } from "./dashboard/data";
import { Pill } from "./ui";
import { scrollBoxToEnd } from "./motion";

const ROOM = R.rooms.find((r) => r.narrated === "B") ?? R.rooms.find((r) => r.live) ?? null;
// The meeting runs up to the manager's "Meeting closed"; what follows the answer (the rule drafted, approved) comes after.
const CLOSE = ROOM ? ROOM.messages.findIndex((m) => m.kind === "manager" && m.text.startsWith("Meeting closed")) : -1;
const MEETING = ROOM ? ROOM.messages.slice(0, CLOSE + 1) : [];
const AFTER = ROOM ? ROOM.messages.slice(CLOSE + 1) : [];
const MSG_MS = 1500; // between messages
const ASK_MS = 1800; // the question sits waiting before it is answered
const REST_MS = 6000; // the finished room holds before it starts again
const EASE = [0.22, 1, 0.36, 1] as const;

// The whole play as one counter: 0..MEETING are the meeting's messages, then the question waits, then it is answered,
// then the messages after the answer, then the rest before the loop.
const ASKING = MEETING.length + 1;
const ANSWERED = ASKING + 1;
const END = ANSWERED + AFTER.length;

export function HowRoom() {
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const seen = useInView(root, { amount: 0.3 });
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const wait = t === 0 ? 500 : t === ASKING ? ASK_MS : t >= END ? REST_MS : MSG_MS;
    const id = setTimeout(() => setT((x) => (x >= END ? 0 : x + 1)), wait);
    return () => clearTimeout(id);
  }, [seen, t]);
  // Follow the newest message inside the transcript, never moving the page.
  useEffect(() => { requestAnimationFrame(() => scrollBoxToEnd(end.current)); }, [t]);
  if (!ROOM || !ROOM.question) return null;

  const q = ROOM.question;
  const msgs = [...MEETING.slice(0, Math.min(t, MEETING.length)), ...(t > ANSWERED ? AFTER.slice(0, t - ANSWERED) : [])];
  const asked = t >= ASKING, answered = t >= ANSWERED, settled = t >= END;

  return (
    <div ref={root} className="frame">
      <div className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-5 py-4 lg:px-6">
          <Pill tone="accent">Claude</Pill>
          <span className="eyebrow">{MONTH_LABELS[ROOM.month - 1]} {R.year} · {num(ROOM.count)} lines · {rpShort(ROOM.amount)}</span>
          <h4 className="title w-full text-[20px] leading-tight lg:text-[22px]">{ROOM.title}</h4>
        </header>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-5">
          {/* Plays on its own; data-lenis-prevent keeps the page's smooth scroller from taking the wheel, so it still scrolls by hand. */}
          <div data-lenis-prevent className="scroll-quiet h-[480px] overflow-y-auto overscroll-contain rounded-[8px] bg-canvas px-3 pb-3 lg:px-4" role="log" aria-live="polite">
            <ChatList msgs={msgs} animate />
            <div ref={end} />
          </div>

          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              {asked ? (
                <motion.section key="q" className="card overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                  <div className={`flex items-center justify-between gap-2 border-b px-4 py-2.5 transition-colors duration-500 ${answered ? "border-hairline bg-well" : "border-hold-tint-strong bg-hold-tint"}`}>
                    <span className="flex items-center gap-2"><Avatar who="cfo" size={22} /><span className="title text-[15px]">Question for the CFO</span></span>
                    {answered ? <Pill>Answered</Pill> : <span className="breathe text-[16px] text-hold" style={{ fontFamily: "var(--font-music)" }} aria-label="waiting">𝄐</span>}
                  </div>
                  <div className="space-y-3 p-4">
                    <p className="text-[13.5px] leading-snug text-ink">{q.text}</p>
                    <ul className="space-y-1.5">
                      {q.options.map((o) => {
                        const taken = answered && q.answer === o.id;
                        return (
                          <motion.li key={o.id} animate={{ opacity: answered && !taken ? 0.4 : 1, scale: taken ? 1.01 : 1 }} transition={{ duration: 0.4, ease: EASE }}
                            className={`rounded-[8px] border px-3 py-2 transition-colors duration-300 ${taken ? "border-accent bg-accent-tint" : "border-hairline bg-ground"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12.5px] font-medium leading-snug text-ink">{o.label}</span>
                              {taken ? <span className="shrink-0 font-mono text-[11px] text-accent">CFO ✓</span> : null}
                            </div>
                          </motion.li>
                        );
                      })}
                    </ul>
                    {settled && ROOM.resolution ? (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12.5px] leading-snug text-secondary">
                        <span className="font-medium text-ink">Settled:</span> {ROOM.resolution}
                      </motion.p>
                    ) : null}
                  </div>
                </motion.section>
              ) : (
                <motion.div key="wait" className="hatch grid min-h-[200px] place-items-center rounded-[8px] border border-hairline px-6 text-center text-[13px] text-faint"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  The agents are meeting. One question comes out.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
