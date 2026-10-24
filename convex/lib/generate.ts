// Deterministic synthetic world for Fermata. Run: npm run generate
// All data is invented. Store numbers, dealers, students, lenders and amounts are fictional.
import {
  BANK_FEE_IN_TRANSFER, CARD_CREDIT_FEE, CARD_DEBIT_FEE, DEALERS, FIRST_PASS_RATE, LAST_YEAR, LENDER_TRUE_CUT,
  MARKETPLACE_COMMISSION, MONTHLY_TOTALS, SAMPLE_MONTH_LAST_YEAR, STORES, STORE_BY_CODE, WEBSITE_FEE, YEAR,
  addDays, daysInMonth, isoDate, isoWeek, monthEnd, weekday,
  type BankAccountCode, type Channel, type Lender, type Platform, type StoreCode,
} from "./domain";
import type {
  BankTxn, CardSales, CashDay, DealerInvoice, GatewaySettlement, InstallmentSale, LedgerAccount,
  SchoolReceipt, World,
} from "./world";

// ---------- deterministic random ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(19450701);
const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const money = (lo: number, hi: number, step = 100) => Math.round((lo + rand() * (hi - lo)) / step) * step;
function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
const ddmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7);
const sCode = (s: StoreCode) => s.slice(1);

// ---------- story plan (the brief's numbers) ----------
type SmallPattern =
  | "fee_overcharge" | "duplicate_credit" | "short_deposit" | "transposition_card" | "transposition_cash"
  | "overpayment" | "unknown_counterparty" | "payout_short" | "chargeback";
interface SmallStory { month: number; pattern: SmallPattern; store: StoreCode; n: number }
export const SMALL_STORIES: SmallStory[] = [
  { month: 1, pattern: "fee_overcharge", store: "S04", n: 30 },
  { month: 1, pattern: "duplicate_credit", store: "S09", n: 22 },
  { month: 1, pattern: "short_deposit", store: "S02", n: 18 },
  { month: 1, pattern: "transposition_card", store: "S12", n: 15 },
  { month: 1, pattern: "overpayment", store: "S06", n: 12 },
  { month: 1, pattern: "unknown_counterparty", store: "S01", n: 10 },
  { month: 1, pattern: "payout_short", store: "S05", n: 8 },
  { month: 1, pattern: "chargeback", store: "S13", n: 5 },
  { month: 2, pattern: "fee_overcharge", store: "S10", n: 28 },
  { month: 2, pattern: "duplicate_credit", store: "S03", n: 20 },
  { month: 2, pattern: "transposition_cash", store: "S07", n: 18 },
  { month: 2, pattern: "unknown_counterparty", store: "S14", n: 15 },
  { month: 2, pattern: "overpayment", store: "S11", n: 12 },
  { month: 2, pattern: "payout_short", store: "S08", n: 7 },
  { month: 3, pattern: "fee_overcharge", store: "S01", n: 25 },
  { month: 3, pattern: "short_deposit", store: "S13", n: 20 },
  { month: 3, pattern: "unknown_counterparty", store: "S06", n: 15 },
  { month: 3, pattern: "overpayment", store: "S08", n: 10 },
  { month: 4, pattern: "duplicate_credit", store: "S12", n: 25 },
  { month: 4, pattern: "short_deposit", store: "S09", n: 20 },
  { month: 4, pattern: "unknown_counterparty", store: "S04", n: 15 },
  { month: 5, pattern: "transposition_card", store: "S05", n: 21 },
  { month: 6, pattern: "fee_overcharge", store: "S14", n: 20 },
  { month: 6, pattern: "overpayment", store: "S03", n: 15 },
  { month: 6, pattern: "unknown_counterparty", store: "S10", n: 10 },
  { month: 7, pattern: "duplicate_credit", store: "S06", n: 15 },
  { month: 8, pattern: "short_deposit", store: "S11", n: 20 },
];
export const STORY_A = { vaStore: "S03" as StoreCode, receiptStore: "S11" as StoreCode, perMonth: [400, 400, 386], total: 1_310_000_000 };
export const STORY_B = { month: 6, matched: 738, orphan: 4, stores: 11, matchedTotal: 9_760_000_000, orphanTotal: 40_000_000 };
export const STORY_C = { month: 5, deposits: 38, stores: ["S02", "S05", "S07", "S08", "S12", "S14"] as StoreCode[], total: 412_000_000 };
export const STORY_D = { month: 9, deposits: 9, total: 286_000_000 };
export const SMALL_TOTAL = 2_940_000_000;

// ---------- the world's messes, as a config ----------
// DEFAULT_MESS is the recorded demo's world, row for row. Other configs are for what-ifs (scripts/simulate.ts).
// Story tags starting "L:" are legitimate changes the onboarding rules do not know (a rule can learn them);
// the simulator reads them only as the answer key for a person's reply.
export interface CardFeeChange { stores: StoreCode[]; from: string | null; debitFee: number; creditFee: number } // from: sale date, null = always
export interface MessConfig {
  seed: number;
  totals: number[]; // bank lines per month; card batches fill each month to it
  late: "brief" | number; // "brief": waiting lines planted to hit FIRST_PASS_RATE; a number: that share of each month arrives late
  oneOffs: boolean; // the small stories and stories C and D (anomalies to hold, nothing to learn)
  storyA: boolean; // Jan to Mar: S03 virtual accounts, receipts keyed at S11 in March
  schoolMoved: number; // lines a month, every month: S03 virtual accounts, receipts at S11 on time ("L:school_moved")
  advance: number; // school credits a month that pay 2 to 6 monthly bills at once ("L:school_advance")
  cashReversals: { stores: StoreCode[]; perMonth: number; roundTo: number } | null; // reversed voucher, round deposit ("L:cash_reversal")
  newLender: { month: number; perMonth: number; cut: number; launch: boolean; story: string | null } | null; // launch: story B
  cardFees: CardFeeChange[]; // acquirer fee changes ("L:card_fee")
}
export const DEFAULT_MESS: MessConfig = {
  seed: 19450701, totals: MONTHLY_TOTALS, late: "brief", oneOffs: true, storyA: true, schoolMoved: 0, advance: 0, cashReversals: null,
  newLender: { month: STORY_B.month, perMonth: 90, cut: LENDER_TRUE_CUT.FIN_Z, launch: true, story: null }, cardFees: [],
};
let cfg: MessConfig = DEFAULT_MESS;

