// What-ifs for the console: generates a world from the knobs and runs the real engine over the year with and without
// learning, on this server. No Convex, no Claude, so it costs nothing; the hosted site does not serve it.
import { STORE_BY_CODE, type StoreCode } from "../../../../convex/lib/domain";
import { DEFAULT_MESS, LEARNING_DEFAULTS, generateWorld, learningMess, type LearningKnobs } from "../../../../convex/lib/generate";
import { SIM_NOTE, simulateYear } from "../../../../scripts/simulateYear";
import { PUBLIC_SITE } from "@/components/nav";

const num = (x: unknown, lo: number, hi: number): number | undefined => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined);
const month = (x: unknown) => { const m = num(x, 1, 12); return m === undefined ? undefined : Math.round(m); };

export async function POST(req: Request) {
  if (PUBLIC_SITE) return new Response("Not found", { status: 404 });
  const b: unknown = await req.json().catch(() => null);
  if (typeof b !== "object" || b === null) return Response.json({ error: "expected a JSON object" }, { status: 400 });
  const x = b as Record<string, unknown>;
  const k: LearningKnobs = {};
  if (num(x.seed, 1, 2 ** 31) !== undefined) k.seed = Math.round(x.seed as number);
  if (x.onboarding === null) k.onboarding = null;
  else if (num(x.onboarding, 0.3, 0.95) !== undefined) k.onboarding = x.onboarding as number;
  if (num(x.advance, 0, 1500) !== undefined) k.advance = Math.round(x.advance as number);
  if (x.reversals === null) k.cashReversals = null;
  else if (num(x.reversals, 1, 200) !== undefined) k.cashReversals = { ...LEARNING_DEFAULTS.cashReversals!, perMonth: Math.round(x.reversals as number) };
  if (num(x.late, 0, 0.3) !== undefined) k.late = x.late as number;
  if (num(x.schoolMoved, 0, 1000) !== undefined) k.schoolMoved = Math.round(x.schoolMoved as number);
  if (num(x.regionalFee, 0, 0.1) !== undefined) k.regionalFee = x.regionalFee as number;
  if (typeof x.oneOffs === "boolean") k.oneOffs = x.oneOffs;
  if (x.drift === null) k.drift = null;
  else if (typeof x.drift === "object") {
    const d = x.drift as Record<string, unknown>;
    const stores = Array.isArray(d.stores) ? d.stores.filter((s): s is StoreCode => typeof s === "string" && !!STORE_BY_CODE[s]) : [];
    const m = month(d.month), fee = num(d.creditFee, 0, 0.1);
    if (m === undefined || fee === undefined || !stores.length) return Response.json({ error: "drift needs a month, a credit fee and stores" }, { status: 400 });
    k.drift = { month: m, creditFee: fee, stores };
  }
  if (x.lender === null) k.lender = null;
  else if (typeof x.lender === "object") {
    const l = x.lender as Record<string, unknown>;
    const m = month(l.month), cut = num(l.cut, 0.001, 0.1), per = num(l.perMonth, 1, 1500);
    if (m === undefined || cut === undefined || per === undefined) return Response.json({ error: "lender needs a month, a cut and a volume" }, { status: 400 });
    k.lender = { month: m, cut, perMonth: Math.round(per) };
  }
  const learnAt: Record<string, number> = {};
  if (typeof x.learnAt === "object" && x.learnAt !== null)
    for (const [r, m] of Object.entries(x.learnAt)) if (["r3", "r8", "r9", "r10", "r11"].includes(r) && num(m, 1, 13) !== undefined) learnAt[r] = Math.round(m as number);
  const answers = num(x.answers, 1, 50);

  const config = x.preset === "default" ? DEFAULT_MESS : learningMess(k);
  const t0 = Date.now();
  const w = generateWorld(config);
  const genMs = Date.now() - t0;
  const learned = await simulateYear(w, { learn: true, learnAt, answersPerMonth: answers });
  const baseline = await simulateYear(w, { learn: false });
  return Response.json({ note: SIM_NOTE, config, genMs, learned, baseline });
}
