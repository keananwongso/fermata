// Plain words for what the site shows: each rule by the kind of payment it explains, and each kind of record by what a
// person would call it. Rule ids stay in the code, the record and the dashboard's Rules view; the demo says these.

export const RULE_NAME: Record<string, string> = {
  r1: "Dealer transfer, less a bank fee",
  r2: "Entry and its cancellation",
  r3: "Store card and cash takings",
  r4: "Marketplace payout",
  r5: "Website payment",
  r6: "Invoices paid together",
  r7: "Lender payout",
  r8: "School fee, by its receipt",
  r9: "FIN_Z lender payout",
  r10: "School fees paid ahead",
  r11: "Cash deposit, rounded down",
};

// "r8+r6" when two rules settled a line together.
export const ruleName = (ids: string | null | undefined) =>
  (ids ?? "").split("+").filter(Boolean).map((id) => RULE_NAME[id] ?? id).join(" + ");

const RECORD: Record<string, [string, string]> = {
  marketplace_orders: ["order", "orders"],
  dealer_invoices: ["invoice", "invoices"],
  erp_invoices: ["invoice", "invoices"],
  school_receipts: ["receipt", "receipts"],
  school_bills: ["school bill", "school bills"],
  gateway_settlements: ["web order", "web orders"],
  cash_book: ["cash book entry", "cash book entries"],
  bank_transactions: ["bank entry", "bank entries"],
};

// "43 orders", "1 receipt".
export const records = (n: number, kind: string | null | undefined) => {
  const [one, many] = RECORD[kind ?? ""] ?? ["record", "records"];
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
};
