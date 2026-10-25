# Fermata: how it works and how to run it

The longer companion to the [README](../README.md). All data is synthetic: every store, dealer, student, lender, account and amount is invented by a deterministic generator (`convex/lib/generate.ts`). Nothing here is a real business record.

## Setup

You'll need Node 20+, npm, a Convex account, an Anthropic API key, and a Cartesia key if you want voice.

```bash
npm install
cp .env.example .env.local                      # fill in locally, never commit
npx convex dev                                   # creates or links a deployment, writes NEXT_PUBLIC_CONVEX_URL
npx convex env set ANTHROPIC_API_KEY <key>       # agents run in Convex actions and read it there
npx convex env set CARTESIA_API_KEY <key>        # voice for Ask the books
npx convex env set CONSOLE_KEY <long random string>
npm run seed -- --preset learning                # the learning year; plain `npm run seed` loads the earlier default world
npm run dev                                      # http://localhost:3000
```

Put the same console key in `.env.local` as `NEXT_PUBLIC_FERMATA_CONSOLE_KEY`. Every public function that writes, starts a run or calls Claude checks it. Never set it on a hosted site.

## The console

Run locally, the console sits behind the console key.

- **Run.** Press **Close the year**. The close pauses where a question could teach a rule. In the learning year that's January (school fees whose receipts sit at another store, met live by Claude, and cash deposits after a reversed voucher), March (school credits that pay several months at once) and June (a new lender, met live by Claude). Switch between Accountant and CFO in the header. Tick **Autopilot** for a hands-free run: it answers every question from the generator's answer key and approves each rule as the CFO once its backtest is in. Its answers are labelled as such in the record.
- **Case rooms, Rules, Evaluation, Record.** Every meeting, every rule with its backtest, the score against the hidden answer key, and the audit log.
- **Scenarios.** Inject a case of your own into the closed year: a new lender with any name and cut, the same with the CFO saying no, a deposit no store recorded, or a dealer paying open invoices. The real engine, agents and people handle it live. Reset between tries.
- **What if.** Knobs for the world (when a new lender arrives, how many records arrive late, when an answer is given) and the year closed twice, with and without learning, drawn as one chart.

## Recording the demo

Close the learning year on autopilot, run the evaluation from the **Evaluation** screen, then:

```bash
npx tsx --env-file=.env.local scripts/export_demo.ts --preset learning
```

It writes `src/demo/recording.json`:
- the rooms, questions, rules and evaluation from the run;
- the engine's months, replayed offline with the run's own rules and checked against the run month by month;
- the same year with the rules frozen at onboarding, as the simulated baseline.

Every figure on the site reads this one file.

## Other scripts

- **`npm run simulate`** runs the same engine offline over a year, with learning and without, and prints both curves. Its default world is the learning year (`learningMess` in `convex/lib/generate.ts`). No first-pass rate is planted, so the gap between the curves is what learning did.
  - Knobs answer what-ifs, e.g. `npm run simulate -- --advance 500 --lender 0.038@3 --learn r9@8`.
  - `--preset default` runs the earlier world, whose late records were planted to hit set rates.
  - The simulator's Learner is deterministic code. Answers come from the answer key, and each rule's parameters are fitted from the data and backtested before it applies. The live close learns the same rules in the same months: r10 and r11 are fitted by the same code (`convex/lib/learn.ts`), and r8 and r9 are written by Claude in their case rooms.
- **`npm run reset`** clears everything the close produced, so it can run again on the same synced data.

## How it's built

**Convex is the whole backend:** sync, the system of work, the agents, the meeting transcripts and the audit trail.

- **One function changes any state.** `transition()` in `convex/lib/transition.ts` checks a roles table and a transitions table in code. It writes the change and an append-only `audit_log` row with a diff in the same mutation, and denied attempts are logged too.
- **States:** NEW, PROPOSED, APPROVED, POSTED, plus WAITING (the records haven't arrived yet; an existing rule will settle it later), NEEDS_INFO and HELD (story items only).
- **Roles:** sync, engine, investigator, learner, auditor, accountant, cfo, gateway, and a read-only assistant for Ask the books.
  - Nobody approves their own proposal, and only the gateway posts.
  - The engine approves a settlement only within an approved rule's limit, and records "rule rX vN, approved by CFO" as the authority.
  - Agents never approve or post.
- **The engine** (`convex/lib/engineCore.ts`) is plain TypeScript with no AI.
  - It parses each memo and places the line at a store by weighing evidence into a confidence.
  - It matches one-to-one and many-to-many: a marketplace payout to its orders minus commission, a dealer transfer to a subset of open invoices, a school deposit to a week of receipts.
  - It settles under approved rules and groups what's left into stories.
  - The same code runs offline (`scripts/simulate.ts`) and in Convex batches (`convex/engine.ts`, `convex/run.ts`).
- **Rules** are small JSON programs (`convex/lib/rules.ts`) with versions, limits and backtests. r1 to r7 are learned from last year's books at onboarding (`convex/learner.ts`). Later rules come from people's answers and corrections.
- **Case rooms** (`convex/roomAgents.ts`, `convex/rooms.ts`): the Investigator, Auditor and Learner call Claude from Convex actions, with tools that wrap read-only queries. A meeting manager in code gives the floor, stops at six turns and won't let them ask a person before the Auditor has checked. The big rooms run live on Claude; smaller ones are scripted, and every message is labelled real or scripted on screen.
- **Ask the books** (`convex/ask.ts`) picks an answer template and a query with Claude, fills every number in code, and speaks the answer through Cartesia. It's rate limited with `@convex-dev/rate-limiter`.
- **Frontend:** Next.js App Router, TypeScript and Tailwind, with Convex React hooks for live views.

## Deploying

On Vercel, import the repository and set `NEXT_PUBLIC_CONVEX_URL` to your Convex deployment's URL. The landing page, demo, dashboard and pitch read the exported recording and need no backend. Only Ask the books calls Convex live. Set `ANTHROPIC_API_KEY`, `CARTESIA_API_KEY` and `CONSOLE_KEY` on the Convex deployment, never the console key on Vercel.
