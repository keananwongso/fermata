"use client";
// Ask the books: hold the orb to ask a question about the books, hear the answer, see it in one of five templates.
// Not a chat: one question and its answer at a time, a caption of what was said, at most three recent questions,
// and four suggested questions at a time. A suggested question (or anything that matches one) is answered from the
// recording with no Claude call; anything else goes to the live, rate limited path when this build has a Convex URL.
//
// The flow: invite (a large orb and four suggestions) → listening (the orb follows the microphone) → writing down
// the question → reading the books → speaking (the orb shrinks beside the answer, which is captioned in time with the
// voice) → done (the answer's template, with ask again). The orb is one element the whole way, so a press that
// starts on it always ends on it.
//
// Mount anywhere: <AskPanel /> (see DESIGN.md, "Ask the books"). The site wide overlay (overlay.tsx) shares its
// question and answer (useAsk), its answer (answer.tsx) and its orb.
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, RefreshCw } from "lucide-react";
import { AnswerBody, AnswerHead } from "./answer";
import { RECORDED, PER_SET, SETS, fromRecording, useAsk, type Shown } from "./useAsk";
import { usePushToTalk, useVoiceInput } from "./pushToTalk";
import { OrbButton } from "./orbButton";
import type { OrbState } from "./orb";

type Phase = OrbState;

const EASE = [0.22, 1, 0.36, 1] as const;

