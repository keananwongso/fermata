"use client";
// Ask the books: hold the orb to ask a question about the books, hear the answer, see it in one of five templates.
// Not a chat: one question and its answer at a time, a caption of what was said, at most three recent questions,
// and four suggested questions at a time. A suggested question (or anything that matches one) is answered from the
// recording with no Claude call; anything else goes to the live, rate limited path when this build has a Convex URL.
//
// The flow: invite (a large orb and four suggestions) → listening (the orb follows the microphone) → writing down
// the question → reading the books → speaking (the orb shrinks beside the answer, which is captioned in time with the
// voice) → done (the answer's template, with ask again). The orb is one element the whole way, so a press that
// starts on it always ends on it.
//
// Mount anywhere: <AskPanel /> (see DESIGN.md, "Ask the books").
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, Mic, MicOff, Play, RefreshCw, RotateCcw, Square } from "lucide-react";
import recording from "@/demo/ask.json";
import { api } from "../../../convex/_generated/api";
import { LIMITED, type AskAnswer } from "../../../convex/lib/ask";
import { PRESETS, matchPreset } from "../../../convex/lib/askPresets";
import { Pill } from "../ui";
import { RefusalNote, View } from "./views";
import { LIVE, liveClient, playUrl, speak, stopSpeaking, visitorId } from "./voice";
import { usePushToTalk, useVoiceInput } from "./pushToTalk";
import { ThinkingOrb, type OrbState } from "./orb";
import { SpokenCaption } from "./caption";

type Recorded = { question: string; answer: AskAnswer; audio: string | null };
const REC = recording as unknown as { recordedAt: string | null; presets: Record<string, Recorded> };

// Suggestions four at a time, each set mixing the templates. Presets not listed here go at the end.
const ORDER = ["real-cash", "held-now", "auto-settling", "finz-why", "held-by-store", "finz-june", "school-fees", "approve-r9", "r8-learned", "held-channels", "rooms-by-month", "january-card"];
const RECORDED = PRESETS.filter((p) => REC.presets[p.id]).sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
const PER_SET = 4;
const SETS = Math.max(1, Math.ceil(RECORDED.length / PER_SET));

type Shown = { question: string; answer: AskAnswer; from: "recorded" | "live"; audio: string | null };
type Phase = OrbState;

const EASE = [0.22, 1, 0.36, 1] as const;

