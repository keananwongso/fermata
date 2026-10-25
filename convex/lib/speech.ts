// Text for the voice, not the screen. The caption keeps "Rp 358m"; the voice must say "358 million rupiah", or a
// text-to-speech model reads it as "R P 358 meters". Used for live answers (src/components/ask/voice.ts) and for the
// recorded ones (scripts/export_ask.ts).
const UNIT: Record<string, string> = { bn: "billion", b: "billion", m: "million", k: "thousand" };

export function forSpeech(text: string): string {
  return text.replace(/(?:([−-])\s?)?\bRp\s?(\d[\d.,]*)\s?(bn|b|m|k)?\b/gi, (_all, minus: string | undefined, n: string, unit: string | undefined) => {
    const word = unit ? ` ${UNIT[unit.toLowerCase()]}` : "";
    return `${minus ? "minus " : ""}${n}${word} rupiah`;
  });
}
