/**
 * The landing-page ignition: when the logo lights and the page behind it reveals. Owns the state
 * machine (`idle -> go -> hurried -> lit`, `lit` terminal) and the rules for when it may start, so the
 * logo and the page both react to one source of truth (applied as `data-ignite` in the view).
 */
import { useCallback, useEffect, useRef, useState } from "react";

// The ignition's states and the only allowed transitions between them. `lit` is terminal: a
// finished (or reduced-motion) page never goes back to dark and never replays. Every write
// to the state goes through `ignitionNext`.
//
// `hurried` is `go` after the visitor scrolled, touched or clicked mid-reveal: the rest of the intro runs
// HURRY_RATE times faster instead of snapping to the end. It is a state of its own (not a flag beside the
// machine) because it changes what other code must do: the view shows it as `go` (the CSS animations
// must keep running, not restart) and must NOT pause it while the logo is off screen (a paused hurried
// intro left content invisible until the timer snapped it in).
export const IGNITE_STATES = ["idle", "go", "hurried", "lit"] as const;
export type IgniteState = (typeof IGNITE_STATES)[number];
export const IGNITE_EDGES: Record<IgniteState, readonly IgniteState[]> = {
  idle: ["go", "lit"], // idle -> go: visible and running; idle -> lit: reduced motion before starting, or input before it began
  go: ["hurried", "lit"], // go -> hurried: scroll/touch/click mid-reveal; go -> lit: key press, or motion turned off mid-sequence
  hurried: ["lit"], // hurried -> lit: the sped-up rest of the intro has finished (or a key press, or motion turned off)
  lit: [],
};

/** The state after requesting `to`: `to` if the edge is allowed (or a no-op), otherwise unchanged. */
export function ignitionNext(from: IgniteState, to: IgniteState): IgniteState {
  return from === to || IGNITE_EDGES[from].includes(to) ? to : from;
}

const START_VISIBLE_RATIO = 0.5; // begin once at least half of the observed element is on screen
const NO_OBSERVER_START_MS = 600; // browsers without IntersectionObserver start shortly after load
// If the intro has not started this long after mount (tab visible), show the finished page. This
// bounds how long content can stay transparent under ANY viewport: at 400% zoom the logo may
// never be half visible, and low-vision visitors must not be left with a blank page.
const FALLBACK_TO_LIT_MS = 1000;
// The intro (index.css) finishes by 2.1s; then the state settles to `lit` (the terminal state: the stage
// drops below the nav again and the steady-state loops take over).
const INTRO_MS = 2300;
// The intro plays on every full page load (a reload starts a fresh module, so this resets) but not
// again when the visitor navigates back to "/" inside the app.
let playedThisLoad = false;
/** Test hook: forget that the intro played (a real page load does this by reloading the module). */
export function resetIntroPlayed() {
  playedThisLoad = false;
}

// Input that means "I am here, show me the page". Route-change focus (PageTransition focusing the
// new <h1>, or <main>) is not user input and must not skip the intro.
//
// Two kinds. HURRY_EVENTS (scrolling, touching, clicking) hurry the intro: what is left of it runs
// HURRY_RATE times faster, so the page finishes revealing top to bottom instead of snapping to fully
// opaque. Before the intro has started there is nothing revealed yet, so they settle to the finished page
// at once (as every input used to). SKIP_EVENTS (keys, focus) always settle at once: Tab must land on a
// control that is already visible (WCAG 2.4.7), and a key press cannot be told apart from keyboard scrolling.
const HURRY_EVENTS = ["pointerdown", "wheel", "touchstart"] as const;
const SKIP_EVENTS = ["keydown"] as const;
const HURRY_RATE = 5; // the rest of the intro (at most ~2s) then takes at most ~0.45s
const HURRY_MARGIN_MS = 120; // slack so the last animation really ends before the state settles
// Pressing a control moves focus to it within the same task as the pointerdown: that focus is the press,
// not a Tab, and must not skip the intro that the press just hurried.
const POINTER_FOCUS_MS = 100;

const isRouteFocus = (target: EventTarget | null) =>
  target instanceof Element && (target.matches("[data-route-heading]") || target.id === "main-content");

// The running intro's CSS animations that end: every finite CSS animation on the page (the intro's are
// the only ones on Home; the flame's flicker and sway are infinite and keep their own pace). Selected by
// what they ARE (a CSS animation with finite iterations), not by name, so a new intro animation is
// hurried along with the rest instead of snapping at the end.
const finiteCssAnimations = () =>
  document
    .getAnimations()
    .filter(
      (animation) =>
        typeof (animation as CSSAnimation).animationName === "string" &&
        animation.effect?.getComputedTiming().iterations !== Infinity,
    );

/**
 * @param running false when the user prefers reduced motion: start (and stay) lit.
 * Attach `observedRef` to the element whose visibility starts the sequence (the logo).
 */
