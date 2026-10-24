// The suggested questions for Ask the books, and the matcher that routes a typed or spoken question to one of them.
// A matched question is answered from the recording (src/demo/ask.json, written by scripts/export_ask.ts) with no
// Claude call at all. The matcher is plain keyword matching on normalised words, so it is cheap and deterministic.

export type Preset = {
  id: string;
  question: string;
  // Each pattern is a list of word groups; a pattern matches when every group has a word in the question.
  // A term matches a word that starts with it ("store" matches "stores"); "=term" must match the whole word;
  // a term with a space matches that phrase.
  patterns: string[][][];
  // Any of these words means the question is about something else.
  forbid?: string[];
};

const MONTH_WORDS = ["january", "february", "march", "april", "=may", "june", "july", "august", "september", "october", "november", "december"];

export const PRESETS: Preset[] = [
  {
    id: "approve-r9", question: "Approve r9 for me",
    patterns: [[["=approve", "=post", "=delete", "=edit", "=change", "=mark", "=override", "=settle", "=unblock", "=book"], ["r9", "r8", "rule", "finz", "payout", "story", "line", "=it", "=this", "=that"]]],
    forbid: ["why", "who", "when", "how", "what", "which", "did"],
  },
  {
    id: "real-cash", question: "What's our real cash?",
    patterns: [[["cash", "money"], ["real", "actual", "really", "true", "much", "have", "our", "total", "position", "bank"]]],
    forbid: ["held", "hold", "deposit", "store", "month", "line", "show"],
  },
  {
    id: "auto-settling", question: "How has auto settling changed?",
    patterns: [
      [["auto", "first pass", "on its own", "automatic"], ["chang", "trend", "over", "improv", "grow", "climb", "time", "went", "go up", "evolv", "progress"]],
      [["settl", "match"], ["chang", "trend", "over time", "improv", "climb", "grow"]],
    ],
    // A month named means one month's figure, not the year's trend.
    forbid: ["store", "finz", "school", "show", "list", "held", "hold", "most", ...MONTH_WORDS],
  },
  {
    id: "held-by-store", question: "Which stores have the most held?",
    patterns: [[["held", "hold", "stuck"], ["store", "shop", "branch"]]],
    forbid: ["show", "list", "finz", "school", "why", "card"],
  },
  {
    id: "finz-june", question: "Show June's FIN_Z payouts",
    patterns: [[["finz"], ["june", "jun"]], [["finz"], ["show", "list", "line", "payout", "transaction", "see"]]],
    forbid: ["why", "explain", "what happen", "approve"],
  },
  {
    id: "finz-why", question: "Why was FIN_Z held?",
    patterns: [[["finz"], ["why", "what happen", "held", "hold", "story", "explain", "who", "case", "room", "decid"]]],
    forbid: ["show", "list", "june", "approve", "=post"],
  },
  {
    id: "school-fees", question: "Why did school fees go to the wrong store?",
    patterns: [[["school", "fee", "student", "virtual account"], ["wrong", "store", "why", "conflict", "place", "held", "hold", "explain", "what happen"]]],
    forbid: ["r8", "rule", "learn"],
  },
  {
    id: "r8-learned", question: "What did r8 learn?",
    patterns: [[["r8"]], [["rule"], ["march", "school", "receipt"]]],
    forbid: ["approve", "=post", "=delete", "=change"],
  },
  {
    id: "held-now", question: "How much is still held?",
    patterns: [[["held", "hold"], ["much", "total", "how many", "still", "left", "remain", "year end", "now", "open"]]],
    forbid: ["store", "channel", "finz", "school", "card", "show", "which", "why", "month", "list"],
  },
  {
    id: "held-channels", question: "Which channels were held most this year?",
    patterns: [[["held", "hold", "stories", "story", "case"], ["channel", "kind", "type", "source", "where from"]]],
    forbid: ["store", "show", "list", "finz"],
  },
  {
    id: "rooms-by-month", question: "How many case rooms met each month?",
    patterns: [[["room", "meeting", "case room", "met"], ["month", "each", "per", "over", "trend", "how many"]]],
    forbid: ["finz", "school", "store"],
  },
  {
    id: "january-card", question: "Show January's held card lines",
    patterns: [[["card"], ["jan"], ["held", "hold", "line", "show"]]],
    forbid: ["why"],
  },
];

const NUMBER_WORDS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };

// Lower case, apostrophes and punctuation gone, and the ways a lender or a rule id comes out of speech folded together.
export function normalise(q: string): string {
  let s = ` ${q.toLowerCase().replace(/['’]s\b/g, "").replace(/['’]/g, "")} `;
  s = s.replace(/[^a-z0-9_]+/g, " ");
  s = s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g, (w) => NUMBER_WORDS[w]);
  s = s.replace(/\bfin\s*_?\s*(z|zed|zee)\b/g, "finz").replace(/\bfin_z\b/g, "finz").replace(/\bfinzee\b/g, "finz");
  s = s.replace(/\b(?:r|are|our|rule)\s+(\d{1,2})\b/g, "r$1");
  return ` ${s.replace(/\s+/g, " ").trim()} `;
}

function termHits(norm: string, words: string[], term: string): boolean {
  if (term.startsWith("=")) return words.includes(term.slice(1));
  if (term.includes(" ")) return norm.includes(` ${term} `) || norm.includes(` ${term}`);
  return words.some((w) => w.startsWith(term));
}

// The best preset for a question, or null. Among presets whose pattern matches, the one with more groups wins;
// a tie goes to the earlier preset.
export function matchPreset(question: string, presets: Preset[] = PRESETS): Preset | null {
  const norm = normalise(question);
  const words = norm.trim().split(" ").filter(Boolean);
  if (!words.length) return null;
  let best: { p: Preset; score: number } | null = null;
  for (const p of presets) {
    if (p.forbid?.some((t) => termHits(norm, words, t))) continue;
    for (const groups of p.patterns) {
      if (!groups.every((g) => g.some((t) => termHits(norm, words, t)))) continue;
      if (!best || groups.length > best.score) best = { p, score: groups.length };
    }
  }
  return best?.p ?? null;
}
