"use client";
// Ask the books, anywhere on the site: hold Control + Option (Ctrl + Alt on Windows), ask out loud, let go. A popup
// opens over the page with the orb and the coach card while it listens, then the answer, spoken and in its template.
// Holding again while it speaks interrupts it. On a phone with no keyboard a small floating button opens the same
// popup, where the orb is held instead. Read only, like every Ask the books surface: the assistant role has no actions.
//
// Mounted once by Providers on the site pages. Anything can open it with `openAsk()` (a suggested question, the
// demo's hand-off, the landing page's chips). It shares the question and answer (useAsk), the answer (answer.tsx),
// the orb and the voice pipeline with the panel on /ask; see DESIGN.md, "Ask the books, anywhere".
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, Mic, X } from "lucide-react";
import { AnswerBody, AnswerHead } from "./answer";
import { OrbButton } from "./orbButton";
import { usePushToTalk, useVoiceInput } from "./pushToTalk";
import { RECORDED, nextQuestions, useAsk } from "./useAsk";
import type { OrbState } from "./orb";

const EASE = [0.22, 1, 0.36, 1] as const;
const OPEN = "fermata:ask";

// Opens the popup; with a question it asks it straight away, with `type` it opens on the type box.
export function openAsk(detail: { question?: string; type?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail }));
}

// ---- The shortcut, named for this platform --------------------------------------------------------------------