// The learning year: nothing is planted to hit a curve. A flat share of records arrives late every month. Recurring,
// legitimate patterns the onboarding rules (r1 to r7) do not know, each from the business Fermata is modelled on:
// students who moved class (r8), school fees paid months in advance (one credit, several monthly bills), a store that
// reverses its cash voucher and banks a round amount (the rest stays in petty cash), and a new lender from June (r9).
// Card fees are knobs, off by default (no evidence they change): `onboarding` puts the regional stores' card batches
// on a credit fee r3 does not know, taking stores from S14 down until January's expected first pass is that share;
// `drift` raises the credit fee at some stores from a month.
export interface LearningKnobs {
  seed?: number; late?: number; schoolMoved?: number; advance?: number; oneOffs?: boolean;
  cashReversals?: { stores: StoreCode[]; perMonth: number; roundTo: number } | null;
  lender?: { month: number; perMonth: number; cut: number } | null;
  onboarding?: number | null; regionalFee?: number;
  drift?: { month: number; creditFee: number; stores: StoreCode[] } | null;
}
export const LEARNING_DEFAULTS = {
  seed: 19450701, late: 0.05, schoolMoved: 400, advance: 250, oneOffs: true,
  cashReversals: { stores: ["S02", "S05", "S09", "S12"] as StoreCode[], perMonth: 40, roundTo: 500_000 } as LearningKnobs["cashReversals"],
  lender: { month: 6, perMonth: 300, cut: LENDER_TRUE_CUT.FIN_Z },
  onboarding: null as number | null, regionalFee: 0.02,
  drift: null as LearningKnobs["drift"],
};
export const DRIFT_EXAMPLE = { month: 4, creditFee: 0.021, stores: ["S08", "S09", "S10"] as StoreCode[] };
export function learningMess(knobs: LearningKnobs = {}): MessConfig & { regionalStores: StoreCode[] } {
  const k = { ...LEARNING_DEFAULTS, ...knobs };
  const total = MONTHLY_TOTALS[0];
  const regionalStores: StoreCode[] = [];
  if (k.onboarding) {
    // Expected January lines the onboarding rules cannot settle before any card store is added.
    const oneOffs = k.oneOffs ? SMALL_STORIES.filter((s) => s.month === 1).reduce((a, s) => a + s.n, 0) : 0;
    let missing = Math.round(total * k.late) + oneOffs + k.schoolMoved + k.advance + (k.cashReversals?.perMonth ?? 0);
    const terminals = STORES.reduce((a, s) => a + s.terminals, 0);
    const perTerminal = (total - 2610 - k.schoolMoved - k.advance) / terminals; // ~2,610 January lines are not card batches
    for (const s of [...STORES].reverse()) {
      const lines = s.terminals * perTerminal;
      if (k.drift?.stores.includes(s.code)) continue;
      if (missing + lines / 2 > total * (1 - k.onboarding)) break;
      regionalStores.push(s.code); missing += lines;
    }
  }
  const cardFees: CardFeeChange[] = [];
  if (regionalStores.length) cardFees.push({ stores: regionalStores, from: null, debitFee: CARD_DEBIT_FEE, creditFee: k.regionalFee });
  if (k.drift) cardFees.push({ stores: k.drift.stores, from: isoDate(YEAR, k.drift.month, 1), debitFee: CARD_DEBIT_FEE, creditFee: k.drift.creditFee });
  return {
    seed: k.seed, totals: MONTHLY_TOTALS, late: k.late, oneOffs: k.oneOffs, storyA: false, schoolMoved: k.schoolMoved,
    advance: k.advance, cashReversals: k.cashReversals ?? null,
    newLender: k.lender ? { ...k.lender, launch: false, story: "L:new_lender" } : null, cardFees, regionalStores,
  };
}

export function plannedHeldOwn(month: number): number {
  const small = SMALL_STORIES.filter((s) => s.month === month).reduce((a, s) => a + s.n, 0);
  return small + (month === 3 ? STORY_A.perMonth[2] : 0) + (month === STORY_B.month ? STORY_B.matched + STORY_B.orphan : 0)
    + (month === STORY_C.month ? STORY_C.deposits : 0) + (month === STORY_D.month ? STORY_D.deposits : 0);
}
export function plannedFirstPassSettled(month: number): number {
  return Math.round(MONTHLY_TOTALS[month - 1] * FIRST_PASS_RATE[month - 1] + 1e-9);
}
export function plannedWaiting(month: number): number {
  const unsettled = MONTHLY_TOTALS[month - 1] - plannedFirstPassSettled(month);
  const aWait = month <= 2 ? STORY_A.perMonth[month - 1] : 0;
  return unsettled - plannedHeldOwn(month) - aWait;
}

// ---------- the world builder ----------
interface Ctx {
  w: World;
  seq: Record<string, number>;
}
function nextKey(c: Ctx, prefix: string): string {
  c.seq[prefix] = (c.seq[prefix] ?? 0) + 1;
  return `${prefix}${String(c.seq[prefix]).padStart(6, "0")}`;
}

interface Planned {
  // A bank line plus a hook that marks its counterpart late (for WAITING) if chosen.
  txn: BankTxn;
  lateable?: (recordedOn: string) => void;
}

function bankTxn(c: Ctx, year: number, date: string, account: BankAccountCode, amount: number, memo: string,
  store: StoreCode | null, channel: Channel, story: string | null, direction: "in" | "out" = "in"): BankTxn {
  const t: BankTxn = {
    key: nextKey(c, year === YEAR ? "bt" : "bl"), year, month: Number(date.slice(5, 7)), date, account, direction, amount, memo,
    truth: { store, channel, story },
  };
  return t;
}

const TELLER_CITY_FOR: Record<string, string> = {};
function tellerSuffix(store: StoreCode): string {
  // Most deposits are made at the branch in the store's city. A few are made in a neighbouring city.
  if (rand() < 0.07) {
    const other = STORES[(STORE_BY_CODE[store].number % 14)];
    return " TELLER " + other.city.toUpperCase();
  }
  return " TELLER " + STORE_BY_CODE[store].city.toUpperCase();
}
void TELLER_CITY_FOR;

// --- channel builders (each returns planned bank lines and pushes counterparts) ---

function buildCardSlots(year: number, month: number): { store: StoreCode; terminal: number; saleDate: string }[] {
  const slots: { store: StoreCode; terminal: number; saleDate: string }[] = [];
  const first = isoDate(year, month, 1);
  for (let d = 0; d < daysInMonth(year, month); d++) {
    const bankDate = addDays(first, d);
    const saleDate = addDays(bankDate, -1);
    for (const s of STORES) for (let t = 1; t <= s.terminals; t++) slots.push({ store: s.code, terminal: t, saleDate });
  }
  return slots;
}

