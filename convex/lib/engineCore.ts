// The reconciliation engine: plain TypeScript, no AI. Places each bank line at a store, matches it to the
// records it pays for, settles it under an approved rule, or explains why it waits or holds.
// It never reads `truth` on a bank line; that field exists only for evaluation.
import {
  CASH_TOLERANCE, DEALER_BY_NAME, PLACEMENT_THRESHOLD, STORES, STORE_BY_CODE, WAITING_MAX_DAYS,
  addDays, dayDiff, weekday, type Channel, type StoreCode,
} from "./domain";
import type { RuleProgram } from "./rules";
import type { BankTxn, CardSales, CashDay, DealerInvoice, GatewaySettlement, InstallmentSale, MarketOrder, SchoolReceipt } from "./world";

export type EngineTxn = Omit<BankTxn, "truth">;

// Everything the engine may read. Implementations return only rows recorded on or before `asOf`.
export interface DataPort {
  cardSales(store: StoreCode, terminal: number, date: string): Promise<CardSales | null>;
  cashDays(store: StoreCode, dates: string[]): Promise<CashDay[]>;
  marketOrders(platform: string, store: StoreCode, week: string): Promise<MarketOrder[]>;
  gatewayByBatch(batchRef: string): Promise<GatewaySettlement | null>;
  dealerInvoicesByNo(nos: string[]): Promise<DealerInvoice[]>;
  dealerInvoicesInWindow(dealer: string, from: string, to: string): Promise<DealerInvoice[]>;
  installmentSales(store: StoreCode, from: string, to: string): Promise<InstallmentSale[]>;
  receiptsByStudent(studentRef: string, from: string, to: string): Promise<SchoolReceipt[]>;
  schoolCashReceipts(store: StoreCode, week: string): Promise<SchoolReceipt[]>;
  pairLine(account: string, date: string, memo: string): Promise<EngineTxn | null>;
  applied(key: string): Promise<number>; // amount already applied to a record (0 if none)
}

export interface Vote { store: StoreCode; score: number; reasons: string[] }
export interface Placement { store: StoreCode | null; confidence: number; votes: Vote[] }
export interface CounterpartRef { table: string; key: string; amount: number }

export type Decision =
  | { kind: "settle"; ruleIds: string[]; placement: Placement; counterparts: CounterpartRef[]; note: string; fanout: number }
  | { kind: "wait"; placement: Placement; note: string }
  | { kind: "hold"; gap: Gap; storyKey: string; placement: Placement; counterparty: string; note: string; facts: Record<string, number | string> };

export type Gap =
  | "fee_overcharge" | "duplicate_credit" | "transposition" | "amount_mismatch" | "short_deposit" | "over_deposit"
  | "petty_cash_retained" | "no_store_record" | "payout_short" | "chargeback_deduction" | "overpayment" | "underpayment"
  | "unmatched_transfer" | "unknown_lender" | "placement_conflict" | "unknown_counterparty" | "counterpart_missing"
  | "low_confidence_placement" | "no_rule" | "over_limit";

export const GAP_LABEL: Record<Gap, string> = {
  fee_overcharge: "Card fee above the contract",
  duplicate_credit: "Bank credited the same batch twice",
  transposition: "Digits swapped when keyed",
  amount_mismatch: "Amount does not match the records",
  short_deposit: "Deposit short of the day's cash",
  over_deposit: "Deposit above the day's cash",
  petty_cash_retained: "Cash still in petty cash",
  no_store_record: "No store recorded this cash",
  payout_short: "Payout below orders minus commission",
  chargeback_deduction: "Website chargeback taken from the settlement",
  overpayment: "Dealer paid more than the invoices",
  underpayment: "Dealer paid less than the invoices",
  unmatched_transfer: "Transfer matches no open invoices",
  unknown_lender: "Payout from a lender we do not know",
  placement_conflict: "Bank and school receipts point to different stores",
  unknown_counterparty: "Transfer from an unknown sender",
  counterpart_missing: "Records never arrived",
  low_confidence_placement: "Store unclear",
  no_rule: "No approved rule explains it",
  over_limit: "Above the rule's limit",
};

