// Records the suggested questions for Ask the books, the way export_demo.ts records the demo: each preset runs
// through the real live path on Convex (Claude picks the query, code fills the template, the sentence is checked),
// and its spoken sentence is generated once with Cartesia. The hosted site serves these with no Claude call.
//   npx tsx --env-file=.env scripts/export_ask.ts            all presets
//   npx tsx --env-file=.env scripts/export_ask.ts held-now   only these ids
// Needs CONVEX_DEPLOY_KEY (or a logged-in `npx convex dev`) and CARTESIA_API_KEY. Writes src/demo/ask.json and public/ask/*.mp3.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Cartesia from "@cartesia/cartesia-js";
import { PRESETS } from "../convex/lib/askPresets";
import type { AskAnswer, Template } from "../convex/lib/ask";

const VOICE_ID = "630ed21c-2c5c-41cf-9d82-10a7fd668370";
// What each suggested question should come back as; a different template means the run went wrong, so it retries.
const EXPECT: Record<string, Template> = {
  "approve-r9": "story", "real-cash": "figure", "auto-settling": "trend", "held-by-store": "breakdown", "finz-june": "lines", "finz-why": "story",
  "school-fees": "story", "r8-learned": "story", "held-now": "figure", "held-channels": "breakdown", "rooms-by-month": "trend", "january-card": "lines",
};
type Recorded = { question: string; answer: AskAnswer; audio: string | null };

const OUT = "src/demo/ask.json";
const only = process.argv.slice(2);
const prev = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as { presets: Record<string, Recorded> }).presets : {};

function live(question: string): AskAnswer {
  const out = execFileSync("npx", ["convex", "run", "ask:answerForRecording", JSON.stringify({ question })], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out) as AskAnswer;
}

async function main() {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) throw new Error("CARTESIA_API_KEY is not set");
  const cartesia = new Cartesia({ apiKey: key });
  mkdirSync("public/ask", { recursive: true });
  const presets: Record<string, Recorded> = { ...prev };
  for (const p of PRESETS) {
    if (only.length && !only.includes(p.id)) continue;
    let a: AskAnswer | null = null;
    for (let tries = 0; tries < 3; tries++) {
      a = live(p.question);
      const ok = a.view?.template === EXPECT[p.id] && a.checked && (p.id !== "approve-r9" || !!a.refusal);
      if (ok) break;
      console.warn(`  ${p.id}: got ${a.view?.template ?? "no view"}${a.checked ? "" : ", unchecked sentence"}; trying again`);
    }
    // Small files: speech at 32 kbps.
    const res = await cartesia.tts.generate({
      model_id: "sonic-3.6", transcript: a!.spoken, voice: VOICE_ID, language: "en",
      output_format: { container: "mp3", sample_rate: 22050, bit_rate: 32000 }, generation_config: { speed: 1 },
    });
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(`public/ask/${p.id}.mp3`, bytes);
    presets[p.id] = { question: p.question, answer: { ...a!, rejected: [] }, audio: `/ask/${p.id}.mp3` };
    console.log(`${p.id}: ${a!.view?.template} via ${a!.query?.name} ${JSON.stringify(a!.query?.params ?? {})}, ${(bytes.length / 1024).toFixed(0)} KB audio\n  "${a!.spoken}"`);
  }
  const json = JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), presets });
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT}: ${(json.length / 1024).toFixed(0)} KB, ${Object.keys(presets).length} presets`);
}
main().catch((e) => { console.error(e); process.exit(1); });
