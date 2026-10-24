"use client";
// Run, Evaluation and Record inside the dashboard window. The recording does not hold these screens, so each is one
// honest card: what the screen is, a small real preview where the recording allows one, and where to see the rest.
import type { ReactNode } from "react";
import { MONTH_LABELS } from "../../../convex/lib/domain";
import { num, pct, shortDate } from "../../../convex/lib/format";
import { PUBLIC_SITE } from "../nav";
import { AGENT_LABEL, Bar, LinkArrow } from "../ui";
import { R, denied, lastMonth, shares } from "./data";
import { ViewHead } from "./parts";

type Props = { room: string | null; console?: string };

// `demo` names what the live demo shows of this screen; it never shows the evaluation, so that link says what it does show.
function Screen({ title, aside, what, label, console, demo = "See it in the live demo", children }: { title: string; aside?: ReactNode; what: ReactNode; label: string; console?: string; demo?: string; children: ReactNode }) {
  return (
    <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-6">
      <ViewHead title={title} aside={aside ? <span className="num text-[12px] text-faint">{aside}</span> : null} />
      <section className="card min-w-0 p-4 lg:p-5">
        <div className="eyebrow">What this screen is</div>
        <p className="mt-2 max-w-[680px] text-[13.5px] leading-relaxed text-body">{what}</p>
        <div className="mt-5">
          <div className="eyebrow">{label}</div>
          <div className="mt-2">{children}</div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline pt-4">
          <LinkArrow href="/demo">{demo}</LinkArrow>
          {!PUBLIC_SITE && console ? <LinkArrow href={console}>Open in the console</LinkArrow> : null}
        </div>
      </section>
    </div>
  );
}

// ---- Run: the year closing month by month -----------------------------------------------------------------------

export function Run({ console }: Props) {
  const learnedIn = (m: number) => R.rules.filter((r) => r.learnedInMonth === m);
  return (
    <Screen title="Run" console={console} aside={`${num(R.total)} bank lines · ${R.months.length} months`}
      label="From the recording: settled on its own, first pass, by month"
      what={<>The year closing month by month. The engine settles every bank line an approved rule explains on the first pass and holds the rest; the held lines become stories, and each story gets a case room. Rules learned from people&apos;s answers join the engine as the year goes on.</>}>
      <ul className="space-y-1.5">
        {R.months.map((m, i) => (
          <li key={m.month} className="grid grid-cols-[32px_minmax(0,1fr)_48px] items-center gap-3 text-[12.5px] sm:grid-cols-[32px_minmax(0,1fr)_48px_96px_88px]">
            <span className="text-faint">{MONTH_LABELS[m.month - 1]}</span>
            <Bar value={shares[i]} max={1} />
            <span className="num text-right text-ink">{Math.round(shares[i] * 100)}%</span>
            <span className="num hidden text-right text-faint sm:block">{num(m.total)} lines</span>
            <span className="hidden text-[11.5px] text-secondary sm:block">{learnedIn(m.month).map((r) => `${r.id} learned`).join(" · ")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-secondary">
        {Math.round(shares[0] * 100)}% in {MONTH_LABELS[R.months[0].month - 1]}, {Math.round(shares[shares.length - 1] * 100)}% in {MONTH_LABELS[lastMonth - 1]}.
        {" "}{R.rules.filter((r) => r.learnedInMonth > 0).map((r) => `${r.id} was learned in ${MONTH_LABELS[r.learnedInMonth - 1]}`).join(", ")}.
      </p>
    </Screen>
  );
}

// ---- Evaluation: scored against the hidden truth ----------------------------------------------------------------

export function Evaluation({ console }: Props) {
  const e = R.evaluation;
  const n = (k: string) => (typeof e?.[k] === "number" ? (e[k] as number) : 0);
  const cell = (label: string, value: string, sub: string) => (
    <div className="panel min-w-0 px-3 py-2.5">
      <div className="eyebrow truncate">{label}</div>
      <div className="figure mt-1 text-[24px] text-heading">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-faint">{sub}</div>
    </div>
  );
  return (
    <Screen title="Evaluation" console={console} demo="Watch the year close in the live demo" label={e ? "From the recording: the latest evaluation run" : "Not in this recording"}
      what={<>Scores the closed books against the generator&apos;s hidden truth, which the engine never reads: how many lines were posted to the wrong store, a held out week reported on its own, and a fuzzer that breaks real settled lines to check every mutant is held or still lands at the true store.</>}>
      {e ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {cell("Wrong postings", num(n("wrongStore")), `of ${num(n("withStore"))} settled with a store`)}
          {cell("Held out week precision", pct(n("weekSettled") ? n("weekCorrect") / n("weekSettled") : 1), `${e.weekFrom ? `${shortDate(String(e.weekFrom))} to ${shortDate(String(e.weekTo))}, ` : ""}${num(n("weekSettled"))} settled`)}
          {cell("Fuzzer mutants posted wrongly", num(n("fuzzSettled")), `of ${num(n("fuzzTried"))} mutated lines`)}
          {cell("Settled by people", num(n("byPerson")), `${num(n("byRule"))} by rules`)}
        </div>
      ) : (
        <div className="hatch rounded-[6px] border border-hairline px-4 py-6 text-center text-[12.5px] text-secondary">
          Measured in the console. This recording carries no evaluation run, so there is nothing to show here yet.
        </div>
      )}
    </Screen>
  );
}

// ---- Record: every step, refusals included ----------------------------------------------------------------------

export function Record({ console }: Props) {
  // The live rooms' opening steps, as they were written; refusals first when the run has any.
  const steps = R.rooms.filter((r) => r.live).flatMap((r) => r.messages.slice(0, 4).map((m) => ({ m, month: r.month })));
  const refusals = R.rooms.flatMap((r) => r.messages.filter((m) => m.kind === "denied").map((m) => ({ m, month: r.month })));
  const lines = [...refusals, ...steps];
  const messages = R.rooms.reduce((s, r) => s + r.messages.length, 0);
  return (
    <Screen title="Record" console={console} aside={`${num(messages)} room messages · ${num(denied)} refusals`} label="From the recording: the first steps in the two rooms Claude worked live"
      what={<>Every step Fermata or a person took, written in the same step as the change it records, and kept: settlements, questions, answers, approvals, and every refusal with its reason. Search it by bank line, story or rule.</>}>
      <ol className="panel divide-y divide-hairline font-mono text-[11.5px] leading-relaxed">
        {lines.map(({ m, month }, i) => {
          const no = m.kind === "denied";
          return (
            <li key={i} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 px-3 py-2 sm:grid-cols-[32px_212px_minmax(0,1fr)_56px]">
              <span className="text-faint">{MONTH_LABELS[month - 1]}</span>
              <span className={`truncate ${no ? "text-danger" : "text-secondary"}`}>{no ? "blocked" : `${AGENT_LABEL[m.speaker] ?? m.speaker}${m.to && m.to !== "room" ? ` → ${AGENT_LABEL[m.to] ?? m.to}` : ""}`}</span>
              <span className={`col-span-2 line-clamp-2 sm:col-span-1 ${no ? "text-danger" : "text-ink"}`}>{m.text}</span>
              <span className="hidden text-right text-faint sm:block">{m.staged ? "staged" : m.source === "scripted" ? "scripted" : "real"}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[12px] text-secondary">
        {denied ? <><span className="text-danger">{num(denied)} {denied === 1 ? "refusal" : "refusals"}</span> on record in this run, each kept with its reason.</>
          : <>No refusals in this run. When an agent tries something it may not do, the refusal is kept here in red with its reason.</>}
      </p>
    </Screen>
  );
}
