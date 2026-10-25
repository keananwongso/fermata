# Fermata 𝄐

**Self-learning cash reconciliation for multi-store retail.**

**[getfermata.tech](https://getfermata.tech)** · [live demo](https://getfermata.tech/demo) · [how it works](https://getfermata.tech/#how)

Picture fourteen stores sharing five bank accounts, with money coming in from marketplaces, dealers and a music school, and systems that don't agree on any of it. Every month, a team spends weeks matching it all by hand.

Fermata does that on its own. It learns the business from the books you already have, settles every bank line it can explain, holds the rest, and asks the right person one question. Each answer becomes a tested rule, so the same question never comes back.

## How we use Convex

Convex runs the whole close: an indexed schema, transactional mutations with an audit row per step, and a scheduler that pages through each month.
Claude case rooms and the rule learner run as Convex actions, chained through the scheduler.
The console screens read through `useQuery`, so runs, case rooms and rules update live without a refresh.
Ask the books is a rate limited Convex action (`@convex-dev/rate-limiter`) over named read only queries.
Details, file by file, are in [hackathon.md](hackathon.md).

## What it does

- **Learns from your old books first.** Before month one, it mines last year's matched lines into rules.
- **Matches money to where it came from,** even when one payout covers hundreds of orders.
- **Holds instead of guessing,** and agents meet on what's held.
- **Learns from people.** Every answer becomes a backtested rule.
- **Never writes on its own.** Agents propose, people approve, every step is recorded.
- **Ask the books.** Hold the button at the bottom of any page and ask out loud.

## How it's built

- **Day 0.** Code mines last year's matched lines, fits each pattern (a fee, a commission, a lender's cut) and writes it as a rule. The CFO approves each rule once.
- **Engine.** TypeScript, no AI. It places every bank line at a store, matches it to its records, and settles it if an approved rule explains it within that rule's limit.
- **Case rooms.** Whatever no rule explains is held as a story. Three Claude agents meet on it: the Investigator finds the pattern, the Auditor tries to break it, and the Learner drafts the rule. A meeting manager written in code stops them at six turns and asks a person once.
- **Learning.** The answer becomes a draft rule. It is backtested on past books, approved by the CFO, and from then on settles that kind of line on its own.
- **One way to change anything.** Every change goes through one Convex `transition()`, which checks the role and writes the audit row. Only the gateway posts to the books, and a refused step is recorded too.

Next.js on Vercel · Convex · Claude · Cartesia for voice.

## Run it yourself

```bash
npm install
cp .env.example .env.local
npx convex dev
npm run seed -- --preset learning
npm run dev
```

[Setup, the console and the details →](docs/guide.md)

Built at Cal Hacks 13.0.
