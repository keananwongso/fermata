"use client";
// Ask the books, anywhere: one glass pill at the bottom centre of every page. Hold it (or hold Control + Option,
// Ctrl + Alt on Windows) and talk; while it listens, thinks and speaks the pill becomes the orb. Let go and the answer
// rises out of it in a glass card, spoken aloud and captioned. A tap opens the card with suggested questions instead.
// Read only, like every Ask the books surface: the assistant role has no actions.
//
// Mounted once by Providers. Anything can open it with `openAsk()` (with `{ question }` it asks straight away). A page
// with its own Ask panel hides the resting pill with `useHideDock()`. It shares the question and answer (useAsk), the
// answer (answer.tsx), the orb and the voice pipeline with the panel; see DESIGN.md, "Ask the books, anywhere".
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Play, Square, X } from "lucide-react";
import { AnswerBody } from "./answer";
import { SpokenCaption } from "./caption";
import { LevelBars } from "./level";
import { ThinkingOrb, type OrbState } from "./orb";
import { usePushToTalk, useVoiceInput } from "./pushToTalk";
import { nextQuestions, useAsk } from "./useAsk";
import { LIVE } from "./voice";

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;
const OPEN = "fermata:ask";
// A press shorter than this is a tap (open the card); longer, it listens. The microphone only opens on a hold, so a
// tap never asks for permission.
const HOLD_MS = 180;

// Opens the card; with a question it asks it straight away.
export function openAsk(detail: { question?: string } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail }));
}

// ---- A page with its own Ask panel hides the resting pill ---------------------------------------------------------

let hiders = 0;
const dockSubs = new Set<() => void>();
const subscribeDock = (cb: () => void) => { dockSubs.add(cb); return () => { dockSubs.delete(cb); }; };
export function useHideDock() {
  useEffect(() => {
    hiders++; dockSubs.forEach((f) => f());
    return () => { hiders--; dockSubs.forEach((f) => f()); };
  }, []);
}

// ---- The shortcut, named for this platform --------------------------------------------------------------------

const noop = () => () => {};
const mac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const KEYBOARD = "(hover: hover) and (pointer: fine)";
const subscribeKeyboard = (cb: () => void) => { const m = window.matchMedia(KEYBOARD); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

// "⌃⌥" on a Mac, "Ctrl Alt" elsewhere; null on the server. Never Command.
export function useTalkKeys() {
  return useSyncExternalStore(noop, () => (mac() ? "⌃⌥" : "Ctrl Alt"), () => null);
}
// A mouse and keyboard; false on a phone or tablet.
export function useKeyboard() {
  return useSyncExternalStore(subscribeKeyboard, () => window.matchMedia(KEYBOARD).matches, () => true);
}

const CANT_LISTEN = "This browser can't listen. Try Chrome, Edge or Safari.";
// The voice pipeline's notices are shared with the panel, which has a type box; the dock has none.
const voiceOnly = (m: string) => m.replace(/\s*(Type your question instead\.?|, or type( it| instead)?)/, "").replace(/\s+\./, ".") || CANT_LISTEN;
const isCombo = (e: KeyboardEvent) => e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey && (e.key === "Control" || e.key === "Alt");
const typing = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);
const chip = "glass-chip calm inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 lg:min-h-9";

// ---- The dock ------------------------------------------------------------------------------------------------------