export function useIgnition(running: boolean) {
  const observedRef = useRef<HTMLDivElement>(null);
  // Reduced-motion visitors and in-app returns to "/" start lit: they never see a dark frame. Read
  // in the initializer so the very first render carries the right state (no flash of hidden content).
  const [phase, setPhase] = useState<IgniteState>(() => (running && !playedThisLoad ? "idle" : "lit"));
  const [offscreen, setOffscreen] = useState(false);
  const [visibleEnough, setVisibleEnough] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  // The one way to the finished page (timers, input and motion turning off all settle through it).
  const settle = useCallback(() => setPhase((state) => ignitionNext(state, "lit")), []);

  // Pausing (or reduced motion) settles to the finished state.
  useEffect(() => {
    if (!running) settle();
  }, [running, settle]);

  // Never play unseen: wait until the element is actually on screen.
  useEffect(() => {
    const element = observedRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisibleEnough(true), NO_OBSERVER_START_MS);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // Several records can be batched into one callback: the last one is the current state.
        const entry = entries[entries.length - 1];
        setOffscreen(!entry.isIntersecting);
        if (entry.intersectionRatio >= START_VISIBLE_RATIO) setVisibleEnough(true);
      },
      { threshold: [0, START_VISIBLE_RATIO] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ...nor in a background tab.
  useEffect(() => {
    const onChange = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (running && visibleEnough && tabVisible) setPhase((state) => ignitionNext(state, "go"));
  }, [running, visibleEnough, tabVisible]);

  // Left `idle` (it started, was skipped, or fell back to lit): do not replay on an in-app return to "/".
  useEffect(() => {
    if (phase !== "idle") playedThisLoad = true;
  }, [phase]);

  // The intro is over: settle to the finished page. Entering `hurried` replaces the go timer (this
  // effect's cleanup clears it) with one for the REMAINING time at the faster rate.
  const goStartedAtRef = useRef(0);
  useEffect(() => {
    if (phase === "go") {
      goStartedAtRef.current = Date.now();
      const timer = window.setTimeout(settle, INTRO_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "hurried") {
      const hurrying = finiteCssAnimations();
      if (hurrying.length === 0) {
        settle(); // nothing to speed up (no running CSS animation): do not wait for a timer
        return;
      }
      // playbackRate scales the whole timeline INCLUDING the delays, so the cascade keeps its order.
      for (const animation of hurrying) animation.updatePlaybackRate(HURRY_RATE);
      const remaining = Math.max(INTRO_MS - (Date.now() - goStartedAtRef.current), 0);
      const timer = window.setTimeout(settle, remaining / HURRY_RATE + HURRY_MARGIN_MS);
      return () => window.clearTimeout(timer);
    }
  }, [phase, settle]);

  // Never leave content hidden for long if the intro cannot start.
  useEffect(() => {
    if (phase !== "idle" || !tabVisible) return;
    const timer = window.setTimeout(settle, FALLBACK_TO_LIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, tabVisible, settle]);

  // Real input ends the wait. Keys and focus settle to the finished page at once (so the first Tab
  // press lands on a visible control); scrolling, touching and clicking hurry what is left instead.
  const pointerAtRef = useRef(0);
  useEffect(() => {
    if (phase === "lit") return;
    const hurry = () => {
      if (phase === "hurried") return; // once: a stream of wheel events must not restart it
      // Before the intro has started nothing is revealed, so there is nothing to hurry: settle (as any
      // input did before). Without the Web Animations API there is no way to hurry: the old instant skip.
      if (phase === "idle" || typeof document.getAnimations !== "function") return settle();
      setPhase((state) => ignitionNext(state, "hurried"));
    };
    const markPointer = () => {
      pointerAtRef.current = Date.now();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isRouteFocus(event.target)) return;
      if (Date.now() - pointerAtRef.current < POINTER_FOCUS_MS) return; // the press that moved focus, not a Tab
      settle();
    };
    document.addEventListener("pointerdown", markPointer, { capture: true, passive: true });
    for (const type of SKIP_EVENTS) document.addEventListener(type, settle, { passive: true });
    for (const type of HURRY_EVENTS) document.addEventListener(type, hurry, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", markPointer, { capture: true });
      for (const type of SKIP_EVENTS) document.removeEventListener(type, settle);
      for (const type of HURRY_EVENTS) document.removeEventListener(type, hurry);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [phase, settle]);

  return {
    // The DOM and the CSS know `go`: hurrying only changes the playback rate of what `go` started.
    ignite: phase === "hurried" ? ("go" as const) : phase,
    // A hurried intro must keep running even with the logo off screen (the pause would freeze it).
    offscreen: offscreen && phase !== "hurried",
    observedRef,
  };
}
