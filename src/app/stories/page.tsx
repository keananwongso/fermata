"use client";
import { useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { MONTH_LABELS, STORE_BY_CODE } from "../../../convex/lib/domain";
import { num, rp, rpShort, shortDate } from "../../../convex/lib/format";
import { Loading, Pill } from "@/components/ui";
import { QuestionCard } from "@/components/question";
import { Participants, RoomChat, RoomStatus } from "@/components/caseRoom";

type Story = Doc<"stories"> & { question: Doc<"questions"> | null };

export default function StoriesPage() {
  return <Suspense fallback={<Loading>Loading case rooms…</Loading>}><Rooms /></Suspense>;
}

// ?room=<story key> opens that room; otherwise the latest live meeting, then the first room.
function Rooms() {
  const list = useQuery(api.queries.stories) as Story[] | undefined;
  const asked = useSearchParams().get("room");
  const [sel, setSel] = useState<string | null>(null);
  if (!list) return <Loading>Loading case rooms…</Loading>;
  if (!list.length) return <Empty />;
  const liveRooms = list.filter((s) => s.room?.live);
  const key = sel ?? (asked && list.some((s) => s.key === asked) ? asked : liveRooms[liveRooms.length - 1]?.key ?? list[0].key);
  const story = list.find((s) => s.key === key)!;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[clamp(30px,3.4vw,40px)]">Case rooms</h1>
          <p className="mt-2 text-[13px] text-secondary">Every held story gets a meeting. The agents work it out, then ask one person one question.</p>
        </div>
        <span className="num text-[12px] text-faint">{list.length} rooms · {liveRooms.length} live</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_270px]">
        <RoomList list={list} live={liveRooms} active={key} onPick={setSel} />
        <Chat key={key} story={story} />
        <Side key={`side-${key}`} story={story} />
      </div>
    </div>
  );
}

function RoomList({ list, live, active, onPick }: { list: Story[]; live: Story[]; active: string; onPick: (k: string) => void }) {
  const months = [...new Set(list.map((s) => s.month))];
  const item = (s: Story) => {
    const on = s.key === active;
    const state = s.room?.state;
    const dot = state === "meeting" ? "bg-accent breathe-dot" : state === "asked" ? "bg-hold" : "bg-success";
    return (
      <button key={s.key} onClick={() => onPick(s.key)} aria-current={on ? "true" : undefined}
        className={`calm flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left ${on ? "bg-warm shadow-[inset_2px_0_0_var(--color-accent)]" : "hover:bg-hover"}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${on ? "font-medium text-heading" : "text-body"}`} title={s.title}>{s.title}</span>
        <span className="num shrink-0 text-[11px] text-faint">{rpShort(s.amount)}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Case rooms" className="card max-h-[calc(100dvh-11rem)] overflow-y-auto p-2 lg:sticky lg:top-24 lg:self-start">
      {live.length ? (
        <div className="mb-2">
          <div className="eyebrow px-2.5 pb-1 pt-1.5">Live meetings</div>
          {live.map((s) => (
            <button key={s.key} onClick={() => onPick(s.key)} aria-current={s.key === active ? "true" : undefined}
              className={`calm mb-1 block w-full rounded-[8px] border px-2.5 py-2 text-left ${s.key === active ? "border-accent/40 bg-accent-tint" : "border-hairline bg-ground hover:bg-hover"}`}>
              <div className="flex items-center gap-1.5 text-[11px] text-faint">{MONTH_LABELS[s.month - 1]}{s.narrated ? <span className="text-hold-ink">· Story {s.narrated}</span> : null}{s.scenario ? <span>· Scenario</span> : null}<span className="ml-auto"><Pill tone="accent">Claude</Pill></span></div>
              <div className="mt-1 text-[12.5px] font-medium leading-snug text-heading">{s.title}</div>
            </button>
          ))}
        </div>
      ) : null}
      {months.map((m) => (
        <div key={m}>
          <div className="eyebrow px-2.5 pb-0.5 pt-2">{MONTH_LABELS[m - 1]}</div>
          {list.filter((s) => s.month === m && !s.room?.live).map(item)}
        </div>
      ))}
    </nav>
  );
}

function Chat({ story }: { story: Story }) {
  return (
    <section className="card flex min-w-0 flex-col overflow-hidden" aria-label="Case room">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-4 py-3 lg:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11.5px] text-faint">
            <span>{MONTH_LABELS[story.month - 1]}</span>
            {story.narrated ? <Pill tone="hold">Story {story.narrated}</Pill> : null}
            {story.scenario ? <Pill>Scenario</Pill> : null}
            {story.room?.live ? <Pill tone="accent">Live agents</Pill> : <Pill>Scripted meeting</Pill>}
          </div>
          <h2 className="title mt-1 truncate text-[19px]" title={story.title}>{story.title}</h2>
        </div>
        <RoomStatus story={story} />
      </header>
      <div className="max-h-[calc(100dvh-20rem)] min-h-[320px] flex-1 overflow-y-auto bg-canvas">
        <RoomChat story={story} />
      </div>
      {story.question ? <div className="border-t border-hairline bg-warm p-3"><QuestionCard q={story.question} /></div> : null}
    </section>
  );
}

