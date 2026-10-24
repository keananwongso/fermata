// Voice answers to a case room's question: which option did the person say, and did they say yes when it was read
// back. Plain word matching, deterministic and in the browser; nothing here calls a model.
import { normalise } from "./askPresets";

type Option = { id: string; label: string };
const STOP = new Set(["the", "a", "an", "is", "it", "its", "to", "of", "and", "or", "we", "our", "they", "them", "this", "that", "these", "for", "in", "on", "at", "as", "be", "by", "with", "i", "im", "so", "keep", "yet"]);
const YES = /\b(yes|yeah|yep|yup|correct|right|confirm|confirmed|affirmative|sure|do it|go ahead|thats right)\b/;
const NO = /\b(no|nope|nah|cancel|wrong|stop|dont|do not|not that)\b/;
const UNSURE = /\b(not sure|unsure|dont know|do not know|no idea|maybe|unknown)\b/;

const words = (s: string) => normalise(s).trim().split(" ").filter((w) => w && !STOP.has(w));

// The option the transcript names, or null when it is unclear (then the person is asked again).
export function matchOption<O extends Option>(transcript: string, options: O[]): O | null {
  const t = normalise(transcript);
  const has = (id: string) => options.find((o) => o.id === id) ?? null;
  // Yes / no / unsure questions: the short answers people actually say.
  if (has("yes") || has("no") || has("unsure")) {
    if (UNSURE.test(t) && has("unsure")) return has("unsure");
    const yes = YES.test(t), no = NO.test(t);
    if (yes && !no && has("yes")) return has("yes");
    if (no && !yes && has("no")) return has("no");
  }
  const said = new Set(words(transcript));
  let best: { o: O; score: number } | null = null;
  let tie = false;
  for (const o of options) {
    const score = words(`${o.label} ${o.id}`).filter((w) => said.has(w)).length;
    if (!score) continue;
    if (!best || score > best.score) { best = { o, score }; tie = false; }
    else if (score === best.score) tie = true;
  }
  return best && !tie ? best.o : null;
}

// After the answer is read back: "yes" sends it, "no" cancels, anything else asks again.
export function yesOrNo(transcript: string): "yes" | "no" | null {
  const t = normalise(transcript);
  const yes = YES.test(t), no = NO.test(t);
  return yes && !no ? "yes" : no && !yes ? "no" : null;
}
