// Clears everything the close produced, keeping synced bank lines, books and rules r1 to r7.
// Runs in small steps from the client so no single Convex call hits a time limit. Run: npm run reset
import { execFileSync } from "node:child_process";

const run = (fn: string, args: object = {}): string =>
  execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], { encoding: "utf8" }).trim();

// Stop a close that is still running first: its steps write work_items while the batches delete them.
run("seed:resetRunState");

let deleted = 0;
for (;;) {
  const r = JSON.parse(run("seed:resetBatch")) as { deleted: number; done: boolean };
  deleted += r.deleted;
  process.stdout.write(`\rdeleted ${deleted} derived rows`);
  if (r.done && r.deleted === 0) break;
}
console.log();
for (const table of ["erp_invoices", "cash_book", "marketplace_orders", "gateway_settlements", "dealer_invoices", "school_receipts"]) {
  let cursor: string | null = null;
  do {
    const out = run("seed:resetCounterparts", { table, cursor });
    // `convex run` prints nothing when the function returns null
    cursor = !out || out === "null" ? null : (JSON.parse(out) as string);
  } while (cursor);
  console.log(`reopened ${table}`);
}
run("seed:resetRunState");
console.log("ready to close the year again");
