"use client";
// Ask the books: hold to ask a question about the books, hear the answer, see it in one of five templates.
// Not a chat: one question at a time, the answer and a caption of what was said, a short list of recent questions,
// and suggested questions. A suggested question (or anything that matches one) is answered from the recording with
// no Claude call; anything else goes to the live, rate limited path when this build has a Convex URL.
//
// Mount anywhere: <AskPanel /> (see DESIGN.md, "Ask the books").
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Play } from "lucide-react";
import recording from "@/demo/ask.json";
import { api } from "../../../convex/_generated/api";
import { LIMITED, type AskAnswer } from "../../../convex/lib/ask";
import { PRESETS, matchPreset } from "../../../convex/lib/askPresets";
import { Button, Pill } from "../ui";
import { RefusalNote, View } from "./views";
import { LIVE, liveClient, playUrl, speak, stopSpeaking, visitorId } from "./voice";
import { PushToTalk, useVoiceInput } from "./pushToTalk";

type Recorded = { question: string; answer: AskAnswer; audio: string | null };
const REC = recording as unknown as { recordedAt: string | null; presets: Record<string, Recorded> };
const RECORDED = PRESETS.filter((p) => REC.presets[p.id]);

type Shown = { question: string; answer: AskAnswer; from: "recorded" | "live"; audio: string | null };
type Phase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "Hold to ask", listening: "Listening. Let go to ask", transcribing: "Writing down your question", thinking: "Reading the books", speaking: "Speaking",
};

