"use client";
// Speech for Ask the books and for voice answers in a case room, through Cartesia's official SDK.
// The browser never holds the API key: Convex mints a one-minute access token (convex/ask.ts `token`), rate limited
// per visitor and capped per day. Speech out is TTS bytes (mp3) played in an <audio>; speech in is push to talk:
// the browser records while the button is held, then sends the clip to batch STT.
import Cartesia from "@cartesia/cartesia-js";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

export const VOICE_ID = "630ed21c-2c5c-41cf-9d82-10a7fd668370";
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
// Without a Convex URL (the hosted site today) there is no live answer and no voice input; recorded audio still plays.
export const LIVE = !!url;
let convex: ConvexHttpClient | null = null;
export function liveClient(): ConvexHttpClient | null {
  if (!url) return null;
  convex ??= new ConvexHttpClient(url);
  return convex;
}

// A random id for this browser, so the per-visitor limits have something to count. Storage can be blocked, so a
// failure falls back to an id for this page load.
let memoryVisitor: string | null = null;
export function visitorId(): string {
  const make = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  try {
    const have = window.localStorage.getItem("fermata.visitor");
    if (have) return have;
    const id = make();
    window.localStorage.setItem("fermata.visitor", id);
    return id;
  } catch {
    memoryVisitor ??= make();
    return memoryVisitor;
  }
}

let cached: { token: string; until: number } | null = null;
export async function speechToken(): Promise<{ token: string } | { error: string }> {
  if (cached && cached.until > Date.now() + 5000) return { token: cached.token };
  const c = liveClient();
  if (!c) return { error: "Voice needs the live service." };
  const r = await c.action(api.ask.token, { visitor: visitorId() });
  if (r.kind !== "token") return { error: r.message };
  cached = { token: r.token, until: Date.now() + r.expiresIn * 1000 };
  return { token: r.token };
}

// One player for the whole page, so a new answer stops the one before it.
let player: HTMLAudioElement | null = null;
let playingUrl: string | null = null;
export function stopSpeaking() {
  player?.pause();
  if (playingUrl?.startsWith("blob:")) URL.revokeObjectURL(playingUrl);
  playingUrl = null;
}

export async function playUrl(src: string, onEnd?: () => void): Promise<boolean> {
  stopSpeaking();
  player ??= new Audio();
  player.src = src;
  playingUrl = src;
  player.onended = () => onEnd?.();
  try { await player.play(); return true; } catch { onEnd?.(); return false; }
}

// Speak a sentence with the Fermata voice. Resolves once playback starts (true) or fails (false).
export async function speak(text: string, onEnd?: () => void): Promise<boolean> {
  const t = await speechToken();
  if ("error" in t) { onEnd?.(); return false; }
  try {
    const client = new Cartesia({ token: t.token });
    const res = await client.tts.generate({
      model_id: "sonic-3.6", transcript: text, voice: VOICE_ID, language: "en",
      output_format: { container: "mp3", sample_rate: 24000, bit_rate: 64000 },
      generation_config: { speed: 1 },
    });
    const blob = await res.blob();
    return await playUrl(URL.createObjectURL(blob), onEnd);
  } catch {
    onEnd?.();
    return false;
  }
}

// ---------------- push to talk ----------------

export type Recording = { stop: () => Promise<Blob | null>; cancel: () => void };

export function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickType(): string | undefined {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return undefined;
}

// Starts recording from the microphone. stop() resolves with the clip, or null if it was too short to be speech.
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = pickType();
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  const started = performance.now();
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise((resolve) => {
      const finish = () => {
        release();
        resolve(performance.now() - started < 350 || !chunks.length ? null : new Blob(chunks, { type: rec.mimeType || type || "audio/webm" }));
      };
      if (rec.state === "inactive") finish();
      else { rec.onstop = finish; rec.stop(); }
    }),
    cancel: () => { rec.onstop = null; if (rec.state !== "inactive") rec.stop(); release(); },
  };
}

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };

// Batch STT on the recorded clip (ink-whisper, English).
export async function transcribe(clip: Blob): Promise<{ text: string } | { error: string }> {
  const t = await speechToken();
  if ("error" in t) return t;
  try {
    const client = new Cartesia({ token: t.token });
    const ext = EXT[clip.type.split(";")[0]] ?? "webm";
    const file = new File([clip], `question.${ext}`, { type: clip.type });
    const r = await client.stt.transcribe({ file, model: "ink-whisper", language: "en" });
    const text = (r.text ?? "").trim();
    return text ? { text } : { error: "I didn't catch that. Hold the button and try again, or type it." };
  } catch {
    return { error: "Voice input failed. Type your question instead." };
  }
}
