"use client";
// The browser's own speech recognition, for two jobs in hold to talk: the words appear while the person is still
// speaking, and where there is no live service (the hosted site) they are the transcript, so a spoken suggested
// question is still answered from the recording. Cartesia's transcript wins whenever the live service has one.
// In Chrome the browser vendor processes the audio; nothing here is sent to Fermata's backend.

type Result = ArrayLike<{ transcript: string }> & { isFinal: boolean };
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function ctor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canRecognize = () => ctor() !== null;

export type Recognition = { stop: () => Promise<string>; abort: () => void };

// Starts listening; `onWords` hears the transcript so far each time it changes. stop() resolves with the final words.
export function recognize(onWords: (text: string) => void): Recognition | null {
  const Ctor = ctor();
  if (!Ctor) return null;
  const rec = new Ctor();
  // English, whatever the system language: the books and the presets are in English.
  rec.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  let text = "";
  rec.onresult = (e) => {
    // Results are cumulative and may revise earlier ones, so rebuild rather than append.
    text = Array.from(e.results, (r) => r[0].transcript.trim()).filter(Boolean).join(" ");
    onWords(text);
  };
  rec.onerror = () => {};
  let ended: () => void = () => {};
  const done = new Promise<void>((resolve) => { ended = resolve; });
  rec.onend = () => ended();
  try { rec.start(); } catch { return null; }
  return {
    stop: async () => {
      try { rec.stop(); } catch { /* already stopped */ }
      await Promise.race([done, new Promise((r) => setTimeout(r, 1500))]);
      return text.trim();
    },
    abort: () => { try { rec.abort(); } catch { /* already stopped */ } },
  };
}
