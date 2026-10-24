"use client";
// Hold to talk: press (or hold Space or Enter), speak, let go. Hands the transcript to `onText`.
// `usePushToTalk` is the behaviour, so any control can be the button (the orb in Ask the books);
// `PushToTalk` is the plain round button the case room's voice answers use.
import { useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes } from "react";
import { Mic, Square } from "lucide-react";
import { LIVE, canRecord, startRecording, stopSpeaking, transcribe, type Recording } from "./voice";

export type TalkPhase = "idle" | "listening" | "transcribing";
const noop = () => () => {};
const recordable = () => { try { return LIVE && canRecord(); } catch { return false; } };

export function useVoiceInput() {
  return useSyncExternalStore(noop, recordable, () => false);
}

type Talk = { onText: (text: string) => void; onError: (message: string) => void; disabled?: boolean; onPhase?: (p: TalkPhase) => void };

// The pointer and key handlers for a hold to talk control, and its phase.
export function usePushToTalk({ onText, onError, disabled = false, onPhase }: Talk) {
  const [phase, setPhaseState] = useState<TalkPhase>("idle");
  const rec = useRef<Recording | null>(null);
  const holding = useRef(false);
  const setPhase = (p: TalkPhase) => { setPhaseState(p); onPhase?.(p); };
  useEffect(() => () => rec.current?.cancel(), []);

  const begin = async () => {
    if (disabled || holding.current || phase !== "idle") return;
    holding.current = true;
    stopSpeaking();
    try {
      const r = await startRecording();
      if (!holding.current) { r.cancel(); return; }
      rec.current = r;
      setPhase("listening");
    } catch {
      holding.current = false;
      onError("The microphone is blocked. Allow it in the browser.");
    }
  };
  const end = async () => {
    if (!holding.current) return;
    holding.current = false;
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    setPhase("transcribing");
    const clip = await r.stop();
    if (!clip) { setPhase("idle"); onError("Hold while you speak, then let go."); return; }
    const t = await transcribe(clip);
    setPhase("idle");
    if ("error" in t) onError(t.error); else onText(t.text);
  };

  const props: ButtonHTMLAttributes<HTMLButtonElement> = {
    type: "button",
    disabled: disabled || phase === "transcribing",
    onPointerDown: (e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); void begin(); },
    onPointerUp: () => void end(),
    onPointerCancel: () => void end(),
    onContextMenu: (e) => e.preventDefault(),
    onKeyDown: (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); void begin(); } },
    onKeyUp: (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); void end(); } },
  };
  return { phase, props };
}

export function PushToTalk({ size = 64, label = "Hold to answer", ...talk }: Talk & { size?: number; label?: string }) {
  const { phase, props } = usePushToTalk(talk);
  return (
    <button {...props} aria-label={label} style={{ width: size, height: size }}
      className={`calm relative grid shrink-0 touch-none select-none place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-mute ${phase === "listening" ? "bg-accent-hover" : "bg-accent hover:bg-accent-hover"}`}>
      {phase === "listening" ? <span aria-hidden className="listen absolute inset-0 rounded-full" /> : null}
      {phase === "listening" ? <Square size={Math.round(size / 3.2)} strokeWidth={2} fill="currentColor" /> : <Mic size={Math.round(size / 2.7)} strokeWidth={1.75} />}
    </button>
  );
}