export function AskPanel({ className = "" }: { className?: string }) {
  const a = useAsk();
  const { phase, setPhase, shown, setShown, notice, setNotice, heard, setHeard, ask } = a;
  const [typed, setTyped] = useState("");
  const [set, setSet] = useState(0);
  // False on the server and where this browser cannot take a spoken question.
  const voiceIn = useVoiceInput();

  const busy = phase === "thinking" || phase === "transcribing";
  const talk = usePushToTalk({
    disabled: !voiceIn || busy, blips: true,
    onPhase: (p) => {
      if (p === "listening") a.listening();
      else if (p === "transcribing") setPhase("transcribing");
      else setPhase((cur) => (cur === "listening" || cur === "transcribing" ? "idle" : cur));
    },
    onText: (t) => { setHeard(t); void ask(t); },
    onError: (m) => setNotice(m),
  });

  // /ask?q=<preset id> opens that recorded answer, without playing it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("q");
    const r = id ? fromRecording(id) : null;
    if (!r) return;
    const t = requestAnimationFrame(() => setShown(r));
    return () => cancelAnimationFrame(t);
  }, [setShown]);

  // Development only: ?orb=listening|transcribing|thinking|speaking holds the orb in that state, for screenshots.
  // Next removes this block from production builds.
  const [forced, setForced] = useState<Phase | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const f = new URLSearchParams(window.location.search).get("orb") as Phase | null;
    if (!f || !["idle", "listening", "transcribing", "thinking", "speaking"].includes(f)) return;
    const t = requestAnimationFrame(() => setForced(f));
    return () => cancelAnimationFrame(t);
  }, []);

  const state: Phase = forced ?? (talk.phase === "listening" ? "listening" : talk.phase === "transcribing" ? "transcribing" : phase);
  const answer = shown?.answer ?? null;
  const answering = !!(shown && answer);
  const status = statusText(state, voiceIn, heard);
  const ready = !(state === "thinking" || state === "transcribing" || state === "listening");

  const submitTyped = () => { const q = typed; setTyped(""); setHeard(null); void ask(q); };
  const pick = (q: string) => { setHeard(null); void ask(q); };

  return (
    <section className={`card overflow-hidden p-5 lg:p-7 ${className}`} aria-label="Ask the books">
      {/* One announcement per turn: the question and the whole answer, or what the orb is doing. */}
      <div className="sr-only" aria-live="polite" role="status">{answering ? `${shown!.question}. ${answer!.spoken}` : status.title}</div>

      {/* Answering, on a phone: the small orb beside the question, the answer under both at full width.
          Wider: the orb in its own column beside all of it. */}
      <div className={answering ? "grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-start sm:gap-x-6 sm:gap-y-0" : "flex flex-col items-center pt-2 text-center lg:pt-4"}>
        <motion.div layout transition={{ duration: 0.5, ease: EASE }} className={`relative shrink-0 ${answering ? "sm:row-span-2" : ""}`}>
          <OrbButton talk={talk} state={state} voiceIn={voiceIn} busy={busy} small={answering} className={answering ? "size-14 sm:size-[88px]" : "size-[156px] sm:size-[188px]"} />
        </motion.div>

        {answering ? (
          <motion.p layout="position" transition={{ duration: 0.5, ease: EASE }} className="min-w-0 text-[13px] text-secondary sm:pt-1">
            <span className="text-faint">You asked</span> <span className="text-ink">{shown!.question}</span>
          </motion.p>
        ) : null}
        <motion.div layout="position" transition={{ duration: 0.5, ease: EASE }} className={`min-w-0 ${answering ? "col-span-2 sm:col-span-1 sm:col-start-2" : "mt-5 max-w-[520px]"}`}>
          {answering ? (
            <div key={shown!.question + shown!.from}>
              <AnswerHead shown={shown!} state={state} onPlay={() => a.play(shown!)} onStop={a.stop} onReset={a.reset} captionClass="text-[clamp(19px,2.1vw,24px)] sm:mt-2" />
            </div>
          ) : (
            <div>
              <p className="title text-[22px] lg:text-[26px]">{status.title}</p>
              <p className="mt-1.5 text-[13px] text-secondary">{status.sub}</p>
            </div>
          )}
        </motion.div>
      </div>

      {notice && !answering ? (
        <div className="enter mx-auto mt-5 max-w-[520px] rounded-[6px] border border-hairline bg-well px-3 py-2 text-center text-[13px] text-secondary" role="status">{notice}</div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {answering ? <AnswerBody key={shown!.question + shown!.from} shown={shown!} state={state} /> : null}
      </AnimatePresence>

      <Dock center={!answering} disabled={!ready} current={shown?.question ?? null} set={set} onMore={() => setSet((s) => (s + 1) % SETS)} onPick={pick}
        typed={typed} onTyped={setTyped} onSubmit={submitTyped}
        recent={a.history.filter((h) => h.question !== shown?.question).slice(0, 3)} onRecent={a.recall} />
    </section>
  );
}

function statusText(state: Phase, voiceIn: boolean, heard: string | null): { title: string; sub: string } {
  if (state === "listening") return { title: "Listening", sub: "Ask your question, then let go." };
  if (state === "transcribing") return { title: "Writing down your question", sub: "One moment." };
  if (state === "thinking") return { title: "Reading the books", sub: heard ? `You asked: "${heard}"` : "Every number comes from the data, not from the model." };
  if (state === "speaking") return { title: "Speaking", sub: "" };
  if (!voiceIn) return { title: "What do you want to know?", sub: "Voice questions need a browser that can listen. Pick one below to hear its answer." };
  return { title: "Hold to ask", sub: "Press and hold the orb, ask out loud, then let go. Space works too." };
}

const chip = "calm group/q flex h-full min-h-11 w-full items-center gap-3 rounded-[10px] border px-3.5 py-2 text-left text-[13px] leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

// Under the orb or the answer: four suggestions, the typed field, a short recent list and the read only promise.
function Dock({ center, disabled, current, set, onMore, onPick, typed, onTyped, onSubmit, recent, onRecent }: {
  center: boolean; disabled: boolean; current: string | null; set: number; onMore: () => void; onPick: (q: string) => void;
  typed: string; onTyped: (v: string) => void; onSubmit: () => void; recent: Shown[]; onRecent: (s: Shown) => void;
}) {
  const shownSet = RECORDED.slice(set * PER_SET, set * PER_SET + PER_SET);
  const field = useId();
  return (
    <div className={`mt-7 ${center ? "mx-auto flex max-w-[600px] flex-col items-center text-center" : "border-t border-hairline pt-5"}`}>
      <div className={`flex w-full items-center gap-3 ${center ? "justify-center" : "justify-between"}`}>
        <span className="eyebrow">{center ? "Try asking" : "Ask another"}</span>
        {SETS > 1 ? (
          <button type="button" onClick={onMore} className="calm inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[12px] text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-7">
            <RefreshCw size={12} strokeWidth={1.75} />More questions
          </button>
        ) : null}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ul key={set} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}
          className={`mt-2.5 grid w-full gap-2 text-left sm:grid-cols-2 ${center ? "" : "lg:grid-cols-4"}`}>
          {shownSet.map((p) => (
            <li key={p.id} className="min-w-0">
              <button type="button" disabled={disabled} onClick={() => onPick(p.question)}
                className={`${chip} ${current === p.question ? "border-accent bg-accent-tint text-accent" : "border-hairline bg-ground text-body hover:border-strong hover:bg-warm"}`}>
                <span className="min-w-0 flex-1">{p.question}</span>
                <ArrowRight aria-hidden size={14} strokeWidth={1.75} className="shrink-0 text-faint transition-transform duration-300 group-hover/q:translate-x-0.5 group-hover/q:text-accent" />
              </button>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>

      <form className={`mt-3 flex w-full items-center gap-2 ${center ? "" : "max-w-[640px]"}`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label htmlFor={field} className="sr-only">Or type a question</label>
        <div className="calm flex min-w-0 flex-1 items-center rounded-full border border-hairline bg-well pl-4 pr-1 focus-within:border-accent focus-within:bg-ground hover:border-strong">
          <input id={field} value={typed} onChange={(e) => onTyped(e.target.value)} maxLength={240} placeholder="Or type a question" autoComplete="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none lg:min-h-10" />
          <button type="submit" disabled={!typed.trim() || disabled} aria-label="Ask"
            className="calm grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:bg-inset disabled:text-faint">
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
      </form>

      {recent.length ? (
        <p className="mt-3 text-[12px] text-faint">
          <span>Recent: </span>
          {recent.map((h, i) => (
            <span key={h.question}>{i ? <span aria-hidden> · </span> : null}<button type="button" onClick={() => onRecent(h)} className="calm text-link hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{h.question}</button></span>
          ))}
        </p>
      ) : null}

      <p className="mt-4 text-[12px] text-faint">Read only: it can explain the books, never change them.</p>
    </div>
  );
}
