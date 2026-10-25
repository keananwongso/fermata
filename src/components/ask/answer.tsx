"use client";
// One answer's template, as every Ask the books surface shows it: in a frame, or the gateway's refusal. The dock and
// the panel each put the spoken caption and Play or Stop above it.
import { motion } from "motion/react";
import { RefusalNote, View } from "./views";
import type { OrbState } from "./orb";
import type { Shown } from "./useAsk";

const EASE = [0.22, 1, 0.36, 1] as const;
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