// ---------- sync: read the memo ----------
export interface Parsed {
  channel: Channel;
  subStore: StoreCode | null; // store named by the bank's own reference (terminal, slip, shop, VA range)
  terminal?: number; saleDate?: string; platform?: string; week?: string; batchRef?: string;
  dealer?: string; invoiceNos?: string[]; partial?: boolean; lender?: string; student?: string; tellerCity?: string; pairRef?: string;
}

const st = (n: string): StoreCode | null => {
  const code = ("S" + n.padStart(2, "0")) as StoreCode;
  return STORE_BY_CODE[code] ? code : null;
};

export function parseMemo(t: EngineTxn): Parsed {
  const m = t.memo;
  let x: RegExpMatchArray | null;
  if ((x = m.match(/^EDC SETTLE T(\d\d)-(\d\d) (\d\d)(\d\d)/))) {
    const year = Number(t.date.slice(0, 4)) - (x[4] === "12" && t.date.slice(5, 7) === "01" ? 1 : 0);
    return { channel: "card", subStore: st(x[1]), terminal: Number(x[2]), saleDate: `${year}-${x[4]}-${x[3]}` };
  }
  if ((x = m.match(/^CASH DEP SLIP (\d\d) \d{4}(?: TELLER (.+))?$/))) return { channel: "cash", subStore: st(x[1]), tellerCity: x[2] };
  if ((x = m.match(/^CASH DEP \d{4}(?: TELLER (.+))?$/))) return { channel: "cash", subStore: null, tellerCity: x[1] };
  if ((x = m.match(/^(SHOPEE|TOKOPEDIA) PAYOUT SHOP-(\d\d) (\d{4}W\d\d)$/))) return { channel: "marketplace", subStore: st(x[2]), platform: x[1], week: x[3] };
  if ((x = m.match(/^PG SETTLE (WB-S(\d\d)-\S+)$/))) return { channel: "website", subStore: st(x[2]), batchRef: x[1] };
  if ((x = m.match(/^TRF FROM UNKNOWN REF \d+ S(\d\d)$/))) return { channel: "unknown", subStore: st(x[1]) };
  if ((x = m.match(/^TRF FROM (.+?)(?: (PART))?(?: INV (.+))?$/))) {
    const d = DEALER_BY_NAME[x[1]];
    if (d) return { channel: "dealer", subStore: d.store, dealer: d.name, partial: x[2] === "PART", invoiceNos: x[3] ? x[3].split(" ") : undefined };
    return { channel: "unknown", subStore: null };
  }
  if ((x = m.match(/^(FIN_[A-Z]) DISB S?(\d\d) \d+$/))) return { channel: "lender", subStore: st(x[2]), lender: x[1] };
  if ((x = m.match(/^VA 8800(\d\d)\d{4} (ST\d\d-\d{4})$/))) return { channel: "school_va", subStore: st(x[1]), student: x[2] };
  if ((x = m.match(/^SCHOOL CASH S(\d\d) (\d{4}W\d\d)$/))) return { channel: "school_cash", subStore: st(x[1]), week: x[2] };
  if ((x = m.match(/^TRF (?:OUT|REVERSAL) (\S+)$/))) return { channel: "transfer_pair", subStore: null, pairRef: x[1] };
  return { channel: "unknown", subStore: null };
}

const CITY_STORE: Record<string, StoreCode> = Object.fromEntries(STORES.map((s) => [s.city.toUpperCase(), s.code]));

