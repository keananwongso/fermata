"use client";
// The landing page's Ask the books section: a short lesson in the shortcut (the orb over the coach card, as the popup
// shows them) and a few suggested questions that open the popup and ask. The popup itself is overlay.tsx.
import { ArrowRight } from "lucide-react";
import { ThinkingOrb } from "./orb";
import { CoachCard, openAsk, useKeyboard } from "./overlay";
import { RECORDED } from "./useAsk";

export function AskLesson() {
  const keyboard = useKeyboard();
  const say = RECORDED[0]?.question ?? "";
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-[16px] border border-hairline bg-warm px-4 py-8 sm:px-8 sm:py-10">
      <button type="button" onClick={() => openAsk()} aria-label="Open Ask the books"
        className="calm relative size-[104px] rounded-full hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:size-[120px]">
        <ThinkingOrb state="idle" className="absolute inset-0" />
      </button>
      <div className="mt-6 w-full max-w-[440px] text-left">
        <CoachCard still suggestion={say} onType={() => openAsk({ type: true })}
          status={keyboard ? "Let go of the keys to ask. The answer is spoken and shown." : "Tap the orb, then hold it while you speak."} />
      </div>
    </div>
  );
}

export function AskChips({ count = 4 }: { count?: number }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {RECORDED.slice(1, 1 + count).map((p) => (
        <li key={p.id} className="min-w-0">
          <button type="button" onClick={() => openAsk({ question: p.question })}
            className="calm group/q flex h-full min-h-11 w-full items-center gap-3 rounded-[10px] border border-hairline bg-ground px-3.5 py-2 text-left text-[13px] leading-snug text-body hover:border-strong hover:bg-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="min-w-0 flex-1">{p.question}</span>
            <ArrowRight aria-hidden size={14} strokeWidth={1.75} className="shrink-0 text-faint transition-transform duration-300 group-hover/q:translate-x-0.5 group-hover/q:text-accent" />
          </button>
        </li>
      ))}
    </ul>
  );
}
