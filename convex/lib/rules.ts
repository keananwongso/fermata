// Rules are small JSON programs. The engine interprets them; the Learner writes new ones.
import type { Channel } from "./domain";

export type MatchKind =
  | "card_batch" | "cash_deposit" | "marketplace_payout" | "gateway_settlement" | "open_invoices"
  | "lender_sale" | "school_receipt" | "school_cash" | "cancel_pair" | "bank_fee" | "follow_receipt";

export interface RuleProgram {
  id: string;
  version: number;
  title: string;
  channels: Channel[];
  match: MatchKind;
  params: {
    debitFee?: number; creditFee?: number; toleranceIdr?: number; feeIdr?: number; fee?: number;
    commission?: Record<string, number>; lenders?: Record<string, number>; windowDays?: number;
    lookbackDays?: number; maxInvoices?: number; receiptWeight?: number; subAccountWeight?: number;
    // Card fee changes by store, newest last; `from` is the first sale date it applies to (absent: always).
    cardFees?: { stores: string[]; from?: string; debitFee: number; creditFee: number }[];
  };
  limitIdr: number;
}

export const SEED_RULES: RuleProgram[] = [
  { id: "r1", version: 1, title: "Rp 2,500 bank fee inside a transfer", channels: ["dealer"], match: "bank_fee", params: { feeIdr: 2500 }, limitIdr: 2_000_000_000 },
  { id: "r2", version: 1, title: "Entry made and cancelled the same day: ignore both", channels: ["transfer_pair"], match: "cancel_pair", params: {}, limitIdr: 500_000_000 },
  { id: "r3", version: 1, title: "Store daily takings: card batch or cash deposit", channels: ["card", "cash"], match: "card_batch", params: { debitFee: 0.01, creditFee: 0.018, toleranceIdr: 5000 }, limitIdr: 500_000_000 },
  { id: "r4", version: 1, title: "Marketplace payout minus commission", channels: ["marketplace"], match: "marketplace_payout", params: { commission: { SHOPEE: 0.065, TOKOPEDIA: 0.06 } }, limitIdr: 2_000_000_000 },
  { id: "r5", version: 1, title: "Website settlement minus 2.9%", channels: ["website"], match: "gateway_settlement", params: { fee: 0.029 }, limitIdr: 1_000_000_000 },
  { id: "r6", version: 1, title: "A transfer pays open invoices (dealers, school fees)", channels: ["dealer", "school_va", "school_cash"], match: "open_invoices", params: { lookbackDays: 90, maxInvoices: 3 }, limitIdr: 2_000_000_000 },
  { id: "r7", version: 1, title: "Lender payout minus its cut", channels: ["lender"], match: "lender_sale", params: { lenders: { FIN_X: 0.03, FIN_Y: 0.045 }, windowDays: 7 }, limitIdr: 1_000_000_000 },
];

// Rules the Learner may add are checked against this before they reach the engine.
export function validateRuleProgram(x: unknown): { ok: true; rule: RuleProgram } | { ok: false; error: string } {
  if (typeof x !== "object" || x === null) return { ok: false, error: "not an object" };
  const r = x as Record<string, unknown>;
  const kinds: MatchKind[] = ["card_batch", "cash_deposit", "marketplace_payout", "gateway_settlement", "open_invoices", "lender_sale", "school_receipt", "school_cash", "cancel_pair", "bank_fee", "follow_receipt"];
  if (typeof r.id !== "string" || !/^r\d+$/.test(r.id)) return { ok: false, error: "id must look like r8" };
  if (typeof r.title !== "string" || r.title.length < 4) return { ok: false, error: "title missing" };
  if (!Array.isArray(r.channels) || r.channels.length === 0) return { ok: false, error: "channels missing" };
  if (typeof r.match !== "string" || !kinds.includes(r.match as MatchKind)) return { ok: false, error: "unknown match kind" };
  if (typeof r.limitIdr !== "number" || r.limitIdr <= 0) return { ok: false, error: "limitIdr must be positive" };
  if (typeof r.params !== "object" || r.params === null) return { ok: false, error: "params missing" };
  return { ok: true, rule: { id: r.id, version: typeof r.version === "number" ? r.version : 1, title: r.title, channels: r.channels as Channel[], match: r.match as MatchKind, params: r.params as RuleProgram["params"], limitIdr: r.limitIdr } };
}
