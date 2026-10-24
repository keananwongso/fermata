// Row shapes shared by the generator, the offline simulator and the Convex engine.
import type { BankAccountCode, Channel, Lender, Platform, StoreCode } from "./domain";

export interface Truth {
  store: StoreCode | null; // where the money really belongs (never read by the engine)
  channel: Channel;
  story: string | null; // planted root cause, used only for evaluation
}

export interface BankTxn {
  key: string;
  year: number;
  month: number;
  date: string;
  account: BankAccountCode;
  direction: "in" | "out";
  amount: number;
  memo: string;
  truth: Truth;
}

export interface CardSales {
  key: string; year: number; kind: "card_sales"; store: StoreCode; terminal: number; date: string;
  debitGross: number; creditGross: number; recordedOn: string;
}
export interface InstallmentSale {
  key: string; year: number; kind: "installment_sale"; store: StoreCode; lender: Lender; date: string;
  amount: number; recordedOn: string;
}
export type ErpInvoice = CardSales | InstallmentSale;

export interface CashDay {
  key: string; year: number; store: StoreCode; date: string; cashSales: number; pettyCashKept: number; recordedOn: string;
  reversed?: boolean; // the day's cash voucher was posted and then reversed
}
export interface MarketOrder {
  key: string; year: number; platform: Platform; store: StoreCode; week: string; date: string; amount: number; refund: number;
}
export interface GatewaySettlement {
  key: string; year: number; store: StoreCode; batchRef: string; date: string; gross: number; fee: number; net: number; recordedOn: string;
}
export interface DealerInvoice {
  key: string; year: number; dealer: string; store: StoreCode; invoiceNo: string; date: string; amount: number; recordedOn: string;
}
export interface SchoolReceipt {
  key: string; year: number; store: StoreCode; studentRef: string; method: "va" | "cash"; week: string; date: string;
  amount: number; recordedOn: string;
}

export interface LedgerAccount { code: string; bankAccount: BankAccountCode; store: StoreCode; bookBalance: number }

export interface World {
  bank: BankTxn[];
  erp: ErpInvoice[];
  cash: CashDay[];
  orders: MarketOrder[];
  gateway: GatewaySettlement[];
  dealerInvoices: DealerInvoice[];
  receipts: SchoolReceipt[];
  ledger: LedgerAccount[];
  bankBalances: Record<BankAccountCode, number>;
}
