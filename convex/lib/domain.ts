// Shared domain model for Fermata. Used by the generator, the engine and the UI.
// Everything here is invented. No real stores, people, banks or account numbers.

export const YEAR = 2025;
export const LAST_YEAR = 2024;
export const SAMPLE_MONTH_LAST_YEAR = 10; // the one fully synthetic month of last year

export type StoreCode =
  | "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S07"
  | "S08" | "S09" | "S10" | "S11" | "S12" | "S13" | "S14";

export interface StoreDef {
  code: StoreCode;
  number: number;
  name: string;
  city: string;
  terminals: number; // card terminals, each settles one batch per day
  cardBank: BankAccountCode; // where its card batches land
}

const CITIES = [
  "Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Tangerang", "Bekasi", "Bogor", "Bandung",
  "Semarang", "Yogyakarta", "Surabaya", "Malang", "Denpasar", "Medan", "Makassar",
];

export const STORES: StoreDef[] = CITIES.map((city, i) => {
  const n = i + 1;
  return {
    code: ("S" + String(n).padStart(2, "0")) as StoreCode,
    number: n,
    name: "Store " + n,
    city,
    terminals: 12 + (n % 5) * 2,
    cardBank: n <= 7 ? "BANK_A" : "BANK_B",
  };
});

export const STORE_BY_CODE: Record<string, StoreDef> = Object.fromEntries(STORES.map((s) => [s.code, s]));

export type BankAccountCode = "BANK_A" | "BANK_B" | "BANK_C" | "SCHOOL_VA" | "HEAD_OFFICE";

export const BANK_ACCOUNTS: { code: BankAccountCode; name: string; purpose: string }[] = [
  { code: "BANK_A", name: "Bank A main", purpose: "Card batches for Stores 1 to 7, all store cash deposits" },
  { code: "BANK_B", name: "Bank B second", purpose: "Card batches for Stores 8 to 14, lender payouts" },
  { code: "BANK_C", name: "Bank C third", purpose: "Dealer transfers, website settlements" },
  { code: "SCHOOL_VA", name: "School fees (virtual)", purpose: "Music school fees by virtual account and desk cash" },
  { code: "HEAD_OFFICE", name: "Head office", purpose: "Marketplace payouts, transfers" },
];

export type Channel =
  | "card" | "cash" | "marketplace" | "website" | "dealer" | "lender"
  | "school_va" | "school_cash" | "transfer_pair" | "unknown";

// Contract fees
export const CARD_DEBIT_FEE = 0.01;
export const CARD_CREDIT_FEE = 0.018;
export const WEBSITE_FEE = 0.029;
export const MARKETPLACE_COMMISSION: Record<Platform, number> = { SHOPEE: 0.065, TOKOPEDIA: 0.06 };
export type Platform = "SHOPEE" | "TOKOPEDIA";
export const PLATFORM_LABEL: Record<Platform, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia" };

export type Lender = "FIN_X" | "FIN_Y" | "FIN_Z";
// FIN_Z is not known to last year's rules. Its true cut is 3.8%.
export const LENDER_TRUE_CUT: Record<Lender, number> = { FIN_X: 0.03, FIN_Y: 0.045, FIN_Z: 0.038 };

export const BANK_FEE_IN_TRANSFER = 2500;
export const CASH_TOLERANCE = 5000;
export const PLACEMENT_THRESHOLD = 0.85;
export const WAITING_MAX_DAYS = 75;

// Dealers: three per store, invented names.
const DEALER_WORDS = ["Nada", "Irama", "Melodi", "Gita", "Swara", "Laras", "Tembang", "Kidung", "Senandung", "Dendang", "Ritme", "Akor", "Notasi", "Birama"];
const DEALER_SUFFIX = ["Jaya", "Abadi", "Makmur"];
export const DEALERS: { code: string; name: string; store: StoreCode }[] = STORES.flatMap((s, i) =>
  DEALER_SUFFIX.map((suf, j) => ({
    code: "D" + String(i * 3 + j + 1).padStart(2, "0"),
    name: "CV " + DEALER_WORDS[(i + j * 5) % DEALER_WORDS.length] + " " + suf,
    store: s.code,
  })),
);
export const DEALER_BY_NAME: Record<string, { code: string; name: string; store: StoreCode }> = Object.fromEntries(
  DEALERS.map((d) => [d.name.toUpperCase(), d]),
);

// Demo-year targets from the brief.
export const MONTHLY_TOTALS = [8100, 8040, 8320, 8510, 8660, 8920, 8890, 9010, 8960, 9120, 9040, 9250];
export const FIRST_PASS_RATE = [0.81, 0.84, 0.86, 0.92, 0.93, 0.89, 0.95, 0.96, 0.965, 0.97, 0.975, 0.98];
export const QUESTIONS_PER_MONTH = [8, 6, 5, 3, 2, 4, 1, 1, 1, 0, 0, 0];
// The two narrated stories whose case rooms meet live with Claude.
export const STORY_A_KEY = "placement_conflict|S03|school_va";
export const STORY_B_KEY = "unknown_lender|FIN_Z";

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
export function weekday(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay(); // 0 Sunday
}
export function monthEnd(year: number, month: number): string {
  return isoDate(year, month, daysInMonth(year, month));
}
export function isoWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}W${String(week).padStart(2, "0")}`;
}