export function AskOverlay() {
  const a = useAsk();
  const { phase, setPhase, shown, notice, setNotice, heard, setHeard, ask, reset, listening, stop } = a;
  const [card, setCard] = useState(false);
  // The press is down (pointer, Space or the shortcut), and a hold has begun listening.
  const [pressing, setPressing] = useState(false);
  const [holding, setHolding] = useState(false);
  const [words, setWords] = useState("");
  const voiceIn = useVoiceInput();
  const keyboard = useKeyboard();
  const keys = useTalkKeys();
  const hidden = useSyncExternalStore(subscribeDock, () => hiders > 0, () => false);
  const cardRef = useRef<HTMLElement>(null);
  const titleId = useId();

  const talk = usePushToTalk({
    disabled: !voiceIn, blips: true,
    onPhase: (p) => {
      if (p === "listening") listening();
      else if (p === "transcribing") setPhase("transcribing");
      else setPhase((cur) => (cur === "listening" || cur === "transcribing" ? "idle" : cur));
    },
    onWords: setWords,
    onText: (t) => { setHeard(t); void ask(t); },
    onError: (m) => { setNotice(m); setPhase((cur) => (cur === "listening" ? "idle" : cur)); },
  });

  const state: OrbState = talk.phase === "listening" || (holding && talk.phase === "idle") ? "listening" : talk.phase === "transcribing" ? "transcribing" : phase;
  const working = state !== "idle";
  const open = card || !!shown || !!notice;
  const busy = state === "thinking" || state === "transcribing";

  const live = useRef({ talk, open, voiceIn, state });
  useEffect(() => { live.current = { talk, open, voiceIn, state }; });

  const close = useCallback(() => {
    live.current.talk.cancel();
    reset();
    setCard(false); setHolding(false); setWords("");
  }, [reset]);

  // One press, whatever started it: a hold listens, a tap opens the card (or stops the voice while it talks).
  const press = useRef<{ timer: number | null; held: boolean } | null>(null);
  const pressStart = useCallback(() => {
    if (press.current) return;
    const p: { timer: number | null; held: boolean } = { timer: null, held: false };
    press.current = p;
    setPressing(true);
    if (!live.current.voiceIn) return;
    p.timer = window.setTimeout(() => {
      if (press.current !== p) return;
      p.held = true;
      setHolding(true); setWords(""); listening();
      void live.current.talk.begin();
    }, HOLD_MS);
  }, [listening]);
  const pressEnd = useCallback(() => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    setPressing(false);
    if (p.timer) clearTimeout(p.timer);
    if (p.held) {
      // Let go before the microphone opened: there is nothing to ask, so the orb goes back to rest.
      const opened = live.current.talk.phase === "listening";
      setHolding(false);
      if (opened) void live.current.talk.end();
      else { live.current.talk.cancel(); setPhase((cur) => (cur === "listening" ? "idle" : cur)); }
      return;
    }
    // A tap.
    const s = live.current.state;
    if (s === "speaking" || s === "thinking") { stop(); return; }
    if (!live.current.voiceIn) setNotice(CANT_LISTEN);
    if (live.current.open) close(); else setCard(true);
  }, [stop, close, setNotice, setPhase]);

  // Hold Control + Option (Ctrl + Alt) anywhere; let go to ask. Ignored while a text field has focus.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && live.current.open) { close(); return; }
      if (e.repeat || !isCombo(e) || typing(document.activeElement)) return;
      e.preventDefault();
      pressStart();
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === "Control" || e.key === "Alt") pressEnd(); };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", pressEnd);
    return () => { window.removeEventListener("keydown", onDown, true); window.removeEventListener("keyup", onUp, true); window.removeEventListener("blur", pressEnd); };
  }, [close, pressStart, pressEnd]);

  // openAsk(): a suggested question, the demo's hand-off.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ question?: string }>).detail ?? {};
      setCard(true);
      if (d.question) { setHeard(null); void ask(d.question); }
      requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener(OPEN, onOpen);
    return () => window.removeEventListener(OPEN, onOpen);
  }, [ask, setHeard]);

  // What the orb is doing, in a few words.
  const status = state === "listening" ? (words ? null : "Listening")
    : state === "transcribing" ? "Got it"
    : state === "thinking" ? "Reading the books"
    : state === "speaking" ? "Answering"
    : null;

  const suggestions = nextQuestions(shown?.question ?? null, shown ? 2 : 4);
  const showPill = !hidden || open || working || pressing;

  return (
    <>
      {/* A faint veil while the card is open: a click on it closes. No blur, so the page stays itself. */}
      <AnimatePresence>
        {open ? (
          <motion.div key="veil" aria-hidden onClick={close} className="fixed inset-0 z-[89] bg-night/10"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} />
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-3 px-4">
        <div className="sr-only" aria-live="polite">{shown ? `${shown.question}. ${shown.answer.spoken}` : status ?? ""}</div>

        {/* The card rises out of the pill. */}
        <AnimatePresence>
          {open ? (
            <motion.section key="card" ref={cardRef} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby={titleId} data-lenis-prevent
              className="glass pointer-events-auto flex max-h-[min(72vh,680px)] w-full max-w-[600px] origin-bottom flex-col overflow-hidden rounded-[26px] focus:outline-none"
              initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.95 }} transition={SPRING}>
              <header className="flex shrink-0 items-center gap-2.5 py-3 pl-5 pr-2">
                <h2 id={titleId} className="text-[13px] font-medium text-ink">Ask the books</h2>
                <span className="text-[12.5px] text-secondary">{status ? <>· {status}</> : shown ? null : "· read only"}</span>
                <button type="button" onClick={close} aria-label="Close" className="calm ml-auto grid size-11 place-items-center rounded-full text-faint hover:bg-white/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent lg:size-8">
                  <X size={15} strokeWidth={1.75} />
                </button>
              </header>

              <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
                {shown ? (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={shown.question + shown.from} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
                      <p className="text-[12.5px] text-faint">&ldquo;{heard ?? shown.question}&rdquo;</p>
                      <SpokenCaption text={shown.answer.spoken} live={state === "speaking"} className="title mt-2 text-[19px] leading-[1.3] sm:text-[21px]" />
                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        {state === "speaking" || state === "thinking" ? (
                          <button type="button" onClick={a.stop} className={chip}><Square size={10} strokeWidth={2} fill="currentColor" className="text-accent" />Stop</button>
                        ) : (
                          <button type="button" onClick={() => a.play(shown)} disabled={!shown.audio && !LIVE} className={chip}><Play size={11} strokeWidth={2} fill="currentColor" className="text-accent" />Play again</button>
                        )}
                        <span className="text-[11.5px] text-faint">
                          {shown.from === "recorded" ? "Recorded" : "Live"} · {shown.answer.checked ? "every number from the books" : "written by code"}
                        </span>
                      </div>
                      <AnswerBody shown={shown} state={state} className="mt-4" />
                    </motion.div>
                  </AnimatePresence>
                ) : notice ? (
                  <p className="pt-1 text-[14px] text-body" role="status">{voiceOnly(notice)}</p>
                ) : (
                  <p className="pt-1 text-[15px] leading-snug text-body">
                    {voiceIn ? <>Hold the button below and ask anything about the books.</> : CANT_LISTEN}
                  </p>
                )}

                {!working || shown ? (
                  <div className="mt-5">
                    <span className="eyebrow">{shown ? "Ask next" : "Or try"}</span>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {suggestions.map((p) => (
                        <li key={p.id} className="min-w-0">
                          <button type="button" disabled={busy} onClick={() => { setHeard(null); void ask(p.question); }}
                            className="glass-chip calm group/q inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 text-left text-[13px] leading-snug text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 lg:min-h-9">
                            <span className="min-w-0">{p.question}</span>
                            <ArrowUpRight aria-hidden size={13} strokeWidth={1.75} className="shrink-0 text-faint group-hover/q:text-accent" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* While it listens with the card closed, the words so far float above the orb. */}
        <AnimatePresence>
          {!open && working ? (
            <motion.div key="bubble" className="glass pointer-events-none flex max-w-[min(520px,100%)] items-center gap-2.5 rounded-full px-4 py-2 text-[13.5px] text-ink"
              initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={SPRING}>
              {state === "listening" ? <LevelBars active className="shrink-0" /> : null}
              <span className={`min-w-0 truncate ${words && state === "listening" ? "" : "text-secondary"}`}>{state === "listening" && words ? words : status}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* The pill, which is the orb while it works. */}
        <AnimatePresence>
          {showPill ? (
            <motion.button key="pill" type="button" layout transition={SPRING} style={{ borderRadius: 999 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, scale: pressing ? 0.95 : 1 }} exit={{ opacity: 0, y: 12 }}
              aria-label={!voiceIn ? "Ask the books" : state === "listening" ? "Listening. Let go to ask" : state === "speaking" ? "Tap to stop" : "Hold to ask the books out loud, or tap for suggestions"}
              onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); pressStart(); }}
              onPointerUp={pressEnd} onPointerCancel={pressEnd} onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) pressStart(); } }}
              onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); pressEnd(); } }}
              className={`glass group pointer-events-auto flex touch-none select-none items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${working ? "size-[76px] justify-center p-1.5" : "h-12 gap-2.5 pl-2 pr-4"}`}>
              <motion.span layout="position" transition={SPRING} className={`relative block shrink-0 ${working ? "float size-full" : "size-8"}`}>
                <ThinkingOrb state={state} className="absolute inset-0" />
              </motion.span>
              {!working ? (
                <motion.span layout="position" className="flex items-center gap-2 whitespace-nowrap text-[13.5px] font-medium text-ink">
                  {open && voiceIn ? "Hold to talk" : "Ask the books"}
                  {keyboard && voiceIn && keys ? <kbd className="font-mono text-[11px] font-normal tracking-normal text-faint">{keys}</kbd> : null}
                </motion.span>
              ) : null}
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
