"use client";
// Ask the books: hold the orb to ask a question about the books, hear the answer, see it in one of five templates.
// Not a chat: one question and its answer at a time. A suggested question (or anything that matches one) is answered
// from the recording with no Claude call; anything else goes to the live, rate limited path when this build has a
// Convex URL.
//
// The same glass as the dock (overlay.tsx), laid out for a whole view: before an answer, the orb large and centred with
// one phrase under it; with one, the orb small beside the question, the spoken caption and the template. Under both,
// a row of suggestions as glass pills and one glass bar to type in. The orb is one element the whole way, so a press
// that starts on it always ends on it.
//
// Mount anywhere: <AskPanel /> (see DESIGN.md, "Ask the books"). It brings no surface of its own; the page gives it one.
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, ArrowUpRight, Play, RefreshCw, RotateCcw, Square } from "lucide-react";
import { AnswerBody } from "./answer";
import { SpokenCaption } from "./caption";
import { LevelBars } from "./level";
import { PER_SET, RECORDED, SETS, fromRecording, nextQuestions, useAsk } from "./useAsk";
import { usePushToTalk, useVoiceInput } from "./pushToTalk";
import { OrbButton } from "./orbButton";
import { useHideDock } from "./overlay";
import { LIVE } from "./voice";
import type { OrbState } from "./orb";

type Phase = OrbState;

const EASE = [0.22, 1, 0.36, 1] as const;
const chip = "glass-chip calm inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 lg:min-h-9";