const noop = () => () => {};
const mac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
function subscribeMedia(q: string) {
  return (cb: () => void) => { const m = window.matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
}
const KEYBOARD = "(hover: hover) and (pointer: fine)";
const subscribeKeyboard = subscribeMedia(KEYBOARD);

// "⌃ + ⌥" on a Mac, "Ctrl + Alt" elsewhere; null on the server. Never Command.
export function useTalkKeys() {
  return useSyncExternalStore(noop, () => (mac() ? "⌃ + ⌥" : "Ctrl + Alt"), () => null);
}
// A mouse and keyboard; false on a phone or tablet, where the orb is held instead.
export function useKeyboard() {
  return useSyncExternalStore(subscribeKeyboard, () => window.matchMedia(KEYBOARD).matches, () => true);
}

export function TalkKeys({ className = "" }: { className?: string }) {
  const keys = useTalkKeys();
  return <kbd className={`kbd ${className}`} title={keys === "⌃ + ⌥" ? "Control + Option" : "Control + Alt"}>{keys ?? "Ctrl + Alt"}</kbd>;
}

// A quiet line that teaches the shortcut and opens the popup when clicked: "or hold ⌃ + ⌥ to ask the books".
// `keysOnly` shows nothing where there is no keyboard (the line only teaches the keys); `quiet` is the smaller, fainter
// line (the demo's hand-off).
export function AskHint({ lead = "or ", keysOnly = false, quiet = false, className = "" }: { lead?: string; keysOnly?: boolean; quiet?: boolean; className?: string }) {
  const keyboard = useKeyboard();
  if (keysOnly && !keyboard) return null;
  return (
    <button type="button" onClick={() => openAsk()} className={`calm inline-flex min-h-11 items-center gap-1.5 ${quiet ? "text-[12px] text-faint" : "text-[13px] text-secondary"} hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-0 ${className}`}>
      {keyboard ? <>{lead}hold <TalkKeys /> to ask the books</> : <>{lead}ask the books</>}
    </button>
  );
}

const isCombo = (e: KeyboardEvent) => e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey && (e.key === "Control" || e.key === "Alt");
const typing = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

// ---- The coach card ------------------------------------------------------------------------------------------------

// The translucent graphite card that teaches the shortcut: hold the keys, then say a suggested question aloud, or
// type instead. The popup's own card while it listens, and the landing page's lesson (`still`).
export function CoachCard({ suggestion, status, words, onType, children, still = false }: {
  suggestion: string; status?: ReactNode; words?: string | null; onType?: () => void; children?: ReactNode; still?: boolean;
}) {
  const keyboard = useKeyboard();
  return (
    <div className="coach p-5 sm:p-6">
      <h2 className="text-[19px] font-medium leading-snug tracking-[-0.02em] sm:text-[21px]">
        {keyboard ? <>Hold <TalkKeys /> to {still ? "ask the books anything" : "talk"}</> : <>Hold the orb to {still ? "ask the books anything" : "talk"}</>}
      </h2>
      <p className="mt-4 text-[12.5px] text-white/65">Then say this aloud:</p>
      <blockquote className="mt-2 rounded-r-[10px] border-l-2 border-white/40 bg-white/[0.07] px-4 py-3 text-[17px] leading-snug text-white/95">&ldquo;{suggestion}&rdquo;</blockquote>
      {status ? (
        <div className="mt-4 flex items-start gap-2.5 text-[13px] text-white/80" role="status" aria-live="polite">
          <Mic size={15} strokeWidth={1.75} className="mt-px shrink-0 text-white/60" aria-hidden />
          <div className="min-w-0">
            {status}
            {words ? <p className="mt-1 text-[14px] text-white">&ldquo;{words}&rdquo;</p> : null}
          </div>
        </div>
      ) : null}
      {children}
      {onType ? (
        <button type="button" onClick={onType} className="calm mt-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-white/75 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 lg:min-h-0">
          Type instead<ArrowRight size={13} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

// ---- The popup -----------------------------------------------------------------------------------------------------

export function AskOverlay({ fab = true }: { fab?: boolean }) {
  const a = useAsk();
  const { phase, setPhase, shown, notice, setNotice, heard, setHeard, ask, reset, listening } = a;
  const [open, setOpen] = useState(false);
  const [typing_, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [words, setWords] = useState<string | null>(null);
  const [nth, setNth] = useState(0);
  // The keys are down: the popup says Listening at once, before the microphone has opened.
  const [pressed, setPressed] = useState(false);
  const voiceIn = useVoiceInput();
  const keyboard = useKeyboard();
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const suggestion = RECORDED[nth % Math.max(1, RECORDED.length)]?.question ?? "";

  const talk = usePushToTalk({
    disabled: !voiceIn, blips: true,
    onPhase: (p) => {
      if (p === "listening") { listening(); setWords(null); setTyping(false); }
      else if (p === "transcribing") setPhase("transcribing");
      else setPhase((cur) => (cur === "listening" || cur === "transcribing" ? "idle" : cur));
    },
    onWords: setWords,
    onText: (t) => { setHeard(t); setWords(t); void ask(t); },
    onError: (m) => { setNotice(m); setPhase((cur) => (cur === "listening" ? "idle" : cur)); },
  });
  const live = useRef({ talk, open, voiceIn });
  useEffect(() => { live.current = { talk, open, voiceIn }; });

  const close = useCallback(() => {
    live.current.talk.cancel();
    reset();
    setOpen(false); setTyping(false); setWords(null); setPressed(false);
  }, [reset]);
  const startTyping = useCallback((prefill = "") => {
    setTyping(true); setTyped(prefill);
    requestAnimationFrame(() => { field.current?.focus(); field.current?.select(); });
  }, []);

  // Hold Control + Option (Ctrl + Alt) anywhere to talk; let go to ask. Ignored while another text field has focus.
  useEffect(() => {
    let down = 0;
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && live.current.open) { close(); return; }
      if (down || e.repeat || !isCombo(e)) return;
      const el = document.activeElement;
      if (typing(el) && !root.current?.contains(el)) return;
      e.preventDefault();
      down = performance.now();
      if (!live.current.open) setNth((n) => n + 1);
      setOpen(true);
      if (!live.current.voiceIn) { setNotice("This browser can't listen. Type your question instead."); return; }
      // Holding again while it speaks interrupts it: the voice stops and the old answer goes.
      setPressed(true); listening(); setWords(null); setTyping(false);
      void live.current.talk.begin();
    };
    const release = () => {
      if (!down) return;
      // A quick tap only opens the popup; a hold asks.
      const tap = performance.now() - down < 280;
      down = 0;
      setPressed(false);
      if (tap) live.current.talk.cancel(); else void live.current.talk.end();
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === "Control" || e.key === "Alt") release(); };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", release);
    return () => { window.removeEventListener("keydown", onDown, true); window.removeEventListener("keyup", onUp, true); window.removeEventListener("blur", release); };
  }, [close, listening, setNotice]);

  // openAsk(): from a suggested question, the demo's hand-off or the floating button.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ question?: string; type?: boolean }>).detail ?? {};
      if (!live.current.open) setNth((n) => n + 1);
      setOpen(true);
      if (d.question) { setTyping(false); setWords(null); setHeard(null); void ask(d.question); }
      else if (d.type) startTyping();
      // Keyboard users land in the popup, so Escape and Tab start there.
      requestAnimationFrame(() => root.current?.focus({ preventScroll: true }));
    };
    window.addEventListener(OPEN, onOpen);
    return () => window.removeEventListener(OPEN, onOpen);
  }, [ask, setHeard, startTyping]);

  const state: OrbState = talk.phase === "listening" || (pressed && talk.phase === "idle") ? "listening" : talk.phase === "transcribing" ? "transcribing" : phase;
  const answering = !!shown;
  const busy = state === "thinking" || state === "transcribing";
  const submit = () => { const q = typed.trim(); if (!q) return; setTyped(""); setTyping(false); setWords(null); setHeard(null); void ask(q); };
  const next = nextQuestions(shown?.question ?? null, 2);

  const status = state === "listening" ? <><span className="font-medium text-white">Listening</span> · let go to ask</>
    : state === "transcribing" ? <><span className="font-medium text-white">Got it</span> · writing down your question</>
    : state === "thinking" ? <><span className="font-medium text-white">Reading the books</span>{heard ? null : " · every number comes from the data"}</>
    : notice ? notice
    : keyboard && voiceIn ? "Let go of the keys when you're done."
    : voiceIn ? "Hold the orb while you speak, then let go."
    : "This browser can't listen. Type your question instead.";

  // The popup's head beside the small orb, once there is an answer: what the orb is doing, or how to ask again.
  const headLine = state === "listening" ? "Listening · let go to ask"
    : state === "transcribing" ? "Writing down your question"
    : state === "thinking" ? "Reading the books"
    : state === "speaking" ? "Answering out loud"
    : keyboard && voiceIn ? <>Hold <TalkKeys /> or the orb to ask anything</>
    : voiceIn ? "Hold the orb to ask anything"
    : "Type a question below";

  const typeBox = (dark: boolean) => (
    <form className="mt-4 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label htmlFor={`${titleId}-q`} className="sr-only">Type a question</label>
      <div className={`calm flex min-w-0 flex-1 items-center rounded-full border pl-4 pr-1 ${dark ? "border-white/25 bg-white/[0.08] focus-within:border-white/60" : "border-hairline bg-well focus-within:border-accent focus-within:bg-ground hover:border-strong"}`}>
        <input ref={field} id={`${titleId}-q`} value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={240} placeholder="Type a question" autoComplete="off"
          className={`min-h-11 min-w-0 flex-1 bg-transparent text-[14px] focus:outline-none lg:min-h-10 ${dark ? "text-white placeholder:text-white/50" : "text-ink placeholder:text-faint"}`} />
        <button type="submit" disabled={!typed.trim() || busy} aria-label="Ask"
          className={`calm grid size-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? "bg-white text-ink hover:bg-white/90 focus-visible:outline-white/80 disabled:bg-white/15 disabled:text-white/40" : "bg-accent text-white hover:bg-accent-hover focus-visible:outline-accent disabled:bg-inset disabled:text-faint"}`}>
          <ArrowUp size={16} strokeWidth={2} />
        </button>
      </div>
    </form>
  );

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div key="ask-overlay" ref={root} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby={titleId} data-lenis-prevent
            className="fixed inset-0 z-[90] focus:outline-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            {/* A dim over the page, blurred so the page behind (the hero's blue grid) never competes; a click on it
                closes the popup. On a phone, a full sheet of canvas. */}
            <div aria-hidden className="absolute inset-0 bg-canvas sm:bg-night/55 sm:backdrop-blur-[3px]" />
            <div className="absolute inset-0 flex items-start justify-center px-4 py-4 sm:items-center sm:py-[clamp(16px,6vh,56px)]"
              onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
              <h2 id={titleId} className="sr-only">Ask the books</h2>
              <div className="sr-only" aria-live="polite">{shown ? `${shown.question}. ${shown.answer.spoken}` : ""}</div>
              {/* One warm tray, never taller than the window: the orb heads it, and the card under it scrolls inside. */}
              <motion.div className={`flex max-h-full w-full flex-col overflow-hidden rounded-[16px] border border-hairline bg-warm shadow-[0_1px_2px_rgb(85_40_20/0.08),0_24px_60px_-24px_rgb(85_40_20/0.5)] ${answering ? "max-w-[680px]" : "max-w-[492px]"}`}
                initial={{ y: 14, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, scale: 0.99 }} transition={{ duration: 0.35, ease: EASE }}>
                <div className={`relative flex shrink-0 items-center ${answering ? "gap-3 py-2.5 pl-3 pr-12" : "justify-center pb-3 pt-6 sm:pt-7"}`}>
                  <motion.div layout transition={{ duration: 0.45, ease: EASE }} className="shrink-0">
                    <OrbButton talk={talk} state={state} voiceIn={voiceIn} busy={talk.phase === "transcribing"} small={answering}
                      className={answering ? "size-14" : "size-[112px] sm:size-[128px]"} />
                  </motion.div>
                  {answering ? (
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">Ask the books</p>
                      <p className="truncate text-[12.5px] text-secondary">{headLine}</p>
                    </div>
                  ) : null}
                  <button type="button" onClick={close} aria-label="Close" className="calm absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full text-faint hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent lg:size-9">
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>

                <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
                  {answering ? (
                    <div className="card p-5 sm:p-6">
                      <p className="text-[13px] text-secondary"><span className="text-faint">You asked</span> <span className="text-ink">{shown!.question}</span></p>
                      <div className="mt-2" key={shown!.question + shown!.from}>
                        <AnswerHead shown={shown!} state={state} onPlay={() => a.play(shown!)} onStop={a.stop} onReset={() => { a.reset(); setWords(null); }} captionClass="text-[clamp(18px,2vw,22px)]" />
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        <AnswerBody key={shown!.question + shown!.from} shown={shown!} state={state} />
                      </AnimatePresence>
                      <div className="mt-5 border-t border-hairline pt-4">
                        <span className="eyebrow">Ask next</span>
                        <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          {next.map((p) => (
                            <li key={p.id} className="min-w-0">
                              <button type="button" disabled={busy} onClick={() => { setHeard(null); setWords(null); void ask(p.question); }}
                                className="calm group/q flex h-full min-h-11 w-full items-center gap-3 rounded-[10px] border border-hairline bg-ground px-3.5 py-2 text-left text-[13px] leading-snug text-body hover:border-strong hover:bg-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
                                <span className="min-w-0 flex-1">{p.question}</span>
                                <ArrowRight aria-hidden size={14} strokeWidth={1.75} className="shrink-0 text-faint group-hover/q:text-accent" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        {typing_ ? typeBox(false) : (
                          <button type="button" onClick={() => startTyping()} className="calm mt-3 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] text-link hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:min-h-0">
                            Type instead<ArrowRight size={12} strokeWidth={1.75} aria-hidden />
                          </button>
                        )}
                        <p className="mt-3 text-[12px] text-faint">Read only: it can explain the books, never change them.</p>
                      </div>
                    </div>
                  ) : (
                    <CoachCard suggestion={suggestion} status={status} words={state !== "idle" || notice ? words ?? heard : null}
                      onType={typing_ ? undefined : () => startTyping(suggestion)}>
                      {typing_ ? typeBox(true) : null}
                      <p className="mt-4 text-[11.5px] text-white/55">Read only: it can explain the books, never change them. Esc closes.</p>
                    </CoachCard>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* On a phone or tablet there is no shortcut: a small button opens the popup, where the orb is held. */}
      {fab && !open ? (
        <button type="button" onClick={() => openAsk()}
          className="calm fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-[80] inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-ground px-4 text-[13px] font-medium text-ink shadow-[0_10px_30px_-12px_rgb(85_40_20/0.35)] hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [@media(hover:hover)_and_(pointer:fine)]:hidden">
          <Mic size={15} strokeWidth={1.75} className="text-accent" aria-hidden />Ask the books
        </button>
      ) : null}
    </>
  );
}