export function AskPanel({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState<Shown | null>(null);
  const [history, setHistory] = useState<Shown[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [set, setSet] = useState(0);
  // False on the server and on the hosted site without a Convex URL; true where this browser can record.
  const voiceIn = useVoiceInput();

  // Each question gets a number; a live answer that comes back after a newer question is dropped.
  const turn = useRef(0);
  // Each playback gets a number, so a voice that ends after a newer one started leaves the phase alone.
  const voice = useRef(0);

  const play = useCallback((s: Shown) => {
    const mine = ++voice.current;
    setPhase("thinking");
    const done = () => { if (voice.current === mine) setPhase("idle"); };
    const started = s.audio ? playUrl(s.audio, done) : LIVE ? speak(s.answer.spoken, done) : Promise.resolve(false);
    void started.then((ok) => { if (voice.current === mine) setPhase(ok ? "speaking" : "idle"); });
  }, []);

  const stop = useCallback(() => { voice.current++; stopSpeaking(); setPhase("idle"); }, []);

  const show = useCallback((s: Shown, speakIt: boolean) => {
    setShown(s);
    setHistory((h) => [s, ...h.filter((x) => x.question !== s.question)].slice(0, 4));
    if (speakIt) play(s); else setPhase("idle");
  }, [play]);

  const fromRecording = useCallback((id: string): Shown | null => {
    const r = REC.presets[id];
    return r ? { question: r.question, answer: r.answer, from: "recorded", audio: r.audio } : null;
  }, []);

  const ask = useCallback(async (question: string, speakIt = true) => {
    const q = question.trim();
    if (!q) return;
    const mine = ++turn.current;
    voice.current++;
    stopSpeaking();
    setNotice(null);
    const preset = matchPreset(q);
    const recorded = preset ? fromRecording(preset.id) : null;
    if (recorded) return show({ ...recorded, question: q === preset!.question ? recorded.question : q }, speakIt);
    setShown(null);
    const c = liveClient();
    if (!c) { setPhase("idle"); setNotice(LIMITED); return; }
    setPhase("thinking");
    try {
      const reply = await c.action(api.ask.ask, { question: q, visitor: visitorId() });
      if (mine !== turn.current) return;
      if (reply.kind === "answer") return show({ question: q, answer: reply.answer, from: "live", audio: null }, speakIt);
      if (reply.kind === "preset") { const r = fromRecording(reply.id); if (r) return show({ ...r, question: q }, speakIt); }
      setPhase("idle");
      setNotice(reply.kind === "limited" || reply.kind === "error" ? reply.message : LIMITED);
    } catch {
      if (mine !== turn.current) return;
      setPhase("idle");
      setNotice("The books could not be read just now. Try a suggested question.");
    }
  }, [fromRecording, show]);

  const busy = phase === "thinking" || phase === "transcribing";
  const talk = usePushToTalk({
    disabled: !voiceIn || busy,
    onPhase: (p) => {
      if (p === "listening") { turn.current++; voice.current++; stopSpeaking(); setNotice(null); setHeard(null); setShown(null); setPhase("listening"); }
      else if (p === "transcribing") setPhase("transcribing");
      else setPhase((cur) => (cur === "listening" || cur === "transcribing" ? "idle" : cur));
    },
    onText: (t) => { setHeard(t); void ask(t); },
    onError: (m) => setNotice(m),
  });

  // /ask?q=<preset id> opens that recorded answer, without playing it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("q");
    const r = id ? fromRecording(id) : null;
    if (!r) return;
    const t = requestAnimationFrame(() => setShown(r));
    return () => cancelAnimationFrame(t);
  }, [fromRecording]);

  // Development only: ?orb=listening|transcribing|thinking|speaking holds the orb in that state, for screenshots.
  // Next removes this block from production builds.
  const [forced, setForced] = useState<Phase | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const f = new URLSearchParams(window.location.search).get("orb") as Phase | null;
    if (!f || !["idle", "listening", "transcribing", "thinking", "speaking"].includes(f)) return;
    const t = requestAnimationFrame(() => setForced(f));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  const state: Phase = forced ?? (talk.phase === "listening" ? "listening" : talk.phase === "transcribing" ? "transcribing" : phase);
  const answer = shown?.answer ?? null;
  const answering = !!(shown && answer);
  const status = statusText(state, voiceIn, heard);
  const ready = !(state === "thinking" || state === "transcribing" || state === "listening");

  const submitTyped = () => { const q = typed; setTyped(""); setHeard(null); void ask(q); };
  const pick = (q: string) => { setHeard(null); void ask(q); };
  const reset = () => { stop(); setShown(null); setNotice(null); setHeard(null); };

  return (
    <section className={`card overflow-hidden p-5 lg:p-7 ${className}`} aria-label="Ask the books">
      {/* One announcement per turn: the question and the whole answer, or what the orb is doing. */}
      <div className="sr-only" aria-live="polite" role="status">{answering ? `${shown!.question}. ${answer!.spoken}` : status.title}</div>

      {/* Answering, on a phone: the small orb beside the question, the answer under both at full width.
          Wider: the orb in its own column beside all of it. */}
      <div className={answering ? "grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-start sm:gap-x-6 sm:gap-y-0" : "flex flex-col items-center pt-2 text-center lg:pt-4"}>
        <motion.div layout transition={{ duration: 0.5, ease: EASE }} className={`relative shrink-0 ${answering ? "sm:row-span-2" : ""}`}>
          <button {...talk.props} disabled={!voiceIn || busy || talk.phase === "transcribing"}
            aria-label={voiceIn ? (state === "listening" ? "Listening. Let go to ask" : "Hold to ask a question out loud") : "Voice questions need the live service"}
            className={`calm group relative grid touch-none select-none place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent enabled:cursor-pointer disabled:cursor-default ${answering ? "size-14 sm:size-[88px]" : "size-[156px] sm:size-[188px]"}`}>
            <ThinkingOrb state={state} className={`absolute inset-0 transition-transform duration-500 ${state === "listening" ? "scale-[1.04]" : ""} ${voiceIn && state === "idle" ? "group-hover:scale-[1.03]" : ""}`} />
            {voiceIn || !answering ? (
              <span aria-hidden className={`calm absolute bottom-0 grid translate-y-1/3 place-items-center rounded-full border shadow-[0_2px_6px_rgb(85_40_20/0.12)] ${answering ? "size-6" : "size-8"} ${!voiceIn ? "border-hairline bg-well text-faint" : state === "listening" ? "border-accent bg-accent text-white" : "border-hairline bg-ground text-accent group-hover:border-accent"}`}>
                {!voiceIn ? <MicOff size={answering ? 12 : 14} strokeWidth={1.75} /> : state === "listening" ? <Square size={answering ? 9 : 11} strokeWidth={2} fill="currentColor" /> : <Mic size={answering ? 12 : 15} strokeWidth={1.75} />}
              </span>
            ) : null}
          </button>
        </motion.div>

        {answering ? (
          <motion.p layout="position" transition={{ duration: 0.5, ease: EASE }} className="min-w-0 text-[13px] text-secondary sm:pt-1">
            <span className="text-faint">You asked</span> <span className="text-ink">{shown!.question}</span>
          </motion.p>
        ) : null}
        <motion.div layout="position" transition={{ duration: 0.5, ease: EASE }} className={`min-w-0 ${answering ? "col-span-2 sm:col-span-1 sm:col-start-2" : "mt-5 max-w-[520px]"}`}>
          {answering ? (
            <div key={shown!.question + shown!.from}>
              <SpokenCaption text={answer!.spoken} live={state === "speaking"} className="title text-[clamp(19px,2.1vw,24px)] leading-[1.3] sm:mt-2" />
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {state === "speaking" || state === "thinking" ? (
                  <button type="button" onClick={stop} className="calm inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline bg-ground px-3 text-[12.5px] font-medium text-ink hover:border-strong hover:bg-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-8">
                    <Square size={10} strokeWidth={2} fill="currentColor" className="text-accent" />Stop
                  </button>
                ) : (
                  <button type="button" onClick={() => play(shown!)} disabled={!shown!.audio && !LIVE}
                    className="calm inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline bg-ground px-3 text-[12.5px] font-medium text-ink hover:border-strong hover:bg-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 lg:min-h-8">
                    <Play size={11} strokeWidth={2} fill="currentColor" className="text-accent" />Play
                  </button>
                )}
                <button type="button" onClick={reset} className="calm inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-8">
                  <RotateCcw size={12} strokeWidth={1.75} />Ask again
                </button>
                <span className="mx-0.5 hidden h-4 w-px bg-hairline sm:block" aria-hidden />
                {shown!.from === "recorded" ? <Pill>Recorded answer</Pill> : <Pill>Live: Claude chose the query</Pill>}
                {answer!.checked ? <Pill>Every number checked against the data</Pill> : <Pill>Sentence written by code</Pill>}
              </div>
            </div>
          ) : (
            <div>
              <p className="title text-[22px] lg:text-[26px]">{status.title}</p>
              <p className="mt-1.5 text-[13px] text-secondary">{status.sub}</p>
            </div>
          )}
        </motion.div>
      </div>

      {notice && !answering ? (
        <div className="enter mx-auto mt-5 max-w-[520px] rounded-[6px] border border-hairline bg-well px-3 py-2 text-center text-[13px] text-secondary" role="status">{notice}</div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {answering ? (
          <motion.div key={shown!.question + shown!.from} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45, ease: EASE, delay: state === "speaking" || state === "thinking" ? 0.7 : 0.05 }}>
            {answer!.refusal ? <div className="mt-5"><RefusalNote r={answer!.refusal} /></div> : null}
            {answer!.view ? <div className="frame mt-5"><div className="card p-4 sm:p-5 lg:p-6"><View v={answer!.view} /></div></div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dock center={!answering} disabled={!ready} current={shown?.question ?? null} set={set} onMore={() => setSet((s) => (s + 1) % SETS)} onPick={pick}
        typed={typed} onTyped={setTyped} onSubmit={submitTyped}
        recent={history.filter((h) => h.question !== shown?.question).slice(0, 3)} onRecent={(h) => { stop(); setNotice(null); setShown(h); }} />
    </section>
  );
}

function statusText(state: Phase, voiceIn: boolean, heard: string | null): { title: string; sub: string } {
  if (state === "listening") return { title: "Listening", sub: "Ask your question, then let go." };
  if (state === "transcribing") return { title: "Writing down your question", sub: "One moment." };
  if (state === "thinking") return { title: "Reading the books", sub: heard ? `You asked: "${heard}"` : "Every number comes from the data, not from the model." };
  if (state === "speaking") return { title: "Speaking", sub: "" };
  if (!voiceIn) return { title: "What do you want to know?", sub: "Voice questions need the live service. Pick one below to hear its answer." };
  return { title: "Hold to ask", sub: "Press and hold the orb, ask out loud, then let go. Space works too." };
}

const chip = "calm group/q flex h-full min-h-11 w-full items-center gap-3 rounded-[10px] border px-3.5 py-2 text-left text-[13px] leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

// Under the orb or the answer: four suggestions, the typed field, a short recent list and the read only promise.
function Dock({ center, disabled, current, set, onMore, onPick, typed, onTyped, onSubmit, recent, onRecent }: {
  center: boolean; disabled: boolean; current: string | null; set: number; onMore: () => void; onPick: (q: string) => void;
  typed: string; onTyped: (v: string) => void; onSubmit: () => void; recent: Shown[]; onRecent: (s: Shown) => void;
}) {
  const shownSet = RECORDED.slice(set * PER_SET, set * PER_SET + PER_SET);
  return (
    <div className={`mt-7 ${center ? "mx-auto flex max-w-[600px] flex-col items-center text-center" : "border-t border-hairline pt-5"}`}>
      <div className={`flex w-full items-center gap-3 ${center ? "justify-center" : "justify-between"}`}>
        <span className="eyebrow">{center ? "Try asking" : "Ask another"}</span>
        {SETS > 1 ? (
          <button type="button" onClick={onMore} className="calm inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[12px] text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-7">
            <RefreshCw size={12} strokeWidth={1.75} />More questions
          </button>
        ) : null}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ul key={set} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}
          className={`mt-2.5 grid w-full gap-2 text-left sm:grid-cols-2 ${center ? "" : "lg:grid-cols-4"}`}>
          {shownSet.map((p) => (
            <li key={p.id} className="min-w-0">
              <button type="button" disabled={disabled} onClick={() => onPick(p.question)}
                className={`${chip} ${current === p.question ? "border-accent bg-accent-tint text-accent" : "border-hairline bg-ground text-body hover:border-strong hover:bg-warm"}`}>
                <span className="min-w-0 flex-1">{p.question}</span>
                <ArrowRight aria-hidden size={14} strokeWidth={1.75} className="shrink-0 text-faint transition-transform duration-300 group-hover/q:translate-x-0.5 group-hover/q:text-accent" />
              </button>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>

      <form className={`mt-3 flex w-full items-center gap-2 ${center ? "" : "max-w-[640px]"}`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label htmlFor="ask-typed" className="sr-only">Or type a question</label>
        <div className="calm flex min-w-0 flex-1 items-center rounded-full border border-hairline bg-well pl-4 pr-1 focus-within:border-accent focus-within:bg-ground hover:border-strong">
          <input id="ask-typed" value={typed} onChange={(e) => onTyped(e.target.value)} maxLength={240} placeholder="Or type a question" autoComplete="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none lg:min-h-10" />
          <button type="submit" disabled={!typed.trim() || disabled} aria-label="Ask"
            className="calm grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:bg-inset disabled:text-faint">
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
      </form>

      {recent.length ? (
        <p className="mt-3 text-[12px] text-faint">
          <span>Recent: </span>
          {recent.map((h, i) => (
            <span key={h.question}>{i ? <span aria-hidden> · </span> : null}<button type="button" onClick={() => onRecent(h)} className="calm text-link hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{h.question}</button></span>
          ))}
        </p>
      ) : null}

      <p className="mt-4 text-[12px] text-faint">Read only: it can explain the books, never change them.</p>
    </div>
  );
}