function cardLine(c: Ctx, year: number, store: StoreCode, terminal: number, saleDate: string,
  opts: { scale?: number; feeOverride?: number; transpose?: boolean; story?: string | null } = {}): Planned {
  const sc = opts.scale ?? 1;
  const debit = money(1_500_000 * sc, 9_000_000 * sc);
  const credit = money(800_000 * sc, 7_000_000 * sc);
  const rec: CardSales = {
    key: nextKey(c, "cs"), year, kind: "card_sales", store, terminal, date: saleDate, debitGross: debit, creditGross: credit,
    recordedOn: saleDate,
  };
  c.w.erp.push(rec);
  const change = cfg.cardFees.filter((f) => f.stores.includes(store) && (!f.from || saleDate >= f.from)).pop();
  let net = opts.feeOverride !== undefined
    ? Math.round((debit + credit) * (1 - opts.feeOverride))
    : Math.round(debit * (1 - (change?.debitFee ?? CARD_DEBIT_FEE))) + Math.round(credit * (1 - (change?.creditFee ?? CARD_CREDIT_FEE)));
  if (opts.transpose) net = transposeDigits(net);
  const s = STORE_BY_CODE[store];
  const memo = `EDC SETTLE T${sCode(store)}-${String(terminal).padStart(2, "0")} ${ddmm(saleDate)}`;
  const txn = bankTxn(c, year, addDays(saleDate, 1), s.cardBank, net, memo, store, "card", opts.story ?? (change ? "L:card_fee" : null));
  return { txn, lateable: (r) => { rec.recordedOn = r; } };
}

function transposeDigits(n: number): number {
  const s = String(n).split("");
  // swap the first adjacent pair of different digits from the left after the leading digit
  for (let i = 1; i < s.length - 3; i++) {
    if (s[i] !== s[i + 1]) {
      [s[i], s[i + 1]] = [s[i + 1], s[i]];
      return Number(s.join(""));
    }
  }
  return n + 9;
}

// Cash: each store records daily cash sales. Deposits go out Mon to Fri; Monday covers Fri to Sun.
function cashDaysForMonth(c: Ctx, year: number, month: number, scaleFor: (s: StoreCode) => number) {
  const days: Record<string, CashDay> = {};
  const start = addDays(isoDate(year, month, 1), -3);
  const end = monthEnd(year, month);
  for (const s of STORES) {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const k = s.code + d;
      const existing = c.w.cash.find((x) => x.store === s.code && x.date === d && x.year === year);
      if (existing) { days[k] = existing; continue; }
      const sc = scaleFor(s.code);
      const row: CashDay = { key: nextKey(c, "cb"), year, store: s.code, date: d, cashSales: money(3_000_000 * sc, 16_000_000 * sc), pettyCashKept: 0, recordedOn: d };
      c.w.cash.push(row);
      days[k] = row;
    }
  }
  return days;
}
function coveredDays(depositDate: string): string[] {
  const wd = weekday(depositDate);
  if (wd === 1) return [addDays(depositDate, -3), addDays(depositDate, -2), addDays(depositDate, -1)];
  return [addDays(depositDate, -1)];
}
function depositDates(year: number, month: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const iso = isoDate(year, month, d);
    const wd = weekday(iso);
    if (wd >= 1 && wd <= 5) out.push(iso);
  }
  return out;
}

// ---------- the year ----------
interface MonthLines { planned: Planned[]; waitingPool: Planned[] }