export function AskPanel({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState<Shown | null>(null);
  const [history, setHistory] = useState<Shown[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  // False on the server and on the hosted site without a Convex URL; true where this browser can record.
  const voiceIn = useVoiceInput();

  // Each question gets a number; a live answer that comes back after a newer question is dropped.
  const turn = useRef(0);

  const show = useCallback((s: Shown, play: boolean) => {
    setShown(s);
    setHistory((h) => [s, ...h.filter((x) => x.question !== s.question)].slice(0, 4));
    if (!play) { setPhase("idle"); return; }
    setPhase("speaking");
    const done = () => setPhase((p) => (p === "speaking" ? "idle" : p));
    if (s.audio) void playUrl(s.audio, done);
    else void speak(s.answer.spoken, done);
  }, []);

  const fromRecording = useCallback((id: string): Shown | null => {
    const r = REC.presets[id];
    return r ? { question: r.question, answer: r.answer, from: "recorded", audio: r.audio } : null;
  }, []);

  const ask = useCallback(async (question: string, play = true) => {
    const q = question.trim();
    if (!q) return;
    const mine = ++turn.current;
    stopSpeaking();
    setNotice(null);
    const preset = matchPreset(q);
    const recorded = preset ? fromRecording(preset.id) : null;
    if (recorded) return show({ ...recorded, question: q === preset!.question ? recorded.question : q }, play);
    const c = liveClient();
    if (!c) { setPhase("idle"); setNotice(LIMITED); return; }
    setPhase("thinking");
    try {
      const reply = await c.action(api.ask.ask, { question: q, visitor: visitorId() });
      if (mine !== turn.current) return;
      if (reply.kind === "answer") return show({ question: q, answer: reply.answer, from: "live", audio: null }, play);
      if (reply.kind === "preset") { const r = fromRecording(reply.id); if (r) return show({ ...r, question: q }, play); }
      setPhase("idle");
      setNotice(reply.kind === "limited" || reply.kind === "error" ? reply.message : LIMITED);
    } catch {
      if (mine !== turn.current) return;
      setPhase("idle");
      setNotice("The books could not be read just now. Try a suggested question.");
    }
  }, [fromRecording, show]);

  // /ask?q=<preset id> opens that recorded answer, without playing it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("q");
    const r = id ? fromRecording(id) : null;
    if (!r) return;
    const t = requestAnimationFrame(() => setShown(r));
    return () => cancelAnimationFrame(t);
  }, [fromRecording]);

  useEffect(() => () => stopSpeaking(), []);

  const busy = phase === "thinking" || phase === "transcribing";
  const answer = shown?.answer ?? null;

  return (
    <section className={`card p-5 lg:p-7 ${className}`} aria-label="Ask the books">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Ask the books</span>
        <Pill>Read only</Pill>
      </div>
      <p className="mt-2 text-[13px] text-secondary">Read only: it can explain the books, never change them.</p>

      <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex items-center gap-4">
          <PushToTalk disabled={!voiceIn || busy} label={voiceIn ? "Hold to ask a question" : "Voice input is not available here"}
            onPhase={(p) => { if (p !== "idle") { stopSpeaking(); setNotice(null); setHeard(null); setPhase(p); } else setPhase((cur) => (cur === "listening" || cur === "transcribing" ? "idle" : cur)); }}
            onText={(t) => { setHeard(t); void ask(t); }} onError={(m) => setNotice(m)} />
          <div className="min-w-0" role="status" aria-live="polite">
            <div className="text-[15px] font-medium text-ink">{voiceIn ? PHASE_TEXT[phase] : phase === "idle" ? "Pick a question below" : PHASE_TEXT[phase]}</div>
            <div className="text-[12px] text-faint">{voiceIn ? (heard ? `Heard: "${heard}"` : "Press and hold, ask, let go. Space works too.") : "Voice questions need the live service. Suggested questions still answer out loud."}</div>
          </div>
        </div>

        <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); const q = typed; setTyped(""); setHeard(null); void ask(q); }}>
          <label htmlFor="ask-typed" className="sr-only">Or type a question</label>
          <input id="ask-typed" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={240} placeholder="Or type a question"
            className="calm min-h-11 min-w-0 flex-1 rounded-[4.5px] border border-hairline bg-ground px-3 text-[14px] text-ink placeholder:text-faint hover:border-strong focus-visible:border-accent focus-visible:outline-none lg:min-h-9" />
          <Button type="submit" disabled={!typed.trim() || busy} aria-label="Ask"><ArrowUp size={16} strokeWidth={1.75} /><span className="hidden sm:inline">Ask</span></Button>
        </form>
      </div>

      {notice ? <div className="enter mt-5 rounded-[6px] border border-hairline bg-well px-3 py-2 text-[13px] text-secondary" role="status">{notice}</div> : null}

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {shown && answer ? (
            <motion.div key={shown.question + shown.from} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">You asked</span>
                {shown.from === "recorded" ? <Pill>Recorded answer</Pill> : <Pill tone="info">Live: Claude chose the query</Pill>}
                {answer.checked ? <Pill tone="success">Every number checked against the data</Pill> : <Pill>Sentence written by code</Pill>}
              </div>
              <p className="title mt-2 text-[clamp(20px,2.4vw,26px)]">{shown.question}</p>
              <div className="mt-3 flex items-start gap-3">
                <button type="button" onClick={() => { setPhase("speaking"); const done = () => setPhase("idle"); if (shown.audio) void playUrl(shown.audio, done); else if (LIVE) void speak(answer.spoken, done); else done(); }}
                  disabled={!shown.audio && !LIVE} aria-label="Play the answer"
                  className="calm grid size-9 shrink-0 place-items-center rounded-full border border-hairline bg-ground text-accent hover:border-strong hover:bg-warm disabled:opacity-40">
                  {phase === "speaking" ? <span aria-hidden className="flex h-3 items-end gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="speak-bar w-[3px] rounded-full bg-accent" style={{ animationDelay: `${i * 140}ms` }} />)}</span> : <Play size={14} strokeWidth={2} fill="currentColor" />}
                </button>
                <p className="min-w-0 pt-1.5 text-[15px] leading-relaxed text-body" aria-live="polite">{answer.spoken}</p>
              </div>
              {answer.refusal ? <div className="mt-4"><RefusalNote r={answer.refusal} /></div> : null}
              {answer.view ? <div className="frame mt-5"><div className="card p-4 sm:p-5 lg:p-6"><View v={answer.view} /></div></div> : null}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hatch rounded-[10px] border border-hairline px-5 py-12 text-center">
              <p className="text-[14px] text-secondary">Ask about cash, held lines, stores, channels, case rooms or rules.</p>
              <p className="mt-1 text-[12px] text-faint">Every number you see comes from the books, not from the model.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6">
        <div className="eyebrow">{shown ? "Ask another" : "Suggested"}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RECORDED.map((p) => (
            <button key={p.id} type="button" disabled={busy} onClick={() => { setHeard(null); void ask(p.question); }}
              className={`calm min-h-9 rounded-full border px-3 py-1 text-left text-[12.5px] disabled:opacity-50 ${shown?.question === p.question ? "border-accent bg-accent-tint text-accent" : "border-hairline bg-ground text-body hover:border-strong hover:bg-warm"}`}>
              {p.question}
            </button>
          ))}
        </div>
      </div>

      {history.length > 1 ? (
        <div className="mt-6 border-t border-hairline pt-4">
          <div className="eyebrow">Recent</div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {history.slice(1).map((h) => (
              <li key={h.question}><button type="button" onClick={() => { stopSpeaking(); setPhase("idle"); setShown(h); }} className="calm text-[12.5px] text-link hover:text-accent">{h.question}</button></li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