// ---------- placement: weigh evidence into a confidence ----------
function place(t: EngineTxn, p: Parsed, recordStore: StoreCode | null, followReceipt: boolean): Placement {
  const votes = new Map<StoreCode, Vote>();
  const add = (s: StoreCode | null, w: number, why: string) => {
    if (!s || w <= 0) return;
    const v = votes.get(s) ?? { store: s, score: 0, reasons: [] };
    v.score += w; v.reasons.push(why); votes.set(s, v);
  };
  const conflict = followReceipt && p.channel === "school_va" && recordStore && recordStore !== p.subStore;
  add(p.subStore, conflict ? 0.05 : 0.6, "bank sub account");
  add(recordStore, conflict ? 0.7 : 0.3, p.channel === "school_va" ? "school receipt" : "store records");
  if (p.subStore && !conflict) add(p.subStore, 0.1, "account used by this store");
  if (p.tellerCity) add(CITY_STORE[p.tellerCity] ?? null, 0.06, "teller branch city");
  const list = [...votes.values()].sort((a, b) => b.score - a.score);
  const total = list.reduce((a, v) => a + v.score, 0);
  const strong = list[0] && list[0].reasons.some((r) => r !== "teller branch city");
  if (!list.length || !strong) return { store: null, confidence: 0, votes: list };
  return { store: list[0].store, confidence: Math.round((list[0].score / total) * 1000) / 1000, votes: list.map((v) => ({ ...v, score: Math.round(v.score * 1000) / 1000 })) };
}

// ---------- helpers ----------
function sortedDigits(n: number): string { return String(Math.abs(n)).split("").sort().join(""); }
// Rules that add to a channel's own rule rather than replace it.
const ADD_ON: string[] = ["bank_fee", "follow_receipt", "school_bills", "reversed_voucher"];
function ruleFor(rules: RuleProgram[], channel: Channel, match?: string): RuleProgram | undefined {
  return rules.find((r) => r.channels.includes(channel) && (match ? r.match === match : !ADD_ON.includes(r.match)));
}
function holdKey(gap: Gap, store: StoreCode | null, channel: Channel, counterparty: string): string {
  if (gap === "unknown_lender") return `${gap}|${counterparty}`;
  if (gap === "petty_cash_retained" || gap === "no_store_record") return `${gap}|${channel}`;
  return `${gap}|${store ?? "none"}|${channel}`;
}

// What a card batch should pay: the day's sales minus the rule's fees (a store's newest fee change, if any).
export function cardNet(rule: RuleProgram, rec: CardSales): number {
  const f = (rule.params.cardFees ?? []).filter((x) => x.stores.includes(rec.store) && (!x.from || rec.date >= x.from)).pop();
  return Math.round(rec.debitGross * (1 - (f?.debitFee ?? rule.params.debitFee ?? 0.01))) + Math.round(rec.creditGross * (1 - (f?.creditFee ?? rule.params.creditFee ?? 0.018)));
}

export interface PassInfo { asOf: string; firstPass: boolean }

