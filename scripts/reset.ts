// Clears everything the close produced, keeping synced bank lines, books and rules r1 to r7.
// Run: npm run reset
import { execFileSync } from "node:child_process";

const run = (fn: string, args: object = {}) =>
  execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], { encoding: "utf8" }).trim();

let done = false;
let total = 0;
while (!done) {
  const r = JSON.parse(run("seed:resetBatch")) as { deleted: number; done: boolean };
  total += r.deleted;
  done = r.done;
  process.stdout.write(`\rdeleted ${total} derived rows`);
}
console.log();
for (const table of ["erp_invoices", "cash_book", "marketplace_orders", "gateway_settlements", "dealer_invoices", "school_receipts"]) {
  let cursor: string | null = null;
  do {
    const out = run("seed:resetCounterparts", { table, cursor });
    cursor = out === "null" ? null : (JSON.parse(out) as string);
  } while (cursor);
  console.log(`reopened ${table}`);
}
run("seed:resetRunState");
console.log("ready to close the year again");