function Side({ story }: { story: Story }) {
  const d = useQuery(api.queries.story, { key: story.key });
  const msgs = useQuery(api.queries.room, { key: story.key });
  return (
    <aside className="card space-y-4 p-4 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24 xl:self-start">
      <div>
        <div className="eyebrow">The case</div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
          <dt className="text-faint">Lines</dt><dd className="num text-right">{num(story.count)}</dd>
          <dt className="text-faint">Amount</dt><dd className="num text-right">{rp(story.amount)}</dd>
          <dt className="text-faint">Stores</dt><dd className="truncate text-right" title={story.stores.map((x) => STORE_BY_CODE[x]?.name ?? x).join(", ")}>{story.stores.length > 2 ? `${story.stores.length} stores` : story.stores.map((x) => STORE_BY_CODE[x]?.name ?? x).join(", ") || "none"}</dd>
          {d ? <><dt className="text-faint">Held now</dt><dd className="num text-right text-hold-ink">{num(d.counts.held)}</dd><dt className="text-faint">Settled</dt><dd className="num text-right text-success">{num(d.counts.settled)}</dd></> : null}
        </dl>
        {story.resolution ? <p className="mt-2 text-[12px] text-secondary">{story.resolution}</p> : null}
      </div>
      <div className="border-t border-hairline pt-4"><Participants msgs={msgs} /></div>
      {d?.sample.length ? (
        <details className="group border-t border-hairline pt-3">
          <summary className="calm flex cursor-pointer list-none items-center gap-1.5 text-[12px] text-secondary hover:text-ink">
            <span className="inline-block text-faint transition-transform group-open:rotate-90">›</span>Bank lines on file
          </summary>
          <ul className="mt-2 space-y-2">
            {d.sample.map((x) => (
              <li key={x.ref} className="text-[11.5px]">
                <div className="flex justify-between gap-2"><span className="num text-faint">{shortDate(x.date)}</span><span className="num">{rp(x.amount)}</span></div>
                <div className="num truncate text-faint" title={x.memo}>{x.memo}</div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </aside>
  );
}

function Empty() {
  return (
    <div className="space-y-6">
      <h1 className="display text-[clamp(30px,3.4vw,40px)]">Case rooms</h1>
      <div className="hatch rounded-[10px] border border-hairline px-6 py-14 text-center">
        <div className="text-[28px] text-hold" style={{ fontFamily: "var(--font-music)" }} aria-hidden>𝄐</div>
        <p className="mx-auto mt-3 max-w-[420px] text-body">No held lines yet. Close the year from Run, and a room opens here for each story Fermata holds.</p>
      </div>
    </div>
  );
}
