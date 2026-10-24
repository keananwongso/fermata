"use client";
// The CFO answers a case room's question by voice: say the answer, hear it read back, say yes. Only then is it sent,
// as the CFO's answer marked as a voice answer. Voice never approves anything: confirming the restated answer and
// approving a rule stay clicks on the cards.
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { matchOption, yesOrNo } from "../../convex/lib/voiceMatch";
import { CONSOLE_KEY } from "./consoleKey";
import { PushToTalk, useVoiceInput } from "./ask/pushToTalk";
import { speak, stopSpeaking } from "./ask/voice";
import { Button } from "./ui";

type Opt = Doc<"questions">["options"][number];

export function VoiceAnswer({ q }: { q: Doc<"questions"> }) {
  const voiceIn = useVoiceInput();
  const answer = useMutation(api.humans.answer);
  const [heard, setHeard] = useState<string | null>(null);
  const [picked, setPicked] = useState<Opt | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  if (!voiceIn) return null;

  const readBack = (o: Opt) => {
    setPicked(o);
    void speak(`You said: ${o.label}. That means: ${o.impact} Hold the button and say yes to send it, or no to cancel.`);
  };
  const onAnswer = (text: string) => {
    setHeard(text); setNote(null);
    const o = matchOption(text, q.options);
    if (o) readBack(o);
    else { setNote(`That doesn't match one of the answers. Try saying one of them, for example "${q.options[0]?.label}".`); void speak("Sorry, that doesn't match one of the answers. Try again."); }
  };
  const onConfirm = async (text: string) => {
    setHeard(text); setNote(null);
    const yn = yesOrNo(text);
    if (yn === "no") { stopSpeaking(); setPicked(null); setNote("Cancelled. Nothing was sent."); return; }
    if (yn !== "yes") { setNote(`I heard "${text}". Say yes to send it, or no to cancel.`); return; }
    setSending(true);
    try {
      const e = await answer({ questionId: q._id, optionId: picked!.id, actor: "cfo", voice: true, consoleKey: CONSOLE_KEY });
      if (e) setNote(e); else void speak("Sent. Confirm it on the card when you're ready.");
    } finally { setSending(false); }
  };

  return (
    <div className="panel mt-4 p-4">
      <div className="eyebrow">Or answer by voice</div>
      {!picked ? (
        <div className="mt-3 flex items-center gap-3">
          <PushToTalk size={48} label="Hold to answer by voice" onText={onAnswer} onError={setNote} />
          <div className="min-w-0 text-[13px] text-secondary">Hold, say your answer, let go. It is read back to you before anything is sent.</div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="text-[14px]">You said <span className="font-medium">{picked.label}</span>. That means: <span className="text-secondary">{picked.impact}</span></div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PushToTalk size={48} label="Hold and say yes or no" disabled={sending} onText={(t) => void onConfirm(t)} onError={setNote} />
            <span className="text-[13px] text-secondary">Hold and say yes to send it, or no to cancel.</span>
            <Button variant="ghost" onClick={() => { stopSpeaking(); setPicked(null); setNote("Cancelled. Nothing was sent."); }}>Cancel</Button>
          </div>
        </div>
      )}
      {heard ? <div className="mt-2 text-[12px] text-faint">Heard: &quot;{heard}&quot;</div> : null}
      {note ? <div className="mt-2 text-[13px] text-secondary" role="status">{note}</div> : null}
    </div>
  );
}
