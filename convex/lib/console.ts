// The console's key. Every public function that writes to the books, starts a run or calls Claude takes it as an
// argument and checks it against CONSOLE_KEY on the deployment. The local console sends it from
// NEXT_PUBLIC_FERMATA_CONSOLE_KEY in .env.local; the hosted site never has it, so a public Convex URL cannot be used to
// start a close or answer as the CFO. Reads stay public: the data is synthetic.
import { ConvexError, v } from "convex/values";

export const consoleKey = v.optional(v.string());
export const CONSOLE_REFUSAL = "This needs the console key. The console runs on your own machine.";

// Constant time compare, so the key cannot be guessed one character at a time from response times.
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Fails closed: with no CONSOLE_KEY on the deployment, nothing passes.
export function isConsole(key: string | undefined): boolean {
  const expected = process.env.CONSOLE_KEY;
  return !!expected && !!key && same(key, expected);
}

export function requireConsole(key: string | undefined): void {
  if (!isConsole(key)) throw new ConvexError(CONSOLE_REFUSAL);
}