function buildYear(c: Ctx) {
  const year = YEAR;
  // students for the school (VA payers by store) and dealer invoice counters
  const invoiceCounter: Record<string, number> = {};
  const smallHeldAmounts: BankTxn[] = [];
  const unknownLines: BankTxn[] = [];
  const cDeposits: { txn: BankTxn; day: CashDay }[] = [];

  for (let month = 1; month <= 12; month++) {
    const m: MonthLines = { planned: [], waitingPool: [] };
    const smalls = cfg.oneOffs ? SMALL_STORIES.filter((s) => s.month === month) : [];
    const storyKey = (s: SmallStory) => `small:${s.pattern}:${s.store}:${month}`;
    const smallCash = new Set(smalls.filter((s) => s.pattern === "short_deposit" || s.pattern === "transposition_cash").map((s) => s.store));
    const storyC = cfg.oneOffs && month === STORY_C.month;
    const cStores = storyC ? new Set(STORY_C.stores) : new Set<StoreCode>();

    // --- cash deposits ---
    const cashDays = cashDaysForMonth(c, year, month, (s) => (smallCash.has(s) ? 0.35 : cStores.has(s) ? 0.85 : 1));
    const dDates = depositDates(year, month);
    const cashPlants: Record<string, { pattern: "short" | "transpose" | "petty"; left: number; story: string }> = {};
    for (const s of smalls) if (s.pattern === "short_deposit" || s.pattern === "transposition_cash")
      cashPlants[s.store] = { pattern: s.pattern === "short_deposit" ? "short" : "transpose", left: s.n, story: storyKey(s) };
    // Story C: 38 deposits over 6 stores
    const cPer = [7, 7, 6, 6, 6, 6];
    STORY_C.stores.forEach((st, i) => { if (storyC) cashPlants[st] = { pattern: "petty", left: cPer[i], story: "C" }; });
    for (const s of STORES) {
      const plant = cashPlants[s.code];
      // spread plants across the month: choose which deposit indexes get planted
      const planted = new Set<number>();
      if (plant) {
        const idx = shuffle(dDates.map((_, i) => i)).slice(0, plant.left);
        idx.forEach((i) => planted.add(i));
      }
      // Reversed vouchers: the store posts the day's cash, reverses it, and banks a round amount the next day.
      const rv = cfg.cashReversals;
      const reversed = new Set<number>();
      if (rv && !plant && rv.stores.includes(s.code)) {
        const tueToFri = dDates.map((dd, i) => ({ dd, i })).filter((x) => weekday(x.dd) >= 2);
        shuffle(tueToFri).slice(0, Math.round(rv.perMonth / rv.stores.length)).forEach((x) => reversed.add(x.i));
      }
      dDates.forEach((dd, i) => {
        const days = coveredDays(dd).map((d) => cashDays[s.code + d]);
        let amount = days.reduce((a, d) => a + d.cashSales, 0);
        let story: string | null = null;
        if (plant && planted.has(i)) {
          story = plant.story;
          if (plant.pattern === "short") amount -= money(60_000, 950_000, 100);
          else if (plant.pattern === "transpose") amount = transposeDigits(amount);
          else { const kept = money(400_000, 2_500_000, 50_000); days[days.length - 1].pettyCashKept = kept; amount -= kept; }
        }
        if (rv && reversed.has(i) && amount % rv.roundTo !== 0) {
          days[0].reversed = true; amount = Math.floor(amount / rv.roundTo) * rv.roundTo; story = "L:cash_reversal";
        }
        const cLink = story === "C" ? days[days.length - 1] : null;
        const memo = `CASH DEP SLIP ${sCode(s.code)} ${ddmm(dd)}` + tellerSuffix(s.code);
        const txn = bankTxn(c, year, dd, "BANK_A", amount, memo, s.code, "cash", story);
        m.planned.push({ txn });
        if (story && story !== "C" && !story.startsWith("L:")) smallHeldAmounts.push(txn);
        if (cLink) cDeposits.push({ txn, day: cLink });
      });
    }
    if (storyC) {
      const sum = cDeposits.reduce((a, x) => a + x.txn.amount, 0);
      const delta = STORY_C.total - sum;
      let acc = 0;
      cDeposits.forEach((x, i) => {
        const d = i === cDeposits.length - 1 ? delta - acc : Math.round((delta * x.txn.amount) / sum / 100) * 100;
        acc += d; x.txn.amount += d; x.day.cashSales += d;
        if (x.day.cashSales <= x.day.pettyCashKept) throw new Error("story C calibration made a negative day");
      });
    }
    // Story D: deposits with no slip and no store record
    if (cfg.oneOffs && month === STORY_D.month) {
      const amounts = splitTotal(STORY_D.total, STORY_D.deposits, 20_000_000, 45_000_000, 50_000);
      amounts.forEach((a, i) => {
        const dd = dDates[3 + i * 2];
        m.planned.push({ txn: bankTxn(c, year, dd, "BANK_A", a, `CASH DEP ${ddmm(dd)} TELLER SURABAYA`, null, "cash", "D") });
      });
    }

    // --- marketplace: weekly payout per store per platform ---
    const payoutSmall = smalls.find((s) => s.pattern === "payout_short");
    let payoutPlantLeft = payoutSmall?.n ?? 0;
    for (const platform of ["SHOPEE", "TOKOPEDIA"] as Platform[]) {
      const payDow = platform === "SHOPEE" ? 2 : 5;
      for (let d = 1; d <= daysInMonth(year, month); d++) {
        const payDate = isoDate(year, month, d);
        if (weekday(payDate) !== payDow) continue;
        const weekRef = isoWeek(addDays(payDate, -7));
        for (const s of STORES) {
          const showcase = platform === "SHOPEE" && s.code === "S07" && month === 1 && d <= 7;
          const plantHere = !!payoutSmall && payoutSmall.store === s.code && payoutPlantLeft > 0;
          const n = showcase ? 840 : plantHere ? ri(4, 9) : ri(20, 85);
          let gross = 0, refunds = 0;
          for (let i = 0; i < n; i++) {
            const amt = showcase ? money(255_000, 553_000) : money(120_000, 2_400_000);
            const refund = rand() < 0.02 ? Math.round(amt * 0.5 / 100) * 100 : 0;
            c.w.orders.push({ key: nextKey(c, "mo"), year, platform, store: s.code, week: weekRef, date: addDays(payDate, -ri(7, 13)), amount: amt, refund });
            gross += amt; refunds += refund;
          }
          let net = Math.round(gross * (1 - MARKETPLACE_COMMISSION[platform])) - refunds;
          let story: string | null = null;
          if (payoutSmall && payoutSmall.store === s.code && payoutPlantLeft > 0) {
            net -= money(150_000, 1_800_000); story = storyKey(payoutSmall); payoutPlantLeft--;
          }
          const memo = `${platform} PAYOUT SHOP-${sCode(s.code)} ${weekRef}`;
          const txn = bankTxn(c, year, payDate, "HEAD_OFFICE", net, memo, s.code, "marketplace", story);
          m.planned.push({ txn });
          if (story) smallHeldAmounts.push(txn);
        }
      }
    }

    // --- website: weekly gateway settlement per store (Thursdays) ---
    const cb = smalls.find((s) => s.pattern === "chargeback");
    let cbLeft = cb?.n ?? 0;
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const iso = isoDate(year, month, d);
      if (weekday(iso) !== 4) continue;
      for (const s of STORES) {
        const plantCb = !!cb && cb.store === s.code && cbLeft > 0;
        const gross = plantCb ? money(3_000_000, 9_000_000) : money(4_000_000, 48_000_000);
        const fee = Math.round(gross * WEBSITE_FEE);
        const batchRef = `WB-${s.code}-${isoWeek(iso).slice(2)}`;
        const row: GatewaySettlement = { key: nextKey(c, "gw"), year, store: s.code, batchRef, date: addDays(iso, -1), gross, fee, net: gross - fee, recordedOn: addDays(iso, -1) };
        c.w.gateway.push(row);
        let amount = row.net;
        let story: string | null = null;
        if (plantCb && cb) { amount -= money(200_000, 1_500_000); story = storyKey(cb); cbLeft--; }
        const txn = bankTxn(c, year, iso, "BANK_C", amount, `PG SETTLE ${batchRef}`, s.code, "website", story);
        m.planned.push({ txn });
        if (story) smallHeldAmounts.push(txn);
      }
    }

    // --- dealers: ~480 transfers a month ---
    const over = smalls.find((s) => s.pattern === "overpayment");
    let overLeft = over?.n ?? 0;
    const dealerPlanned: Planned[] = [];
    const nTransfers = 470 + ri(0, 20);
    for (let i = 0; i < nTransfers; i++) {
      const isOver = !!over && overLeft > 0 && rand() < 0.5;
      const dealer = isOver ? pick(DEALERS.filter((d) => d.store === over!.store)) : pick(DEALERS);
      const date = isoDate(year, month, ri(1, daysInMonth(year, month)));
      const k = isOver ? 1 : ri(1, 3);
      const invs: DealerInvoice[] = [];
      for (let j = 0; j < k; j++) {
        invoiceCounter[dealer.code] = (invoiceCounter[dealer.code] ?? 0) + 1;
        const invDate = addDays(date, -ri(20, 60));
        invs.push({
          key: nextKey(c, "di"), year, dealer: dealer.name, store: dealer.store,
          invoiceNo: `${dealer.code}-${String(invoiceCounter[dealer.code]).padStart(4, "0")}`, date: invDate,
          amount: isOver ? money(1_500_000, 4_500_000, 1) : money(4_000_000, 60_000_000, 1), recordedOn: invDate,
        });
      }
      c.w.dealerInvoices.push(...invs);
      const sum = invs.reduce((a, x) => a + x.amount, 0);
      const roll = rand();
      let story: string | null = null;
      if (isOver && over) {
        story = storyKey(over); overLeft--;
        const txn = bankTxn(c, year, date, "BANK_C", sum + money(150_000, 1_200_000), `TRF FROM ${dealer.name.toUpperCase()} INV ${invs.map((x) => x.invoiceNo).join(" ")}`, dealer.store, "dealer", story);
        m.planned.push({ txn }); smallHeldAmounts.push(txn); continue;
      }
      if (roll < 0.05 && k === 1 && Number(date.slice(8)) <= 20) {
        // partial payment, then the rest later in the month
        const part = Math.round(invs[0].amount * (0.4 + rand() * 0.3) / 100) * 100;
        m.planned.push({ txn: bankTxn(c, year, date, "BANK_C", part, `TRF FROM ${dealer.name.toUpperCase()} PART INV ${invs[0].invoiceNo}`, dealer.store, "dealer", null) });
        m.planned.push({ txn: bankTxn(c, year, addDays(date, ri(3, 8)), "BANK_C", invs[0].amount - part, `TRF FROM ${dealer.name.toUpperCase()} INV ${invs[0].invoiceNo}`, dealer.store, "dealer", null) });
        i++;
        continue;
      }
      const fee = roll < 0.17 ? BANK_FEE_IN_TRANSFER : 0;
      const withRefs = roll < 0.75;
      const memo = withRefs ? `TRF FROM ${dealer.name.toUpperCase()} INV ${invs.map((x) => x.invoiceNo).join(" ")}` : `TRF FROM ${dealer.name.toUpperCase()}`;
      const p: Planned = {
        txn: bankTxn(c, year, date, "BANK_C", sum - fee, memo, dealer.store, "dealer", null),
        lateable: withRefs ? (r) => invs.forEach((x) => { x.recordedOn = r; }) : undefined,
      };
      dealerPlanned.push(p);
      m.planned.push(p);
    }

    // --- lenders FIN_X / FIN_Y, and the new lender FIN_Z (from June in the demo) ---
    const lenderPlanned: Planned[] = [];
    const nLender = 315 + ri(0, 15);
    for (let i = 0; i < nLender; i++) {
      const lender: Lender = rand() < 0.55 ? "FIN_X" : "FIN_Y";
      lenderPlanned.push(lenderLine(c, year, month, lender, pick(STORES).code, null, 3_000_000, 45_000_000));
    }
    m.planned.push(...lenderPlanned);
    const nl = cfg.newLender;
    if (nl && nl.launch && month === nl.month) {
      const bStores = STORES.slice(0, STORY_B.stores).map((s) => s.code);
      const bLines: Planned[] = [];
      for (let i = 0; i < STORY_B.matched; i++) bLines.push(lenderLine(c, year, month, "FIN_Z", bStores[i % bStores.length], "B", 6_000_000, 21_000_000));
      scaleLenderTotal(bLines, STORY_B.matchedTotal);
      m.planned.push(...bLines);
      const orphans = splitTotal(STORY_B.orphanTotal, STORY_B.orphan, 7_000_000, 13_000_000, 100);
      orphans.forEach((a, i) => {
        const st = bStores[(i * 3) % bStores.length];
        m.planned.push({ txn: bankTxn(c, year, isoDate(year, month, 10 + i * 4), "BANK_B", a, `FIN_Z DISB ${st} ${ri(100000, 999999)}`, st, "lender", "B") });
      });
    } else if (nl && month >= nl.month) {
      for (let i = 0; i < nl.perMonth; i++) lenderPlanned.push(lenderLine(c, year, month, "FIN_Z", pick(STORES.slice(0, STORY_B.stores)).code, nl.story, 5_000_000, 22_000_000));
      m.planned.push(...lenderPlanned.slice(-nl.perMonth));
    }

    // --- school: VA lesson payments and weekly desk cash ---
    const vaPlanned: Planned[] = [];
    const nVa = 1130 + ri(0, 40);
    for (let i = 0; i < nVa; i++) {
      const st = pick(STORES).code;
      vaPlanned.push(vaLine(c, year, month, st, st, `ST${sCode(st)}-${String(ri(1, 140)).padStart(4, "0")}`, null, money(450_000, 1_750_000, 1000)));
    }
    m.planned.push(...vaPlanned);
    if (cfg.storyA && month <= 3) {
      const n = STORY_A.perMonth[month - 1];
      const lines: Planned[] = [];
      for (let i = 0; i < n; i++) {
        const student = `ST${sCode(STORY_A.vaStore)}-${String(500 + (i % 110)).padStart(4, "0")}`;
        const p = vaLine(c, year, month, STORY_A.vaStore, STORY_A.receiptStore, student, "A", money(700_000, 1_500_000, 1000));
        if (month < 3) p.lateable!(isoDate(year, 3, 3)); // receipts entered only when the term opened in March
        lines.push(p);
      }
      m.planned.push(...lines);
      aLines.push(...lines.map((l) => l.txn));
    }
    // Students who moved class: they pay into their old store's virtual account, the receipt is at the new store.
    for (let i = 0; i < cfg.schoolMoved; i++) {
      const student = `ST${sCode(STORY_A.vaStore)}-${String(500 + (i % 110)).padStart(4, "0")}`;
      m.planned.push(vaLine(c, year, month, STORY_A.vaStore, STORY_A.receiptStore, student, "L:school_moved", money(700_000, 1_500_000, 1000)));
    }
    // Advance school fees: one credit pays several months. The school pre-creates a bill per student per month at
    // zero and fills in the months paid, dated by billing month, not by when the cash came.
    for (let i = 0; i < cfg.advance; i++) {
      const st = pick(STORES).code, k = ri(2, 6), fee = money(450_000, 1_750_000, 1000);
      const date = isoDate(year, month, ri(1, daysInMonth(year, month)));
      const student = `ST${sCode(st)}-${String(2000 + advanceSeq++).padStart(4, "0")}`;
      for (let j = 1; j <= Math.max(12, month + k - 1); j++) {
        const paid = j >= month && j < month + k;
        if (!paid && j > 12) continue;
        const bill = isoDate(year + Math.floor((j - 1) / 12), ((j - 1) % 12) + 1, 1);
        c.w.receipts.push({ key: nextKey(c, "sr"), year, store: st, studentRef: student, method: "va", week: isoWeek(bill), date: bill, amount: paid ? fee : 0, recordedOn: paid ? date : isoDate(year, 1, 1) });
      }
      m.planned.push({ txn: bankTxn(c, year, date, "SCHOOL_VA", k * fee, `VA 8800${sCode(st)}${student.slice(-4)} ${student}`, st, "school_va", "L:school_advance") });
    }
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const iso = isoDate(year, month, d);
      if (weekday(iso) !== 1) continue;
      const wk = isoWeek(addDays(iso, -7));
      for (const s of STORES) {
        const n = ri(8, 20);
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const amt = money(300_000, 1_400_000, 1000);
          const dt = addDays(iso, -ri(1, 7));
          c.w.receipts.push({ key: nextKey(c, "sr"), year, store: s.code, studentRef: `SC${sCode(s.code)}-${String(ri(1, 60)).padStart(3, "0")}`, method: "cash", week: wk, date: dt, amount: amt, recordedOn: dt });
          sum += amt;
        }
        m.planned.push({ txn: bankTxn(c, year, iso, "SCHOOL_VA", sum, `SCHOOL CASH S${sCode(s.code)} ${wk}`, s.code, "school_cash", null) });
      }
    }

    // --- transfers made and cancelled the same day ---
    for (let i = 0; i < 40; i++) {
      const date = isoDate(year, month, ri(1, daysInMonth(year, month)));
      const ref = `HO${month}${String(i).padStart(3, "0")}${ri(10, 99)}`;
      const amt = money(1_000_000, 40_000_000);
      m.planned.push({ txn: bankTxn(c, year, date, "HEAD_OFFICE", amt, `TRF OUT ${ref}`, null, "transfer_pair", null, "out") });
      m.planned.push({ txn: bankTxn(c, year, date, "HEAD_OFFICE", amt, `TRF REVERSAL ${ref}`, null, "transfer_pair", null, "in") });
    }

    // --- unknown senders (small stories) ---
    for (const s of smalls.filter((x) => x.pattern === "unknown_counterparty")) {
      for (let i = 0; i < s.n; i++) {
        const date = isoDate(year, month, ri(2, daysInMonth(year, month)));
        const txn = bankTxn(c, year, date, "HEAD_OFFICE", money(2_000_000, 12_000_000), `TRF FROM UNKNOWN REF ${ri(10000, 99999)} S${sCode(s.store)}`, s.store, "unknown", storyKey(s));
        m.planned.push({ txn }); smallHeldAmounts.push(txn); unknownLines.push(txn);
      }
    }

    // --- card batches fill the month to the brief's exact total ---
    const cardSmalls = smalls.filter((s) => ["fee_overcharge", "duplicate_credit", "transposition_card"].includes(s.pattern));
    const nonCard = m.planned.length;
    const duplicates = cardSmalls.filter((s) => s.pattern === "duplicate_credit").reduce((a, s) => a + s.n, 0);
    const nCard = cfg.totals[month - 1] - nonCard - duplicates;
    if (nCard <= 0) throw new Error("month " + month + " has no room for card batches");
    const slots = shuffle(buildCardSlots(year, month));
    // put planted stores' slots first so each small story can take its quota
    const used = new Set<number>();
    const cardPlanned: Planned[] = [];
    for (const s of cardSmalls) {
      let left = s.n;
      for (let i = 0; i < slots.length && left > 0; i++) {
        if (used.has(i) || slots[i].store !== s.store) continue;
        used.add(i);
        const sl = slots[i];
        if (s.pattern === "duplicate_credit") {
          const p = cardLine(c, year, sl.store, sl.terminal, sl.saleDate, { scale: 0.5 });
          m.planned.push(p);
          const dup = bankTxn(c, year, p.txn.date, p.txn.account, p.txn.amount, p.txn.memo, sl.store, "card", storyKey(s));
          dup.key = p.txn.key + "d"; // sorts right after the original
          c.seq["bt"]--; // keep numbering dense
          m.planned.push({ txn: dup }); smallHeldAmounts.push(dup);
        } else {
          const p = cardLine(c, year, sl.store, sl.terminal, sl.saleDate, {
            scale: 0.45, story: storyKey(s),
            feeOverride: s.pattern === "fee_overcharge" ? 0.029 : undefined, transpose: s.pattern === "transposition_card",
          });
          m.planned.push(p); smallHeldAmounts.push(p.txn);
        }
        left--;
      }
      if (left > 0) throw new Error("not enough card slots for " + s.pattern + " " + s.store);
    }
    const plantedCardCount = cardSmalls.reduce((a, s) => a + s.n, 0); // originals for duplicates count as normal lines
    let remaining = nCard - plantedCardCount;
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      if (used.has(i)) continue;
      used.add(i);
      const p = cardLine(c, year, slots[i].store, slots[i].terminal, slots[i].saleDate);
      cardPlanned.push(p); m.planned.push(p); remaining--;
    }
    if (remaining > 0) throw new Error("not enough card slots in month " + month);

    // --- WAITING: books that arrive after this month's pass ---
    const want = cfg.late === "brief" ? plannedWaiting(month) : Math.round(cfg.totals[month - 1] * cfg.late);
    const nextCutoff = month === 12 ? isoDate(YEAR + 1, 1, 20) : monthEnd(YEAR, month + 1);
    const lateDate = () => {
      const base = addDays(monthEnd(YEAR, month), ri(2, 18));
      return base > nextCutoff ? nextCutoff : base;
    };
    const pools: Planned[][] = [
      shuffle(cardPlanned.filter((p) => p.lateable)),
      shuffle(dealerPlanned.filter((p) => p.lateable)),
      shuffle(lenderPlanned.filter((p) => p.lateable && p.txn.truth.story === null)),
      shuffle(vaPlanned.filter((p) => p.lateable)),
    ];
    const share = [0.7, 0.14, 0.1, 0.06];
    let assigned = 0;
    share.forEach((sh, i) => {
      const n = i === share.length - 1 ? want - assigned : Math.round(want * sh);
      const pool = pools[i];
      if (pool.length < n) throw new Error("waiting pool too small");
      for (let j = 0; j < n; j++) pool[j].lateable!(lateDate());
      assigned += n;
    });

    c.w.bank.push(...m.planned.map((p) => p.txn));
  }

  // --- calibrate story totals to the brief ---
  if (cfg.storyA) scaleTo(aLines, STORY_A.total, 1000, c);
  if (!cfg.oneOffs) return;
  const smallSum = smallHeldAmounts.reduce((a, t) => a + t.amount, 0);
  const gap = SMALL_TOTAL - smallSum;
  // only the unknown-sender lines are free to move: nothing in the books constrains them
  const unknownSum = unknownLines.reduce((a, t) => a + t.amount, 0);
  if (unknownSum + gap <= unknownLines.length * 500_000) throw new Error("small story calibration out of range: " + gap);
  scaleTo(unknownLines, unknownSum + gap, 1, c);
}
const aLines: BankTxn[] = [];
let advanceSeq = 0;

