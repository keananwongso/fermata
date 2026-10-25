"use client";
// The orb as the hold to talk control, in the same glass as the dock (overlay.tsx). No badge: the words beside it say
// what it does, and the orb itself shows listening, thinking and speaking.
import { ThinkingOrb, type OrbState } from "./orb";
import type { usePushToTalk } from "./pushToTalk";

export function OrbButton({ talk, state, voiceIn, busy, className = "" }: {
  talk: ReturnType<typeof usePushToTalk>; state: OrbState; voiceIn: boolean; busy: boolean; className?: string;
}) {
  return (
    <button {...talk.props} disabled={!voiceIn || busy || talk.phase === "transcribing"}
      aria-label={voiceIn ? (state === "listening" ? "Listening. Let go to ask" : "Hold to ask a question out loud") : "Voice questions need a browser that can listen"}
      className={`glass group relative grid touch-none select-none place-items-center rounded-full transition-transform duration-500 ease-[var(--ease-spring)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent enabled:cursor-pointer enabled:active:scale-[0.96] disabled:cursor-default ${state === "listening" ? "scale-[1.04]" : voiceIn && state === "idle" ? "hover:scale-[1.02]" : ""} ${className}`}>
      <ThinkingOrb state={state} className="absolute inset-[7%]" />
    </button>
  );
}