export async function evaluate(t: EngineTxn, rules: RuleProgram[], port: DataPort, pass: PassInfo): Promise<Decision> {
  const p = parseMemo(t);
  const age = dayDiff(t.date, pass.asOf);
  const canWait = pass.firstPass || age <= WAITING_MAX_DAYS;
  const hold = (gap: Gap, placement: Placement, counterparty: string, note: string, facts: Record<string, number | string> = {}): Decision =>
    ({ kind: "hold", gap, storyKey: holdKey(gap, placement.store, p.channel, counterparty), placement, counterparty, note, facts });
  const waitOrMissing = (placement: Placement, what: string): Decision =>
    canWait ? { kind: "wait", placement, note: `${what} not in the books yet` } : hold("counterpart_missing", placement, p.channel, `${what} never arrived`);
  const settle = (ruleIds: string[], placement: Placement, counterparts: CounterpartRef[], note: string, fanout = counterparts.length): Decision => {
    for (const id of ruleIds) {
      const r = rules.find((x) => x.id === id);
      if (r && t.amount > r.limitIdr) return hold("over_limit", placement, p.channel, `Above ${id}'s limit`);
    }
    if (!placement.store || placement.confidence < PLACEMENT_THRESHOLD) return hold("low_confidence_placement", placement, p.channel, "Store unclear");
    return { kind: "settle", ruleIds, placement, counterparts, note, fanout };
  };

  if (p.channel === "unknown") return hold("unknown_counterparty", place(t, p, null, false), "unknown sender", "Sender is not a dealer, lender or channel we know");
  const rule = ruleFor(rules, p.channel);
  if (!rule) {
    if (p.channel === "lender") return hold("unknown_lender", place(t, p, null, false), p.lender ?? "lender", `${p.lender} is not a lender in any approved rule`);
    return hold("no_rule", place(t, p, null, false), p.channel, "No approved rule covers this channel");
  }

  switch (p.channel) {
    case "card": {
      const rec = p.subStore && p.terminal && p.saleDate ? await port.cardSales(p.subStore, p.terminal, p.saleDate) : null;
      if (!rec) return waitOrMissing(place(t, p, null, false), "Card sales record");
      const pl = place(t, p, rec.store, false);
      if ((await port.applied(rec.key)) > 0) return hold("duplicate_credit", pl, "card acquirer", "This batch was already paid", { batchAmount: t.amount });
      const expected = cardNet(rule, rec);
      if (t.amount === expected) return settle([rule.id], pl, [{ table: "erp_invoices", key: rec.key, amount: t.amount }], "Card batch matches the day's card sales minus the contract fee");
      const gross = rec.debitGross + rec.creditGross;
      const facts = { expected, gross, impliedFee: Math.round((1 - t.amount / gross) * 10000) / 10000 };
      if (sortedDigits(t.amount) === sortedDigits(expected)) return hold("transposition", pl, "card acquirer", "Same digits in a different order", facts);
      if (t.amount < expected && facts.impliedFee > 0.02) return hold("fee_overcharge", pl, "card acquirer", "Fee taken is above the contract", facts);
      return hold("amount_mismatch", pl, "card acquirer", "Amount differs from card sales", facts);
    }
    case "cash": {
      const covered = weekday(t.date) === 1 ? [addDays(t.date, -3), addDays(t.date, -2), addDays(t.date, -1)] : [addDays(t.date, -1)];
      if (!p.subStore) {
        for (const s of STORES) {
          const days = await port.cashDays(s.code, covered);
          const sum = days.reduce((a, d) => a + d.cashSales, 0);
          if (days.length && Math.abs(sum - t.amount) <= CASH_TOLERANCE) {
            const pl = place(t, p, s.code, false);
            return settle([rule.id], pl, days.map((d) => ({ table: "cash_book", key: d.key, amount: d.cashSales })), "Deposit matches one store's cash");
          }
        }
        return hold("no_store_record", place(t, p, null, false), "teller deposit", "No store recorded cash that matches this deposit");
      }
      const days = await port.cashDays(p.subStore, covered);
      if (days.length < covered.length) return waitOrMissing(place(t, p, null, false), "Cash book");
      const pl = place(t, p, p.subStore, false);
      if ((await port.applied(days[0].key)) > 0) return hold("duplicate_credit", pl, "cash deposit", "These days were already deposited");
      const expected = days.reduce((a, d) => a + d.cashSales, 0);
      const petty = days.reduce((a, d) => a + d.pettyCashKept, 0);
      const facts = { expected, petty, gap: expected - t.amount };
      if (Math.abs(expected - t.amount) <= (rule.params.toleranceIdr ?? CASH_TOLERANCE))
        return settle([rule.id], pl, days.map((d) => ({ table: "cash_book", key: d.key, amount: d.cashSales })), weekday(t.date) === 1 ? "Monday deposit covers Friday to Sunday" : "Deposit matches the day's cash");
      if (petty > 0 && Math.abs(expected - petty - t.amount) <= CASH_TOLERANCE) return hold("petty_cash_retained", pl, "cash deposit", "The gap equals cash the store kept as petty cash", facts);
      // A learned rule: the store reversed the day's voucher and banked a round amount; the rest stays in petty cash.
      const voucher = rules.find((r) => r.match === "reversed_voucher" && r.channels.includes("cash"));
      const unit = voucher?.params.roundTo ?? 0;
      const rev = days.find((d) => d.reversed && dayDiff(d.date, t.date) <= (voucher?.params.withinDays ?? 2));
      if (voucher && rev && unit > 0 && t.amount % unit === 0 && expected - t.amount > 0 && expected - t.amount < unit)
        return settle([voucher.id], pl, days.map((d) => ({ table: "cash_book", key: d.key, amount: d.cashSales })), `Round deposit after a reversed voucher; Rp ${(expected - t.amount).toLocaleString("en-US")} stays in petty cash`);
      if (sortedDigits(t.amount) === sortedDigits(expected)) return hold("transposition", pl, "cash deposit", "Same digits in a different order", facts);
      return hold(t.amount < expected ? "short_deposit" : "over_deposit", pl, "cash deposit", t.amount < expected ? "Deposit is short of the day's cash" : "Deposit is above the day's cash", facts);
    }
    case "marketplace": {
      const orders = p.subStore && p.platform && p.week ? await port.marketOrders(p.platform, p.subStore, p.week) : [];
      if (!orders.length) return waitOrMissing(place(t, p, null, false), "Marketplace orders");
      const pl = place(t, p, orders[0].store, false);
      if ((await port.applied(orders[0].key)) > 0) return hold("duplicate_credit", pl, p.platform!, "This payout was already matched");
      const gross = orders.reduce((a, o) => a + o.amount, 0);
      const refunds = orders.reduce((a, o) => a + o.refund, 0);
      const rate = rule.params.commission?.[p.platform!] ?? 0;
      const expected = Math.round(gross * (1 - rate)) - refunds;
      if (expected === t.amount) return settle([rule.id], pl, orders.map((o) => ({ table: "marketplace_orders", key: o.key, amount: o.amount })), `${orders.length} orders minus ${(rate * 100).toFixed(1)}% commission${refunds ? " and refunds" : ""}`, orders.length);
      return hold("payout_short", pl, p.platform!, "Payout below orders minus commission", { expected, gross, refunds, gap: expected - t.amount });
    }
    case "website": {
      const g = p.batchRef ? await port.gatewayByBatch(p.batchRef) : null;
      if (!g) return waitOrMissing(place(t, p, null, false), "Gateway report");
      const pl = place(t, p, g.store, false);
      const expected = g.gross - Math.round(g.gross * (rule.params.fee ?? 0.029));
      if (expected === t.amount) return settle([rule.id], pl, [{ table: "gateway_settlements", key: g.key, amount: t.amount }], "Settlement matches the gateway report minus 2.9%");
      return hold(t.amount < expected ? "chargeback_deduction" : "amount_mismatch", pl, "payment gateway", "Settlement below the gateway report", { expected, gap: expected - t.amount });
    }
    case "dealer": {
      const fee = rules.find((r) => r.match === "bank_fee" && r.channels.includes("dealer"));
      const feeIdr = fee?.params.feeIdr ?? 0;
      if (p.invoiceNos) {
        const invs = await port.dealerInvoicesByNo(p.invoiceNos);
        if (invs.length < p.invoiceNos.length) return waitOrMissing(place(t, p, null, false), "Dealer invoices");
        const pl = place(t, p, invs[0].store, false);
        const open = await Promise.all(invs.map(async (i) => i.amount - (await port.applied(i.key))));
        const remaining = open.reduce((a, b) => a + b, 0);
        if (p.partial && invs.length === 1 && t.amount < remaining)
          return settle([rule.id], pl, [{ table: "dealer_invoices", key: invs[0].key, amount: t.amount }], `Part payment of invoice ${invs[0].invoiceNo}`);
        const refs = invs.map((i, k) => ({ table: "dealer_invoices", key: i.key, amount: open[k] }));
        if (remaining === t.amount) return settle([rule.id], pl, refs, `Pays ${invs.length} open invoice${invs.length > 1 ? "s" : ""}`);
        if (fee && remaining === t.amount + feeIdr) return settle([rule.id, fee.id], pl, refs, `Pays ${invs.length} invoice${invs.length > 1 ? "s" : ""}, bank kept Rp 2,500`);
        return hold(t.amount > remaining ? "overpayment" : "underpayment", pl, p.dealer!, t.amount > remaining ? "Paid more than the invoices it names" : "Paid less than the invoices it names", { invoices: remaining, gap: t.amount - remaining });
      }
      const cands = (await port.dealerInvoicesInWindow(p.dealer!, addDays(t.date, -(rule.params.lookbackDays ?? 90)), t.date));
      const open: { inv: DealerInvoice; left: number }[] = [];
      for (const inv of cands) { const left = inv.amount - (await port.applied(inv.key)); if (left > 0) open.push({ inv, left }); }
      const targets = fee ? [t.amount, t.amount + feeIdr] : [t.amount];
      const maxK = rule.params.maxInvoices ?? 3;
      const n = open.length;
      const found: { set: { inv: DealerInvoice; left: number }[]; tgt: number }[] = [];
      const consider = (set: { inv: DealerInvoice; left: number }[]) => {
        const s = set.reduce((acc, x) => acc + x.left, 0);
        for (const tgt of targets) if (s === tgt) found.push({ set, tgt });
      };
      for (let a = 0; a < n && found.length < 2; a++) {
        consider([open[a]]);
        if (maxK < 2) continue;
        for (let b = a + 1; b < n && found.length < 2; b++) {
          consider([open[a], open[b]]);
          if (maxK < 3) continue;
          for (let c = b + 1; c < n && found.length < 2; c++) consider([open[a], open[b], open[c]]);
        }
      }
      if (found.length === 1) return settleSet(found[0].set, found[0].tgt);
      if (found.length > 1) return canWait ? { kind: "wait", placement: place(t, p, null, false), note: "More than one set of invoices adds up to this" } : hold("unmatched_transfer", place(t, p, null, false), p.dealer!, "More than one set of open invoices adds up to this transfer");
      return canWait ? { kind: "wait", placement: place(t, p, null, false), note: "No open invoices add up to this yet" } : hold("unmatched_transfer", place(t, p, null, false), p.dealer!, "No subset of open invoices adds up to this transfer");
      function settleSet(set: { inv: DealerInvoice; left: number }[], tgt: number): Decision {
        const pl = place(t, p, set[0].inv.store, false);
        const ids = tgt === t.amount ? [rule!.id] : [rule!.id, fee!.id];
        return settle(ids, pl, set.map((x) => ({ table: "dealer_invoices", key: x.inv.key, amount: x.left })), `Pays ${set.length} of ${n} open invoices (found by subset sum)`);
      }
    }
    case "lender": {
      const lenderRule = rules.find((r) => r.match === "lender_sale" && r.params.lenders && p.lender! in r.params.lenders);
      if (!lenderRule) return hold("unknown_lender", place(t, p, null, false), p.lender ?? "lender", `${p.lender} is not a lender in any approved rule`);
      const cut = lenderRule.params.lenders![p.lender!];
      const sales = p.subStore ? await port.installmentSales(p.subStore, addDays(t.date, -(lenderRule.params.windowDays ?? 7)), addDays(t.date, -1)) : [];
      for (const s of sales) {
        if (s.lender !== p.lender) continue;
        if (Math.round(s.amount * (1 - cut)) !== t.amount) continue;
        if ((await port.applied(s.key)) > 0) continue;
        return settle([lenderRule.id], place(t, p, s.store, false), [{ table: "erp_invoices", key: s.key, amount: s.amount }], `Installment sale minus ${(cut * 100).toFixed(1)}% lender cut`);
      }
      return waitOrMissing(place(t, p, null, false), "Installment sale");
    }
    case "school_va": {
      const follow = rules.find((r) => r.match === "follow_receipt" && r.channels.includes("school_va"));
      const recs = p.student ? await port.receiptsByStudent(p.student, addDays(t.date, -3), addDays(t.date, 3)) : [];
      let rec: SchoolReceipt | undefined;
      for (const r of recs) if (r.amount === t.amount && (await port.applied(r.key)) === 0) { rec = r; break; }
      if (!rec) {
        const bills = rules.find((r) => r.match === "school_bills" && r.channels.includes("school_va"));
        const run = bills && p.student ? await billRun(t, p.student, bills, port) : null;
        if (bills && run) return settle([bills.id], place(t, p, run[0].store, false), run.map((b) => ({ table: "school_bills", key: b.key, amount: b.amount })), `Pays ${run.length} monthly bills in advance`, run.length);
        return waitOrMissing(place(t, p, null, false), "School receipt");
      }
      const pl = place(t, p, rec.store, !!follow);
      if (rec.store !== p.subStore && !follow)
        return hold("placement_conflict", pl, "music school", "The bank's virtual account says one store, the school's receipt says another", { vaStore: p.subStore ?? "", receiptStore: rec.store });
      return settle(rec.store !== p.subStore && follow ? [follow.id, rule.id] : [rule.id], pl, [{ table: "school_receipts", key: rec.key, amount: rec.amount }], rec.store !== p.subStore ? "Placed where the school's receipt says" : "Fee matches the student's receipt");
    }
    case "school_cash": {
      const recs = p.subStore && p.week ? await port.schoolCashReceipts(p.subStore, p.week) : [];
      if (!recs.length) return waitOrMissing(place(t, p, null, false), "School cash receipts");
      const pl = place(t, p, recs[0].store, false);
      const sum = recs.reduce((a, r) => a + r.amount, 0);
      if (sum === t.amount) return settle([rule.id], pl, recs.map((r) => ({ table: "school_receipts", key: r.key, amount: r.amount })), `${recs.length} desk receipts for the week`, recs.length);
      return hold("amount_mismatch", pl, "music school", "Deposit differs from the week's receipts", { expected: sum, gap: sum - t.amount });
    }
    case "transfer_pair": {
      const other = await port.pairLine(t.account, t.date, t.memo);
      const pl: Placement = { store: "S01", confidence: 1, votes: [{ store: "S01", score: 1, reasons: ["head office line"] }] };
      if (other && other.amount === t.amount && other.direction !== t.direction)
        return { kind: "settle", ruleIds: [rule.id], placement: { ...pl, store: null }, counterparts: [{ table: "bank_transactions", key: other.key, amount: other.amount }], note: "Made and cancelled the same day; both ignored", fanout: 1 };
      return waitOrMissing(pl, "Matching reversal");
    }
  }
  return hold("no_rule", place(t, p, null, false), p.channel, "No approved rule covers this channel");
}