function scaleTo(lines: BankTxn[], target: number, step: number, c: Ctx) {
  const sum = lines.reduce((a, t) => a + t.amount, 0);
  const f = target / sum;
  let acc = 0;
  lines.forEach((t, i) => {
    if (i < lines.length - 1) { t.amount = Math.max(step, Math.round((t.amount * f) / step) * step); acc += t.amount; }
    else t.amount = target - acc;
  });
  // keep school receipts consistent with rescaled VA payments
  const byKey = new Map(lines.map((t) => [t.key, t] as const));
  for (const r of c.w.receipts) {
    const link = receiptLink.get(r.key);
    if (link && byKey.has(link)) r.amount = byKey.get(link)!.amount;
  }
}
const receiptLink = new Map<string, string>(); // receipt key -> bank txn key
const saleLink = new Map<string, InstallmentSale>(); // bank txn key -> sale

function vaLine(c: Ctx, year: number, month: number, vaStore: StoreCode, receiptStore: StoreCode, student: string,
  story: string | null, amount: number): Planned {
  const date = isoDate(year, month, ri(1, daysInMonth(year, month)));
  const rec: SchoolReceipt = { key: nextKey(c, "sr"), year, store: receiptStore, studentRef: student, method: "va", week: isoWeek(date), date, amount, recordedOn: date };
  c.w.receipts.push(rec);
  const txn = bankTxn(c, year, date, "SCHOOL_VA", amount, `VA 8800${sCode(vaStore)}${student.slice(-4)} ${student}`, receiptStore, "school_va", story);
  receiptLink.set(rec.key, txn.key);
  return { txn, lateable: (r) => { rec.recordedOn = r; } };
}

