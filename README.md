# Fermata 𝄐

**Every line settles on its own. Fermata only holds where it should.**

Fermata is a prototype of an autonomous cash reconciliation system for a fictional Indonesian music retailer: 14 stores with a music school inside them, six sales channels, five bank accounts shared by all stores, and one year of books in rupiah. It closes the year month by month. It places every bank line at a store, matches it to the sales it pays for, settles what an approved rule explains, and holds the rest. Held lines are grouped into stories by root cause, and each story gets one question for the right person. Answers become rules, which are backtested on last year's data before the CFO approves them.

A fermata is the music mark that means hold.

> **All data is synthetic.** Every store, dealer, student, lender, account and amount is invented by a deterministic generator (`convex/lib/generate.ts`). Nothing here is a real business record.

## Run it

Requirements: Node 20+, npm, a Convex account, an Anthropic API key.

```bash
npm install
cp .env.example .env.local          # fill in values locally, never commit them
npx convex dev                       # creates or links a deployment, writes NEXT_PUBLIC_CONVEX_URL to .env.local
npx convex env set ANTHROPIC_API_KEY <your key>   # agents run in Convex actions and read it there
npm run seed -- --preset learning    # generates the learning year and loads it (about 400k rows); plain `npm run seed` loads the earlier default world
npm run dev                          # http://localhost:3000
```

Then open **Run** and press **Close the year**. Where the close pauses follows from the stories, not the calendar: it waits at a month's close while a question there could teach a rule. In the learning year that is January (school fees whose receipts sit at another store, met live by Claude, and cash deposits after a reversed voucher), March (school credits that pay several months at once) and June (a new lender, met live by Claude). Switch between Accountant and CFO in the header. Tick **Autopilot** for a hands-free run: it answers every question from the generator's answer key, approves each rule as the CFO once its backtest is in, and its answers are labelled as such in the record.

To record the demo: close the learning year on autopilot, run the evaluation from the **Evaluation** screen, then `npx tsx --env-file=.env.local scripts/export_demo.ts --preset learning`. It writes `src/demo/recording.json`: the rooms, questions, rules and evaluation from the run, the engine's months replayed offline with the run's own rules (it checks them against the run month by month), and the same year with the rules frozen at onboarding as the simulated baseline. Every figure on the site reads this one file.

Other scripts:

- `npm run simulate` runs the same engine offline over a year, with learning and without, and prints both curves. Its default world is the learning year (`learningMess` in `convex/lib/generate.ts`): no first-pass rate is planted, so the gap between the curves is what learning did. Knobs answer what-ifs, e.g. `npm run simulate -- --advance 500 --lender 0.038@3 --learn r9@8` (the console's **What if** screen runs the same thing with knobs and a chart); `--preset default` runs the recorded demo's world, whose late records are planted to hit the brief's rates. The simulator's Learner is deterministic code: answers come from the generator's answer key, and each rule's parameters are fitted from the data and backtested before it applies. The live close learns the same rules in the same months: r10 and r11 are fitted by the same code (`convex/lib/learn.ts`), r8 and r9 are written by Claude in their case rooms.
- `npm run reset` clears everything the close produced so it can run again on the same synced data.

### Deploying the frontend

Vercel: import the repository and set `NEXT_PUBLIC_CONVEX_URL` to your Convex deployment URL. For a production Convex deployment, run `npx convex deploy` and set `ANTHROPIC_API_KEY` on it too.

## Architecture

- **Convex** holds every table (`convex/schema.ts`). One function, `transition()` in `convex/lib/transition.ts`, changes any state. It checks a ROLES table and a TRANSITIONS table in code, and writes the change and an append-only `audit_log` row with a diff in the same mutation. Denied attempts are logged too.
- **States**: NEW, PROPOSED, APPROVED, POSTED, plus WAITING (its records have not arrived; an existing rule will settle it later), NEEDS_INFO and HELD (only story items).
- **Roles**: sync, engine, investigator, learner, auditor, accountant, cfo, gateway. Nobody approves their own proposal. Only the gateway posts. The engine approves a settlement only under an approved rule's limit and records "rule rX vN, approved by CFO" as the authority; this delegated approval is the one case where the proposer and approver are both the engine. Agents never approve or post.
- **Engine** (`convex/lib/engineCore.ts`, plain TypeScript, no AI): parses each memo, places the line at a store by weighing evidence into a confidence, matches one-to-one and many-to-many (marketplace payout to its orders minus commission, dealer transfer to a subset of open invoices, school deposit to a week of receipts), settles under approved rules, and groups what is left into stories. The same code runs offline (`scripts/simulate.ts`) and in Convex batches (`convex/engine.ts`, `convex/run.ts`).
- **Rules** are small JSON programs (`convex/lib/rules.ts`). r1 to r7 are fitted by the Learner from last year's rows (`convex/learner.ts`).
- **Agents** (`convex/agents.ts`) call Claude from Convex actions. Real Claude calls: the Investigator's reasoning and question for the FIN_Z story, and the Learner writing rule r8. Other agent text is scripted and labelled "scripted" on screen.
- **Frontend**: Next.js App Router, TypeScript, Tailwind, Convex React hooks for live updates. Five screens: Run, Stories, Rules, Evaluation, Record.
