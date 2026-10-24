"use client";
// A hold-to-talk button: press (or hold Space or Enter), speak, let go. Hands the transcript to `onText`.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { LIVE, canRecord, startRecording, stopSpeaking, transcribe, type Recording } from "./voice";

export type TalkPhase = "idle" | "listening" | "transcribing";
const noop = () => () => {};
const recordable = () => { try { return LIVE && canRecord(); } catch { return false; } };

export function useVoiceInput() {
  return useSyncExternalStore(noop, recordable, () => false);
}

export function PushToTalk({ onText, onError, disabled = false, size = 64, label = "Hold to answer", onPhase }: {
  onText: (text: string) => void; onError: (message: string) => void; disabled?: boolean; size?: number; label?: string; onPhase?: (p: TalkPhase) => void;
}) {
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
    if (!clip) { setPhase("idle"); onError("Hold the button while you speak."); return; }
    const t = await transcribe(clip);
    setPhase("idle");
    if ("error" in t) onError(t.error); else onText(t.text);
  };

  return (
    <button type="button" disabled={disabled || phase === "transcribing"} aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); void begin(); }}
      onPointerUp={() => void end()} onPointerCancel={() => void end()} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); void begin(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); void end(); } }}
      style={{ width: size, height: size }}
      className={`calm relative grid shrink-0 touch-none select-none place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-mute ${phase === "listening" ? "bg-accent-hover" : "bg-accent hover:bg-accent-hover"}`}>
      {phase === "listening" ? <span aria-hidden className="listen absolute inset-0 rounded-full" /> : null}
      {phase === "listening" ? <Square size={Math.round(size / 3.2)} strokeWidth={2} fill="currentColor" /> : <Mic size={Math.round(size / 2.7)} strokeWidth={1.75} />}
    </button>
  );
}
