"use client";
// The spoken sentence as a caption that follows the voice. Every word is laid out from the start (faint), so the line
// never reflows; each one darkens as it is said. Cartesia's mp3 carries no word timings, so the timings are estimated
// from each word's length in syllables and stretched over the audio's real duration, which keeps them close enough
// to read along. Not live (finished, or never played): the whole sentence, plainly.
//
// The visible caption is aria-hidden; the sentence is announced once, whole, by the panel's aria-live region.
import { useEffect, useMemo, useState } from "react";
import { playback } from "./voice";

// Rough spoken length of a word. Figures are said longer than they are written ("Rp 54.0bn" is
// "rupiah fifty four point zero billion"), so digits, units and signs count for more.
function weight(word: string): number {
  const w = word.toLowerCase();
  let n = 0;
  if (/\d/.test(w)) {
    n += (w.match(/\d/g) ?? []).length * 1.6 + (w.match(/[.,]/g) ?? []).length * 0.6;
    if (/bn$/.test(w)) n += 2; else if (/m$/.test(w)) n += 2;
    if (/%/.test(w)) n += 2;
  } else if (w === "rp") n = 3;
  else n = Math.max(1, (w.replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g) ?? []).length);
  if (/_/.test(w)) n += 1;
  // A pause after punctuation.
  if (/[.!?]$/.test(w)) n += 1.6; else if (/[,;:]$/.test(w)) n += 0.8;
  return n + 0.35;
}

const LEAD = 0.15, TAIL = 0.35;

export function SpokenCaption({ text, live, className = "" }: { text: string; live: boolean; className?: string }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  // Where each word starts, as a share of the speech.
  const starts = useMemo(() => {
    const ws = words.map(weight), total = ws.reduce((a, b) => a + b, 0) || 1;
    const out: number[] = [];
    for (let i = 0, acc = 0; i < ws.length; acc += ws[i], i++) out.push(acc / total);
    return out;
  }, [words]);
  const [at, setAt] = useState(-1);

  useEffect(() => {
    if (!live) return;
    let raf = 0, shown = -2;
    const loop = () => {
      const p = playback();
      let i = -1;
      if (p && p.duration > 0) {
        const span = Math.max(0.5, p.duration - LEAD - TAIL), k = (p.time - LEAD) / span;
        for (let j = 0; j < starts.length; j++) if (k >= starts[j] - 0.005) i = j;
        if (!p.playing && p.time >= p.duration - 0.05) i = words.length - 1;
      }
      if (i !== shown) { shown = i; setAt(i); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live, starts, words.length]);

  const upTo = live ? at : words.length - 1;
  return (
    <p aria-hidden className={className}>
      {words.map((w, i) => (
        <span key={i} className={`transition-[opacity,color] duration-200 ${i <= upTo ? "opacity-100" : "opacity-20"} ${live && i === upTo ? "text-accent" : ""}`}>
          {w}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
