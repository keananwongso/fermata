// Scripted meeting content: used for rooms that do not meet live, and as the fallback when Claude is unavailable.
// Every line here is labelled "scripted" in the trace.
import { STORE_BY_CODE } from "./domain";
import { rp, rpShort, num } from "./format";
import type { Doc } from "../_generated/dataModel";
import type { Role } from "./transition";

export interface QuestionDraft {
  askOf: Role;
  text: string;
  options: { id: string; label: string; impact: string }[];
  summary: string;
  hypothesis: string;
  trace: string[];
  auditor: string;
}

const storeName = (s: string | null) => (s ? STORE_BY_CODE[s]?.name ?? s : "no store");

export function draftQuestion(s: Doc<"stories">): QuestionDraft {
  const n = num(s.count);
  const amt = rpShort(s.amount);
  const at = storeName(s.store);
  switch (s.gap) {
    case "placement_conflict":
      return {
        askOf: "accountant",
        text: `${n} school fees (${amt}) were paid into ${at}'s virtual accounts, but the school's receipts put these students at Store 11. Which store should they be booked to?`,
        options: [
          { id: "receipts", label: "Store 11, follow the school's receipts", impact: `Books ${n} fees (${amt}) to Store 11. Fermata will propose a rule so future cases settle on their own.` },
          { id: "bank", label: `${at}, follow the bank`, impact: `Books ${n} fees to ${at}. Store 11's receipts stay open.` },
          { id: "unsure", label: "I don't know", impact: "Keeps all of them held and asks the CFO." },
        ],
        summary: `Every one of these payments names a ${at} virtual account. For each, a school receipt with the same student and the same amount exists, but at Store 11. No ${at} receipt exists for any of them. The receipts for January and February were entered on 3 Mar, when the term opened.`,
        hypothesis: "The students moved to Store 11's classes but kept paying into their old virtual accounts.",
        trace: [
          `read ${n} held lines with the same gap: bank sub account and school receipt disagree`,
          `query school_receipts by student: ${n} of ${n} found at Store 11, 0 at ${at}`,
          "amounts match to the rupiah in every case",
          "January and February receipts recorded on 3 Mar: they were waiting, not missing",
          "decision: the receipts look right, but placement is the Accountant's call. Ask the Accountant, one question.",
        ],
        auditor: "Checked whether any of these students also pay at Store 3. None do. Agree the question is the right one.",
      };
    case "petty_cash_retained":
      return {
        askOf: "accountant",
        text: `${n} cash deposits at ${s.stores.length} stores (${amt}) are short of the day's cash by exactly what each store recorded as petty cash kept. Is that cash still in the stores?`,
        options: [
          { id: "petty", label: "Yes, it is petty cash still in the store", impact: `Settles ${n} deposits and records the petty cash held at each store. Not a shortfall.` },
          { id: "short", label: "No, treat it as a shortfall", impact: `Keeps ${n} deposits held and opens a cash count at ${s.stores.length} stores.` },
          { id: "unsure", label: "I don't know", impact: "Keeps them held and asks the CFO." },
        ],
        summary: `Each deposit is short, and in every case the gap equals the petty cash the store wrote in its cash book that day, to the rupiah.`,
        hypothesis: "Stores kept part of the cash as petty cash after partial deposits. The money has not gone missing.",
        trace: ["read held cash deposits short of the cash book", `the gap equals pettyCashKept in ${n} of ${n}`, "no store is short beyond its petty cash", "ask the Accountant to confirm the cash is still on hand"],
        auditor: "Looked for deposits where the gap is close to, but not exactly, petty cash. Found none.",
      };
    case "no_store_record":
      return {
        askOf: "accountant",
        text: `${n} cash deposits (${amt}) arrived at a teller in Surabaya with no deposit slip, and no store recorded cash that matches them. Are these ours?`,
        options: [
          { id: "not_ours", label: "No, not ours", impact: `Keeps all ${n} held. They are never booked as income.` },
          { id: "ours", label: "Yes, find the store", impact: "Keeps them held and asks each store manager to check." },
          { id: "unsure", label: "I don't know", impact: "Keeps them held and asks the CFO." },
        ],
        summary: "No slip number, no store cash day that adds up to any of them, and none matches a weekend combination either.",
        hypothesis: "Money deposited into our account by mistake, or belonging to someone else.",
        trace: ["no slip in the memo, so no sub account evidence", "tried every store's cash days for the matching weekday: no match", "ask the Accountant before anything is booked"],
        auditor: "Agree. Booking these as sales would overstate income.",
      };
    case "unknown_lender":
      return {
        askOf: "cfo",
        text: `Is ${s.counterparty} a new financing partner?`,
        options: [
          { id: "yes", label: "Yes", impact: `Writes a rule for ${s.counterparty} and settles the payouts it explains. The rest stay held.` },
          { id: "no", label: "No, not ours", impact: `Keeps all ${n} held.` },
          { id: "unsure", label: "I don't know", impact: `Keeps all ${n} held and asks the Accountant to check contracts.` },
        ],
        summary: `${n} payouts (${amt}) from ${s.counterparty}, a lender no approved rule knows.`,
        hypothesis: `${s.counterparty} may be a new financing partner.`,
        trace: [`read ${n} held payouts from ${s.counterparty}`, "the lender is not in any approved rule", "a new lender is a business relationship, so ask the CFO"],
        auditor: "A new lender is a business question, not a bookkeeping one. Agree the CFO should be asked.",
      };
    default:
      return smallQuestion(s, n, amt, at);
  }
}

