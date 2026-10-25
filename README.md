# Fermata 𝄐

**Self-learning cash reconciliation for multi-store retail.**

**[getfermata.tech](https://getfermata.tech)**

Picture fourteen stores sharing five bank accounts, with money coming in from marketplaces, dealers and a music school, and systems that don't agree on any of it. Every month, a team spends weeks matching it all by hand.

Fermata does that on its own. It settles every bank line it can explain, holds the rest, and asks the right person one question. Each answer becomes a tested rule, so the same question never comes back.

All data is synthetic.

## What it does

- **Matches money to where it came from,** even when one payout covers hundreds of orders.
- **Holds instead of guessing,** and agents meet on what's held.
- **Learns from people.** Every answer becomes a backtested rule.
- **Never writes on its own.** Agents propose, people approve, every step is recorded.
- **Ask the books.** Hold the button at the bottom of any page and ask out loud.

## Run it yourself

```bash
npm install
cp .env.example .env.local
npx convex dev
npm run seed -- --preset learning
npm run dev
```

[How it works, setup and the console →](docs/guide.md)

Built at Cal Hacks 13.0.