// A learned rule: one credit pays several consecutive monthly bills of one student (the school pre-creates a bill per
// month at zero and records the billing month, not the cash date). Bills at zero are skipped. Exactly one run must fit.
async function billRun(t: EngineTxn, student: string, rule: RuleProgram, port: DataPort): Promise<SchoolReceipt[] | null> {
  const maxN = rule.params.maxMonths ?? 6, within = rule.params.recordedWithinDays ?? 3;
  const month = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  const open: SchoolReceipt[] = [];
  for (const b of (await port.receiptsByStudent(student, addDays(t.date, -31), addDays(t.date, 31 * maxN))).sort((a, b) => a.date.localeCompare(b.date)))
    if (b.amount > 0 && Math.abs(dayDiff(b.recordedOn, t.date)) <= within && (await port.applied(b.key)) === 0) open.push(b);
  const found: SchoolReceipt[][] = [];
  for (let i = 0; i < open.length; i++) {
    let sum = 0;
    for (let j = i; j < open.length && j - i < maxN; j++) {
      if (j > i && month(open[j].date) !== month(open[j - 1].date) + 1) break;
      sum += open[j].amount;
      if (j > i && sum === t.amount) found.push(open.slice(i, j + 1));
    }
  }
  return found.length === 1 ? found[0] : null;
}

// Counterparts a settlement consumes (so a second credit for the same batch is caught).
export function consumption(d: Decision): { key: string; amount: number }[] {
  if (d.kind !== "settle") return [];
  if (d.counterparts.length > 0 && (d.counterparts[0].table === "marketplace_orders" || d.counterparts[0].table === "school_receipts" && d.counterparts.length > 1))
    return [{ key: d.counterparts[0].key, amount: 1 }];
  if (d.counterparts[0]?.table === "bank_transactions") return [];
  return d.counterparts.map((c) => ({ key: c.key, amount: c.amount }));
}
