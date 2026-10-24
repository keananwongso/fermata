"use client";
// The question and answer behind every Ask the books surface (the panel on /ask and in the dashboard, and the
// overlay on the site pages): one question at a time, answered from the recording when it is a suggested question
// (or matches one), otherwise live through the rate limited public path when this build has a Convex URL.
import { useCallback, useEffect, useRef, useState } from "react";
import recording from "@/demo/ask.json";
import { api } from "../../../convex/_generated/api";
import { LIMITED, type AskAnswer } from "../../../convex/lib/ask";
import { PRESETS, matchPreset } from "../../../convex/lib/askPresets";
import { LIVE, liveClient, playUrl, speak, stopSpeaking, visitorId } from "./voice";
import type { OrbState } from "./orb";

type Recorded = { question: string; answer: AskAnswer; audio: string | null };
const REC = recording as unknown as { recordedAt: string | null; presets: Record<string, Recorded> };

// Suggestions four at a time, each set mixing the templates. Presets not listed here go at the end.
const ORDER = ["real-cash", "held-now", "auto-settling", "finz-why", "held-by-store", "finz-june", "school-fees", "approve-r9", "r8-learned", "held-channels", "rooms-by-month", "january-card"];
export const RECORDED = PRESETS.filter((p) => REC.presets[p.id]).sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
export const PER_SET = 4;
export const SETS = Math.max(1, Math.ceil(RECORDED.length / PER_SET));

export type Shown = { question: string; answer: AskAnswer; from: "recorded" | "live"; audio: string | null };

export function fromRecording(id: string): Shown | null {
  const r = REC.presets[id];
  return r ? { question: r.question, answer: r.answer, from: "recorded", audio: r.audio } : null;
}

// Suggested questions that are not the one on screen, for "ask next".
export function nextQuestions(current: string | null, n: number, skip: string[] = []) {
  const at = Math.max(0, RECORDED.findIndex((p) => p.question === current));
  const rest = [...RECORDED.slice(at + 1), ...RECORDED.slice(0, at)].filter((p) => p.question !== current && !skip.includes(p.question));
  return rest.slice(0, n);
}

export function useAsk() {
  const [phase, setPhase] = useState<OrbState>("idle");
  const [shown, setShown] = useState<Shown | null>(null);
  const [history, setHistory] = useState<Shown[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  // Each question gets a number; a live answer that comes back after a newer question is dropped.
  const turn = useRef(0);
  // Each playback gets a number, so a voice that ends after a newer one started leaves the phase alone.
  const voice = useRef(0);

  const play = useCallback((s: Shown) => {
    const mine = ++voice.current;
    setPhase("thinking");
    const done = () => { if (voice.current === mine) setPhase("idle"); };
    const started = s.audio ? playUrl(s.audio, done) : LIVE ? speak(s.answer.spoken, done) : Promise.resolve(false);
    void started.then((ok) => { if (voice.current === mine) setPhase(ok ? "speaking" : "idle"); });
  }, []);

  const stop = useCallback(() => { voice.current++; stopSpeaking(); setPhase("idle"); }, []);

  const show = useCallback((s: Shown, speakIt: boolean) => {
    setShown(s);
    setHistory((h) => [s, ...h.filter((x) => x.question !== s.question)].slice(0, 4));
    if (speakIt) play(s); else setPhase("idle");
  }, [play]);

  const ask = useCallback(async (question: string, speakIt = true) => {
    const q = question.trim();
    if (!q) return;
    const mine = ++turn.current;
    voice.current++;
    stopSpeaking();
    setNotice(null);
    const preset = matchPreset(q);
    const recorded = preset ? fromRecording(preset.id) : null;
    if (recorded) return show({ ...recorded, question: q === preset!.question ? recorded.question : q }, speakIt);
    setShown(null);
    const c = liveClient();
    if (!c) { setPhase("idle"); setNotice(LIMITED); return; }
    setPhase("thinking");
    try {
      const reply = await c.action(api.ask.ask, { question: q, visitor: visitorId() });
      if (mine !== turn.current) return;
      if (reply.kind === "answer") return show({ question: q, answer: reply.answer, from: "live", audio: null }, speakIt);
      if (reply.kind === "preset") { const r = fromRecording(reply.id); if (r) return show({ ...r, question: q }, speakIt); }
      setPhase("idle");
      setNotice(reply.kind === "limited" || reply.kind === "error" ? reply.message : LIMITED);
    } catch {
      if (mine !== turn.current) return;
      setPhase("idle");
      setNotice("The books could not be read just now. Try a suggested question.");
    }
  }, [show]);

  // A new question by voice starts: the old answer goes and nothing speaks over the person.
  const listening = useCallback(() => { turn.current++; voice.current++; stopSpeaking(); setNotice(null); setHeard(null); setShown(null); setPhase("listening"); }, []);
  const reset = useCallback(() => { stop(); setShown(null); setNotice(null); setHeard(null); }, [stop]);
  const recall = useCallback((s: Shown) => { stop(); setNotice(null); setShown(s); }, [stop]);

  useEffect(() => () => stopSpeaking(), []);

  return { phase, setPhase, shown, setShown, history, notice, setNotice, heard, setHeard, ask, play, stop, reset, recall, listening };
}
