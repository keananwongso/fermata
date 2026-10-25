"use client";
// The CFO answers a case room's question by voice: hold, say the answer, let go. It is read back (out loud and on
// the card), then sent with a click or a spoken yes, as the CFO's answer marked as a voice answer. Voice never
// approves anything: confirming the restated answer and approving a rule stay clicks on the cards.
import { useMutation } from "convex/react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { matchOption, yesOrNo } from "../../convex/lib/voiceMatch";
import { CONSOLE_KEY } from "./consoleKey";
import { PushToTalk, useVoiceInput, type TalkPhase } from "./ask/pushToTalk";
import { speak, stopSpeaking } from "./ask/voice";
import { Button } from "./ui";

type Opt = Doc<"questions">["options"][number];
const EASE = [0.22, 1, 0.36, 1] as const;

export function VoiceAnswer({ q }: { q: Doc<"questions"> }) {
  const voiceIn = useVoiceInput();
  const answer = useMutation(api.humans.answer);
  const [phase, setPhase] = useState<TalkPhase>("idle");
  const [words, setWords] = useState("");
  const [picked, setPicked] = useState<Opt | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  if (!voiceIn) return null;

  const onPhase = (p: TalkPhase) => { setPhase(p); if (p === "listening") { setWords(""); setNote(null); } };
  const cancel = () => { stopSpeaking(); setPicked(null); setWords(""); setNote("Cancelled. Nothing was sent."); };

  const onAnswer = (text: string) => {
    setWords(text);
    const o = matchOption(text, q.options);
    if (o) { setPicked(o); void speak(`You said: ${o.label}. Send it, or say yes.`); }
    else { setNote(`Didn't match an answer. Try "${q.options[0]?.label}".`); void speak("Sorry, that doesn't match one of the answers. Try again."); }
  };
  const send = async () => {
    setSending(true); setNote(null);
    try {
      const e = await answer({ questionId: q._id, optionId: picked!.id, actor: "cfo", voice: true, consoleKey: CONSOLE_KEY });
      if (e) setNote(e); else { setPicked(null); setWords(""); void speak("Sent. Confirm it on the card when you're ready."); setNote("Sent. Confirm it on the card."); }
    } finally { setSending(false); }
  };
  const onConfirm = (text: string) => {
    setWords(text);
    const yn = yesOrNo(text);
    if (yn === "yes") void send();
    else if (yn === "no") cancel();
    else setNote(`Heard "${text}". Say yes or no.`);
  };

  const line = phase === "listening" ? (words || "Listening…") : phase === "transcribing" ? "Got it…" : null;

  return (
    <div className="glass mt-4 rounded-[20px] p-2">
      <AnimatePresence mode="wait" initial={false}>
        {!picked ? (
          <motion.div key="ask" className="flex min-h-11 items-center gap-3"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}>
            <PushToTalk label="Hold to answer" onPhase={onPhase} onWords={setWords} onText={onAnswer} onError={setNote} />
            <p className={`min-w-0 truncate pr-3 text-[13px] ${line && words ? "text-ink" : "text-secondary"}`} aria-live="polite">
              {line ?? note ?? "Or answer out loud. It's read back first."}
            </p>
          </motion.div>
        ) : (
          <motion.div key="confirm" className="px-2 pb-1 pt-2"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}>
            <p className="text-[12.5px] text-faint">You said</p>
            <p className="mt-0.5 text-[15px] font-medium text-ink">{picked.label}</p>
            <p className="mt-1 text-[13px] text-secondary">{picked.impact}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => void send()} disabled={sending}>{sending ? "Sending…" : "Send answer"}</Button>
              <PushToTalk label="Or say yes" disabled={sending} onPhase={onPhase} onWords={setWords} onText={onConfirm} onError={setNote} />
              <Button variant="ghost" onClick={cancel} disabled={sending}>Cancel</Button>
            </div>
            {line || note ? <p className="mt-2 text-[12.5px] text-secondary" role="status">{line ?? note}</p> : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
