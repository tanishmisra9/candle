/**
 * The landing-page ignition: when the logo lights and the page behind it reveals. Owns the state
 * machine (`idle -> go -> lit`, `lit` terminal) and the rules for when it may start, so the
 * logo and the page both react to one source of truth (applied as `data-ignite` in the view).
 */
import { useEffect, useRef, useState } from "react";

// The ignition's states and the only allowed transitions between them. `lit` is terminal: a
// finished (or reduced-motion) page never goes back to dark and never replays. Every write
// to the state goes through `ignitionNext`.
export const IGNITE_STATES = ["idle", "go", "lit"] as const;
export type IgniteState = (typeof IGNITE_STATES)[number];
export const IGNITE_EDGES: Record<IgniteState, readonly IgniteState[]> = {
  idle: ["go", "lit"], // idle -> go: visible and running; idle -> lit: reduced motion before starting
  go: ["lit"], // go -> lit: skipped or motion turned off mid-sequence settles to the finished page
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
const SKIP_EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"] as const;
const isRouteFocus = (target: EventTarget | null) =>
  target instanceof Element && (target.matches("[data-route-heading]") || target.id === "main-content");

/**
 * @param running false when the user prefers reduced motion: start (and stay) lit.
 * Attach `observedRef` to the element whose visibility starts the sequence (the logo).
 */
export function useIgnition(running: boolean) {
  const observedRef = useRef<HTMLDivElement>(null);
  // Reduced-motion visitors and in-app returns to "/" start lit: they never see a dark frame. Read
  // in the initializer so the very first render carries the right state (no flash of hidden content).
  const [ignite, setIgnite] = useState<IgniteState>(() => (running && !playedThisLoad ? "idle" : "lit"));
  const [offscreen, setOffscreen] = useState(false);
  const [visibleEnough, setVisibleEnough] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  // Pausing (or reduced motion) settles to the finished state.
  useEffect(() => {
    if (!running) setIgnite((state) => ignitionNext(state, "lit"));
  }, [running]);

  // Never play unseen: wait until the element is actually on screen.
  useEffect(() => {
    const element = observedRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisibleEnough(true), NO_OBSERVER_START_MS);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
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
    if (running && visibleEnough && tabVisible) setIgnite((state) => ignitionNext(state, "go"));
  }, [running, visibleEnough, tabVisible]);

  // Started once: do not replay on an in-app return to "/".
  useEffect(() => {
    if (ignite === "go") playedThisLoad = true;
  }, [ignite]);

  // The intro is over: settle to the finished page.
  useEffect(() => {
    if (ignite !== "go") return;
    const timer = window.setTimeout(() => setIgnite((state) => ignitionNext(state, "lit")), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [ignite]);

  // Never leave content hidden for long if the intro cannot start.
  useEffect(() => {
    if (ignite !== "idle" || !tabVisible) return;
    const timer = window.setTimeout(() => setIgnite((state) => ignitionNext(state, "lit")), FALLBACK_TO_LIT_MS);
    return () => window.clearTimeout(timer);
  }, [ignite, tabVisible]);

  // Any real input skips to the finished page (so the first Tab press lands on a visible control).
  useEffect(() => {
    if (ignite === "lit") return;
    const skip = () => setIgnite((state) => ignitionNext(state, "lit"));
    const onFocusIn = (event: FocusEvent) => {
      if (!isRouteFocus(event.target)) skip();
    };
    for (const type of SKIP_EVENTS) document.addEventListener(type, skip, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      for (const type of SKIP_EVENTS) document.removeEventListener(type, skip);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [ignite]);

  return { ignite, offscreen, observedRef };
}