function lenderLine(c: Ctx, year: number, month: number, lender: Lender, store: StoreCode, story: string | null, lo: number, hi: number): Planned {
  const payDate = isoDate(year, month, ri(1, daysInMonth(year, month)));
  const saleDate = addDays(payDate, -ri(2, 6));
  const sale: InstallmentSale = { key: nextKey(c, "is"), year, kind: "installment_sale", store, lender, date: saleDate, amount: money(lo, hi), recordedOn: saleDate };
  c.w.erp.push(sale);
  const amount = Math.round(sale.amount * (1 - (lender === "FIN_Z" && cfg.newLender ? cfg.newLender.cut : LENDER_TRUE_CUT[lender])));
  const txn = bankTxn(c, year, payDate, "BANK_B", amount, `${lender} DISB ${store} ${ri(100000, 999999)}`, store, "lender", story);
  saleLink.set(txn.key, sale);
  return { txn, lateable: (r) => { sale.recordedOn = r; } };
}

function scaleLenderTotal(lines: Planned[], target: number) {
  const sum = lines.reduce((a, p) => a + p.txn.amount, 0);
  const f = target / sum;
  for (const p of lines) {
    const sale = saleLink.get(p.txn.key)!;
    sale.amount = Math.round((sale.amount * f) / 100) * 100;
    p.txn.amount = Math.round(sale.amount * (1 - (cfg.newLender?.cut ?? LENDER_TRUE_CUT.FIN_Z)));
  }
}

