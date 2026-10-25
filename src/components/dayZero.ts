// Day 0: what Fermata learned from last year's books before closing a single month (learner.deriveSeedRules). One
// paginated pass over last year's matched lines, accumulating per shape, then each shape's parameters fitted and
// written as a rule program r1 to r7. Shared by the pitch's How it learns slide and the dashboard's Rules view, so both
// tell it the same way. The fit itself is read from each rule's program in the recording; only the wording is here.
import { PLATFORM_LABEL } from "../../convex/lib/domain";
import { num, pct, rp } from "../../convex/lib/format";

export type Seen = { count: number; scope: string };
type Params = Record<string, unknown>;
type Program = { match?: string; params?: Params };

// How many of last year's lines each onboarding rule was fitted on, and over what. Read from the rules table of the
// Convex deployment the recording was exported from (`rules.seen`, written by deriveSeedRules). The recording predates
// scripts/export_demo.ts carrying `seen`, so these stand in until the next export brings them; a rule's own `seen`
// always wins.
const SEEN_AT_EXPORT: Record<string, Seen> = {
  r1: { count: 183, scope: "sample month (Oct last year)" },
  r2: { count: 80, scope: "sample month (Oct last year), pairs" },
  r3: { count: 5472, scope: "sample month (Oct last year)" },
  r4: { count: 126, scope: "sample month (Oct last year)" },
  r5: { count: 70, scope: "sample month (Oct last year)" },
  r6: { count: 485, scope: "sample month (Oct last year), dealers" },
  r7: { count: 3378, scope: "all of last year" },
};
export const seenOf = (r: { id: string; seen?: Seen | null }): Seen | null => r.seen ?? SEEN_AT_EXPORT[r.id] ?? null;

// What Fermata asked of the old books for each shape, and the belief it came back with, in one line for the slide.
export const DAY_ZERO: Record<string, { question: string; policy: string }> = {
  r1: { question: "How were dealer transfers that arrived exactly Rp 2,500 short booked?", policy: "Bank fee inside a dealer transfer" },
  r2: { question: "Which entries were made and cancelled on the same day?", policy: "Made and cancelled the same day" },
  r3: { question: "What fee explains each store's card batch against that day's debit and credit sales?", policy: "Store takings: card batch or cash" },
  r4: { question: "What commission did each marketplace keep from its payouts, after refunds?", policy: "Marketplace payout minus commission" },
  r5: { question: "What fee did the payment gateway keep from each website settlement?", policy: "Website settlement minus its fee" },
  r6: { question: "Which dealer transfers paid open invoices, and how many at once?", policy: "A transfer pays open invoices" },
  r7: { question: "What cut did each lender keep, over payouts that match exactly one sale?", policy: "Lender payout minus its cut" },
};

const rates = (x: unknown) => Object.values((x ?? {}) as Record<string, number>);
const named = (x: unknown, label: (k: string) => string) => Object.entries((x ?? {}) as Record<string, number>).map(([k, v]) => `${label(k)} ${pct(v)}`).join(", ");

// The fitted number, short, for the slide: the value a cluster's fit settles on. `values` converge; `text` frames them.
export function fitFigure(p: Program): { values: number[]; text: (v: number[]) => string } {
  const q = p.params ?? {};
  switch (p.match) {
    case "bank_fee": return { values: [Number(q.feeIdr ?? 0)], text: ([v]) => num(v) };
    case "cancel_pair": return { values: [0], text: ([v]) => `net ${num(v)}` };
    case "card_batch": return { values: [Number(q.debitFee ?? 0), Number(q.creditFee ?? 0)], text: (v) => v.map((x) => pct(x, 1)).join(" · ") };
    case "marketplace_payout": case "lender_sale": {
      const vs = rates(p.match === "lender_sale" ? q.lenders : q.commission);
      return { values: vs, text: (v) => v.map((x) => (x * 100).toFixed(1) + "%").join(" · ") };
    }
    case "gateway_settlement": return { values: [Number(q.fee ?? 0)], text: ([v]) => pct(v, 1) };
    case "open_invoices": return { values: [Number(q.maxInvoices ?? 0)], text: ([v]) => `≤${num(v)} invoices` };
    default: return { values: [], text: () => "" };
  }
}

// The fit in one sentence, for the dashboard: how the parameters came out of last year's rows.
export function fitSentence(p: Program): string {
  const q = p.params ?? {};
  switch (p.match) {
    case "bank_fee": return `Counted dealer transfers that came in exactly ${rp(Number(q.feeIdr))} short of their invoices: a fixed bank fee of ${rp(Number(q.feeIdr))}.`;
    case "cancel_pair": return "Counted reversal pairs: an entry and its reversal on the same day net to zero, so both are ignored.";
    case "card_batch": return `Least squares over the month's card batches against each day's debit and credit sales: debit ${pct(Number(q.debitFee))}, credit ${pct(Number(q.creditFee))}, within ${rp(Number(q.toleranceIdr))}. Cash deposits that matched the day's takings are counted too.`;
    case "marketplace_payout": return `Mean of one minus (payout plus refunds) over gross, per platform: ${named(q.commission, (k) => PLATFORM_LABEL[k as keyof typeof PLATFORM_LABEL] ?? k)}.`;
    case "gateway_settlement": return `Mean fee over the month's website settlements against the gateway's gross: ${pct(Number(q.fee))}.`;
    case "open_invoices": return `Counted dealer transfers whose invoices add up exactly; the rule looks back ${num(Number(q.lookbackDays))} days, up to ${num(Number(q.maxInvoices))} invoices.`;
    case "lender_sale": return `Mean implied cut over payouts that match exactly one sale in the week before: ${named(q.lenders, (k) => k)}.`;
    default: return "Fitted on last year's rows.";
  }
}
