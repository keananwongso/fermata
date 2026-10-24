"use client";
// One answer, as every Ask the books surface shows it: the spoken sentence captioned in time with the voice, Play or
// Stop, Ask again, the two labels (where the answer came from, and whether its numbers were checked), and then the
// answer's template in a frame (or the gateway's refusal).
import { motion } from "motion/react";
import { Play, RotateCcw, Square } from "lucide-react";
import { Pill } from "../ui";
import { SpokenCaption } from "./caption";
import { RefusalNote, View } from "./views";
import { LIVE } from "./voice";
import type { OrbState } from "./orb";
import type { Shown } from "./useAsk";

const EASE = [0.22, 1, 0.36, 1] as const;
const pillButton = "calm inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline bg-ground px-3 text-[12.5px] font-medium text-ink hover:border-strong hover:bg-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 lg:min-h-8";

export function AnswerHead({ shown, state, onPlay, onStop, onReset, captionClass = "" }: { shown: Shown; state: OrbState; onPlay: () => void; onStop: () => void; onReset: () => void; captionClass?: string }) {
  const answer = shown.answer;
  return (
    <div>
      <SpokenCaption text={answer.spoken} live={state === "speaking"} className={`title leading-[1.3] ${captionClass}`} />
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {state === "speaking" || state === "thinking" ? (
          <button type="button" onClick={onStop} className={pillButton}>
            <Square size={10} strokeWidth={2} fill="currentColor" className="text-accent" />Stop
          </button>
        ) : (
          <button type="button" onClick={onPlay} disabled={!shown.audio && !LIVE} className={pillButton}>
            <Play size={11} strokeWidth={2} fill="currentColor" className="text-accent" />Play
          </button>
        )}
        <button type="button" onClick={onReset} className="calm inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-8">
          <RotateCcw size={12} strokeWidth={1.75} />Ask again
        </button>
        <span className="mx-0.5 hidden h-4 w-px bg-hairline sm:block" aria-hidden />
        {shown.from === "recorded" ? <Pill>Recorded answer</Pill> : <Pill>Live: Claude chose the query</Pill>}
        {answer.checked ? <Pill>Every number checked against the data</Pill> : <Pill>Sentence written by code</Pill>}
      </div>
    </div>
  );
}

// The template rises in shortly after the caption starts.
export function AnswerBody({ shown, state, className = "mt-5" }: { shown: Shown; state: OrbState; className?: string }) {
  const answer = shown.answer;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.45, ease: EASE, delay: state === "speaking" || state === "thinking" ? 0.7 : 0.05 }}>
      {answer.refusal ? <div className={className}><RefusalNote r={answer.refusal} /></div> : null}
      {answer.view ? <div className={`frame ${className}`}><div className="card @container p-4 sm:p-5 lg:p-6"><View v={answer.view} /></div></div> : null}
    </motion.div>
  );
}
