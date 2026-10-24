"use client";
// Hold to talk: press (or hold Space or Enter), speak, let go. Hands the transcript to `onText`.
// `usePushToTalk` is the behaviour, so any control can be the button (the orb in Ask the books, the overlay's
// shortcut); `PushToTalk` is the plain round button the case room's voice answers use. All of them listen through
// one pipeline, `listen` in voice.ts.
import { useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes } from "react";
import { Mic, Square } from "lucide-react";
import { blipIn, blipOut, canListen, listen, stopSpeaking, type Listening } from "./voice";

export type TalkPhase = "idle" | "listening" | "transcribing";
const noop = () => () => {};
const listenable = () => { try { return canListen(); } catch { return false; } };

// True where this browser can take a spoken question: the live service's recorder, or the browser's recognizer.
export function useVoiceInput() {
  return useSyncExternalStore(noop, listenable, () => false);
}

type Talk = {
  onText: (text: string) => void; onError: (message: string) => void; disabled?: boolean; onPhase?: (p: TalkPhase) => void;
  // The words so far, while the person is still speaking (when the browser can recognise speech).
  onWords?: (text: string) => void;
  // A rising blip on press and a falling one on release (the overlay and the orb; the case room stays quiet).
  blips?: boolean;
};

// The pointer and key handlers for a hold to talk control, its phase, and `begin`/`end` for other triggers (a shortcut).
export function usePushToTalk({ onText, onError, disabled = false, onPhase, onWords, blips = false }: Talk) {
  const [phase, setPhaseState] = useState<TalkPhase>("idle");
  const rec = useRef<Listening | null>(null);
  const holding = useRef(false);
  const latest = useRef({ onText, onError, onPhase, onWords, disabled, blips, phase });
  useEffect(() => { latest.current = { onText, onError, onPhase, onWords, disabled, blips, phase }; });
  const setPhase = (p: TalkPhase) => { setPhaseState(p); latest.current.onPhase?.(p); };
  useEffect(() => () => rec.current?.cancel(), []);

  const begin = async () => {
    const l = latest.current;
    if (l.disabled || holding.current || l.phase !== "idle") return;
    holding.current = true;
    stopSpeaking();
    if (l.blips) blipIn();
    try {
      const r = await listen((t) => latest.current.onWords?.(t));
      if (!holding.current) { r.cancel(); return; }
      rec.current = r;
      setPhase("listening");
    } catch {
      holding.current = false;
      latest.current.onError("The microphone is blocked. Allow it in the browser, or type instead.");
    }
  };
  const end = async () => {
    if (!holding.current) return;
    holding.current = false;
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    if (latest.current.blips) blipOut();
    setPhase("transcribing");
    const t = await r.stop();
    setPhase("idle");
    if ("error" in t) latest.current.onError(t.error); else latest.current.onText(t.text);
  };

  // Let go without asking (a tap of the shortcut, or the popup closing while it listens).
  const cancel = () => {
    const was = holding.current || !!rec.current;
    holding.current = false;
    rec.current?.cancel();
    rec.current = null;
    if (was) setPhase("idle");
  };

  const props: ButtonHTMLAttributes<HTMLButtonElement> = {
    type: "button",
    disabled: disabled || phase === "transcribing",
    onPointerDown: (e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); void begin(); },
    onPointerUp: () => void end(),
    onPointerCancel: () => void end(),
    onContextMenu: (e) => e.preventDefault(),
    // Every Space or Enter is kept from the page, held repeats included, so holding Space on the control never scrolls.
    onKeyDown: (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) void begin(); } },
    onKeyUp: (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); void end(); } },
  };
  return { phase, props, begin, end, cancel };
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
