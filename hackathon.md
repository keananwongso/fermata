# Hackathon log

- **Project:** Fermata
- **Event:** Cal Hacks 13.0
- **What it does:** Reconciles a multi-store retailer's bank lines on its own, holds what it can't explain, asks a person one question, and turns each answer into a backtested rule.
- **Live app:** https://getfermata.tech
- **Repo:** https://github.com/keananwongso/fermata
- **Frontend:** Vercel
- **Convex deployment:** https://kindred-dotterel-663.convex.cloud
- **Components:** @convex-dev/rate-limiter
- **Convex features:** schema, indexes, queries, mutations, actions, scheduled functions, realtime useQuery, paginated queries
- **Auth:** none (public writes need a console key, convex/lib/console.ts)
- **AI models:** claude-sonnet-5-5, Cartesia sonic-3.6 (speech) and ink-whisper (listening)
- **Started:** 2026-10-24T06:50:49Z
- **Last updated:** 2026-10-25T08:00:12Z

## How we use Convex

- **The month by month close** runs as internal mutations that page through bank lines with `.paginate` and reschedule themselves with `ctx.scheduler.runAfter`, pausing when a person is needed (convex/run.ts, convex/engine.ts).
- **Every posting is a transaction** through one transition core with roles and an audit row per step, over an indexed schema of bank lines, work items, rules and stories (convex/schema.ts, convex/lib/transition.ts).
- **Case rooms** are Claude agents running as Convex actions that take turns through the scheduler and write the transcript to the database (convex/roomAgents.ts, convex/rooms.ts).
- **People answer and approve rules** through mutations that schedule the learner action, which fits and backtests a new rule (convex/humans.ts, convex/agents.ts, convex/codeLearner.ts).
- **Ask the books** is an action with named read only queries behind it, guarded by the rate limiter component, plus an action that mints short lived Cartesia voice tokens (convex/ask.ts, convex/askData.ts, convex/convex.config.ts).
- **Live without a refresh:** the console screens Run, Stories (case room chat), Rules, Record, Evaluation and Scenarios all read through `useQuery`, so they update as the close runs (convex/queries.ts, src/app/run/page.tsx, src/components/caseRoom.tsx). On the hosted site the demo and dashboard replay a recorded run, and Ask the books calls the Convex action live for any question it has no recording for.

## Log

- 10-24 a4dc0f6: scaffold Next.js with Convex (package.json)
- 10-24 bd1b134: rule programs, engine core, offline simulator (convex/lib/engineCore.ts, convex/lib/rules.ts)
- 10-24 74afe86: Convex schema and transition core with audit log (convex/schema.ts, convex/lib/transition.ts)
- 10-24 4b80dd9: run the engine in Convex batches with pauses (convex/engine.ts, convex/run.ts)
- 10-24 d40f65b: human answers, autopilot, Claude agents (convex/humans.ts, convex/agents.ts)
- 10-24 557c509: reactive queries for the screens (convex/queries.ts)
- 10-24 72ac135: live evaluation (convex/evaluation.ts)
- 10-24 c09ab00: live case rooms with Claude agents (convex/roomAgents.ts, convex/rooms.ts)
- 10-24 3acec22: public demo replaying a recorded run (src/app/demo/page.tsx)
- 10-24 c47025e: console key on every public write (convex/lib/console.ts)
- 10-24 75605c8: Ask the books, rate limited, with speech tokens (convex/ask.ts, convex/convex.config.ts)
- 10-24 5767c8e: Cartesia voice (src/components/ask/voice.ts)
- 10-24 1f35bb0: scenario rows in the schema (convex/schema.ts, convex/rooms.ts)
- 10-24 d84f849: learn by story shape, fit rules in code (convex/codeLearner.ts, convex/humans.ts)
- 10-25 9eddc2a: record the learning year live (scripts/export_demo.ts)
- 10-25 6222620: /how system page (src/app/how/page.tsx)
- 10-25 042b031: dashboard as one screen (src/app/dashboard/page.tsx)
- 10-25 6f85614: landing replays a real case room (src/components/howRoom.tsx)
- 10-25 5c7006a: one stop demo: answer the CFO (src/app/demo/tour.tsx)
- 10-25 f74fd77: spoken money in plain words (convex/lib/speech.ts)