function splitTotal(total: number, n: number, lo: number, hi: number, step: number): number[] {
  const xs = Array.from({ length: n }, () => money(lo, hi, step));
  const f = total / xs.reduce((a, b) => a + b, 0);
  let acc = 0;
  return xs.map((x, i) => {
    if (i === n - 1) return total - acc;
    const v = Math.round((x * f) / step) * step; acc += v; return v;
  });
}

// ---------- last year: school and lender channels in full, plus one sample month of everything ----------
function buildLastYear(c: Ctx) {
  const year = LAST_YEAR;
  // Lenders: exactly 3,950 payouts across the year.
  let lenderLeft = 3950;
  for (let month = 1; month <= 12; month++) {
    const n = month === 12 ? lenderLeft : 325 + ri(-8, 8);
    lenderLeft -= n;
    for (let i = 0; i < n; i++) {
      const p = lenderLine(c, year, month, rand() < 0.55 ? "FIN_X" : "FIN_Y", pick(STORES).code, null, 3_000_000, 45_000_000);
      c.w.bank.push(p.txn);
    }
  }
  // School VA: about 13,000 payments; 2,310 where the VA range and the receipt disagree.
  // In 2,303 the receipt store is right (the class moved); in 7 the receipt was keyed at the wrong store.
  let conflicts = 0;
  for (let month = 1; month <= 12; month++) {
    for (let i = 0; i < 1080; i++) {
      const st = pick(STORES).code;
      const p = vaLine(c, year, month, st, st, `ST${sCode(st)}-${String(ri(1, 140)).padStart(4, "0")}`, null, money(450_000, 1_750_000, 1000));
      c.w.bank.push(p.txn);
    }
    const nConf = month === 12 ? 2310 - conflicts : 192 + ri(-6, 6);
    conflicts += nConf;
    for (let i = 0; i < nConf; i++) {
      const va = pick(STORES);
      const rc = STORES[(va.number + ri(0, 12)) % 14];
      const p = vaLine(c, year, month, va.code, rc.code, `ST${sCode(va.code)}-${String(600 + ri(0, 199)).padStart(4, "0")}`, null, money(450_000, 1_750_000, 1000));
      p.txn.truth.story = "ly_conflict";
      c.w.bank.push(p.txn);
    }
  }
  // the 7 receipts keyed at the wrong store: truth is the VA store
  const conflictsAll = c.w.bank.filter((t) => t.year === year && t.truth.story === "ly_conflict");
  for (const t of shuffle([...conflictsAll]).slice(0, 7)) {
    t.truth.store = ("S" + t.memo.slice(7, 9)) as StoreCode;
    t.truth.story = "ly_conflict_receipt_wrong";
  }

  // Sample month: everything else for October.
  const month = SAMPLE_MONTH_LAST_YEAR;
  const before = c.w.bank.length;
  const cashDays = cashDaysForMonth(c, year, month, () => 1);
  for (const s of STORES) for (const dd of depositDates(year, month)) {
    const amount = coveredDays(dd).reduce((a, d) => a + cashDays[s.code + d].cashSales, 0);
    c.w.bank.push(bankTxn(c, year, dd, "BANK_A", amount, `CASH DEP SLIP ${sCode(s.code)} ${ddmm(dd)}` + tellerSuffix(s.code), s.code, "cash", null));
  }
  for (const slot of shuffle(buildCardSlots(year, month)).slice(0, 5150)) c.w.bank.push(cardLine(c, year, slot.store, slot.terminal, slot.saleDate).txn);
  for (const platform of ["SHOPEE", "TOKOPEDIA"] as Platform[]) for (let d = 1; d <= 31; d++) {
    const payDate = isoDate(year, month, d);
    if (weekday(payDate) !== (platform === "SHOPEE" ? 2 : 5)) continue;
    const weekRef = isoWeek(addDays(payDate, -7));
    for (const s of STORES) {
      let gross = 0, refunds = 0;
      for (let i = 0, n = ri(20, 80); i < n; i++) {
        const amt = money(120_000, 2_400_000); const refund = rand() < 0.02 ? Math.round(amt * 0.5 / 100) * 100 : 0;
        c.w.orders.push({ key: nextKey(c, "mo"), year, platform, store: s.code, week: weekRef, date: addDays(payDate, -ri(7, 13)), amount: amt, refund });
        gross += amt; refunds += refund;
      }
      c.w.bank.push(bankTxn(c, year, payDate, "HEAD_OFFICE", Math.round(gross * (1 - MARKETPLACE_COMMISSION[platform])) - refunds, `${platform} PAYOUT SHOP-${sCode(s.code)} ${weekRef}`, s.code, "marketplace", null));
    }
  }
  for (let d = 1; d <= 31; d++) {
    const iso = isoDate(year, month, d);
    if (weekday(iso) !== 4) continue;
    for (const s of STORES) {
      const gross = money(4_000_000, 48_000_000); const fee = Math.round(gross * WEBSITE_FEE);
      const batchRef = `WB-${s.code}-${isoWeek(iso).slice(2)}`;
      c.w.gateway.push({ key: nextKey(c, "gw"), year, store: s.code, batchRef, date: addDays(iso, -1), gross, fee, net: gross - fee, recordedOn: addDays(iso, -1) });
      c.w.bank.push(bankTxn(c, year, iso, "BANK_C", gross - fee, `PG SETTLE ${batchRef}`, s.code, "website", null));
    }
  }
  const ctr: Record<string, number> = {};
  for (let i = 0; i < 485; i++) {
    const dealer = pick(DEALERS); const date = isoDate(year, month, ri(1, 31));
    ctr[dealer.code] = (ctr[dealer.code] ?? 0) + 1;
    const invDate = addDays(date, -ri(20, 60));
    const inv: DealerInvoice = { key: nextKey(c, "di"), year, dealer: dealer.name, store: dealer.store, invoiceNo: `${dealer.code}-L${String(ctr[dealer.code]).padStart(3, "0")}`, date: invDate, amount: money(4_000_000, 60_000_000), recordedOn: invDate };
    c.w.dealerInvoices.push(inv);
    const fee = rand() < 0.37 ? BANK_FEE_IN_TRANSFER : 0;
    c.w.bank.push(bankTxn(c, year, date, "BANK_C", inv.amount - fee, `TRF FROM ${dealer.name.toUpperCase()} INV ${inv.invoiceNo}`, dealer.store, "dealer", null));
  }
  for (let i = 0; i < 80; i++) {
    const date = isoDate(year, month, ri(1, 31)); const ref = `HL${String(i).padStart(3, "0")}${ri(10, 99)}`; const amt = money(1_000_000, 40_000_000);
    c.w.bank.push(bankTxn(c, year, date, "HEAD_OFFICE", amt, `TRF OUT ${ref}`, null, "transfer_pair", null, "out"));
    c.w.bank.push(bankTxn(c, year, date, "HEAD_OFFICE", amt, `TRF REVERSAL ${ref}`, null, "transfer_pair", null, "in"));
  }
  void before;
}

