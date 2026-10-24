// Generates the synthetic world and loads it into Convex. Run: npm run seed
// Needs CONVEX_DEPLOY_KEY (or a logged-in `npx convex dev`). All data is synthetic.
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { generateWorld } from "../convex/lib/generate";

const dir = ".seed";
mkdirSync(dir, { recursive: true });
const w = generateWorld();

const tables: Record<string, object[]> = {
  bank_transactions: w.bank,
  erp_invoices: w.erp.map((e) => ({ ...e, applied: 0 })),
  cash_book: w.cash.map((c) => ({ ...c, applied: 0 })),
  marketplace_orders: w.orders.map((o) => ({ ...o, applied: 0 })),
  gateway_settlements: w.gateway.map((g) => ({ ...g, applied: 0 })),
  dealer_invoices: w.dealerInvoices.map((d) => ({ ...d, applied: 0 })),
  school_receipts: w.receipts.map((r) => ({ ...r, applied: 0 })),
};
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;

function run(args: string[]) {
  execFileSync("npx", ["convex", ...args], { stdio: "inherit" });
}

const empty = ["stores", "bank_accounts", "ledger_accounts", "work_items", "stories", "rules", "precedents", "questions", "trace_events", "journal_entries", "eval_runs", "audit_log"];
if (!only) {
  for (const t of empty) {
    const f = `${dir}/${t}.jsonl`;
    writeFileSync(f, "");
    run(["import", "--table", t, "--replace", "-y", "--format", "jsonLines", f]);
  }
}
for (const [t, rows] of Object.entries(tables)) {
  if (only && !only.includes(t)) continue;
  const f = `${dir}/${t}.jsonl`;
  writeFileSync(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${t}: ${rows.length} rows`);
  run(["import", "--table", t, "--replace", "-y", "--format", "jsonLines", f]);
}
if (!only) {
  run(["run", "seed:init", JSON.stringify({ ledger: w.ledger, balances: w.bankBalances })]);
  run(["run", "learner:deriveSeedRules", "{}"]);
}
console.log("seeded");
