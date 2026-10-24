"use client";
// The orb as the hold to talk control, with the small round badge on its lower edge that says what it does: a blue
// mic, a blue stop square while listening, a grey crossed mic when this browser cannot take a spoken question.
import { Mic, MicOff, Square } from "lucide-react";
import { ThinkingOrb, type OrbState } from "./orb";
import type { usePushToTalk } from "./pushToTalk";

export function OrbButton({ talk, state, voiceIn, busy, small = false, className = "" }: {
  talk: ReturnType<typeof usePushToTalk>; state: OrbState; voiceIn: boolean; busy: boolean; small?: boolean; className?: string;
}) {
  return (
    <button {...talk.props} disabled={!voiceIn || busy || talk.phase === "transcribing"}
      aria-label={voiceIn ? (state === "listening" ? "Listening. Let go to ask" : "Hold to ask a question out loud") : "Voice questions need a browser that can listen"}
      className={`calm group relative grid touch-none select-none place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent enabled:cursor-pointer disabled:cursor-default ${className}`}>
      <ThinkingOrb state={state} className={`absolute inset-0 transition-transform duration-500 ${state === "listening" ? "scale-[1.04]" : ""} ${voiceIn && state === "idle" ? "group-hover:scale-[1.03]" : ""}`} />
      {voiceIn || !small ? (
        <span aria-hidden className={`calm absolute bottom-0 grid translate-y-1/3 place-items-center rounded-full border shadow-[0_2px_6px_rgb(85_40_20/0.12)] ${small ? "size-6" : "size-8"} ${!voiceIn ? "border-hairline bg-well text-faint" : state === "listening" ? "border-accent bg-accent text-white" : "border-hairline bg-ground text-accent group-hover:border-accent"}`}>
          {!voiceIn ? <MicOff size={small ? 12 : 14} strokeWidth={1.75} /> : state === "listening" ? <Square size={small ? 9 : 11} strokeWidth={2} fill="currentColor" /> : <Mic size={small ? 12 : 15} strokeWidth={1.75} />}
        </span>
      ) : null}
    </button>
  );
}
