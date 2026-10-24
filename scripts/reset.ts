// Clears everything the close produced, keeping synced bank lines, books and rules r1 to r7.
// Run: npm run reset
import { execFileSync } from "node:child_process";

const out = execFileSync("npx", ["convex", "run", "seed:resetAll", "{}"], { encoding: "utf8" }).trim();
console.log(`deleted ${out} derived rows; ready to close the year again`);