function smallQuestion(s: Doc<"stories">, n: string, amt: string, at: string): QuestionDraft {
  const what: Record<string, [string, string, string]> = {
    fee_overcharge: [`The card acquirer took about 2.9% instead of the contracted 1.0% debit and 1.8% credit on ${n} batches at ${at}.`, "Settle and dispute the fee", "The acquirer applied the wrong rate to one store."],
    duplicate_credit: [`The bank credited ${n} card batches at ${at} twice.`, "Settle the originals, ask the bank to reverse the copies", "A bank posting error."],
    transposition: [`${n} amounts at ${at} have the right digits in the wrong order.`, "Settle at the recorded amount and correct the keying", "A keying error."],
    short_deposit: [`${n} cash deposits at ${at} are short of the day's cash, with nothing recorded as petty cash.`, "Settle and record the shortfall for the store manager", "Cash short at the store."],
    overpayment: [`A dealer of ${at} paid more than the invoices it named, ${n} times.`, "Settle and keep the excess as a dealer credit", "The dealer is paying ahead."],
    unknown_counterparty: [`${n} transfers (${amt}) came from senders we do not know, all marked for ${at}.`, "Settle as other income for the store", "Customer transfers without an invoice."],
    payout_short: [`${n} marketplace payouts for ${at} are below orders minus commission.`, "Settle and record the gap as refunds", "Refunds the platform made but our books do not have."],
    chargeback_deduction: [`${n} website settlements for ${at} are below the gateway report.`, "Settle and record the chargebacks", "Chargebacks deducted by the gateway."],
    unmatched_transfer: [`${n} dealer transfers match no set of open invoices.`, "Settle against the oldest open invoices", "A payment without references."],
  };
  const [text, label, hyp] = what[s.gap] ?? [`${n} lines (${amt}) at ${at} need a decision.`, "Settle as proposed", "A one-off difference."];
  return {
    askOf: "accountant",
    text: text + " How should they be booked?",
    options: [
      { id: "settle", label, impact: `Settles ${n} lines (${amt}) by your decision and remembers it as a precedent.` },
      { id: "hold", label: "Keep them held", impact: "Nothing is booked." },
    ],
    summary: text, hypothesis: hyp,
    trace: [`grouped ${n} held lines by gap, store and counterparty`, `total ${rp(s.amount)}`, "one question, one click"],
    auditor: "No counterexamples found in the group.",
  };
}
