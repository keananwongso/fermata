"use client";
// Speech for Ask the books and for voice answers in a case room, through Cartesia's official SDK.
// The browser never holds the API key: Convex mints a one-minute access token (convex/ask.ts `token`), rate limited
// per visitor and capped per day. Speech out is TTS bytes (mp3) played in an <audio>; speech in is push to talk:
// the browser records while the button is held, then sends the clip to batch STT.
import Cartesia from "@cartesia/cartesia-js";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { canRecognize, recognize } from "./speech";
import { forSpeech } from "../../../convex/lib/speech";

export const VOICE_ID = "630ed21c-2c5c-41cf-9d82-10a7fd668370";
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
// Without a Convex URL (the hosted site today) there is no live answer and no Cartesia voice. Recorded audio still
// plays, and the browser's recognizer still turns a spoken question into words (`listen`).
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
// Bumped by every stop, so speech that finishes generating after a newer answer never plays over it.
let generation = 0;
export function stopSpeaking() {
  generation++;
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
  tapPlayer(player);
  try { await player.play(); return true; } catch { onEnd?.(); return false; }
}

// Where the answer's audio is, so a caption can reveal its words in time with it. Null when nothing is loaded.
export function playback(): { time: number; duration: number; playing: boolean } | null {
  if (!player || !playingUrl) return null;
  const d = player.duration;
  return { time: player.currentTime, duration: Number.isFinite(d) ? d : 0, playing: !player.paused && !player.ended };
}

// ---------------- levels, for the orb ----------------
// How loud the voice is right now, 0 to 1: the microphone while a question is being recorded, the answer while it
// plays. Read once per frame by the orb (orb.tsx). Analysis only: the microphone is never sent to the speakers.

let audioCtx: AudioContext | null = null;
let outAnalyser: AnalyserNode | null = null;
let micAnalyser: AnalyserNode | null = null;
let tapped: HTMLAudioElement | null = null;
const buf = new Float32Array(1024);

function context(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch { return null; }
}

// Routes the player through an analyser once. Only while the context is running: a media element routed through a
// suspended context goes silent, so without a running context the orb estimates the level instead.
function tapPlayer(el: HTMLAudioElement) {
  if (tapped === el) return;
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;
  try {
    const src = ctx.createMediaElementSource(el);
    outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 1024;
    src.connect(outAnalyser);
    outAnalyser.connect(ctx.destination);
    tapped = el;
  } catch { outAnalyser = null; }
}

function rms(an: AnalyserNode, gain: number): number {
  an.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.min(1, Math.sqrt(s / buf.length) * gain);
}

export function voiceLevel(): number {
  if (micAnalyser) return rms(micAnalyser, 9);
  if (player && playingUrl && !player.paused && !player.ended) {
    if (outAnalyser && tapped === player && audioCtx?.state === "running") return rms(outAnalyser, 5);
    // No analyser: a soft syllable-like pulse, so the orb still talks.
    const t = player.currentTime;
    return 0.35 + 0.3 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1));
  }
  return 0;
}

// Speak a sentence with the Fermata voice. Resolves once playback starts (true) or fails (false).
export async function speak(text: string, onEnd?: () => void): Promise<boolean> {
  stopSpeaking();
  const mine = generation;
  const t = await speechToken();
  if ("error" in t) { onEnd?.(); return false; }
  try {
    const client = new Cartesia({ token: t.token });
    const res = await client.tts.generate({
      model_id: "sonic-3.6", transcript: forSpeech(text), voice: VOICE_ID, language: "en",
      output_format: { container: "mp3", sample_rate: 24000, bit_rate: 64000 },
      generation_config: { speed: 1 },
    });
    const blob = await res.blob();
    if (mine !== generation) { onEnd?.(); return false; }
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
  // Made (or resumed) before the permission prompt, while the press still counts as a user gesture.
  const ctx = context();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = pickType();
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  const started = performance.now();
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  // A level for the orb while it listens. Not connected to any output.
  let source: MediaStreamAudioSourceNode | null = null;
  if (ctx) {
    try {
      source = ctx.createMediaStreamSource(stream);
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 1024;
      source.connect(micAnalyser);
    } catch { micAnalyser = null; }
  }
  const release = () => { source?.disconnect(); micAnalyser = null; stream.getTracks().forEach((t) => t.stop()); };
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

// ---------------- one pipeline for every hold to talk control ----------------
// The orb, the overlay's shortcut and the case room's round button all listen through `listen`: the microphone
// recorder (for Cartesia when the live service is there, and for the orb's level) and the browser's recognizer (for
// the words while the person speaks, and the transcript when there is no live service). Either one is enough.

export function canListen(): boolean {
  return (LIVE && canRecord()) || canRecognize();
}

export type Listening = { stop: () => Promise<{ text: string } | { error: string }>; cancel: () => void };

export async function listen(onWords?: (text: string) => void): Promise<Listening> {
  let rec: Recording | null = null;
  if (canRecord()) {
    try { rec = await startRecording(); }
    // Without the live service the recorder only drives the orb, so the recognizer can carry on alone.
    catch (e) { if (LIVE || !canRecognize()) throw e; }
  }
  const words = recognize((t) => onWords?.(t));
  if (!rec && !words) throw new Error("No voice input in this browser.");
  return {
    stop: async () => {
      const [heard, clip] = await Promise.all([words ? words.stop() : Promise.resolve(""), rec ? rec.stop() : Promise.resolve(null)]);
      if (LIVE && clip) {
        const t = await transcribe(clip);
        return "text" in t || !heard ? t : { text: heard };
      }
      if (heard) return { text: heard };
      // Too short to be speech: a tap, not a question.
      return rec && !clip ? { error: "Hold while you speak, then let go." } : { error: "I didn't catch that. Hold and try again, or type it." };
    },
    cancel: () => { words?.abort(); rec?.cancel(); },
  };
}

// ---------------- earcons ----------------
// A rising blip when listening starts and a falling note when the question is taken. Synthesised on the spot and
// faded in and out, so neither end clicks. Without audio the orb and the card still show it.

function note(ctx: AudioContext, at: number, from: number, to: number, ms: number, gain: number) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + ms / 1000);
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(gain, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + ms / 1000 + 0.02);
}

export function blipIn() {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  note(ctx, t, 620, 660, 70, 0.06);
  note(ctx, t + 0.065, 880, 940, 90, 0.06);
}

export function blipOut() {
  const ctx = context();
  if (!ctx) return;
  note(ctx, ctx.currentTime + 0.005, 900, 700, 110, 0.05);
}