// ---------- books: 70 sub accounts and the impossible head office balance ----------
function buildLedger(c: Ctx) {
  const target = -48_600_000_000;
  const accounts: BankAccountCode[] = ["BANK_A", "BANK_B", "BANK_C", "SCHOOL_VA", "HEAD_OFFICE"];
  for (const a of accounts) {
    const rows: LedgerAccount[] = STORES.map((s) => ({ code: `${a}/${s.code}`, bankAccount: a, store: s.code, bookBalance: 0 }));
    if (a === "HEAD_OFFICE") {
      const parts = splitTotal(-target, 14, 2_000_000_000, 5_000_000_000, 1000);
      rows.forEach((r, i) => { r.bookBalance = -parts[i]; });
    } else {
      rows.forEach((r) => { r.bookBalance = money(800_000_000, 4_200_000_000, 1000); });
    }
    c.w.ledger.push(...rows);
  }
  c.w.bankBalances = { BANK_A: 21_480_000_000, BANK_B: 17_930_000_000, BANK_C: 9_260_000_000, SCHOOL_VA: 2_110_000_000, HEAD_OFFICE: 3_240_000_000 };
}

export function generateWorld(config: MessConfig = DEFAULT_MESS): World {
  cfg = config;
  rand = mulberry32(config.seed);
  aLines.length = 0; receiptLink.clear(); saleLink.clear(); advanceSeq = 0;
  const c: Ctx = {
    w: { bank: [], erp: [], cash: [], orders: [], gateway: [], dealerInvoices: [], receipts: [], ledger: [], bankBalances: { BANK_A: 0, BANK_B: 0, BANK_C: 0, SCHOOL_VA: 0, HEAD_OFFICE: 0 } },
    seq: {},
  };
  buildYear(c);
  buildLastYear(c);
  buildLedger(c);
  c.w.bank.sort((a, b) => (a.date === b.date ? (a.key < b.key ? -1 : 1) : a.date < b.date ? -1 : 1));
  return c.w;
}