export function AskPanel({ className = "" }: { className?: string }) {
  const a = useAsk();
  const { phase, setPhase, shown, setShown, notice, setNotice, heard, setHeard, ask } = a;
  const [typed, setTyped] = useState("");
  const [set, setSet] = useState(0);
  const [words, setWords] = useState("");
  // False on the server and where this browser cannot take a spoken question.
  const voiceIn = useVoiceInput();
  // The panel is its own orb, so the dock's resting pill steps aside while it's on screen.
  useHideDock();

  const busy = phase === "thinking" || phase === "transcribing";
  const talk = usePushToTalk({
    disabled: !voiceIn || busy, blips: true,
    onPhase: (p) => {
      if (p === "listening") { setWords(""); a.listening(); }
      else if (p === "transcribing") setPhase("transcribing");
      else setPhase((cur) => (cur === "listening" || cur === "transcribing" ? "idle" : cur));
    },
    onWords: setWords,
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
  const answering = !!shown;
  const ready = !(state === "thinking" || state === "transcribing" || state === "listening");
  const line = statusLine(state, voiceIn, heard, words);

  const submitTyped = () => { const q = typed; setTyped(""); setHeard(null); void ask(q); };
  const pick = (q: string) => { setHeard(null); void ask(q); };
  const suggestions = answering ? nextQuestions(shown.question, 3) : RECORDED.slice(set * PER_SET, set * PER_SET + PER_SET);

  return (
    <section className={`relative ${className}`} aria-label="Ask the books">
      {/* One announcement per turn: the question and the whole answer, or what the orb is doing. */}
      <div className="sr-only" aria-live="polite" role="status">{answering ? `${shown.question}. ${shown.answer.spoken}` : line.title}</div>

      <div className={answering ? "flex items-center gap-3.5" : "flex flex-col items-center pt-4 text-center lg:pt-8"}>
        <motion.div layout transition={{ duration: 0.5, ease: EASE }} className="shrink-0">
          <OrbButton talk={talk} state={state} voiceIn={voiceIn} busy={busy} className={answering ? "size-14" : "size-[148px] sm:size-[176px]"} />
        </motion.div>
        <motion.div layout="position" transition={{ duration: 0.5, ease: EASE }} className={`min-w-0 ${answering ? "" : "mt-6"}`}>
          {answering ? (
            <>
              <p className="text-[12.5px] text-faint">{state === "idle" || state === "speaking" ? "You asked" : line.title}</p>
              <p className="truncate text-[14px] text-ink">{heard ?? shown.question}</p>
            </>
          ) : (
            <>
              <p className="title text-[24px] lg:text-[28px]">{line.title}</p>
              <p className={`mt-2 flex min-h-5 items-center justify-center gap-2 text-[13.5px] ${words && state === "listening" ? "text-ink" : "text-secondary"}`}>
                {state === "listening" ? <LevelBars active /> : null}{line.sub}
              </p>
            </>
          )}
        </motion.div>
      </div>

      {notice && !answering ? (
        <p className="enter mx-auto mt-4 max-w-[520px] text-center text-[13px] text-secondary" role="status">{notice}</p>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {answering ? (
          <motion.div key={shown.question + shown.from} className="mt-5"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
            <SpokenCaption text={shown.answer.spoken} live={state === "speaking"} className="title text-[clamp(19px,2.1vw,24px)] leading-[1.3]" />
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {state === "speaking" || state === "thinking" ? (
                <button type="button" onClick={a.stop} className={chip}><Square size={10} strokeWidth={2} fill="currentColor" className="text-accent" />Stop</button>
              ) : (
                <button type="button" onClick={() => a.play(shown)} disabled={!shown.audio && !LIVE} className={chip}><Play size={11} strokeWidth={2} fill="currentColor" className="text-accent" />Play again</button>
              )}
              <button type="button" onClick={a.reset} className={chip}><RotateCcw size={12} strokeWidth={1.75} className="text-secondary" />Ask again</button>
              <span className="text-[11.5px] text-faint">
                {shown.from === "recorded" ? "Recorded" : "Live: Claude chose the query"} · {shown.answer.checked ? "every number from the books" : "written by code"}
              </span>
            </div>
            <AnswerBody shown={shown} state={state} className="mt-5" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Composer center={!answering} disabled={!ready} suggestions={suggestions} label={answering ? "Ask next" : null}
        onMore={!answering && SETS > 1 ? () => setSet((s) => (s + 1) % SETS) : null} onPick={pick}
        typed={typed} onTyped={setTyped} onSubmit={submitTyped} />
    </section>
  );
}

function statusLine(state: Phase, voiceIn: boolean, heard: string | null, words: string): { title: string; sub: string } {
  if (state === "listening") return { title: "Listening", sub: words || "Let go when you're done." };
  if (state === "transcribing") return { title: "Got it", sub: words };
  if (state === "thinking") return { title: "Reading the books", sub: heard ? `"${heard}"` : "" };
  if (state === "speaking") return { title: "Answering", sub: "" };
  if (!voiceIn) return { title: "What do you want to know?", sub: "Pick a question, or type one." };
  return { title: "Hold to ask", sub: "Hold the orb, ask out loud, let go." };
}

// Under the orb or the answer: suggestions as glass pills and one glass bar to type in.
function Composer({ center, disabled, suggestions, label, onMore, onPick, typed, onTyped, onSubmit }: {
  center: boolean; disabled: boolean; suggestions: { id: string; question: string }[]; label: string | null; onMore: (() => void) | null;
  onPick: (q: string) => void; typed: string; onTyped: (v: string) => void; onSubmit: () => void;
}) {
  const field = useId();
  return (
    <div className={center ? "mx-auto mt-8 flex max-w-[640px] flex-col items-center" : "mt-6 border-t border-hairline pt-5"}>
      {label ? <span className="eyebrow">{label}</span> : null}
      <ul className={`flex flex-wrap gap-2 ${center ? "justify-center" : "mt-2.5"}`}>
        {suggestions.map((p) => (
          <li key={p.id} className="min-w-0">
            <button type="button" disabled={disabled} onClick={() => onPick(p.question)}
              className="glass-chip calm group/q inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 text-left text-[13px] leading-snug text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 lg:min-h-9">
              <span className="min-w-0">{p.question}</span>
              <ArrowUpRight aria-hidden size={13} strokeWidth={1.75} className="shrink-0 text-faint group-hover/q:text-accent" />
            </button>
          </li>
        ))}
        {onMore ? (
          <li>
            <button type="button" onClick={onMore} aria-label="More questions" title="More questions"
              className="calm grid size-11 place-items-center rounded-full text-faint hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:size-9">
              <RefreshCw size={13} strokeWidth={1.75} />
            </button>
          </li>
        ) : null}
      </ul>

      <form className={`glass mt-3 flex w-full items-center rounded-full pl-5 pr-1.5 ${center ? "" : "max-w-[640px]"}`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label htmlFor={field} className="sr-only">Or type a question</label>
        <input id={field} value={typed} onChange={(e) => onTyped(e.target.value)} maxLength={240} placeholder="Or type a question" autoComplete="off"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none" />
        <button type="submit" disabled={!typed.trim() || disabled} aria-label="Ask"
          className="calm grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:bg-transparent disabled:text-mute">
          <ArrowUp size={16} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
